import Link from 'next/link';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { date, label, num, time } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

type Row = Record<string, any>;

const KIND = {
  meeting: 'Meeting',
  reply: 'Reply',
  investor_added: 'Investor added',
  funding: 'Round closed',
} as Record<string, string>;

export default async function Changes() {
  const supabase = createClient();
  const { data } = await supabase
    .from('v_changes_7d')
    .select('*')
    .order('at', { ascending: false })
    .limit(500);

  const rows: Row[] = data ?? [];
  const counts = rows.reduce<Record<string, number>>((o, r) => {
    o[r.kind] = (o[r.kind] ?? 0) + 1;
    return o;
  }, {});

  // Grouped by day so a week reads as a week, not as one long list.
  const byDay = new Map<string, Row[]>();
  for (const r of rows) {
    const d = String(r.at ?? '').slice(0, 10);
    if (!d) continue;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(r);
  }

  return (
    <div className="wrap">
      <Header />
      <Link href="/" className="back">← Today</Link>

      <div className="dhead">
        <div className="dtitle"><h1>What changed</h1></div>
        <div className="pills">
          {Object.keys(KIND).map((k) =>
            counts[k] ? <span className="pill" key={k}>{num(counts[k])} {KIND[k].toLowerCase()}</span> : null
          )}
        </div>
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>Last 7 days</h2>
          <div className="note">{rows.length} events</div>
        </div>

        {byDay.size === 0 ? (
          <div className="card"><div className="empty">Nothing moved this week.</div></div>
        ) : (
          [...byDay.entries()].map(([d, list]) => (
            <div key={d} style={{ marginBottom: 14 }}>
              <div className="daybar">{date(d)} <span className="dim">· {list.length}</span></div>
              <div className="card tl">
                {list.map((r, i) => (
                  <div className="tlrow" key={i}>
                    <div className="tld">{time(r.at)}</div>
                    <div className="tlm">
                      <span className={`pill ${r.kind === 'funding' ? 'g' : r.kind === 'reply' ? 'acc' : ''}`}>
                        {KIND[r.kind] ?? label(r.kind)}
                      </span>{' '}
                      {r.startup_id
                        ? <Link href={`/startup/${r.startup_id}`}>{r.startup}</Link>
                        : r.startup ? <span>{r.startup}</span> : null}
                      {r.startup && r.investor ? ' × ' : null}
                      {r.investor_id
                        ? <Link href={`/investor/${r.investor_id}`}>{r.investor}</Link>
                        : r.investor ? <span>{r.investor}</span> : null}
                      {r.detail ? <span className="dim"> — {r.detail}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
