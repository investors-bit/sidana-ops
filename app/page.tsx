import Link from 'next/link';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { ago, date, label, num, time, usd } from '@/lib/format';

export const dynamic = 'force-dynamic';
// Cloudflare Pages runs Next on the edge runtime, not Node.
export const runtime = 'edge';

type Row = Record<string, any>;

export default async function Today() {
  const supabase = createClient();

  const [todayRes, logRes, silentRes, resetRes, errRes] = await Promise.all([
    supabase.from('v_today').select('*').maybeSingle(),
    supabase.from('ai_log').select('*').order('ran_at', { ascending: false }).limit(15),
    supabase.from('v_silent_startups').select('*').limit(6),
    supabase
      .from('startups')
      .select('id,name,bucket,ask_current_cr')
      .in('bucket', ['A', 'B'])
      .is('ask_reset_cr', null)
      .limit(6),
    supabase
      .from('ai_log')
      .select('*')
      .eq('ok', false)
      .order('ran_at', { ascending: false })
      .limit(5),
  ]);

  const t: Row = todayRes.data ?? {};
  const logs: Row[] = logRes.data ?? [];
  const silent: Row[] = silentRes.data ?? [];
  const noReset: Row[] = resetRes.data ?? [];
  const errors: Row[] = errRes.data ?? [];

  const tiles = [
    { lab: 'Deals sent', val: t.deals_sent ?? 0, sub: 'today' },
    {
      lab: 'Meetings booked',
      val: t.meetings_booked ?? 0,
      sub: `${t.second_meetings ?? 0} second meetings`,
    },
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
              <div
                key={l.id}
                className={`lrow${!l.ok ? ' err' : ''}${l.action === 'skipped' ? ' skip' : ''}`}
              >
                <div className="lt">{time(l.ran_at)}</div>
                <div className="lw">{l.workflow}</div>
                <div className="lm">
                  {label(l.action)}
                  {l.entity_name ? (
                    <>
                      {' '}
                      <b>{l.entity_name}</b>
                    </>
                  ) : null}
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
