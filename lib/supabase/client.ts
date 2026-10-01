import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_KEY } from './config';

/** Browser client. Used only by the login form. Anon key only. */
export function createClient() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );
}
