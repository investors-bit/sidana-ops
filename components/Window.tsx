import Link from 'next/link';

/** Time windows for the history views. Rolling, not calendar, so the label
 *  never lies: "Last 7 days" means exactly that on any day of the week. */
export const WINDOWS = [
  { key: 'week', label: 'Last 7 days', days: 7 },
  { key: 'month', label: 'Last 30 days', days: 30 },
  { key: 'q', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
] as const;

export type WindowKey = (typeof WINDOWS)[number]['key'];

export type Win = { key: WindowKey; label: string; since: string | null };

export function readWindow(v: string | string[] | undefined): Win {
  const k = Array.isArray(v) ? v[0] : v;
  const w = WINDOWS.find((x) => x.key === k) ?? WINDOWS[WINDOWS.length - 1];
  return {
    key: w.key,
    label: w.label,
    since: w.days === null ? null : new Date(Date.now() - w.days * 86400000).toISOString(),
  };
}

/** Keeps rows whose timestamp falls inside the window. A row with no
 *  timestamp is kept only on "All time" — guessing a date would invent one. */
export function inWindow<T extends Record<string, any>>(rows: T[], field: string, win: Win): T[] {
  if (win.since === null) return rows;
  return rows.filter((r) => typeof r[field] === 'string' && r[field] >= win.since!);
}

export default function WindowBar({ base, active }: { base: string; active: WindowKey }) {
  return (
    <div className="filters">
      {WINDOWS.map((w) => (
        <Link
          key={w.key}
          href={w.key === 'all' ? base : `${base}?win=${w.key}`}
          className={`chip${w.key === active ? ' on' : ''}`}
          scroll={false}
        >
          {w.label}
        </Link>
      ))}
    </div>
  );
}
