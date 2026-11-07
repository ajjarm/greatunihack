-- Run with administrative access in Supabase SQL Editor after schema + seed.
do $$
declare p uuid := 'a11e0000-0000-4000-8000-000000000001'; n integer;
begin
 if (select count(*) from public.spending_profiles where id=p and is_synthetic)<>1 then raise exception 'Missing synthetic profile'; end if;
 if (select count(distinct (purchased_at at time zone 'Europe/London')::date) from public.spending_purchases where profile_id=p)<>90 then raise exception 'Expected 90 days of purchases'; end if;
 if (select opening_balance_pence+(select sum(amount_pence) from public.spending_transactions where profile_id=p) from public.spending_profiles where id=p)<>41200 then raise exception 'Balance does not reconcile'; end if;
 if exists(select 1 from public.spending_purchases x left join public.spending_transactions t on t.profile_id=x.profile_id and t.purchase_id=x.id where x.profile_id=p and (t.id is null or t.amount_pence<>-x.amount_pence)) then raise exception 'Purchase ledger mismatch'; end if;
 if exists(select 1 from public.spending_assessments a where a.profile_id=p and a.total_pence<>(select sum(i.price_pence*i.qty) from public.spending_assessment_items i where i.profile_id=a.profile_id and i.assessment_id=a.id)) then raise exception 'Assessment total mismatch'; end if;
 if exists(select 1 from public.spending_assessment_items i where profile_id=p and regret_risk<>(select sum((f->>'points')::numeric) from jsonb_array_elements(i.factors) f)) then raise exception 'Item factors do not sum to risk'; end if;
 if exists(select 1 from public.spending_purchases where profile_id=p and (purchased_at>'2026-11-08T23:40:00Z' or feedback_at>'2026-11-08T23:40:00Z')) then raise exception 'Future history'; end if;
 if (select count(*) from public.spending_scenarios where profile_id=p)<>5 then raise exception 'Expected five scenarios'; end if;
 if (select count(*) from public.spending_snapshots where profile_id=p)<>4 then raise exception 'Missing contract snapshots'; end if;
 if exists(select 1 from pg_tables where schemaname='public' and tablename like 'spending_%' and not rowsecurity) then raise exception 'RLS missing'; end if;
 if (select count(*) from public.spending_purchases where profile_id=p and cues<>'{}' and feedback='regretted')<5 then raise exception 'Pressure-cue history missing'; end if;
 if (select count(*) from public.spending_purchases where profile_id=p and feedback='regretted' and (extract(hour from purchased_at at time zone 'Europe/London')>=23 or extract(hour from purchased_at at time zone 'Europe/London')<2))<4 then raise exception 'Late-night pattern missing'; end if;
 raise notice 'PASS: 12 database consistency and security checks';
end $$;
select category, count(*) filter(where feedback in ('happy','regretted')) reviewed,
 count(*) filter(where feedback='regretted') regretted
from public.spending_purchases group by category order by category;
