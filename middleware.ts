import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase/config';

/**
 * Refreshes the Supabase session on every request and gates the app.
 * Anything other than /login requires a session. There is no signup route.
 */
export async function middleware(request: NextRequest) {
  // A clear failure beats a blank 500 if the config is ever empty again.
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response('Supabase is not configured for this deployment.', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    });
  }
  return run(request);
}

async function run(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
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
