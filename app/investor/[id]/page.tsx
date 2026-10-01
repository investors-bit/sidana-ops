import Link from 'next/link';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { cr, date, label, num, tone } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

type Row = Record<string, any>;

const FUNNEL = ['Deals sent', 'Opened', 'Replied', 'Meetings', '2nd mtgs'];

export default async function InvestorPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const id = Number(params.id);

  const [iRes, shareRes, meetRes, matchRes, replyRes] = await Promise.all([
    supabase.from('investors').select('*').eq('id', id).maybeSingle(),
    supabase.from('shares').select('opened_at,replied_at').eq('investor_id', id).limit(2000),
    supabase
      .from('meetings')
      .select('scheduled_at,is_second,startups(id,name)')
      .eq('investor_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(20),
    supabase
      .from('matches')
      .select('type,state,score,startups(id,name,bucket)')
      .eq('investor_id', id)
      .limit(25),
    supabase
      .from('replies')
      .select('received_at,kind,reason,startups(id,name)')
      .eq('investor_id', id)
      .order('received_at', { ascending: false })
      .limit(10),
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

  const shares: Row[] = shareRes.data ?? [];
  const meetings: Row[] = meetRes.data ?? [];
  const matches: Row[] = matchRes.data ?? [];
  const replies: Row[] = replyRes.data ?? [];

  const funnel = [
    shares.length,
    shares.filter((s) => s.opened_at).length,
    shares.filter((s) => s.replied_at).length,
    meetings.length,
    meetings.filter((m) => m.is_second).length,
  ];

  const cheque =
    v.cheque_min_cr !== null && v.cheque_max_cr !== null
      ? `${cr(v.cheque_min_cr)} – ${cr(v.cheque_max_cr)}`
      : (v.cheque_as_written ?? '—');

  const facts: [string, string][] = [
    ['Cheque', cheque],
    ['Stage', (v.stage_pref ?? []).join(', ') || 'Not set'],
    ['Sectors', (v.sectors ?? []).join(', ') || 'Not set'],
    ['Geography', v.geography ?? '—'],
    ['Thesis call', v.thesis_call_on ? date(v.thesis_call_on) : 'Not done'],
    ['Last contacted', date(v.last_contacted_on)],
  ];

  const usable =
    !v.do_not_contact &&
    !v.suppressed &&
    (v.sectors ?? []).length > 0 &&
    (v.stage_pref ?? []).length > 0 &&
    v.cheque_min_cr !== null &&
    v.cheque_max_cr !== null;

  return (
    <div className="wrap">
      <Header />
      <Link href="/" className="back">
        ← Today
      </Link>

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
          {usable ? (
            <span className="pill g">Matcher can use</span>
          ) : (
            <span className="pill w">Thesis incomplete</span>
          )}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>Thesis on file</h2>
          {!usable && <div className="note">missing fields block the matcher</div>}
        </div>
        <div className="card facts">
          {facts.map(([l, val]) => (
            <div className="fact" key={l}>
              <div className="fl">{l}</div>
              <div className={`fv${/^[A-Za-z]/.test(val) ? ' txt' : ''}`}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>Engagement</h2>
          <div className="note">all time</div>
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
          <h2>Deals with them</h2>
          <div className="note">{matches.length} shown</div>
        </div>
        <div className="card tscroll">
          {matches.length === 0 ? (
            <div className="empty">No deals matched to this investor.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Startup</th>
                  <th>Bucket</th>
                  <th>Match</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => {
                  const st = m.startups as Row | null;
                  return (
                    <tr key={i}>
                      <td>{st ? <Link href={`/startup/${st.id}`}>{st.name}</Link> : '—'}</td>
                      <td>{st?.bucket ?? '—'}</td>
                      <td>{label(m.type)}</td>
                      <td>{label(m.state)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {meetings.length > 0 && (
        <div className="sec">
          <div className="sechead">
            <h2>Meetings given</h2>
          </div>
          <div className="card tscroll">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Startup</th>
                  <th>Second</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m, i) => {
                  const st = m.startups as Row | null;
                  return (
                    <tr key={i}>
                      <td className="num">{date(m.scheduled_at)}</td>
                      <td>{st ? <Link href={`/startup/${st.id}`}>{st.name}</Link> : '—'}</td>
                      <td>{m.is_second ? 'Yes' : '—'}</td>
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

      {v.notes && (
        <div className="sec">
          <div className="sechead">
            <h2>Notes</h2>
          </div>
          <div className="card">
            <div style={{ padding: '11px 13px', fontSize: 13 }}>{v.notes}</div>
          </div>
        </div>
      )}
    </div>
  );
}
