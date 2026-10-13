const P = $('Plan').first().json;
const rows = (name) => $(name).all().map(i => i.json).filter(r => r && Object.keys(r).length);
const now = Date.now();
const HOT = ['spintly','boncuisine','eosnox','hyrgpt','talentrecruit','hoora','clikd','mindwox','mentorcloud','roadathena','learningpad'];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isHot = (startup, subject, bucket) => bucket === 'HOT10' || HOT.includes(norm(startup)) || HOT.some(h => norm(subject).includes(h));
const OURS = /@sidanaventures\.com/i;
const NOISE_FROM = /(no-?reply|donotreply|notification|calendar-|mailer-daemon|postmaster|indeed|naukri|linkedin|read\.ai|gemini|newsletter|news@|updates@|digest|billing|invoice|mca\.gov|district\.in|calendly\.com|zoom\.us|fireflies|otter\.ai|substack|mailchimp|hubspot|google\.com)/i;
// Automatic calendar responses. "Re: Invitation" is only noise when the message has no text.
const CAL_AUTO = /^\s*(accepted|declined|tentative|tentatively accepted|new event|canceled event|cancelled event)\s*:/i;
const CAL_INVITE = /^\s*((re|fwd?)\s*:\s*)*(invitation|updated invitation)\s*:/i;
const T = {
  booking_link: /(calendly\.com|cal\.com\/|hubspot\.com\/meetings|zcal\.co|savvycal|my calendly|book a slot|booking link)/i,
  pass: /(not (be )?(going ahead|proceed|take (this|it) forward|taking (this|it) forward)|won'?t be going ahead|will (have to|need to) pass|we will pass|pass(ing)? on (this|it)|it'?s a pass|unable to (participate|partner|invest|proceed)|not a (good )?fit|out of (our )?thesis|outside (of )?(our|my) (core )?(focus|scope|thesis|mandate)|doesn'?t fall in our thesis|not in (our|my) (current )?(thesis|focus|mandate)|beyond our (current )?(sectors?|focus|scope)|already passed|after (careful|internal) (consideration|discussion)|not (be )?(able|in a position) to (invest|proceed|participate|take)|not something we|not tracking|decided not|do(es)? not fit|doesn'?t fit|regret)/i,
  meeting: /(call|meeting|connect (me|us|with)|speak with|set up|schedule|slot|availability|calendar|zoom|google meet|catch up|time works|reschedul|postpone|couldn'?t connect)/i,
  documents: /(deck|financials|data ?room|mis\b|projections|cap ?table|one[- ]pager|send (the|us|over) (the )?(details|documents|docs))/i,
  redirect: /(send (the )?(investment )?proposals? to|please (write|send) to|reach out to .*@|no longer with|has left)/i,
};
const typeOf = (gist) => {
  const g = String(gist || '').trim();
  if (!g) return 'no_text';
  if (T.booking_link.test(g)) return 'booking_link';
  if (T.pass.test(g)) return 'pass';
  if (T.redirect.test(g)) return 'redirect';
  if (T.meeting.test(g)) return 'meeting';
  if (T.documents.test(g)) return 'documents';
  if (/\?/.test(g)) return 'question';
  if (/^(thanks|thank you|noted|great|sure|ok|okay)\b/i.test(g) && g.length < 160) return 'thanks_only';
  return 'other';
};
const isOut = (m) => m.direction === 'out' || OURS.test(m.from_email || '');
const threadMsgs = {};
rows('Fetch threads').forEach(m => { (threadMsgs[m.thread_id] = threadMsgs[m.thread_id] || []).push(m); });
let autoClosed = 0, alreadyAnswered = 0; const autoSample = [];
const noise = (from, subject, gist) => NOISE_FROM.test(from || '') || CAL_AUTO.test(subject || '') || (CAL_INVITE.test(subject || '') && !String(gist || '').trim());
const items = {};
const add = (it) => {
  const msgs = threadMsgs[it.thread_id] || [];
  const lastInMsg = msgs.filter(m => !isOut(m)).pop();
  const lastOutMsg = msgs.filter(isOut).pop();
  const lastInAt = (lastInMsg && lastInMsg.sent_at) || it.last_in_at;
  if (lastOutMsg && lastInAt && new Date(lastOutMsg.sent_at) > new Date(lastInAt)) { alreadyAnswered++; return; }
  const gist = (lastInMsg && lastInMsg.reply_gist) || it.gist || '';
  const from = (lastInMsg && lastInMsg.from_email) || it.from || null;
  if (noise(from, it.subject, gist)) { autoClosed++; if (autoSample.length < 8) autoSample.push((from || '') + ' | ' + String(it.subject || '').slice(0, 70)); return; }
  const box = msgs.filter(isOut).map(m => (String(m.mailbox || m.from_email || '').match(/[a-z0-9._-]+@sidanaventures\.com/i) || [''])[0]).filter(Boolean).pop() || null;
  items[it.thread_id] = Object.assign(it, { last_in_at: lastInAt, our_last_out_at: lastOutMsg ? lastOutMsg.sent_at : it.our_last_out_at, gist, from, reply_from_mailbox: box, msgs });
};
rows('Fetch owed').forEach(r => {
  if (!r.thread || items[r.thread]) return;
  add({ thread_id: r.thread, startup: r.startup || '', startup_id: r.startup_id || null, investor: r.investor || '', investor_id: r.investor_id || null,
    bucket: r.bucket || '', owner: r.owner_name || '', subject: r.subject || '', last_in_at: r.last_in, our_last_out_at: r.last_out || null, gist: r.gist || '', source: 'owed' });
});
rows('Fetch inbound').forEach(r => {
  const t = r.thread_id; if (!t || items[t]) return;
  add({ thread_id: t, startup: '', startup_id: r.startup_id || null, investor: '', investor_id: r.investor_id || null, bucket: '', owner: '',
    subject: r.subject || '', last_in_at: r.sent_at, our_last_out_at: null, gist: r.reply_gist || '', from: r.from_email,
    source: r.investor_id ? 'inbound_investor' : (r.startup_id ? 'inbound_founder' : 'inbound_unmatched') });
});
// One item per startup x investor pair: deals go out from 4 mailboxes, so the same investor can sit on several threads.
const groups = {};
Object.values(items).forEach(it => {
  if ((P.scope === 'hot') !== isHot(it.startup, it.subject, it.bucket)) return;
  const key = (it.startup_id && it.investor_id) ? ('p' + it.startup_id + '_' + it.investor_id) : ('t' + it.thread_id);
  (groups[key] = groups[key] || []).push(it);
});
const work = Object.values(groups).map(g => {
  g.sort((a, b) => new Date(b.last_in_at || 0) - new Date(a.last_in_at || 0));
  const it = g[0];
  const waitH = it.last_in_at ? Math.round((now - new Date(it.last_in_at)) / 3600000) : null;
  return {
    thread_id: it.thread_id, other_threads_same_pair: g.slice(1).map(x => x.thread_id), type: typeOf(it.gist), wait_hours: waitH,
    startup: it.startup || null, startup_id: it.startup_id, investor: it.investor || null, investor_id: it.investor_id, owner: it.owner || null,
    from: it.from, reply_from_mailbox: it.reply_from_mailbox, subject: it.subject, last_in_at: it.last_in_at, our_last_out_at: it.our_last_out_at || null, source: it.source,
    latest_message: String(it.gist || '').slice(0, 400),
    thread: it.msgs.slice(-6).map(m => ({ at: m.sent_at, dir: isOut(m) ? 'out' : 'in', from: m.from_email, text: String(m.reply_gist || '').slice(0, 300) })),
  };
});
// Order: due (18h to 7 days, oldest first) -> today (under 18h, oldest first) -> backlog (7 to 21 days, newest first) -> unknown time.
const W = (lo, hi) => work.filter(w => w.wait_hours != null && w.wait_hours >= lo && w.wait_hours < hi);
const due = W(18, 168).sort((a, b) => b.wait_hours - a.wait_hours);
const today = W(0, 18).concat(W(-1e9, 0)).sort((a, b) => b.wait_hours - a.wait_hours);
const backlog = W(168, 1e9).sort((a, b) => a.wait_hours - b.wait_hours);
const unknown = work.filter(w => w.wait_hours == null);
const tag = (arr, g) => arr.map(w => Object.assign({ group: g }, w));
const ordered = tag(due, 'due_18h_to_7d').concat(tag(today, 'today'), tag(backlog, 'backlog_7_to_21d'), tag(unknown, 'unknown_time'));
const MAX = 40;
// internal team threads (TIME NEEDED, BOOK VIA LINK, ANSWER NEEDED, TRAIL APPROVAL, FORWARD NEEDED)
const intByT = {};
rows('Fetch internal').forEach(m => { (intByT[m.thread_id] = intByT[m.thread_id] || []).push(m); });
const internal = Object.entries(intByT).map(([t, ms]) => {
  const last = ms[ms.length - 1];
  return { thread_id: t, subject: String(ms[0].subject || '').replace(/^\s*(re|fwd?)\s*:\s*/i, ''), messages: ms.length, started_at: ms[0].sent_at,
    last_from: last.from_email, last_at: last.sent_at, team_replied: ms.length > 1 && /^\s*re\s*:/i.test(last.subject || ''), last_text: String(last.reply_gist || '').slice(0, 300) };
}).filter(x => (P.scope === 'hot') === HOT.some(h => norm(x.subject).includes(h)));
const meet = rows('Fetch meetings').filter(m => (P.scope === 'hot') === isHot(m.startup_name, m.notes, ''));
const soon = meet.filter(m => new Date(m.scheduled_at) >= now).map(m => ({ at: m.scheduled_at, startup: m.startup_name, investor: m.investor_name, startup_id: m.startup_id, investor_id: m.investor_id, link: m.meet_link, title: m.notes, hours_from_now: Math.round((new Date(m.scheduled_at) - now) / 3600000) }));
const past = meet.filter(m => new Date(m.scheduled_at) < now).map(m => ({ at: m.scheduled_at, startup: m.startup_name, investor: m.investor_name, startup_id: m.startup_id, investor_id: m.investor_id, held: m.held, title: m.notes }));
const hb = rows('Fetch heartbeat')[0] || null;
const counts = { total: ordered.length, due_18h_to_7d: due.length, today: today.length, backlog_7_to_21d: backlog.length, unknown_time: unknown.length,
  by_type: ordered.reduce((o, w) => (o[w.type] = (o[w.type] || 0) + 1, o), {}), auto_closed_noise: autoClosed, already_answered: alreadyAnswered };
return [{ json: {
  generated_at: new Date(now).toISOString(), scope: P.scope, window_hours: P.hrs, last_run_at: hb ? hb.last_run_at : null,
  counts, returned: Math.min(ordered.length, MAX), more_not_returned: Math.max(0, ordered.length - MAX),
  how_to_use: 'Work the list top to bottom in batches of 10. Every item ends in one of the five states. type is a keyword hint: confirm it from the thread. Reply on thread_id from reply_from_mailbox. other_threads_same_pair are the same investor on another mailbox: do not answer those separately. thread texts are snippets of about 200 characters; never quote a cut-off snippet.',
  work: ordered.slice(0, MAX), internal_threads: internal, meetings_upcoming_72h: soon, meetings_past_48h: past, auto_closed_sample: autoSample,
} }];
