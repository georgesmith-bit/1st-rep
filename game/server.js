const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);
    
    try {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const mimeTypes = {
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.html': 'text/html'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/html' });
        res.end(content);
    } catch (e) {
        res.writeHead(404);
        res.end('404');
    }
});

server.listen(8000, () => {
    console.log('Server running at http://localhost:8000');
});