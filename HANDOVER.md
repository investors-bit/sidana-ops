# Sidana Ops Console — handover

You are taking over this project. Read this file before touching anything.

Written 7 October 2026, from a full read of the repository at commit `e95648c`.
It replaces the handover written on 30 September, which described the project
on its first night and is now wrong in several important places. Where this
file and the README disagree, this file is right — see §11.

---

## 1. What this is

An internal dashboard for Sidana Ventures, a Gurugram investment banking and
deal-distribution firm. Two people run the operation: Abhilasha Saini (owner,
AI systems and the top deals) and Rakesh Sidana (founder). A third person runs
the angel desk. Aditya appears throughout the automation docs as the person the
deal-flow routine reports to.

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
Google Sheets ──(n8n)──> Supabase ──(Next.js on Cloudflare Pages)──> browser
   the book              the store        edge runtime, no cache
       │
       └─ 6 Gmail mailboxes ──(n8n MAIL-HISTORY, hourly)──> mail_log
```

- **Google Sheets** is still the source of truth for the book. n8n's
  ENGINE-DAILY reads it.
- **Supabase** (Postgres, project `elwaquzawoscotlojtnv`) holds the book plus
  everything the system does: sends, meetings, replies, docs, closed rounds,
  raw mail both directions, and an AI activity log.
- **The Next.js app** reads Supabase live on every page load. Every page is
  `dynamic = 'force-dynamic'` and `runtime = 'edge'`. No caching anywhere.
  Every query runs as the signed-in user, so Row Level Security decides what
  comes back.

### Pages

| Route | Shows |
|---|---|
| `/login` | Email and password, plus a password-reset link. No signup route exists, by design |
| `/` | Today's tiles, upcoming meetings, hot deals, live conversations, investors added this week, needs-attention, AI activity feed |
| `/ask` | Six named questions as chips over one board: who is waiting on us, what has gone quiet, which deals have no meeting, who has nothing booked, whose raise is stale, how are the hot deals doing |
| `/changes` | Everything that moved in the last 7 days, grouped by day |
| `/startup/[id]` | Round facts, money already in, distribution funnel, the send queue, who has been sent to, every email, replies, meetings, docs, notes |
| `/investor/[id]` | Thesis on file, engagement funnel, deals shared, every email, meetings given, replies |

Search sits in the header on every page and queries `startups` and `investors`
directly from the browser client. RLS applies there too.

`components/Window.tsx` gives the two detail pages a rolling time window
(7 / 30 / 90 days / all time). It is rolling, not calendar, so the label never
lies, and a row with no timestamp survives only on "All time" — guessing a date
would invent one. Forward-looking sections ignore the window.

---

## 3. Current state, honestly

**Live and working**
- Supabase schema applied, RLS on every table, two owner accounts
  (`investors@sidanaventures.com`, `rakesh@sidanaventures.com`)
- Deployed to Cloudflare Pages. `wrangler.toml` is committed and configured;
  `npm run pages:build && npm run pages:deploy` is the path. The last four
  commits are deployment and edge-cache fixes, so this is real, not planned.
  **I could not verify the live URL from this environment** — the agent proxy
  refuses outbound connections to it. Confirm `ops.sidanaventures.com` yourself
  before telling anyone it is up.
- `npm install`, `npm run typecheck` and `npm run build` all pass clean, here,
  today. 426 packages, build exit 0, zero type errors. The README's warning
  that "the code was written without being able to run a compiler" is obsolete.
- n8n writes into Supabase: `mail_log` is populated hourly by MAIL-HISTORY,
  and the app reads real sends, real replies and real meetings. The 30
  September handover's "nothing writes to Supabase" is no longer true.

**Not done**
- `founder` and `investor` roles exist in the enum and in the RLS policies but
  no page uses them
- Writing the `task_heartbeat` row. The cloud deal-flow routine can read the
  database but not write it, so every run is a gap run (§6)
- The schema in this repo no longer matches the live database (§4, item 1)

---

## 4. The four things that would bite me first

### 1. `sidana-schema.sql` can no longer rebuild this database
This is the biggest risk in the repo. The schema file is the 30 September
original and was never updated as the app grew. Six objects the app queries on
every page load do not exist in it at all:

```
funding_rounds   mail_log   v_changes_7d
v_owed_replies   v_recent_replies   v_startup_board   v_upcoming_meetings
```

Column drift is just as wide. `startups.ask_as_written`,
`allocation_left_as_written`, `ask_updated_on`, `ask_source`,
`meetings.in_book`, `meetings.investor_name`, `shares.superseded_by`,
`shares.subject`, `shares.to_email`, `mail_log.reply_gist`,
`mail_log.reply_kind` are all read by the app and all absent from the file.
`v_today` in the file returns `deals_sent`; the home page reads `deals_new`,
`deals_followup`, `meetings_today`, `startups_new` and `investors_new`.

So: if Supabase were lost, this repo could not recreate it, and a new
contributor reading `sidana-schema.sql` would be misled about nearly every
page. **Dump the live schema and commit it.** Until that is done, treat the
file as historical and read the live database for column names.

### 2. Next.js 14.2.15 has a critical middleware authorization-bypass advisory
`GHSA-f82v-jwr5-mffw` (CVE-2025-29927) lets a crafted `x-middleware-subrequest`
header skip middleware entirely. This app's **entire auth gate is middleware**
(`middleware.ts`), so that advisory points straight at the front door.

The blast radius is small, and that is not luck — it is the RLS decision in §5
paying off. Skipping middleware gets an attacker a rendered shell with an
unauthenticated Supabase client, which can read nothing. No investor data
leaks. But do not leave it: `npm i next@14.2.35` is a patch bump inside the
same minor, and `npm audit` also flags `next` as the only *critical* direct
dependency. 45 advisories total, 4 on direct deps (`next`, `wrangler`,
`vercel`, `@cloudflare/next-on-pages`); the other three are dev-only tooling
and can wait.

### 3. A live shared secret is committed to git
`docs/dealflow-state-machine.md` contains the n8n read-only database webhook
and its secret in plain text:

```
https://sidanaventures.app.n8n.cloud/webhook/sidana-db-read-6f2a9e
secret: sv-dbread-2026-10-05-R4nK
```

Anyone with repo access can read the whole investor book and all mail through
it, bypassing RLS and roles. It is read-only and cannot write, which is the one
mercy. Rotate the secret, move it to an n8n environment variable or a
credential the routine is handed at runtime, and leave only the endpoint shape
in the doc. Note that rotating does not remove it from history.

### 4. Know which committed keys are deliberate
The Supabase URL and **publishable** key are hardcoded in `next.config.mjs`
*and* `wrangler.toml` *and* inherited into `[env.preview.vars]`. That is
intentional and documented in long comments in both files — those values are
shipped to every browser that opens the site, which is what a publishable key
is for. Do not "fix" it by moving them to secrets; that is what broke
production twice (§7). The `service_role` / secret key is genuinely absent from
this repo and must stay that way.

---

## 5. Decisions, and why

**Supabase over Airtable or staying in Sheets.** Sheets crawls past ~50k rows
and the match table alone is 20k. Free tier covers this for years, real SQL, an
MCP server, and the same database a founder/investor portal would later use.

**Roles in the schema from day one, even though only `owner` is used.**
Retrofitting roles means rewriting every query.

**RLS, not UI hiding.** Hiding a section in the browser is cosmetic. Every
table has policies; the database refuses the query. This is why the app has no
service-role client. If a page returns nothing, the fix is the user's role in
`app_users` or the policy, never a key that bypasses both. This decision is
what contains item 2 in §4 — it has already earned its keep once.

**No signup route.** Accounts are created by an owner in the Supabase
dashboard. Anyone who finds the URL must not be able to register.

**Cloudflare Pages, not Vercel.** Vercel's free tier prohibits commercial use
and this is a commercial internal tool. Cloudflare's does not. Note the repo
still carries `vercel` as a devDependency via `next-on-pages`.

**Edge runtime on every page.** Cloudflare Pages runs Next on Workers, not
Node, so each page declares `runtime = 'edge'` and `nodejs_compat` is set in
`wrangler.toml`. Both are load-bearing.

**A first touch and a chase are never added together.** They are different
events; summing them overstates reach. The home tiles and every funnel keep
`sent_new` and `sent_followup` in separate columns, deliberately.

**The raise is held in the currency the founder stated it in.**
`ask_as_written` is shown in preference to the numeric `ask_current_cr`, so a
dollar round is never displayed converted to rupees.

**Reversed: the invitation email flow.** Supabase invite links are single-use
and redirected to a `localhost:3000` that was not running, so the link was
consumed and expired. Both accounts were recreated with **Authentication → Add
user → Create new user**, password typed directly, Auto Confirm ticked. Do not
go back to invitations for internal accounts.

**Reversed: seeding from the September spreadsheets.** See §8.

---

## 6. The automation side

`docs/dealflow-state-machine.md` is the most valuable document in the repo and
is not about the app at all. It is the task definition for the hourly deal-flow
routine: thirteen stages from INTEREST to COMMITTED or CLOSED_PASS, two entry
doors, the hot-deal carve-out, the content guard on any email that reaches an
investor, and the exact escalation rules. Read it before touching anything that
sends mail. Its header overrides the body wherever they disagree, because the
body was written for a run on a Windows laptop with four mailboxes attached.

Things in it a new owner needs to know:

- **The routine runs hourly, 09:10–21:10, not 2-hourly.** A 1-hour meeting
  reminder cannot be hit on a 2-hourly clock.
- **Every run starts by catching up on the gap.** A lost run is not a skipped
  hour, it is a set of timed steps that will never fire on their own.
- **The heartbeat cannot be written yet.** The read-only endpoint has no write
  path and `task_heartbeat` is never updated, so *every* run is a gap run and
  every run must say so. Giving that endpoint a heartbeat write is a small,
  high-value task.
- **The Hot 11** are spintly, boncuisine, eosnox, hyrgpt, talentrecruit, hoora,
  clikd, mindwox, mentorcloud, roadathena, learningpad. Everything runs on them
  except cold outbound, which only Aditya sends.
- **Standing per-deal rules** (MentorCloud paused with founder, ORBO paused,
  NexCore VCs paused, Clikd's two passes) are listed in the doc and must be
  checked before acting.
- The two n8n workflows in the repo are ready to import: `LOG-AI-ACTION.json`
  (3 nodes, called after every AI node so it records itself) and
  `daily-digest.json` (5 nodes, 9am email, built with code — no AI, no tokens).
- `PROMPT-wire-n8n.txt` is the remaining spec for SYNC-BOOK and for
  ENGINE-DAILY → `shares`.

---

## 7. Two production outages, and what they taught

Both are worth knowing because the fixes look like redundancy and are not.

**Trailing whitespace in a configured value took down every route.** The
Supabase URL set in the Cloudflare dashboard carried two trailing spaces.
`new URL()` tolerates that, so the URL always *looked* right, but supabase-js
concatenates the base with a path before parsing, which put the spaces in the
middle and threw `TypeError: Invalid URL string`. Middleware runs on every
route, so every page returned a blank 500 — including the static `/login`,
which made it look like a build problem. The fix is `lib/supabase/config.ts`,
which trims and strips trailing slashes, and is the only place the app reads
those two values. Keep reading through it.

**Build-time variables did not reach the running Worker.** Setting the values
as Cloudflare build variables failed; setting them as `[vars]` in
`wrangler.toml` failed; preview deployments did not inherit `[vars]` at all.
The resolution was belt *and* braces: inline them at build time in
`next.config.mjs` (which also trims, via `pick()`), keep `[vars]` in
`wrangler.toml` for request-time reads, and repeat the block under
`[env.preview.vars]`. Removing any one of those three has broken production
before.

Also: `middleware.ts` now returns a plain-text "Supabase is not configured for
this deployment." instead of a blank 500. A clear failure beats a mystery.

---

## 8. Gotchas — read this section twice

**The September seed is stale and must never be run.** `seed.sql` was generated
from spreadsheets uploaded on 21 September: 61 startups, 182 investors, against
a live book of ~68 and ~303. It also overwrote `ask_reset_cr` with values
agreed three weeks earlier. It is no longer in the repo — `.gitignore` excludes
it along with `*.xlsx` and the load reports, because the investor book should
not sit in a git remote. If a copy resurfaces on someone's disk, delete it.

**Buckets come from the reset ask, not the current ask.** A startup whose reset
was agreed but never written to the profile is still matched on its old number.
That is a real, recurring failure in their process, which is why
`ask_reset_cr IS NULL` on a bucket A or B startup is surfaced on the home page
and again as a banner on the startup page.

**The `Group` column is not the bucket.** In `MatchReport…xlsx / Summary`,
`Group` holds `Under 5` / `5+` — a meetings tier. An earlier build prompt got
this wrong.

**Duplicate names break any import.** Postgres rejects `ON CONFLICT DO UPDATE
cannot affect row a second time` when two rows with the same key reach one
statement. This killed the first seed. **Accel**, **Capital-A** and
**Yali Capital** each appear twice in the source. Always deduplicate by name
before building an upsert, and log what you dropped. `load-book.js` chunks at
80 rows and upserts on `name`, so re-running it never creates duplicates — but
it does not deduplicate *within* a chunk for you.

**A failed load rolls back completely.** `load-book.js` wraps everything in a
transaction. Tables reading as empty after an error is expected, not a second
problem.

**Spreadsheet headers sit at different offsets.** `Summary` skips 4 rows,
`Proposed new pairs` 3, `Meetings source` 2, `Composition list` 2, the per-type
sheets 3. Never assume row 1.

**Investor type lives only in the composition workbook.** `Investors.xlsx` has
no type column; angel / network / micro-VC / seed fund / institutional comes
from which sheet of `InvestorCompositionList` a name appears on.

**A half-filled investor record is worse than an empty one.** The view
`investors_usable` excludes records missing sectors, stage_pref or either
cheque bound. That is deliberate. Never fill a missing field with a guess to
make a record "complete" — it will be matched against and waste sends. Leave it
NULL and log the row.

**Env var naming.** Supabase now issues a *publishable* key, not *anon*. The
config module accepts either, and `next.config.mjs` exports both names. Keep
that fallback if you touch them.

**`load-book.js` is laptop-only.** It reads its Postgres credential from
`C:/Users/Aditya/AppData/Local/Temp/claude/sidana-load`, outside the repo, by
design. It will not run anywhere else without edits, and the credential should
not be moved inside the repo to make it portable.

---

## 9. Numbers that govern things

| Thing | Value | Note |
|---|---|---|
| Startups in the live book | ~68 | A September snapshot said 61. Stale |
| Investors in the live book | ~303 | A September snapshot said 182. Stale |
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

Verify these against the live database before quoting any of them. They were
accurate on 30 September and nothing in the repo has refreshed them since.

---

## 10. Open items, ranked

| Item | Why it matters |
|---|---|
| **Commit the live schema** | The repo cannot currently rebuild the database, and `sidana-schema.sql` actively misleads anyone reading it. §4 item 1 |
| **Patch Next to 14.2.35** | A critical middleware auth-bypass advisory against the component that *is* the auth gate. §4 item 2 |
| **Rotate the committed n8n read secret** | A plaintext bypass of RLS and roles sitting in git. §4 item 3 |
| **ENGINE-DAILY → `shares`** | Until every send is recorded the 476-vs-2,500 question stays unanswerable, and so does conversion. Still the highest-value *product* task |
| **SYNC-BOOK hourly** | Without it the book goes stale again in three weeks, exactly as the September snapshot did |
| **`LOG-AI-ACTION` on every AI node** | The home page's AI feed stays empty until this exists. Log **skips** especially — a startup silently getting nothing every night appears there and nowhere else |
| **A heartbeat write path** | Every deal-flow run is currently a gap run because `task_heartbeat` is never written. §6 |
| `investors_usable` count | Expected to be far below 303. That number is how much of the book the matcher can actually act on. If it comes back near 303, an import filled blanks with guesses and needs redoing |
| Fix the `/ask?q=owed` table | Five `<th>` over six `<td>`: the "Owner" header sits above the gist column and the real owner column is unlabelled. `app/ask/page.tsx:93` |
| Rename `HOT10` | The enum value is `HOT10`, the UI says "the 11", and the deal-flow doc lists eleven names. Cosmetic, but it reads as a bug |
| Refresh the README | §11 |

---

## 11. The README is stale — do not follow it blindly

`README.md` was written on day one and has not been revised. Specifically:

- **The deploy instructions are wrong.** It says build command `npm run build`,
  output `.next`, framework preset Next.js. The project actually deploys via
  `@cloudflare/next-on-pages`: `npm run pages:build` writing to
  `.vercel/output/static`, which is what `wrangler.toml` declares. Following
  the README would produce a broken deployment.
- **It tells you to create `.env.local` and says it already exists.** It does
  not exist in the repo and is gitignored. You do not need it — the values are
  inlined (§4 item 4). `.env.local` still overrides them locally if you want
  one.
- **It says the code has never been compiled.** It has. Typecheck and build
  both pass clean.
- **It references `seed.sql`**, which is gone and should stay gone.
- **It presents localhost as the deployment state.** The app is on Cloudflare.

Everything else in it — how to add a person and their role, the security
posture, the LOG-AI-ACTION setup table — is still correct and useful.

The previous handover also flagged `Spintly` and `Bon Cuisine` in
`components/Search.tsx` as invented sample names to be replaced. They are not
invented: both are on the Hot 11 in `docs/dealflow-state-machine.md`. That item
is closed. The other three chips (`Appli`, `MonitorExam`, `Pixelence`) are
unverified — check them against the live book before trusting them.

---

## 12. Repository map

| Path | What |
|---|---|
| `app/page.tsx` | Today — tiles, upcoming meetings, hot deals, live conversations, new investors, needs-attention, AI feed |
| `app/ask/page.tsx` | Six named questions as one board with chip filters |
| `app/changes/page.tsx` | Last 7 days of movement, grouped by day, from `v_changes_7d` |
| `app/startup/[id]/page.tsx` | One startup, 620 lines, fourteen sections. The largest file |
| `app/investor/[id]/page.tsx` | One investor |
| `app/login/page.tsx` | Password sign-in and reset. No signup |
| `app/auth/signout/route.ts` | POST, clears the session, 303 to `/login` |
| `components/Header.tsx` | Brand, nav, IST datestamp, who is signed in, sign out |
| `components/Search.tsx` | Browser-side search across both books, debounced 180ms, keyboard-navigable |
| `components/Window.tsx` | Rolling time windows for the detail pages |
| `lib/supabase/config.ts` | The two values, trimmed, in one place. Read §7 before touching |
| `lib/supabase/server.ts` | Server client bound to the signed-in user, so RLS applies |
| `lib/supabase/client.ts` | Browser client. Publishable key only |
| `lib/format.ts` | Indian number grouping, Asia/Kolkata dates, status tones |
| `middleware.ts` | Session refresh and the auth gate |
| `next.config.mjs` | Build-time inlining of the Supabase config. Read §7 |
| `wrangler.toml` | Cloudflare Pages config, `nodejs_compat`, runtime vars, preview vars |
| `sidana-schema.sql` | **Out of date.** Historical reference only. §4 item 1 |
| `docs/dealflow-state-machine.md` | The hourly deal-flow routine, end to end. §6 |
| `PROMPT-load-book.txt` | Loading the live book from Sheets into Supabase |
| `PROMPT-wire-n8n.txt` | Making n8n write into Supabase |
| `LOG-AI-ACTION.json` / `daily-digest.json` | n8n workflows, ready to import |
| `load-book.js` | One-shot loader. Laptop-only, credential outside the repo |
| `.claude/launch.json` | Runs `npm run dev` on port 3000 |

Supabase project URL: `https://elwaquzawoscotlojtnv.supabase.co`

### Git

Single branch of work, 23 commits, one author (`Sidana Ventures`), last commit
5 October 2026. `main`, `claude/dreamy-mayer-nrc62o` and both origin refs all
point at `e95648c` — nothing is diverged, nothing is unpushed, the tree is
clean. Commit messages are written in plain English about intent, not
mechanics ("Show what the investor actually said, not the subject line").
Match that style.

---

## 13. Security — non-negotiable

1. **Only the publishable key ever reaches the browser.** The `service_role` /
   secret key must never appear in this repo, in `.env.local`, in a component,
   or in anything under `app/`. It bypasses every policy in the schema and
   would expose the entire investor book to anyone who opens the site.
2. **The service key belongs in n8n only**, as a Header Auth credential.
3. **Never disable or work around RLS.** If a query returns nothing, fix the
   role or the policy. There is no service-role client in this app and adding
   one would undo the main security decision of the project.
4. **No signup route, ever.**
5. **Do not commit secrets to `docs/`.** One already is. §4 item 3.
6. Do not commit `.env`. `.gitignore` covers it, along with the book exports.

---

## 14. What I would do first

1. **Dump and commit the live schema.** An hour's work, and until it is done
   every other task starts from a file that lies about the database.
2. **`npm i next@14.2.35`, typecheck, build, deploy.** Patch-level, inside the
   same minor, and it closes a critical advisory aimed at the auth gate.
3. **Rotate the n8n read secret** out of `docs/dealflow-state-machine.md`.
4. **Confirm the book loaded.** `select count(*) from startups;`
   `select count(*) from investors;` `select count(*) from investors_usable;` —
   expect ~68, ~303, and a third number well below 303. If the third is near
   303, an import filled blanks with guesses and needs redoing.
5. **ENGINE-DAILY → `shares`.** One node. It starts the clock on real
   conversion data, and every day it is not done is a day of data lost.
6. **SYNC-BOOK hourly.** Stops the book going stale again.
7. **`LOG-AI-ACTION` on every AI node, skips included.** This is what makes the
   dashboard worth opening every morning rather than once a week.

Items 1–3 are hygiene and take a morning between them. Items 5 and 6 are
roughly 90% of the remaining product value.

---

## 15. How to work with Abhilasha

Short, direct messages. Tables and specific figures land well; hedging does
not. She will push back when a number looks wrong and she is usually right —
she caught the stale 61/182 figures on the first night, when the session
building this had accepted them.

Show the column mapping before writing rows. Stop after each step rather than
running a long chain. Say plainly when something cannot be done and why, rather
than working around it quietly. A report that says "I could not read X" is
correct behaviour; one that guesses is not.
