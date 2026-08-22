const http = require('http');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function postJSON(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({hostname:u.hostname,port:u.port,path:u.pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':body.length}}, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d));
    });
    req.on('error',reject); req.write(body); req.end();
  });
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d)));
    }).on('error',reject);
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // 1. 通过 localStorage 设置一个必定合并的初始状态
  // 创建一个临时 HTML 页面来设置 localStorage
  const setupHtml = `<!DOCTYPE html><html><body><script>
    const state = {
      grid: [
        [{id:1,value:2},{id:2,value:2},{id:3,value:4},{id:4,value:8}],
        [null,null,null,null],
        [null,null,null,null],
        [null,null,null,null]
      ],
      score: 0, best: 0, gameOver: false, won: false, keepPlaying: false, nextTileId: 5
    };
    localStorage.setItem('2048_gameState', JSON.stringify(state));
    localStorage.setItem('2048_best', '0');
    document.body.innerHTML = '<h1>Setup done</h1>';
  </script></body></html>`;

  const setupPath = path.join(process.env.TEMP, '2048-setup-v2.html');
  fs.writeFileSync(setupPath, setupHtml);

  // 2. 用 Edge 加载 setup 页面设置 localStorage
  console.log('Setting up localStorage...');
  execSync(`"${edgePath}" --headless --disable-gpu --no-first-run --no-default-browser-check --timeout=5000 "file:///${setupPath.replace(/\\/g, '/')}" 2>NUL`, { timeout: 10000 });

  await delay(1000);

  // 3. 打开游戏（使用同一个 user-data-dir 以共享 localStorage）
  const profileDir = path.join(process.env.TEMP, 'edge-merge-final-' + Date.now());
  console.log('Opening game...');
  execSync(`"${edgePath}" --headless --disable-gpu --user-data-dir="${profileDir}" --no-first-run --no-default-browser-check --timeout=15000 "http://localhost:8000" 2>NUL`, { timeout: 20000 });

  await delay(3000);

  // 4. 查看初始状态
  const initState = await getJSON('http://localhost:8000/state');
  console.log('Initial state:', JSON.stringify(initState));

  // 5. 截图初始状态
  const shot1 = path.join(SCREENSHOT_DIR, 'final-01-initial.png');
  execSync(`"${edgePath}" --headless --disable-gpu --user-data-dir="${profileDir}" --no-first-run --no-default-browser-check --screenshot="${shot1}" --window-size=1280,900 --timeout=5000 "http://localhost:8000" 2>NUL`, { timeout: 10000 });
  console.log('Screenshot 1:', shot1);

  await delay(1000);

  // 6. 发送向左方向键（触发 2+2=4 合并）
  console.log('Sending left arrow...');
  await postJSON('http://localhost:8000/cmd', { direction: 3 });

  await delay(2000);

  // 7. 查看合并后状态
  const afterState = await getJSON('http://localhost:8000/state');
  console.log('After merge:', JSON.stringify(afterState));

  // 8. 查看 DOM 状态
  const domState = await getJSON('http://localhost:8000/dom');
  console.log('DOM state:', JSON.stringify(domState));

  // 9. 截图合并后状态
  const shot2 = path.join(SCREENSHOT_DIR, 'final-02-after-merge.png');
  execSync(`"${edgePath}" --headless --disable-gpu --user-data-dir="${profileDir}" --no-first-run --no-default-browser-check --screenshot="${shot2}" --window-size=1280,900 --timeout=5000 "http://localhost:8000" 2>NUL`, { timeout: 10000 });
  console.log('Screenshot 2:', shot2);

  // 10. 再发送几次方向键，触发更多合并
  console.log('Sending more moves...');
  for (let i = 0; i < 10; i++) {
    const dir = [3, 0, 1, 2][i % 4]; // left, up, right, down
    await postJSON('http://localhost:8000/cmd', { direction: dir });
    await delay(1000);

    const s = await getJSON('http://localhost:8000/state');
    if (s.score > 0) {
      console.log(`Score after move ${i+1}: ${s.score}`);
    }
    if (s.gameOver) {
      console.log('Game Over!');
      break;
    }
  }

  // 11. 最终截图
  const shot3 = path.join(SCREENSHOT_DIR, 'final-03-end.png');
  execSync(`"${edgePath}" --headless --disable-gpu --user-data-dir="${profileDir}" --no-first-run --no-default-browser-check --screenshot="${shot3}" --window-size=1280,900 --timeout=5000 "http://localhost:8000" 2>NUL`, { timeout: 10000 });
  console.log('Screenshot 3:', shot3);

  console.log('Done!');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  console.error(e.stack);
});
