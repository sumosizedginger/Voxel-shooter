// tests/shmup-smoke.spec.mjs
// Browser spec: load game.html, start a game with synthetic input, let it run,
// and assert frames are drawing with no page errors. Mirrors smoke.spec.mjs.
// PLAN.md Phase 8.

import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';
import { startServer, findChromeVerbose, sleep, createSink, summarize } from './harness.mjs';

const PORT = Number(process.env.PORT) || 8767;

export async function run(t) {
    const { path: exe, candidates } = findChromeVerbose();
    if (!exe) {
        t.ok('Chrome/Edge available (set CHROME_PATH if not found)', false,
            'CHROME_PATH=' + JSON.stringify(process.env.CHROME_PATH || null)
            + '; checked: ' + JSON.stringify(candidates));
        return;
    }

    const server = await startServer(PORT);
    let browser;
    try {
        const glArgs = process.env.CI
            ? ['--use-gl=swiftshader', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
            : ['--use-gl=angle'];
        browser = await puppeteer.launch({
            executablePath: exe,
            headless: 'new',
            args: [...glArgs, '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        await page.setViewport({ width: 1280, height: 720 });

        await page.goto(server.url + 'game.html', { waitUntil: 'networkidle0', timeout: 60000 });
        await sleep(500);

        // Title screen is up and drawing.
        const atTitle = await page.evaluate(() => window.__gumoi && window.__gumoi.getState());
        t.ok('game.html boots to the TITLE state', atTitle === 'TITLE', 'state=' + atTitle);

        // Start a game with synthetic input (the fire key), then play ~2.5s.
        await page.keyboard.press('KeyZ');
        await sleep(400);
        const playing = await page.evaluate(() => window.__gumoi.getState());
        t.ok('fire launches into PLAYING', playing === 'PLAYING', 'state=' + playing);

        // Hold fire + drift up for a couple seconds to exercise shots/movement.
        await page.keyboard.down('KeyZ');
        await page.keyboard.down('ArrowUp');
        await sleep(2200);
        await page.keyboard.up('KeyZ');
        await page.keyboard.up('ArrowUp');

        t.ok('game.html: zero console/page errors', errors.length === 0, errors.join(' | '));

        const info = await page.evaluate(() => {
            const k = window.__engineKit;
            return k && k.renderer && k.renderer.info && k.renderer.info.render
                ? { calls: k.renderer.info.render.calls, state: window.__gumoi.getState(),
                    hasPlayer: !!window.__gumoi.world.player }
                : null;
        });
        t.ok('game.html: renderer drew frames', info && info.calls > 0,
            'render.calls=' + (info ? info.calls : 'null'));
        t.ok('game.html: still PLAYING after 2.5s', info && info.state === 'PLAYING',
            'state=' + (info ? info.state : 'null'));
        t.ok('game.html: the Vessel exists', info && info.hasPlayer);

        const canvasOk = await page.evaluate(() => !!document.querySelector('canvas'));
        t.ok('game.html: canvas present', canvasOk);
    } catch (e) {
        t.ok('game.html: loaded and played without crashing', false, String(e && e.message || e));
    } finally {
        if (browser) await browser.close();
        await server.close();
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const t = createSink('shmup-smoke');
    run(t).then(() => process.exit(summarize([t]) ? 1 : 0));
}
