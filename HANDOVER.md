# Sidana Ops Console — handover

You are taking over this project. Read this file before touching anything.
It was written the night the project was built, 30 September 2026, by the
Claude session that built it. That session could not reach npm, Supabase or
n8n, so everything runtime now runs through you on this laptop.

---

## 1. What this is

An internal dashboard for Sidana Ventures, a Gurugram investment banking and
deal-distribution firm. Two people run the operation: Abhilasha Saini (owner,
AI systems and the top 10 deals) and Rakesh Sidana (founder). A third person
runs the angel desk.

It exists because nobody could answer basic questions about their own system.
"How many deals did we send in September" had two irreconcilable answers, 476
and 2,500, and no way to settle it. "Which startups got zero meetings" required
manual spreadsheet work. "What did the AI do last night" required asking an AI,
which burns tokens and cannot actually know, because it has no memory of what
n8n ran.

The dashboard answers those from a database instead. Opening it runs no AI and
costs nothing.

---

## 2. How it works

```
Google Sheets  ──(n8n)──>  Supabase  ──(Next.js app)──>  browser
   the book                the store        localhost:3000
```

- **Google Sheets** is still the source of truth for the book. n8n's
  ENGINE-DAILY reads it.
- **Supabase** (Postgres) holds the book plus everything the system does:
  sends, meetings, replies, docs, and an AI activity log.
- **The Next.js app** reads Supabase live on every page load. No caching.
  Every query runs as the signed-in user, so Row Level Security decides what
  comes back.

**The critical gap right now: nothing writes to Supabase.** The book was loaded
once. n8n still writes only to Sheets. Until `PROMPT-wire-n8n.txt` is done, the
dashboard shows a snapshot, not a system.

### Pages

| Route | Shows |
|---|---|
| `/login` | Email and password. No signup route exists, by design |
| `/` | Today's tiles from `v_today`, a needs-attention list, the AI activity feed |
| `/startup/[id]` | Round facts, the distribution funnel, matched investors, meetings, docs, AI activity |
| `/investor/[id]` | Thesis fields, engagement funnel, deals, replies |

Search sits in the header on every page and queries `startups` and `investors`
directly from the browser client. RLS applies there too.

---

## 3. Decisions, and why

**Supabase over Airtable or staying in Sheets.** Sheets crawls past ~50k rows
and the match table alone is 20k. Supabase's free tier covers this for years,
has real SQL, an MCP server, and is the same database a founder/investor portal
would later use. No migration when that happens.

**Roles in the schema from day one, even though only `owner` is used.**
Retrofitting roles means rewriting every query. `founder` and `investor` exist
in the enum and in the RLS policies but no page uses them yet.

**RLS, not UI hiding.** Hiding a section in the browser is cosmetic. Every
table has policies; the database refuses the query. This is why the app has no
service-role client — if a page returns nothing, the fix is the user's role in
`app_users` or the policy, never a key that bypasses both.

**No signup route.** Accounts are created by an owner in the Supabase
dashboard. Anyone who finds the URL must not be able to register.

**Cloudflare Pages, not Vercel, when this gets a URL.** Vercel's free tier
prohibits commercial use and this is a commercial internal tool. Cloudflare's
does not.

**Reversed: the invitation email flow.** Supabase invite links are single-use
and redirect to `localhost:3000`, which was not running. The link was consumed
and expired. Both accounts were recreated with **Authentication → Add user →
Create new user**, with a password typed directly and Auto Confirm ticked.
Do not go back to invitations for internal accounts.

**Reversed: seeding from the September spreadsheets.** See section 7.

---

## 4. Numbers that govern things

| Thing | Value | Note |
|---|---|---|
| Startups in the live book | ~68 | The Sept snapshot said 61. Stale |
| Investors in the live book | ~303 | The Sept snapshot said 182. Stale |
| Meetings, 1–29 September | 55 | ~2.6 per working day |
| Monthly meeting run rate | ~55 | Target was 200 |
| Deals sent per month | **Unknown — 476 or 2,500** | The whole reason `shares` exists |
| Active mandates | 66 | Each promised 10 investor meetings |
| Meetings owed to deliver the guarantee | 660 | ~12 months at the current rate |
| Usable angels | 11 | Against 19 bucket A startups |
| Micro-VCs in the book | 4 | Against 18 bucket B startups, all blocked on a lead |
| Investors at PENDING | 58 | No thesis call. Convert at ~1/6 the rate of engaged ones |
| Bucket A | ≤ ₹1.5 Cr | Angels only, no lead needed |
| Bucket B | ₹1.5–4 Cr | One micro-VC leads, angels fill |
| Bucket C | > ₹4 Cr | A VC must lead |

Buckets are set on the **reset** ask, not the current ask. A startup whose
reset was agreed but never written to the profile is still matched on its old
ask — that is a real, recurring bug in their process, and `ask_reset_cr` being
NULL on a bucket A or B startup is surfaced on the dashboard for that reason.

---

## 5. Current state

**Live and working**
- Supabase project `elwaquzawoscotlojtnv`, schema applied, RLS on every table
- Two owner accounts: `investors@sidanaventures.com`, `rakesh@sidanaventures.com`
- The app runs on `localhost:3000`, login works, pages render

**Done but unverified by its author**
- Every source file. The session that wrote them could not run a compiler —
  npm returns 403 in that sandbox. You did the compile pass. Anything still
  odd in the code is likely from that.

**Not started**
- n8n writing to Supabase. `PROMPT-wire-n8n.txt` is the spec
- Deployment to a URL. Runs on localhost only
- `founder` and `investor` roles are in the schema but wired to nothing

**Waiting on a person**
- The live book load, if `PROMPT-load-book.txt` has not finished
- The Supabase service_role credential in n8n — only Abhilasha can create it

---

## 6. Open items

| Item | Why it matters |
|---|---|
| **ENGINE-DAILY → `shares`** | Until every send is recorded, the 476-vs-2,500 question stays unanswerable, and so does conversion. This is the single highest-value task in the project |
| **SYNC-BOOK hourly** | Without it the book goes stale again in three weeks, exactly as the September snapshot did |
| **`LOG-AI-ACTION` on every AI node** | The activity feed is empty until this exists. Log **skips** especially — a startup silently getting nothing every night appears there and nowhere else |
| Two wrong chips in `components/Search.tsx` | `Spintly` and `Bon Cuisine` were invented sample names and are probably not in the real book. Replace with real ones once the live load lands |
| `investors_usable` count | Expected to be far below 303. That number is how much of the book the matcher can actually act on |
| Deployment | Cloudflare Pages + a CNAME for `ops.sidanaventures.com` |

---

## 7. Gotchas — read this section twice

**The September seed is stale and must never be run.** `seed.sql` in this
folder was generated from spreadsheets uploaded on 21 September: 61 startups,
182 investors. The live book is 68 and 303. It also overwrites `ask_reset_cr`
with values agreed three weeks ago. Delete it if that is safer.

**Duplicate names break the import.** Postgres rejects
`ON CONFLICT DO UPDATE cannot affect row a second time` when two rows with the
same key reach one statement. This killed the first seed. Three investors
appear twice in the source: **Accel**, **Capital-A**, **Yali Capital**. Always
deduplicate by name before building an upsert, and log what you dropped.

**A failed seed rolls back completely.** It is wrapped in a transaction, so a
failure leaves nothing partial. Tables reading as empty after an error is
expected, not a second problem.

**The `Group` column is not the bucket.** In `MatchReport…xlsx / Summary`,
`Group` holds `Under 5` / `5+` — a meetings tier, not bucket A/B/C. Buckets
come from the reset ask, or from the agreed list. An earlier build prompt got
this wrong.

**Spreadsheet headers sit at different offsets.** `Summary` skips 4 rows,
`Proposed new pairs` skips 3, `Meetings source` skips 2, `Composition list`
skips 2, the per-type sheets skip 3. Never assume row 1.

**Investor type lives only in the composition workbook.** `Investors.xlsx` has
no type column. Angel / network / micro-VC / seed fund / institutional comes
from which sheet of `InvestorCompositionList` the name appears on.

**Env var naming.** Supabase now issues a *publishable* key, not *anon*. The
three client files accept either:
`process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
Keep that fallback if you touch them.

**A half-filled investor record is worse than an empty one.** The view
`investors_usable` excludes records missing sectors, stage_pref or either
cheque bound. That is deliberate. Never fill a missing field with a guess or a
default to make a record "complete" — it will be matched against and waste
sends. Leave it NULL and log the row.

---

## 8. Files

Everything is in `C:\Users\Aditya\Downloads\sidana-ops`.

| File | What |
|---|---|
| `sidana-schema.sql` | The schema. **Already applied.** Read for column names, do not change |
| `seed.sql` | Stale September snapshot. Do not run |
| `PROMPT-load-book.txt` | Loading the live book from Sheets into Supabase |
| `PROMPT-wire-n8n.txt` | Making n8n write into Supabase. The main remaining work |
| `LOG-AI-ACTION.json` | n8n workflow, ready to import |
| `daily-digest.json` | n8n workflow, 9am email, built with code — no AI, no tokens |
| `README.md` | Setup and role-adding instructions |
| `.env.local` | Project URL and publishable key. **Never put the service key here** |
| `app/`, `components/`, `lib/`, `middleware.ts` | The app |

Supabase project URL: `https://elwaquzawoscotlojtnv.supabase.co`

### Views worth knowing

| View | Answers |
|---|---|
| `v_today` | The daily tiles |
| `v_startup_funnel` | Sent → opened → replied → meetings → second meetings, per startup |
| `v_investor_cohorts` | Meetings produced per month-added cohort. Whether recruiting works |
| `v_silent_startups` | Startups with no meetings ever, or nothing sent in 21 days |
| `investors_usable` | Only investors with all four thesis fields filled |

---

## 9. Security — non-negotiable

1. **Only the publishable/anon key reaches the browser.** The `service_role` /
   secret key must never appear in this folder, in `.env.local`, in a component,
   or in anything under `app/`. It bypasses every policy in the schema and
   would expose the entire investor book to anyone who opens the site.
2. **The service key belongs in n8n only**, as a Header Auth credential.
3. **Never disable or work around RLS.** If a query returns nothing, fix the
   role or the policy.
4. **No signup route, ever.**
5. Do not commit `.env`. `.gitignore` already covers it.

---

## 10. What I would do first

1. **Confirm the book loaded.** `select count(*) from startups; select count(*)
   from investors; select count(*) from investors_usable;` — expect ~68, ~303,
   and a third number well below 303. If the third is near 303, the import
   filled blanks with guesses and needs redoing.
2. **ENGINE-DAILY → `shares`.** One node. It starts the clock on real
   conversion data, and every day it is not done is a day of data lost.
3. **SYNC-BOOK hourly.** Stops the book going stale again.
4. **`LOG-AI-ACTION` on every AI node, skips included.** This is what makes the
   dashboard worth opening.
5. **Fix the two wrong search chips** once you know real startup names.

Items 2 and 3 are roughly 90% of the remaining value. Items 4 onward can wait a
week without harm.

---

## 11. How to work with Abhilasha

Short, direct messages. Tables and specific figures land well; hedging does
not. She will push back when a number looks wrong and she is usually right —
she caught the stale 61/182 figures tonight when this session had accepted them.

Show the column mapping before writing rows. Stop after each step rather than
running a long chain. Say plainly when something cannot be done and why, rather
than working around it quietly.
