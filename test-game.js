const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = path.join(process.env.TEMP, 'edge-test-profile-' + Date.now());

function runEdge(url, extraArgs = '') {
  execSync(`"${edgePath}" --headless --disable-gpu --user-data-dir="${profileDir}" --no-first-run --no-default-browser-check ${extraArgs} "${url}" 2>NUL`, { timeout: 15000 });
}

function takeScreenshot(label, url = 'http://localhost:8000') {
  const filePath = path.join(SCREENSHOT_DIR, `${label}.png`);
  execSync(`"${edgePath}" --headless --disable-gpu --user-data-dir="${profileDir}" --no-first-run --no-default-browser-check --screenshot="${filePath}" --window-size=1280,900 "${url}" 2>NUL`, { timeout: 15000 });
  console.log(`Screenshot: ${filePath}`);
}

// Step 1: Set up localStorage with a data URL, then navigate to game
console.log('Setting up mid-game state...');
const midGameState = JSON.stringify({
  grid: [
    [{id:1,value:2},{id:2,value:4},{id:3,value:2},{id:4,value:8}],
    [{id:5,value:4},{id:6,value:2},{id:7,value:16},{id:8,value:2}],
    [{id:9,value:2},{id:10,value:8},{id:11,value:4},{id:12,value:2}],
    [{id:13,value:4},{id:14,value:2},{id:15,value:2},{id:16,value:4}]
  ],
  score: 128, best: 256, gameOver: false, won: false, keepPlaying: false, nextTileId: 17
}).replace(/'/g, "\\'");

const setupUrl = `data:text/html,<script>localStorage.setItem('gameState','${midGameState}');localStorage.setItem('best','256');window.location='http://localhost:8000';</script>`;
runEdge(setupUrl);

// Now take screenshot of mid-game
console.log('Taking mid-game screenshot...');
takeScreenshot('02-midgame');

// Step 2: Set up game over state
console.log('Setting up game over state...');
const goState = JSON.stringify({
  grid: [
    [{id:1,value:2},{id:2,value:4},{id:3,value:8},{id:4,value:16}],
    [{id:5,value:4},{id:6,value:8},{id:7,value:16},{id:8,value:32}],
    [{id:9,value:8},{id:10,value:16},{id:11,value:32},{id:12,value:64}],
    [{id:13,value:16},{id:14,value:32},{id:15,value:64},{id:16,value:128}]
  ],
  score: 500, best: 500, gameOver: true, won: false, keepPlaying: false, nextTileId: 17
}).replace(/'/g, "\\'");

const goUrl = `data:text/html,<script>localStorage.setItem('gameState','${goState}');localStorage.setItem('best','500');window.location='http://localhost:8000';</script>`;
runEdge(goUrl);

console.log('Taking game over screenshot...');
takeScreenshot('03-gameover');

// Step 3: Set up win state
console.log('Setting up win state...');
const winState = JSON.stringify({
  grid: [
    [{id:1,value:2},{id:2,value:4},{id:3,value:8},{id:4,value:16}],
    [{id:5,value:4},{id:6,value:8},{id:7,value:16},{id:8,value:32}],
    [{id:9,value:8},{id:10,value:16},{id:11,value:32},{id:12,value:64}],
    [{id:13,value:16},{id:14,value:32},{id:15,value:64},{id:16,value:2048}]
  ],
  score: 1000, best: 1000, gameOver: false, won: true, keepPlaying: false, nextTileId: 17
}).replace(/'/g, "\\'");

const winUrl = `data:text/html,<script>localStorage.setItem('gameState','${winState}');localStorage.setItem('best','1000');window.location='http://localhost:8000';</script>`;
runEdge(winUrl);

console.log('Taking win screenshot...');
takeScreenshot('04-win');

// Step 4: Set up dark mode
console.log('Setting up dark mode...');
const darkUrl = `data:text/html,<script>localStorage.setItem('theme','dark');window.location='http://localhost:8000';</script>`;
runEdge(darkUrl);

console.log('Taking dark mode screenshot...');
takeScreenshot('05-darkmode');

console.log('Done! All screenshots in:', SCREENSHOT_DIR);
