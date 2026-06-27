const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;

const MIME_TYPES = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html'
};

// Log file
const log = (msg) => {
    const ts = new Date().toISOString().slice(11, 23);
    const line = `[${ts}] ${msg}\n`;
    fs.appendFileSync(path.join(BASE_DIR, 'server.log'), line);
    console.log(line.trim());
};

// Remote control: command queue
let cmdQueue = [];
let latestState = null;
let latestDOM = null;

const server = http.createServer((req, res) => {
    // API: Get next command
    if (req.url === '/cmd' && req.method === 'GET') {
        const cmd = cmdQueue.shift() || null;
        if (cmd !== null) {
            log(`[CMD] sent: ${cmd}, queue remaining: ${cmdQueue.length}`);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ cmd }));
        return;
    }
    
    // API: Send command (POST body: direction 0-3)
    if (req.url === '/cmd' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { direction } = JSON.parse(body);
                cmdQueue.push(direction);
                log(`[CMD] received: ${direction}, queue size: ${cmdQueue.length}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(400);
                res.end('Bad request');
            }
        });
        return;
    }
    
    // API: Client reports state
    if (req.url === '/state' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                latestState = JSON.parse(body);
                log(`[STATE] score=${latestState.score}, tiles=${latestState.grid.flat().filter(v=>v>0).length}`);
            } catch (e) {}
            res.writeHead(200);
            res.end('ok');
        });
        return;
    }
    
    // API: Get game state
    if (req.url === '/state' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(latestState || { error: 'no state yet' }));
        return;
    }

    // API: Client reports DOM visual state
    if (req.url === '/dom' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.tiles) {
                    latestDOM = data.tiles;
                    log(`[DOM] ${data.tiles.length} tiles, boardChildren=${data.boardChildren}: ` + data.tiles.map(t => `(${t.left},${t.top})v=${t.val}`).join(', '));
                } else {
                    latestDOM = data;
                    log(`[DOM] ${data.length} tiles (old format): ` + data.map(t => `(${t.left},${t.top})v=${t.val}`).join(', '));
                }
            } catch (e) {
                log('[DOM] parse error: ' + e.message);
            }
            res.writeHead(200);
            res.end('ok');
        });
        return;
    }

    // API: Get DOM visual state
    if (req.url === '/dom' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(latestDOM || { error: 'no dom yet' }));
        return;
    }
    
    // Root redirect to English version
    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(302, { 'Location': '/en/' });
        res.end();
        return;
    }

    // Static files
    let filePath = req.url.split('?')[0];
    filePath = path.resolve(path.join(BASE_DIR, filePath));

    // If path is a directory, serve index.html inside it
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }
    
    if (!filePath.startsWith(BASE_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    try {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, { 
            'Content-Type': MIME_TYPES[ext] || 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache'
        });
        res.end(content);
    } catch (e) {
        res.writeHead(404);
        res.end('404');
    }
});

server.listen(8000, '0.0.0.0', () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIP = 'localhost';
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIP = iface.address;
                break;
            }
        }
    }
    log('Server running at http://localhost:8000');
    log(`LAN access: http://${localIP}:8000`);
});
