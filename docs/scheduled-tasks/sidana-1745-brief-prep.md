---
name: sidana-1745-brief-prep
description: Gathers the day-end brief at 17:30 IST so it is ready when Aditya asks at 17:45; meetings, trail mails, replies, and what needs him
---

> **Secrets.** Values written as `{{NAME}}` below are not literals. Read the real
> value from `C:\Users\Aditya\.claude\scheduled-tasks\SECRETS.local.md`, which is
> gitignored and never leaves this machine. Look up the key between the braces.


Gather Aditya's day-end brief for Sidana Ventures. He asks for it at 17:45 IST every day. READ ONLY — write nothing to any sheet and send no email. Have the answer assembled and waiting.

ALL TIMES IN IST. Gmail and n8n return UTC; convert to Asia/Kolkata before writing anything down.

TOOLS. Webhook workflows are kept INACTIVE when idle: activate with n8n_update_partial_workflow [{"type":"activateWorkflow"}], call, then DEACTIVATE. Call them only with Bash in this exact form: curl -s -X POST -H "Content-Type: application/json" --data '<json>' https://sidanaventures.app.n8n.cloud/webhook/<path>
- CAL-READ id 11bdYVjuKCkOk4sH, path {{WEBHOOK_PATH_CAL_READ}}. Body {"secret":"{{SECRET_MAIL}}","timeMin":"<ISO+05:30>","timeMax":"<ISO+05:30>"}. Returns 4 calendars: Cal A = investors@ (Aditya), Cal B = akansha@, Cal C = dealflow@ (Chaman), Cal D = shradhaa@. Rakesh's calendar is NOT connected.
- GMAIL-SEARCH id AI43kudplo2uMCUF, path {{WEBHOOK_PATH_GMAIL_SEARCH}}. Body {"secret":"{{SECRET_MAIL}}","mb":"2|3|4|5","q":"<gmail query>","full":true,"maxBody":600}. mb 2 = Chaman dealflow@, 3 = Aditya investors@, 4 = Akansha, 5 = Shradhaa.

BUILD THESE FIVE SECTIONS.

1. MEETINGS THAT HAPPENED TODAY. CAL-READ for today. Count only events with an attendee outside sidanaventures.com; drop the internal standups ("Decide Tasks for The Day", "Update Meeting", "SV Team Discussion"). For each: startup, investor, time, who attended from outside. Then for each one, search the mailboxes for anything sent or received after it — that is the outcome. If there is nothing, say "no outcome recorded yet" rather than guessing.

2. TRAIL MAILS. For every meeting in the last 7 days, did a trail mail follow — a message from us into a thread with BOTH the founder and the investor on it, after the meeting? Search each mailbox for the startup and investor names, not for the phrase "trail mail", because most are not labelled that way. Report it as a fraction: "trail mails sent after N of M meetings", then name the ones with none. This is the number Aditya cares about most, so do not estimate it.

3. MEETINGS BOOKED, AND WHETHER THE INVESTOR HAS ACCEPTED. CAL-READ for today through +8 days. **Only the INVESTOR side matters.** Flag any meeting where no investor attendee has accepted, worst first by how long it has been sitting. Also flag double-bookings on Aditya's calendar (two events overlapping) and duplicate events for the same meeting.
   **DO NOT flag or mention founders who have not accepted an invite.** Aditya ruled on 25 Sep that this is not an issue — he handles his own founders. Reporting it wastes his attention and it was my error to raise it.

4. INVESTOR AND FOUNDER REPLIES TODAY, AND WHAT WAS DONE. Search all four mailboxes for today's inbound from investors and founders. For each: who, what they said in one line, and whether anyone answered. Name anything still unanswered at the end of the day — especially a founder, because founder mail outranks investor mail.

5. WHAT NEEDS ADITYA. Only things that are genuinely his: an undoable relationship risk, a decision only he can make, a number he has been given that turned out wrong, or a founder or investor waiting on him personally. Keep it to a handful of lines. If nothing needs him, say so plainly — do not pad it.

STYLE. Short. Numbers with their source and date. If you did not verify something, say "unverified" rather than stating it. Never report a figure from PIPELINE's meeting_scheduled, meetings_held or last_contact columns — all three are known stale and record what the automation did, not what the firm did. The calendars and the mailboxes are the only sources that settle what actually happened.

Deactivate every webhook you activated. End with the five sections and nothing else.