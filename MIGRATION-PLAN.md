# Sidana — Cloud Migration Master Plan (PLANNING ONLY)

**Status: PLANNING. No implementation performed. No production change made.**
Compiled 2026-10-07. Companion to `HANDOVER-SYSTEM.md` (architecture audit) and
`ENGINES-detailed-specs.md` (engine internals). Not repeated here.

Verification key: `[V]` inspected directly · `[P]` stated in a definition read but not executed · `[NV]` not verified.

---

## 0. THE PREMISE NEEDS CORRECTING BEFORE ANY WORK STARTS

The brief asks to *"create a reliable cloud-based n8n environment capable of running 24/7"*
and to remove dependence on the laptop. Those are two different problems, and the first
one is already solved.

**n8n is already cloud-hosted and already runs 24/7.** `[V]` It is on
`sidanaventures.app.n8n.cloud`. It fires at 07:30 and 08:00 every weekday whether the
laptop is open, shut, or in a bag. Nothing about n8n depends on Aditya's machine.

**Migrating n8n would therefore deliver zero reliability improvement.** It would consume
the budget and leave the actual outage cause untouched.

### What actually depends on the laptop

Thirteen **Claude Code scheduled tasks** — the judgment layer. They read free-form
investor email, decide what it means, and write replies in a human voice. n8n cannot
replace them: n8n moves data between fixed points, it does not read a paragraph and
decide whether an investor just passed.

```
        LAPTOP (10:00-18:00 only)          CLOUD (24/7, already fine)
        ─────────────────────────          ─────────────────────────
        13 Claude Code agents      ──►     n8n: 348 workflows, 46 active
        the judgment layer                 Supabase Postgres
        THIS is the outage                 Vercel dashboard
```

The verified failure mode: on a laptop-off weekday, **n8n keeps sending deals at 08:00
and nothing reads the answers.** `[V]` 84-hour silence 1–5 Oct; no runs at all 2–4 Oct;
a Spintly call was missed.

**Restated objective:** give the thirteen agents a 24/7 host. Leave n8n where it is.

---

## 1. EXECUTIVE SUMMARY

| | |
|---|---|
| What runs the business | 348 n8n workflows (**46 active**) + 13 Claude Code agents |
| What is already 24/7 | n8n, Supabase, Vercel |
| What dies with the laptop | all 13 agents, plus LinkedIn |
| Real migration scope | **13 agents and ~20 n8n workflows**, not 348 |
| Single largest unknown | **Can Claude Code run headless?** Untested. Everything depends on it |
| Recommended target | Small Linux VPS running Claude Code under systemd. n8n and Supabase unchanged |
| Database recommendation | **Keep Postgres. Do not migrate to MySQL.** See §6 |
| Estimated cost | **₹900–2,000/month** incremental |
| Estimated effort | 3–5 weeks part-time, gated on a 48-hour feasibility test |

---

## 2. CURRENT SYSTEM MAP

See `HANDOVER-SYSTEM.md` §13 for the full diagram. Summary of verified counts:

| Layer | Component | Count | 24/7? |
|---|---|---|---|
| Judgment | Claude Code scheduled tasks | 13 recurring + 3 armed | **No — laptop** |
| Orchestration | n8n cloud workflows | 348 total, **46 active** | Yes |
| Storage | Supabase Postgres | 16 tables, 14 views, 16 functions | Yes |
| Storage | Google Sheets (book of record) | ~12 tabs | Yes |
| Presentation | Next.js on Vercel | 6 routes | Yes |
| Local MCP | `n8n-mcp` | **1** | No — laptop |
| Cloud connectors | Gmail, Calendar, Fireflies, Drive, Notion, Apify, Docs | 8 | account-bound |

**On the 348 figure.** Confirmed >300 by pagination `[V]`. But the distribution matters
far more than the total:

- **46 active.** Of those, ~20 are scheduled jobs that actually do work; the other ~26 are
  on-demand webhook tools that only run when an agent calls them.
- **~300 inactive**, overwhelmingly spent one-offs: `One-off TR-15 — remove duplicate deal
  pairs`, `One-off CA-1 — clear do_not_contact on Climate Angels`, and so on. Each ran once
  in September and is dead.

**Nothing is gained by migrating 300 dead workflows.** They should be archived, not moved.
The honest migration surface is **46**, and the critical path is **~20**.

---

## 3. LAPTOP DEPENDENCY MAP

| Component | Why the laptop is required | Workflows affected | Cloud replacement | Complexity | Risk |
|---|---|---|---|---|---|
| **Claude Code scheduler** | `scheduled-tasks` is part of the desktop app. No headless equivalent | all 13 agents | systemd timers invoking `claude -p` | **High — unproven** | **Critical** |
| **Claude Code runtime** | The agents are Claude sessions | all 13 | Claude Code on Linux | Medium | Critical |
| **`n8n-mcp` (stdio)** | Local npm process | agent → n8n control | reinstall on host | Low | Low |
| **Chrome session (LinkedIn)** | No API. Session cookie. Datacentre IP gets banned | `linkedin-outreach-cycle`, half of `onboarding-engine` | **None — must stay local** | n/a | Medium |
| **Local state files** | 17 capture files + cursors on one disk | reply capture, rematch, aditya-watch | move with the agents, or to DB | Low | **High — no backup** |
| **Task definitions** | 34 SKILL.md on one disk | all | now in git `[V]` | Done | Resolved |

**Not laptop-dependent, despite assumptions in the brief:** there are no local Python or
Node automation scripts, no localhost APIs, no Docker, no Windows Task Scheduler jobs, and
no local database. `[V]` The only local script is `load-book.js`, a one-time loader.

---

## 4. WORKFLOW CLASSIFICATION

| Cat | Definition | Count | Action |
|---|---|---|---|
| **A** | Already cloud-compatible, no change | **~20** active n8n scheduled jobs | Leave alone |
| **B** | Minor change | ~26 on-demand webhook tools | Leave; re-point if agents move host |
| **C** | **Claude/agent dependency** | **13 agents** | **The actual project** |
| **D** | Local file dependency | 3 agents with state files | Move state with them |
| **E** | Database migration required | 0 | None — see §6 |
| **F** | Complex external side effects | 4 Outreach senders + ONB-1 | Do not touch. Highest blast radius |
| **G** | Architectural redesign | **1** — `onboarding-engine` | Split email half from LinkedIn half |
| **Z** | **Dead one-offs** | **~300** | **Archive, do not migrate** |

**Migration order (lowest risk first):**

1. `sidana-1745-brief-prep` — read-only, no sends, no state. **The canary.**
2. `hot-deals-reply-recorder` — records only, never sends `[V]`
3. `sidana-reply-capture` — reads, writes a file, mails only Aditya
4. `onboarding-queue-refill` — research and append
5. `thesis-engine` — sends, but low volume
6. `middle-desk-reply-watch`, then `angel-desk-reply-watch`
7. `dealflow-state-machine` — highest value, highest blast radius
8. `onboarding-engine` — **only after the split in §G**
9. `aditya-email-reply-watch` — last; it is the control channel
10. `linkedin-outreach-cycle` — **never. Stays on the laptop by design**

---

## 5. MCP / CLAUDE DEPENDENCIES

Full inventory in `HANDOVER-SYSTEM.md` §4. The decision-relevant finding:

**There is exactly one local MCP server — `n8n-mcp`.** `[V]` Everything else commonly
mistaken for MCP (Gmail, Calendar, Fireflies, Drive, Notion, Apify) are **claude.ai
connectors**: cloud-hosted, account-bound, nothing installed locally. There is no custom
Sidana MCP server and no bespoke integration code.

| MCP tool | Can n8n replace it? | Can a direct API replace it? | Recommendation |
|---|---|---|---|
| `n8n-mcp` | n/a | Yes — n8n REST API | Reinstall on host; or call the API directly |
| Gmail connector | Partly — n8n has Gmail nodes | Yes | **Keep the connector.** The agents need to *read and judge*, not just fetch |
| Calendar connector | Yes — n8n has Calendar nodes | Yes | Keep |
| Fireflies connector | Already have FIREFLIES-SYNC in n8n | Yes | Either |
| Drive / Notion / Apify | — | — | Rarely used; drop if they complicate the host |

**The open question, and it is the whole project:** do claude.ai connectors authorise from
a **headless** Linux host, or do they require an interactive browser consent? `[NV]`
**Nobody has tested this.** If they need a browser, the agents cannot run headless and the
architecture needs rethinking rather than porting.

---

## 6. DATABASE STRATEGY

### Recommendation: keep Supabase Postgres. Do not migrate to MySQL.

The earlier brief asked for Excel → MySQL. Having inspected the database, that would
destroy working infrastructure:

| Fact | Implication |
|---|---|
| A normalised model **already exists** — 16 tables, 20 FKs, 14 views, 16 functions `[V]` | The modelling work is done |
| It is **already populated hourly** from Sheets by SYNC-BOOK, MAIL-HISTORY, CAL-SYNC `[V]` | The ETL is done |
| The business logic lives in **PL/pgSQL functions** — `resolve_mail()`, `resolve_meetings()`, `classify_replies()` | MySQL has no equivalent; all would be rewritten in app code |
| Row Level Security gates the dashboard by role | **MySQL has no RLS.** Access control moves into the app |
| 42,319 rows in `mail_log`, 11,069 shares, 3,360 matches `[V]` | Migration risk is real, benefit is zero |

**MySQL offers nothing Postgres does not already provide here, and costs the functions and RLS.**

**What should change instead** — the direction of truth. Today Sheets is authoritative and
Postgres is a mirror. That is backwards: it is why merged cells silently swallow writes and
why a parser bug can corrupt the book. Target state: the database is authoritative, and a
job pushes a human-readable view back to Sheets.

That is a **Phase 3+ change**, not part of the laptop migration, and should not be bundled with it.

**If MySQL is mandated for an external reason** `[NV]`, the DDL is in `HANDOVER-SYSTEM.md`
§8.3. Budget 2–3 extra weeks for function and RLS rewrites.

### Database defect that outranks the migration

`ENGINE-DAILY` `[V]`: `if (cmin === null) gate('cheque', true, 'no minimum on file')` — a
blank cheque floor **passes every raise**. SYNC-BOOK's parser returns null for any dollar
figure, so **43 of 77 blank-floor active investors currently match everything**.
A91 Partners ($10M–$50M) passes the cheque gate on a ₹1.2 Cr round.

**Fix this before migrating anything.** It is a one-column change plus an FX rate, it is
actively producing wrong outreach today, and migration will not touch it.

---

## 7. CLOUD ARCHITECTURE OPTIONS

| | **A — VPS + Claude Code** | **B — n8n self-host + VPS** | **C — Rebuild agents as n8n AI nodes** |
|---|---|---|---|
| Shape | Small Linux VPS runs Claude Code under systemd. n8n Cloud, Supabase, Vercel unchanged | Move n8n off cloud onto own VPS alongside Claude Code | Replace the 13 agents with n8n AI Agent nodes calling Claude's API |
| Complexity | **Low** — move 13 prompt files, install, re-auth | High — migrate 348 workflows and all credentials | **Very high** — rewrite every agent |
| Reliability | Good. One box, restartable | Worse — now you own n8n's uptime too | Good once built |
| Fixes the actual problem? | **Yes** | Yes, with unnecessary extra work | Yes |
| Maintenance | One VPS, one runtime | One VPS, two runtimes, n8n upgrades | n8n only |
| Monthly cost | **₹900–1,300** | ₹1,700–2,600 | ₹0 extra + higher API spend |
| Suited to 348 workflows? | Irrelevant — they stay put | Must migrate all 348. High risk | Irrelevant |
| Main risk | Headless Claude unproven | Breaking a working system | Loses judgment quality; months of work |
| Reversible? | **Yes — laptop stays as fallback** | Hard | No |

**Also considered and rejected:** Anthropic's own cloud routines. Already built and tested
this project — **the sandbox blocks all outbound traffic to non-Anthropic hosts** `[V]`, so
it cannot reach n8n, Gmail or the calendar. The cloud deal-flow routine exists and sits
disabled for exactly this reason. Dead end, proven by test rather than assumption.

---

## 8. RECOMMENDED ARCHITECTURE — Option A

```
  VPS (Linux, 24/7, ~₹900/mo)
   ├── Claude Code + account login
   ├── systemd timers (replaces the desktop scheduler) + jitter
   ├── 12 agent SKILL.md prompts, from the git repo
   ├── n8n-mcp
   ├── agent state files + nightly backup
   └── logging to ai_runs / ai_log (tables already exist, unused)

  Aditya's laptop — KEEPS ONLY
   └── linkedin-outreach-cycle + the LinkedIn half of onboarding-engine

  UNCHANGED: n8n Cloud · Supabase · Vercel · Google Workspace
```

**Why A.** It fixes the actual problem and nothing else. n8n is working, cloud-hosted and
24/7 — moving it adds risk and cost for no gain. The laptop stays as a live fallback
throughout, which makes rollback trivial. It is the smallest change that solves the outage.

**Specification:** 2 vCPU, 4 GB RAM, Ubuntu LTS, 40 GB disk. `TZ=Asia/Kolkata` — every
schedule and every prompt assumes IST. Hetzner, DigitalOcean Bangalore or AWS Lightsail
Mumbai are all adequate; region is irrelevant since the work is API calls.

---

## 9. MIGRATION ROADMAP

| Phase | Objective | Key tasks | Output | Rollback | Approval? |
|---|---|---|---|---|---|
| **0** | Preserve | Task definitions into git **(done `[V]`, commit `69e24c3`)**; add state files; nightly DB dump | Nothing unrecoverable | n/a | No |
| **1** | **Prove the runtime** | One VPS. Install Claude Code. Run `sidana-1745-brief-prep` on a timer for 48 h. Confirm connectors authorise headless | **Go / no-go on the entire plan** | Delete the VPS | **Yes — gate** |
| **2** | Fix the cheque defect | Add currency + FX, or fail closed. Re-run the matcher dry | Correct matching | Revert column | **Yes** |
| **3** | Host hardening | systemd units + jitter, log rotation, restart policy, health endpoint | Reliable host | — | No |
| **4** | Move read-only agents | Agents 1–4 in §4 order. **Laptop copies disabled as each moves** | 4 agents off the laptop | Re-enable on laptop | No |
| **5** | Split `onboarding-engine` | Email half → VPS, LinkedIn half → laptop task | Clean separation | Keep the combined original | **Yes** |
| **6** | Move the desks | Middle, then angel. One week apart | Replies answered 24/7 | Re-enable on laptop | **Yes** |
| **7** | Move the deal flow engine | Highest value, highest blast radius. Two weeks observation | Full stage machine 24/7 | Re-enable on laptop | **Yes** |
| **8** | Monitoring | Alerts, heartbeat widened, missed-run detection | Visible failures | — | No |
| **9** | Parallel validation | Two weeks. Compare outputs daily | Confidence | — | No |
| **10** | Cutover | Disable remaining laptop tasks except LinkedIn | Done | Laptop still has everything | **Yes** |

**Hard rule throughout:** an agent must never be enabled on the laptop and the VPS at the
same time. Two sessions answering one investor is a failure this system has already
produced. `[V]`

---

## 10. TESTING STRATEGY

Per migrated agent, before its laptop copy is disabled:

| # | Test | Pass criterion |
|---|---|---|
| 1 | Normal run | Same actions as the laptop copy on the same inputs |
| 2 | Empty input | Exits cleanly, no spurious send |
| 3 | Malformed reply | Classified or escalated, never guessed |
| 4 | n8n webhook 500 | Logged with real error text, retried or reported |
| 5 | Database unreachable | No partial write |
| 6 | Claude API failure / usage limit | Fails loud, does not half-complete |
| 7 | Timeout mid-sequence | Next run detects and resumes |
| 8 | Duplicate execution | **Critical.** Same reply must not be answered twice |
| 9 | Missed window | Gap detected and reported |
| 10 | Rollback | Laptop copy resumes cleanly from current state |

**Comparing old and new safely:** run the VPS copy in **report-only mode** for one week —
it decides what it would do and writes it to a log, but every send is suppressed. Diff
against what the laptop actually did. Only when the diff is empty for five consecutive days
does the VPS copy get send rights and the laptop copy get disabled.

Every write-capable n8n webhook already supports `dry: true` and defaults to it `[V]`. That
is the existing mechanism for this and it should be reused rather than reinvented.

---

## 11. SECURITY PLAN

Baseline in `HANDOVER-SYSTEM.md` §16. Changes required for the VPS:

| Area | Requirement |
|---|---|
| Secrets | **Already fixed `[V]`** — 149 occurrences of 27 values lifted into one gitignored file (commit `69e24c3`). On the VPS they become environment variables, not a file |
| Credential isolation | Supabase `service_role` stays in n8n only. The VPS never holds it |
| Host access | SSH keys only, no password auth. Outbound-only firewall plus SSH |
| Least privilege | VPS gets its own Claude login and its own n8n API key, scoped and separately revocable |
| Environment separation | Staging uses test mailboxes and a Supabase branch. **Never production mailboxes** |
| Audit | Every agent run writes to `ai_runs` / `ai_log` — tables exist, currently unused |
| Rotation | n8n and Claude account passwords were emailed in plaintext on 6 Oct `[V]`. **Rotate both and enable 2FA before the VPS is given access** |

**Known exposure to close:** the 25 `.bak` task copies still contain the pre-extraction
secrets. They are gitignored but present on disk. Delete or encrypt them.

---

## 12. ROLLBACK PLAN

Rollback is unusually cheap here, and that should be preserved deliberately.

| Mechanism | Detail |
|---|---|
| The laptop stays intact | Every agent remains installed and merely disabled. Re-enabling is one toggle, ~10 seconds |
| State is external | Stage lives in PIPELINE col AG, replies in Gmail, meetings in Calendar. **No state lives only on the VPS**, so switching hosts loses nothing |
| Duplicate prevention | One host per agent, enforced by checklist at every phase gate |
| Data integrity | Agents are idempotent by design — they re-read the mailbox each run and rebuild their ledger. A repeated run re-derives rather than double-writes |
| Verification | After rollback: confirm the laptop agent completed a full run, and that `mail_log` shows no duplicate outbound in the window |
| Hard stop | Deactivate the four Outreach senders and ONB-1 in n8n. That halts all outbound within one minute regardless of host |

---

## 13. REQUIRED ACCESS

### Read-only (for audit completion)
- n8n: already held `[V]`
- Supabase: already held via pooler `[V]`
- Google Sheets: **not held** — `SHEET-READ`'s allowlist rejects the book `[V]`. Needed for column headers
- GitHub `investors-bit`: read
- Vercel: read

### Implementation (later, on approval)
- VPS root/sudo (new machine, no existing access needed)
- A **separate** Claude account or seat for the VPS
- A **separate** n8n API key, scoped, separately revocable
- n8n workflow edit — **only** for the ~20 active scheduled jobs
- Supabase: schema change rights **only** for the cheque-currency column
- Google Sheets: read for the book; write only if Sheets becomes a projection

### Explicitly not required
Production Vercel deploys, DNS, GitHub production branch, Supabase RLS changes, or
credential rotation — that last one is the user's own action, not the engineer's.

---

## 14. COST / RESOURCE PLAN

| Item | Monthly (INR) | Note |
|---|---|---|
| VPS, 2 vCPU / 4 GB | 450–1,100 | Hetzner cheapest; DO Bangalore ~₹1,000 |
| Backups | 50–150 | Snapshot plus offsite DB dump |
| Monitoring | 0 | Healthchecks.io free tier is sufficient |
| Domain / HTTPS | 0 | No new public endpoint needed |
| n8n Cloud | unchanged | Existing plan |
| Supabase | unchanged | Existing plan |
| Vercel | unchanged | Existing plan |
| **Incremental total** | **₹900–2,000** | |

**The cost that actually matters is not infrastructure.** Thirteen agents running
10:00–18:00 already hit the Claude weekly limit — a run failed on 5 Oct at 13:19 with
*"You've hit your session limit"* `[V]`, and `/compact` failed on 6 Oct for the same reason.
Running them 24/7 reaches that ceiling **faster, not slower**.

**A server fixes uptime, not usage.** Before Phase 4, decide whether to raise the plan or
move the agents to API billing. This is a genuine blocker and is not solved by the VPS.

---

## 15. RISKS AND BLOCKERS

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| 1 | **Claude Code cannot run headless** | Entire plan invalid | **Unknown** | Phase 1 is exactly this test. Do nothing else first |
| 2 | **Connectors need browser consent** | Agents cannot reach mail | Unknown | Same test |
| 3 | **Usage limit** | Agents stop in production | **High — already happening** | Decide billing before Phase 4 |
| 4 | Both hosts run one agent | Investor answered twice | Medium | One-host rule at every gate |
| 5 | Cheque gate fails open | Wrong investors pitched | **Occurring now** | Phase 2, before migration |
| 6 | LinkedIn session on a server | Account ban | Low if plan followed | Never migrate it |
| 7 | Secrets in `.bak` files | Credential exposure | Low | Delete or encrypt |
| 8 | Leaked n8n / Claude passwords | Full system compromise | **Live now** `[V]` | Rotate + 2FA immediately |
| 9 | Sheets headers unobtainable | Blocks any schema work | Medium | Use PIPE-READ or widen the allowlist |
| 10 | Agents misread `{{PLACEHOLDER}}` | Agents fail tomorrow | Low | Watch the 10:10 run; `git show 69e24c3` reverts |
| 11 | 348 workflows treated as scope | Weeks wasted | Medium | Scope is 46 active, ~20 critical |
| 12 | Parallel sessions collide on shared webhooks | Silent failures | Medium | Per-call tokens, or leave read-only tools active |

### Blockers, in order

1. **Headless feasibility — untested.** Gates everything.
2. **Usage limit.** Gates production use.
3. **Sheets column headers.** Gates database work only.

---

## APPROVAL GATE

Nothing in this document has been implemented. No workflow was created, modified,
activated or deactivated during its preparation. No credential was changed. No Supabase,
Sheets, Vercel, DNS or GitHub production change was made. All inspection was read-only.

Two write actions were performed **earlier today, on explicit user instruction and before
this planning command**, and are recorded here for completeness: the task definitions were
committed to a local git repository, and the secrets within them were replaced with
pointers to a gitignored file.

**Recommended first action on approval: Phase 1 only.** One VPS, one read-only agent,
48 hours. It costs about ₹300 and answers the question the rest of the plan depends on.
