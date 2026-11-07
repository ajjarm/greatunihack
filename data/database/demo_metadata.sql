-- Apply to the existing schema; internal metadata is excluded from Purchase API objects.
alter table public.spending_purchases add column demo_context jsonb
 check(demo_context is null or jsonb_typeof(demo_context)='object');
