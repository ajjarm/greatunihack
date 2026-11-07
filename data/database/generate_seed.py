"""Deterministic fictional adult demo. Regenerates seed.sql and sample-data.json."""
import json, random
from pathlib import Path
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
P=Path(__file__).parent
rng=random.Random(20261107)
profile='a11e0000-0000-4000-8000-000000000001'
start=date(2026,8,11); end=date(2026,11,8); now='2026-11-08T23:40:00+00:00'
rows={}
def add(table, **row): rows.setdefault('spending_'+table,[]).append(row)
def owned(table, **row): add(table,profile_id=profile,**row)
def stamp(day,hour=12): return datetime.combine(day,datetime.min.time()).replace(hour=hour,tzinfo=ZoneInfo('Europe/London')).isoformat()
categories=['groceries','eating_out','clothes','tech','accessories','books','transport','health','subscriptions','fun','gifts','household','other']
for c in categories:add('categories',key=c,label=c.replace('_',' ').title())
add('profiles',id=profile,auth_user_id=None,name='Alex Morgan',currency='GBP',timezone='Europe/London',demo_now=now,hourly_rate_pence=1700,opening_balance_pence=185000,history_start=str(start),goal_name='A quieter weekend away',goal_target_pence=80000,goal_saved_pence=23500,is_synthetic=True)
owned('income_sources',id='salary',name='Monthly salary',amount_pence=165000,schedule={'type':'monthly','dayOfMonth':28},next_date='2026-11-28')
bills=[('rent','Rent',105000,1,'household'),('phone','Phone plan',2200,14,'subscriptions'),('internet','Broadband',2900,18,'household'),('gym','Gym membership',2800,20,'health'),('music','Music subscription',1199,5,'subscriptions')]
for id,name,amount,day,category in bills:owned('bills',id=id,name=name,amount_pence=amount,day_of_month=day,category=category)
for c,limit in [('groceries',6500),('eating_out',4500),('clothes',5000),('fun',3500),('tech',5000)]:owned('budgets',category=c,weekly_limit_pence=limit)
for id,text,c,d in [('pause','Wait 24 hours before buying non-essential tech','tech','avoid'),('case','Check the drawer before buying another phone case','accessories','avoid'),('health','Health essentials are always fine','health','always_fine')]:owned('rules',id=id,text=text,category=c,direction=d,until_text=None)
for c in categories:owned('calibration',category=c,multiplier=1.0,tuned_pct=0)
catalog={
'groceries':[('Tesco','Weekly groceries',4378),('Aldi','Fresh food top-up',1867)],
'eating_out':[('Deliveroo','Evening takeaway',2149),('Local cafe','Lunch and coffee',1245)],
'clothes':[('ASOS','Overshirt',3850),('Uniqlo','Cotton T-shirt',1490)],
'accessories':[('Amazon','Phone case',2199),('High street shop','Tote bag',1650)],
'books':[('Waterstones','Paperback novel',999)],
'fun':[('Steam','Video game',2999),('Cinema','Cinema ticket',1350)],
'health':[('Boots','Prescription and toiletries',1480)],
'household':[('IKEA','Storage boxes',2250)],
'gifts':[('Local bookshop','Birthday present',1850)],
'other':[('Post Office','Parcel postage',485)],
'subscriptions':[('Creative app','Monthly creative tool',1299)],
'tech':[('Amazon','Wireless earbuds',4599),('Argos','USB-C charger',2499)]}
purchase_n=0; assessment_n=0
for offset in range(90):
 day=start+timedelta(days=offset)
 if day.day==28:owned('transactions',id=f'salary-{day}',occurred_at=stamp(day,8),kind='income',description='Monthly take-home salary',amount_pence=165000,purchase_id=None,income_source_id='salary',bill_id=None)
 for bid,name,amount,bday,c in bills:
  if day.day==bday:owned('transactions',id=f'bill-{bid}-{day}',occurred_at=stamp(day,8),kind='bill',description=name,amount_pence=-amount,purchase_id=None,income_source_id=None,bill_id=bid)
 # Transport every day; additional spending distributed across the same 90 days.
 basket=[('transport','TfGM','Bus and tram travel',rng.choice([200,350,490]),False)]
 if offset%4==0:
  m,i,a=rng.choice(catalog['groceries']);basket.append(('groceries',m,i,a+rng.randint(-150,150),False))
 if offset%3==0:
  c=rng.choice(list(catalog));m,i,a=rng.choice(catalog[c]);basket.append((c,m,i,a+rng.randint(-90,90),offset%2==0))
 if day.day in (28,29):
  c=rng.choice(['clothes','fun','accessories','tech']);m,i,a=rng.choice(catalog[c]);basket.append((c,m,i,a,True))
 for category,merchant,item,amount,assess in basket:
  purchase_n+=1;pid=f'purchase-{purchase_n:04d}';ts=stamp(day,23 if assess and offset%2==0 else 13)
  essential=category in ('groceries','transport','health');risk=rng.randint(4,18) if essential else rng.randint(35,86)
  cues=[rng.choice(['sale','scarcity','countdown'])] if assess else []
  aid=None
  if assess:
   assessment_n+=1;aid=f'assessment-{assessment_n:03d}'
   decision='wait' if assessment_n%5==0 else 'buy_anyway'
   verdict='essential_cover' if essential else ('strong_nudge' if risk>=70 else 'nudge' if risk>=40 else 'go_ahead')
   owned('assessments',id=aid,created_at=ts,merchant=merchant,source='demo',total_pence=amount,verdict=verdict,regret_risk=risk,affordability=80,headline='Worth a pause before deciding.' if not essential else 'This looks like an everyday essential.',reasoning='Synthetic demonstration score, not a clinical assessment. Your choice matters; a short pause may help you check whether this fits your plans.',decision=decision,reflection_days=3)
   owned('assessment_items',assessment_id=aid,item_index=0,name=item,price_pence=amount,qty=1,category=category,necessity=90 if essential else 25,necessity_tag='need' if essential else 'want',essential=essential,regret_risk=risk,factors=[{'key':'want_level','points':min(25,risk),'max':25,'text':'Everyday essential' if essential else 'An optional purchase'},{'key':'history','points':risk-min(25,risk)-min(10,max(0,risk-25))-min(15,max(0,risk-35))-min(10,max(0,risk-50))-min(15,max(0,risk-60)),'max':20,'text':'Illustrative history signal'},{'key':'pressure','points':min(10,max(0,risk-25)),'max':10,'text':'Illustrative pressure signal'},{'key':'duplicate','points':min(15,max(0,risk-35)),'max':15,'text':'Check what you already own'},{'key':'timing','points':min(10,max(0,risk-50)),'max':10,'text':'Time of purchase'},{'key':'money_strain','points':min(15,max(0,risk-60)),'max':15,'text':'Illustrative budget signal'}])
   if decision=='wait':
    owned('waiting_items',id=f'wait-{assessment_n:03d}',assessment_id=aid,item_name=item,price_pence=amount,merchant=merchant,saved_at=ts,reconsider_at=(datetime.fromisoformat(ts)+timedelta(days=1)).isoformat(),status='waiting' if day>=end-timedelta(days=1) else 'removed')
    continue
  reviewed=day<=end-timedelta(days=7) and (essential and purchase_n%5==0 or not essential and purchase_n%2==0)
  feedback=('happy' if essential else rng.choices(['happy','regretted','unsure'],[4,4,2])[0]) if reviewed else None
  ft=(datetime.fromisoformat(ts)+timedelta(days=1 if essential else 3)).isoformat() if reviewed else None
  reason={'happy':'Still useful and fits my plans.','regretted':'I have not used it as much as I expected.','unsure':'I want a little more time to decide.'}.get(feedback)
  owned('purchases',id=pid,merchant=merchant,item=item,category=category,amount_pence=amount,purchased_at=ts,source='feed',essential=essential,cues=cues,predicted_regret=risk if assess else None,assessment_id=aid,feedback=feedback,feedback_reason=reason,feedback_at=ft,reflection_due_at=(datetime.fromisoformat(ts)+timedelta(days=3)).isoformat() if assess else None)
  owned('transactions',id='txn-'+pid,occurred_at=ts,kind='purchase',description=item,amount_pence=-amount,purchase_id=pid,income_source_id=None,bill_id=None)

exec(P.joinpath("enrich_seed.py").read_text())

def sql(v):
 if v is None:return 'NULL'
 if isinstance(v,bool):return str(v).lower()
 if isinstance(v,(int,float)):return str(v)
 if isinstance(v,list) and all(isinstance(x,str) for x in v):return 'ARRAY['+','.join(sql(x) for x in v)+']::text[]'
 if isinstance(v,(dict,list)):return "'"+json.dumps(v,ensure_ascii=False).replace("'","''")+"'::jsonb"
 return "'"+str(v).replace("'","''")+"'"
statements=['-- Synthetic adult persona: Alex. Run after schema.sql. Safe to rerun; existing IDs are preserved.','BEGIN;']
order=['categories','profiles','income_sources','bills','budgets','rules','calibration','assessments','assessment_items','purchases','transactions','waiting_items','scenarios','snapshots']
for table in ['spending_'+t for t in order]:
 records=rows[table]
 columns=list(records[0]); values=[ '('+','.join(sql(r[c]) for c in columns)+')' for r in records]
 statements.append('INSERT INTO public.'+table+' ('+','.join(columns)+') VALUES\n'+',\n'.join(values)+'\nON CONFLICT DO NOTHING;')
statements.append('COMMIT;')
P.joinpath('seed.sql').write_text('\n'.join(statements)+'\n')
P.joinpath('sample-data.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({k:len(v) for k,v in rows.items()},indent=2))
print('Closing balance pence:',rows['spending_profiles'][0]['opening_balance_pence']+sum(t['amount_pence'] for t in rows['spending_transactions']))
