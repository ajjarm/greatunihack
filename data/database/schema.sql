-- Supabase/PostgreSQL 15+. New tables only; apply once.
-- Money: integer GBP pence. Event timestamps: timestamptz.
create table public.spending_profiles (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid unique references auth.users(id) on delete set null,
 name text not null, currency text not null default 'GBP' check (currency = 'GBP'),
 timezone text not null default 'Europe/London',
 demo_now timestamptz not null, hourly_rate_pence integer not null check(hourly_rate_pence > 0),
 opening_balance_pence bigint not null, history_start date not null,
 goal_name text not null, goal_target_pence bigint not null check(goal_target_pence > 0),
 goal_saved_pence bigint not null check(goal_saved_pence >= 0),
 is_synthetic boolean not null default false
);
create table public.spending_categories (key text primary key, label text not null);
create table public.spending_income_sources (
 profile_id uuid not null references public.spending_profiles(id) on delete cascade,
 id text not null, name text not null, amount_pence integer not null check(amount_pence > 0),
 schedule jsonb not null check(jsonb_typeof(schedule) = 'object'), next_date date not null,
 primary key(profile_id,id)
);
create table public.spending_bills (
 profile_id uuid not null references public.spending_profiles(id) on delete cascade,
 id text not null, name text not null, amount_pence integer not null check(amount_pence > 0),
 day_of_month smallint not null check(day_of_month between 1 and 31),
 category text not null references public.spending_categories(key), primary key(profile_id,id)
);
create table public.spending_budgets (
 profile_id uuid not null references public.spending_profiles(id) on delete cascade,
 category text not null references public.spending_categories(key),
 weekly_limit_pence integer not null check(weekly_limit_pence >= 0), primary key(profile_id,category)
);
create table public.spending_rules (
 profile_id uuid not null references public.spending_profiles(id) on delete cascade,
 id text not null, text text not null, category text references public.spending_categories(key),
 direction text not null check(direction in ('avoid','always_fine')), until_text text,
 primary key(profile_id,id)
);
create table public.spending_assessments (
 profile_id uuid not null references public.spending_profiles(id) on delete cascade,
 id text not null, created_at timestamptz not null, merchant text not null,
 source text not null check(source in ('watcher','extension','manual','shortcut','demo')),
 total_pence integer not null check(total_pence >= 0),
 verdict text not null check(verdict in ('go_ahead','essential_cover','nudge','strong_nudge')),
 regret_risk smallint not null check(regret_risk between 0 and 100),
 affordability smallint not null check(affordability between 0 and 100),
 headline text not null, reasoning text not null,
 decision text not null check(decision in ('none','wait','buy_anyway','dismiss','negotiated')),
 reflection_days smallint not null check(reflection_days between 1 and 60),
 primary key(profile_id,id)
);
create table public.spending_assessment_items (
 profile_id uuid not null, assessment_id text not null, item_index integer not null check(item_index >= 0),
 name text not null, price_pence integer not null check(price_pence >= 0), qty integer not null check(qty > 0),
 category text not null references public.spending_categories(key),
 necessity smallint not null check(necessity between 0 and 100),
 necessity_tag text not null check(necessity_tag in ('need','useful','want')),
 essential boolean, regret_risk smallint not null check(regret_risk between 0 and 100),
 factors jsonb not null check(jsonb_typeof(factors) = 'array'),
 primary key(profile_id,assessment_id,item_index),
 foreign key(profile_id,assessment_id) references public.spending_assessments(profile_id,id) on delete cascade
);
create table public.spending_purchases (
 profile_id uuid not null references public.spending_profiles(id) on delete cascade,
 id text not null, merchant text not null, item text not null,
 category text not null references public.spending_categories(key),
 amount_pence integer not null check(amount_pence > 0), purchased_at timestamptz not null,
 source text not null check(source in ('feed','watcher','manual')), essential boolean not null,
 cues text[] not null default '{}' check(cues <@ array['scarcity','countdown','social_proof','sale','free_delivery_threshold','bnpl','preticked_addon']::text[]),
 predicted_regret smallint check(predicted_regret between 0 and 100), assessment_id text,
 feedback text check(feedback in ('happy','regretted','unsure')), feedback_reason text,
 feedback_at timestamptz, reflection_due_at timestamptz,
 primary key(profile_id,id),
 foreign key(profile_id,assessment_id) references public.spending_assessments(profile_id,id),
 check ((feedback is null and feedback_at is null and feedback_reason is null) or (feedback is not null and feedback_at is not null and feedback_at >= purchased_at))
);
create table public.spending_transactions (
 profile_id uuid not null references public.spending_profiles(id) on delete cascade,
 id text not null, occurred_at timestamptz not null,
 kind text not null check(kind in ('income','purchase','bill')),
 description text not null, amount_pence integer not null check(amount_pence <> 0),
 purchase_id text, income_source_id text, bill_id text,
 primary key(profile_id,id), unique(profile_id,purchase_id),
 foreign key(profile_id,purchase_id) references public.spending_purchases(profile_id,id),
 foreign key(profile_id,income_source_id) references public.spending_income_sources(profile_id,id),
 foreign key(profile_id,bill_id) references public.spending_bills(profile_id,id),
 check ((kind='income' and amount_pence>0 and income_source_id is not null and purchase_id is null and bill_id is null)
 or (kind='purchase' and amount_pence<0 and purchase_id is not null and income_source_id is null and bill_id is null)
 or (kind='bill' and amount_pence<0 and bill_id is not null and purchase_id is null and income_source_id is null))
);
create table public.spending_waiting_items (
 profile_id uuid not null, id text not null, assessment_id text not null,
 item_name text not null, price_pence integer not null check(price_pence > 0), merchant text not null,
 saved_at timestamptz not null, reconsider_at timestamptz not null,
 status text not null check(status in ('waiting','bought','removed','extended')),
 primary key(profile_id,id), foreign key(profile_id,assessment_id) references public.spending_assessments(profile_id,id),
 check(reconsider_at > saved_at)
);
create table public.spending_calibration (
 profile_id uuid not null references public.spending_profiles(id) on delete cascade,
 category text not null references public.spending_categories(key),
 multiplier numeric(3,2) not null check(multiplier between 0.5 and 1.5),
 tuned_pct smallint not null check(tuned_pct between 0 and 100), primary key(profile_id,category)
);
create index spending_purchases_recent on public.spending_purchases(profile_id,purchased_at desc);
create index spending_purchases_category on public.spending_purchases(profile_id,category,purchased_at desc);
create index spending_purchases_assessment on public.spending_purchases(profile_id,assessment_id);
create index spending_reflections_due on public.spending_purchases(profile_id,reflection_due_at) where feedback is null;
create index spending_assessments_recent on public.spending_assessments(profile_id,created_at desc);
create index spending_transactions_recent on public.spending_transactions(profile_id,occurred_at desc);
create index spending_transactions_income on public.spending_transactions(profile_id,income_source_id);
create index spending_transactions_bill on public.spending_transactions(profile_id,bill_id);
create index spending_waiting_assessment on public.spending_waiting_items(profile_id,assessment_id);
create index spending_bills_category on public.spending_bills(category);
create index spending_budgets_category on public.spending_budgets(category);
create index spending_rules_category on public.spending_rules(category);
create index spending_items_category on public.spending_assessment_items(category);
create index spending_purchases_category_fk on public.spending_purchases(category);
create index spending_calibration_category on public.spending_calibration(category);

alter table public.spending_profiles enable row level security;
create policy profile_owner on public.spending_profiles for all to authenticated
 using(auth_user_id=(select auth.uid())) with check(auth_user_id=(select auth.uid()));
alter table public.spending_categories enable row level security;
create policy categories_read on public.spending_categories for select to authenticated using(true);
grant select on public.spending_categories to authenticated;
do $$
declare t text;
begin
 foreach t in array array['spending_income_sources','spending_bills','spending_budgets','spending_rules','spending_assessments','spending_assessment_items','spending_purchases','spending_transactions','spending_waiting_items','spending_calibration'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_access on public.%I for all to authenticated using (profile_id in (select id from public.spending_profiles where auth_user_id=(select auth.uid()))) with check (profile_id in (select id from public.spending_profiles where auth_user_id=(select auth.uid())))',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
grant select,insert,update,delete on public.spending_profiles to authenticated;
-- Demo rows are unclaimed (auth_user_id null), visible only to administrative/server access.
-- No public anonymous access to personal financial data.
revoke all on public.spending_profiles, public.spending_categories, public.spending_income_sources,
 public.spending_bills, public.spending_budgets, public.spending_rules, public.spending_assessments,
 public.spending_assessment_items, public.spending_purchases, public.spending_transactions,
 public.spending_waiting_items, public.spending_calibration from anon;

-- Full contract payloads retain all nested fields without inventing API attributes.
alter table public.spending_profiles add column persona jsonb not null check(jsonb_typeof(persona)='object');
alter table public.spending_assessments add column payload jsonb not null check(jsonb_typeof(payload)='object');
alter table public.spending_assessment_items add column necessity_confidence text not null check(necessity_confidence in ('low','medium','high')),
 add column essential_prompt boolean not null, add column limited_history boolean not null,
 add column duplicate_of jsonb check(duplicate_of is null or jsonb_typeof(duplicate_of)='object');
alter table public.spending_waiting_items add column url text;
alter table public.spending_transactions add column merchant text not null,
 add column category text references public.spending_categories(key);
create index spending_transactions_category on public.spending_transactions(category);
create table public.spending_snapshots (
 profile_id uuid not null references public.spending_profiles(id) on delete cascade,
 kind text not null check(kind in ('home','insights','report','timeline')),
 as_of timestamptz not null, payload jsonb not null check(jsonb_typeof(payload)='object'),
 primary key(profile_id,kind)
);
create table public.spending_scenarios (
 profile_id uuid not null references public.spending_profiles(id) on delete cascade,
 id text not null, payload jsonb not null check(jsonb_typeof(payload)='object'),
 primary key(profile_id,id)
);
alter table public.spending_snapshots enable row level security;
alter table public.spending_scenarios enable row level security;
create policy owner_access on public.spending_snapshots for all to authenticated
 using(profile_id in (select id from public.spending_profiles where auth_user_id=(select auth.uid())))
 with check(profile_id in (select id from public.spending_profiles where auth_user_id=(select auth.uid())));
create policy owner_access on public.spending_scenarios for all to authenticated
 using(profile_id in (select id from public.spending_profiles where auth_user_id=(select auth.uid())))
 with check(profile_id in (select id from public.spending_profiles where auth_user_id=(select auth.uid())));
grant select,insert,update,delete on public.spending_snapshots, public.spending_scenarios to authenticated;
revoke all on public.spending_snapshots, public.spending_scenarios from anon;
