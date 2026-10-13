# Dry-run email audit v10, 13 Oct 2026 (third dry run)

**Scope:** every execution of the 10 send workflows that started after 2026-10-13T16:14:00Z. `search_workflow_executions` (startedAfter 16:14Z, limit 200, no next cursor; a second query from 16:33:30Z returned nothing) lists 187 executions. **48** of them belong to send workflows: 18380 to 18383, 18385 to 18388, 18431 to 18437, 18440, 18441, 18473, 18496 to 18503 and 18533 to 18554. The other 139 are read and lookup workflows, mostly read_thread (OwJJDNv0kmYub5fb), and are out of scope except as evidence. I read each of the 48 with `get_workflow_execution(includeData:true)`. I also opened 9 read_thread executions to see what the agents saw: 18442, 18443, 18444, 18516, 18518, 18519, 18523, 18524 and 18525. I used only read tools and changed nothing.

There were no calls to book_meeting, new_email_from_aditya, new_email_from_akansha or new_email_from_chaman.

| Agent | Run | Executions | DRY OK | Real errors | GOOD | FIX | BAD | Distinct work items |
|---|---|---|---|---|---|---|---|---|
| Deal flow (69yk0Q9hf39k9NSp) | run_0ca8f839 | 17 (18380 to 18441) | 17 | 0 | 14 | 3 | 0 | 17 threads |
| Hot deals (E4dPrqOZm4GXpfJA) | run_8a82d00c | 31 (18473, 18496 to 18503, 18533 to 18554) | 31 | 0 | 23 | 7 | 1 | 27 items (26 investor threads, 2 founder mails that belong to the Michele items, 2 FORWARD NEEDED handovers, 1 TRAIL probe) |
| **Total** | | **48** | **48** | **0** | **37** | **10** | **1** | **44** |

**Real errors:** none. Every execution ended in `DRY OK`. There was no 404, no "thread not started by us" and no "latest message is from" guard error. v9 had two real errors: 18330, and 18358, the Spintly x 247 VC expect_last_from mistake. Both are now fixed, in 18536 and 18546. Note that **18473 got DRY OK although its body is the literal word "placeholder"**, which is why I graded it BAD.

**Throughput versus v9:** Deal flow went from 9 threads to 17. Hot went from 30 executions to 31, but now has 0 real errors instead of 2 and 26 investor threads instead of about 22. The Hot agent also read the MentorCloud x Prana thread (read_thread 18516) and correctly did not answer Hammad's questions, which were put to the founder.

**What changed:** read_thread now returns `reply_to_only`, `expect_last_from`, `started_by_us` and a "Greet the sender by the first name they sign with" hint. That one change fixed rules L and R almost everywhere.

**Scope:** clean. Deal flow touched only non-hot startups: Sugar's Daddy, MonitorExam, Caffena, DACBY, Springbase, Ulai, Fire Armor, RECEX, Xproguard, Koncite, Twil Tech, Train Rex, Awenest and GroCliq. Hot touched only hot startups: LearningPad, HYRGPT, MindWox, CLIKD, Spintly, EosNox, Hoora, Talent Recruit, Bon Cuisine, MentorCloud and RoadAthena. A scan of all 47 texts found no banned phrase, no dash used as punctuation, no Calendly link and no invented address. The Build guard rejects any address that is not on the thread.

## Deal flow agent (69yk0Q9hf39k9NSp), run_0ca8f839

| exec | tool | thread | startup x investor | to | verdict | why |
|---|---|---|---|---|---|---|
| 18380 | reply_from_aditya | 1a114416cc509ff9 | Sugar's Daddy x Mistry (Charles) | proposals@mistryventures.com | GOOD | "Hi Charles", which fixes the v9 "Hi Mistry team". "so quickly" is true: he replied 68 minutes after our mail. charles@ was our own cc, and the reply went To Aditya only. |
| 18381 | reply_from_aditya | 1a11440222941a02 | MonitorExam x Mistry (Charles) | proposals@ | GOOD | Different wording from 18380 ("as well"). |
| 18382 | reply_from_aditya | 1a109f14bce6dc6c | Caffena x Colossa (Anuj Kokate) | anuj.k@colossaventures.com | GOOD | "Hi Anuj", which fixes v9 18323. It restates the women-led and climate mandate correctly. |
| 18383 | reply_from_chaman | 1a109fafc2a0f306 | DACBY x Omnivore (Aaushi) | aaushi@omnivore.vc | FIX | "Thanks for the quick answer": she answered 2 days after the deck, and only after our nudge (rule U). Greeting fixed. |
| 18385 | reply_from_chaman | 1a11447c86cc4ac7 | DACBY x Green Frontier (Apoorva) | ar@, kg@greenfrontiercapital.com | GOOD | "Hi Apoorva" and kg@ is kept, which fixes both v9 18325 problems. |
| 18386 | reply_from_akansha | 1a114622471d87fd | Springbase x Dexter | deals@, anuradha@dexter.ventures | GOOD | The pass was signed "Investment Team", so "Hi Dexter Ventures team" is right. anuradha@ is kept. |
| 18387 | reply_from_shradhaa | 1a0f58c64d7e7630 | Ulai x GrowthCap (Neeti) | neeti.b@, pratekk@growthcap.vc | GOOD | Pratekk is kept (fixed). Style nit: "focus" appears twice. |
| 18388 | reply_from_chaman | 1a0f564083c7b1a9 | Fire Armor x GrowthCap (Neeti) | neeti.b@, pratekk@ | GOOD | Pratekk is kept. |
| 18431 | reply_from_akansha | 1a11981123ec4220 | RECEX x GrowthCap (Neeti) | neeti.b@ | GOOD | "so quickly" is true (4.6 hours). Neeti gets 3 differently worded mails. |
| 18432 | reply_from_chaman | 1a11e919ca512e3a | DACBY x Lumikai (Abhay) | abhay@lumikai.com | GOOD | hello@ was our own cc. The reply went To Chaman only. |
| 18433 | reply_from_akansha | 1a0f5786c28ce1b4 | Xproguard x OG Capital (Shrinidhi) | shrinidhi@ogcapital.one | GOOD | Pass acknowledged. "consumer investment focus" comes from the body, which the snippet cuts off, so I could not verify it. |
| 18434 | reply_from_akansha | 1a1197f679c48fe8 | Koncite x Swishin (Falak) | falak@, rahul.j@swishin.vc | GOOD | Rahul Jalan, on her To line, is kept. |
| 18435 | reply_from_chaman | 1a10f250c46d9be6 | Twil Tech x Swishin (Falak) | falak@ | GOOD | It cites her reasons (China competition, differentiation). |
| 18436 | reply_from_akansha | 1a11460a7bf9e375 | Springbase x Ramaiah Evolute (Ankith) | ankith@ramaiah-evolute.com | GOOD | arvind@ was our own cc. The reply went To Akansha only. |
| 18437 | reply_from_akansha | 1a0c71930b3e6f89 | Train Rex x Prath (Harsh Chaudhary) | chaudhary@, ashna@prathventures.com | GOOD | Ashna is kept. "Hi Harsh" is correct. |
| 18440 | reply_from_akansha | 1a0f65ed69a5de47 | Awenest x Early Seed (Karan Shah), an inbound pitch to us | karan@earlyseedventures.com | FIX (minor) | allow_external_start was passed up front, which is correct. "Our team will come back to you on a call with the founders" answers Karan's yes/no question with a promise, and no internal handover backs it (rule T). |
| 18441 | reply_from_akansha | 1a10f3a150f3f0ad | GroCliq x The Chennai Angels (Team TCA) | connect@, udith@, kaushik@thechennaiangels.com | FIX (minor) | Recipients are right. "Our team will come back to you on this with the latest deck": no internal mail or founder mail asks anyone for the new deck, unlike the Hot agent's FORWARD NEEDED 18538 and 18554. "Hi Udith" is acceptable because Udith was our original addressee, but the mail was signed "Team TCA". |

## Hot deals agent (E4dPrqOZm4GXpfJA), run_8a82d00c

| exec | tool | thread | startup x investor | to | verdict | why |
|---|---|---|---|---|---|---|
| 18473 | internal_mail | n/a | "TRAIL APPROVAL \| Spintly <> Mr Mandeep" | investors@ | **BAD** | The html is the literal string `placeholder`. This was a probe call made before the agent read the thread (read_thread 18526 came 7 minutes later). That thread was closed on 9 Oct ("Its already made so you can skip it now"). Live, it would send an empty "placeholder" mail. |
| 18496 | reply_from_aditya | 1a0f027f8cffab6e | LearningPad x VCMint (Biswadeep) | biswadeep@, partnerdeals@vcmint.com | FIX | "Thanks for telling us so quickly". Our deck went on 30 Sep at 08:02 IST and he replied on 9 Oct at 00:57 IST, about 9 days later. read_thread showed both dates. Greeting and partnerdeals@ are fixed. |
| 18497 | reply_from_akansha | 19e07277366af2f5 | HYRGPT x Udyat (Naman) | naman@, debi@hyrgpt.com, neha@hyrgpt.com | GOOD | The founders Debi and Neha (cc'd by Naman) are kept, which fixes v9 18360. |
| 18498 | reply_from_akansha | 1a10a0a754d8a78b | MindWox x GVFL (Hemang) | hemang@gvfl.com | GOOD | The false "so quickly" from v9 18362 is gone. No founder mail was sent (rule S). |
| 18499 | reply_from_aditya | 1a0f0270d79e1d13 | CLIKD x GVFL (Hemang) | hemang@ | FIX (minor) | It opens the same way as 18498 to the same person on the same day: "Thanks for the clear answer on CLIKD and for..." against "...on MindWox and for..." (rule U). |
| 18500 | reply_from_shradhaa | 1a0e6224be2fd228 | Spintly x Beyond Seed (Harsh Jain) | harsh@, suraj@beyondseed.com | GOOD | Fixes v9 18353: "Hi Harsh", and Suraj is kept. |
| 18501 | reply_from_shradhaa | 1a0d6a53acaf51c9 | EosNox x OG Capital (Deeksha) | deeksha@, enterprise@, sayan@ogcapital.one | GOOD | Fixes v9 18354. |
| 18502 | reply_from_aditya | 1a0fa72e569d1bec | Hoora x Mount Judi (Areeb) | areeb@mountjudi.com | GOOD | "Hi Areeb". The reversed "Thanks for following up" is gone. |
| 18503 | reply_from_akansha | 1a0cc3ee29eff0e3 | Talent Recruit x M Venture Partners (Rahil) | rahil@, chiranjeev@ | GOOD | Fixes v9 18352. "after the delay" picks up his own apology. |
| 18533 | new_email_from_shradhaa | founder | Spintly founder (Rohin) for Michele Barbazza | rohin@spintly.com | GOOD (D caveat) | "19, 20 or 21 October at 9:00 CET, which is 12:30 IST on each day (midnight Pacific)". The arithmetic is right if Michele means local time: CEST runs until 25 Oct, so 07:00 UTC = 12:30 IST = 00:00 PDT. Rohin's zone is given. It is labelled "CET" although the arithmetic uses CEST; a true CET reading would be 13:30 IST. No phone number. |
| 18534 | new_email_from_shradhaa | founder | EosNox founder (Abhimanyu) for Michele | eosnox.info@gmail.com | GOOD (D caveat) | "14, 15 or 16 October at 11:00 CET, which is 14:30 IST": right as CEST, with the same label caveat. 14 Oct is tomorrow. |
| 18535 | reply_from_akansha | 1a10a0fc25da8718 | HYRGPT x IvyCap (Devesh) | devesh@, harshit@ivycapventures.com | GOOD | Harshit is kept, which fixes v9 18340. |
| 18536 | reply_from_aditya | 1a114e2ad4ad9205 | Bon Cuisine x Beyond Seed (Siddharth Patel) | indiaops@, harsh@beyondseed.com | GOOD | allow_external_start was passed first time, so there was no wasted error as in v9 18330. "Hi Siddharth" and Harsh is kept. |
| 18537 | reply_from_aditya | 1a0e5e64497df994 | Hoora x SucSEED (DEET) | deet@sucseed.co, nemikas@, pitch@sucseed.biz, pitch@sucseedindovation.com | GOOD (name unverified) | All 4 recipients are kept and the deck ask is answered, backed by 18538. It still says "Hi Arnav". 18538 cites "DEET, Arnav Bhatara", which suggests a body signature, but I did not open this read_thread, so this is unverified. |
| 18538 | internal_mail | n/a | FORWARD NEEDED Hoora x SucSEED | dealflow@, shradhaa@ | GOOD | It backs 18537. Minor: no deck link. |
| 18539 | reply_from_aditya | 1a0e5dd41e8b5be4 | LearningPad x Sunicon (Aakansh) | aakansh@sunicon.vc | GOOD | "Hi Aakansh". The "Sun Icon" misspelling is gone. |
| 18540 | reply_from_shradhaa | 1a0d176da7c2ab3b | MentorCloud x M Venture Partners (Rahil) | rahil@, chiranjeev@ | GOOD | Fixes v9 18344. |
| 18541 | reply_from_shradhaa | 1a0f06193017ff5e | EosNox x Rainmatter (Shradha Pujar) | shradha.pujar@zerodha.com | GOOD | Answers "case by case". |
| 18542 | reply_from_shradhaa | 1a0d17770fb18072 | MentorCloud x Inflexor (Pratik) | pratik@inflexor.vc | GOOD | Fixes v9 18345. |
| 18543 | reply_from_shradhaa | 1a10f44f98d6de82 | EosNox x Mucker (Amol Bhat) | amol@muckercapital.com | GOOD | "Hi Amol", which fixes v9 18342. |
| 18544 | reply_from_chaman | 1a0841e292c7ca83 | Road Athena x M Venture Partners (Rahil) | rahil@, chiranjeev@ | GOOD | Fixes v9 18343. Its opener is close to 18540 ("Thanks for getting back..."), but the two come from different mailboxes on different deals. |
| 18545 | reply_from_aditya | 1a0f028e79685e76 | Bon Cuisine x VCMint (Biswadeep) | biswadeep@, partnerdeals@ | FIX | "Thanks for coming back on Bon Cuisine so quickly" is false (about 9 days). It is also a near copy of 18496 to the same Biswadeep the same day: "...so quickly, and for being clear that [X] sits outside your sectors of focus. We appreciate you looking at it." |
| 18546 | reply_from_shradhaa | 1a0d6faabdfabf28 | Spintly x 247 VC (Kruti) | sherilyn.f@, kruti@247vc.in, rohin@, malcolm@, khushi@ | FIX | expect_last_from is now right (the v9 18358 guard error is fixed) and everyone is kept. But it offers Sherilyn's windows from **6 Oct** ("this week") as current on 13 Oct: "this week he can do 9:00 AM to 12:30 PM IST, or 8:30 PM to 11:00 PM IST". v9 18355/18358 correctly said those windows had passed. The opening "Hi Kruti, / Thanks Sherilyn for..." is also clumsy. |
| 18547 | reply_from_shradhaa | 1a0eb3a109fd049e | Spintly x OG Capital (Deeksha) | deeksha@, enterprise@, sayan@ | GOOD | Fixes v9 18346 (greeting, Sayan and Enterprise). |
| 18548 | reply_from_akansha | 1a0e6094b95b2956 | HYRGPT x OG Capital (Deeksha) | deeksha@, enterprise@ | FIX (minor) | A near copy of 18547 to the same Deeksha the same day: "...and for telling us where it landed... next round... as you asked." She gets 3 mails (18501, 18547, 18548). |
| 18549 | reply_from_shradhaa | 1a0b299a3b36c7d0 | Spintly x Michele Barbazza | micel_brzz@yahoo.com, michele.barbazza@vatgroup.com | GOOD | "confirming ... with the founder now" is backed by 18533. Recipients match his latest Cc. |
| 18550 | reply_from_shradhaa | 1a0eb3d27f7eceb6 | EosNox x Michele Barbazza | micel_brzz@, michele.barbazza@vatgroup.com, m.barbazza@vat.ch | GOOD | Backed by 18534. Keeps both alternate addresses, which v9 18359 dropped. |
| 18551 | reply_from_aditya | 1a134efa1a990db0 | **Bon Cuisine x IvyCap** | vikash@bon-cuisine.in, harshit@, devesh@ivycapventures.com | FIX | See the Bon Cuisine section. It asks the founder for windows he has just given. |
| 18552 | reply_from_akansha | 19e8663d2bd9c5c5 | RoadAthena x ZeCa (Pawan) | prerna@roadathena.com, pawan@zeca.vc, rahul@hanu.ai, shreya@, aakash@zeca.vc, manav@roadathena.com | FIX | Prerna, the founder, had already answered Pawan and asked him "not able to understand what structure you are referring to". Our mail repeats her numbers back to the same people ("a 2 million total ask", with no currency) and opens "Thanks for picking this up", which is unfounded. It then says "On the structure, let me come back to you on it". Pawan owes that answer, not us, and nothing in this run backs the promise. |
| 18553 | reply_from_aditya | 1a0f03a28dd680c6 | CLIKD x Baldota FO (Swarup) | swarup.ravichandran@ | GOOD | Backed by 18554. Minor: "Our team will come back to you on this" is vague, because the deck goes to another address. |
| 18554 | internal_mail | n/a | FORWARD NEEDED CLIKD x Baldota | dealflow@, shradhaa@ | GOOD | Minor: no deck link, where v9 18364 had one. |

## Bon Cuisine x IvyCap: what the Hot agent did, and whether it was right

read_thread 18523 shows the whole thread 1a134efa1a990db0 (started_by_us false):
- **13 Oct 11:04 UTC (16:34 IST), Harshit** (calendar reply to all): "Hey Vikash, sorry we couldn't connect today. I have a commitment later in the day, so unfortunately the 5:30 PM slot won't work for me. Happy to host you at our office at WeWork Galaxy on Residency Road. We can coordinate a time for later this week or next week. You can reach me at +91 86981 71188. Happy to connect on WhatsApp to coordinate as well."
- **13 Oct 11:47 UTC (17:17 IST), Vikash**: "Hello Harshit, Thanks for your mail, please let me know your availability for tomorrow 2nd half. We can come and see you at your office in 2 nd half of the day."

The agent sent 18551 (DRY OK) To vikash@, harshit@ and devesh@ from investors@, with allow_external_start:true and the right expect_last_from:
> Hi Vikash, / Thanks for your note. Harshit has offered to host you at the IvyCap office at WeWork Galaxy on Residency Road, later this week or next week. / Could you send two or three windows, in IST, that suit you? We will confirm the time with IvyCap and come back to you. / Best, Aditya

What it got right:
- The venue is IvyCap's office, which fixes v9 18357 ("our office").
- The 5:30 PM slot is not rebooked.
- Both IvyCap people are kept.
- No founder phone number appears.
- Nothing is falsely claimed as booked.

What is wrong:
- The question is aimed at the wrong person. Vikash has already given his window, tomorrow (14 Oct) second half at IvyCap's office, and asked Harshit to confirm it. Asking Vikash for "two or three windows" again would read as if we had not read his mail.
- The right move was a short note to Harshit, keeping Vikash and Devesh on the thread, asking whether 14 Oct afternoon works, or else leaving the two of them to coordinate directly as Harshit offered.
- Unlike v9 (18357), no internal TIME NEEDED handover was sent.

**Verdict: FIX.**

## Rule checklist

| Rule | Status | Evidence |
|---|---|---|
| L. Greeting = first name from the sign-off; no "Hi <Firm> team" when a person signed; no surnames; no names absent from the thread | **FIXED** (one name unverified) | All 18 v9 failures are corrected in their re-drafts: Charles 18380/18381, Anuj 18382, Aaushi 18383, Apoorva 18385, Biswadeep 18496/18545, Aakansh 18539, Areeb 18502, Siddharth 18536, Amol 18543, Rahil 18503/18540/18544, Pratik 18542, Deeksha 18501/18547, Harsh 18500. The team greeting is kept only where the pass was signed "Investment Team" (18386 Dexter). No surnames. Open: 18537 "Hi Arnav", plausibly from DEET's body signature ("Arnav Bhatara" in 18538) but not verified. 18546 opens "Hi Kruti, / Thanks Sherilyn", which is clumsy but not wrong. |
| R. to_only keeps everyone the investor copied; no one new; no investor phones in founder mails; founders not removed | **FIXED** | Every draft matches the To/Cc of the latest inbound message. Kept: kg@ 18385, Pratekk 18387/18388, anuradha@ 18386, Rahul Jalan 18434, Ashna 18437, Udith and Kaushik 18441, partnerdeals@ 18496/18545, Debi and Neha (founders) 18497, Suraj 18500, Enterprise@ and Sayan 18501/18547, Enterprise@ 18548, Harshit 18535, Harsh 18536, all 4 SucSEED addresses 18537, Chiranjeev 18503/18540/18544, the full Spintly and 247 team 18546, Michele's alternate addresses 18550, the ZeCa and RoadAthena team 18552. The founder mails 18533/18534 contain no phone numbers. The founder-addressed Prana threads (MentorCloud, MindWox) were read (18516) and left alone, so no founder was removed. |
| G. One send call per thread and per founder | **FIXED** | 43 distinct thread_ids, each sent exactly once. One founder mail each to rohin@ (18533) and eosnox.info@ (18534). Several investors still get more than one mail on different threads in the same run: Deeksha 3, Rahil 3, Neeti 3, Biswadeep 2, Hemang 2, Falak 2, Michele 2, Mistry 2. |
| H. No 404s; "latest message is from X" re-read and redrafted once | **FIXED** (re-read path not exercised) | 0 errors of any kind. The v9 18358 Spintly x 247 VC guard error is gone: 18546 passes expect_last_from sherilyn.f@. allow_external_start is passed up front on external-start threads (18440, 18536, 18551, 18552). No guard fired, so the re-read-and-redraft path was not tested. |
| D. Times in the reader's zone plus IST; UTC not passed off as IST | **FIXED** (label caveat, one stale window) | 18533: "9:00 CET, which is 12:30 IST ... (midnight Pacific)", correct and in Rohin's zone. 18534: "11:00 CET, which is 14:30 IST", correct. 18549/18550 use Michele's own zone. Caveats: the agents echo Michele's "CET" although the arithmetic is CEST, which is correct until 25 Oct. 18546 presents 6 Oct "this week" windows as current on 13 Oct, a staleness error rather than a zone error. |
| S. No founder mail after a pass-and-call-offer (GVFL Hemang / Starz AI) | **FIXED** | GVFL got only pass acknowledgements (18498 MindWox, 18499 CLIKD). There is no founder mail for CLIKD or MindWox and no Starz AI activity. The only founder mails (18533, 18534) answer Michele's explicit call requests. |
| T. "I have asked the founder" backed by a founder mail in this run | **FIXED for founder claims, NOT fixed for team promises** | Backed: 18549 → 18533, 18550 → 18534, 18537 → 18538, 18553 → 18554. Unbacked "our team will come back" promises: 18441 GroCliq ("with the latest deck"), 18440 Awenest ("on a call with the founders"), 18552 RoadAthena ("On the structure, let me come back to you on it"). |
| U. No false acknowledgements; no copy-pasted pass sentences | **NOT FIXED** (improved) | False "quick": 18383 ("Thanks for the quick answer" after a nudge, 2 days), 18496 and 18545 ("so quickly", about 9 days). True "quick": 18380 (68 min) and 18431 (4.6 h). False "thanks for following up": gone (18502). Near copies to the same person on the same day: 18496/18545 (Biswadeep), 18547/18548 (Deeksha), 18498/18499 (Hemang, same opener). "We appreciate you looking at it." appears in 4 drafts (18496, 18536, 18544, 18545). |
| U. Firm names spelled as the firm does | **FIXED** | No "Mint VC" or "Sun Icon". Firm names are not used in greetings any more. |
| Bon Cuisine x IvyCap | **NOT FIXED (changed)** | 18551 now gets the venue right (IvyCap's office) and keeps everyone, but it asks Vikash for windows he has already given ("tomorrow 2nd half") instead of asking Harshit to confirm. No TIME NEEDED handover. |
| No dash as punctuation / banned phrases | **PASS** | A scan of all 47 texts found nothing. |
| No invented addresses / no other investor named | **PASS** | Every address is on its thread (enforced by the guard). Founder mails name only the requesting investor (Michele). |
| Calendly never to founders | **PASS** | No links and no book_meeting calls. |
| Cross-scope | **PASS** | See Scope. |
| Internal tool hygiene (new) | **FAIL** | 18473 sent internal_mail with html "placeholder" for an already-closed TRAIL APPROVAL item. |

## Remaining problems that would embarrass us if sent live

1. **18551 Bon Cuisine x IvyCap** asks the founder for windows he has just given. Vikash wrote "please let me know your availability for tomorrow 2nd half. We can come and see you at your office"; we reply "Could you send two or three windows, in IST, that suit you?" Harshit, the person actually asked, gets no question.
2. **18546 Spintly x 247 VC** offers 6 Oct "this week" windows as current: "this week he can do 9:00 AM to 12:30 PM IST, or 8:30 PM to 11:00 PM IST". This is a regression from v9, which noticed the windows had passed. Kruti could book a slot Rohin never offered for this week.
3. **18552 RoadAthena x ZeCa** inserts us between the founder and the investor. It opens "Thanks for picking this up", repeats Prerna's figures ("a 2 million total ask", with no currency) and promises "On the structure, let me come back to you on it", although Prerna had asked Pawan what he meant.
4. **Same-day near-duplicates with false "quickly" to Biswadeep**: 18496 "Thanks for telling us so quickly, and for being clear that LearningPad sits outside your sectors of focus. We appreciate you looking at it." and 18545 "Thanks for coming back on Bon Cuisine so quickly, and for being clear that it sits outside your sectors of focus. We appreciate you looking at it." He took about 9 days. 18547/18548 to Deeksha follow the same pattern without the false claim.
5. **18473 internal mail with body "placeholder"** to investors@ (internal only, but sloppy). Also unbacked "our team will come back" promises in 18440 and 18441, with no FORWARD NEEDED handover from the Deal flow agent.

## Full draft text (line breaks shown as " / ")

**Deal flow**
- 18380 (reply_from_aditya): Hi Charles, / Thanks for coming back on Sugar's Daddy so quickly, and for being clear about the round. We will keep the next ones closer to your focus. / Aditya
- 18381 (reply_from_aditya): Hi Charles, / Thanks for the answer on MonitorExam as well. Understood on the round. We will be more careful with what we send you next. / Aditya
- 18382 (reply_from_aditya): Hi Anuj, / Thanks for spelling that out. Women-led or co-led founders in any sector, and male-founded companies in climate. We will send you only deals that fit that from here. / Aditya
- 18383 (reply_from_chaman): Hi Aaushi, / Thanks for the quick answer. Understood. Our next sends to you will fit your thesis more tightly. / Chaman
- 18385 (reply_from_chaman): Hi Apoorva, / Thanks for the reply. Understood that decarbonization is your focus and DACBY falls outside it. We will keep the next ones inside your scope. / Chaman
- 18386 (reply_from_akansha): Hi Dexter Ventures team, / Thanks for telling us. We are closing Springbase.ai at our end and will not send it to you again. / Akansha
- 18387 (reply_from_shradhaa): Hi Neeti, / Thanks for looking at Ulai and for telling us straight. Understood on the focus. We will look harder at your focus before sending anything else. / Shradhaa
- 18388 (reply_from_chaman): Hi Neeti, / Thanks for the honest note on Fire Armor. We will take your focus into account on the next one. / Chaman
- 18431 (reply_from_akansha): Hi Neeti, / Thanks for looking at RECEX so quickly and for being straight with us. Fair enough on the fit with your current focus. / Best, Akansha
- 18432 (reply_from_chaman): Hi Abhay, / Thanks for coming back to us. Understood on the mandate fit, we will keep that in mind for future deals. / Best, Chaman
- 18433 (reply_from_akansha): Hi Shrinidhi, / Thanks for discussing Xproguard internally and for coming back to us. Understood on the decision for now. We will keep you posted on the company's progress and will bring you anything else that fits your consumer investment focus. / Best, Akansha
- 18434 (reply_from_akansha): Hi Falak, / Thanks for the honest read. Understood that Koncite is too early for you at this stage. / Best, Akansha
- 18435 (reply_from_chaman): Hi Falak, / Thanks for telling us after your internal discussion. Understood on the China competition and differentiation points. / Best, Chaman
- 18436 (reply_from_akansha): Hi Ankith, / Thanks for telling us straight. Understood, we will leave Springbase.ai there for now. / Best, Akansha
- 18437 (reply_from_akansha): Hi Harsh, / Thanks for the clear answer on Train Rex, and for saying you would look again once there are more numbers. Understood, we will come back to you when the traction is further along. / Best, Akansha
- 18440 (reply_from_akansha): Hi Karan, / Thanks for sending Awenest across, and for the snapshot. Our team will come back to you on a call with the founders. / Best, Akansha
- 18441 (reply_from_akansha): Hi Udith, / Thanks for the note from the Team TCA desk. You are right that the deck on file is older. Our team will come back to you on this with the latest deck. / Best, Akansha

**Hot deals**
- 18473 (internal_mail): placeholder   (subject "TRAIL APPROVAL | Spintly <> Mr Mandeep", to investors@)
- 18496 (reply_from_aditya): Hi Biswadeep, / Thanks for telling us so quickly, and for being clear that LearningPad sits outside your sectors of focus. We appreciate you looking at it. / Aditya
- 18497 (reply_from_akansha): Hi Naman, / Thanks for coming back to us on HYRGPT and for letting us know where Udyat landed. We appreciate the time your team gave the company. / Regards, Akansha
- 18498 (reply_from_akansha): Hi Hemang, / Thanks for the clear answer on MindWox and for coming back to us on it. We appreciate you looking at the company. / Regards, Akansha
- 18499 (reply_from_aditya): Hi Hemang, / Thanks for the clear answer on CLIKD and for taking the time to look at it. We appreciate it. / Aditya
- 18500 (reply_from_shradhaa): Hi Harsh, / Thanks for coming back to us on Spintly and for being clear about your thesis. We have noted the categories you are looking at and appreciate you keeping us in mind. / Regards, Shradhaa
- 18501 (reply_from_shradhaa): Hi Deeksha, / Thank you for looking at EosNox and for being direct about it. We understand the decision and appreciate you saying you would like to stay in touch with the team. / Regards, Shradhaa
- 18502 (reply_from_aditya): Hi Areeb, / Thanks for the reply and for being direct on Hoora. We appreciate you giving it a proper look. / Aditya
- 18503 (reply_from_akansha): Hi Rahil, / Thanks for the detailed reason on Talent Recruit and for coming back to us after the delay. The point on how crowded the AI talent acquisition space is comes through clearly. / Regards, Akansha
- 18533 (new_email_from_shradhaa): Hi Rohin, / An investor would like a call with you. Michele Barbazza has said he is interested in Spintly and asked for a call with you on 19, 20 or 21 October at 9:00 CET, which is 12:30 IST on each day (midnight Pacific). / Could you tell me which of those works, or send the windows you prefer? Please reply on this email and I will pass it on straight away. / Regards, Shradhaa
- 18534 (new_email_from_shradhaa): Hi Abhimanyu, / An investor would like a call with you. Michele Barbazza has said he is interested in EosNox and asked for a call with you on 14, 15 or 16 October at 11:00 CET, which is 14:30 IST on each day. / Could you tell me which of those works for you? Please reply on this email and I will pass it on straight away. / Regards, Shradhaa
- 18535 (reply_from_akansha): Hi Devesh, / Understood, and thank you for saying so plainly. We will keep to one deal at a time with you from here on, and I will check with you before the next one goes over. / Regards, Akansha
- 18536 (reply_from_aditya): Hi Siddharth, / Thank you for coming back on Bon Cuisine and for being clear about where it sits against your thesis. We appreciate you looking at it. / Best, Aditya
- 18537 (reply_from_aditya): Hi Arnav, / Understood. From here on we will send deals only to pitch@sucseedindovation.com. For Hoora, our team will send the pitch deck to you on this thread. / Best, Aditya
- 18538 (internal_mail): Hi team, / On the Hoora thread with SucSEED (DEET, Arnav Bhatara), they asked for the pitch deck for the curated deal to be shared on that thread, and for deals to be tagged only to pitch@sucseedindovation.com from now on. / Please send the Hoora pitch deck on the thread (reply to Deet, copy pitch@sucseedindovation.com) and tell Aditya when it has gone. / Thanks
- 18539 (reply_from_aditya): Hi Aakansh, / Thank you for coming back on LearningPad and for being clear that it does not fit your mandate. We appreciate you taking the time to look at it. / Best, Aditya
- 18540 (reply_from_shradhaa): Hi Rahil, / Thanks for getting back to us on MentorCloud and for the clear answer, even though it is a no. We appreciate you taking the time to review it. / Best, Shradhaa
- 18541 (reply_from_shradhaa): Hi Shradha, / That is useful, thank you. We will bring you the ones with a clear niche and their own IP, case by case, and leave out the crowded ones. / Best, Shradhaa
- 18542 (reply_from_shradhaa): Hi Pratik, / Thanks for the reply and for giving the reason. The competitive segment point is clear to us, and we appreciate you looking at it. / Best, Shradhaa
- 18543 (reply_from_shradhaa): Hi Amol, / Understood. We will only send you US companies from here on. EosNox is India-based, so we will take it off your list for now. / Best, Shradhaa
- 18544 (reply_from_chaman): Hi Rahil, / Thanks for getting back on RoadAthena and for being clear about the mandate. The hardware-led model is a fair reason. We appreciate you looking at it. / Best, Chaman
- 18545 (reply_from_aditya): Hi Biswadeep, / Thanks for coming back on Bon Cuisine so quickly, and for being clear that it sits outside your sectors of focus. We appreciate you looking at it. / Best, Aditya
- 18546 (reply_from_shradhaa): Hi Kruti, / Thanks Sherilyn for sending Rohin's windows. He is in California, and this week he can do 9:00 AM to 12:30 PM IST, or 8:30 PM to 11:00 PM IST. / Kruti, could you pick one slot from those windows for the follow-up call with the team? Once you choose, we will send the invite. / Regards, Shradhaa
- 18547 (reply_from_shradhaa): Hi Deeksha, / Thank you for looking at Spintly and for telling us where it landed. The reason is clear to us, and we will keep you in mind for the next round, as you asked. / Regards, Shradhaa
- 18548 (reply_from_akansha): Hi Deeksha, / Thank you for the careful look at HYRGPT and for telling us where it landed. We will keep the team's next round in mind for you, as you asked. / Regards, Akansha
- 18549 (reply_from_shradhaa): Hi Michele, / Thank you for coming back to us, and for the dates. I am confirming 19, 20 or 21 October at 9:00 CET with the founder now, and will come back to you shortly. / Regards, Shradhaa
- 18550 (reply_from_shradhaa): Hi Michele, / Thanks for the dates. We are checking 14, 15 or 16 October at 11:00 CET with the founder, and will come back to you shortly. / Regards, Shradhaa
- 18551 (reply_from_aditya): Hi Vikash, / Thanks for your note. Harshit has offered to host you at the IvyCap office at WeWork Galaxy on Residency Road, later this week or next week. / Could you send two or three windows, in IST, that suit you? We will confirm the time with IvyCap and come back to you. / Best, Aditya
- 18552 (reply_from_akansha): Hi Pawan, / Thanks for picking this up. Prerna has set out the amounts on this thread: a 2 million total ask for hardware and international expansion, and 3 Cr for a government scheme that wants an equal investment from an investor. / On the structure, let me come back to you on it. / Regards, Akansha
- 18553 (reply_from_aditya): Hi Swarup, / Thanks for telling us where the decks should go. I have noted investment-proposals@baldota.co.in. / Our team will come back to you on this. / Best, Aditya
- 18554 (internal_mail): Hi team, / Swarup Ravichandran at Baldota Family Office has asked that all investment decks go to investment-proposals@baldota.co.in, not to his inbox. Please send the CLIKD deck to that address and let Aditya know when it has gone. / Thanks
