$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$screenshotDir = "$PSScriptRoot\screenshots"
if (-not (Test-Path $screenshotDir)) { New-Item -ItemType Directory -Path $screenshotDir | Out-Null }

$tempProfile = "$env:TEMP\edge-headless-test-$(Get-Random)"

# 启动 Edge headless 模式，带远程调试
$process = Start-Process $edgePath -ArgumentList @(
    "--remote-debugging-port=9222",
    "--user-data-dir=$tempProfile",
    "--no-first-run",
    "--no-default-browser-check",
    "http://localhost:8000"
) -PassThru -WindowStyle Hidden

Write-Host "Waiting for Edge to start..."
Start-Sleep -Seconds 3

# 获取 WebSocket URL
$tabs = Invoke-RestMethod -Uri "http://127.0.0.1:9222/json"
$tab = $tabs[0]
$wsUrl = $tab.webSocketDebuggerUrl
Write-Host "WebSocket URL: $wsUrl"

# 使用 .NET WebSocket 连接
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$uri = New-Object Uri($wsUrl)
$ws.ConnectAsync($uri, [System.Threading.CancellationToken]::None).Wait()

function Send-CDP($method, $params = @{}) {
    $id = Get-Random -Minimum 1 -Maximum 100000
    $msg = @{id=$id; method=$method; params=$params} | ConvertTo-Json -Depth 10 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
    $segment = [System.ArraySegment[byte]]::new($bytes)
    $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()

    # 等待响应
    $buffer = New-Object byte[] 65536
    $result = $ws.ReceiveAsync([System.ArraySegment[byte]]::new($buffer), [System.Threading.CancellationToken]::None).Result
    $response = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
    $parsed = $response | ConvertFrom-Json
    return $parsed.result
}

function Take-Screenshot($label) {
    $result = Send-CDP "Page.captureScreenshot" @{format="png"}
    $filePath = "$screenshotDir\$label.png"
    [System.IO.File]::WriteAllBytes($filePath, [Convert]::FromBase64String($result.data))
    Write-Host "Screenshot: $filePath"
}

# 等待页面加载
Start-Sleep -Seconds 1
Take-Screenshot "01-initial"

# 模拟按键玩游戏
$dirs = @("ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight")
$lastScore = 0
$noChangeCount = 0
$step = 0

for ($i = 0; $i -lt 50; $i++) {
    $dir = $dirs[(Get-Random -Minimum 0 -Maximum 4)]
    $keyCode = switch($dir) { "ArrowUp" {38} "ArrowDown" {40} "ArrowLeft" {37} "ArrowRight" {39} }

    Send-CDP "Input.dispatchKeyEvent" @{type="keyDown"; key=$dir; windowsVirtualKeyCode=$keyCode}
    Send-CDP "Input.dispatchKeyEvent" @{type="keyUp"; key=$dir; windowsVirtualKeyCode=$keyCode}

    Start-Sleep -Milliseconds 250

    $scoreResult = Send-CDP "Runtime.evaluate" @{expression='document.getElementById("score").textContent.trim()'}
    $score = [int]$scoreResult.result.value

    if ($score -eq $lastScore) { $noChangeCount++ } else { $noChangeCount = 0 }
    $lastScore = $score
    $step++

    if ($step % 10 -eq 0) {
        Take-Screenshot ("{0:D2}-step{1}-score{2}" -f $step, $step, $score)
    }

    # 检查 Game Over
    $goResult = Send-CDP "Runtime.evaluate" @{expression='document.getElementById("game-over").classList.contains("hidden")'}
    if ($goResult.result.value -eq $false) {
        Take-Screenshot "game-over"
        Write-Host "Game Over at step $step, score: $score"
        break
    }

    # 检查 Win
    $winResult = Send-CDP "Runtime.evaluate" @{expression='document.getElementById("win-message").classList.contains("hidden")'}
    if ($winResult.result.value -eq $false) {
        Take-Screenshot "win"
        Write-Host "Win at step $step, score: $score"
    }

    if ($noChangeCount -ge 10) {
        Take-Screenshot "stuck"
        Write-Host "Stuck at step $step, score: $score"
        break
    }
}

# 测试撤销
Take-Screenshot "before-undo"
Send-CDP "Runtime.evaluate" @{expression='document.getElementById("undo-btn").click()'}
Start-Sleep -Milliseconds 300
Take-Screenshot "after-undo"

# 测试 New Game
Send-CDP "Runtime.evaluate" @{expression='document.getElementById("new-game-btn").click()'}
Start-Sleep -Milliseconds 300
Take-Screenshot "new-game"

# 测试深色模式
Send-CDP "Runtime.evaluate" @{expression='document.getElementById("theme-toggle").click()'}
Start-Sleep -Milliseconds 300
Take-Screenshot "dark-mode"

$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "", [System.Threading.CancellationToken]::None).Wait()
Write-Host "Done! Screenshots in: $screenshotDir"
