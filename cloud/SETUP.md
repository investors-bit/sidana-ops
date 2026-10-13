# Running the agents in the cloud like they ran locally

Why cloud runs fell short: the laptop had secrets, all mailboxes and a place to
write. The cloud environment had none of them. This is the checklist to close
that gap. Steps marked **YOU** cannot be done by Claude (secrets are yours).

## 1. Secrets — YOU, in the cloud environment settings (never in the repo)

Add as environment secrets/variables. Values live in n8n, in each workflow's
Gate / Build node.

| Name | Used for |
|---|---|
| `SECRET_DBREAD` | db-read webhook (`zwxXecdM2YFCmbch`) |
| `SECRET_HEARTBEAT` | new heartbeat-write webhook (step 3) |
| `SECRET_PIPE_BATCH_FIX` | PIPELINE stage writes (`7AHibjZoWQ1u8wPd`) |
| `SECRET_CAL_CREATE` / `SECRET_CAL_READ` | booking and calendar check |
| `SECRET_FF_LOOKUP` | Fireflies lookup |
| `SECRET_INTERNAL_SEND` | mail to Aditya/team only (`V0NmD52cFC0HmJB4`) |
| `SECRET_REPLY_SEND_MB2B/3/4/5` | guarded investor replies, one per mailbox |

Rotate the Groq key that was pasted in chat; it is not needed by these routines.

## 2. Network — YOU

Allow `sidanaventures.app.n8n.cloud` in the environment's network policy.

## 3. Import the heartbeat writer — YOU (one import)

Import `cloud/heartbeat-write.workflow.json` into n8n, replace
`{{SECRET_HEARTBEAT}}` in the Gate node with a fresh secret, activate it.
It can only upsert `task_heartbeat` for five named tasks.
Check first that `task_heartbeat.task` is the primary key / unique; the upsert
uses `on_conflict=task`.

Call:

    curl -s -X POST https://sidanaventures.app.n8n.cloud/webhook/sidana-heartbeat-write-b41d7e \
      -H 'Content-Type: application/json' \
      -d '{"secret":"$SECRET_HEARTBEAT","task":"dealflow-state-machine","note":"run ok"}'

## 4. Leave the guarded webhooks ACTIVE — YOU

The laptop agents activate, call, then deactivate shared webhooks, which races
when several agents run. Every write webhook already needs a secret and defaults
to `dry:true`, so leaving them active is safe. Cloud routines must not toggle them.

## 5. Mail reading — no new workflow needed

All six mailboxes are mirrored hourly into `mail_log` (MAIL-HISTORY). Routines
read mail through the db-read queries `recent_inbound`, `startup_mail` and
`owed_replies`. Only `investors@` is connected directly, for sending.

## 6. Routines and first test

Schedule from `docs/dealflow-state-machine.md` (hourly 09:10–21:10 IST), plus the
two desk reply-watchers and the hot-deals recorder on their existing cadences.
First run: dry-run only, compare against what the laptop version would have
done, then allow sends.

## Stays on the laptop

`linkedin-outreach-cycle` (needs a logged-in Chrome session).
