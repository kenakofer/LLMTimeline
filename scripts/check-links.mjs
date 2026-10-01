#!/usr/bin/env node
// Checks every source URL in the dataset for rot.
//
// This exists because source URLs demonstrably move: between 2025 and 2026 both
// the OpenAI and Anthropic deprecation pages changed host
// (platform.openai.com -> developers.openai.com, docs.anthropic.com ->
// platform.claude.com). A redirect is reported, not treated as a failure —
// but it is a prompt to update the recorded URL.
//
// Run: node scripts/check-links.mjs [--timeout 10000]

import { loadDataset } from './validate.mjs';

const args = process.argv.slice(2);
const timeout = Number(args[args.indexOf('--timeout') + 1]) || 10000;

function collectUrls() {
  const { modelFiles, lineage, scores } = loadDataset();
  const urls = new Map(); // url -> [where]
  const add = (url, where) => {
    if (!url) return;
    if (!urls.has(url)) urls.set(url, []);
    urls.get(url).push(where);
  };
  for (const { doc } of modelFiles) {
    for (const m of doc.models || []) {
      for (const ev of m.events || []) add(ev.source, `${m.id}/${ev.type}`);
    }
  }
  for (const e of lineage?.edges || []) add(e.source, `lineage ${e.from}->${e.to}`);
  add(scores?.source, 'scores/eci');
  return urls;
}

async function check(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    // HEAD first — cheaper, and most doc hosts support it. Some reject HEAD, so
    // fall back to a ranged GET rather than reporting a false failure.
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { Range: 'bytes=0-2048' }, signal: ctrl.signal });
    }
    const redirected = res.url && new URL(res.url).host !== new URL(url).host;
    return { ok: res.ok, status: res.status, finalUrl: res.url, redirected };
  } catch (err) {
    return { ok: false, status: 0, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const urls = collectUrls();
  console.log(`checking ${urls.size} unique source URLs…\n`);

  const entries = [...urls.entries()];
  const problems = [];
  const moved = [];

  // Small concurrency: this hits third-party docs sites, so be polite.
  const CONCURRENCY = 6;
  let i = 0;
  async function worker() {
    while (i < entries.length) {
      const [url, where] = entries[i++];
      const r = await check(url);
      if (!r.ok) {
        problems.push({ url, where, r });
        console.log(`  DEAD  ${r.status || r.error}  ${url}`);
      } else if (r.redirected) {
        moved.push({ url, where, r });
        console.log(`  MOVED ${url}\n          -> ${r.finalUrl}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log('');
  if (moved.length) {
    console.log(`${moved.length} URL(s) redirected to a different host — update data/models/*.yaml:`);
    for (const m of moved) console.log(`  ${m.url}\n    used by: ${m.where.join(', ')}`);
    console.log('');
  }
  if (problems.length) {
    console.error(`✗ ${problems.length} unreachable URL(s)`);
    for (const p of problems) console.error(`  ${p.url} — used by ${p.where.join(', ')}`);
    process.exit(1);
  }
  console.log(`✓ all ${urls.size} source URLs reachable${moved.length ? ` (${moved.length} redirected)` : ''}`);
}

main();
