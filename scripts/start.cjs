const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const url = 'http://localhost:4173/';

function health() {
    return new Promise(resolve => {
        const request = http.get('http://127.0.0.1:4173/__cars_health', response => {
            let body = '';
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => {
                try { resolve(JSON.parse(body).root === root); } catch { resolve(false); }
            });
        });
        request.setTimeout(700, () => request.destroy());
        request.on('error', () => resolve(false));
    });
}

(async () => {
    if (!await health()) {
        const server = spawn(process.execPath, [path.join(__dirname, 'serve.cjs')], {
            cwd: root, detached: true, windowsHide: true, stdio: 'ignore'
        });
        server.unref();
        let ready = false;
        for (let attempt = 0; attempt < 20; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 150));
            if (await health()) { ready = true; break; }
        }
        if (!ready) throw new Error('Cannot start Cars on port 4173. Close any other server using that port, then retry.');
    }
    console.log(`Cars is ready: ${url}`);
    if (process.argv.includes('--no-open')) return;
    if (process.platform === 'win32') {
        const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, windowsHide: true, stdio: 'ignore' });
        browser.unref();
    } else {
        console.log('Open the URL above in your browser.');
    }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
