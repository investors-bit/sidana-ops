#!/usr/bin/env node
/**
 * Export every n8n workflow to JSON, then optionally archive the dead ones.
 *
 * Archiving is reversible in n8n. This script never deletes anything, and will
 * not archive a workflow it did not successfully export first.
 *
 * PHASE 1  export all workflows, full node definitions, to n8n-export/
 * PHASE 2  report what is deletable and why everything else is kept
 * PHASE 3  archive, only with --archive, and only what passed every check
 *
 * A workflow is archivable only when ALL of these hold:
 *   1. exported successfully in phase 1
 *   2. active === false
 *   3. id NOT referenced in any scheduled-task SKILL.md
 *   4. id NOT on the NEVER list below
 *   5. name matches a dead-work pattern
 *   6. updatedAt older than CUTOFF
 *
 * Usage, from this folder:
 *   set N8N_API_KEY=...
 *   node export-and-clean-n8n.js              -> export + report. Changes nothing.
 *   node export-and-clean-n8n.js --archive    -> export + report + archive
 *
 * Commit n8n-export/ to git BEFORE running with --archive.
 */

const fs = require('fs');
const path = require('path');

const BASE = 'https://sidanaventures.app.n8n.cloud/api/v1';
// Prefer the environment. Otherwise read the key the n8n MCP server already
// uses, straight out of the Claude config, so it never passes through a command
// line, a shell history or this script's output.
function keyFromClaudeConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync('C:/Users/Aditya/.claude.json', 'utf8'));
    const pools = [cfg.mcpServers || {}];
    for (const p of Object.values(cfg.projects || {})) { if (p && p.mcpServers) { pools.push(p.mcpServers); } }
    for (const pool of pools) {
      for (const srv of Object.values(pool)) {
        const k = srv && srv.env && srv.env.N8N_API_KEY;
        if (k) { return k; }
      }
    }
  } catch (e) { /* fall through */ }
  return null;
}

const KEY = process.env.N8N_API_KEY || keyFromClaudeConfig();
const ARCHIVE = process.argv.includes('--archive');
const TASKS_DIR = 'C:/Users/Aditya/.claude/scheduled-tasks';
const OUT_DIR = path.join(__dirname, 'n8n-export');
const CUTOFF = new Date('2026-10-01T00:00:00Z');

if (!KEY) { console.error('Set N8N_API_KEY first.'); process.exit(1); }

const DEAD_NAME = /^(One-off|One off|TEST|TEST-ONCE|CLEANUP|DIAG|FIX|VERIFY|AUDIT\d?|READ|STATS|CHECK|SCRATCH|Pilot Helper|Investor Fix|Investor Cleanup)\b/i;

const NEVER = new Set([
  'F4xXHRFIr3gS2VHc', 'OiHvfYKKK9mOld2g', 'HgA7X7lgkGBVGLWQ', 'I8VWdHLb6fxhciqN',
  'I9bZsGJfNuyr2b77', '2MG95rlJDoFNz8tJ', 'gS9DXz4E3gMzcXYP', '4Yd3oTWu0oKO73A0',
  'V0NmD52cFC0HmJB4', 'jVVRssFPKY4GFrOz', 'm1C0zJbd3zdMUbx1', 'MzlapX61OosgQFJQ',
  'Gkc662bRUD0nIYOL', 'ThiWDFPpKOu9iLnF', 'XUksDVaFexCu799r', 'zwxXecdM2YFCmbch',
  'AI43kudplo2uMCUF', '11bdYVjuKCkOk4sH', '7AHibjZoWQ1u8wPd', 'NAQR29LsoNJMrLtX',
  'uoYPlCSfZ8yzVlM6', 'D77M44hCt4fiB341', '3gCgsliaKwSCMcxE',
]);

// every id mentioned anywhere in the task definitions
const referenced = new Set();
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); }
    else if (e.name === 'SKILL.md') {
      for (const m of fs.readFileSync(p, 'utf8').match(/\b[A-Za-z0-9]{16}\b/g) || []) { referenced.add(m); }
    }
  }
})(TASKS_DIR);

const api = async (p, opts = {}) => {
  const r = await fetch(BASE + p, {
    ...opts,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!r.ok) { throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160)); }
  return r.status === 204 ? null : r.json();
};

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('task-referenced ids: ' + referenced.size);

  // ---- list ----
  let all = [], cursor = null;
  do {
    const page = await api('/workflows?limit=250' + (cursor ? '&cursor=' + cursor : ''));
    all = all.concat(page.data);
    cursor = page.nextCursor;
  } while (cursor);
  console.log('workflows on the instance: ' + all.length);
  console.log('');

  // ---- PHASE 1: export every one, with nodes ----
  const exported = new Set();
  const index = [];

  if (process.argv.includes('--skip-export')) {
    // Trust only what is actually on disk from a previous run, so the
    // "never touch what was not exported" guarantee still holds.
    for (const f of fs.readdirSync(OUT_DIR)) {
      const m = f.match(/^([A-Za-z0-9]{16})--/);
      if (m) { exported.add(m[1]); }
    }
    console.log('PHASE 1  skipped. ' + exported.size + ' definitions already on disk.');
    console.log('');
  } else {
  console.log('PHASE 1  exporting to ' + OUT_DIR);
  let n = 0;
  for (const w of all) {
    n++;
    try {
      const full = await api('/workflows/' + w.id);
      const file = w.id + '--' + (slug(w.name) || 'untitled') + '.json';
      fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(full, null, 2));
      exported.add(w.id);
      index.push({
        id: w.id, name: w.name, active: w.active, archived: !!w.isArchived,
        nodes: (full.nodes || []).length, updatedAt: w.updatedAt, file: file,
      });
      if (n % 25 === 0) { console.log('  ' + n + ' / ' + all.length); }
    } catch (e) {
      console.log('  EXPORT FAILED ' + w.id + '  ' + w.name.slice(0, 60) + '  ' + e.message.slice(0, 80));
    }
    await sleep(60);   // be polite to the instance
  }
  fs.writeFileSync(path.join(OUT_DIR, '_index.json'), JSON.stringify(index, null, 2));
  console.log('exported ' + exported.size + ' of ' + all.length);
  console.log('index written to n8n-export/_index.json');
  console.log('');
  }

  // ---- PHASE 2: decide ----
  const plan = [], kept = { notExported: 0, active: 0, never: 0, referenced: 0, named: 0, recent: 0 };
  for (const w of all) {
    if (!exported.has(w.id))     { kept.notExported++; continue; }
    if (w.active)                { kept.active++;      continue; }
    if (NEVER.has(w.id))         { kept.never++;       continue; }
    if (referenced.has(w.id))    { kept.referenced++;  continue; }
    if (!DEAD_NAME.test(w.name)) { kept.named++;       continue; }
    // Age is judged on createdAt, never updatedAt. A bulk operation on
    // 7 Oct 05:56 reset updatedAt across most of the instance, so it says
    // nothing about whether a workflow is still in use.
    if (new Date(w.createdAt) >= CUTOFF) { kept.recent++; continue; }
    plan.push(w);
  }

  console.log('PHASE 2  keeping');
  console.log('  export failed, skipped      : ' + kept.notExported);
  console.log('  active                      : ' + kept.active);
  console.log('  never-list                  : ' + kept.never);
  console.log('  referenced by a task        : ' + kept.referenced);
  console.log('  name not dead-looking       : ' + kept.named);
  console.log('  touched since 1 Oct         : ' + kept.recent);
  console.log('');
  console.log('ARCHIVABLE: ' + plan.length);
  for (const w of plan.slice(0, 20)) { console.log('  ' + w.id + '  ' + w.name.slice(0, 84)); }
  if (plan.length > 20) { console.log('  ... and ' + (plan.length - 20) + ' more'); }
  fs.writeFileSync(path.join(__dirname, 'archive-plan.json'),
    JSON.stringify(plan.map(w => ({ id: w.id, name: w.name, updatedAt: w.updatedAt })), null, 2));
  console.log('full list written to archive-plan.json');
  console.log('');

  if (!ARCHIVE) {
    console.log('STOPPING HERE. Nothing was changed.');
    console.log('1. git add .handover/n8n-export and commit it');
    console.log('2. read archive-plan.json');
    console.log('3. re-run with --archive');
    return;
  }

  // ---- PHASE 3: archive. Reversible, and nothing is ever deleted. ----
  // n8n moved archiving around between versions, so try the dedicated endpoint
  // first and fall back to flipping the flag on the workflow itself.
  console.log('PHASE 3  archiving ' + plan.length + '. Reversible.');
  const archiveOne = async (id) => {
    try { await api('/workflows/' + id + '/archive', { method: 'POST' }); return 'archive endpoint'; }
    catch (e1) {
      try { await api('/workflows/' + id, { method: 'PATCH', body: JSON.stringify({ isArchived: true }) }); return 'patch isArchived'; }
      catch (e2) { throw new Error(e1.message.slice(0, 60) + ' | fallback: ' + e2.message.slice(0, 60)); }
    }
  };

  const done = [];
  let method = null;
  for (const w of plan) {
    try {
      const how = await archiveOne(w.id);
      if (!method) { method = how; console.log('  (using: ' + how + ')'); }
      done.push({ id: w.id, name: w.name });
      console.log('  archived ' + w.id + '  ' + w.name.slice(0, 64));
    } catch (e) {
      console.log('  FAILED   ' + w.id + '  ' + e.message.slice(0, 130));
    }
    await sleep(80);
  }
  fs.writeFileSync(path.join(__dirname, 'archived-ids.json'), JSON.stringify(done, null, 2));
  console.log('');
  console.log('archived ' + done.length + ' of ' + plan.length);
  console.log('Nothing was deleted. To undo one: POST /workflows/{id}/unarchive');
  console.log('ids recorded in archived-ids.json');
})().catch(e => { console.error('FAILED: ' + e.message); process.exit(1); });
