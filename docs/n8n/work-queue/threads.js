const P = $('Plan').first().json;
const rows = (name) => $(name).all().map(i => i.json).filter(r => r && Object.keys(r).length);
const HOT = ['spintly','boncuisine','eosnox','hyrgpt','talentrecruit','hoora','clikd','mindwox','mentorcloud','roadathena','learningpad'];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isHot = (startup, subject, bucket) => bucket === 'HOT10' || HOT.includes(norm(startup)) || HOT.some(h => norm(subject).includes(h));
// Only fetch threads for this scope; an unmatched inbound mail is kept in both scopes.
const keep = (startup, subject, bucket) => (P.scope === 'hot') === isHot(startup, subject, bucket);
const ids = new Set();
rows('Fetch owed').forEach(r => r.thread && keep(r.startup, r.subject, r.bucket) && ids.add(r.thread));
rows('Fetch inbound').forEach(r => r.thread_id && (keep('', r.subject, '') || P.scope === 'nonhot') && ids.add(r.thread_id));
const list = [...ids].filter(x => /^[0-9a-f]{16}$/.test(x)).slice(0, 420);
const path = list.length ? 'mail_log?select=sent_at,mailbox,direction,from_email,subject,reply_gist,thread_id&thread_id=in.(' + list.join(',') + ')&order=sent_at.asc&limit=6000' : 'mail_log?select=thread_id&limit=0';
return [{ json: { threadsPath: path, n: list.length } }];
