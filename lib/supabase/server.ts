import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_KEY } from './config';

/**
 * Server-side Supabase client, bound to the signed-in user's cookies.
 *
 * Every query made through this client runs as that user, so the Row Level
 * Security policies in the schema decide what comes back. There is no
 * service-role client in this app on purpose: if a page returns nothing, the
 * fix is the user's role or the policy, never a key that bypasses both.
 */
export function createClient() {
  const store = cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            store.set({ name, value, ...options });
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session instead.
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            store.set({ name, value: '', ...options });
          } catch {
            // Same as above.
          }
        },
      },
    }
  );
}
