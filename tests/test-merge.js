const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = path.join(process.env.TEMP, 'edge-merge-v2-' + Date.now());

function postJSON(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

function takeScreenshot(label) {
  const filePath = path.join(SCREENSHOT_DIR, `${label}.png`);
  execSync(`"${edgePath}" --headless --disable-gpu --user-data-dir="${profileDir}" --no-first-run --no-default-browser-check --screenshot="${filePath}" --window-size=1280,900 --virtual-time-budget=3000 "http://localhost:8000" 2>NUL`, { timeout: 15000 });
  console.log(`Screenshot: ${filePath}`);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // 1. 打开游戏（新 profile，无存档）
  console.log('Opening game...');
  execSync(`"${edgePath}" --headless --disable-gpu --user-data-dir="${profileDir}" --no-first-run --no-default-browser-check --virtual-time-budget=3000 "http://localhost:8000" 2>NUL`, { timeout: 15000 });
  await delay(1000);

  // 2. 初始截图
  takeScreenshot('01-initial');

  // 3. 通过 /cmd API 发送方向键，触发合并
  // 先查看当前状态
  const state0 = await getJSON('http://localhost:8000/state');
  console.log('Initial state:', JSON.stringify(state0.grid));

  // 发送多次方向键，尝试触发合并
  const dirs = [3, 0, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0];
  let mergeHappened = false;

  for (let i = 0; i < dirs.length; i++) {
    await postJSON('http://localhost:8000/cmd', { direction: dirs[i] });
    await delay(500); // 等待动画 + poll

    const state = await getJSON('http://localhost:8000/state');
    const score = state.score;

    if ((i + 1) % 4 === 0) {
      takeScreenshot(`${String(i+1).padStart(2,'0')}-step${i+1}-score${score}`);
    }

    if (score > 0 && !mergeHappened) {
      mergeHappened = true;
      console.log(`Merge detected at step ${i+1}! Score: ${score}`);
      takeScreenshot(`merge-detected-step${i+1}-score${score}`);
    }

    if (state.gameOver) {
      console.log(`Game Over at step ${i+1}! Score: ${score}`);
      takeScreenshot(`game-over-step${i+1}-score${score}`);
      break;
    }
  }

  if (!mergeHappened) {
    console.log('No merge happened in this run, trying more moves...');
    for (let i = 0; i < 20; i++) {
      const dir = Math.floor(Math.random() * 4);
      await postJSON('http://localhost:8000/cmd', { direction: dir });
      await delay(500);
      const state = await getJSON('http://localhost:8000/state');
      if (state.score > 0) {
        console.log(`Merge detected! Score: ${state.score}`);
        takeScreenshot(`merge-late-score${state.score}`);
        break;
      }
      if (state.gameOver) {
        takeScreenshot('game-over-late');
        break;
      }
    }
  }

  // 最终截图
  takeScreenshot('final');
  console.log('Done!');
}

main().catch(e => console.error('ERROR:', e.message));
