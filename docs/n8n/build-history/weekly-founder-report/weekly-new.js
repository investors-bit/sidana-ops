const s = (v) => String(v == null ? '' : v).trim();
const low = (v) => s(v).toLowerCase();
const esc = (v) => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tz = 'Asia/Kolkata';
const TEST_TO = 'investors@sidanaventures.com';
const OWNERS = ['Aditya', 'Chaman', 'Akansha', 'Shradha'];
// No report at all for a startup with fewer than this many new investors reached in the week
const MIN_REACHED = 3;
const ownerNames = { Aditya: 'Aditya Mishra', Chaman: 'Chaman Yadav', Akansha: 'Akansha', Shradha: 'Shradhaa' };

const mode = $('Mode: preview').isExecuted ? 'preview' : ($('Mode: test').isExecuted ? 'test' : ($('Mode: resend').isExecuted ? 'resend' : 'live'));
const testStartup = mode === 'test' ? s($('Mode: test').first().json.startup) : (mode === 'resend' ? s($('Mode: resend').first().json.startup) : '');
// resend = send this week's normal report again to ONE startup's founder (e.g. after an email correction)
if (mode === 'resend' && !testStartup) throw new Error('resend needs ?startup=<name>');

// Reporting window: Monday..Friday of the most recently completed work week (the Saturday run covers the Mon-Fri just ended)
const today = DateTime.now().setZone(tz).startOf('day');
const winEnd = today.minus({ days: ((today.weekday - 5 + 7) % 7) || 7 });
const winStart = winEnd.minus({ days: 4 });
const from = winStart.toISODate();
const to = winEnd.toISODate();
const weekKey = from + '_' + to;

const staticData = $getWorkflowStaticData('global');
if (mode === 'live' && staticData.lastSentWeek === weekKey) {
  return [{ json: { kind: 'summary', mode, date: today.toISODate(), workflow: 'WEEKLY-live', rows_read: 0, decided: 0, sent: 0, skipped: 0, skip_reasons: 'already sent for window ' + weekKey } }];
}

// Dates in the sheet come as 2026-09-16, 16-09-2026, 16-09-26, 16/09/2026 or a Sheets serial, optionally followed by a time
const parseDate = (x) => {
  const v = s(x);
  if (!v) return null;
  let m, d = null;
  if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) d = DateTime.fromObject({ year: +m[1], month: +m[2], day: +m[3] }, { zone: tz });
  else if ((m = v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/))) { let y = +m[3]; if (y < 100) y += 2000; d = DateTime.fromObject({ year: y, month: +m[2], day: +m[1] }, { zone: tz }); }
  else if (/^\d{5}(\.\d+)?$/.test(v)) d = DateTime.fromISO('1899-12-30', { zone: tz }).plus({ days: Math.floor(+v) });
  else { for (const f of ['d LLL yyyy', 'd LLLL yyyy', 'LLL d, yyyy', 'LLLL d, yyyy']) { const t = DateTime.fromFormat(v, f, { zone: tz }); if (t.isValid) { d = t; break; } } }
  return d && d.isValid ? d.startOf('day') : null;
};
const inWin = (x) => { const d = parseDate(x); return !!d && d >= winStart && d <= winEnd; };

// Founders Info lookup (names differ slightly from PIPELINE, e.g. MonitorExam vs Monitor Exam)
const norm = (x) => low(x).replace(/[^a-z0-9]/g, '');
const lev = (a, b) => {
  const dp = []; for (let i = 0; i <= a.length; i++) { dp[i] = [i]; }
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};
const founders = [];
for (const it of $('Read Founders Info').all()) {
  const j = it.json;
  const name = s(j['Startup']);
  if (!name) continue;
  const emails = [...new Set(s(j['Emails']).split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];
  founders.push({ name, key: norm(name), founder: s(j['Founder Name']), emails });
}
const pick = (arr) => arr.find((f) => f.emails.length) || arr[0];
const findFounder = (startup) => {
  const k = norm(startup);
  let hit = founders.filter((f) => f.key === k);
  if (hit.length) return { f: pick(hit), how: 'exact' };
  hit = founders.filter((f) => f.key.length >= 4 && k.length >= 4 && (f.key.indexOf(k) === 0 || k.indexOf(f.key) === 0));
  if (hit.length && hit.every((h) => h.key === hit[0].key)) return { f: pick(hit), how: 'prefix' };
  hit = founders.filter((f) => k.length >= 6 && lev(f.key, k) <= 1);
  if (hit.length && hit.every((h) => h.key === hit[0].key)) return { f: pick(hit), how: 'fuzzy' };
  return null;
};

const startupOwner = {};
for (const it of $('Read STARTUPS').all()) { const n = norm(it.json.startup); if (n && s(it.json.owner)) startupOwner[n] = s(it.json.owner); }

// Aggregate PIPELINE per startup
const pipe = $('Read PIPELINE').all().map((i) => i.json);
const per = {};
for (const r of pipe) {
  const st = s(r.startup);
  if (!st || /^test/i.test(s(r.deal_id)) || /^test/i.test(st)) continue;
  const p = per[st] || (per[st] = { startup: st, owners: {}, reached: 0, followups: 0, passed: [], meetings: [], feedback: [] });
  const o = s(r.owner); if (o) p.owners[o] = (p.owners[o] || 0) + 1;
  if (inWin(r.date_shared)) p.reached++;
  for (const c of ['fu1_date', 'fu2_date', 'fu3_date']) { if (inWin(r[c])) p.followups++; }
  const resp = low(r.investor_response);
  const ds = low(r.deal_status);
  const lcIn = inWin(r.last_contact);
  // Post-meeting pass: the agents write meeting_outcome = 'Passed after meeting: <reason>' and deal_status = 'Closed - passed'
  const mo = s(r.meeting_outcome);
  const pmm = mo.match(/^passed after meeting\s*:\s*(.*)$/i);
  const isPass = ['pass', 'passed', 'not relevant'].indexOf(resp) >= 0 || ['passed', 'not relevant'].indexOf(ds) >= 0 || /(^|[^a-z])passed([^a-z]|$)/.test(ds) || !!pmm;
  if (isPass) {
    if (lcIn && !p.passed.some((x) => x.investor === s(r.investor))) p.passed.push({ investor: s(r.investor) });
    if (pmm && lcIn && !p.feedback.some((x) => x.investor === s(r.investor))) p.feedback.push({ investor: s(r.investor), reason: s(pmm[1]) || s(r.pass_reason) });
    continue;
  }
  const ms = low(r.meeting_scheduled);
  const isMeet = ms !== 'no' && (ms === 'yes' || ds.indexOf('meeting') >= 0 || resp.indexOf('meeting') >= 0 || s(r.meeting_date) !== '');
  if (isMeet) {
    const md = parseDate(r.meeting_date);
    // meetings dated this week or later; undated ones only if flagged this week
    if (md ? md >= winStart : lcIn) {
      if (!p.meetings.some((x) => x.investor === s(r.investor))) p.meetings.push({ investor: s(r.investor), date: md });
    }
  }
}

const sig = (owner) => "<br>--<br><img src='https://drive.google.com/uc?export=view&id=1iLMGooCx6B8bmYJxlYMdNg0YhdSoFAFi' alt='Sidana Ventures' width='120' style='display:block;margin-bottom:8px;border:0;'><div style='font-family:Arial,sans-serif;font-size:13px;color:#333333;line-height:1.4;'><span style='font-weight:bold;color:#1a5fb4;'>" + esc(ownerNames[owner] || owner) + "</span><br>Investor Relations<br><span style='font-weight:bold;'>SIDANA VENTURES LLP</span><br>424A Tower B3, Spaze iTech Park, Sector 49, Sohna Road<br>Gurgaon, Haryana 122022<br>+91 85279 02946<br><a href='https://www.sidanaventures.com' style='color:#1a5fb4;'>www.sidanaventures.com</a></div>";
const td = "style='padding:4px 14px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222222;'";

const reports = [];
const skipped = [];
let withActivity = 0;
const testPerOwner = {};
for (const st of Object.keys(per).sort()) {
  const p = per[st];
  if (mode === 'resend' && norm(st) !== norm(testStartup)) continue;
  if (!(p.reached || p.followups || p.passed.length || p.meetings.length || p.feedback.length)) continue;
  withActivity++;
  // post-meeting feedback always reaches the founder, even in a quiet week
  if (p.reached < MIN_REACHED && !p.feedback.length) { skipped.push(st + ': only ' + p.reached + ' new investors reached (min ' + MIN_REACHED + ')'); continue; }
  let owner = startupOwner[norm(st)] || '';
  if (!owner) { const os = Object.keys(p.owners).sort((a, b) => p.owners[b] - p.owners[a]); owner = os[0] || ''; }
  if (OWNERS.indexOf(owner) === -1) { skipped.push(st + ': owner-unknown(' + owner + ')'); continue; }
  const fm = findFounder(st);
  if (!fm) { skipped.push(st + ': not-in-Founders-Info'); continue; }
  if (!fm.f.emails.length) { skipped.push(st + ': founder-email-blank'); continue; }
  if (mode === 'test') {
    if (testStartup && norm(testStartup) !== norm(st)) continue;
    if (!testStartup) { if (testPerOwner[owner]) continue; testPerOwner[owner] = true; }
  }

  p.meetings.sort((a, b) => (a.date ? a.date.toMillis() : 9e15) - (b.date ? b.date.toMillis() : 9e15));
  const meetLines = p.meetings.map((m) => m.investor + ' - ' + (m.date ? m.date.toFormat('ccc, d LLL yyyy') : 'Date to be confirmed'));
  const passLines = p.passed.map((x) => x.investor);
  const feedbackLines = p.feedback.map((x) => x.investor + (x.reason ? ' - ' + x.reason : ''));
  const greetName = fm.f.founder.replace(/\(.*?\)/g, '').trim() || 'Team';
  const list = (arr, none) => arr.length ? "<ol style='margin:0 0 14px 0;padding-left:22px;'>" + arr.map((x) => "<li style='margin:0 0 4px 0;'>" + esc(x) + '</li>').join('') + '</ol>' : "<p style='margin:0 0 14px 0;'>" + none + '</p>';
  const body = "<div style='font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#222222;max-width:640px;'>" +
    '<p>Hi ' + esc(greetName) + ',</p>' +
    '<p>Hope you are doing well.</p>' +
    '<p>We have started sharing weekly updates on our funding activities to increase visibility for all our founders.<br>' +
    'This initiative will help founders and organizations stay informed about ongoing fundraising activities, investor interest, and opportunities across our network.</p>' +
    '<p>You can share your queries over this email for any improvement / addition required.</p>' +
    "<p style='margin:18px 0 6px 0;'><b>This week's report is as follows:</b></p>" +
    "<table style='border-collapse:collapse;margin:0 0 14px 0;'>" +
    '<tr><td ' + td + '>Number of investors reached</td><td ' + td + '><b>' + p.reached + '</b></td></tr>' +
    '<tr><td ' + td + '>No. of follow-ups done</td><td ' + td + '><b>' + p.followups + '</b></td></tr>' +
    '<tr><td ' + td + '>Passed deals</td><td ' + td + '><b>' + p.passed.length + '</b></td></tr>' +
    '<tr><td ' + td + '>Meetings scheduled</td><td ' + td + '><b>' + p.meetings.length + '</b></td></tr>' +
    '</table>' +
    "<p style='margin:18px 0 6px 0;'><b>Meetings scheduled with investors and dates</b> (please check your calendar as well for the same):</p>" + list(meetLines, 'No meetings scheduled this week.') +
    "<p style='margin:18px 0 6px 0;'><b>Investors who passed the deal:</b></p>" + list(passLines, 'No investor passed this week.') +
    (feedbackLines.length ? "<p style='margin:18px 0 6px 0;'><b>Feedback from investors after the meeting:</b></p>" + list(feedbackLines, '') : '') +
    '<p>Looking forward to creating greater visibility, stronger investor connections, and more funding opportunities.</p>' +
    '</div>' + sig(owner);

  let toAddr = fm.f.emails.join(', ');
  let subject = 'Weekly Report | ' + st + ' | Sidana Ventures';
  let html = body;
  if (mode === 'test') {
    html = "<div style='background:#fff4ce;border:1px solid #e0c060;padding:8px 12px;margin:0 0 14px 0;font-family:Arial,sans-serif;font-size:13px;'>TEST - in the live run this goes to: " + esc(toAddr) + ' (from ' + esc(owner) + "'s Gmail)</div>" + body;
    subject = '[TEST] ' + subject;
    toAddr = TEST_TO;
  }
  reports.push({ json: {
    kind: 'report', mode, owner, startup: st, founders_info_row: fm.f.name, match: fm.how, founder_name: fm.f.founder,
    to: toAddr, subject, html: mode === 'preview' ? '' : html,
    reached: p.reached, followups: p.followups, passed: p.passed.length, meetings: p.meetings.length,
    meeting_list: meetLines, passed_list: passLines, feedback: p.feedback.length, feedback_list: feedbackLines,
  } });
}

if (mode === 'live' && reports.length) staticData.lastSentWeek = weekKey;

const summary = { kind: 'summary', mode, window: from + ' .. ' + to, date: today.toISODate(), workflow: 'WEEKLY-' + mode,
  rows_read: pipe.length, decided: withActivity, sent: reports.length, skipped: skipped.length, skip_reasons: skipped.join('; ') };
return reports.concat([{ json: summary }]);