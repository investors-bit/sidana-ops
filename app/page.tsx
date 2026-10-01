import Link from 'next/link';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { ago, cr, date, label, num, time, usd } from '@/lib/format';

export const dynamic = 'force-dynamic';
// Cloudflare Pages runs Next on the edge runtime, not Node.
export const runtime = 'edge';

type Row = Record<string, any>;

export default async function Today() {
  const supabase = createClient();

  const [todayRes, logRes, silentRes, resetRes, errRes, upRes, repRes, newInvRes, hotRes] =
    await Promise.all([
      supabase.from('v_today').select('*').maybeSingle(),
      supabase.from('ai_log').select('*').order('ran_at', { ascending: false }).limit(15),
      supabase.from('v_silent_startups').select('*').limit(6),
      supabase
        .from('startups')
        .select('id,name,bucket,ask_current_cr')
        .in('bucket', ['A', 'B'])
        .is('ask_reset_cr', null)
        .limit(6),
      supabase.from('ai_log').select('*').eq('ok', false).order('ran_at', { ascending: false }).limit(5),
      supabase.from('v_upcoming_meetings').select('*').limit(25),
      supabase.from('v_recent_replies').select('*').limit(20),
      // Genuinely new names. SYNC-BOOK only sets created_at on insert, so an
      // existing investor being updated hourly does not show up here.
      supabase
        .from('investors')
        .select('id,name,type,status,contact_person,created_at')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('v_startup_funnel')
        .select('*')
        .eq('bucket', 'HOT10')
        .order('meetings', { ascending: false })
        .limit(12),
    ]);

  const t: Row = todayRes.data ?? {};
  const logs: Row[] = logRes.data ?? [];
  const silent: Row[] = silentRes.data ?? [];
  const noReset: Row[] = resetRes.data ?? [];
  const errors: Row[] = errRes.data ?? [];
  const upcoming: Row[] = upRes.data ?? [];
  const replies: Row[] = repRes.data ?? [];
  const newInv: Row[] = newInvRes.data ?? [];
  const hot: Row[] = hotRes.data ?? [];

  const tiles = [
    { lab: 'Deals sent', val: t.deals_sent ?? 0, sub: 'today' },
    { lab: 'Meetings today', val: t.meetings_today ?? 0, sub: `${upcoming.length} upcoming` },
    {
      lab: 'Replies',
      val: t.replies_in ?? 0,
      sub: `${t.replies_interested ?? 0} interested · ${t.replies_pass ?? 0} pass`,
    },
    { lab: 'Docs received', val: t.docs_in ?? 0, sub: 'today' },
    { lab: 'Investors added', val: t.investors_added ?? 0, sub: 'today' },
    {
      lab: 'Errors',
      val: t.errors ?? 0,
      sub: `${usd(t.cost_usd_today)} spent`,
      bad: (t.errors ?? 0) > 0,
    },
  ];

  const alerts = [
    ...errors.map((e) => ({
      sev: 'c',
      title: `${e.workflow} failed${e.entity_name ? ` on ${e.entity_name}` : ''}`,
      detail: e.error_msg ?? 'No error message recorded.',
      when: ago(e.ran_at),
    })),
    ...silent.map((s) => ({
      sev: 'w',
      title: `${s.name} — ${s.meetings_all_time === 0 ? 'no meetings ever' : 'nothing sent recently'}`,
      detail:
        s.last_send === null
          ? 'Nothing has ever been sent for this startup.'
          : `Last send ${date(s.last_send)}. ${num(s.meetings_all_time)} meetings all time.`,
      when: s.days_since_send ? `${s.days_since_send} days` : 'never sent',
    })),
    ...noReset.map((s) => ({
      sev: 'w',
      title: `${s.name} — reset ask not recorded`,
      detail: `Bucket ${s.bucket}, still asking ₹${s.ask_current_cr} Cr. The matcher uses the current ask until the reset is written.`,
      when: 'open',
    })),
  ].slice(0, 10);

  return (
    <div className="wrap">
      <Header />

      <div className="sec">
        <div className="sechead">
          <h2>Today</h2>
          <div className="note">from v_today</div>
        </div>
        <div className="tiles">
          {tiles.map((x) => (
            <div key={x.lab} className={`tile${x.bad ? ' bad' : ''}`}>
              <div className="lab">{x.lab}</div>
              <div className="val">{num(x.val)}</div>
              <div className="sub">{x.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>Upcoming meetings</h2>
          <div className="note">{upcoming.length} scheduled</div>
        </div>
        <div className="card tscroll">
          {upcoming.length === 0 ? (
            <div className="empty">Nothing on the calendar ahead.</div>
          ) : (
            <table>
              <thead>
                <tr><th>When</th><th>Startup</th><th>Investor</th><th>Owner</th><th>Second</th><th>Link</th></tr>
              </thead>
              <tbody>
                {upcoming.map((m) => (
                  <tr key={m.id}>
                    <td className="num">{date(m.scheduled_at)} {time(m.scheduled_at)}</td>
                    <td>
                      {m.startup_id
                        ? <Link href={`/startup/${m.startup_id}`}>{m.startup}</Link>
                        : <span title="not in the startup book">{m.startup ?? 'Thesis call'}</span>}
                      {m.bucket === 'HOT10' ? <span className="pill acc" style={{ marginLeft: 6 }}>Hot</span> : null}
                    </td>
                    <td>{m.investor_id
                      ? <Link href={`/investor/${m.investor_id}`}>{m.investor}</Link>
                      : <span title="not in the investor book">{m.investor ?? '—'}</span>}</td>
                    <td>{m.owner_name ?? '—'}</td>
                    <td>{m.is_second ? 'Yes' : '—'}</td>
                    <td>{m.meet_link ? <a href={m.meet_link}>join</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>Hot deals</h2>
          <div className="note">the 11, ranked by meetings</div>
        </div>
        <div className="card tscroll">
          {hot.length === 0 ? (
            <div className="empty">No hot deals flagged.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Startup</th><th>Owner</th><th>Ask</th><th>Sent</th><th>Replied</th><th>Meetings</th><th>2nd</th><th>Last send</th></tr>
              </thead>
              <tbody>
                {hot.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/startup/${s.id}`}>{s.name}</Link></td>
                    <td>{s.owner_name ?? '—'}</td>
                    <td className="num">{s.ask_current_cr === null ? '—' : cr(s.ask_current_cr)}</td>
                    <td className="num">{num(s.sent)}</td>
                    <td className="num">{num(s.replied)}</td>
                    <td className="num">{num(s.meetings)}</td>
                    <td className="num">{num(s.second_meetings)}</td>
                    <td className="num">{s.last_send ? date(s.last_send) : 'never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>Live conversations</h2>
          <div className="note">most recent investor replies</div>
        </div>
        <div className="card tl">
          {replies.length === 0 ? (
            <div className="empty">No replies recorded.</div>
          ) : (
            replies.map((r, i) => (
              <div className="tlrow" key={i}>
                <div className="tld">{date(r.received_at)}</div>
                <div className="tlm">
                  <b>{label(r.kind)}</b>
                  {' · '}
                  {r.investor_id ? <Link href={`/investor/${r.investor_id}`}>{r.investor}</Link> : r.investor}
                  {r.startup_id ? <> on <Link href={`/startup/${r.startup_id}`}>{r.startup}</Link></> : null}
                  {r.reason ? <span className="dim"> — {r.reason}</span> : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>Investors added</h2>
          <div className="note">last 7 days</div>
        </div>
        <div className="card tscroll">
          {newInv.length === 0 ? (
            <div className="empty">No new investors in the last week.</div>
          ) : (
            <table>
              <thead><tr><th>Added</th><th>Investor</th><th>Contact</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                {newInv.map((v) => (
                  <tr key={v.id}>
                    <td className="num">{date(v.created_at)}</td>
                    <td><Link href={`/investor/${v.id}`}>{v.name}</Link></td>
                    <td>{v.contact_person ?? '—'}</td>
                    <td>{label(v.type)}</td>
                    <td>{label(v.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>Needs attention</h2>
          <div className="note">{alerts.length} open</div>
        </div>
        <div className="card">
          {alerts.length === 0 ? (
            <div className="empty">Nothing flagged.</div>
          ) : (
            alerts.map((a, i) => (
              <div className="alert" key={i}>
                <span className={`dot ${a.sev}`} />
                <div style={{ minWidth: 0 }}>
                  <div className="at">{a.title}</div>
                  <div className="ad">{a.detail}</div>
                </div>
                <div className="aw">{a.when}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>What the AI did</h2>
          <div className="note">{usd(t.cost_usd_today)} today</div>
        </div>
        <div className="card log">
          {logs.length === 0 ? (
            <div className="empty">
              Nothing logged yet. Import LOG-AI-ACTION into n8n and call it after each AI node.
            </div>
          ) : (
            logs.map((l) => (
              <div key={l.id} className={`lrow${!l.ok ? ' err' : ''}${l.action === 'skipped' ? ' skip' : ''}`}>
                <div className="lt">{time(l.ran_at)}</div>
                <div className="lw">{l.workflow}</div>
                <div className="lm">
                  {label(l.action)}
                  {l.entity_name ? <> <b>{l.entity_name}</b></> : null}
                  {l.decision ? <span className="dim"> · {l.decision}</span> : null}
                  {l.reasoning ? <span className="dim"> — {l.reasoning}</span> : null}
                  {l.error_msg ? <span className="dim"> — {l.error_msg}</span> : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="foot">
        Reads the book and the AI log directly. Opening this page runs no AI and costs nothing.{' '}
        <Link href="/">Refresh</Link>
      </div>
    </div>
  );
}
