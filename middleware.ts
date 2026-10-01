import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session on every request and gates the app.
 * Anything other than /login requires a session. There is no signup route.
 */
export async function middleware(request: NextRequest) {
  try {
    return await run(request);
  } catch (e: any) {
    // TEMPORARY: the Worker was returning a blank 500 on every route with no
    // way to see why. Remove once the cause is fixed.
    return new Response(
      JSON.stringify(
        {
          where: 'middleware',
          error: `${e?.name}: ${e?.message}`,
          stack: String(e?.stack ?? '').split(String.fromCharCode(10)).slice(0, 8),
          urlSeen: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
          keyLen: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').length,
        },
        null,
        2
      ),
      { status: 500, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
    );
  }
}

async function run(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const onLogin = request.nextUrl.pathname.startsWith('/login');

  if (!data.user && !onLogin) {
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    return NextResponse.redirect(to);
  }
  if (data.user && onLogin) {
    const to = request.nextUrl.clone();
    to.pathname = '/';
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|diag).*)'],
};
