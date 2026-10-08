# Sidana Ops Console

Internal dashboard for the deal pipeline, the investor book and what the AI did.
Next.js + Supabase. Login required, roles enforced at the database.

---

## First run

Open Command Prompt in this folder, then:

```
npm install
npm run dev
```

Open http://localhost:3000 and sign in.

`.env.local` already has your Supabase URL and publishable key. Nothing to fill in.

---

## If it does not compile

The code was written without being able to run a compiler, so a type error or a
missing import is possible. Open Claude Code in this folder and say:

> Run npm install and npm run dev. Fix any compile or type errors. Do not
> change the database schema, the page layouts or the queries — only fix what
> stops it building.

---

## What is where

| Path | What |
|---|---|
| `app/page.tsx` | Today view — tiles, needs-attention, AI activity feed |
| `app/startup/[id]/page.tsx` | One startup: round, funnel, investors, meetings, docs, AI activity |
| `app/investor/[id]/page.tsx` | One investor: thesis, engagement, deals, replies |
| `app/login/page.tsx` | Email and password. No signup by design |
| `components/Search.tsx` | Header search across startups and investors |
| `lib/supabase/server.ts` | Server client, bound to the signed-in user so RLS applies |
| `lib/format.ts` | Indian number grouping, Asia/Kolkata dates |
| `middleware.ts` | Session refresh and the auth gate |
| `LOG-AI-ACTION.json` | n8n workflow — call after every AI node so it records itself |
| `daily-digest.json` | n8n workflow — 9am email summary, no AI involved |

---

## Security

Only `NEXT_PUBLIC_SUPABASE_URL` and the publishable key are in this app. The
`service_role` / secret key is **not here and must never be**. It belongs in
n8n only.

Protection comes from Row Level Security in the database, not from the UI. If a
page shows nothing, the fix is the user's role in `app_users` or the policy —
never a key that bypasses both.

---

## Adding a person later

1. Supabase → Authentication → Users → **Add user → Create new user**, set a
   password, tick Auto Confirm
2. SQL Editor:

```sql
insert into app_users (id, email, full_name, role)
select id, email, 'Their Name', 'angel_desk'   -- or deals_desk, ops, owner
from auth.users where email = 'them@sidanaventures.com'
on conflict (id) do update set role = excluded.role, active = true;
```

Roles: `owner` and `ops` see everything. `deals_desk` sees Hot 10 and bucket C.
`angel_desk` sees buckets A and B and only angel, network, syndicate and
micro-VC investors. `founder` and `investor` exist in the schema but are not
wired to any page yet.

---

## Setting up the AI log (the part that matters)

The dashboard reads `ai_log`. Until n8n writes to it, the activity feed is empty.

1. In n8n, create a **Header Auth** credential:
   - Name: `Supabase service`
   - Header name: `apikey`
   - Header value: your Supabase **service_role / secret** key
2. Add a second header in the same credential if your n8n version allows, or add
   it per node: `Authorization: Bearer <same service key>`
3. Set an n8n environment variable `SUPABASE_URL` to
   `https://elwaquzawoscotlojtnv.supabase.co`
4. Import `LOG-AI-ACTION.json`
5. In ENGINE-DAILY, HOT-SCORE, DOC-CLASSIFY and REPLY-PARSE, add an **Execute
   Workflow** node after each AI step, pointing at LOG-AI-ACTION, passing:

   | Field | Example |
   |---|---|
   | `workflow` | `ENGINE-DAILY` |
   | `action` | `sent`, `scored`, `classified`, `skipped`, `error` |
   | `entity_name` | `Spintly` |
   | `decision` | `matched`, `STRONG`, `72` |
   | `reasoning` | why, in one or two sentences |
   | `cost_usd` | the call's cost if you have it |
   | `ok` | `false` on failure, with `error_msg` |

**The `skipped` rows are the valuable ones.** A startup silently getting nothing
every night shows up there and nowhere else.

6. Import `daily-digest.json` for the 9am email. Change the recipient if needed.

---

## Putting it on a URL

Cloudflare Pages, free for commercial use (Vercel's free tier is not).

1. Cloudflare → Workers & Pages → Create → Pages → connect the repo, or upload
2. Build command `npm run build`, output `.next`, framework preset Next.js
3. Add the two environment variables from `.env.local`
4. Add a CNAME for `ops.sidanaventures.com` pointing at the Pages domain

Until then it runs fine on `localhost:3000`.
