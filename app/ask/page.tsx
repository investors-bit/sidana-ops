import Link from 'next/link';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { cr, date, label, num } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

type Row = Record<string, any>;

/** The questions people actually ask out loud, each one a filter over the
 *  board rather than a separate report nobody remembers to open. */
const QUESTIONS = [
  { key: 'owed', q: 'Who is waiting on us?', hint: 'they replied, nobody answered' },
  { key: 'silent', q: 'What has gone quiet?', hint: 'nothing sent in 21 days' },
  { key: 'nomeeting', q: 'Which deals have no meeting?', hint: 'sent, but never met anyone' },
  { key: 'noupcoming', q: 'Who has nothing booked?', hint: 'live, with an empty calendar' },
  { key: 'stale', q: 'Whose raise is stale?', hint: 'not confirmed in 30 days' },
  { key: 'hot', q: 'How are the hot deals doing?', hint: 'the 11, by meetings' },
] as const;

type Key = (typeof QUESTIONS)[number]['key'];

export default async function Ask({ searchParams }: { searchParams?: { q?: string } }) {
  const supabase = createClient();
  const key: Key = (QUESTIONS.find((x) => x.key === searchParams?.q)?.key ?? 'owed') as Key;

  const [boardRes, owedRes] = await Promise.all([
    supabase.from('v_startup_board').select('*').limit(300),
    supabase
      .from('v_owed_replies')
      .select('*')
      .order('days_waiting', { ascending: false })
      .limit(400),
  ]);

  const board: Row[] = boardRes.data ?? [];
  const owed: Row[] = owedRes.data ?? [];
  const live = board.filter((s) => s.status !== 'closed' && s.status !== 'mandate_closed');

  const picked = QUESTIONS.find((x) => x.key === key)!;

  // Each question is a projection of the same board, so the counts on the
  // chips and the rows in the table can never disagree.
  const sets: Record<Key, Row[]> = {
    owed,
    silent: live.filter((s) => s.days_since_send === null || s.days_since_send >= 21),
    nomeeting: live.filter((s) => Number(s.sent) > 0 && Number(s.meetings) === 0),
    noupcoming: live.filter((s) => !s.has_upcoming),
    stale: live.filter(
      (s) => !s.ask_updated_on || new Date(s.ask_updated_on) < new Date(Date.now() - 30 * 86400000)
    ),
    hot: board
      .filter((s) => s.bucket === 'HOT10')
      .sort((a, b) => Number(b.meetings) - Number(a.meetings)),
  };

  const rows = sets[key] ?? [];

  return (
    <div className="wrap">
      <Header />
      <Link href="/" className="back">← Today</Link>

      <div className="dhead">
        <div className="dtitle"><h1>Ask</h1></div>
      </div>

      <div className="filters">
        {QUESTIONS.map((x) => (
          <Link
            key={x.key}
            href={`/ask?q=${x.key}`}
            className={`chip${x.key === key ? ' on' : ''}`}
            scroll={false}
          >
            {x.q} <span className="qn">{num((sets[x.key] ?? []).length)}</span>
          </Link>
        ))}
      </div>

      <div className="sec">
        <div className="sechead">
          <h2>{picked.q}</h2>
          <div className="note">{rows.length} · {picked.hint}</div>
        </div>
        <div className="card tscroll">
          {rows.length === 0 ? (
            <div className="empty">Nothing matches. That is the good answer here.</div>
          ) : key === 'owed' ? (
            <table>
              <thead>
                <tr><th>Waiting</th><th>Investor</th><th>Startup</th><th>They said</th><th>Last message</th><th>Owner</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i}>
                    <td className="num">
                      <b>{r.days_waiting}</b> {r.days_waiting === 1 ? 'day' : 'days'}
                    </td>
                    <td>
                      {r.investor_id
                        ? <Link href={`/investor/${r.investor_id}`}>{r.investor}</Link>
                        : <span className="dim">unknown</span>}
                    </td>
                    <td>
                      {r.startup_id
                        ? <Link href={`/startup/${r.startup_id}`}>{r.startup}</Link>
                        : <span className="dim">no deal</span>}
                    </td>
                    <td>
                      {r.kind
                        ? <span className={`pill ${r.kind === 'pass' ? 'c' : r.kind === 'interested' ? 'g' : ''}`}>{label(r.kind)}</span>
                        : <span className="dim">—</span>}
                    </td>
                    <td className="txt">{r.subject ?? '—'}</td>
                    <td>{r.owner_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr><th>Startup</th><th>Owner</th><th>Raising</th><th>Sent</th><th>Replied</th><th>Meetings</th><th>Owed</th><th>Last send</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/startup/${s.id}`}>{s.name}</Link>
                      {s.bucket === 'HOT10' ? <span className="pill acc" style={{ marginLeft: 6 }}>Hot</span> : null}
                    </td>
                    <td>{s.owner_name ?? '—'}</td>
                    <td className="num">{s.ask_as_written ?? '—'}</td>
                    <td className="num">{num(s.sent)}</td>
                    <td className="num">{num(s.replied)}</td>
                    <td className="num">{num(s.meetings)}</td>
                    <td className="num">{Number(s.owed_replies) > 0 ? <b>{s.owed_replies}</b> : '—'}</td>
                    <td className="num">
                      {s.last_send ? date(s.last_send) : 'never'}
                      {s.days_since_send !== null && s.days_since_send >= 21
                        ? <span className="dim"> · {s.days_since_send}d</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {rows.length > 200 && (
          <div className="winnote">Showing the first 200 of {rows.length}.</div>
        )}
      </div>
    </div>
  );
}
