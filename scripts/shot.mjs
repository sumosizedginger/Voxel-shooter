// scripts/shot.mjs — dev tool: screenshot a page from the local server.
//   node scripts/shot.mjs game.html out.png [--keys=KeyZ,ArrowUp] [--wait=2000] [--query=?god=1]
// Boots the same static server + Chrome the test harness uses, holds any keys
// given, waits, shoots. Prints any page/console errors it saw. Not a test —
// this is the "look at it" loop the plans keep asking for.

import puppeteer from 'puppeteer-core';
import { startServer, findChrome, sleep } from '../tests/harness.mjs';

const args = process.argv.slice(2);
const page_path = args[0] || 'game.html';
const out = args[1] || 'shot.png';
const opt = (name, dflt) => {
    const a = args.find((s) => s.startsWith('--' + name + '='));
    return a ? a.slice(name.length + 3) : dflt;
};
const keys = (opt('keys', '') || '').split(',').filter(Boolean);
const taps = (opt('tap', '') || '').split(',').filter(Boolean);
const waitMs = Number(opt('wait', 2500));
const query = opt('query', '');

const exe = findChrome();
if (!exe) {
    console.error('No Chrome/Edge found (set CHROME_PATH).');
    process.exit(2);
}

const server = await startServer(8771);
const browser = await puppeteer.launch({
    executablePath: exe,
    headless: 'new',
    args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage']
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.setViewport({ width: 1280, height: 720 });

await page.goto(server.url + page_path + query, { waitUntil: 'networkidle0', timeout: 60000 });
await sleep(400);
await page.keyboard.press('Enter');           // clear the start gate
await sleep(300);
for (const k of taps) { await page.keyboard.press(k); await sleep(120); }
for (const k of keys) await page.keyboard.down(k);
await sleep(waitMs);

await page.screenshot({ path: out });
const info = await page.evaluate(() => {
    const k = window.__engineKit, g = window.__gumoi;
    return {
        calls: k ? k.renderer.info.render.calls : -1,
        tris: k ? k.renderer.info.render.triangles : -1,
        state: g ? g.getState() : null,
        debug: g && g.debugText ? g.debugText() : null
    };
});
for (const k of keys) await page.keyboard.up(k);

console.log(JSON.stringify(info, null, 2));
if (errors.length) {
    console.log('\nERRORS:\n' + errors.join('\n'));
} else {
    console.log('\nno page errors.');
}
console.log('wrote ' + out);

await browser.close();
await server.close();
