/** Display helpers. Indian number grouping, Asia/Kolkata dates. */

export function cr(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v)} Cr`;
}

export function lakh(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v)} L`;
}

export function num(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-IN').format(v);
}

export function usd(v: number | null | undefined): string {
  if (v === null || v === undefined) return '$0.00';
  return `$${v.toFixed(2)}`;
}

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
});
const TIME = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
});

export function date(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : DATE.format(d);
}

export function time(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : TIME.format(d);
}

/** "4 days", "today", "19 days" — for how long something has been open. */
export function ago(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/** Bucket, status and other enum values as they should read on screen. */
export function label(v: string | null | undefined): string {
  if (!v) return '—';
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Semantic tone for a status pill. */
export function tone(status: string | null | undefined): string {
  switch (status) {
    case 'term_sheet':
    case 'closed':
    case 'a1_ready':
    case 'engaged':
    case 'active':
      return 'g';
    case 'blocked':
    case 'a2_waiting':
    case 'do_not_contact':
      return 'c';
    case 'silent':
    case 'pending':
    case 'paused':
      return 'w';
    default:
      return '';
  }
}
