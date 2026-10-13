const P = $('Plan').first().json;
const rows = (name) => $(name).all().map(i => i.json).filter(r => r && Object.keys(r).length);
const now = Date.now();
const HOT = ['spintly','boncuisine','eosnox','hyrgpt','talentrecruit','hoora','clikd','mindwox','mentorcloud','roadathena','learningpad'];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isHot = (startup, subject, bucket) => bucket === 'HOT10' || HOT.includes(norm(startup)) || HOT.some(h => norm(subject).includes(h));
const OURS = /@sidanaventures\.com/i;
const NOISE_FROM = /(no-?reply|donotreply|notification|calendar-|mailer-daemon|postmaster|indeed|naukri|linkedin|read\.ai|gemini|newsletter|news@|updates@|digest|billing|invoice|mca\.gov|district\.in|calendly\.com|zoom\.us|fireflies|otter\.ai|substack|mailchimp|hubspot|google\.com)/i;
const CAL_SUBJ = /^(accepted|declined|tentative|tentatively accepted|invitation|updated invitation|new event|canceled event|cancelled event)\b/i;
const T = {
  booking_link: /(calendly\.com|cal\.com\/|hubspot\.com\/meetings|zcal\.co|savvycal|my calendly|book a slot|booking link)/i,
  pass: /(not (be )?(going ahead|proceed|take (this|it) forward|taking (this|it) forward)|won'?t be going ahead|will (have to|need to) pass|pass(ing)? on (this|it)|it'?s a pass|unable to (participate|partner|invest|proceed)|not a (good )?fit|outside (of )?(our|my) (core )?(focus|scope|thesis|mandate)|not tracking|decided not|do(es)? not fit|doesn'?t fit|regret)/i,
  meeting: /(call|meeting|connect (me|us|with)|speak with|set up|schedule|slot|availability|calendar|zoom|google meet|catch up|time works|reschedul|postpone|couldn'?t connect)/i,
};
const typeOf = (gist, subject) => {
  const g = String(gist || '');
  if (T.booking_link.test(g)) return 'booking_link';
  if (T.pass.test(g)) return 'pass';
  if (T.meeting.test(g)) return 'meeting';
  if (/\?/.test(g)) return 'question';
  if (/^(thanks|thank you|noted|great|sure|ok|okay)\b/i.test(g.trim()) && g.length < 160) return 'thanks_only';
  return 'other';
};
const threadMsgs = {};
rows('Fetch threads').forEach(m => { (threadMsgs[m.thread_id] = threadMsgs[m.thread_id] || []).push(m); });
const owed = rows('Fetch owed');
const inbound = rows('Fetch inbound');
const items = {};
owed.forEach(r => {
  if (!r.thread) return;
  items[r.thread] = { thread_id: r.thread, startup: r.startup || '', startup_id: r.startup_id || null, investor: r.investor || '', investor_id: r.investor_id || null,
    bucket: r.bucket || '', owner: r.owner_name || '', subject: r.subject || '', last_in_at: r.last_in, our_last_out_at: r.last_out || null, gist: r.gist || '', kind: r.kind || '', source: 'owed' };
});
let autoClosed = 0; const autoSample = [];
inbound.forEach(r => {
  const t = r.thread_id; if (!t) return;
  if (NOISE_FROM.test(r.from_email || '') || CAL_SUBJ.test(r.subject || '')) { autoClosed++; if (autoSample.length < 8) autoSample.push((r.from_email || '') + ' | ' + String(r.subject || '').slice(0, 70)); return; }
  const msgs = threadMsgs[t] || [];
  const lastIn = msgs.filter(m => m.direction !== 'out' && !OURS.test(m.from_email || '')).pop();
  const lastOut = msgs.filter(m => m.direction === 'out' || OURS.test(m.from_email || '')).pop();
  if (lastOut && lastIn && new Date(lastOut.sent_at) > new Date(lastIn.sent_at)) return; // already answered
  if (items[t]) return;
  items[t] = { thread_id: t, startup: '', startup_id: r.startup_id || null, investor: '', investor_id: r.investor_id || null, bucket: '', owner: '',
    subject: r.subject || '', last_in_at: r.sent_at, our_last_out_at: lastOut ? lastOut.sent_at : null, gist: r.reply_gist || '', kind: r.reply_kind || '', source: r.investor_id ? 'inbound_investor' : (r.startup_id ? 'inbound_founder' : 'inbound_unmatched'), from: r.from_email };
});
const work = [];
Object.values(items).forEach(it => {
  const hot = isHot(it.startup, it.subject, it.bucket);
  if ((P.scope === 'hot') !== hot) return;
  const msgs = (threadMsgs[it.thread_id] || []);
  const ourBox = (msgs.filter(m => m.direction === 'out' || OURS.test(m.from_email || '')).map(m => (String(m.mailbox || m.from_email || '').match(/[a-z0-9._-]+@sidanaventures\.com/i) || [''])[0]).filter(Boolean).pop()) || '';
  const lastInMsg = msgs.filter(m => m.direction !== 'out' && !OURS.test(m.from_email || '')).pop();
  const waitH = it.last_in_at ? Math.round((now - new Date(it.last_in_at)) / 3600000) : null;
  const gist = it.gist || (lastInMsg && lastInMsg.reply_gist) || '';
  work.push({
    thread_id: it.thread_id, type: typeOf(gist, it.subject), wait_hours: waitH, stale: waitH != null && waitH > 21 * 24,
    startup: it.startup || null, startup_id: it.startup_id, investor: it.investor || null, investor_id: it.investor_id,
    from: (lastInMsg && lastInMsg.from_email) || it.from || null, reply_from_mailbox: ourBox || null,
    subject: it.subject, last_in_at: it.last_in_at, our_last_out_at: it.our_last_out_at, source: it.source,
    latest_message: String(gist).slice(0, 400),
    thread: msgs.slice(-6).map(m => ({ at: m.sent_at, dir: (m.direction === 'out' || OURS.test(m.from_email || '')) ? 'out' : 'in', from: m.from_email, text: String(m.reply_gist || '').slice(0, 300) })),
  });
});
const A = work.filter(w => w.wait_hours != null && w.wait_hours >= 18).sort((a, b) => b.wait_hours - a.wait_hours);
const B = work.filter(w => w.wait_hours != null && w.wait_hours < 18).sort((a, b) => a.wait_hours - b.wait_hours);
const C = work.filter(w => w.wait_hours == null);
const ordered = A.map(w => ({ group: 'waited_18h_plus', ...w })).concat(B.map(w => ({ group: 'today', ...w })), C.map(w => ({ group: 'unknown_time', ...w })));
const MAX = 60;
// internal team threads (TIME NEEDED, BOOK VIA LINK, ANSWER NEEDED, TRAIL APPROVAL, FORWARD NEEDED)
const intByT = {};
rows('Fetch internal').forEach(m => { (intByT[m.thread_id] = intByT[m.thread_id] || []).push(m); });
const internal = Object.entries(intByT).map(([t, ms]) => {
  const last = ms[ms.length - 1];
  return { thread_id: t, subject: String(ms[0].subject || '').replace(/^\s*(re|fwd?)\s*:\s*/i, ''), messages: ms.length, started_at: ms[0].sent_at,
    last_from: last.from_email, last_at: last.sent_at, team_replied: ms.length > 1 && /^\s*re\s*:/i.test(last.subject || ''), last_text: String(last.reply_gist || '').slice(0, 300) };
}).filter(x => { const hot = HOT.some(h => norm(x.subject).includes(h)); return (P.scope === 'hot') === hot; });
const meet = rows('Fetch meetings').filter(m => (P.scope === 'hot') === isHot(m.startup_name, m.notes, ''));
const soon = meet.filter(m => new Date(m.scheduled_at) >= now).map(m => ({ at: m.scheduled_at, startup: m.startup_name, investor: m.investor_name, startup_id: m.startup_id, investor_id: m.investor_id, link: m.meet_link, title: m.notes, hours_from_now: Math.round((new Date(m.scheduled_at) - now) / 3600000) }));
const past = meet.filter(m => new Date(m.scheduled_at) < now).map(m => ({ at: m.scheduled_at, startup: m.startup_name, investor: m.investor_name, startup_id: m.startup_id, investor_id: m.investor_id, held: m.held, title: m.notes }));
const hb = rows('Fetch heartbeat')[0] || null;
const counts = { total: ordered.length, waited_18h_plus: A.length, today: B.length, unknown_time: C.length, by_type: ordered.reduce((o, w) => (o[w.type] = (o[w.type] || 0) + 1, o), {}), auto_closed_noise: autoClosed };
return [{ json: {
  generated_at: new Date(now).toISOString(), scope: P.scope, window_hours: P.hrs, last_run_at: hb ? hb.last_run_at : null,
  counts, returned: Math.min(ordered.length, MAX), more_not_returned: Math.max(0, ordered.length - MAX),
  how_to_use: 'Work the list top to bottom. Every item must end in one of the five states. type is a hint from keywords, check the thread. reply_from_mailbox is the mailbox that already wrote on this thread; use the matching reply tool. thread texts are snippets of about 200 characters; never quote a snippet that is cut off.',
  work: ordered.slice(0, MAX), internal_threads: internal, meetings_upcoming_72h: soon, meetings_past_48h: past,
  auto_closed_sample: autoSample,
} }];
