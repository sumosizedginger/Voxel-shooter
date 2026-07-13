// scripts/serve.mjs
// Purpose: Zero-dependency static file server for local dev + tests.
// Usage: node scripts/serve.mjs [port]   (default port 8765)
// Exports createServer() so the test harness can start/stop it in-process.

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.map': 'application/json'
};

export function createServer() {
    return http.createServer((req, res) => {
        try {
            const urlPath = decodeURIComponent(req.url.split('?')[0]);
            let rel = urlPath === '/' ? '/index.html' : urlPath;
            const filePath = path.join(ROOT, path.normalize(rel));
            // Prevent path traversal outside ROOT.
            if (!filePath.startsWith(ROOT)) {
                res.writeHead(403); res.end('Forbidden'); return;
            }
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not found: ' + rel);
                    return;
                }
                const ext = path.extname(filePath).toLowerCase();
                res.writeHead(200, {
                    'Content-Type': MIME[ext] || 'application/octet-stream',
                    'Cache-Control': 'no-store'
                });
                res.end(data);
            });
        } catch (e) {
            res.writeHead(500); res.end('Server error');
        }
    });
}

// Run standalone when invoked directly.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const port = Number(process.env.PORT) || Number(process.argv[2]) || 8765;
    createServer().listen(port, '127.0.0.1', () => {
        console.log('Serving ' + ROOT + ' at http://127.0.0.1:' + port + '/');
    });
}
