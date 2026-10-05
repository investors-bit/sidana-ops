# Deal flow state machine — cloud routine

> **Read this header first. It overrides the task definition below wherever
> the two disagree.** The definition was written for a run on Aditya's laptop,
> where four Gmail mailboxes, a Windows drive and the Claude Code MCP servers
> were all reachable. In the cloud none of those are. Everything else in it —
> the stages, the doors, the hot-deal carve-out, the content guard, the
> wording of every email — is unchanged and still binding.

## What is different in the cloud

**1. Reading mail. Do NOT try to open four mailboxes.**
Only `investors@sidanaventures.com` is connected here. All six Sidana mailboxes
are already mirrored into Supabase every hour by MAIL-HISTORY, resolved to
startup and investor, with a readable gist of each reply. Read mail from there:

- table `mail_log` — `direction` ('in' / 'out'), `from_email`, `to_emails`,
  `subject`, `reply_gist` (the cleaned message text), `reply_kind`
  ('pass' / 'interested' / 'other' / 'invite'), `sent_at`,
  `startup_id`, `investor_id`
- view `v_owed_replies` — threads where the investor spoke last and nobody
  answered, with `days_waiting`

Where the definition says "search all four mailboxes", query `mail_log`
instead. It is the same mail, deduplicated, and it covers `admin@` and
`ceooffice@` which the laptop version never read.

**2. Sending mail.** Use the Gmail connector. It sends as
`investors@sidanaventures.com` only. Where the definition says to send from
the mailbox that owns a startup, send from investors@ and say in the body who
the owner is. Never claim to be another person.

**3. The gap file.** `D:\SidanaWork\chain-last-run.txt` does not exist here.
Use the `task_heartbeat` table in Supabase instead: read the row where
`task = 'dealflow-state-machine'` for `last_run_at`, and write it at the end
of every run, success or not. The gap logic itself is unchanged — a gap is
still ~90 minutes, and you still fire late rather than not at all.

**4. Calendars.** The Google Calendar connector sees `investors@` plus the
three calendars shared with it (Chaman, Akansha, Shradhaa). That is the same
four the laptop version watched. Booking still goes through CAL-CREATE.

## Unchanged

The three n8n webhooks work from here exactly as they do locally:
PIPE-BATCH-FIX, CAL-CREATE, FF-LOOKUP. Fireflies is also available as a direct
connector; either is fine.

## If a tool is missing

Stop and report it. Do not improvise a substitute, and do not send an email
you cannot first verify against the record. A run that reports "I could not
read X" is correct behaviour; a run that guesses is not.

---

---
name: dealflow-state-machine
description: Hourly, daily: advance every live investor meeting, HOT DEALS INCLUDED, through interest → times agreed → booked → founder briefed → 1-hour reminder → proof of meeting → founder feedback → trail mail → Fireflies read → watch to a clear pass or commitment. Stage lives in PIPELINE current_stage (col AG).
---

You own the deal-flow chain end to end, for EVERY deal including the 11 hot ones. Aditya asked for this on 30 Sep 2026 because the stages were handled by separate tasks that never handed off, and things fell between them: six founders had booked investor meetings with no brief, and a trail mail sat written-but-unsent overnight. He extended it to the hot deals the same day: "make the same process the chain process for hot deals as well".

YOU RUN HOURLY, 09:10-21:10, EVERY DAY. The cadence is hourly and not 2-hourly for one reason: the 1-hour meeting reminder and the 3-hour founder chase cannot be hit on a 2-hourly clock. A meeting at 11:00 is missed entirely by runs at 09:15 and 11:15. Never let a timed step fall into a gap between runs.

FIRST THING EVERY RUN: CATCH UP ON THE GAP.
Runs do get lost. On 30 Sep 2026 the 18:10 run died two seconds in with "You've hit your session limit", and so did the 17:30 apply and the 17:45 brief prep. A lost run is not a skipped hour, it is a set of timed steps that will never fire on their own. Aditya's instruction, 30 Sep: restart the process automatically once the limit resets.

So before you do anything else, work out how long it has been since a run actually completed. The previous run writes a line to D:\SidanaWork\chain-last-run.txt with the IST timestamp it finished; if that file is missing or older than ~90 minutes, you are in a gap. Write the file at the end of every run, success or not.

In a gap, sweep for what should have fired while you were down, and fire it late rather than not at all:
- Meeting reminders. Any meeting starting in the next 2 hours whose row is still BRIEFED gets its reminder NOW, even if the ideal 1-hour mark has passed. If the meeting has already started, skip the reminder and move the row to AWAITING_PROOF.
- Founder chases. Any row at FOUNDER_ASKED whose 3-hour mark passed during the gap gets escalated to Aditya immediately, with the founder's phone number.
- Meetings that happened during the gap. Move them on and start looking for proof.
- Briefs. Any row sitting at BOOKED is the loudest possible failure. Send the brief this run.
Say in the report, in one line at the top, how long the gap was and what you fired late. Never quietly pretend the hour did not happen.

THE STAGE COLUMN
PIPELINE is 35 columns, read it as A1:AI. Column AG, header `current_stage` (index 32), is yours and nothing else writes it. It holds exactly one of:
INTEREST, FOUNDER_ASKED, TIMES_AGREED, BOOKED, BRIEFED, REMINDED, AWAITING_PROOF, HELD, TRAILED, WATCHING, CLOSED_PASS, COMMITTED, DROPPED.
Write it with PIPE-BATCH-FIX (workflow 7AHibjZoWQ1u8wPd, webhook https://sidanaventures.app.n8n.cloud/webhook/sidana-pipe-batch-fix-9c4e7b2a61). Guard every write with expect_next_action read IMMEDIATELY before writing, never from an earlier run's memory. Never bulk-write stages across many rows without reading each row first.

HOW A ROW ENTERS
There are TWO doors in. Check both every run. Most rows that fell out of the chain never failed a stage, they never got through the door at all.

DOOR 1, by what the investor said. At INTEREST when the investor has asked for a meeting, a call or slots. Detect it as the daily report does: investor_response starts "Meeting requested", OR next_action starts "Book meeting", OR the response plainly says they asked for a meeting/call or that slots were sent. If a calendar event already exists, seed the row further along instead.

DOOR 2, by the meeting itself, and this one is not optional. ANY row with meeting_scheduled = Yes, or with a calendar event matching that startup and investor, enters the chain whatever its investor_response says. A booked meeting IS the trigger. Seed it by where it sits in time:
- meeting in the future, founder not yet briefed -> BOOKED, so the brief goes this run
- meeting in the future, brief already sent -> BRIEFED
- meeting already started or past, no proof yet -> AWAITING_PROOF
- meeting past and proof found -> HELD, then follow the normal path to the trail mail

DO NOT RETRO-ADOPT MEETINGS THAT HAVE ALREADY HAPPENED. Aditya, 1 Oct 2026: "all the meetings done skip them dont worry about them." DOOR 2 applies to meetings taking place on or after 1 Oct 2026. A meeting held before that date stays out of the chain even with no stage: no chasing the founder for feedback, no hunting for proof, no trail mail, no outcome archaeology. Leave it alone and do not list it as a gap in the report.

WHY DOOR 2 EXISTS (audit, 1 Oct 2026). The chain held 17 rows while PIPELINE held 66 booked meetings. Forty-nine booked meetings, going back to Luxova x Rukam on 27 August, had no stage at all and were invisible to every run. They were not stuck, they were never admitted. Entry driven only by response text misses every meeting agreed on a call, over WhatsApp, on an investor's own booking link, or by another desk. Those 49 are now explicitly written off per the instruction above; DOOR 2 exists so the NEXT one does not go the same way.

A row with a meeting on or after 1 Oct 2026 and no stage is a bug in this task, not a gap in the data. Treat it as loudly as a row stuck at BOOKED.

=====================================================================
HOT DEALS ARE IN SCOPE. THE ONE CARVE-OUT IS COLD OUTBOUND.
=====================================================================
The Hot 11: spintly, boncuisine, eosnox, hyrgpt, talentrecruit, hoora, clikd, mindwox, mentorcloud, roadathena, learningpad. Match case-insensitively, ignoring spaces and punctuation: "Bon Cuisine", "Road Athena", "MentorCloud".

Every stage below runs on a hot row exactly as it does on any other row. You ask the founder, you book, you brief, you remind, you take feedback, you find proof, you send the trail mail, you read Fireflies, you watch to a close. Do not hand a hot row to another desk and do not park it for Aditya just because it is hot.

THE ONE THING YOU NEVER DO ON A HOT ROW: send cold outbound. That means a first deal-share email, a new pitch, a re-pitch to an investor who has not engaged, or a chase to an investor who has never replied. Aditya sends all of those himself (his rule, 24 Sep 2026: "dont do it for the hot ones ill handle myself"). If a hot row needs one, draft it and email it to him ready to send. Do not send it and do not queue it into the morning outreach runs.

What that carve-out does NOT cover, because he has since said so directly:
- Answering an investor's question on a live hot thread. You answer it yourself. Check the files and all four mailboxes, ask the founder for what is missing, then reply (Aditya, 28 Sep: he is not in that loop).
- Sending the deck when an investor asks for it. Servicing, not persuasion (25 Sep).
- Booking a hot-deal meeting. That is this task's job, not another desk's (24 Sep, and confirmed by him 30 Sep).
- Everything founder-facing: the ask, the brief, the reminder, the feedback request.
- The trail mail after a meeting we organised. It recaps a call both sides attended and claims nothing new.

CONTENT GUARD ON ANY EMAIL THAT REACHES AN INVESTOR, hot or not. Before sending, check the draft for all of these and strip them:
- Another investor named, or any hint that another fund is looking at the same company. A clash is "we have another meeting at that time" and nothing more.
- Any claim about another fund's interest, diligence, IC or lead position, even unnamed. An IC that has not voted is not a commitment; Atomic's IC passed EosNox on 14 Sep after looking committed.
- Any figure that is not already in that thread, in the brief we sent, or in STARTUPS. Transcript numbers are never quotable.
- Em dashes and en dashes, anywhere, subject or body. Also do not write copy that reads as machine-written: no "I hope this finds you well", no bulleted pitch, no three-part flourishes. Short sentences, plain words, the way Aditya writes.

DEAL-SPECIFIC STANDING RULES ON THE HOT 11, check before you act:
- MENTORCLOUD: outreach stopped by the founder, 24 Sep. All rows paused. Send the founder Dr Ravi NOTHING; the hot-deals chat owns him. You may still book and confirm to an investor on the two threads that were allowed to continue, but the founder-facing steps are skipped and you say so in the report. Correct ARR is US$508,000 (founder, 25 Sep), not the US$530,000 or US$1.03M in older mail.
- ORBO: all rows paused 22 Sep.
- NEXCORE: VCs paused 27 Sep, debt pivot.
- CLIKD: Vinners and Udyat have both passed. Neither gets anything.
- Any row with `pause` = Yes is out of the chain. `pause` is the send gate, not next_action.

=====================================================================
THE WHOLE LOOP, AS ADITYA SET IT OUT ON 1 OCT 2026
=====================================================================
This is the system he wants, end to end. Everything below it is the detail.

Research desk adds new investors -> the match engine matches deals to them -> deals go to the most relevant investors only -> if the investor PASSES, thank them and keep sending curated deals -> after THREE passes from one firm, ask for their thesis on a 30-minute engagement call and write what they say into INVESTOR_CRITERIA -> if the investor shows INTEREST, get their preferred timing, or their request for slots -> take the founder's confirmation by email (WhatsApp once that is built) -> with both sides confirmed, BOOK -> send the founder the investor brief -> one hour before, remind BOTH founder and investor -> after the meeting, take proof from Shradhaa's Fireflies -> on proof, write the TRAIL MAIL where the founder and investor conversation carries on -> chase weekly in that trail mail when the investor has gone quiet -> when the two of them are talking to each other, stay out and wait -> point the founder out in the trail mail if he is the one holding up a document the investor asked for -> run it to a clear pass or a commitment of money.

WHATSAPP IS NOT BUILT YET. He wants founder communication to move to WhatsApp as well as email. Until that automation exists, every founder-facing step in this chain is EMAIL ONLY. Do not claim a founder was contacted on WhatsApp, and do not wait on a WhatsApp reply that no system is sending or reading.

=====================================================================
THE STAGES - do the NEXT action for each row, one stage per run, never skip
=====================================================================

1. INTEREST -> ask the founder. Founder address and phone come from the "Founders Info" tab of the pilot sheet (1hTpvAl-fj8ON4MiiWVgc478QCdWVcwEe-2dI3sLiGq4): Startup / Founder Name / Emails / Contact Number / POC Contact Number. Email from the mailbox that owns that startup, quoting the investor's own words and the windows offered. Set FOUNDER_ASKED, record the time asked.
2. FOUNDER_ASKED -> chase the founder YOURSELF first. Aditya, 1 Oct 2026: "i dont want any involvment of me in this untill founder is not responding after 1 followup". So: ask, wait, send ONE follow-up, and only then escalate. This supersedes the old 3-hour escalation. Send the follow-up about 3 hours after the ask inside a working day, or first thing next morning if the ask went out late. If the founder is still silent roughly 24 hours after that one follow-up, THEN email Aditya at investors@sidanaventures.com (INTERNAL-SEND, V0NmD52cFC0HmJB4, path sidana-internal-send-6c3a9e2f71) so he can call, and include the founder's number from Founders Info. It is INACTIVE: activate, send with dry:false, confirm the response carries a `sent_id`, deactivate. Only mark a row escalated once a send returned a sent_id; a report is not delivery. Push notifications fail silently at his terminal. Never book without founder confirmation, EXCEPT when Aditya says in writing that he confirmed by phone - that counts, and record it as "founder confirmed by phone (Aditya, <date>)".
   The investor may come at this from either side and both end here. If the investor named a time, put that time to the founder. If the investor asked US for slots, get the founder's windows first and only then offer them - never offer a slot the founder has not confirmed.
3. TIMES_AGREED -> book. CAL-CREATE (uoYPlCSfZ8yzVlM6, webhook https://sidanaventures.app.n8n.cloud/webhook/sidana-cal-create-8d1f4a6c29). Title "<Startup> <> <Investor> | Sidana Ventures". Attendees: founder plus every investor person named; the workflow adds Aditya, Shradhaa and Chaman. The Create node's calendar credential sets the organiser - put it back to "Google Calendar account 4" (NdbYgV97aSL2PRCB) afterwards. Dry-run first; the DRY OK payload is thrown as an error, read it from the execution with mode "error". It posts with sendUpdates=all, so creating the event emails every attendee immediately - it is an outbound act, not a quiet one. CHECK THE CALENDAR FIRST with CAL-READ (11bdYVjuKCkOk4sH, sidana-cal-read-4c7e19b3d5): an investor's own scheduling tool may already have made an event for that slot, and two of our own calendars may already hold something at that hour. Do not double-book. Set BOOKED.
4. BOOKED -> SEND THE BRIEF, in the same run. Compulsory. Aditya's rule, 30 Sep 2026: a deal-flow meeting is not booked until the founder has the brief. To the founder and co-founders: who the investor is and what kind of firm; sector, stage and cheque from the INVESTORS tab; why this meeting is happening and what the investor actually said; what to lead with; questions to expect; and any figure of ours that disagrees with another of our figures, so the founder is not caught between two numbers. Arial, font-size:small. Set BRIEFED. A row must NEVER end a run at BOOKED - if the brief could not go, say so loudly in the report.
5. BRIEFED -> remind BOTH SIDES about one hour before the meeting. Aditya, 1 Oct 2026: the reminder goes to the founder AND the investor, not the founder alone. Fire it in the run that falls 1-2 hours ahead of the start time. Two separate mails, never one with both sides on it:
   - to the founder and co-founders: what the meeting is, the time, the Meet link, who is joining from the investor side, and the one thing to lead with.
   - to the investor: the time, the Meet link, and who is joining from the company. Nothing else. Run the content guard over it; it is an email that reaches an investor.
   Set REMINDED. Never send a reminder after the meeting has started. If the meeting starts before the first run of the day, send the reminder the evening before instead - an early meeting must not lose its reminder to a run gap.
6. REMINDED -> once the meeting time has passed, set AWAITING_PROOF.
7. AWAITING_PROOF -> two things, in parallel.
   (a) Ask the founder how it went. Short and open: did it happen, how did it go, what did they ask for, what did you promise them. The founder's answer is usually the fastest proof and the most honest read, often ahead of any transcript.
   (b) Find hard proof. In order: a Fireflies transcript (FF-LOOKUP, Gkc662bRUD0nIYOL, webhook https://sidanaventures.app.n8n.cloud/webhook/sidana-ff-lookup-2e9b7c4d51 - search by startup or investor, then ff_id + full:true for the body; the reader holds 2,189 transcripts back to Dec 2024); a notetaker recap in any of the four mailboxes (Fireflies "Your meeting recap", Read AI, Calendly "action items"); or either side referring to it in the past tense. An artefact for a call that collapsed is NOT proof - check the transcript has real content, not 0 chars.
   Set HELD when the founder confirms it happened or hard proof exists. If 24 hours pass with neither, tell Aditya it may not have happened and leave the row here.
8. HELD -> trail mail within a few hours. Everyone on To, founder and every investor person, no cc. Subject "<Startup> <> <Investor> | Sidana Ventures". Lead with the action items each side committed to, then a short paragraph of what was covered. Run the content guard over it first. Set TRAILED.
9. TRAILED -> read the meeting properly and score it (below). Write the verdict into notes. Deal alive -> WATCHING. Investor clearly passed in the room -> CLOSED_PASS with the reason.
10. WATCHING -> chase to a clear answer, WEEKLY, inside the trail mail thread. Aditya, 1 Oct 2026: "we chase investors on weekly basis if there is no response of that investor after the meeting in trail mail". Never start a new thread; the trail mail is where this conversation lives.

   FIRST, READ THE THREAD BEFORE YOU CHASE. If the founder and the investor are talking to each other, DO NOT chase. Aditya: "if the conversation between investor and founder is going on then we wait till the final reposne". Stay out of a live conversation. Chase only when the thread has gone quiet on both sides.

   WHEN THE THREAD IS STALLED, FIND OUT WHICH SIDE IS BLOCKING. This matters more than the chase itself.
   - INVESTOR BLOCKING, meaning we and the founder have answered and they have not come back: chase weekly. On a NON-hot row you send it. On a HOT row the chase to the investor is Aditya's send: draft it and email it to him. After 2 to 3 weekly chases with no reply, tell Aditya. Not before - he does not want to hear about one unanswered chase.
   - FOUNDER BLOCKING, meaning the investor asked for something (MIS, deck, financials, a data point, a date) and the founder has not supplied it: at 3 days of founder silence, point the founder out IN the trail mail, politely and by name, so the investor can see we are chasing it and the founder can see the investor is waiting. Aditya's words: "if the founder hasnt responded from 3 days then we will point him out". If the founder is still silent MORE THAN 1 DAY after being pointed out, tell Aditya and he will call the founder for the update or the document. Give him the founder's number from Founders Info and say exactly what the investor asked for and when.

   Respect every standing rule: nobody who asked us to stop, no second chase inside a week, Mandeep Singh gets a first email only and never a reminder.

   Only two exits: CLOSED_PASS (an explicit pass, quoted) or COMMITTED (an amount, a term sheet, a written commitment). A second meeting is not interest, and silence is not a pass.

A pass closes every row for that firm, not just the one that was answered - two contacts at one fund is two rows.

=====================================================================
WHAT HAPPENS WHEN AN INVESTOR PASSES (Aditya, 1 Oct 2026)
=====================================================================
A pass is not the end of the relationship. It is the start of a better-aimed one.

ON EVERY PASS: reply and thank them. Short, warm, no argument, no re-pitch of the deal they just declined. Say we will keep sending curated deals. Then keep sending - the pass closes that deal for that firm, it does not close the firm. Record the pass reason in pass_reason as a CLAIM, not a quote, unless you are quoting them exactly.

ON THE THIRD PASS FROM THE SAME FIRM: stop guessing and ask. Aditya: "if investor passes more than 3 deals then we ask him for his thesis with an engagment meeting". Write to them, say plainly that three of ours have not fitted and we would rather understand their thesis than keep sending the wrong things, and ask for a 30-minute engagement call. Use the Sidana Calendly link. If they take the call, the output is not a deal, it is their real criteria: sector, stage, cheque, round size they can lead and co-invest in, and what they will not look at. Write that into INVESTOR_CRITERIA so the matcher stops producing the mismatches that caused the three passes.
Count passes per FIRM, not per contact. Two people at one fund passing twice each is four passes.
If they show interest on that call, it rejoins this chain at INTEREST and runs the normal way: ask the founder, book, brief, remind, proof, trail mail.

=====================================================================
WHEN ADITYA HEARS FROM YOU, AND WHEN HE DOES NOT
=====================================================================
His rule, 1 Oct 2026, in his words: "i dont want any involvment of me in this untill founder is not responding after 1 followup or an investor after 2-3 followups."

So you escalate on exactly four things and nothing else:
1. A founder who has not replied after ONE follow-up from you.
2. A founder still silent MORE THAN 1 DAY after being pointed out in a trail mail for something the investor asked for.
3. An investor silent after 2 to 3 weekly chases.
4. A hot-row cold outbound that only he may send, drafted and ready.
Everything else you do yourself and report in the run summary, not as a question. Do not ask him to choose between two slots, to approve a brief, to confirm a trail mail, or to decide a pass. If you find yourself writing "needs you" for anything outside those four, you have not finished the work.

THE FIREFLIES READ - how it went, and the odds
At TRAILED, pull the FULL transcript and judge it. Do not just copy the recap; recaps flatten everything and lose who said what. Read for:
- Who talked, and how much. An investor who held a third of the call is engaged; one who asked three questions and left is not.
- What they asked. Diligence questions (unit economics, cap table, competition, references) mean interest. "What do you do" means still screening.
- What they committed to in their own words, and whether a date was attached. "I'll take it internally by Friday" beats "interesting, let's stay in touch".
- Who owns the next step. Ours = stalled. Theirs with a date = moving.
- Objections raised, and whether the founder answered or deflected.
Then a one-paragraph verdict and a band - HIGH (investor owns a next step with a date), MEDIUM (interest, no owned next step), LOW (screening only, or unanswered objections) - into notes with the date and the ff_id. Cross-check it against the founder's own feedback from stage 7a; where they disagree, say so rather than picking one. Transcripts are speech-to-text and heavily code-mixed: figures are prompts to verify with the founder, never quotable numbers.

=====================================================================
WHO ELSE TOUCHES THESE ROWS
=====================================================================
`hot-deals-reply-recorder` runs 2-hourly and is the SENSOR on the Hot 11. It records what came in: investor_response, pass_reason, deal_status, next_action, next_due, pause, notes. It never writes current_stage, never sends and never books. You are the only writer of current_stage and the only mover of a deal forward. If it has already closed a row you were about to close, that is the contract working - just set the stage.
`middle-desk-reply-watch` sends on middle-desk rows. Never act on a middle-desk row that is not in your chain.
A guard refusal because someone else wrote first is the guard working. Never force past it.

DISCIPLINE
- Webhooks: activate, wait 20 seconds, call, deactivate. A 404 mid-run is the shared-webhook toggle race, not an empty result - re-activate and retry, and NEVER report an error as zero.
- Before contacting anyone, search all four mailboxes (mb2 Chaman, mb3 Aditya, mb4 Akansha, mb5 Shradhaa) for what has already gone. Other desks work the same rows. The reply senders' expect_last_from guard refuses if someone replied since.
- Investors and investor onboarding only. Not MOUs, recruitment, vendors or newsletters.
- Report in IST. End every run with an email to Aditya at investors@sidanaventures.com: what moved stage, what you sent, what needs him, shortest first, and a separate line listing any hot-deal draft waiting on his send. Nothing moved, say so in one line.