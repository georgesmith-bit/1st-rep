const http = require('http');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

const CDP_PORT = 9225;
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = path.join(process.env.TEMP, 'edge-cdp-' + Date.now());

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function cdpFetch(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}${urlPath}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

// Minimal WebSocket client using raw TCP
function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const key = crypto.randomBytes(16).toString('base64');
    const socket = net.createConnection({ host: u.hostname, port: parseInt(u.port) || 80 }, () => {
      socket.write(
        `GET ${u.pathname} HTTP/1.1\r\n` +
        `Host: ${u.host}\r\n` +
        `Upgrade: websocket\r\n` +
        `Connection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\n` +
        `Sec-WebSocket-Version: 13\r\n` +
        `\r\n`
      );
    });

    let buffer = Buffer.alloc(0);
    let handshakeDone = false;
    let frameBuffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      if (!handshakeDone) {
        buffer = Buffer.concat([buffer, data]);
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          handshakeDone = true;
          const remaining = buffer.slice(headerEnd + 4);
          if (remaining.length > 0) processData(remaining);
        }
      } else {
        processData(data);
      }
    });

    function processData(data) {
      frameBuffer = Buffer.concat([frameBuffer, data]);
      while (frameBuffer.length >= 2) {
        const firstByte = frameBuffer[0];
        const secondByte = frameBuffer[1];
        const opcode = firstByte & 0x0F;
        const masked = (secondByte & 0x80) !== 0;
        let payloadLen = secondByte & 0x7F;
        let headerSize = 2;

        if (payloadLen === 126) {
          if (frameBuffer.length < 4) return;
          payloadLen = frameBuffer.readUInt16BE(2);
          headerSize = 4;
        } else if (payloadLen === 127) {
          if (frameBuffer.length < 10) return;
          payloadLen = Number(frameBuffer.readBigUInt64BE(2));
          headerSize = 10;
        }

        if (masked) {
          headerSize += 4;
        }

        if (frameBuffer.length < headerSize + payloadLen) return;

        let payload = frameBuffer.slice(headerSize, headerSize + payloadLen);
        if (masked) {
          const mask = frameBuffer.slice(headerSize - 4, headerSize);
          for (let i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i % 4];
          }
        }

        frameBuffer = frameBuffer.slice(headerSize + payloadLen);

        if (opcode === 1) { // text
          const msg = payload.toString('utf8');
          try {
            const parsed = JSON.parse(msg);
            if (wsCallbacks[parsed.id]) {
              wsCallbacks[parsed.id](parsed);
              delete wsCallbacks[parsed.id];
            }
          } catch(e) {}
        } else if (opcode === 8) { // close
          socket.destroy();
        }
      }
    }

    const wsCallbacks = {};
    let msgId = 1;

    const ws = {
      send(method, params = {}) {
        return new Promise((resolve, reject) => {
          const id = msgId++;
          wsCallbacks[id] = (result) => {
            if (result.error) reject(new Error(result.error.message));
            else resolve(result.result);
          };
          const msg = JSON.stringify({ id, method, params });
          const payload = Buffer.from(msg, 'utf8');
          let header;
          if (payload.length < 126) {
            header = Buffer.alloc(2);
            header[0] = 0x81;
            header[1] = payload.length;
          } else if (payload.length < 65536) {
            header = Buffer.alloc(4);
            header[0] = 0x81;
            header[1] = 126;
            header.writeUInt16BE(payload.length, 2);
          }
          socket.write(Buffer.concat([header, payload]));
        });
      },
      close() { socket.destroy(); }
    };

    socket.on('error', reject);
    resolve(ws);
  });
}

async function takeScreenshot(ws, label) {
  const result = await ws.send('Page.captureScreenshot', { format: 'png' });
  const filePath = path.join(SCREENSHOT_DIR, `${label}.png`);
  fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
  console.log(`Screenshot: ${filePath}`);
  return filePath;
}

async function evalJS(ws, expr) {
  const result = await ws.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return result.result.value;
}

async function main() {
  console.log('Starting Edge with CDP...');
  const proc = spawn(edgePath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ], { stdio: 'ignore', detached: true });

  await delay(3000);

  const tabs = await cdpFetch('/json');
  const tab = tabs.find(t => t.url.includes('localhost:8000')) || tabs[0];
  if (!tab) { console.log('No tabs found'); proc.kill(); return; }

  console.log('Connecting to CDP:', tab.url);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  await ws.send('Page.enable');
  await ws.send('Runtime.enable');
  await ws.send('Input.enable');

  await delay(1000);

  // 1. Initial screenshot
  await takeScreenshot(ws, 'cdp-01-initial');

  // 2. Check initial state
  const initState = await evalJS(ws, `JSON.stringify({
    grid: grid.map(row => row.map(cell => cell ? {v:cell.value,id:cell.id} : null)),
    score: gameState.score
  })`);
  console.log('Initial state:', initState);

  // 3. Set up merge scenario: two 2s in same row
  console.log('Setting up 2+2 merge scenario...');
  await evalJS(ws, `
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        grid[r][c] = null;

    grid[0][0] = { id: 100, value: 2 };
    grid[0][1] = { id: 101, value: 2 };
    grid[0][2] = { id: 102, value: 4 };
    grid[0][3] = { id: 103, value: 8 };

    tileElements.clear();
    boardEl.querySelectorAll('.tile').forEach(t => t.remove());
    gridBackgroundBuilt = false;

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = grid[r][c];
        if (!cell) continue;
        const tile = createTileElement(cell.id, cell.value, r, c);
        boardEl.appendChild(tile);
        tileElements.set(cell.id, tile);
      }
    }
    sendState();
  `);

  await delay(500);
  await takeScreenshot(ws, 'cdp-02-before-merge');

  // 4. Press left arrow to trigger merge
  console.log('Pressing left arrow...');
  await ws.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'ArrowLeft', code: 'ArrowLeft',
    windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37
  });
  await ws.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft',
    windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37
  });

  await delay(1500);

  // 5. Check state after merge
  const afterState = await evalJS(ws, `JSON.stringify({
    grid: grid.map(row => row.map(cell => cell ? {v:cell.value,id:cell.id} : null)),
    score: gameState.score,
    tileCount: tileElements.size,
    tiles: Array.from(tileElements.values()).map(t => ({
      id: t.dataset.id,
      classes: t.className,
      text: t.querySelector('.tile-inner')?.textContent
    }))
  })`);
  console.log('After 2+2 merge:', afterState);

  await takeScreenshot(ws, 'cdp-03-after-2merge');

  // 6. Set up 4+4 merge
  console.log('Setting up 4+4 merge...');
  await evalJS(ws, `
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        grid[r][c] = null;

    grid[1][0] = { id: 200, value: 4 };
    grid[1][1] = { id: 201, value: 4 };

    tileElements.clear();
    boardEl.querySelectorAll('.tile').forEach(t => t.remove());
    gridBackgroundBuilt = false;

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = grid[r][c];
        if (!cell) continue;
        const tile = createTileElement(cell.id, cell.value, r, c);
        boardEl.appendChild(tile);
        tileElements.set(cell.id, tile);
      }
    }
    sendState();
  `);

  await delay(500);
  await takeScreenshot(ws, 'cdp-04-before-4merge');

  await ws.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'ArrowLeft', code: 'ArrowLeft',
    windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37
  });
  await ws.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft',
    windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37
  });

  await delay(1500);

  const afterState2 = await evalJS(ws, `JSON.stringify({
    grid: grid.map(row => row.map(cell => cell ? {v:cell.value,id:cell.id} : null)),
    score: gameState.score,
    tiles: Array.from(tileElements.values()).map(t => ({
      id: t.dataset.id,
      classes: t.className,
      text: t.querySelector('.tile-inner')?.textContent
    }))
  })`);
  console.log('After 4+4 merge:', afterState2);

  await takeScreenshot(ws, 'cdp-05-after-4merge');

  // 7. Set up 8+8 merge
  console.log('Setting up 8+8 merge...');
  await evalJS(ws, `
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        grid[r][c] = null;

    grid[2][0] = { id: 300, value: 8 };
    grid[2][1] = { id: 301, value: 8 };

    tileElements.clear();
    boardEl.querySelectorAll('.tile').forEach(t => t.remove());
    gridBackgroundBuilt = false;

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = grid[r][c];
        if (!cell) continue;
        const tile = createTileElement(cell.id, cell.value, r, c);
        boardEl.appendChild(tile);
        tileElements.set(cell.id, tile);
      }
    }
    sendState();
  `);

  await delay(500);

  await ws.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'ArrowLeft', code: 'ArrowLeft',
    windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37
  });
  await ws.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft',
    windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37
  });

  await delay(1500);

  const afterState3 = await evalJS(ws, `JSON.stringify({
    grid: grid.map(row => row.map(cell => cell ? {v:cell.value,id:cell.id} : null)),
    score: gameState.score,
    tiles: Array.from(tileElements.values()).map(t => ({
      id: t.dataset.id,
      classes: t.className,
      text: t.querySelector('.tile-inner')?.textContent
    }))
  })`);
  console.log('After 8+8 merge:', afterState3);

  await takeScreenshot(ws, 'cdp-06-after-8merge');

  ws.close();
  proc.kill();
  console.log('Done!');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  console.error(e.stack);
});
