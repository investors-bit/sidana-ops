# n8n deal agents: how they were built and how they run

Written 13 Oct 2026, the evening they went live. This is the record of moving the two laptop Claude agents (Deal flow and Hot deals) into n8n Agents.

## What runs where

Both agents are **n8n Agents** in the n8n cloud project `g0f15PuOxIWjwQOp` (sidanaventures.app.n8n.cloud).

- Model: `anthropic/claude-haiku-5-5`, Anthropic credential `oGLbGPjcUY927bs0`.
- Settings: reasoning `medium`, prompt caching on, maxIterations 80.

| Agent | ID | Scope | Schedule (IST) |
|---|---|---|---|
| Deal flow | `69yk0Q9hf39k9NSp` | every live deal except the 11 hot startups | weekdays hourly 09:10 to 18:10 (`task_8zf07O77Dg6wreYk`); Sat and Sun 11:10 (`task_16a99Xv6OT35Njt1`) |
| Hot deals | `E4dPrqOZm4GXpfJA` | spintly, boncuisine, eosnox, hyrgpt, talentrecruit, hoora, clikd, mindwox, mentorcloud, roadathena, learningpad | weekdays hourly 09:40 to 18:40 (`task_1rpax1cFFgc1kG2g`); Sat and Sun 11:40 (`task_sa0dwPHNizlJuBxR`) |

**Temporary catch-up for 14 Oct only.** These four tasks must be deleted after 10:00 IST on 14 Oct, because their cron repeats every 14 October:

- Deal flow: `task_PW0wY9I8kUj6hzmj` (07:45) and `task_lYiHUpSjFaYcubwq` (08:15, 08:45).
- Hot deals: `task_eEvMuc1Rpti9DUUe` (08:00, 08:30) and `task_i73ozX0tSOyUxsYF` (09:00).

Both agents were published at go-live, 13 Oct 22:23 IST.

## How one run works

1. **work_queue** (workflow `kmrpGbUgsaUI5Bjz`) returns one ordered to-do list of everything waiting on us, built from the Supabase mail mirror. It gives:
   - one item per startup x investor pair, with noise and calendar echoes removed;
   - the order: waited 18h to 7 days first, then today's mail, then the 7 to 21 day backlog;
   - for each item, a type hint and candidate mailboxes;
   - team internal threads (TIME NEEDED, BOOK VIA LINK, ANSWER NEEDED, TRAIL APPROVAL, FORWARD NEEDED);
   - meetings in the next 72h and the last 48h.

   It returns 30 items per call; the agent pages with `skip`.
2. **hygiene_audit** closes rows where the investor passed but a follow-up is still live.
3. **Team replies** on internal threads are acted on first.
4. **Each item:**
   1. **read_thread** (workflow `OwJJDNv0kmYub5fb`) reads the thread in full from whichever of the four Gmail mailboxes holds it. It returns the text, the sign-off name, To/Cc, `reply_with`, `reply_to_only`, `expect_last_from` and `started_by_us`.
   2. The agent decides the state.
   3. It sends with the matching reply tool, then writes the sheet.
5. **Timed meeting steps:** brief, reminder, proof, trail mail.
6. **Report**, then **record_heartbeat**.

Every message must end the run in one of five states: answered, already answered, no reply needed, waiting, or carried.

### Send tools

The send tools throw `DRY OK | ...` unless they are called with `dry:false`. That is how the dry runs worked.

| Tool | Workflow ID |
|---|---|
| reply_from_shradhaa (MB5) | `kNRyITkamF0B0zQD` |
| reply_from_aditya (MB3, investors@) | `inAPtwjsSmJW8OuP` |
| reply_from_akansha (MB4) | `7vOtSZ6v5oAKwjvh` |
| reply_from_chaman (MB2, dealflow@) | `ueghnGFrFERQnqrJ` |
| new_email_from_* | `QZkITtG5u2Zb6AXP`, `e9bG9jfqVNdcKNkC`, `M8YbcTKHXYZuixPZ`, `jZN46P2nSUCwQSXf` |
| internal_mail | `qFKIixmvKVA0g42P` |
| book_meeting | `TOnv3JOOtTJINNsU` |

### Write and read tools

**Write tools** (these have no dry mode):

| Tool | Workflow ID |
|---|---|
| write_pipeline | `KeLjKnBZna2qAJVL` |
| write_cells | `mLNKn6f1T0S7l4XQ` |
| stamp_mis_asked | `ZkDBRC0CQ92yjapJ` |
| record_heartbeat | `GFUrk8nPz8mAEom3` |

**Read tools:**

| Tool | Workflow ID |
|---|---|
| db_read | `zwxXecdM2YFCmbch` |
| read_book | `pJWAdxMZ1iFYkB0Z` |
| read_documents | `XLLaf7UhShfqOOGo` |
| read_calendars | `34Ut7cEwlZkw9pWU` |
| search_investors_mail | `yR0XriM9QbwCUq8J` |
| fireflies_lookup | `TXzEd3ZEz5K8dsUE` |
| hygiene_audit | `sJAKuXRlM9eCYbhg` |

### Other references

- Gmail credentials: MB2 `hwEqMRn6IxzoYs1R`, MB3 `mymSHTFVWtsI3Mh7`, MB4 `9IWD8mWqdARPXloL`, MB5 `R5K61omYbU9oT5J8`.
- The Supabase service credential is `ntQxeHO20ZUMASMg`. Its key lives in n8n only and is never put in this repo.
- Google Sheet ("the book"): `1hTpvAl-fj8ON4MiiWVgc478QCdWVcwEe-2dI3sLiGq4`.
- The Weekly Founder Update workflow `2MG95rlJDoFNz8tJ` now carries investor feedback after a pass ("Passed after meeting: ...").

## Where the rules live

- `deal-flow-agent.instructions.txt` and `hot-deals-agent.instructions.txt`: the core briefs, about 18KB each, exactly what is live.
- `skills/deal-flow/*` and `skills/hot-deals/*`: detail the agent loads only when needed:
  - meeting-stages;
  - passes or passes-thesis;
  - documents-founder;
  - writing;
  - tools-detail;
  - hot-playbook (hot deals only).
- `work-queue/`: code of the work_queue nodes (plan.js, threads.js, build.js) and the read_thread workflow.

### Key rules and why they exist

Every rule below came from a real mistake.

| Rule | What it says |
|---|---|
| A | A Calendly or other booking link from an investor never goes to the founder. It goes to the team as BOOK VIA LINK. |
| B | Never say "I forwarded / asked the founder / passed to Aditya" unless that tool call already happened this run. Forms and attachments go to the team as FORWARD NEEDED. |
| C | Email addresses are copied from headers, never made up. |
| D | Time zones: write the reader's zone, then IST. Data times are UTC. |
| G | One send per thread and per founder per run. |
| H | Use the mailbox read_thread reports. Retry other copies of the thread on a 404. Re-read and redraft if someone replied mid-run. |
| J (ANSWER NEEDED) | A question we cannot answer goes to the founder first. After 48h it goes to the team, and the team's answer is relayed to the investor. |
| L | Greet by the first name in the sign-off. |
| R | Keep everyone the investor copied. |
| S | A call offered after a pass goes to the team, not the founder. Time windows older than 3 days are stale. |
| T | The founder email goes before the investor reply that mentions it. |
| U and X | Pass replies are written fresh and truthful, with no "quick reply" compliments. |
| V | Stay out when the founder and the investor are already talking to each other. |
| W | No empty "our team will come back" promises, no placeholders. |

**Fixed facts:**

- Team mail goes only to investors@ (Aditya), dealflow@ (Chaman) and shradhaa@. aditya@ and chaman@ bounce.
- Aditya only ever gets the four kinds of team mail.
- GroCliq x OG Capital (D05660, row 5404) is on hold.
- MentorCloud: send nothing founder-facing.

## How we got here: the test history

1. **v3 to v7 (13 Oct, daytime).** The laptop rulebooks were ported in full, about 70KB each, with rules A to O added after each dry run. Haiku could not handle 70KB: it read for 40+ steps and drafted almost nothing.
2. **Haiku redesign (decision: keep Haiku, target $25 to 45 a month).** The work then went in this order:
   1. A short core brief, with the detail moved into skills.
   2. The work_queue tool, which hands the agent its to-do list.
   3. A tool that reads each email thread in full.
3. **Dry run 1 (v8)**, audit in `build-history/audits/audit-v8.md`.
   - Result: 57 drafts, 5 tool failures.
   - Problems: duplicate drafts, the wrong mailbox chosen, "Hi <Firm> team" greetings, the Starz AI misread.
4. **Dry run 2 (v9)**, audit in `audit-v9.md`.
   - Fixed: duplicates, mailboxes, "asked the founder" claims.
   - Still wrong: greetings, dropped cc's.
   - Cause found: the mirror only stores the first 200 characters of each email, which is why read_thread was built.
5. **Dry run 3 (v10)**, audit in `audit-v10.md`.
   - Result: 48 drafts, all DRY OK. 37 good, 10 fix, 1 bad.
   - Rules V, W and X were added for the last issues. These were not re-tested before go-live.

## Still open (as of go-live)

- Delete the four catch-up tasks after 10:00 IST on 14 Oct, then republish both agents.
- Measure the real Anthropic spend after the first live day; the target was $25 to 45 a month. n8n also supports a monthly budget guardrail (config.guardrails.budget) if a hard cap is wanted.
- Founders Info has no EosNox row (founder name, email, phone).
- Bon Cuisine raise shows INR 25 Cr in one column and INR 20 Cr in the memo.
- The Bon Cuisine investor research list (`build-history/investor-research/`) has errors the user spotted. Review it together.
- The laptop agents must stay switched off so the two systems do not double-reply.
- The DB-READ webhook gate still has the placeholder secret `SET_A_REAL_SECRET`. The agents use it as a sub-workflow tool, so this only matters for outside webhook calls.

## How to change something safely

1. Edit the text in this repo first.
2. In n8n, use the MCP tools: `get_agent`, then `mutate_agent` with the latest configHash (`config.patch` replace `/instructions`, or `skill.upsert` for a skill), then `validate_agent`.
3. Test with a DRY RUN message through `call_agent`. Every send passes `dry:true`; tell the agent not to call the write tools.
4. Audit the send-tool executions (search_workflow_executions plus get_workflow_execution).
5. Only then `publish_agent`. Changes are not live until published.

## File map of build-history/

| Folder | What it holds |
|---|---|
| rulebook-versions | the laptop-port rulebooks v3 to v7, and the original n8n versions |
| rules-added | rules A to K, L, M, N and O as written |
| audits | the three dry-run audits with full draft texts and notes |
| flowcharts | detailed agent map, and the simple team flowchart (also published as artifacts) |
| weekly-founder-report | Build node code of the weekly founder update, before and after adding investor feedback |
| forward-tool-archived | the forward-an-email tool that was built and then dropped, replaced by FORWARD NEEDED team mail |
| work-queue-dev | every iteration of the work_queue code, and the local test harness |
| investor-research | the Bon Cuisine investor list (Tavily plus Apollo, 19 Apollo credits) and the exclusion list |
