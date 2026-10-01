import Link from 'next/link';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { cr, date, label, num, tone } from '@/lib/format';
import WindowBar, { inWindow, readWindow } from '@/components/Window';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

type Row = Record<string, any>;

const FUNNEL = ['Investors sent to', 'Emails sent', 'Replied', 'Meetings', '2nd mtgs'];

function fact(l: string, value: unknown): [string, string] | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length ? [l, value.join(', ')] : null;
  if (typeof value === 'boolean') return [l, value ? 'Yes' : 'No'];
  const s = String(value).trim();
  return s ? [l, s] : null;
}

export default async function StartupPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { win?: string };
}) {
  const supabase = createClient();
  const id = Number(params.id);
  const win = readWindow(searchParams?.win);

  const [sRes, shareRes, matchRes, meetRes, replyRes, docRes, mailRes] = await Promise.all([
    supabase.from('startups').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('shares')
      .select('sent_at,is_followup,followup_no,mailbox,type,replied_at,subject,to_email,source,investors(id,name,type,status)')
      .eq('startup_id', id)
      .is('superseded_by', null)
      .order('sent_at', { ascending: false })
      .limit(3000),
    supabase
      .from('matches')
      .select('type,state,priority,investors(id,name,type,status,cheque_min_cr,cheque_max_cr,geography)')
      .eq('startup_id', id)
      .limit(1000),
    supabase
      .from('meetings')
      .select('scheduled_at,is_second,held,meet_link,from_matcher,investor_name,in_book,investors(id,name)')
      .eq('startup_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(50),
    supabase
      .from('replies')
      .select('received_at,kind,reason,investors(id,name)')
      .eq('startup_id', id)
      .order('received_at', { ascending: false })
      .limit(50),
    supabase
      .from('docs')
      .select('doc_type,requested_at,received_at,classification')
      .eq('startup_id', id)
      .limit(20),
    // Raw mail, both directions, so the page can show what actually happened
    // rather than only the sends the matcher turned into shares.
    supabase
      .from('mail_log')
      .select('gmail_id,direction,subject,sent_at,from_email,to_emails,investor_id,investors(id,name)')
      .eq('startup_id', id)
      .order('sent_at', { ascending: false })
      .limit(1500),
  ]);

  const s: Row | null = sRes.data;
  if (!s) {
    return (
      <div className="wrap">
        <Header />
        <div className="sec"><div className="card">
          <div className="empty">No startup with id {params.id}, or your role does not have access.</div>
        </div></div>
      </div>
    );
  }

  const shares: Row[] = shareRes.data ?? [];
  const matches: Row[] = matchRes.data ?? [];
  const meetings: Row[] = meetRes.data ?? [];
  const replies: Row[] = replyRes.data ?? [];
  const docs: Row[] = docRes.data ?? [];
  const mail: Row[] = mailRes.data ?? [];

  // Forward-looking sections (the queue, meetings still to come) always show
  // everything. Everything historical answers to the window. inWindow only
  // drops rows OLDER than the cutoff, so a future meeting always survives.
  const wShares = inWindow(shares, 'sent_at', win);
  const wReplies = inWindow(replies, 'received_at', win);
  const wMeetings = inWindow(meetings, 'scheduled_at', win);
  const wMail = inWindow(mail, 'sent_at', win);
  const mailIn = wMail.filter((m) => m.direction === 'in');

  // Sent history collapsed to one line per investor rather than per email.
  type Sent = { id: number; name: string; type: string; n: number; first: string; last: string; maxFu: number; mailbox: string };
  const sentBy = new Map<number, Sent>();
  for (const sh of wShares) {
    const inv = sh.investors as Row | null;
    if (!inv) continue;
    const d = sentBy.get(inv.id) ?? {
      id: inv.id, name: inv.name, type: inv.type,
      n: 0, first: sh.sent_at, last: sh.sent_at, maxFu: 0, mailbox: sh.mailbox,
    };
    d.n += 1;
    if (sh.sent_at < d.first) d.first = sh.sent_at;
    if (sh.sent_at > d.last) d.last = sh.sent_at;
    if (sh.followup_no && sh.followup_no > d.maxFu) d.maxFu = sh.followup_no;
    sentBy.set(inv.id, d);
  }
  const sent = [...sentBy.values()].sort((a, b) => (a.last < b.last ? 1 : -1));

  const queued = matches
    .filter((m) => m.state === 'queued')
    .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9));
  const paused = matches.filter((m) => m.state === 'paused');

  const now = new Date().toISOString();
  const upcoming = wMeetings
    .filter((m) => m.scheduled_at >= now)
    .sort((a, b) => (a.scheduled_at > b.scheduled_at ? 1 : -1));
  const past = wMeetings.filter((m) => m.scheduled_at < now);

  const funnel = [
    sent.length,
    wShares.length,
    wShares.filter((x) => x.replied_at).length || wReplies.length,
    wMeetings.length,
    wMeetings.filter((m) => m.is_second).length,
  ];

  const deskName =
    s.bucket === 'HOT10' ? 'Hot deal'
      : s.bucket === 'A' ? 'Angel desk (A)'
        : s.bucket === 'B' ? 'Bucket B'
          : s.bucket === 'C' ? 'Middle desk (C)'
            : s.bucket;

  const round = [
    fact('Ask (current)', s.ask_current_cr === null ? null : cr(s.ask_current_cr)),
    fact('Ask (reset)', s.ask_reset_cr === null ? null : cr(s.ask_reset_cr)),
    fact('Revenue', s.revenue_note),
    fact('Burn', s.burn_inr_l === null ? null : `₹${s.burn_inr_l} L/mo`),
    fact('Runway', s.runway_months === null ? null : `${s.runway_months} months`),
    fact('Sector', s.sector),
    fact('Sub-sector', s.subsector),
    fact('Stage', s.stage),
    fact('Desk', deskName),
    fact('Owner', s.owner_name),
    fact('Score', s.score),
    fact('Rule tier', s.rule_tier),
    fact('Mandate signed', s.mandate_signed_on ? date(s.mandate_signed_on) : null),
  ].filter(Boolean) as [string, string][];

  const resetMissing = (s.bucket === 'A' || s.bucket === 'B') && s.ask_reset_cr === null;

  return (
    <div className="wrap">
      <Header />
      <Link href="/" className="back">← Today</Link>

      <div className="dhead">
        <div className="dtitle">
          <h1>{s.name}</h1>
          {s.bucket === 'HOT10' ? <span className="pill acc">Hot deal</span> : null}
        </div>
        <div className="pills">
          {s.sector ? <span className="pill">{s.sector}</span> : null}
          {s.stage ? <span className="pill">{s.stage}</span> : null}
          {s.owner_name ? <span className="pill">Owner: {s.owner_name}</span> : null}
          <span className={`pill ${tone(s.status)}`}>{label(s.status)}</span>
          {s.status === 'blocked' ? <span className="pill c">Not being sent</span> : null}
        </div>
      </div>

      <WindowBar base={`/startup/${id}`} active={win.key} />

      {resetMissing && (
        <div className="sec"><div className="card">
          <div style={{ padding: '11px 13px', fontSize: 13 }}>
            <b>Reset ask not recorded.</b> Bucket {s.bucket}, still matching on the current ask
            of {cr(s.ask_current_cr)}. Until the agreed reset is written here, the matcher keeps
            using the old number.
          </div>
        </div></div>
      )}

      <div className="sec">
        <div className="sechead"><h2>The round</h2></div>
        <div className="card facts">
          {round.map(([l, val]) => (
            <div className="fact" key={l}>
              <div className="fl">{l}</div>
              <div className={`fv${/^[A-Za-z₹]/.test(val) ? ' txt' : ''}`}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>Distribution</h2>
          <div className="note">{win.label.toLowerCase()}</div>
        </div>
        <div className="card funnel">
          {funnel.map((n, i) => (
            <div className={`fn${n === 0 ? ' zero' : ''}`} key={FUNNEL[i]}>
              <div className="fnv">{num(n)}</div>
              <div className="fnl">{FUNNEL[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="sec">
          <div className="sechead"><h2>Upcoming meetings</h2></div>
          <div className="card tscroll">
            <table>
              <thead><tr><th>When</th><th>Investor</th><th>Second</th><th>Link</th></tr></thead>
              <tbody>
                {upcoming.map((m, i) => {
                  const inv = m.investors as Row | null;
                  return (
                    <tr key={i}>
                      <td className="num">{date(m.scheduled_at)}</td>
                      <td>
                        {inv ? <Link href={`/investor/${inv.id}`}>{inv.name}</Link>
                          : m.investor_name
                            ? <span title="not in the investor book">{m.investor_name}</span>
                            : '—'}
                      </td>
                      <td>{m.is_second ? 'Yes' : '—'}</td>
                      <td>{m.meet_link ? <a href={m.meet_link}>join</a> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="sec">
        <div className="sechead">
          <h2>Queued to go out</h2>
          <div className="note">{queued.length} investors, not yet sent</div>
        </div>
        <div className="card tscroll">
          {queued.length === 0 ? (
            <div className="empty">Nothing queued. Either everything has gone, or the matcher finds nobody.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Investor</th><th>Type</th><th>Match</th><th>Cheque</th><th>Geography</th><th>Status</th></tr>
              </thead>
              <tbody>
                {queued.map((m, i) => {
                  const inv = m.investors as Row | null;
                  const lo = inv?.cheque_min_cr, hi = inv?.cheque_max_cr;
                  return (
                    <tr key={i}>
                      <td>{inv ? <Link href={`/investor/${inv.id}`}>{inv.name}</Link> : '—'}</td>
                      <td>{label(inv?.type)}</td>
                      <td>{m.type === 'strict' ? 'Strict' : label(m.type)}</td>
                      <td className="num">
                        {lo === null || lo === undefined ? '—'
                          : hi === null || hi === undefined ? `${cr(lo)}+`
                            : `${cr(lo)} to ${cr(hi)}`}
                      </td>
                      <td>{inv?.geography ?? '—'}</td>
                      <td>{label(inv?.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>Already sent to</h2>
          <div className="note">
            {sent.length} investors, {wShares.length} emails · {win.label.toLowerCase()}
          </div>
        </div>
        <div className="card tscroll">
          {sent.length === 0 ? (
            <div className="empty">
              {win.since === null
                ? 'Nothing has ever been sent for this startup.'
                : `Nothing went out in the ${win.label.toLowerCase()}.`}
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Investor</th><th>Type</th><th>Emails</th><th>Chased to</th><th>First</th><th>Last</th><th>Mailbox</th></tr>
              </thead>
              <tbody>
                {sent.map((d) => (
                  <tr key={d.id}>
                    <td><Link href={`/investor/${d.id}`}>{d.name}</Link></td>
                    <td>{label(d.type)}</td>
                    <td className="num">{d.n}</td>
                    <td>{d.maxFu ? `follow-up ${d.maxFu}` : 'initial only'}</td>
                    <td className="num">{date(d.first)}</td>
                    <td className="num">{date(d.last)}</td>
                    <td>{d.mailbox ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {wShares.length > 0 && (
        <div className="sec">
          <div className="sechead">
            <h2>Every email, newest first</h2>
            <div className="note">{wShares.length} in {win.label.toLowerCase()}</div>
          </div>
          <div className="card tscroll">
            <table>
              <thead>
                <tr><th>Sent</th><th>Investor</th><th>Touch</th><th>Mailbox</th><th>Subject</th><th>Replied</th></tr>
              </thead>
              <tbody>
                {wShares.slice(0, 400).map((sh, i) => {
                  const inv = sh.investors as Row | null;
                  return (
                    <tr key={i}>
                      <td className="num">{date(sh.sent_at)}</td>
                      <td>
                        {inv ? <Link href={`/investor/${inv.id}`}>{inv.name}</Link>
                          : sh.to_email ?? '—'}
                      </td>
                      <td>{sh.is_followup ? `Follow-up ${sh.followup_no ?? ''}`.trim() : 'First touch'}</td>
                      <td>{sh.mailbox ?? '—'}</td>
                      <td className="txt">{sh.subject ?? '—'}</td>
                      <td className="num">{sh.replied_at ? date(sh.replied_at) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {wShares.length > 400 && (
            <div className="winnote">Showing the most recent 400 of {wShares.length}.</div>
          )}
        </div>
      )}

      {wReplies.length > 0 && (
        <div className="sec">
          <div className="sechead">
            <h2>Replies and passes</h2>
            <div className="note">reasons are quoted, not paraphrased</div>
          </div>
          <div className="card tl">
            {wReplies.map((r, i) => {
              const inv = r.investors as Row | null;
              return (
                <div className="tlrow" key={i}>
                  <div className="tld">{date(r.received_at)}</div>
                  <div className="tlm">
                    <b>{label(r.kind)}</b>
                    {inv ? ` — ${inv.name}` : ''}
                    {r.reason ? ` · ${r.reason}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="sec">
          <div className="sechead"><h2>Meetings held</h2></div>
          <div className="card tscroll">
            <table>
              <thead><tr><th>When</th><th>Investor</th><th>Second</th><th>Held</th><th>From matcher</th></tr></thead>
              <tbody>
                {past.map((m, i) => {
                  const inv = m.investors as Row | null;
                  return (
                    <tr key={i}>
                      <td className="num">{date(m.scheduled_at)}</td>
                      <td>
                        {inv ? <Link href={`/investor/${inv.id}`}>{inv.name}</Link>
                          : m.investor_name
                            ? <span title="not in the investor book">{m.investor_name}</span>
                            : '—'}
                      </td>
                      <td>{m.is_second ? 'Yes' : '—'}</td>
                      <td>{m.held === null ? '—' : m.held ? 'Yes' : 'No'}</td>
                      <td>{m.from_matcher === null ? '—' : m.from_matcher ? 'Yes' : 'Warm'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {paused.length > 0 && (
        <div className="sec">
          <div className="sechead">
            <h2>Paused or closed</h2>
            <div className="note">{paused.length} investors the matcher will not send to</div>
          </div>
          <div className="card tscroll">
            <table>
              <thead><tr><th>Investor</th><th>Match</th><th>State</th></tr></thead>
              <tbody>
                {paused.slice(0, 60).map((m, i) => {
                  const inv = m.investors as Row | null;
                  return (
                    <tr key={i}>
                      <td>{inv ? <Link href={`/investor/${inv.id}`}>{inv.name}</Link> : '—'}</td>
                      <td>{label(m.type)}</td>
                      <td>{label(m.state)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {wMail.length > 0 && (
        <div className="sec">
          <div className="sechead">
            <h2>All correspondence</h2>
            <div className="note">
              {wMail.length} messages · {mailIn.length} inbound · {win.label.toLowerCase()}
            </div>
          </div>
          <div className="card tscroll">
            <table>
              <thead>
                <tr><th>When</th><th>Way</th><th>Counterparty</th><th>Subject</th></tr>
              </thead>
              <tbody>
                {wMail.slice(0, 500).map((m) => {
                  const inv = m.investors as Row | null;
                  const other = m.direction === 'in' ? m.from_email : m.to_emails;
                  return (
                    <tr key={m.gmail_id}>
                      <td className="num">{date(m.sent_at)}</td>
                      <td>{m.direction === 'in' ? 'In' : 'Out'}</td>
                      <td>
                        {inv ? <Link href={`/investor/${inv.id}`}>{inv.name}</Link>
                          : <span className="dim">{String(other ?? '—').split(',')[0]}</span>}
                      </td>
                      <td className="txt">{m.subject ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {wMail.length > 500 && (
            <div className="winnote">Showing the most recent 500 of {wMail.length}.</div>
          )}
        </div>
      )}

      {docs.length > 0 && (
        <div className="sec">
          <div className="sechead"><h2>Documents</h2></div>
          <div className="card tscroll">
            <table>
              <thead><tr><th>Document</th><th>Requested</th><th>Received</th><th>Classification</th></tr></thead>
              <tbody>
                {docs.map((d, i) => (
                  <tr key={i}>
                    <td>{d.doc_type}</td>
                    <td className="num">{date(d.requested_at)}</td>
                    <td className="num">{date(d.received_at)}</td>
                    <td>{label(d.classification)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {s.notes && (
        <div className="sec">
          <div className="sechead"><h2>Notes</h2></div>
          <div className="card">
            <div style={{ padding: '11px 13px', fontSize: 13, lineHeight: 1.6 }}>{s.notes}</div>
          </div>
        </div>
      )}
    </div>
  );
}
