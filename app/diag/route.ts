import { createServerClient } from '@supabase/ssr';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY. Reports why the Worker is failing, without going through
 * middleware (the matcher skips this path). Delete once the 500 is fixed.
 */
export async function GET(request: Request) {
  const out: Record<string, unknown> = {};
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  out.urlSeen = url ?? null;
  out.urlType = typeof url;
  out.keyLen = key ? String(key).length : 0;
  out.runtime = typeof navigator !== 'undefined' ? String((navigator as any).userAgent) : 'unknown';

  try {
    out.newUrlOrigin = new URL(String(url)).origin;
  } catch (e: any) {
    out.newUrlError = `${e?.name}: ${e?.message}`;
  }

  try {
    const client = createServerClient(String(url), String(key), {
      cookies: { get: () => undefined, set: () => {}, remove: () => {} },
    });
    out.clientConstructed = true;
    const { error } = await client.auth.getUser();
    out.getUserError = error ? `${error.name}: ${error.message}` : null;
  } catch (e: any) {
    out.clientError = `${e?.name}: ${e?.message}`;
    out.clientStack = String(e?.stack ?? '').split('\n').slice(0, 6).join(' | ');
  }

  return new Response(JSON.stringify(out, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
