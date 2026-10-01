// Loads rows.json into Supabase. Upserts on the unique `name` column for both
// tables, so re-running never creates duplicates. Touches startups and
// investors only. Credential comes from a file OUTSIDE this folder.
const fs = require('fs');
const { Client } = require('pg');

const DIR = 'C:/Users/Aditya/AppData/Local/Temp/claude/sidana-load';
const cfg = JSON.parse(fs.readFileSync(DIR + '/pg.json', 'utf8'));
const host = fs.readFileSync(DIR + '/pghost.txt', 'utf8').trim();
const rows = JSON.parse(fs.readFileSync(DIR + '/rows.json', 'utf8'));

const STARTUP_COLS = ['name', 'sector', 'stage', 'bucket', 'owner_name', 'status',
  'ask_current_cr', 'ask_reset_cr', 'revenue_note'];
const STARTUP_CAST = { bucket: '::bucket', status: '::startup_status' };

const INVESTOR_COLS = ['name', 'contact_person', 'email', 'cc_email', 'type', 'status',
  'sectors', 'stage_pref', 'cheque_min_cr', 'cheque_max_cr', 'cheque_as_written',
  'geography', 'do_not_contact', 'last_contacted_on', 'contacted_by', 'notes'];
const INVESTOR_CAST = { type: '::investor_type', status: '::investor_status',
  sectors: '::text[]', stage_pref: '::text[]', last_contacted_on: '::date' };

async function upsert(client, table, cols, casts, data, chunk = 80) {
  let inserted = 0, updated = 0;
  for (let i = 0; i < data.length; i += chunk) {
    const slice = data.slice(i, i + chunk);
    const params = [];
    const tuples = slice.map(r => {
      const ph = cols.map(c => {
        params.push(r[c] === undefined ? null : r[c]);
        return '$' + params.length + (casts[c] || '');
      });
      return '(' + ph.join(',') + ')';
    });
    const setList = cols.filter(c => c !== 'name')
      .map(c => c + ' = excluded.' + c).join(', ');
    const sql =
      'insert into ' + table + ' (' + cols.join(',') + ') values ' + tuples.join(',') +
      ' on conflict (name) do update set ' + setList +
      ' returning (xmax = 0) as inserted';
    const res = await client.query(sql, params);
    for (const row of res.rows) { row.inserted ? inserted++ : updated++; }
  }
  return { inserted, updated };
}

(async () => {
  const client = new Client({
    host, port: 5432, user: 'postgres.elwaquzawoscotlojtnv', database: 'postgres',
    password: cfg.password, ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  await client.connect();
  try {
    await client.query('begin');
    const s = await upsert(client, 'startups', STARTUP_COLS, STARTUP_CAST, rows.startups);
    const v = await upsert(client, 'investors', INVESTOR_COLS, INVESTOR_CAST, rows.investors);
    await client.query('commit');
    console.log('startups   read ' + rows.startups.length +
                '  inserted ' + s.inserted + '  updated ' + s.updated);
    console.log('investors  read ' + rows.investors.length +
                '  inserted ' + v.inserted + '  updated ' + v.updated);

    const q = async (sql) => (await client.query(sql)).rows[0];
    console.log('\nselect count(*) from startups;   -> ' + (await q('select count(*)::int c from startups')).c);
    console.log('select count(*) from investors;  -> ' + (await q('select count(*)::int c from investors')).c);
    console.log('select count(*) from investors_usable; -> ' +
      (await q('select count(*)::int c from investors_usable')).c);

    const untouched = ['matches', 'shares', 'meetings', 'replies', 'docs', 'outreach',
      'ai_runs', 'ai_log', 'app_users'];
    const parts = [];
    for (const t of untouched) {
      parts.push(t + '=' + (await q('select count(*)::int c from ' + t)).c);
    }
    console.log('untouched tables: ' + parts.join(' '));

    const b = await client.query(
      'select bucket::text, count(*)::int c from startups group by 1 order by 1');
    console.log('buckets: ' + b.rows.map(r => r.bucket + '=' + r.c).join(' '));
  } catch (e) {
    await client.query('rollback');
    console.log('ROLLED BACK. ' + (e.code || '') + ' ' + e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
