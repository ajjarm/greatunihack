-- Administrative examples scoped to the single synthetic demo profile.
-- The API must scope requests to the authorized profile; browser UIs call the API.
-- Current confirmed cash balance. Intent purchases must not be deducted twice.
select p.id, p.opening_balance_pence + coalesce(sum(t.amount_pence),0) as balance_pence
from public.spending_profiles p left join public.spending_transactions t on t.profile_id=p.id
where p.id='a11e0000-0000-4000-8000-000000000001' group by p.id;

-- Purchases tab: newest first, exact existing API fields mapped by the adapter.
select * from public.spending_purchases
where profile_id='a11e0000-0000-4000-8000-000000000001' order by purchased_at desc,id;

-- Regret bars: exclude unsure/unanswered; always display the reviewed sample size.
select category, count(*) filter(where feedback in ('happy','regretted')) as reviewed,
 count(*) filter(where feedback='regretted') as regretted,
 round(100.0*count(*) filter(where feedback='regretted') /
 nullif(count(*) filter(where feedback in ('happy','regretted')),0)) as rate_pct
from public.spending_purchases where profile_id='a11e0000-0000-4000-8000-000000000001' group by category;

-- Home reflection banner and Purchases reflection prompt use the demo clock.
select x.* from public.spending_purchases x join public.spending_profiles p on p.id=x.profile_id
where p.id='a11e0000-0000-4000-8000-000000000001' and x.feedback is null
and x.reflection_due_at<=p.demo_now order by x.reflection_due_at;

-- Exact rolling seven-day category limit progress, including categories with no spend.
select b.category,b.weekly_limit_pence,coalesce(sum(x.amount_pence),0) as spent_this_week_pence
from public.spending_budgets b join public.spending_profiles p on p.id=b.profile_id
left join public.spending_purchases x on x.profile_id=b.profile_id and x.category=b.category
 and x.purchased_at>p.demo_now-interval '7 days' and x.purchased_at<=p.demo_now
where p.id='a11e0000-0000-4000-8000-000000000001' group by b.category,b.weekly_limit_pence;

-- Recent assessments feed; payload contains the full show-more detail.
select id,created_at,merchant,total_pence,verdict,regret_risk,headline,decision,payload
from public.spending_assessments where profile_id='a11e0000-0000-4000-8000-000000000001'
order by created_at desc limit 8;
