# Cloud session to laptop session handover (14 Oct 2026, about 10:30 IST)

Aditya asked for everything done in the cloud "Sidana ventures ai manager" session to move to the laptop "Sidana ventures ai manager" session. From now on the laptop session owns the n8n deal agents. The cloud session has no schedules left and will do nothing more on its own.

Read `docs/n8n/HANDOVER.md` first. It is the full record of the build: IDs, tools, rules A to AA, the test history and how to change things safely. This note covers only what is live right now and what is open.

## What is live

| Thing | ID | Live version | Schedule (IST) |
|---|---|---|---|
| Deal flow agent | `69yk0Q9hf39k9NSp` | `4b72be0a-0ffc-4692-bd08-88552d9827ae` | weekdays hourly 09:10 to 18:10; Sat and Sun 11:10 |
| Hot deals agent | `E4dPrqOZm4GXpfJA` | `c9c75d11-d7d9-4282-8a9a-d1426141d839` | weekdays hourly 09:40 to 18:40; Sat and Sun 11:40 |
| ENGINE-DAILY matcher | `F4xXHRFIr3gS2VHc` | | weekdays 07:30, 14:30, 17:30 (14:30 and 17:30 added 13 Oct) |
| Follow-up diary: due | `FQaUHkPL3ncuP0Ve` | | read-only tool |
| Follow-up diary: write | `qt7XIAq8aWaIGTX7` | | tool, writes only with dry:false |
| FOLLOWUP_DIARY tab | sheetId 921053150 in the book | | |

**Model and settings:** `anthropic/claude-haiku-5-5`, credential `oGLbGPjcUY927bs0`, reasoning medium, prompt caching on, 80 iterations.

**Live rule text:** the repo files are an exact copy of what is live, checked against n8n on publish:
- `docs/n8n/deal-flow-agent.instructions.txt`
- `docs/n8n/hot-deals-agent.instructions.txt`
- `docs/n8n/skills/*`

The four 14 Oct catch-up tasks were deleted at 10:15 IST as planned. Only the hourly and weekend tasks remain, and all are enabled.

## Rules added 13 to 14 Oct (on top of A to X)

- **Y, feedback after every pass.** Before a meeting with no reason given, ask once: was it their focus (sector, stage or cheque) or this company? Never ask after a meeting, or when a founder is copied. Every ask adds a FEEDBACK_CHASE diary entry 7 days out.
- **Z, out of funds or between funds.** Ask whether a new fund is coming, when, and with what thesis. A NEW_FUND_CHECK diary entry goes on the 1st of the month they name ("Feb 2027" means 1 Feb 2027); with no month, 90 days out.
- **AA, a new thesis means a rematch.** Write the investor's own words into the structured INVESTOR_CRITERIA columns: G, H, I, J, K, L, M, N, T, AF, plus V and Z. The next engine run rematches.
- **S, rewritten 14 Oct after the Swishin x Hoora mistake.**
  - What happened: Swishin passed on Hoora. Aditya then asked them for a thesis call, and they agreed. The agent treated it as a meeting with the Hoora founders.
  - The rule now: if the investor passed earlier in the thread, or we asked them for a thesis call, the call is with US. Never email the founder about it. Send TIME NEEDED | Thesis call <> Investor instead. When in doubt, the call is with us.

## Open items for the laptop session

1. **Swishin x Hoora clean-up.** Check exactly what the Hot agent sent on the Swishin thread and to the Hoora founders on 14 Oct (sends between 08:00 and 10:30 IST, tools `reply_from_*` and `internal_mail`). Then:
   - Tell the Hoora founders, if they were emailed, that the Swishin call is an internal thesis call and not a meeting for them.
   - Check the Hoora x Swishin PIPELINE row was not moved to a meeting stage, and put it back if it was.
   - Make sure the thesis call with Swishin is set up with Aditya.
   The cloud session was still looking this up when the move happened. Its findings will be forwarded to the laptop session if they arrive.
2. **First live morning, 07:45 Deal flow run.** It sent 25 investor replies and 7 team mails. Everything was correct, with these slips:
   - Only 2 of about 16 passes were closed in PIPELINE. Check that later runs or hygiene_audit closed the rest.
   - Some investors got 2 to 4 replies within minutes, one per startup. Mistry's Charles got 4.
   - One "Correction" team mail and one "FORWARD NEEDED" mail went to investors@, which breaks the four-kinds-only rule. The correction also contradicts itself: it says nothing was sent to Karan, but the agent replied to Karan four minutes later.
   - Colossa: the agent promised "women-led or co-led, plus male-founded climate". That conflicts with the 23 Sep rule that women founders are required only for deep tech (Colossa = DEEPTECH). Aditya should decide.
   - Vilva AI x Vira Jal: Michele wants a call on 14, 15 or 16 Oct, and no TIME NEEDED mail was sent. Needs a human today.
3. **The 08:15 to 10:15 runs** were not fully audited yet. Execution ids run from about 18900 to 19570. Check them for the same issues.
4. **Small known slips from the dry runs:**
   - Now and then a feedback question gets no diary chase.
   - The question is occasionally asked after a clear reason ("too early") was given.
   - A thank-you once dropped copied founders.
5. **Not moved to n8n yet; keep the laptop `sidana-rematch-watch` task on:**
   - applying captures
   - creating criteria rows for new INVESTORS rows
   - the criteria health check
   - corrected emails and bounces
   - the founder-brief watch
6. **Older open items:**
   - Measure the Anthropic spend after the first full day; the target is $25 to 45 a month.
   - The Bon Cuisine raise shows INR 20 Cr in one place and 25 Cr in another.
   - Review the Bon Cuisine investor list errors with Aditya.
   - The laptop Deal flow and Hot deals agents must stay off, so the two systems never double-reply.
   - Aditya wants zero approval prompts. A project `.claude/settings.json` allow-list has to be added by him; Claude is not allowed to write it.

## How to change an agent safely

Edit the repo text first. Then in n8n:
1. Run `get_agent`.
2. Run `mutate_agent` with the latest configHash, using `config.patch` to replace `/instructions`, or `skill.upsert` for a skill.
3. Run `validate_agent`.
4. Dry-run it with `call_agent`, sending a message that starts "DRY RUN" and passes dry:true on every send.
5. Audit the send-tool executions.
6. Run `publish_agent`.

Commit to `main-q3y5kt`, and merge origin first.
