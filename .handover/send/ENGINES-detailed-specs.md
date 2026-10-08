# Sidana — Engine Specifications (addendum to HANDOVER-SYSTEM.md §3)

Covers the three engines the main document inventoried but did not specify:
the **match engine**, the **onboarding engine** and the **thesis engine**.

All content below is `[V]` — read directly from the live n8n Code node and the
task definitions on 2026-10-07.

---

## 1. MATCH ENGINE — `ENGINE-DAILY`

n8n workflow `F4xXHRFIr3gS2VHc`, weekdays 07:30 IST, 12 nodes.
All logic lives in **one Code node named `Plan`**. It writes nothing itself — it
returns `{ summary, data (batchUpdate ranges), appends }`, and two downstream
HTTP nodes apply them.

**This is the single most important piece of logic in the system.** It decides
which investor sees which startup. Read it before changing anything.

### Operating constants

| Constant | Value | Meaning |
|---|---|---|
| `CAP_DAY` | 2 | max new deals per **inbox** per day |
| `CAP_WEEK` | 5 | max per inbox per week |
| `CAP_OWNER_DAY` | 20 | max per owner per day |
| `HORIZON_WEEKDAYS` | 30 | how far ahead new rows may be dated |
| `MAX_DROPS` | 300 | **throws** if one run would pause more rows than this |
| `MAX_APPENDS` | 400 | **throws** if one run would add more rows than this |
| `DRY` | `dry !== false` | **defaults to dry-run.** Must be explicitly `false` to write |

**Short-read abort.** The run throws if any source reads short:
`crit < 200 || prof < 50 || pipe < 5000 || invs < 150 || sts < 40`.
This is what stops a partial Sheets response from mass-pausing the pipeline.
Keep this guard in any reimplementation.

### The gates — `evaluate(investor, startup)`

A pair matches only if **every** gate passes. Failure text is written into
PIPELINE `match_type` as `Not per strategy: <gate> - <why>`.

| # | Gate | Rule | Fails open or closed |
|---|---|---|---|
| 1 | `investor_active` | `status === 'ACTIVE'` | closed |
| 2 | `startup_active` | STARTUPS `active = Yes` | closed |
| 3 | `sector` | excluded tag → fail. `sector_mode = AGNOSTIC` → waived (**sector only**; every other gate still applies). Else `sectors_in ∩ startup sector_codes` must be non-empty | closed |
| 4 | `business_model` | excluded → fail; empty or `ANY` → pass; else must be in `models_in` | open if blank |
| 5 | `stage` | **STRICT.** `stage_min ≤ startup_stage ≤ stage_max` on a 7-rung ladder. No tolerance in either direction | **closed** — blank band can never match |
| 6 | `cheque` | `raise >= cheque_min_cr` | **OPEN — blank minimum passes everything** |
| 7 | `round_ceiling` | `raise <= round_max_cr`. Only `round_max_cr` gates — `cheque_max` and `lead_max` deliberately do **not** disqualify | **open** |
| 8 | `arr_bar` | `arr >= arr_min_cr` (or `>` if `arr_min_strict`) | closed if bar set and ARR unknown |
| 9 | `revenue_required` | ARR present and > 0 | closed |
| 10 | `women_only` | `Yes` → woman in cap table required. `DEEPTECH` → required only for deep-tech sectors | closed |
| 11 | `jain_exclusion` | `excludes_jain_sensitive` vs `jain_sensitive` | closed |
| 12 | `geography` | investor `geography_scope` vs startup market. `GLOBAL`/`ANY` scope passes all. Startup market "global"/"worldwide" matches **any** scope. No region matched → defaults to `INDIA` | closed |

**Stage ladder:**
`PRE_SEED → SEED → TRACTION → PRE_SERIES_A → SERIES_A → SERIES_B → SERIES_C_PLUS`

**Sector precision rule (17 Sep).** If only a *secondary* startup tag overlaps,
it counts only when the tag is vertical. The four horizontal tags —
`AI_APPLIED_ENTERPRISE`, `IOT_SMART_HARDWARE`, `CONSUMER_TECH_APP`,
`SAAS_ENTERPRISE` — count only for funds that also back software. A corporate VC
(`investor_type = CVC`) always needs the startup's **main** sector.

### Two asymmetries that matter

These are the defects worth fixing first, and they are deliberate in the code:

- **Stage fails CLOSED.** A blank band means the investor matches nothing. 36 rows
  were in this state on 1 Oct — invisible to the entire book.
- **Cheque fails OPEN.** `if (cmin === null) gate('cheque', true, 'no minimum on file')`.
  A blank floor matches every raise. Combined with `SYNC-BOOK`'s money parser,
  which returns null for any dollar figure, **43 of 77 blank-floor active investors
  have a cheque written in dollars and therefore match everything.** A91 Partners
  ($10M–$50M) currently passes the cheque gate on a ₹1.2 Cr round.
  Fix: add a currency column and an FX rate, or make a blank floor fail closed.

The round ceiling also fails open, but that is defensible — only 1 of 303
investors has a ceiling on file, so treating blank as zero would mute the book.

### Run structure

```
Part A   evaluate every live row
           queued (not sent, not paused, next_action = "Initial")
           follow-up (sent, not paused, no response, next_action ~ /follow/)
           engine-parked (paused by a previous run)      -> re-evaluated, can release
           engine-held follow-up (ENGINE-HOLD-FU in notes)
         fail  -> pause + write the reason into match_type
         pass  -> release if previously parked
Part B0  hot-deal priority: within each inbox, hot rows take the earliest dates
Part B   same-day cap: rows over CAP_DAY today get re-dated
Part C   new matches: every ACTIVE investor x every ACTIVE startup
Alloc    one row per startup per round, fewest-queued startups first, hot first
Post     duplicate check: same startup twice into one inbox
```

### Rules that exist because something went wrong

- **Never silently drop a row that already produced a conversation (25 Sep).** If a
  pair has a response, a scheduled meeting or meetings held, and the criteria later
  change, the row is **FLAGGED for a human**, not dropped. Eight real cases forced
  this: Koncite, Fire Armor × BlueHill, Glazia × Transition, GroCliq × BDev,
  Orbis × AWE, Pixelence × Speciale, Ulai × Speciale, Pixelence × Michele.
- **`confirmed = PENDING` → HOLD, never DROP.** The criteria are a draft; pausing is
  reversible, dropping is not.
- **`ENGINE OVERRIDE` in notes → the engine skips the row entirely.** Human escape hatch.
- **New matches are STRICT ONLY.** A redundant second check (`match_type !== 'Exact match'`)
  exists purely so that reintroducing a softer match type cannot quietly start
  sending near-misses again.
- **Deal Tracker sanity gate.** New matches are skipped entirely unless the tracker
  read returns ≥200 rows and ≥180 investors. A short read must not look like
  "nothing has been shared yet".
- **`NO_AUTO_PAIRS`** — `spintly|gvfl`, `clikd|udyatventures`. Never re-share automatically.
- **`POC_OWNER`** — `iimaventures → Chaman`. Investors who asked for one point of contact.

### Hot deals

Eleven startups, hardcoded: `spintly, boncuisine, eosnox, hyrgpt, talentrecruit,
hoora, clikd, mindwox, mentorcloud, roadathena, learningpad`.

**Reserved capacity (28 Sep).** While any hot row is waiting for a slot in an inbox,
**one of that inbox's two daily slots is reserved for it**. Non-hot rows may take
both only when no hot row is queued there. `CAP_DAY` and `CAP_WEEK` are *not*
raised — they protect deliverability. Ordering alone had proven insufficient: when
the meeting pause was lifted the same day, ~200 released rows began competing for
the same slots.

### Dead code you must not revive

`MEET_STOP`, `MEET_NA`, `MEET_EXEMPT` and `meetStop()` implement a "startup has 7+
meetings → no new shares" rule. **`meetStop()` now returns `false` unconditionally.**
Aditya removed the rule on 28 Sep: Springbase.ai had been frozen out of the entire
market on a row reading `PAUSED - 8+ meetings`, when the calendar showed three
events all with one investor who wanted advisory equity and never intended to invest.
The rule punished a startup for having been busy failing.

The constants are kept deliberately, not deleted, because `MEET_PAUSED_RE` must still
recognise the wording already written into 322 existing rows. Do not wire them back
into a gate.

---

## 2. ONBOARDING ENGINE — `onboarding-engine`

Laptop task, hourly :20 from 10:20 to 17:20 weekdays. Runs at :20 so it lands after
the 10:15 laptop start and never collides with the desk tasks.
**Owns email and LinkedIn equally** — this is what must be split for a server migration.

### State machine

The **stage column is the only thing that decides what happens next.**
Never act off `status` or `outcome` directly.

```
QUEUED -> SENT | INVITED -> FU1_SENT -> FU2_SENT
REPLIED -> THESIS_CAPTURED | MEETING_REQUESTED | DECLINED
THESIS_CAPTURED -> MEETING_ASKED -> MEETING_BOOKED -> HANDED_TO_MANAGER
```

Carried in both sheets — ONBOARDING columns **AQ:AV**, LI_OUTREACH columns **V:AA**:
`stage, meeting_asked_date, manager_notified_date, next_action, next_action_due, engine_log`

### Per-run sequence (oldest backlog first)

1. **Classify a REPLIED row.** One of: `THESIS` (stated sector/stage/cheque),
   `MEETING_REQUESTED`, `DECLINED`, `BOT` (landed under ~60 seconds after our send,
   or reads as an autoresponder → revert to `SENT`, leave no trace), `BOUNCE`
   (record in BOUNCES, set `EXCLUDED`). Write a one-line `engine_log` saying why.
2. **THESIS_CAPTURED → write it to the book.** Append to INVESTORS and a **full**
   INVESTOR_CRITERIA row. Record in `rule_notes` which parts are the investor's own
   words and which are our mapping to the token vocabulary.
   **Never leave `stage_min`/`stage_max` blank — a blank band fails closed and the
   investor can never match, so they are not supply.**
   **Never fill a band on a row whose `confirmed` is PENDING** — doing so releases
   queued rows to send.
3. **Ask for the intro meeting. ONCE.** This is the gate: no deals go to anyone until
   the meeting has been asked for. Never chase, never ask twice. Email replies
   **in thread from the mailbox that sent the intro**, so the signature matches the
   body. Calendly link, 30 minutes, framed as understanding their filter.
4. **MEETING_REQUESTED** — same as 3 but skip the thesis; take it at the meeting.
5. **MEETING_ASKED** — check the four calendars for a booking; write the datetime and
   set `MEETING_BOOKED`. **After 14 days with no booking and no reply, set
   `HANDED_TO_MANAGER` anyway** — ask once and never force, so a silent no still gets
   their deals flowing.
6. **Hand over.** One message to the manager naming the investor, their thesis in
   their own words, the row numbers, the cheque band, and which startups clear every gate.

### Hard rules

- **This engine never sends a deal.** Deal flow is the manager's lane.
- **No em or en dashes anywhere** — email, LinkedIn or chat. Guard every outbound
  string with `/[–—]|&mdash;|&ndash;/` and **throw rather than sanitise**. Plain
  hyphens inside words (pre-seed) are fine.
- **No stock phrases.** Not "hope you are doing well", not "I wanted to reach out",
  not "looking forward to hearing from you".
- **No website, no investor** — and verify properly: a 200 can be a parked lander.
- **Only two follow-ups**, day 7 and day 20.
- **Never modify an email already sent.**

### Traps already paid for

- `values:batchGetByDataFilter` does **not** return ranges in the order requested.
  Identify every tab by its header content, never by index.
- ONBOARDING has **merged cells that silently swallow writes**. Always read back and
  report what came back, not what you sent.
- The engine **ignores `sector_mode = LIST`**, so a LIST restriction may not be enforced.
- *(Stale note in the file:* it says INVESTOR_CRITERIA has no ceiling column. It does
  now — `cheque_max_cr`, `lead_max_cr`, `round_max_cr` exist.*)*

---

## 3. THESIS ENGINE — `thesis-engine`

Laptop task, 11:45 and 16:45 weekdays. **One step per investor per run, worst
offenders first.**

### Why it exists

A 1 Oct audit ran every PIPELINE row against the strict gates. Of 2,478 rows live or
already sent, **1,192 were mismatches — a 48% failure rate.** 461 failed on stage,
254 on sector.

The matcher was not broken. **The criteria it reads were wrong, thin or missing:**

- IvyCap had a 9 Cr cheque floor on file but actually writes from 5 Cr, so every
  round under 9 Cr was invisible to them.
- 36 criteria rows had a blank stage band — those investors could never match anything.
- 7 investors had no criteria row at all.
- IN44's row allowed B2B2C, which he does not touch. That is what produced
  *"if you are unable to match the thesis, kindly refrain from sending deals."*

This engine sits upstream of everything. Every mismatch traces back to a criteria row
nobody confirmed.

### Six entry doors, checked every run, top of list first

1. **Three passes from one firm** — counted per **firm**, never per contact.
2. **A pass with no reason** — a template pass means the thesis is unknown.
3. **No criteria row at all.**
4. **Blank stage band** — highest value per minute of work in the whole book.
5. **Ceilings that live only in prose** — a limit sitting in `rule_notes` as text binds nothing.
6. **A complaint** — any investor asking for fewer or better deals goes to the front,
   ahead of all of the above.

### Stages

Stage is kept in INVESTOR_CRITERIA `review_reason` as `THESIS: <STAGE> <date>`.
**Never in `confirmed`** — that column only ever holds `AUTO`, `PENDING`, `N/A` or
`USER`, because ENGINE-DAILY reads it to decide whether to send.

```
THESIS_UNKNOWN  -> ask by email on the most recent live thread. Short.
THESIS_ASKED    -> chase once after 4 working days.
                   Real criteria in writing -> skip to writing them.
                   Vague answer -> escalate to a call.
ENGAGEMENT_DUE  -> offer a 30-minute call. Framed as us learning their filter,
                   not us pitching.
(call happens)  -> read the Fireflies transcript
                -> write real criteria into INVESTOR_CRITERIA
```

### The rule that keeps it honest

**Write only what the investor said about themselves, in their own words.** Inference
is what produced the 48% mismatch rate in the first place.

---

## 4. What to fix first, in order

1. **Cheque gate fails open on dollar amounts** — 43 investors currently match every
   raise. Add `cheque_currency` plus an FX rate, or make a blank floor fail closed.
2. **Blank stage bands** — each one is an investor frozen out of the whole book.
3. **Split `onboarding-engine`** — the email half can run on a server; the LinkedIn
   half cannot.
4. **`sector_mode = LIST` is ignored** — a restriction that silently does nothing.
5. **Single-writer on the stage column** — currently a prompt rule, should be a
   database constraint.
