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
    return findChromeVerbose().path;
}

/** Same search as findChrome(), but also returns the candidate list tried —
 * used to make CI failures self-diagnosing without needing log access. */
export function findChromeVerbose() {
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
        try { if (fs.existsSync(c)) return { path: c, candidates }; } catch (e) { /* ignore */ }
    }
    return { path: null, candidates };
}

/** Append a markdown pass/fail summary to $GITHUB_STEP_SUMMARY when running in
 * Actions, so a failure is diagnosable from the (publicly visible) run summary
 * page without needing to sign in to view raw step logs. No-op elsewhere. */
export function writeStepSummary(sinks, extraNotes = []) {
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (!file) return;
    const all = sinks.flatMap((s) => s.results.map((r) => ({ ...r, suite: s.label })));
    const failed = all.filter((r) => !r.pass);
    let md = '## Test results: ' + (all.length - failed.length) + '/' + all.length + ' passed\n\n';
    if (failed.length) {
        md += '### Failures\n\n| Suite | Assertion | Detail |\n|---|---|---|\n';
        for (const f of failed) {
            md += '| ' + f.suite + ' | ' + f.name + ' | ' + String(f.detail).replace(/\|/g, '\\|') + ' |\n';
        }
        md += '\n';
    }
    if (extraNotes.length) {
        md += '### Notes\n\n' + extraNotes.map((n) => '- ' + n).join('\n') + '\n';
    }
    try { fs.appendFileSync(file, md); } catch (e) { /* best-effort only */ }
}

/** Escape a string for a GitHub Actions workflow-command field (::error::). */
function escapeAnnotation(s) {
    return String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/** Emit one ::error:: workflow command per failed assertion when running in
 * Actions, so failures show up in the (publicly visible, no-login-required)
 * Annotations panel — unlike raw step logs and the job summary, which both
 * require signing in on this repo. No-op outside Actions. */
export function printErrorAnnotations(sinks) {
    if (!process.env.GITHUB_ACTIONS) return;
    for (const s of sinks) {
        for (const r of s.results) {
            if (r.pass) continue;
            console.log('::error title=' + escapeAnnotation('[' + s.label + '] ' + r.name)
                + '::' + escapeAnnotation(r.detail || '(no detail)'));
        }
    }
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
