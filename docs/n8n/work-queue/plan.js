const b = $input.first().json || {};
const scope = String(b.scope || '').toLowerCase() === 'hot' ? 'hot' : 'nonhot';
const hrs = Math.min(Math.max(parseInt(b.hours, 10) || 30, 6), 96);
const skip = Math.min(Math.max(parseInt(b.skip, 10) || 0, 0), 1000);
const iso = (ms) => encodeURIComponent(new Date(ms).toISOString());
const now = Date.now();
const MAIL = 'mail_log?select=sent_at,mailbox,direction,from_email,to_emails,subject,reply_gist,reply_kind,startup_id,investor_id,thread_id';
return [{ json: {
  scope, hrs, skip,
  owed: 'v_owed_replies?select=*&days_waiting=lte.21&order=days_waiting.asc&limit=300',
  inbound: MAIL + '&from_email=not.like.*sidanaventures.com*&sent_at=gte.' + iso(now - hrs * 3600000) + '&order=sent_at.desc&limit=400',
  heartbeat: 'task_heartbeat?select=task,last_run_at,note&task=eq.' + (scope === 'hot' ? 'hot-deals-agent' : 'deal-flow-agent'),
  internal: MAIL + '&or=(subject.ilike.*TIME%20NEEDED*,subject.ilike.*BOOK%20VIA%20LINK*,subject.ilike.*ANSWER%20NEEDED*,subject.ilike.*TRAIL%20APPROVAL*,subject.ilike.*FORWARD%20NEEDED*)&sent_at=gte.' + iso(now - 14 * 86400000) + '&order=sent_at.asc&limit=300',
  meetings: 'meetings?select=scheduled_at,is_second,held,meet_link,startup_id,investor_id,startup_name,investor_name,notes&superseded_by=is.null&scheduled_at=gte.' + iso(now - 2 * 86400000) + '&scheduled_at=lte.' + iso(now + 3 * 86400000) + '&order=scheduled_at.asc&limit=100',
} }];
