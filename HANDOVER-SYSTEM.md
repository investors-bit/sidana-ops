# Sidana Ventures AI Automation System — Technical Handover & Migration Document

**Compiled:** 2026-10-06 23:30 IST · **Method:** direct inspection of the live system
**Scope:** the whole automation estate, not just the dashboard app (for the dashboard see `HANDOVER.md`, written 30 Sep, now partly stale — it states "nothing writes to Supabase", which ceased to be true on 1 Oct).

**Verification key used throughout:**
`[V]` inspected directly this session · `[P]` stated in a task/workflow definition I read, not executed · `[NV]` NOT VERIFIED, access or method named.

---

## 1. EXECUTIVE SYSTEM SUMMARY

**Purpose.** Sidana Ventures is a Gurugram deal-distribution / investment-banking firm. The system distributes startup deals to an investor book, handles the resulting email conversations, books meetings, and records everything so the state of the pipeline is answerable without asking a human.

**Capabilities.** Investor–startup matching; bulk deal email (4 mailboxes); investor onboarding outreach (email + LinkedIn); autonomous reply handling and meeting booking; thesis capture from call transcripts; reporting.

**Architecture (actual, verified).** Three tiers that do not share a runtime:

```
TIER 1  Claude Code scheduled tasks        ← LAPTOP ONLY. The judgment layer.
          13 recurring + 3 one-time, each a SKILL.md prompt run as a fresh Claude session
                │ calls over HTTPS
                ▼
TIER 2  n8n cloud (sidanaventures.app.n8n.cloud)   ← 24/7. The hands.
          46 active workflows: schedulers, senders, and ~20 on-demand webhook "tools"
                │ writes
                ▼
TIER 3  Storage:  Google Sheets (source of truth)  +  Supabase Postgres (derived/reporting)
                                                        │
                                              Next.js app on Vercel (read-only dashboard)
```

**Data today.** Google Sheets is the **book of record**. Supabase is a **derived mirror plus an event log**, populated hourly by n8n. The dashboard reads Supabase only. Nothing reads MySQL; MySQL does not exist yet.

**AI models.** Claude (Anthropic) via Claude Code. `[V]` Current session model: `claude-opus-5`. Per-task model is **not pinned** in any SKILL.md — scheduled tasks inherit whatever the Claude Code install defaults to. `[NV]` which model each task actually ran under historically.

**MCP.** Exactly **one** local MCP server: `n8n-mcp` (stdio, npm, machine-bound). Everything else commonly mistaken for MCP — Gmail, Google Calendar, Fireflies, Notion, Google Drive, Apify — are **claude.ai connectors**, account-bound and cloud-hosted, not installed on the laptop. `[V]`

**Migration objective.** Move Tier 1 off the laptop to a 24/7 host; migrate Sheets → MySQL; keep Tier 2 or absorb it.

**The single biggest dependency:** Tier 1 runs only while the laptop is open. Tier 2 keeps sending regardless. On a laptop-off weekday, **deals go out and nobody reads the answers.** A verified 84-hour outage (1 Oct 21:48 → 5 Oct) cost a missed Spintly call.

---

## 2. COMPLETE AGENT INVENTORY

All Tier-1 agents are Claude Code scheduled tasks: a cron entry plus a `SKILL.md` prompt at
`C:\Users\Aditya\.claude\scheduled-tasks\<id>\SKILL.md`. All `[V]` enabled-state and cron as of 2026-10-06 23:30 IST.

| Agent | Purpose | Trigger (IST) | Tools / MCP | Reads | Writes | Status |
|---|---|---|---|---|---|---|
| `dealflow-state-machine` | Advances every live investor meeting through 10 stages | hourly 10:10–17:10 daily | CAL-CREATE, CAL-READ, INTERNAL-SEND, PIPE-BATCH-FIX; Fireflies; Calendly | PIPELINE, STARTUPS, INVESTORS, INVESTOR_CRITERIA, Founders Info | PIPELINE col AG (`current_stage`) | enabled |
| `onboarding-engine` | New investor: reply → thesis → intro call → handover | hourly :20, 10:20–17:20 Mon–Fri | LinkedIn (browser), Calendly | ONBOARDING, LI_OUTREACH, INVESTORS, INVESTOR_CRITERIA, BOUNCES | ONBOARDING stage cols | enabled |
| `thesis-engine` | Find unknown theses, ask, read transcript, write criteria | 11:45 & 16:45 Mon–Fri | ASK-SEND, CRIT-PATCH, ENGINE-DAILY, GMAIL-SEARCH, SHEET-READ; Fireflies | INVESTOR_CRITERIA, PIPELINE, STARTUPS | INVESTOR_CRITERIA | enabled |
| `middle-desk-reply-watch` | Auto-act on replies, desk = STARTUPS col O `MIDDLE` (30) | 11,13,15,17 Mon–Fri | REPLY-SEND-MB2B/3/4/5, NEW-SEND-MB2/4/5, CAL-CREATE, CAL-READ, GMAIL-SEARCH, SHEET-READ, SHEET-CELL-FIX, PIPE-BATCH-FIX, INTERNAL-SEND | PIPELINE, STARTUPS, STARTUP_PROFILE, INVESTOR_CRITERIA, Founders Info | PIPELINE | enabled |
| `angel-desk-reply-watch` | Same, desk = col O `ANGEL` (26) | 10,12,14,16 Mon–Fri | identical to middle desk | identical | PIPELINE | enabled (created 5 Oct) |
| `hot-deals-reply-recorder` | Record replies + calendar for the 11 HOT deals. **Never sends** | 11,13,15,17 daily | CAL-READ, GMAIL-SEARCH, PIPE-READ, PIPE-BATCH-FIX, SHEET-CELL-FIX, INTERNAL-SEND | PIPELINE, STARTUPS, STARTUP_PROFILE, Founders Info | PIPELINE | enabled |
| `aditya-email-reply-watch` | Act on Aditya's emailed instructions, confirm back | :00/:30, 10:00–17:30 daily | Gmail **connector** (not n8n), INTERNAL-SEND | investors@ mailbox, PIPELINE | reply mail (internal only) | enabled |
| `sidana-reply-capture` | Read every investor reply since last capture, write change list | 13:00 daily | GMAIL-SEARCH, PIPE-READ, SHEET-READ, CRIT-PATCH, INTERNAL-SEND | 4 mailboxes, PIPELINE, INVESTORS, Thesis | capture file + summary mail to Aditya | enabled |
| `sidana-rematch-watch` | Apply captures, re-match checks. **Largest prompt, 56 KB** | 14:30 & 17:30 daily | ASK-SEND, CAL-CREATE, CRIT-PATCH, ENGINE-DAILY, GMAIL-SEARCH, PIPE-READ/BATCH-FIX, SHEET-READ/CELL-FIX, INTERNAL-SEND | all tabs incl. ERROR LOG | PIPELINE, INVESTORS, INVESTOR_CRITERIA | enabled |
| `sidana-1745-brief-prep` | Gather day-end brief | 17:30 daily | CAL-READ, GMAIL-SEARCH | PIPELINE, calendars | brief file | enabled |
| `onboarding-followups` | Day-7 / day-20 chases to non-repliers | 15:15 Mon–Fri | ONB-FU-READ, ONB-FU-SEND-MB5, ONB-FU-WRITE | ONBOARDING, INVESTORS, BOUNCES, STARTUPS | ONBOARDING fu1/fu2 cols | enabled |
| `onboarding-queue-refill` | Research new investor firms, append rows | 10:30 Mon–Fri | web research | ONBOARDING, INVESTORS, STARTUPS, PIPELINE | ONBOARDING | enabled |
| `linkedin-outreach-cycle` | Source targets, send exactly 20 invites/day | 11:34 Mon–Fri | **Chrome browser session**, LI-OUTREACH-WRITE | LI_OUTREACH, INVESTORS, ONBOARDING, STARTUPS, STARTUP_PROFILE | LI_OUTREACH | enabled |
| `nirman-single-followup-8oct` | One permitted manual follow-up | once 8 Oct 10:30 | REPLY-SEND-MB3 | — | — | armed |
| `aavishkaar-followup-precheck` | Cancel-or-confirm a queued send | once 8 Oct 10:00 | — | PIPELINE | — | armed |
| `clikd-udyat-reengage-nov` | **Draft only, never sends** | once 2 Nov | — | — | draft | armed |

**Disabled/retired (kept on disk, 18 more):** `linkedin-reply-watch`, `onboarding-reply-capture`, `gargi-v3-trainrex-watch`, `vcat-reply-watch`, `chaman-data-watch`, `spintly-hem-book-watch`, `sidana-booking-watch`, `investor-thesis-ask-25sep` (paused: 4 of 10 mails misstated the relationship), plus spent one-offs. `[V]`

### Tier-2 agents (n8n, no Claude involved)

| Workflow | ID | Trigger (IST) | Function |
|---|---|---|---|
| ENGINE-DAILY | `F4xXHRFIr3gS2VHc` | 07:30 Mon–Fri | **The matcher.** Pauses off-thesis deals, 2/day inbox cap, writes new matches |
| Fundraising Outreach A/B/C/D | `TJUMpe2il97RIJi3`, `jbrwBYNl17XAQClL`, `n3NnZ386C0P9HNxc`, `BAkgem7Zu6uVyoFL` | 08:00 | Deal email send, one workflow per mailbox, 37 nodes each |
| ONB-1 | `ThiWDFPpKOu9iLnF` | daily | Investor onboarding send, 5 mailboxes, 70/day |
| ASK-SEND | `XUksDVaFexCu799r` | 11:00 Mon–Fri | Sends queued thesis-check replies in-thread |
| MAIL-HISTORY | `OiHvfYKKK9mOld2g` | hourly 09–22 + 22:30 sweep | 6 mailboxes → `mail_log`, resolve + classify. 32 nodes |
| CAL-SYNC | `HgA7X7lgkGBVGLWQ` | hourly 09–22 | 4 calendars → `cal_events` → `meetings` |
| SYNC-BOOK | `I8VWdHLb6fxhciqN` | hourly | Sheets → Supabase (`startups`, `investors`) |
| FIREFLIES-SYNC | `I9bZsGJfNuyr2b77` | 17:30 daily | Transcripts → n8n data table `fireflies_transcripts` |
| Reply Detection ×4 | `50KXPqMi5R8ewfVs`, `STxiIdY3w0efPDGK`, `uHbP2eLYI37O2Xe3`, `YO9gZXzvpGNMzPlb` | every 30 min, Mon–Fri 09–18 | Label replies, update PIPELINE. **`[V]` no send node — read/label/write only** |
| DAILY-REPORT | `gS9DXz4E3gMzcXYP` | 18:00 Mon–Fri | Deal report to rakesh@. Changed 5 Oct to a 1-calendar-month window |
| DEAL-OPS-DAILY | `w23ggcoqf781Rw4U` | 10:00 Mon–Fri | Chase open document requests |
| TRIGGER-WATCH | `Ea1BMydoRwSMW30k` | Mon 09:00 | Re-contact investors whose stated condition is now met |
| BOUNCE-WATCH | `75ZbeF7cc4SGndyv` | 20:00 daily | Detect bounced addresses across 5 mailboxes |
| ONB-TRACK | `uFAFX9fosT1oUVD1` | 19:30 daily | Match Calendly bookings to onboarding recipients |
| Weekly Founder Update | `2MG95rlJDoFNz8tJ` | Sat 10:00 | Fundraising report to founders |
| Fireflies missed-meeting | `KImr1mdpBBlIhuPN` | 21:00 weekdays | Flag meetings with no transcript |
| AUTO mail corrections | `gK00sYw0C9WJsyH3` | 18:40 Mon–Fri | Apply mail corrections to INVESTORS |
| AUTO thesis drift | `uVZYNehglgzw763P` | 18:45 Mon–Fri | Snapshot-diff the Thesis tab, flag re-match |
| TASK-HEARTBEAT | `4Yd3oTWu0oKO73A0` | hourly 11–18 Mon–Fri | Alarms if the laptop chain stops. Narrowed 6 Oct |

---

## 3. DETAILED AGENT SPECIFICATION

Only agents whose internals I read are specified. Shared behaviour is stated once in §3.0 and not repeated.

### 3.0 Conventions shared by all Tier-1 agents

- **Runtime:** one fresh Claude Code session per fire. No memory between runs; all state is external (Sheets columns, local state JSON, the mailbox itself).
- **n8n tool protocol:** webhook workflows are kept **inactive**. Each agent must *activate → wait ~15 s → call → deactivate*. Every desk SKILL.md warns: *"Check active state first; other sessions toggle them."* This is a real race — six tasks share `GMAIL-SEARCH`. `[P]`
- **Guard pattern:** write-capable webhooks take `{secret, …, dry}`; `dry` defaults **true** and throws `DRY OK | …`. A send is confirmed only by a `sent_id` in the response. `[V]` (read INTERNAL-SEND's Build node)
- **Error reading:** webhooks return only `{"message":"Error in workflow"}`. Real text comes from `n8n_executions` → `errorInfo.primaryError.message`. `[V]` used successfully.
- **Times are always IST.**

### dealflow-state-machine

**Purpose:** own every live investor meeting end-to-end.
**Trigger:** cron `10 10-17 * * *` (was `10 9-21 * * *` until 6 Oct).
**Input:** PIPELINE rows with a live stage. **Output:** emails, calendar invites, stage writes.
**State:** PIPELINE **column AG `current_stage`** — owned solely by this task. Column AE is `pause`.

**Stage machine:** `[P]`
```
interest → times agreed → booked → founder briefed → 1-hour reminder
  → proof of meeting → founder feedback → trail mail → Fireflies read
  → watch to a clear pass or commitment
```

**Behavioural rules of record:**
- Must **ask the founder before booking** and tell the investor only "confirming, will revert". Reverses an earlier rule, which is quoted in the file so nobody reinstates it. Source: Aditya, 26 Sep — *"raj should be asked and after his confirmation only the meeting should be booked"*.
- Escalate to investors@ by **email** if the founder is silent 3 hours; a run-summary line reaches nobody.
- Never tell an investor a founder is free on team-calendar evidence alone.
- Never add a first touch and a chase on the same day (git commit `dc49ab1`).
- Keeps numbers out of trail mails unless sourced from a transcript — *"a recap is not a source"*. `[V]` observed in the 5 Oct run report.

**Failure handling:** none automatic. A missed hour is simply skipped; the next run detects the gap by comparing a timestamp file and reports it.
**Human intervention:** founder confirmation before booking; escalations.
**Migration requirement:** must move to a 24/7 host. Stage column AG must become a MySQL column with the same single-writer rule.

### middle-desk-reply-watch / angel-desk-reply-watch

Two instances of one design, partitioned by `STARTUPS` column **O** (`MIDDLE` / `ANGEL`); 14 startups have a blank desk and belong to neither. `[P]`

**Autonomy:** sends investor replies **without approval**, from whichever of the 4 mailboxes owns the thread. Authorised by Aditya, 24 Sep: *"their only job is adding new investors. Everything else on this desk is yours to decide and execute."*

**Run order:** `STEP 0` rebuild open-ask ledger from the mailbox → `1b` desk hygiene audit → `1c` founder chase ladder → `1` find replies → `2` act → `3` record → `4` report → `5` decide, do not escalate.

**Guards:** never nudge the same founder twice a day; never a nudge and a new ask the same day; *"DO NOT WRITE A ROW THE CHAIN IS HOLDING"* (added 30 Sep — prevents collision with dealflow-state-machine).

**Known defect `[V]`:** something writes `investor_response` + `deal_status` while leaving follow-ups live. Three desks each sweep up after it. The writer has not been identified.

### aditya-email-reply-watch

**Purpose:** Aditya steers the system by replying to its emails; this reads investors@ and executes those instructions.
**Tools:** Gmail **connector** directly — the file explicitly forbids `GMAIL-SEARCH` here because six other tasks toggle it and a deactivate would break them mid-run. `[V]`
**Sending:** `INTERNAL-SEND` (`V0NmD52cFC0HmJB4`) only. **`[V]` Verified in source — every To and Cc must match `/@sidanaventures\.com$/` or the node throws `refused: external recipient(s)`.** This agent therefore cannot mail an investor or founder.

### linkedin-outreach-cycle

**Purpose:** source investor targets, verify each firm has a live website, dedupe against INVESTORS + ONBOARDING + LI_OUTREACH, send exactly 20 invites/day with notes grounded in `STARTUP_PROFILE` numbers.
**Narrowed 5 Oct:** must NOT read replies, message new accepts, or send Calendly — those moved to `onboarding-engine`.
**Hard dependency:** a **logged-in Chrome session on the laptop**. No LinkedIn API. This is the one component with a genuine reason to stay on a residential machine: a datacentre IP plus an automated browser is the profile LinkedIn bans for.
**Conflict to resolve before migration:** `onboarding-engine` "owns LinkedIn and email equally" but is otherwise a server candidate. It must be split.

---

## 4. MCP INVENTORY

| Server | Purpose | Location | Machine-bound? | Migration |
|---|---|---|---|---|
| `n8n-mcp` | Create/read/update/activate n8n workflows, read executions | **local stdio**, `npm` global, `n8n-mcp.cmd` | **Yes** | Reinstall on host; set `N8N_API_URL`, `N8N_API_KEY` |
| Gmail connector | Read/label/send mail as investors@ | claude.ai cloud | No — account-bound | Re-authorise from new host |
| Google Calendar connector | List/create/update events | claude.ai cloud | No | Re-authorise |
| Fireflies connector | Transcripts, summaries, search | claude.ai cloud | No | Re-authorise |
| Google Drive connector | Read/create/share files | claude.ai cloud | No | Re-authorise |
| Notion connector | Pages/databases | claude.ai cloud | No | Re-authorise |
| Apify | Web scraping actors | claude.ai cloud | No | Re-authorise |
| Claude Docs connector | Living documents | claude.ai cloud | No | Re-authorise |
| `scheduled-tasks` | The cron layer itself | Claude Code desktop app | **Yes** | **No server equivalent — see §14** |
| `Claude_Browser`, `terminal`, `ccd_*`, `visualize` | Desktop-app internals | Claude Code desktop app | **Yes** | Not available headless |

```
n8n-mcp (the only true local MCP)
 ├── n8n_list_workflows / n8n_get_workflow      → inventory, structure
 ├── n8n_create_workflow / n8n_update_partial_workflow → build, activate/deactivate
 ├── n8n_executions                              → run history, real error text
 ├── n8n_manage_credentials / n8n_manage_datatable
 └── n8n_health_check / n8n_audit_instance
```

**`[V]` Critical finding:** the only MCP server in `C:\Users\Aditya\.claude.json` is `n8n-mcp`. There is no custom Sidana MCP server, no local database MCP, no bespoke integration code. The "MCP layer" is thinner than it appears — almost all capability is claude.ai connectors plus n8n webhooks.

---

## 5. END-TO-END BUSINESS WORKFLOWS

### C + D + E. Matching → deal creation → send
```
07:30 Mon–Fri  ENGINE-DAILY (n8n)
   ↓ reads INVESTOR_CRITERIA (32 cols), STARTUPS, PIPELINE
   ↓ strict match: sector ∩, stage ±0, cheque floor ≤ raise ≤ ceiling
   ↓ pauses off-thesis queued rows; enforces 2 new deals/investor/day
   ↓ writes new PIPELINE rows (status queued)
08:00  Fundraising Outreach A/B/C/D — one per mailbox
   ↓ sends deal email, writes sent_date + thread_id to PIPELINE
every 30 min  Reply Detection ×4 → labels reply, updates PIPELINE
   ↓
desk watcher (11/13/15/17) or dealflow-state-machine (hourly) acts
```
**Cheque-gate defect `[V]`:** `SYNC-BOOK`'s `money()` parser returns `[null,null,'USD, no exchange rate given']` for any dollar figure. **43 of 77 active investors with a blank `cheque_min_cr` have their cheque written in dollars.** A blank floor **fails open**, so e.g. A91 Partners ($10M–$50M) currently matches a ₹1.2 Cr round. Unresolved; needs an FX rate, a fail-closed rule, or manual entry.

### F + G. Pass / rejection
Desk watcher records: `investor_response`, `pass_reason` **verbatim**, `deal_status = "Closed - passed"`, `pause = Yes`, `next_action = "Closed - passed"`. Supabase `classify_replies()` buckets replies into pass / interested / invite / other. `[V]` 310 passes, 117 interested classified.

### M + N. Meeting scheduling
```
investor proposes time
   ↓ desk/dealflow checks CAL-READ for an existing meeting with that investor
   ↓ emails FOUNDER to confirm that exact slot (mandatory since 26 Sep)
   ↓ replies to investor: "confirming, will revert" — never "confirmed"
   ↓ on founder yes → CAL-CREATE, title "<Startup> <> <Firm> | Sidana Ventures",
     attendees founder + investor + Aditya + Shradhaa + owner, Google Meet link
   ↓ founder brief email (fund, cheque, thesis, portfolio, likely questions)
   ↓ 3h founder silence → ESCALATION email to investors@ with founder phone
```

### A + P. Investor onboarding (email and LinkedIn)
```
onboarding-queue-refill 10:30 → research firms → append ONBOARDING rows
ONB-1 (n8n) → 70 intros/day across 5 mailboxes
linkedin-outreach-cycle 11:34 → 20 invites/day (Chrome)
   ↓ reply arrives
onboarding-engine hourly :20 → classify → capture thesis → ask for intro call
   → Calendly → ONB-TRACK 19:30 matches the booking → handover to a manager
onboarding-followups 15:15 → day-7 and day-20 chases to non-repliers
```

### H + I + J. Thesis capture and correction
```
thesis-engine 11:45/16:45 → find investors with unknown thesis
   → ASK-SEND (11:00) sends the question in the latest deal thread
   → investor agrees to a 30-min call → Fireflies records it
   → read transcript → CRIT-PATCH writes real criteria to INVESTOR_CRITERIA
AUTO thesis drift 18:45 → full-row snapshot diff → flags re-match in ERROR LOG
AUTO mail corrections 18:40 → applies mail-derived corrections to INVESTORS
sidana-rematch-watch 14:30/17:30 → applies captures, re-runs match checks
```

### K + L. Replies
New inbound → MAIL-HISTORY (hourly) logs to `mail_log`; `resolve_mail()` sets direction, matches investor by email then domain, matches startup from the subject by **longest name match**, inserts shares, stamps `replied_at`. In parallel Reply Detection labels it in Gmail and writes PIPELINE.

---

## 6. TRIGGER & SCHEDULING INVENTORY

| Agent / Workflow | Type | Exact trigger | TZ | Depends on | Failure risk |
|---|---|---|---|---|---|
| dealflow-state-machine | scheduled | `10 10-17 * * *` | IST | **laptop** | Meetings ending after ~17:00 get no trail mail until 10:10 next day |
| onboarding-engine | scheduled | `20 10-17 * * 1-5` | IST | **laptop + Chrome** | LinkedIn half dies with the lid |
| thesis-engine | scheduled | `45 11,16 * * 1-5` | IST | laptop | — |
| middle-desk-reply-watch | scheduled | `0 11-17/2 * * 1-5` | IST | laptop | Shares GMAIL-SEARCH with 5 others |
| angel-desk-reply-watch | scheduled | `0 10-16/2 * * 1-5` | IST | laptop | same |
| hot-deals-reply-recorder | scheduled | `0 11-17/2 * * *` | IST | laptop | — |
| aditya-email-reply-watch | scheduled | `0,30 10-17 * * *` | IST | laptop | Control channel dies with the lid |
| sidana-reply-capture | scheduled | `0 13 * * *` | IST | laptop | — |
| sidana-rematch-watch | scheduled | `30 14,17 * * *` | IST | laptop | — |
| sidana-1745-brief-prep | scheduled | `30 17 * * *` | IST | laptop | — |
| onboarding-followups | scheduled | `15 15 * * 1-5` | IST | laptop | — |
| onboarding-queue-refill | scheduled | `30 10 * * 1-5` | IST | laptop | — |
| linkedin-outreach-cycle | scheduled | `30 11 * * 1-5` | IST | **laptop + Chrome login** | Session expiry is silent |
| ENGINE-DAILY | scheduled | 07:30 Mon–Fri | IST | n8n cloud | Queue grows if senders are off |
| Outreach A–D | scheduled | 08:00 | IST | n8n cloud | **Fires even when nobody can read replies** |
| ONB-1 | scheduled | daily | IST | n8n cloud | same |
| MAIL-HISTORY | scheduled | hourly 09–22 + 22:30 | IST | n8n cloud | — |
| CAL-SYNC | scheduled | hourly 09–22 | IST | n8n cloud | `resolve_meetings()` runs 18.6 s `[V]`; a slow variant previously hit statement timeout |
| SYNC-BOOK | scheduled | hourly | IST | n8n cloud | Silent USD parse failures |
| ~20 webhook tools | **on-demand** | POST, activated by a task then deactivated | — | laptop task + n8n | Concurrent toggling by parallel sessions |

**Jitter:** every scheduled task carries `jitterSeconds` up to ~730 s (12 min). `[V]`
**`[V]` No webhook, file-watch, spreadsheet-change or email-arrival trigger exists in Tier 1.** Everything is polled on a clock.

---

## 7. DATA ARCHITECTURE

| Source | Holds | Used by | R/W | Migrate? |
|---|---|---|---|---|
| **Google Sheets** `1hTpvAl-fj8ON4MiiWVgc478QCdWVcwEe-2dI3sLiGq4` | The book: PIPELINE, STARTUPS, INVESTORS, INVESTOR_CRITERIA, ONBOARDING, LI_OUTREACH, STARTUP_PROFILE, Founders Info, Thesis, BOUNCES, ERROR LOG, DEFERRED | every agent | RW | **Yes → MySQL** |
| **Supabase Postgres** `elwaquzawoscotlojtnv` | 16 tables, 14 views, 16 functions. Derived mirror + event log | dashboard, DB-READ | RW (n8n writes) | Decide: migrate or keep |
| **Gmail** ×6 mailboxes | All correspondence; also the **de-facto ledger** the desks rebuild from each run | all desks | RW | Stays |
| **Google Calendar** ×4 | Meetings | dealflow, desks, CAL-SYNC | RW | Stays |
| **Fireflies** | Transcripts + summaries | dealflow, thesis-engine | R | Stays |
| **n8n data table** `fireflies_transcripts` | Cached transcripts | FF-LOOKUP | RW | Migrate to MySQL |
| **Local state files** `.claude/scheduled-tasks/*/…json`, `chain-last-run.txt`, `sidana-captures/*.md` | Per-task cursors, capture files | the owning task | RW | **Must migrate — single point of loss** |
| **LinkedIn** | Prospects, invites, messages | linkedin-outreach-cycle | RW | Stays, laptop-bound |
| **Vercel** | Dashboard hosting | users | — | Stays |

### Supabase contents `[V]`

| Table | Rows (approx) | Cols |
|---|---|---|
| `mail_log` | 42,319 | 15 |
| `shares` | 11,069 | 17 |
| `cal_events` | 3,377 | 8 |
| `matches` | 3,360 | 10 |
| `meetings` | 1,667 | 17 |
| `replies` | 382 | 13 |
| `investors` | 303 | 40 |
| `startups` | 70 | 32 |
| `ai_log`, `ai_runs`, `app_users`, `docs`, `funding_rounds`, `name_alias`, `outreach`, `task_heartbeat` | small / empty | — |

**Views (14):** `investors_usable`, `v_changes_7d`, `v_investor_cohorts`, `v_investor_domain`, `v_investor_email`, `v_investor_key`, `v_owed_replies`, `v_recent_replies`, `v_silent_startups`, `v_startup_board`, `v_startup_funnel`, `v_startup_key`, `v_today`, `v_upcoming_meetings`

**Functions (16):** `resolve_mail`, `resolve_meetings`, `dedupe_meetings`, `digest_replies`, `classify_replies`, `clean_counterparty`, `clean_snippet`, `tidy_label`, `prune_ai_raw_output`, `touch_updated_at`, plus RLS helpers `is_staff`, `is_admin`, `can_see_startup(bigint)`, `current_app_role`, `current_startup_id`, `current_investor_id`.

**RLS roles:** `owner, ops, deals_desk, angel_desk, founder, investor`. `owner` and `ops` are **identical in every policy**. The `investor` role is **effectively broken** — absent from `can_see_startup()`. `[V]` from prior inspection.

---

## 8. SHEETS → MySQL MIGRATION REQUIREMENTS

### 8.1 The finding that should shape the plan

**A normalised relational model already exists** — in Supabase Postgres, built 30 Sep–1 Oct, populated hourly from Sheets by `SYNC-BOOK`, `MAIL-HISTORY` and `CAL-SYNC`. 20 foreign keys, 14 views, 16 functions. `[V]`

So "Excel → MySQL" is **not** a greenfield modelling exercise. Three honest options:

| Option | Work | Risk |
|---|---|---|
| **A. Keep Postgres, make it authoritative** | Reverse the write direction: agents write DB, a job pushes to Sheets for humans. No schema work, no function porting, RLS kept | Lowest. Recommended unless MySQL is mandated for an external reason |
| **B. Port Postgres → MySQL** | Re-implement 16 PL/pgSQL functions and 14 views; RLS becomes app-layer auth. Schema itself ports easily | Medium–high. The functions are where the logic lives |
| **C. Sheets → MySQL direct, ignore Postgres** | Rebuild what already exists | Highest. Discards verified work |

**If MySQL is a hard requirement, Option B.** The schema below is Option B's target, derived from the verified Postgres schema.

### 8.2 Verified Sheets tabs

Spreadsheet `1hTpvAl-fj8ON4MiiWVgc478QCdWVcwEe-2dI3sLiGq4` (16 references across task definitions). `[V]` tab names; `[NV]` exact headers.

| Tab | Known structure | Proposed MySQL entity |
|---|---|---|
| PIPELINE | 35 cols `A:AI`. **AG = `current_stage`** (sole writer: dealflow-state-machine). **AE = `pause`**. Also investor email, sent_date, thread_id, investor_response, pass_reason, deal_status, next_action | `shares` + `deal_state` |
| STARTUPS | `A:P`. **E = `raise_inr_cr`** (string, e.g. "INR 25 Cr"). **O = `desk`** (ANGEL 26 / MIDDLE 30 / blank 14) | `startups` |
| INVESTORS | — | `investors` |
| INVESTOR_CRITERIA | 32 cols `A:AF`. **AD `cheque_max_cr`, AE `lead_max_cr`, AF `round_max_cr`** | `investor_criteria` |
| ONBOARDING | to col `AV`; stage cols `AQ:AV`; `sent_date`, `fu1`, `fu2` | `outreach` |
| LI_OUTREACH | to col `AA`; stage cols `V:AA` | `outreach` (channel='linkedin') |
| STARTUP_PROFILE | per-startup numbers quoted in outreach copy | `startup_profile` |
| Founders Info | founder name, email, **phone** (used in escalations) | `founders` |
| Thesis | free-text thesis, snapshot-diffed nightly | `investor_criteria` + history |
| BOUNCES, ERROR LOG, DEFERRED | operational logs | `bounces`, `error_log`, `deferred` |

**`[NV]` Exact column headers.** `SHEET-READ` (`m1C0zJbd3zdMUbx1`) rejected this spreadsheet with `sheet not allowed` — its allowlist covers only the pilot/allocation sheets. **To obtain:** call `PIPE-READ` (`jVVRssFPKY4GFrOz`), add the book to SHEET-READ's allowlist, or export the tabs. **Blocking gap for a field-level migration script.**

### 8.3 Proposed MySQL schema (Option B target)

Derived from the verified Postgres schema; types translated, `USER-DEFINED` enums spelled out.

```sql
CREATE TABLE startups (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  sector VARCHAR(120), subsector VARCHAR(120), stage VARCHAR(60),
  bucket VARCHAR(40), owner_name VARCHAR(120), status VARCHAR(40),
  desk ENUM('ANGEL','MIDDLE') NULL,              -- STARTUPS col O
  ask_currency CHAR(3), ask_amount DECIMAL(14,2),
  ask_as_written VARCHAR(255), ask_source VARCHAR(120), ask_updated_on DATE,
  ask_current_cr DECIMAL(12,2), ask_reset_cr DECIMAL(12,2), reset_written_at DATETIME,
  allocation_left_amount DECIMAL(14,2), allocation_left_as_written VARCHAR(255),
  allocation_source VARCHAR(120), allocation_updated_on DATE,
  revenue_note TEXT, revenue_inr_l DECIMAL(12,2), burn_inr_l DECIMAL(12,2),
  runway_months INT, score INT, scored_at DATETIME, rule_tier VARCHAR(20),
  mandate_signed_on DATE, mandate_closed_on DATE, notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_startup_name (name)
);

CREATE TABLE investors (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL, contact_person VARCHAR(160),
  email VARCHAR(255), cc_email VARCHAR(255), linkedin_url VARCHAR(512),
  type VARCHAR(60), status VARCHAR(40),
  do_not_contact BOOLEAN DEFAULT 0, suppressed BOOLEAN DEFAULT 0, suppressed_reason TEXT,
  last_contacted_on DATE, contacted_by VARCHAR(120), thesis_call_on DATE,
  source VARCHAR(120), added_month VARCHAR(20), notes TEXT, confirmed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_investor_name (name), KEY ix_investor_email (email)
);

-- split from investors: criteria change independently and are diffed nightly
CREATE TABLE investor_criteria (
  investor_id BIGINT PRIMARY KEY,
  sectors TEXT, sectors_excluded TEXT, sector_mode VARCHAR(20),
  models_in TEXT, models_excluded TEXT,
  stage_pref VARCHAR(80), stage_min VARCHAR(40), stage_max VARCHAR(40),
  cheque_min_cr DECIMAL(12,2), cheque_max_cr DECIMAL(12,2),
  cheque_max_cr_stated DECIMAL(12,2), lead_max_cr DECIMAL(12,2), round_max_cr DECIMAL(12,2),
  cheque_as_written VARCHAR(255),
  cheque_currency CHAR(3) DEFAULT 'INR',   -- NEW: fixes the USD fail-open defect
  arr_min_cr DECIMAL(12,2), arr_min_strict BOOLEAN, revenue_required BOOLEAN,
  geography VARCHAR(160), women_only BOOLEAN DEFAULT 0, other_requirements TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ic_inv FOREIGN KEY (investor_id) REFERENCES investors(id) ON DELETE CASCADE
);

CREATE TABLE matches (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  startup_id BIGINT NOT NULL, investor_id BIGINT NOT NULL,
  type VARCHAR(40), state VARCHAR(40), score INT,
  stage_fit VARCHAR(20), cheque_fit VARCHAR(20), priority INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_match (startup_id, investor_id),
  FOREIGN KEY (startup_id) REFERENCES startups(id),
  FOREIGN KEY (investor_id) REFERENCES investors(id)
);

CREATE TABLE shares (                      -- one deal email sent
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  startup_id BIGINT NOT NULL, investor_id BIGINT NOT NULL,
  sent_at DATETIME, mailbox VARCHAR(60), type VARCHAR(40),
  subject VARCHAR(512), to_email VARCHAR(255),
  gmail_id VARCHAR(64), thread_id VARCHAR(64),
  opened_at DATETIME, replied_at DATETIME,
  is_followup BOOLEAN DEFAULT 0, followup_no INT,
  source VARCHAR(40), superseded_by VARCHAR(40),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY ix_share_thread (thread_id), KEY ix_share_pair (startup_id, investor_id),
  FOREIGN KEY (startup_id) REFERENCES startups(id),
  FOREIGN KEY (investor_id) REFERENCES investors(id)
);

-- PIPELINE's stage/response columns, separated so single-writer is enforceable
CREATE TABLE deal_state (
  startup_id BIGINT NOT NULL, investor_id BIGINT NOT NULL,
  current_stage VARCHAR(60),               -- PIPELINE col AG; sole writer: dealflow engine
  paused BOOLEAN DEFAULT 0,                -- col AE
  investor_response VARCHAR(80), pass_reason TEXT,
  deal_status VARCHAR(80), next_action VARCHAR(160),
  stage_updated_at DATETIME, stage_updated_by VARCHAR(60),
  PRIMARY KEY (startup_id, investor_id),
  FOREIGN KEY (startup_id) REFERENCES startups(id),
  FOREIGN KEY (investor_id) REFERENCES investors(id)
);

CREATE TABLE mail_log (
  gmail_id VARCHAR(64) PRIMARY KEY,
  thread_id VARCHAR(64), mailbox VARCHAR(60),
  from_email VARCHAR(255), to_emails TEXT, cc_emails TEXT,
  subject VARCHAR(512), sent_at DATETIME,
  direction ENUM('in','out'), investor_id BIGINT NULL, startup_id BIGINT NULL,
  snippet TEXT, reply_kind VARCHAR(40), reply_gist TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY ix_mail_sent (sent_at), KEY ix_mail_thread (thread_id),
  KEY ix_mail_inv (investor_id), KEY ix_mail_startup (startup_id)
);

CREATE TABLE cal_events (
  ical_uid VARCHAR(255) PRIMARY KEY,
  event_id VARCHAR(255), summary VARCHAR(512), start_at DATETIME,
  status VARCHAR(40), meet_link VARCHAR(512), attendees TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE meetings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  startup_id BIGINT NULL, investor_id BIGINT NULL,
  startup_name VARCHAR(255), investor_name VARCHAR(255),  -- off-book counterparties
  scheduled_at DATETIME, held BOOLEAN NULL, is_second BOOLEAN,
  in_book BOOLEAN, source VARCHAR(40), from_matcher BOOLEAN,
  fireflies_id VARCHAR(64), meet_link VARCHAR(512), notes TEXT,
  ical_uid VARCHAR(255) UNIQUE, superseded_by VARCHAR(60),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (startup_id) REFERENCES startups(id),
  FOREIGN KEY (investor_id) REFERENCES investors(id)
);

CREATE TABLE outreach (                    -- ONBOARDING + LI_OUTREACH unified
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  channel ENUM('email','linkedin') NOT NULL,
  firm_name VARCHAR(255), contact_name VARCHAR(160),
  email VARCHAR(255), linkedin_url VARCHAR(512), mailbox VARCHAR(60),
  stage VARCHAR(60), sent_date DATE, fu1_date DATE, fu2_date DATE,
  replied_at DATETIME, thread_id VARCHAR(64),
  investor_id BIGINT NULL, became_investor_id BIGINT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (investor_id) REFERENCES investors(id),
  FOREIGN KEY (became_investor_id) REFERENCES investors(id)
);

CREATE TABLE founders (
  startup_id BIGINT PRIMARY KEY, name VARCHAR(160),
  email VARCHAR(255), phone VARCHAR(40), bounced BOOLEAN DEFAULT 0,
  FOREIGN KEY (startup_id) REFERENCES startups(id)
);

CREATE TABLE docs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  startup_id BIGINT NOT NULL, investor_id BIGINT NULL,
  doc_type VARCHAR(80) NOT NULL, requested_at DATETIME, received_at DATETIME,
  classification VARCHAR(60), classify_note TEXT,
  chaser_count INT NOT NULL DEFAULT 0, last_chased_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (startup_id) REFERENCES startups(id),
  FOREIGN KEY (investor_id) REFERENCES investors(id)
);

CREATE TABLE name_alias (
  alias VARCHAR(255) PRIMARY KEY, startup_id BIGINT NOT NULL,
  FOREIGN KEY (startup_id) REFERENCES startups(id)
);

CREATE TABLE task_heartbeat (
  task_id VARCHAR(80) PRIMARY KEY, last_run_at DATETIME,
  status VARCHAR(40), note TEXT
);

CREATE TABLE ai_runs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT, task_id VARCHAR(80),
  started_at DATETIME, finished_at DATETIME, status VARCHAR(40),
  model VARCHAR(80), summary TEXT
);
CREATE TABLE ai_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT, run_id BIGINT,
  at DATETIME, action VARCHAR(120), target VARCHAR(255), detail TEXT,
  FOREIGN KEY (run_id) REFERENCES ai_runs(id)
);
```

**Deliberate changes from the current model**

1. `investor_criteria` split from `investors` — criteria change independently and are diffed nightly.
2. `deal_state` split from `shares` — makes "col AG has one writer" an enforceable constraint rather than a prompt rule.
3. `cheque_currency` added — direct fix for the USD fail-open defect in §5.
4. `outreach` unifies ONBOARDING and LI_OUTREACH — the same funnel on two channels.

**Not portable, must be rebuilt in application code:** RLS (MySQL has no row-level security) and the 16 PL/pgSQL functions. `resolve_mail()` and `resolve_meetings()` matter most — they hold the entity-resolution logic (investor by email then domain; startup by longest name match in the subject; funds identified from calendar **attendees** rather than title text).

### 8.4 Data-quality issues to resolve during migration `[V]`

| Issue | Count | Action |
|---|---|---|
| Cheque floors written in USD, unparsed → blank → matches everything | 43 of 77 blank-floor active investors | `cheque_currency` + FX rate, or fail closed |
| Replies logged but unclassified | 1,362 | Backfill `classify_replies()` |
| PIPELINE sends with no Gmail twin | 107 | Reconcile or mark `superseded_by` |
| Misspelled investor names → unattributed mail | 9 names, 177 messages | Alias table |
| Old PIPELINE backfill | 3,838 rows `superseded_by='gmail'` | Exclude, or migrate as history |
| `docs` table empty while DEAL-OPS-DAILY chases 7 open requests | — | Source of truth is the chase mail, not the table |
| `investor` RLS role broken (absent from `can_see_startup`) | — | Rebuild in app auth |
| `owner` and `ops` identical in every policy | — | Collapse to one role |

---

## 9. AGENT → DATA DEPENDENCY MAP

| Agent | Startups | Investors | Criteria | PIPELINE | Mail | Meetings | Onboarding | LinkedIn |
|---|---|---|---|---|---|---|---|---|
| dealflow-state-machine | R | R | R | **RW** | W | **RW** | — | — |
| onboarding-engine | — | R | RW | — | RW | RW | **RW** | **RW** |
| thesis-engine | R | R | **W** | R | RW | R | — | — |
| middle-desk-reply-watch | R | R | R | **RW** | **RW** | **RW** | — | — |
| angel-desk-reply-watch | R | R | R | **RW** | **RW** | **RW** | — | — |
| hot-deals-reply-recorder | R | R | — | W | R | R | — | — |
| aditya-email-reply-watch | — | — | — | R | RW* | — | — | — |
| sidana-reply-capture | — | R | R | R | R | — | — | — |
| sidana-rematch-watch | R | RW | RW | RW | R | — | R | — |
| onboarding-followups | R | R | — | — | W | — | **RW** | — |
| onboarding-queue-refill | R | R | — | R | — | — | **W** | — |
| linkedin-outreach-cycle | R | R | — | R | — | — | R | **RW** |
| ENGINE-DAILY (n8n) | R | R | R | **W** | — | — | — | — |
| Outreach A–D (n8n) | R | R | — | **RW** | **W** | — | — | — |
| ONB-1 (n8n) | R | R | — | — | **W** | **RW** | — |— |
| MAIL-HISTORY (n8n) | R | R | — | — | **W** | — | — | — |
| CAL-SYNC (n8n) | R | R | — | — | — | **W** | — | — |
| SYNC-BOOK (n8n) | **W** | **W** | — | — | — | — | — | — |
| Reply Detection ×4 (n8n) | — | — | — | **W** | R | — | — | — |

`*` internal recipients only — domain-locked at the webhook.

---

## 10. EXTERNAL INTEGRATIONS

| Service | Purpose | Used by | Auth | Via | VPS requirement | Risk |
|---|---|---|---|---|---|---|
| Anthropic / Claude | All judgment | every Tier-1 agent | Claude account | Claude Code | Install + login. **Usage limits are per account, not per machine** | Weekly limit halts everything `[V]` — a run failed 5 Oct 13:19 on the session limit |
| Gmail ×6 | Read/send | desks, senders | OAuth | connector + n8n creds | Re-auth both | Silent token expiry |
| Google Calendar ×4 | Meetings | dealflow, desks, CAL-SYNC | OAuth | connector + n8n creds | Re-auth | 3 calendars are *shared into* one account |
| Google Sheets | The book | everything | OAuth (n8n) | n8n | Keep or retire | API quota; merged cells silently block writes `[V]` |
| Supabase Postgres | Derived store | n8n, dashboard, DB-READ | service_role (n8n only) + anon (app) | direct | Keep or migrate | **Direct host is IPv6-only — use the Mumbai pooler** `[V]` |
| Vercel | Dashboard hosting | users | account | — | None | — |
| Fireflies | Transcripts | dealflow, thesis-engine | API key | connector + n8n | Re-auth | Notetaker sometimes not admitted |
| Calendly | Booking links | onboarding, thesis | link only | — | None | — |
| LinkedIn | Outreach | linkedin-outreach-cycle | **browser session cookie** | Chrome | **Must not move to a datacentre IP** | Account ban |
| n8n cloud | Orchestration | everything | API key | n8n-mcp | Keep | Single point of failure |
| Read AI | Meeting reports | dealflow (fallback proof of meeting) | email delivery | — | None | — |
| Notion, Google Drive, Apify | Ancillary | occasional | OAuth / key | connectors | Re-auth | — |
| WhatsApp | planned | — | **blocked on Meta credentials** `[V]` | — | — | Not operational |

---

## 11. API & ENDPOINT INVENTORY

**Base:** `https://sidanaventures.app.n8n.cloud/webhook/<path>`
**Auth:** every webhook takes a shared `secret` in the JSON body. Write-capable ones also take `dry`, which **defaults to true**. Secrets live in the SKILL.md files and are **not reproduced here**.

| Endpoint | Workflow ID | Purpose | Called by | Active by default |
|---|---|---|---|---|
| GMAIL-SEARCH | `AI43kudplo2uMCUF` | List messages matching a query, one mailbox | 6 tasks | **Yes** |
| CAL-READ | `11bdYVjuKCkOk4sH` | Events from the 4 calendars for a date range | dealflow, desks | **Yes** |
| SHEET-READ | `m1C0zJbd3zdMUbx1` | batchGet ranges — **pilot/allocation sheets only, allowlisted** `[V]` | thesis, desks | **Yes** |
| DB-READ | `zwxXecdM2YFCmbch` | Read-only Supabase queries | cloud routine | **Yes** |
| INTERNAL-SEND | `V0NmD52cFC0HmJB4` | New mail from investors@ — **@sidanaventures.com recipients only** `[V]` | aditya-watch, desks, hot-deals | No |
| REPLY-SEND-MB2B / MB3 / MB4 / MB5 | `04qPLHnbKyU920po` / `fmqKTt6NnKwZAQdK` / `jZPS0jNUhiagPLN3` / `LRgpbZijdrDEPpxj`, `T29l4xoxbdsFNDCz` | One guarded in-thread reply from the named mailbox | desks | No |
| NEW-SEND-MB2 / MB3 / MB4 / MB5 | `FJe1d0xRL1G0tdh2`, `OfRN2my8aA40BMvR` / `QgiGt0dAh2QNScab` / `Pme6FbIOUfuKpnXI` / `GeXSmrOTVeS7c9ib` | One guarded **new** email. **Two MB5 variants exist; one rejects multi-recipient and refuses trail mails** `[V]` | desks, dealflow | No |
| CAL-CREATE | `uoYPlCSfZ8yzVlM6` | One guarded invite on the dealflow@ calendar | dealflow, desks | **Yes** |
| CAL-PATCH / CAL-PATCH-MB4 | `CvpguLofcfY4rpMr` / `MtdtZDWa4YnoJP0z` | Change time or attendees on an existing event | desks | No |
| PIPE-READ | `jVVRssFPKY4GFrOz` | Read PIPELINE rows | hot-deals, capture | No |
| PIPE-BATCH-FIX | `7AHibjZoWQ1u8wPd` | Guarded multi-row PIPELINE update | dealflow, desks | No |
| SHEET-CELL-FIX | `NAQR29LsoNJMrLtX` | Guarded cell updates + find/replace | desks | No |
| CRIT-PATCH | `MzlapX61OosgQFJQ` | Field patches to INVESTOR_CRITERIA. **Reads `A1:AC400` — off-by-one against 32 columns** `[V]` | thesis-engine, capture | No |
| LI-OUTREACH-WRITE | `D77M44hCt4fiB341` | Guarded LI_OUTREACH updates + append | linkedin-outreach-cycle | **Yes** |
| ONB-FU-READ / SENT / SHEETS / WRITE / SEND-MB5 / SWEEP / SWEEP2 / MERGE / PEEK / MERGEPROBE | see §2 | Onboarding follow-up read/write set | onboarding-followups | mixed |
| FF-LOOKUP | `Gkc662bRUD0nIYOL` | Light index of `fireflies_transcripts` | dealflow | No |
| SUPABASE-CHECK | `XZwKnnFk5IKTHyLf` | Table counts + recent shares | diagnostics | **Yes** |

**Supabase:** project `elwaquzawoscotlojtnv`; pooler `aws-0-ap-south-1.pooler.supabase.com:5432`, user `postgres.elwaquzawoscotlojtnv`. **`[V]` The direct host is IPv6-only and unreachable from this network — always use the pooler.**

**Dashboard:** `https://sidana-ops.vercel.app` — routes `/login`, `/`, `/startup/[id]`, `/investor/[id]`, `/ask`, `/changes`. Edge runtime. `[P]`

**`[NV]`** Webhook paths and secrets exist in the SKILL.md files; deliberately omitted. Node-level internals of the 46 active workflows were not exported — use `n8n_get_workflow` per ID, or n8n's own export.

---

## 12. CURRENT INFRASTRUCTURE / ENVIRONMENT

| Component | Where | Notes |
|---|---|---|
| Tier-1 agents | **Aditya's laptop** — Windows 11 Home SL 10.0.26200 | Claude Code desktop app |
| Cron layer | Claude Code `scheduled-tasks` MCP | **No standalone scheduler. Dies with the app** |
| Agent prompts | `C:\Users\Aditya\.claude\scheduled-tasks\<id>\SKILL.md` | 34 folders, 4–57 KB each. **Not in git** |
| Per-task state | same folders, plus `sidana-captures/*.md`, `chain-last-run.txt` | **Not in git, not backed up** |
| MCP | `n8n-mcp`, global npm | machine-bound |
| Repo | `C:\Users\Aditya\Downloads\sidana-ops`, branch `main`, clean | Next.js 14.2.15, Node v24.20.0 |
| Dashboard | Vercel | moved off Cloudflare Pages ~5 Oct |
| Database | Supabase cloud | — |
| Orchestration | n8n cloud | — |
| Browser session | Chrome on the laptop | LinkedIn only |

**`n8n status: USED`** — heavily, and it is the only 24/7 tier. `[V]` 46 active workflows, ~150 total including spent one-offs. Not a developer convenience; load-bearing.

**Parallel-session hazard `[V]`:** several Claude sessions run at once (3 observed simultaneously). They share n8n webhooks through activate/deactivate and can collide. Session-to-session messaging is **blocked in unattended runs**, so agent handovers silently fail — this happened on 5 Oct and left a double-booked meeting unresolved.

---

## 13. CURRENT → TARGET ARCHITECTURE

### Current (verified)

```
  Aditya's laptop — available 10:00–18:00 only
   ├── Claude Code desktop app
   │    ├── scheduled-tasks cron ──► 13 recurring + 3 armed agents
   │    ├── n8n-mcp (stdio)
   │    └── Chrome session ──► LinkedIn
   └── repo (dashboard source)
            │ HTTPS
            ▼
  n8n cloud — 46 active workflows — 24/7
   ├── schedulers: ENGINE-DAILY, MAIL-HISTORY, CAL-SYNC, SYNC-BOOK, FIREFLIES-SYNC,
   │               Reply Detection x4, DAILY-REPORT, BOUNCE-WATCH, ONB-TRACK, ...
   ├── senders:    Outreach A-D, ONB-1, ASK-SEND, Weekly Founder Update
   └── ~20 on-demand webhook tools (activated per call, then deactivated)
            │
    ┌───────┴────────┐
    ▼                ▼
 Google Sheets    Supabase Postgres ──► Vercel dashboard (read-only)
 (book of record) (derived mirror + event log)

 External: Gmail x6 · Calendar x4 · Fireflies · Calendly · LinkedIn · Read AI
```

### Target Phase 1 (proposed)

```
  VPS — Linux, 24/7                                  ✔ confirmed need  ◻ proposed
   ├── Claude Code + account login                   ✔
   ├── scheduler: systemd timers (replaces desktop cron)   ✔
   ├── 12 agent SKILL.md prompts, git-tracked        ✔
   ├── n8n-mcp                                       ✔
   ├── MySQL  (or retained Postgres — see §8.1)      ◻
   ├── state files on disk + nightly backup          ✔
   └── structured logging / health checks            ◻

  Aditya's laptop — KEEPS ONLY:
   └── linkedin-outreach-cycle
       + the LinkedIn half of onboarding-engine (needs a real Chrome session)

  Unchanged: n8n cloud · database · Vercel
  External:  Claude API · Gmail · Calendar · Fireflies · LinkedIn
```

---

## 14. VPS MIGRATION REQUIREMENTS

### Must migrate
- 13 recurring + 3 armed `SKILL.md` prompts — **put under git first; currently unversioned and unbacked-up**
- Per-task state files, `sidana-captures/*.md`, `chain-last-run.txt`
- `n8n-mcp` install plus its two environment variables

### Must recreate
- **The scheduler.** Claude Code's `scheduled-tasks` MCP is part of the desktop app with no headless equivalent. Replace with systemd timers or cron invoking `claude -p` per task. **This is the largest unknown in the migration — see §19 blocker 1.**
- Jitter (0–730 s), currently supplied by the task runner
- Gmail / Calendar / Fireflies / Drive / Notion connector authorisation from the new host

### Must configure
- Claude Code login; `TZ=Asia/Kolkata` — every schedule and every prompt assumes IST
- Node ≥ 20 (laptop runs v24.20.0)
- Outbound HTTPS to `sidanaventures.app.n8n.cloud`, Anthropic, Google APIs, Supabase pooler
- Log rotation; disk for state files

### Must replace
- `onboarding-engine` → split into an **email half (VPS)** and a **LinkedIn half (laptop)**
- Cross-session handover, which is blocked in unattended runs → replace with a queue table

### Must verify
- Whether claude.ai connectors can be authorised from a **headless** Linux host, or require interactive browser consent
- Whether `claude -p` non-interactive runs can use connectors at all
- Usage-limit headroom for 13 agents × ~8 runs/day on one account

### Cannot be migrated without more information
- LinkedIn automation — stays on the laptop by design
- Exact Sheets column headers (§8.2)
- n8n credential inventory — `[NV]` not enumerated; needed if n8n is ever replaced

---

## 15. 24/7 RELIABILITY REQUIREMENTS

| Need | Current state | Gap to close |
|---|---|---|
| Process restart | none | systemd `Restart=always` |
| Missed-schedule catch-up | agents detect a gap via a timestamp file and **report** it, but do not replay | catch-up logic, or accept the loss explicitly |
| Retries | none | wrap each run |
| Duplicate prevention | prompt rules only ("never a nudge and a new ask the same day") | DB uniqueness constraints |
| Error handling | webhooks return opaque `{"message":"Error in workflow"}` | surface `errorInfo.primaryError.message` |
| Logging | run-summary emails to investors@ | structured rows in `ai_runs` / `ai_log` — tables exist, largely unused |
| Alerts | `TASK-HEARTBEAT` hourly 11–18 Mon–Fri | widen once the VPS is live |
| Health checks | `SUPABASE-CHECK`, on demand | automate |
| Backup | **none for SKILL.md or state files** | git + nightly DB dump |
| Auth expiry | silent failure | monitor and alert |
| API failure | none | backoff |
| **Usage limits** | **halts every agent at once** `[V]` | monitor; consider API billing instead of a seat plan |

**Verified outage history:** 1 Oct 21:48 → 5 Oct (84 h, cost a missed Spintly call) · no runs at all 2–4 Oct · 5 Oct 17:43 → 6 Oct 10:10 · 5 Oct 13:19 run failed on the session limit.

---

## 16. SECURITY REQUIREMENTS

| Item | Where it must live | Rule |
|---|---|---|
| Supabase `service_role` key | **n8n only** | standing instruction: *must never go into the project folder or `.env.local`* |
| Supabase anon / publishable key | `.env.local` (shipped to the browser) | the only key permitted there |
| n8n API key | environment variable for `n8n-mcp` | — |
| Webhook shared secrets | SKILL.md files | **unversioned plaintext today — move to a secret store on migration** |
| Gmail / Calendar / Drive / Notion OAuth | connector + n8n credential store | re-authorise per host |
| Fireflies API key | connector + n8n | — |
| LinkedIn session cookie | Chrome profile on the laptop | never on a server |
| Database credentials | environment only | standing instruction: *environment variable for the run only* |

**Standing instructions of record:** never write credentials into the project folder or `.env.local`; never print them back; **`seed.sql` in the repo is a stale September snapshot and must not be run**.

**VPS hardening:** SSH keys only, no password auth; outbound-only firewall plus SSH. The host will hold live access to all six mailboxes, so it must not be a shared or casually-used machine.

---

## 17. FAILURE POINTS & RISKS

| Component | Failure scenario | Business impact | Current handling | Recommended |
|---|---|---|---|---|
| **Laptop closed** | All 13 agents stop while n8n keeps sending | **Deals go out and nobody answers.** 84-hour outage cost a meeting | heartbeat alarm only | VPS |
| **Claude usage limit** | Every agent fails simultaneously, mid-sequence | Total stop | none | monitor; API billing |
| **Cheque floor fails open** | USD floors parse to NULL, so the investor matches every raise | Wrong investors pitched; reputational | none | `cheque_currency` + FX, or fail closed |
| **SKILL.md unversioned** | Disk loss destroys all agent logic | Unrecoverable | none | **git today** |
| Webhook activate/deactivate race | Session A deactivates while B is mid-call | Silent failure | prompt warning only | per-call tokens, or leave read-only tools active |
| Cross-session handover blocked | Unattended runs cannot message another session | Items silently dropped `[V]` 5 Oct | none | queue table |
| Half-written pass | `investor_response` set but chases left live | Investors chased after passing | 3 desks sweep up after it | identify the writer |
| LinkedIn session expiry | Invites stop | Pipeline dries up | none | detect + alert |
| Fireflies not admitted | No transcript | No trail mail, no thesis capture | Read AI used as fallback proof | — |
| Merged Sheets cells | Writes silently refused | Follow-ups not recorded | ONB-FU-MERGE unmerges them | MySQL eliminates the class |
| Two NEW-SEND-MB5 variants | One refuses multi-recipient sends | Trail mail fails | reference file corrected 5 Oct | delete the wrong one |
| Supabase IPv6-only direct host | Connection failures from this network | Tooling breaks | use the pooler | documented |

---

## 18. HUMAN-DEPENDENCY AUDIT

| Manual step | Why required | Automatable? | Priority |
|---|---|---|---|
| **Laptop on 10:00–18:00** | agents run there | **Yes — VPS** | **1** |
| Founder confirmation before booking | explicit rule, Aditya 26 Sep | No — deliberate | keep |
| Akansha must move her own calendar events | only the organiser can | Partly — `CAL-PATCH-MB4` exists | 3 |
| Aditya adds new investors | his stated only job | No | keep |
| Resolving conflicting founder instructions | two desks each saw half a conversation | **Yes — shared ledger** | **2** |
| Manual Sheets edits | the book is a spreadsheet | Yes — MySQL + a UI | 2 |
| Re-authorising connectors | OAuth expiry | No | monitor |
| Restart after a crash | no supervisor | **Yes — systemd** | 1 |
| Reading the daily report emails | reporting is email-only | Partly — dashboard already exists | 4 |
| Deciding the cheque-floor FX policy | judgment call | No | **1 — blocks correct matching** |

---

## 19. UNKNOWN / MISSING INFORMATION

### Critical blockers

```
1. Can Claude Code run scheduled agents headless on Linux?
   The scheduled-tasks cron is part of the desktop app. Needs proof that
   `claude -p` under systemd works unattended with connectors available.
   WITHOUT THIS, THE ENTIRE VPS PLAN IS UNPROVEN.

2. Do claude.ai connectors (Gmail / Calendar / Fireflies) authorise from a
   headless host, or do they require interactive browser consent?

3. Exact Sheets column headers for all 12 tabs.
   Blocked: SHEET-READ's allowlist rejects the book. Use PIPE-READ or export.

4. Claude account usage headroom for 13 agents running 24/7.
   A run already failed on the session limit on 5 Oct.

5. Is MySQL actually required, or is keeping Postgres acceptable? (§8.1)
```

### Important but non-blocking

```
6.  n8n credential inventory — names and scopes not enumerated.
7.  Node-level internals of the 46 active workflows not exported.
8.  Which model each agent ran under; no model is pinned in any SKILL.md.
9.  Identity of the writer that half-records a pass.
10. Whether the 3,838 superseded PIPELINE rows should migrate as history.
11. Ownership of the 14 startups with a blank desk column.
12. n8n cloud plan execution quota.
```

### Nice to have

```
13. Why `docs` is empty while DEAL-OPS-DAILY chases 7 open requests.
14. Whether the `investor` RLS role was ever intended to work.
15. Disposition of ~100 spent one-off n8n workflows.
16. WhatsApp integration scope (blocked on Meta credentials).
```

---

## 20. MIGRATION PLAN

| Phase | Tasks | Depends on | Expected output | Risk |
|---|---|---|---|---|
| **0. Preserve** | `git add` all 34 SKILL.md files and task state into a private repo. **Do this before anything else** | — | Nothing is one disk failure from gone | None. Highest value per minute spent |
| **1. Prove the runtime** | Cheap VPS. Install Claude Code. Run **one read-only agent** (`sidana-1745-brief-prep`) on a timer for 48 h | blockers 1, 2 | Yes/no on the whole plan | **If this fails, replan — do not proceed** |
| **2. Data audit** | Export all 12 tabs. Headers, types, null rates, duplicates, orphans | blocker 3 | Field inventory | Hidden formulas, merged cells |
| **3. Schema** | Finalise §8.3. Decide Option A vs B | blocker 5, phase 2 | Agreed DDL | Over-engineering |
| **4. Migrate data** | Load Sheets → DB. Reuse SYNC-BOOK's parsers but **fix the USD path first** | phase 3 | Populated DB | Silent currency loss |
| **5. Validate** | Row counts vs Sheets; FK integrity; re-run `v_startup_funnel` and compare to today | phase 4 | Signed-off dataset | — |
| **6. Adapt agents** | Rewrite SKILL.md data access: DB instead of Sheets webhooks. One agent at a time, read-only ones first | phase 5 | Agents on the DB | 13 prompts, each a regression surface |
| **7. MCP + scheduler** | `n8n-mcp` on the VPS; systemd timers with jitter; re-authorise connectors | phase 1 | Full stack on the VPS | OAuth |
| **8. Deploy** | Move agents in waves: read-only → recorders → senders. **Senders last** | phases 6, 7 | Running on the VPS | Double-sending if both hosts run an agent |
| **9. Test 24/7** | Two weeks parallel. Compare outputs daily. Kill switch ready | phase 8 | Confidence | — |
| **10. Cutover** | Disable laptop tasks except LinkedIn. Monitor for a week | phase 9 | Done | — |

**Hard rule for phase 8:** an agent must never be enabled on the laptop and the VPS at the same time. Two sessions answering the same investor is a failure this system has already produced once.

---

## 21. FINAL SYSTEM CHECKLIST

### Discovered
- [x] Agents — 13 recurring + 3 armed + 18 retired (Tier 1); 46 active n8n (Tier 2)
- [x] MCP servers — 1 local (`n8n-mcp`), 8 claude.ai connectors, 4 desktop-app internals
- [x] Tools — ~20 n8n webhook endpoints with IDs
- [x] Triggers — all cron; **no event-driven trigger exists in Tier 1**
- [x] Data sources — Sheets (book), Supabase (16 tables / 14 views / 16 functions), Gmail ×6, Calendar ×4, Fireflies, LinkedIn, local state files
- [x] APIs — §11
- [x] Integrations — §10
- [x] Dependencies — §17, §18

### Migration
- [ ] Sheets audit — **blocked on column headers**
- [x] MySQL schema **proposed** (§8.3), not agreed
- [ ] Data migration
- [ ] Agent changes
- [ ] MCP migration — **blocked on the headless-runtime question**
- [ ] VPS deployment
- [ ] Monitoring
- [ ] Backups — **not started; highest-value immediate action**

### Unknowns
- [x] All blockers identified (§19)

---

## COMPLETENESS CHECK

**"If the original developer disappeared tomorrow, could another engineer use this document?"**

**Yes, for:** what exists, what triggers what, what reads and writes what, the database model, the integration surface, the failure modes, and the order in which to migrate.

**Not yet, for — in priority order:**

1. **Proving Claude Code can run agents headless.** Every other migration step is downstream of this single experiment, and it has never been tested. If it fails, the architecture needs rethinking, not porting.
2. **Exact Sheets column headers** — required before any field-level migration script can be written.
3. **Node-level n8n internals** — the 46 active workflows were inventoried by name, trigger and purpose, but not exported.

**Do first, regardless of any other decision:** put the 34 `SKILL.md` files and the task state folders under version control. They contain the entire behavioural specification of this system — the stage machine, the booking rules, the guard conditions, the hard-won corrections — they exist on exactly one unbacked-up disk, and they are not reconstructible from anything else recorded here.
