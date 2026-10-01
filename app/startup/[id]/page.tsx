import Link from 'next/link';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { cr, date, label, num, tone } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

type Row = Record<string, any>;

const FUNNEL = ['Sent', 'Opened', 'Replied', 'Meetings', '2nd mtgs'];

export default async function StartupPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const id = Number(params.id);

  const [sRes, fRes, mRes, meetRes, docRes, logRes] = await Promise.all([
    supabase.from('startups').select('*').eq('id', id).maybeSingle(),
    supabase.from('v_startup_funnel').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('matches')
      .select('type,state,score,priority,investors(id,name,type,status)')
      .eq('startup_id', id)
      .order('priority', { ascending: true })
      .limit(40),
    supabase
      .from('meetings')
      .select('scheduled_at,is_second,held,investors(id,name)')
      .eq('startup_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(10),
    supabase
      .from('docs')
      .select('doc_type,requested_at,received_at,classification')
      .eq('startup_id', id)
      .limit(10),
    supabase
      .from('ai_log')
      .select('ran_at,workflow,action,decision,reasoning,ok')
      .eq('entity_name', (await supabase.from('startups').select('name').eq('id', id).maybeSingle()).data?.name ?? '')
      .order('ran_at', { ascending: false })
      .limit(10),
  ]);

  const s: Row | null = sRes.data;
  if (!s) {
    return (
      <div className="wrap">
        <Header />
        <div className="sec">
          <div className="card">
            <div className="empty">
              No startup with id {params.id}, or your role does not have access to it.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const f: Row = fRes.data ?? {};
  const matches: Row[] = mRes.data ?? [];
  const meetings: Row[] = meetRes.data ?? [];
  const docs: Row[] = docRes.data ?? [];
  const logs: Row[] = logRes.data ?? [];

  const funnel = [f.sent ?? 0, f.opened ?? 0, f.replied ?? 0, f.meetings ?? 0, f.second_meetings ?? 0];

  const facts: [string, string][] = [
    ['Ask (current)', cr(s.ask_current_cr)],
    ['Ask (reset)', s.ask_reset_cr === null ? 'Not set' : cr(s.ask_reset_cr)],
    ['Revenue', s.revenue_note ?? (s.revenue_inr_l ? `₹${s.revenue_inr_l} L` : '—')],
    ['Burn', s.burn_inr_l ? `₹${s.burn_inr_l} L/mo` : '—'],
    ['Runway', s.runway_months ? `${s.runway_months} months` : '—'],
    ['Mandate signed', date(s.mandate_signed_on)],
  ];

  return (
    <div className="wrap">
      <Header />
      <Link href="/" className="back">
        ← Today
      </Link>

      <div className="dhead">
        <div className="dtitle">
          <h1>{s.name}</h1>
          {s.score !== null && s.score !== undefined ? (
            <span className="pill acc">Score {s.score}</span>
          ) : (
            <span className="pill c">Not scored</span>
          )}
        </div>
        <div className="pills">
          {s.sector ? <span className="pill">{s.sector}</span> : null}
          {s.stage ? <span className="pill">{s.stage}</span> : null}
          <span className="pill">Bucket {s.bucket}</span>
          {s.owner_name ? <span className="pill">Owner: {s.owner_name}</span> : null}
          <span className={`pill ${tone(s.status)}`}>{label(s.status)}</span>
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>The round</h2>
        </div>
        <div className="card facts">
          {facts.map(([l, v]) => (
            <div className="fact" key={l}>
              <div className="fl">{l}</div>
              <div className={`fv${/^[A-Za-z]/.test(v) ? ' txt' : ''}`}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>Distribution</h2>
          <div className="note">since mandate</div>
        </div>
        <div className="card funnel">
          {funnel.map((v, i) => (
            <div className={`fn${v === 0 ? ' zero' : ''}`} key={FUNNEL[i]}>
              <div className="fnv">{num(v)}</div>
              <div className="fnl">{FUNNEL[i]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>Matched investors</h2>
          <div className="note">{matches.length} shown</div>
        </div>
        <div className="card tscroll">
          {matches.length === 0 ? (
            <div className="empty">No matches recorded.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Investor</th>
                  <th>Type</th>
                  <th>Match</th>
                  <th>State</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => {
                  const inv = m.investors as Row | null;
                  return (
                    <tr key={i}>
                      <td>
                        {inv ? <Link href={`/investor/${inv.id}`}>{inv.name}</Link> : '—'}
                      </td>
                      <td>{label(inv?.type)}</td>
                      <td>{label(m.type)}</td>
                      <td>{label(m.state)}</td>
                      <td className="num">{m.score ?? '—'}</td>
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
          <h2>Meetings</h2>
        </div>
        <div className="card tscroll">
          {meetings.length === 0 ? (
            <div className="empty">No meetings recorded.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Investor</th>
                  <th>Second</th>
                  <th>Held</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m, i) => {
                  const inv = m.investors as Row | null;
                  return (
                    <tr key={i}>
                      <td className="num">{date(m.scheduled_at)}</td>
                      <td>{inv ? <Link href={`/investor/${inv.id}`}>{inv.name}</Link> : '—'}</td>
                      <td>{m.is_second ? 'Yes' : '—'}</td>
                      <td>{m.held === null ? '—' : m.held ? 'Yes' : 'No'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {docs.length > 0 && (
        <div className="sec">
          <div className="sechead">
            <h2>Documents</h2>
          </div>
          <div className="card tscroll">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Requested</th>
                  <th>Received</th>
                  <th>Classification</th>
                </tr>
              </thead>
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

      <div className="sec">
        <div className="sechead">
          <h2>AI activity</h2>
        </div>
        <div className="card tl">
          {logs.length === 0 ? (
            <div className="empty">Nothing logged for this startup yet.</div>
          ) : (
            logs.map((l, i) => (
              <div className="tlrow" key={i}>
                <div className="tld">{date(l.ran_at)}</div>
                <div className="tlm">
                  <b>{l.workflow}</b> {label(l.action)}
                  {l.decision ? ` · ${l.decision}` : ''}
                  {l.reasoning ? ` — ${l.reasoning}` : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
