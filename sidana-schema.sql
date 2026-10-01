-- ============================================================================
-- Sidana Ops Console — Supabase schema
--
-- Run this in the Supabase SQL editor on a fresh project, top to bottom.
-- It creates: the book (startups, investors, matches), the activity tables
-- (shares, meetings, replies, docs, outreach), the AI activity log, and
-- Row Level Security so each person sees only what their role allows.
--
-- Column names follow the existing sheets:
--   Investors.xlsx / Sheet1
--   Investor-Runway-2026-09-11-final.xlsx / Runway + Investors
--   MatchReport20260910.xlsx / Proposed new pairs + Meetings source
--   InvestorCompositionList20260911.xlsx / Composition list
--
-- SECURITY: the browser gets the ANON key only. The service_role key stays in
-- n8n and on the server. RLS below is what actually protects the data — the
-- anon key on its own can read nothing.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------

create type user_role as enum (
  'owner',        -- Abhilasha, Rakesh sir. Everything.
  'ops',          -- Everything, plus the AI log and error detail
  'deals_desk',   -- Hot 10 and bucket C
  'angel_desk',   -- Buckets A and B
  'founder',      -- Their own startup only (not yet used)
  'investor'      -- Deals shared with them only (not yet used)
);

create type bucket as enum ('HOT10','A','B','C','UNASSIGNED');

create type startup_status as enum (
  'live','a1_ready','a2_waiting','term_sheet','closed',
  'silent','blocked','mandate_closed'
);

create type investor_type as enum (
  'angel','angel_network','syndicate','micro_vc','seed_fund',
  'institutional_vc','family_office','other'
);

create type investor_status as enum (
  'active','engaged','pending','paused','passed_all','do_not_contact'
);

create type match_type as enum ('strict','perfect','sector_only','stage_off','below_min_cheque');
create type match_state as enum ('queued','sent','paused','tracker_only','not_queued');
create type doc_class   as enum ('strong','weak','needs_review');
create type reply_kind  as enum ('interested','pass','unclear','out_of_office','bounce');
create type channel     as enum ('email','linkedin','whatsapp','call','event','referral');

create type ai_action as enum (
  'matched','scored','sent','classified','extracted','added','booked','skipped','error'
);


-- ---------------------------------------------------------------------------
-- 2. People who can log in
-- ---------------------------------------------------------------------------

create table app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null,
  role        user_role not null default 'ops',
  startup_id  bigint,               -- set only for role = 'founder'
  investor_id bigint,               -- set only for role = 'investor'
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table app_users is
  'One row per login. Created by an owner after inviting the person in Supabase Auth. No public signup.';


-- ---------------------------------------------------------------------------
-- 3. The book
-- ---------------------------------------------------------------------------

create table startups (
  id                bigserial primary key,
  name              text not null unique,
  sector            text,
  subsector         text,
  stage             text,                    -- "Stage (sheet)"
  bucket            bucket not null default 'UNASSIGNED',
  owner_name        text,                    -- "Owner" — Aditya, Chaman, Shradha, Akansha
  status            startup_status not null default 'live',

  ask_current_cr    numeric(10,2),           -- "Raise (INR Cr)"
  ask_reset_cr      numeric(10,2),           -- agreed reset; null until decided
  reset_written_at  timestamptz,             -- when the reset reached the matcher
  revenue_note      text,                    -- as stated: "INR 8.2 Cr ARR", "flat"
  revenue_inr_l     numeric(12,2),           -- numeric where known, in lakhs
  burn_inr_l        numeric(10,2),
  runway_months     numeric(5,1),

  score             int check (score between 0 and 100),
  scored_at         timestamptz,
  rule_tier         text,                    -- "Rule tier" from the runway sheet
  mandate_signed_on date,
  mandate_closed_on date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on startups (bucket);
create index on startups (owner_name);
create index on startups (status);

create table investors (
  id                bigserial primary key,
  name              text not null unique,    -- "investor"
  contact_person    text,                    -- "contact_person"
  email             text,
  cc_email          text,                    -- "cc"
  linkedin_url      text,
  type              investor_type not null default 'other',
  status            investor_status not null default 'pending',

  -- thesis. All four must be filled before the matcher may use the record.
  sectors           text[],
  stage_pref        text[],
  cheque_min_cr     numeric(10,2),           -- "Min INR Cr"
  cheque_max_cr     numeric(10,2),           -- "Max INR Cr"
  cheque_as_written text,                    -- "Cheque (as written)"
  geography         text,

  do_not_contact    boolean not null default false,
  suppressed        boolean not null default false,
  suppressed_reason text,                    -- passed / unsubscribed / bounced twice
  last_contacted_on date,                    -- "last_contacted_any"
  contacted_by      text,
  thesis_call_on    date,                    -- null = still PENDING in practice
  source            text,                    -- linkedin / scrape / referral / sv_sharks / event
  added_month       date,                    -- first of the month. Cohort tracking.
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on investors (type);
create index on investors (status);
create index on investors (added_month);
create index on investors (thesis_call_on);

-- An investor is usable by the matcher only with all four thesis fields.
create view investors_usable as
  select * from investors
  where not do_not_contact and not suppressed
    and sectors is not null and array_length(sectors,1) > 0
    and stage_pref is not null and array_length(stage_pref,1) > 0
    and cheque_min_cr is not null and cheque_max_cr is not null;


-- ---------------------------------------------------------------------------
-- 4. Matches and activity
-- ---------------------------------------------------------------------------

create table matches (
  id          bigserial primary key,
  startup_id  bigint not null references startups(id)  on delete cascade,
  investor_id bigint not null references investors(id) on delete cascade,
  type        match_type not null,
  state       match_state not null default 'queued',
  score       numeric(6,2),           -- "Score" from Proposed new pairs
  stage_fit   boolean,
  cheque_fit  boolean,
  priority    int,                    -- 1 = strict not yet queued, 2 = sector only
  created_at  timestamptz not null default now(),
  unique (startup_id, investor_id)
);
create index on matches (startup_id);
create index on matches (investor_id);
create index on matches (state);

create table shares (
  id          bigserial primary key,
  startup_id  bigint not null references startups(id)  on delete cascade,
  investor_id bigint not null references investors(id) on delete cascade,
  sent_at     timestamptz not null,
  mailbox     text,                   -- which sending mailbox
  type        match_type,
  opened_at   timestamptz,
  replied_at  timestamptz,
  is_followup boolean not null default false,
  followup_no int,                    -- 1, 2, 3
  created_at  timestamptz not null default now()
);
create index on shares (sent_at);
create index on shares (startup_id);
create index on shares (investor_id);

-- This is the table that settles "476 or 2,500 sends in September".

create table meetings (
  id            bigserial primary key,
  startup_id    bigint not null references startups(id)  on delete cascade,
  investor_id   bigint references investors(id) on delete set null,
  scheduled_at  timestamptz not null,
  held          boolean,
  is_second     boolean not null default false,
  source        channel not null default 'email',
  from_matcher  boolean,              -- true = came from a matcher send, false = manual/warm
  fireflies_id  text,
  meet_link     text,
  notes         text,
  created_at    timestamptz not null default now()
);
create index on meetings (scheduled_at);
create index on meetings (startup_id);
create index on meetings (is_second);

create table replies (
  id                bigserial primary key,
  share_id          bigint references shares(id) on delete set null,
  investor_id       bigint not null references investors(id) on delete cascade,
  startup_id        bigint references startups(id) on delete set null,
  received_at       timestamptz not null,
  kind              reply_kind not null,
  reason            text,                  -- "stage too early", "ask vs revenue"
  -- what the AI pulled out and wrote back to the investor record
  extracted_stage   text[],
  extracted_sectors text[],
  extracted_min_cr  numeric(10,2),
  extracted_max_cr  numeric(10,2),
  raw_snippet       text,
  created_at        timestamptz not null default now()
);
create index on replies (received_at);
create index on replies (investor_id);

create table docs (
  id             bigserial primary key,
  startup_id     bigint not null references startups(id) on delete cascade,
  investor_id    bigint references investors(id) on delete set null,
  doc_type       text not null,          -- cash flow, MIS, cap table, deck
  requested_at   timestamptz,
  received_at    timestamptz,
  classification doc_class,
  classify_note  text,
  chaser_count   int not null default 0,
  last_chased_at timestamptz,
  created_at     timestamptz not null default now()
);
create index on docs (startup_id);
create index on docs (received_at);

create table outreach (
  id           bigserial primary key,
  investor_id  bigint references investors(id) on delete cascade,
  target_name  text,                  -- before they exist as an investor row
  target_email text,
  target_firm  text,
  channel      channel not null,
  sent_at      timestamptz not null,
  mailbox      text,
  accepted_at  timestamptz,           -- LinkedIn connect accepted
  replied_at   timestamptz,
  bounced      boolean not null default false,
  became_investor_id bigint references investors(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on outreach (sent_at);
create index on outreach (channel);


-- ---------------------------------------------------------------------------
-- 5. AI activity log
--
-- This is the table the console reads. Every AI step writes one row, so the
-- question "what did my AI do today" is a database read and costs nothing.
-- ---------------------------------------------------------------------------

create table ai_runs (
  id              bigserial primary key,
  workflow        text not null,       -- ENGINE-DAILY, HOT-SCORE, DOC-CLASSIFY, ...
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  items_processed int not null default 0,
  items_ok        int not null default 0,
  items_skipped   int not null default 0,
  items_error     int not null default 0,
  total_cost_usd  numeric(10,4) not null default 0,
  n8n_execution_id text
);
create index on ai_runs (workflow, started_at desc);

create table ai_log (
  id            bigserial primary key,
  run_id        bigint references ai_runs(id) on delete cascade,
  ran_at        timestamptz not null default now(),
  workflow      text not null,
  action        ai_action not null,

  entity_type   text,                  -- startup / investor / share / doc / reply
  entity_id     bigint,
  entity_name   text,                  -- denormalised so the feed reads without joins

  decision      text,                  -- the output: a score, STRONG/WEAK, matched
  reasoning     text,                  -- the AI's own stated why, 1-3 sentences
  model         text,
  input_tokens  int,
  output_tokens int,
  cost_usd      numeric(10,6),
  ok            boolean not null default true,
  error_msg     text,
  raw_output    jsonb                   -- dropped after 90 days, see section 8
);
create index on ai_log (ran_at desc);
create index on ai_log (workflow, ran_at desc);
create index on ai_log (action);
create index on ai_log (entity_name);
create index on ai_log (ok) where ok = false;

comment on column ai_log.reasoning is
  'Why the AI decided this. The skipped rows are the valuable ones — a startup silently getting nothing every night shows up here and nowhere else.';


-- ---------------------------------------------------------------------------
-- 6. Views the console reads
-- ---------------------------------------------------------------------------

create view v_today as
select
  (select count(*) from shares   where sent_at::date      = current_date) as deals_sent,
  (select count(*) from meetings where created_at::date   = current_date) as meetings_booked,
  (select count(*) from meetings where created_at::date   = current_date and is_second) as second_meetings,
  (select count(*) from replies  where received_at::date  = current_date) as replies_in,
  (select count(*) from replies  where received_at::date  = current_date and kind='interested') as replies_interested,
  (select count(*) from replies  where received_at::date  = current_date and kind='pass')       as replies_pass,
  (select count(*) from docs     where received_at::date  = current_date) as docs_in,
  (select count(*) from investors where created_at::date  = current_date) as investors_added,
  (select count(*) from ai_log   where ran_at::date       = current_date and not ok) as errors,
  (select coalesce(sum(cost_usd),0) from ai_log where ran_at::date = current_date) as cost_usd_today;

create view v_startup_funnel as
select
  s.id, s.name, s.bucket, s.owner_name, s.status, s.score,
  s.ask_current_cr, s.ask_reset_cr,
  count(distinct sh.id)                                        as sent,
  count(distinct sh.id) filter (where sh.opened_at is not null) as opened,
  count(distinct sh.id) filter (where sh.replied_at is not null)as replied,
  count(distinct m.id)                                         as meetings,
  count(distinct m.id) filter (where m.is_second)               as second_meetings,
  max(sh.sent_at)                                              as last_send,
  max(m.scheduled_at)                                          as last_meeting
from startups s
left join shares   sh on sh.startup_id = s.id
left join meetings m  on m.startup_id  = s.id
group by s.id;

-- Cohort tracking: do the investors we add actually produce meetings?
create view v_investor_cohorts as
select
  i.added_month,
  count(distinct i.id)                                          as investors_added,
  count(distinct i.id) filter (where i.thesis_call_on is not null) as activated,
  count(distinct sh.id)                                         as deals_sent,
  count(distinct m.id)                                          as meetings_given,
  round(count(distinct m.id)::numeric / nullif(count(distinct i.id),0), 2) as meetings_per_investor
from investors i
left join shares   sh on sh.investor_id = i.id
left join meetings m  on m.investor_id  = i.id
group by i.added_month
order by i.added_month desc;

-- Startups getting nothing. The guarantee lives or dies here.
create view v_silent_startups as
select s.id, s.name, s.bucket, s.owner_name, s.ask_current_cr, s.ask_reset_cr,
       max(sh.sent_at) as last_send,
       count(distinct m.id) as meetings_all_time,
       current_date - max(sh.sent_at)::date as days_since_send
from startups s
left join shares   sh on sh.startup_id = s.id
left join meetings m  on m.startup_id  = s.id
where s.status not in ('closed','mandate_closed')
group by s.id
having count(distinct m.id) = 0
    or max(sh.sent_at) is null
    or max(sh.sent_at) < now() - interval '21 days'
order by days_since_send desc nulls first;


-- ---------------------------------------------------------------------------
-- 7. Row Level Security
--
-- Enabled on every table. The anon key can read nothing. Role is looked up
-- through a security-definer function so the policies don't recurse.
-- ---------------------------------------------------------------------------

create or replace function current_app_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from app_users where id = auth.uid() and active
$$;

create or replace function current_startup_id() returns bigint
  language sql stable security definer set search_path = public as $$
  select startup_id from app_users where id = auth.uid() and active
$$;

create or replace function current_investor_id() returns bigint
  language sql stable security definer set search_path = public as $$
  select investor_id from app_users where id = auth.uid() and active
$$;

create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select current_app_role() in ('owner','ops','deals_desk','angel_desk')
$$;

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select current_app_role() in ('owner','ops')
$$;

alter table app_users enable row level security;
alter table startups  enable row level security;
alter table investors enable row level security;
alter table matches   enable row level security;
alter table shares    enable row level security;
alter table meetings  enable row level security;
alter table replies   enable row level security;
alter table docs      enable row level security;
alter table outreach  enable row level security;
alter table ai_runs   enable row level security;
alter table ai_log    enable row level security;

-- app_users: you see yourself; owners and ops see everyone and manage accounts.
create policy own_row      on app_users for select using (id = auth.uid());
create policy admin_read   on app_users for select using (is_admin());
create policy admin_write  on app_users for all    using (is_admin()) with check (is_admin());

-- startups: desks see their own buckets; a founder sees only their company.
create policy startups_read on startups for select using (
  is_admin()
  or (current_app_role() = 'deals_desk' and bucket in ('HOT10','C'))
  or (current_app_role() = 'angel_desk' and bucket in ('A','B'))
  or (current_app_role() = 'founder'    and id = current_startup_id())
);
create policy startups_write on startups for all using (is_staff()) with check (is_staff());

-- investors: the angel desk sees the small-cheque book only. Founders never
-- see the investor list; that is the firm's asset.
create policy investors_read on investors for select using (
  is_admin()
  or current_app_role() = 'deals_desk'
  or (current_app_role() = 'angel_desk'
      and type in ('angel','angel_network','syndicate','micro_vc'))
  or (current_app_role() = 'investor' and id = current_investor_id())
);
create policy investors_write on investors for all using (is_staff()) with check (is_staff());

-- Activity tables follow the startup the row belongs to.
create or replace function can_see_startup(sid bigint) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from startups s where s.id = sid)
     and (is_admin()
       or (current_app_role() = 'deals_desk' and (select bucket from startups where id = sid) in ('HOT10','C'))
       or (current_app_role() = 'angel_desk' and (select bucket from startups where id = sid) in ('A','B'))
       or (current_app_role() = 'founder'    and sid = current_startup_id()))
$$;

create policy matches_read  on matches  for select using (can_see_startup(startup_id));
create policy shares_read   on shares   for select using (can_see_startup(startup_id));
create policy meetings_read on meetings for select using (can_see_startup(startup_id));
create policy docs_read     on docs     for select using (can_see_startup(startup_id));
create policy replies_read  on replies  for select using (
  is_admin() or current_app_role() in ('deals_desk','angel_desk')
);
create policy outreach_read on outreach for select using (is_admin());

create policy matches_write  on matches  for all using (is_staff()) with check (is_staff());
create policy shares_write   on shares   for all using (is_staff()) with check (is_staff());
create policy meetings_write on meetings for all using (is_staff()) with check (is_staff());
create policy docs_write     on docs     for all using (is_staff()) with check (is_staff());
create policy replies_write  on replies  for all using (is_staff()) with check (is_staff());
create policy outreach_write on outreach for all using (is_admin())  with check (is_admin());

-- The AI log is for owners and ops. n8n writes with the service key, which
-- bypasses RLS, so no insert policy is needed here.
create policy ai_runs_read on ai_runs for select using (is_admin());
create policy ai_log_read  on ai_log  for select using (is_admin());


-- ---------------------------------------------------------------------------
-- 8. Housekeeping
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at() returns trigger
  language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger t_startups_touch  before update on startups
  for each row execute function touch_updated_at();
create trigger t_investors_touch before update on investors
  for each row execute function touch_updated_at();

-- Raw AI output gets big. Keep the summary rows forever, drop the payload.
-- Schedule daily with pg_cron, or from an n8n workflow.
create or replace function prune_ai_raw_output() returns void
  language sql as $$
  update ai_log set raw_output = null
  where raw_output is not null and ran_at < now() - interval '90 days'
$$;


-- ---------------------------------------------------------------------------
-- 9. First owner accounts
--
-- Do this AFTER inviting both people in Supabase Auth
-- (Authentication → Users → Invite user), which emails them a set-password
-- link. Then run these two inserts with their real user ids.
--
--   insert into app_users (id, email, full_name, role) values
--     ('<uuid from auth.users>', 'abhilasha@sidanaventures.com', 'Abhilasha Saini', 'owner'),
--     ('<uuid from auth.users>', 'rakesh@sidanaventures.com',    'Rakesh Sidana',    'owner');
--
-- Leave public signup DISABLED in Authentication → Providers. Anyone who
-- finds the URL must not be able to register.
-- ---------------------------------------------------------------------------
