import Link from 'next/link';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { cr, date, label, num, tone } from '@/lib/format';
import WindowBar, { inWindow, readWindow } from '@/components/Window';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

type Row = Record<string, any>;

const FUNNEL = ['Deals sent', 'Emails sent', 'Replied', 'Meetings', '2nd mtgs'];

/** A row only renders if there is something in it. Keeps the thesis block
 *  honest: a blank field is a gap in the book, not a line saying "—". */
function fact(labelText: string, value: unknown): [string, string] | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return value.length ? [labelText, value.join(', ')] : null;
  }
  if (typeof value === 'boolean') return [labelText, value ? 'Yes' : 'No'];
  const s = String(value).trim();
  return s ? [labelText, s] : null;
}

export default async function InvestorPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { win?: string };
}) {
  const supabase = createClient();
  const id = Number(params.id);
  const win = readWindow(searchParams?.win);

  const [iRes, shareRes, meetRes, replyRes, mailRes] = await Promise.all([
    supabase.from('investors').select('*').eq('id', id).maybeSingle(),
    // The real deal history. `matches` is empty; `shares` is what actually went out.
    supabase
      .from('shares')
      .select('sent_at,is_followup,followup_no,mailbox,type,opened_at,replied_at,subject,source,startups(id,name,bucket,sector,stage,status,ask_current_cr,ask_as_written)')
      .eq('investor_id', id)
      .is('superseded_by', null)
      .order('sent_at', { ascending: false })
      .limit(2000),
    supabase
      .from('meetings')
      .select('scheduled_at,is_second,held,startup_name,startups(id,name)')
      .eq('investor_id', id)
      .is('superseded_by', null)
      .order('scheduled_at', { ascending: false })
      .limit(20),
    supabase
      .from('replies')
      .select('received_at,kind,reason,startups(id,name)')
      .eq('investor_id', id)
      .order('received_at', { ascending: false })
      .limit(20),
    // Includes the threads that carried no deal at all: thesis calls,
    // introductions, scheduling. That is still relationship history.
    supabase
      .from('mail_log')
      .select('gmail_id,direction,subject,sent_at,startup_id,startups(id,name)')
      .eq('investor_id', id)
      .order('sent_at', { ascending: false })
      .limit(1000),
  ]);

  const v: Row | null = iRes.data;
  if (!v) {
    return (
      <div className="wrap">
        <Header />
        <div className="sec">
          <div className="card">
            <div className="empty">
              No investor with id {params.id}, or your role does not have access to it.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const allShares: Row[] = shareRes.data ?? [];
  const allMeetings: Row[] = meetRes.data ?? [];
  const allReplies: Row[] = replyRes.data ?? [];

  const shares = inWindow(allShares, 'sent_at', win);
  const meetings = inWindow(allMeetings, 'scheduled_at', win);
  const replies = inWindow(allReplies, 'received_at', win);
  const mail = inWindow((mailRes.data ?? []) as Row[], 'sent_at', win);
  const mailIn = mail.filter((m) => m.direction === 'in');

  // One line per startup, not per email: how many touches, when it started,
  // when it last went out, and how deep the follow-up chain ran.
  type Deal = {
    id: number; name: string; bucket: string; sector: string; stage: string;
    ask: number | null; askText: string | null; sends: number; first: string; last: string; maxFu: number;
  };
  const byStartup = new Map<number, Deal>();
  for (const s of shares) {
    const st = s.startups as Row | null;
    if (!st) continue;
    const d = byStartup.get(st.id) ?? {
      id: st.id, name: st.name, bucket: st.bucket, sector: st.sector,
      stage: st.stage, ask: st.ask_current_cr, askText: st.ask_as_written ?? null, sends: 0,
      first: s.sent_at, last: s.sent_at, maxFu: 0,
    };
    d.sends += 1;
    if (s.sent_at < d.first) d.first = s.sent_at;
    if (s.sent_at > d.last) d.last = s.sent_at;
    if (s.followup_no && s.followup_no > d.maxFu) d.maxFu = s.followup_no;
    byStartup.set(st.id, d);
  }
  const deals = [...byStartup.values()].sort((a, b) => (a.last < b.last ? 1 : -1));

  const funnel = [
    deals.length,
    shares.length,
    shares.filter((s) => s.replied_at).length,
    meetings.length,
    meetings.filter((m) => m.is_second).length,
  ];

  const chequeBand =
    v.cheque_min_cr !== null && v.cheque_max_cr !== null
      ? `${cr(v.cheque_min_cr)} to ${cr(v.cheque_max_cr)}`
      : v.cheque_min_cr !== null
        ? `${cr(v.cheque_min_cr)} and up`
        : v.cheque_max_cr !== null
          ? `up to ${cr(v.cheque_max_cr)}`
          : null;

  const stageBand =
    v.stage_min || v.stage_max
      ? [v.stage_min, v.stage_max].filter(Boolean).join(' to ').replace(/_/g, ' ')
      : null;

  // Everything we hold on what they will and will not look at. Fields only
  // appear once they exist in the table and carry a value.
  const thesis = [
    fact('Cheque', chequeBand ?? v.cheque_as_written),
    fact('As written', chequeBand && v.cheque_as_written ? v.cheque_as_written : null),
    fact('Will lead up to', v.lead_max_cr === null ? null : cr(v.lead_max_cr)),
    fact('Max round size', v.round_max_cr === null ? null : cr(v.round_max_cr)),
    fact('Stage', (v.stage_pref ?? []).length ? v.stage_pref : stageBand),
    fact('Sectors', v.sectors),
    fact('Sector mode', v.sector_mode),
    fact('Will NOT look at', v.sectors_excluded),
    fact('Business models', v.models_in),
    fact('Models excluded', v.models_excluded),
    fact('Minimum ARR', v.arr_min_cr === null ? null : cr(v.arr_min_cr)),
    fact('ARR is a hard floor', v.arr_min_strict),
    fact('Revenue required', v.revenue_required),
    fact('Women-led only', v.women_only),
    fact('Geography', v.geography),
    fact('Thesis confirmed', v.confirmed),
    fact('Thesis call', v.thesis_call_on ? date(v.thesis_call_on) : null),
    fact('Last contacted', v.last_contacted_on ? date(v.last_contacted_on) : null),
    fact('Contacted by', v.contacted_by),
    fact('Email', v.email),
  ].filter(Boolean) as [string, string][];

  const usable =
    !v.do_not_contact && !v.suppressed &&
    (v.sectors ?? []).length > 0 && (v.stage_pref ?? []).length > 0 &&
    v.cheque_min_cr !== null && v.cheque_max_cr !== null;

  const missing = [
    (v.sectors ?? []).length ? null : 'sectors',
    (v.stage_pref ?? []).length ? null : 'stage',
    v.cheque_min_cr === null ? 'cheque floor' : null,
    v.cheque_max_cr === null ? 'cheque ceiling' : null,
  ].filter(Boolean);

  return (
    <div className="wrap">
      <Header />
      <Link href="/" className="back">← Today</Link>

      <div className="dhead">
        <div className="dtitle">
          <h1>{v.name}</h1>
          <span className="kind">{label(v.type)}</span>
        </div>
        <div className="pills">
          {v.contact_person ? <span className="pill">{v.contact_person}</span> : null}
          <span className={`pill ${tone(v.status)}`}>{label(v.status)}</span>
          {v.do_not_contact ? <span className="pill c">Do not contact</span> : null}
          {v.suppressed ? <span className="pill c">Suppressed</span> : null}
          {usable
            ? <span className="pill g">Matcher can use</span>
            : <span className="pill w">Thesis incomplete</span>}
        </div>
      </div>

      <WindowBar base={`/investor/${id}`} active={win.key} />

      <div className="sec">
        <div className="sechead">
          <h2>Thesis on file</h2>
          {missing.length > 0 && (
            <div className="note">missing {missing.join(', ')}, so the matcher skips them</div>
          )}
        </div>
        <div className="card facts">
          {thesis.map(([l, val]) => (
            <div className="fact" key={l}>
              <div className="fl">{l}</div>
              <div className={`fv${/^[A-Za-z]/.test(val) ? ' txt' : ''}`}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {v.other_requirements && (
        <div className="sec">
          <div className="sechead">
            <h2>Other requirements</h2>
            <div className="note">things they said that no column covers</div>
          </div>
          <div className="card">
            <div style={{ padding: '11px 13px', fontSize: 13, lineHeight: 1.6 }}>
              {v.other_requirements}
            </div>
          </div>
        </div>
      )}

      <div className="sec">
        <div className="sechead">
          <h2>Engagement</h2>
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

      <div className="sec">
        <div className="sechead">
          <h2>Startups shared with them</h2>
          <div className="note">
            {deals.length} {deals.length === 1 ? 'company' : 'companies'}, {shares.length} emails
          </div>
        </div>
        <div className="card tscroll">
          {deals.length === 0 ? (
            <div className="empty">
              {win.since === null
                ? 'Nothing has ever been sent to this investor.'
                : `Nothing went out to them in the ${win.label.toLowerCase()}.`}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Startup</th>
                  <th>Sector</th>
                  <th>Stage</th>
                  <th>Bucket</th>
                  <th>Ask</th>
                  <th>Emails</th>
                  <th>Chased to</th>
                  <th>First sent</th>
                  <th>Last sent</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id}>
                    <td><Link href={`/startup/${d.id}`}>{d.name}</Link></td>
                    <td>{d.sector ?? '—'}</td>
                    <td>{d.stage ?? '—'}</td>
                    <td>{d.bucket ?? '—'}</td>
                    <td className="num">{d.askText ?? (d.ask === null ? '—' : cr(d.ask))}</td>
                    <td className="num">{d.sends}</td>
                    <td>{d.maxFu ? `follow-up ${d.maxFu}` : 'initial only'}</td>
                    <td className="num">{date(d.first)}</td>
                    <td className="num">{date(d.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {shares.length > 0 && (
        <div className="sec">
          <div className="sechead">
            <h2>Every email, newest first</h2>
            <div className="note">{shares.length} in {win.label.toLowerCase()}</div>
          </div>
          <div className="card tscroll">
            <table>
              <thead>
                <tr><th>Sent</th><th>Startup</th><th>Touch</th><th>Mailbox</th><th>Subject</th><th>Replied</th></tr>
              </thead>
              <tbody>
                {shares.slice(0, 400).map((sh, i) => {
                  const st = sh.startups as Row | null;
                  return (
                    <tr key={i}>
                      <td className="num">{date(sh.sent_at)}</td>
                      <td>{st ? <Link href={`/startup/${st.id}`}>{st.name}</Link> : '—'}</td>
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
          {shares.length > 400 && (
            <div className="winnote">Showing the most recent 400 of {shares.length}.</div>
          )}
        </div>
      )}

      {meetings.length > 0 && (
        <div className="sec">
          <div className="sechead"><h2>Meetings given</h2></div>
          <div className="card tscroll">
            <table>
              <thead><tr><th>When</th><th>Startup</th><th>Second</th><th>Held</th></tr></thead>
              <tbody>
                {meetings.map((m, i) => {
                  const st = m.startups as Row | null;
                  return (
                    <tr key={i}>
                      <td className="num">{date(m.scheduled_at)}</td>
                      <td>
                        {st ? <Link href={`/startup/${st.id}`}>{st.name}</Link>
                          : m.startup_name
                            ? <span title="not in the startup book">{m.startup_name}</span>
                            : 'Thesis call'}
                      </td>
                      <td>{m.is_second ? 'Yes' : '—'}</td>
                      <td>{m.held === null ? '—' : m.held ? 'Yes' : 'No'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {replies.length > 0 && (
        <div className="sec">
          <div className="sechead">
            <h2>Replies</h2>
            <div className="note">a pass with a reason is free thesis data</div>
          </div>
          <div className="card tl">
            {replies.map((r, i) => {
              const st = r.startups as Row | null;
              return (
                <div className="tlrow" key={i}>
                  <div className="tld">{date(r.received_at)}</div>
                  <div className="tlm">
                    <b>{label(r.kind)}</b>
                    {st ? ` on ${st.name}` : ''}
                    {r.reason ? ` — ${r.reason}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mail.length > 0 && (
        <div className="sec">
          <div className="sechead">
            <h2>All correspondence</h2>
            <div className="note">
              {mail.length} messages · {mailIn.length} from them · {win.label.toLowerCase()}
            </div>
          </div>
          <div className="card tscroll">
            <table>
              <thead><tr><th>When</th><th>Way</th><th>About</th><th>Subject</th></tr></thead>
              <tbody>
                {mail.slice(0, 500).map((m) => {
                  const st = m.startups as Row | null;
                  return (
                    <tr key={m.gmail_id}>
                      <td className="num">{date(m.sent_at)}</td>
                      <td>{m.direction === 'in' ? 'In' : 'Out'}</td>
                      <td>
                        {st ? <Link href={`/startup/${st.id}`}>{st.name}</Link>
                          : <span className="dim">No deal</span>}
                      </td>
                      <td className="txt">{m.subject ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {mail.length > 500 && (
            <div className="winnote">Showing the most recent 500 of {mail.length}.</div>
          )}
        </div>
      )}

      {v.notes && (
        <div className="sec">
          <div className="sechead"><h2>Thesis summary</h2></div>
          <div className="card">
            <div style={{ padding: '11px 13px', fontSize: 13, lineHeight: 1.6 }}>{v.notes}</div>
          </div>
        </div>
      )}
    </div>
  );
}
