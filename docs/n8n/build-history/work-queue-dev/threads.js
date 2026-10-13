const rows = (name) => $(name).all().map(i => i.json).filter(r => r && Object.keys(r).length);
const ids = new Set();
rows('Fetch owed').forEach(r => r.thread && ids.add(r.thread));
rows('Fetch inbound').forEach(r => r.thread_id && ids.add(r.thread_id));
const list = [...ids].filter(x => /^[0-9a-f]{16}$/.test(x)).slice(0, 250);
const path = list.length ? 'mail_log?select=sent_at,mailbox,direction,from_email,subject,reply_gist,thread_id&thread_id=in.(' + list.join(',') + ')&order=sent_at.asc&limit=3000' : 'mail_log?select=thread_id&limit=0';
return [{ json: { threadsPath: path, n: list.length } }];
