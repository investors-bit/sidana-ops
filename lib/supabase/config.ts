/**
 * The Supabase URL and publishable key, trimmed, in one place.
 *
 * The trim is the whole point. The value configured in Cloudflare carried two
 * trailing spaces. `new URL()` tolerates that, so the URL always looked
 * correct, but supabase-js concatenates the base string with a path before
 * parsing it, which put the spaces in the middle of the URL and threw
 * "TypeError: Invalid URL string." Middleware runs on every route, so every
 * page returned a blank 500 — including /login, which made it look like a
 * build or environment problem rather than two characters of whitespace.
 *
 * Reading through this module means a dirty value configured anywhere
 * (dashboard, wrangler.toml, .env.local) cannot break the app again.
 */
function clean(v: string | undefined): string {
  return (v ?? '').trim().replace(/\/+$/, '');
}

export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export const SUPABASE_KEY = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  ''
).trim();
