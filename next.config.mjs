/** @type {import('next').NextConfig} */

// The Supabase URL and publishable key are inlined at BUILD time rather than
// read from the environment at request time.
//
// Why: on Cloudflare Pages the middleware and edge routes were getting an
// empty value and every request died with "TypeError: Invalid URL string"
// inside the Supabase client. Setting them as Cloudflare build variables and
// as [vars] in wrangler.toml both failed to reach the running Worker.
// Inlining removes the runtime lookup altogether, so there is nothing left to
// misconfigure.
//
// Safe to hardcode: both values are public by design and are served to every
// browser that opens the site. `.env.local` still overrides them locally.
// The service_role / secret key is NOT here and must never be; it lives in
// n8n only, because it bypasses every RLS policy in the schema.
const SUPABASE_URL = 'https://elwaquzawoscotlojtnv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0Uoh7ZQjv_yq9swBZO8eLQ_zi6I7-Q7';

const pick = (...v) => {
  for (const x of v) {
    const t = String(x ?? '').trim();
    if (t) return t;
  }
  return '';
};

const nextConfig = {
  reactStrictMode: true,
  env: {
    // pick() trims. The configured value in Cloudflare had trailing spaces,
    // and baking those into the bundle is what broke every route.
    NEXT_PUBLIC_SUPABASE_URL: pick(process.env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: pick(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      SUPABASE_PUBLISHABLE_KEY
    ),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_PUBLISHABLE_KEY
    ),
  },
};

export default nextConfig;
