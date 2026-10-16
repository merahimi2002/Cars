const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/__cars_health') {
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ app: 'cars', root }));
        return;
    }
    // Mirror GitHub Pages' repository subpath during local checks.
    const pathname = url.pathname.replace(/^\/Cars(?=\/)/, '');
    const target = path.resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    fs.stat(target, (error, stat) => {
        if (error || !stat.isFile()) { response.writeHead(404).end('Not found'); return; }
        response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
        fs.createReadStream(target).pipe(response);
    });
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
