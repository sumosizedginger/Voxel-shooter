// tests/harness.mjs
// Shared test harness: in-process static server, Chrome discovery, result sink.
// Browser specs receive a `page` and a `t` (assertion sink) and return nothing;
// they record pass/fail via t.ok(...). Pure-node specs just take a `t`.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from '../scripts/serve.mjs';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Start the static server on an ephemeral-ish port; resolve to { url, close }. */
export function startServer(port = 8765) {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.on('error', reject);
        server.listen(port, '127.0.0.1', () => {
            resolve({
                url: 'http://127.0.0.1:' + port + '/',
                close: () => new Promise((res) => server.close(res))
            });
        });
    });
}

/** Locate a Chrome/Edge executable across env var + common Windows/Linux paths. */
export function findChrome() {
    const candidates = [
        process.env.CHROME_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA
            ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')
            : null,
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ].filter(Boolean);
    for (const c of candidates) {
        try { if (fs.existsSync(c)) return c; } catch (e) { /* ignore */ }
    }
    return null;
}

/** A tiny assertion sink shared across specs. */
export function createSink(label) {
    const results = [];
    return {
        label,
        results,
        ok(name, pass, detail = '') {
            results.push({ name, pass: !!pass, detail });
            console.log((pass ? 'PASS' : 'FAIL') + '  [' + label + '] ' + name
                + (detail ? ' — ' + detail : ''));
            return !!pass;
        }
    };
}

/** Print a combined summary and return the number of failures. */
export function summarize(sinks) {
    const all = sinks.flatMap((s) => s.results);
    const failed = all.filter((r) => !r.pass);
    console.log('\n=== SUMMARY: ' + (all.length - failed.length) + '/' + all.length + ' passed ===');
    if (failed.length) {
        console.log('Failed:');
        failed.forEach((f) => console.log(' - ' + f.name + ': ' + f.detail));
    }
    return failed.length;
}
