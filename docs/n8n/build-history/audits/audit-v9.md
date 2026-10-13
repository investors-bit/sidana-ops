# Dry-run email audit v9, 13 Oct 2026 (second dry run)

**Scope:** every execution of the 10 send workflows that started after 2026-10-13T15:38:00Z. `search_workflow_executions` (startedAfter 15:38Z, limit 200, no cursor left) returned 102 executions in total. 39 of them belong to send workflows: **18321 to 18346 and 18352 to 18364**. Nothing came after 18364 (15:52:14Z). The other 63 (18263 to 18320 and 18347 to 18351) are read and lookup workflows (zwxXecdM2YFCmbch, yR0XriM9QbwCUq8J, pJWAdxMZ1iFYkB0Z, XLLaf7UhShfqOOGo, kmrpGbUgsaUI5Bjz, sJAKuXRlM9eCYbhg, 34Ut7cEwlZkw9pWU) and are out of scope. Each of the 39 was read with `get_workflow_execution(includeData:true)`. I used only read tools and changed nothing.

There were no calls to book_meeting (TOnv3JOOtTJINNsU), new_email_from_aditya, new_email_from_akansha or new_email_from_chaman.

| Agent | Run | Executions | DRY OK | Real errors | GOOD | FIX | BAD | Superseded |
|---|---|---|---|---|---|---|---|---|
| Deal flow (69yk0Q9hf39k9NSp) | run_4d4c5e53 | 9 (18321 to 18329) | 9 | 0 | 2 | 7 | 0 | 0 |
| Hot deals (E4dPrqOZm4GXpfJA) | run_92f5be21 | 30 (18330 to 18346, 18352 to 18364) | 28 | 2 (18330, 18358) | 8 | 21 | 0 | 1 (18330, the allowed retry) |
| **Total** | | **39** | **37** | **2** | **10** | **28** | **0** | **1** |

**Real errors (quoted):**
- 18330 reply_from_aditya: `thread not started by us [line 7]`. This is Bon Cuisine x Beyond Seed, thread 1a114e2ad4ad9205. The thread starts with Siddharth Patel's pass. It was retried once with `allow_external_start:true` as 18339 and got DRY OK. This is the allowed pattern.
- 18358 reply_from_shradhaa: `latest message is from sherilyn.f@spintly.com, expected kruti@247vc.in - someone replied since; not sending [line 8]`. This is Spintly x 247 VC, thread 1a0d6faabdfabf28. The agent passed the wrong `expect_last_from`: the last message is Sherilyn's 6 Oct note with time windows, not Kruti's. It was not retried, so Kruti gets no update. The founder email 18355 did go out (DRY OK).

**Scope:** clean. The Deal flow agent touched only non-hot startups: Sugar's Daddy, MonitorExam, Caffena, DACBY, Springbase, Ulai, Fire Armor and RECEX. The Hot agent touched only hot startups: Bon Cuisine, LearningPad, Hoora, MentorCloud, MindWox, CLIKD, HYRGPT, EosNox, Road Athena, Spintly and Talent Recruit. No Calendly link, banned phrase or dash used as punctuation appears in any draft, and no draft invents an address.

## Deal flow agent (69yk0Q9hf39k9NSp)

| exec | tool | thread | startup x investor | to | verdict | why |
|---|---|---|---|---|---|---|
| 18321 | reply_from_aditya | 1a114416cc509ff9 | Sugar's Daddy x Mistry (Charles) | proposals@mistryventures.com | FIX | "Hi Mistry team," although the pass was signed "Regards Charles" (rule L). Content is fine. |
| 18322 | reply_from_aditya | 1a11440222941a02 | MonitorExam x Mistry (Charles) | proposals@mistryventures.com | FIX | Same as 18321: signed Charles, greeted as a team. "quick answer" is fine here. It is no longer a word-for-word copy of 18321, so rule U improved. |
| 18323 | reply_from_aditya | 1a109f14bce6dc6c | Caffena x Colossa (Anuj Kokate) | anuj.k@colossaventures.com | FIX | "Hi Colossa Ventures team," to an individual (From "Anuj Kokate", "Hi Aditya"). Content is correct (women-led focus, climate exception). |
| 18324 | reply_from_chaman | 1a109fafc2a0f306 | DACBY x Omnivore (Aaushi) | aaushi@omnivore.vc | FIX (minor) | "Hi Omnivore team," to Aaushi Sharma ("Hey Chaman This is not in our thesis", unsigned). "quick answer" came after a nudge. |
| 18325 | reply_from_chaman | 1a11447c86cc4ac7 | DACBY x Green Frontier (Apoorva) | ar@greenfrontiercapital.com | FIX | **Same failure as v8 18204**: "Hi GreenFrontier team," although she signed "Best, Apoorva". Rule R: Apoorva cc'd kg@greenfrontiercapital.com and the draft drops kg@. |
| 18326 | reply_from_akansha | 1a114622471d87fd | Springbase x Dexter | deals@dexter.ventures | GOOD | The pass was signed "Investment Team", so "Hi Dexter team" fits. Minor: anuradha@ (cc'd) is dropped. |
| 18327 | reply_from_shradhaa | 1a0f58c64d7e7630 | Ulai x GrowthCap (Neeti) | neeti.b@growthcap.vc | FIX | Correct greeting. Rule R: Neeti cc'd Pratekk Agarwaal (pratekk@growthcap.vc) and he is dropped. |
| 18328 | reply_from_chaman | 1a0f564083c7b1a9 | Fire Armor x GrowthCap (Neeti) | neeti.b@growthcap.vc | FIX | Rule R: Pratekk is dropped. Text is short and fine. |
| 18329 | reply_from_akansha | 1a11981123ec4220 | RECEX x GrowthCap (Neeti) | neeti.b@growthcap.vc | GOOD | No cc on her reply. Neeti gets 3 mails in this run (18327, 18328, 18329), but each has different wording. |

## Hot deals agent (E4dPrqOZm4GXpfJA)

| exec | tool | thread | startup x investor | to | verdict | why |
|---|---|---|---|---|---|---|
| 18330 | reply_from_aditya | 1a114e2ad4ad9205 | Bon Cuisine x Beyond Seed (Siddharth) | indiaops@beyondseed.com | SUPERSEDED (real error) | `thread not started by us`. Retried as 18339. |
| 18339 | reply_from_aditya | 1a114e2ad4ad9205 | Bon Cuisine x Beyond Seed (Siddharth Patel) | indiaops@beyondseed.com | FIX | A valid retry with allow_external_start:true that got DRY OK. "Hi Beyond Seed team," although From is "Siddharth Patel" (L). Harsh Jain (cc) is dropped (R). "so quickly" is unverified. |
| 18331 | reply_from_aditya | 1a0f028e79685e76 | Bon Cuisine x VCMint (Biswadeep) | biswadeep@vcmint.com | FIX | Signed "Best, Biswadeep" but greeted as "Hi Mint VC team," (L), and the firm is VCMint, not "Mint VC". partnerdeals@ (cc) is dropped. |
| 18332 | reply_from_aditya | 1a0f027f8cffab6e | LearningPad x VCMint (Biswadeep) | biswadeep@vcmint.com | FIX | Same as 18331. Also "quick answer", although he replied about 13 days after the deck (30 Sep to 12 Oct). |
| 18333 | reply_from_aditya | 1a0e5dd41e8b5be4 | LearningPad x Sunicon (Aakansh Jain) | aakansh@sunicon.vc | FIX | "Hi Sun Icon team," to Aakansh Jain (L), and the firm name is misspelt. v8 18244 had this one right. |
| 18334 | reply_from_aditya | 1a0e5e64497df994 | Hoora x SucSEED | deet@sucseed.co | FIX | **Same failure as v8 18243**: "Hi Arnav". Arnav appears nowhere in the thread metadata (sender "DEET \| SucSEED"; we originally wrote to "Arya"). It says "we will tag only pitch@sucseedindovation.com" but sends To deet@ only, although pitch@ is on the thread, and drops Nemika and Abishek. It ignores their "share the relevant details" ask. |
| 18335 | reply_from_aditya | 1a0fa72e569d1bec | Hoora x Mount Judi (Areeb) | areeb@mountjudi.com | FIX | Signed "Best regards, Areeb" but greeted as "Hi Mount Judi team," (L). "Thanks for following up" gets it backwards: we followed up and he replied. |
| 18336 | reply_from_aditya | 1a0d83d026aeacaa | MentorCloud x Prana (Hammad, Huzaif) | hammad@, huzaif@pranaventures.in | FIX | Hammad's mail was addressed To ravi@mentorcloud.com ("Hello Dr. Ravishankar...a few [questions]"), with us only in cc. The draft takes the founder off a shared thread and answers on his behalf: "We will come back to you on them". No founder email was sent to Ravi. |
| 18337 | reply_from_aditya | 1a0d89f632676511 | MindWox x Prana (Hammad) | hammad@pranaventures.in | FIX | Content is fine ("We will wait for your next steps"). Rule R: Huzaif (cc'd by Hammad) and the founder team (sathya@, srini@, cfo@, pradeep@) are dropped from a shared thread. |
| 18338 | reply_from_aditya | 1a0f0270d79e1d13 | CLIKD x GVFL (Hemang) | hemang@gvfl.com | FIX (minor) | "Thanks for coming back so quickly" is false: we sent 4 mails over 2 weeks before his "pass.". It is a near copy of 18362. |
| 18340 | reply_from_akansha | 1a10a0fc25da8718 | HYRGPT x IvyCap (Devesh) | devesh@ivycapventures.com | FIX | It handles "one deal at a time" well. Rule R: Devesh cc'd Harshit and Harshit is dropped. |
| 18341 | reply_from_shradhaa | 1a0f06193017ff5e | EosNox x Rainmatter/Zerodha (Shradha Pujar) | shradha.pujar@zerodha.com | GOOD | Answers "case by case" correctly. |
| 18342 | reply_from_shradhaa | 1a10f44f98d6de82 | EosNox x Mucker (Amol Bhat) | amol@muckercapital.com | FIX | Signed "Best, Amol Bhat" but greeted as "Hi Mucker Capital team," (L). Content is right (US-only). |
| 18343 | reply_from_chaman | 1a0841e292c7ca83 | Road Athena x M Venture Partners (Rahil) | rahil@m-venturepartners.com | FIX | "Hi M Venture Partners team," to Rahil Parekh (L). Chiranjeev (cc, the original addressee) is dropped (R). |
| 18344 | reply_from_shradhaa | 1a0d176da7c2ab3b | MentorCloud x M Venture Partners (Rahil) | rahil@m-venturepartners.com | FIX | Same L and R issues as 18343. |
| 18345 | reply_from_shradhaa | 1a0d17770fb18072 | MentorCloud x Inflexor (Pratik Ahuja) | pratik@inflexor.vc | FIX | "Hi Inflexor team," to Pratik (L). |
| 18346 | reply_from_shradhaa | 1a0eb3a109fd049e | Spintly x OG Capital (Deeksha) | deeksha@ogcapital.one | FIX | "Hi OG Capital team," to Deeksha (L). Sayan (the original addressee) and Enterprise@ (cc) are dropped (R). "Understood on the partnership" is garbled. |
| 18352 | reply_from_akansha | 1a0cc3ee29eff0e3 | Talent Recruit x M Venture Partners (Rahil) | rahil@m-venturepartners.com | FIX | Same L and R issues as 18343. Rahil gets 3 mails in this run, all opening "Hi M Venture Partners team,". |
| 18353 | reply_from_shradhaa | 1a0e6224be2fd228 | Spintly x Beyond Seed (Harsh Jain) | harsh@beyondseed.com | FIX | "Hi Beyond Seed team," to Harsh (L). Suraj (cc) is dropped (R). |
| 18354 | reply_from_shradhaa | 1a0d6a53acaf51c9 | EosNox x OG Capital (Deeksha) | deeksha@ogcapital.one | FIX | Same L and R issues as 18346. |
| 18355 | new_email_from_shradhaa | founder | Spintly founder for 247 VC | rohin@spintly.com cc sherilyn.f@spintly.com | GOOD | It notes the 6 Oct windows have passed and asks for fresh slots, which fixes the v8 18250 stale-window problem. Minor D issue: Rohin is in California (per Sherilyn), yet it asks for slots "in IST" only. |
| 18356 | new_email_from_shradhaa | founder | EosNox founder for Michele | eosnox.info@gmail.com | GOOD | "Thursday 15 October at 2:30 PM IST (11:00 AM Central European Summer Time)" is correct (09:00 UTC, and 15 Oct 2026 is a Thursday). Michele wrote "11:00CET", which the agent reads as local summer time. |
| 18357 | internal_mail | n/a | Bon Cuisine x IvyCap TIME NEEDED | investors@, dealflow@, shradhaa@ | FIX | The handover pattern is correct ("Nothing has been booked"). But it says Vikash "offered to come to our office", while per the brief Vikash offered to come to **IvyCap's** office. Phone numbers are fine in an internal mail. |
| 18358 | reply_from_shradhaa | 1a0d6faabdfabf28 | Spintly x 247 VC (Kruti) | kruti@247vc.in | FIX (real error) | Guard error, quoted above. The text is right and backed by 18355, but it would also drop Rohin, Malcolm, Sherilyn and Khushi from a shared thread. It was not retried. |
| 18359 | reply_from_shradhaa | 1a0eb3d27f7eceb6 | EosNox x Michele Barbazza | micel_brzz@yahoo.com | GOOD | "I have asked the founder", backed by 18356. It gives the time in Michele's zone. Minor: "Thanks for your patience" mirrors his own line, and his 2 alternate addresses (cc) are dropped. |
| 18360 | reply_from_akansha | 19e07277366af2f5 | HYRGPT x Udyat (Naman) | naman@udyatventures.com | GOOD | Pass acknowledged. Minor: "reviewing HYRGPT properly" reads oddly. Founders Debi and Neha (cc'd by Naman) are dropped. |
| 18361 | reply_from_akansha | 1a0e6094b95b2956 | HYRGPT x OG Capital (Deeksha) | deeksha@ogcapital.one | GOOD | Correct "Hi Deeksha", which shows the inconsistency with 18346 and 18354 (Shradhaa's mailbox, "OG Capital team"). Enterprise@ is dropped. Deeksha gets 3 mails in this run. |
| 18362 | reply_from_akansha | 1a10a0a754d8a78b | MindWox x GVFL (Hemang) | hemang@gvfl.com | FIX (minor) | "Thanks for coming back on MindWox so quickly" is false, and it near-copies 18338 to the same person on the same day. |
| 18363 | reply_from_aditya | 1a0f03a28dd680c6 | CLIKD x Baldota FO (Swarup) | swarup.ravichandran@baldota.co.in | GOOD | "Our team will send the CLIKD deck to investment-proposals@baldota.co.in", backed by 18364. |
| 18364 | internal_mail | n/a | CLIKD x Baldota FORWARD NEEDED | dealflow@, shradhaa@ | GOOD | Has the deck link, the one-pager and the founder contact. Minor: investors@ (Aditya owns the thread) is not on it. |

## Full draft text

Line breaks are shown as " / ".

**Deal flow**
- 18321: Hi Mistry team, / Thanks for going through the Sugar's Daddy proposal and for telling us so quickly. Understood on the round. We appreciate the time you gave it. / Best, Aditya
- 18322: Hi Mistry team, / Thank you for reviewing MonitorExam and for the quick answer. We understand it is not one for you in this round. / Best, Aditya
- 18323: Hi Colossa Ventures team, / Thanks, that is useful. We have noted the women-led or co-led focus and the climate exception, and we will keep both in mind for what we send you. / Best, Aditya
- 18324: Hi Omnivore team, / Thanks for the quick answer on DACBY. Understood, it is outside what you back, and we appreciate you saying so plainly. / Best, Chaman
- 18325: Hi GreenFrontier team, / Thank you for the reply on DACBY and for being clear about your decarbonisation focus. That helps us send you the right things. / Best, Chaman
- 18326: Hi Dexter team, / Thanks for flagging that, and sorry for sending it again. Noted on our side that you passed on Springbase.ai on 23 September. / Best, Akansha
- 18327: Hi Neeti, / Thank you for going through the Ulai deck and for being clear about where it sits against your focus. That helps. / Best, Shradhaa
- 18328: Hi Neeti, / Thanks for reviewing Fire Armor and for the answer. Understood on the fit. / Best, Chaman
- 18329: Hi Neeti, / Thanks for reviewing RECEX and for telling us where it stands for you. Understood. / Best, Akansha

**Hot deals**
- 18330 (error) and 18339 (DRY OK), identical text: Hi Beyond Seed team, / Thanks for looking at Bon Cuisine and for telling us so quickly. Understood on the fit with your current focus. / Best, Aditya
- 18331: Hi Mint VC team, / Thanks for writing back and being clear on the sector. Understood. / Best, Aditya
- 18332: Hi Mint VC team, / Thanks for the quick answer on LearningPad. Understood on the sector fit. / Best, Aditya
- 18333: Hi Sun Icon team, / Thank you for looking at LearningPad and for coming back to us. Understood on the fit. / Best, Aditya
- 18334: Hi Arnav, / Noted, thank you. From now on we will tag only pitch@sucseedindovation.com on the deals we send you. / Best, Aditya
- 18335: Hi Mount Judi team, / Thanks for following up and for the honest view on the traction. Understood on the focus. / Best, Aditya
- 18336: Hi Hammad, / Thank you for the call and for the three points. We have noted the product walkthrough, the question on how the IP would be restructured depending on who leads the round, and the request for MSME outcome data. We will come back to you on them. / Best, Aditya
- 18337: Hi Hammad, / Thanks for the update. We will wait for your next steps on the in-person meeting. / Best, Aditya
- 18338: Hi Hemang, / Thanks for coming back so quickly. Understood. / Best, Aditya
- 18340: Hi Devesh, / Understood, and fair. We will take one deal at a time with you. HYRGPT is the one we are talking about now, and I will keep the next note to that alone. / Best, Akansha
- 18341: Hi Shradha, / Thanks for the clear answer, and for taking the time to reply. Case by case works for us, and I will keep that in mind for EosNox. / Best, Shradhaa
- 18342: Hi Mucker Capital team, / Thanks, noted. We will keep you to US companies for now and will not send you EosNox or other India-based deals. / Best, Shradhaa
- 18343: Hi M Venture Partners team, / Thanks for coming back on RoadAthena and for being clear on your early-stage focus in India. Understood, and thank you for the time. / Best, Chaman
- 18344: Hi M Venture Partners team, / Thank you for taking the time to review MentorCloud and for telling us so directly. Understood on the thesis fit. / Best, Shradhaa
- 18345: Hi Inflexor team, / Thanks for the honest view on MentorCloud, and for the time your team gave it. Understood on the competitive segment. / Best, Shradhaa
- 18346: Hi OG Capital team, / Thanks for looking at Spintly and for coming back to us. Understood on the partnership, and we appreciate the time you gave it. / Best, Shradhaa
- 18352: Hi M Venture Partners team, / Thanks for coming back on Talent Recruit and for being direct about the decision. Understood, and thank you for the time you put into looking at it. / Best, Akansha
- 18353: Hi Beyond Seed team, / Thanks for looking at Spintly and for telling us where it sits against your current thesis. Understood, and thank you for the time. / Best, Shradhaa
- 18354: Hi OG Capital team, / Thanks for taking a look at EosNox and for letting us know where you landed. We appreciate the time you gave it. / Best, Shradhaa
- 18355 (to rohin@spintly.com cc sherilyn.f@spintly.com, subject "Spintly: windows for a 247 VC Tech Fund follow-up call"): Hi Rohin, / Kruti at 247 VC Tech Fund would like a follow-up call with you and the team. The windows Sherilyn sent on 6 October have passed, so could you send two or three fresh slots in IST for the next few days? / Once you reply, I will confirm the time with Kruti and send the invite. / Best, Shradhaa
- 18356 (to eosnox.info@gmail.com, subject "EosNox: an investor would like a call with you"): Hi Abhimanyu, / An investor would like a call with you. Michele wrote that he is interested to have a call with the founder and asked about 14, 15 or 16 October at 11:00 Central European Summer Time. / Thursday 15 October at 2:30 PM IST (11:00 AM Central European Summer Time) works for us. Can you confirm that works for you? If it does, I will confirm it with Michele and send the invite. / Best, Shradhaa
- 18357 (internal, "TIME NEEDED | Bon Cuisine <> IvyCap Ventures"): Harshit at IvyCap said the 5:30 PM IST slot today (13 October) does not work for him. Vikash at Bon Cuisine has asked for our availability for tomorrow (14 October) in the second half of the day, and offered to come to our office. / Calendar read for 14 October afternoon: Aditya has a call at 3:30 PM IST, Shradhaa has calls at 2:30 PM, 3:00 PM and 3:30 PM IST. Please pick a slot that works with Harshit and Vikash and reply on this thread so I can confirm it with Vikash. / Founder contact from Founders Info: Vikash, 96328 77771. POC Khushbu, 97310 41631. Nothing has been booked.
- 18358 (error, not sent): Hi Kruti, / Thanks for your patience. The windows Sherilyn sent on 6 October have passed, so I have asked Rohin for fresh slots for a follow-up call with you and the team. I will come back to you with a time once he replies. / Best, Shradhaa
- 18359: Hi Michele, / Thanks for your patience. I have asked the founder for a call with you on Thursday 15 October at 11:00 AM Central European Summer Time, which is one of the windows you offered. I will come back to you once they confirm. / Best, Shradhaa
- 18360: Hi Naman, / Thanks for reviewing HYRGPT properly and for letting us know. Understood. / Best, Akansha
- 18361: Hi Deeksha, / Thanks for taking a look at HYRGPT and for letting us know where you landed. We appreciate the time. / Best, Akansha
- 18362: Hi Hemang, / Thanks for coming back on MindWox so quickly. Understood. / Best, Akansha
- 18363: Hi Swarup, / Thanks, noted on the address. Our team will send the CLIKD deck to investment-proposals@baldota.co.in. / Best, Aditya
- 18364 (internal, "FORWARD NEEDED | CLIKD <> Baldota Family Office"): Swarup Ravichandran at Baldota Family Office asked on 12 October that all investment decks go to investment-proposals@baldota.co.in. Please send the CLIKD deck to that address. The deck link on the documents sheet is https://bit.ly/42YwZuB. The one-pager is at https://drive.google.com/file/d/1qP4iEkY5YoLSqANq7m2J4FAiz4dOYzDY/view?usp=drivesdk. Founder: Raghav, 85869 46001.

## Rule checklist (v8 problems vs this run)

| Rule | Status | Evidence |
|---|---|---|
| G. One send per thread and per founder | **FIXED** | No thread_id got 2 DRY OKs. The only repeated thread is 1a114e2ad4ad9205 (18330 error, then 18339 DRY OK), which is the allowed external-start retry. Each founder got one mail (rohin@ 18355, eosnox.info@ 18356). Several investors still get multiple mails on different threads: Rahil 3 (18343, 18344, 18352), Deeksha 3 (18346, 18354, 18361), Neeti 3 (18327, 18328, 18329), Biswadeep 2, Hemang 2, Hammad 2, Mistry proposals@ 2. |
| H. Mailbox / 404 | **FIXED** | No 404 or "thread not found" errors in this run. The single "thread not started by us" (18330) was retried once with allow_external_start:true (18339) and got DRY OK. |
| H. Bon Cuisine x IvyCap (1a134efa1a990db0, 1a134efa0a4bd883, 1a134efa0a559328) | **NOT FIXED / changed** | No send to any of the three threads was attempted, so no external draft reached DRY OK. Only internal TIME NEEDED 18357 (DRY OK) exists. It gets "Harshit... the 5:30 PM IST slot today (13 October) does not work" right, but says Vikash "offered to come to **our** office". Per the brief, he offered to come to IvyCap's office. Harshit and Vikash get no acknowledgement. |
| L. Greeting = first name as signed | **NOT FIXED** | 18 drafts greet a "team" when an individual wrote or signed: 18321, 18322, 18323, 18324, 18325, 18331, 18332, 18333, 18335, 18339, 18342, 18343, 18344, 18345, 18346, 18352, 18353, 18354 (18321/18322 Charles; 18325 Apoorva; 18331/18332 Biswadeep; 18335 Areeb; 18342 Amol). A name absent from the thread: 18334 "Hi Arnav". There are no surnames and no bare "Hi". |
| R. Keep colleagues the investor cc'd | **NOT FIXED** | Dropped: kg@ (18325), Pratekk (18327, 18328), Harsh Jain (18339), partnerdeals@ (18331, 18332), nemikaS@ and pitch@ (18334), Huzaif (18337), Harshit (18340), Chiranjeev (18343, 18344, 18352), Sayan and Enterprise@ (18346, 18354), Suraj (18353), Enterprise@ (18361), anuradha@ (18326). Founders are also dropped from shared threads (18336 Ravi, 18337 MindWox team, 18358 Spintly team). |
| R. No investor phone numbers in founder mails | **FIXED** | 18355 and 18356 contain no phone numbers. Phone numbers appear only in the internal mails 18357 and 18364. |
| S. No founder email after a pass | **FIXED** | GVFL Hemang: only pass acknowledgements (18338 CLIKD, 18362 MindWox). There is no Starz AI founder email and no mobile number relayed. No founder email was triggered by any pass in this run. |
| T. "I have asked the founder" only if a founder email exists | **FIXED** | 18359 "I have asked the founder" is backed by 18356. 18358 "I have asked Rohin" is backed by 18355. |
| D. Reader's zone plus IST, no UTC passed off as IST | **FIXED (minor caveat)** | 18356 "2:30 PM IST (11:00 AM Central European Summer Time)" is correct, and 18359 gives the time in Michele's zone. Caveat: 18355 asks California-based Rohin for slots "in IST" only, and Michele's "11:00CET" was silently read as CEST. |
| U. Pass replies not copy-pasted | **MOSTLY FIXED** | No two drafts are identical (v8 had 18200 = 18201 and Neeti x3). Remaining repeated sentences: "Understood." x5 (18329, 18331, 18338, 18360, 18362), "We appreciate the time you gave it." x2 (18321, 18354), "Understood on the fit." x2 (18328, 18333), "Understood, and thank you for the time." x2 (18343, 18353), "Thanks for your patience." x2 (18358, 18359). 18338 and 18362 to the same Hemang are near-identical, as are 18354 and 18361 to the same Deeksha. |
| No dash as punctuation / banned phrases | **PASS** | A scan of all 38 texts found none. |
| No invented addresses / no other investor named | **PASS** | Every address used is in the thread (pitch@sucseedindovation.com and investment-proposals@baldota.co.in were quoted by the investor). |
| Calendly never to founders | **PASS** | No Calendly or booking links anywhere, and no book_meeting calls. |
| Hot/non-hot scope | **PASS** | See Scope above. |
| Factual accuracy (general) | **NOT FIXED** | "quick answer" or "so quickly" after long gaps or several nudges (18322, 18324, 18332, 18338, 18339, 18362). 18335 "Thanks for following up" is reversed. 18346 "Understood on the partnership" is garbled. Firm names are misspelt: "Mint VC" (18331, 18332) and "Sun Icon" (18333). |

## Top 5 remaining problems

1. **Greeting rule L is still broken in 18 drafts.** Examples: 18325 "Hi GreenFrontier team," to a reply signed "Best, Apoorva" (identical to v8 18204), 18331 "Hi Mint VC team," to "Best, Biswadeep", and 18342 "Hi Mucker Capital team," to "Best, Amol Bhat". The same Deeksha gets "Hi OG Capital team," (18346, 18354) and "Hi Deeksha," (18361). 18334 still says "Hi Arnav", a name absent from the thread.
2. **Investor colleagues are still dropped from cc (rule R),** in 14 or more drafts. Examples: 18340 drops Harshit, whom Devesh cc'd on "can we please take one deal at a time"; 18343, 18344 and 18352 drop Chiranjeev; 18346 drops Sayan (the original addressee) and Enterprise@.
3. **Bon Cuisine x IvyCap still gets no external reply,** and the internal handover misstates the venue. 18357 says Vikash "offered to come to our office", but per the brief he offered to go to IvyCap's office. None of 1a134efa1a990db0, 1a134efa0a4bd883 or 1a134efa0a559328 got a send attempt.
4. **Spintly x 247 VC update failed on the guard (18358):** `latest message is from sherilyn.f@spintly.com, expected kruti@247vc.in`. It was not retried with the right expect_last_from, so Kruti hears nothing although the founder ask (18355) went out. Separately, MentorCloud x Prana (18336) removes founder Ravi from a thread where Hammad's questions were addressed to him and answers "We will come back to you on them".
5. **False or garbled acknowledgements.** 18338 "Thanks for coming back so quickly" and 18362 "Thanks for coming back on MindWox so quickly" (Hemang replied "pass." after 3 to 4 nudges over 1 to 2 weeks; the two mails are near-identical). 18335 "Thanks for following up" (we were the ones following up). 18346 "Understood on the partnership". 18334 promises "we will tag only pitch@sucseedindovation.com" but sends To deet@ without pitch@.
