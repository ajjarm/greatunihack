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
owned('income_sources',id='salary',name='Monthly salary',amount_pence=125000,schedule={'type':'monthly','dayOfMonth':13},next_date='2026-11-13')
bills=[('rent','Rent',85000,10,'household'),('phone','Phone plan',2200,14,'subscriptions'),('internet','Broadband',2900,18,'household'),('gym','Gym membership',2800,20,'health'),('music','Music subscription',1199,5,'subscriptions')]
for id,name,amount,day,category in bills:owned('bills',id=id,name=name,amount_pence=amount,day_of_month=day,category=category)
for c,limit in [('groceries',6500),('eating_out',4500),('clothes',6000),('fun',3500),('tech',5000)]:owned('budgets',category=c,weekly_limit_pence=limit)
for id,text,c,d in [('trainers','No more trainers this month','clothes','avoid'),('books','Books for personal reading are always fine','books','always_fine'),('pause','Wait 24 hours before buying non-essential tech','tech','avoid'),('case','Check the drawer before buying another phone case','accessories','avoid'),('health','Health essentials are always fine','health','always_fine')]:owned('rules',id=id,text=text,category=c,direction=d,until_text=None)
for c in categories:owned('calibration',category=c,multiplier=1.0,tuned_pct=0)
# Hand-curated online catalog: category counts sum to 66.
catalog={
'clothes': [('Amazon','Cotton hoodie',4500),('ASOS','Running trainers',7499),('Uniqlo','Linen shirt',2990),('ASOS','Denim jacket',5899),('Uniqlo','Work trousers',3490),('Amazon','Winter gloves',1299),('ASOS','Overshirt',3850),('Uniqlo','Cotton T-shirt',1490),('Amazon','Sports socks',1199),('ASOS','Rain jacket',6499)],
'accessories':[('Amazon','Phone case',1799),('Amazon','Phone case',2199),('Amazon','Smartwatch strap',1399),('Amazon','Laptop sleeve',2499),('ASOS','Canvas tote bag',1650),('Amazon','Cable organiser',899),('Amazon','Card holder',1299),('Amazon','Travel pouch',1499)],
'tech':[('Amazon','Over-ear headphones',5499),('Amazon','Wireless earbuds',3999),('Amazon','Wireless earbuds',4599),('Argos online','USB-C charger',2499),('Amazon','Portable power bank',2999),('Amazon','Webcam for work calls',3499)],
'books':[('Amazon','Paperback novel',600),('Waterstones online','Evening reading',999),('Amazon','Recipe book',1499),('Amazon','Paperback mystery',899),('Waterstones online','Illustrated nonfiction',1899)],
'health':[('Boots online','Prescription delivery',1050),('Amazon','Paracetamol 500mg',349),('Boots online','Toiletries delivery',1249),('Amazon','First-aid refill',899)],
'fun':[('Amazon','Video game',3999),('Steam','PC game download',2499),('Amazon','Board game',2799),('Steam','Game expansion',1499),('Amazon','Puzzle',1299),('Amazon','Controller accessory',1899)],
'household':[('Amazon','Storage boxes',2250),('IKEA online','Desk lamp',2499),('Amazon','Laundry detergent refill',1199),('Amazon','Kitchen containers',1799),('Amazon','Cleaning supplies delivery',1499)],
'groceries':[('Tesco online','Grocery delivery',4378),('Ocado','Grocery top-up delivery',2871),('Tesco online','Weekly grocery delivery',5284),('Tesco online','Pantry delivery',3647),('Ocado','Fresh food delivery',4219),('Tesco online','Grocery delivery',4873)],
'eating_out':[('Deliveroo','Thai takeaway delivery',2149),('Uber Eats','Pizza delivery',1899),('Deliveroo','Weeknight burger delivery',2247),('Uber Eats','Late takeaway delivery',2498),('Deliveroo','Weekend sushi delivery',1995),('Uber Eats','Curry delivery',2347),('Deliveroo','Noodle delivery',1649),('Uber Eats','Dinner delivery',2187),('Deliveroo','Weekend meal delivery',1849),('Uber Eats','Lunch delivery',1347)],
'gifts':[('Amazon','Birthday gift book',1850),('Amazon','Birthday gift mug',1499),('Etsy online','Personalised gift print',2399)],
'subscriptions':[('Adobe online','Creative app monthly subscription',1299),('Readly online','Digital magazine subscription',999)],
'other':[('Amazon','Packing materials for online resale',749)],
}
review_plan={'clothes':(5,3),'accessories':(4,3),'tech':(3,1),'books':(3,0),'health':(1,0),'fun':(3,2),'household':(1,0),'groceries':(1,0),'eating_out':(10,4),'gifts':(1,0),'subscriptions':(0,0),'other':(0,0)}
scenarios_for={'clothes':['scn_1_impulse'],'accessories':['scn_3_duplicate'],'tech':['scn_3_duplicate'],'books':['scn_4_fine'],'health':['scn_2_essential'],'fun':['scn_5_deal'],'household':['scn_2_essential'],'groceries':['scn_2_essential'],'eating_out':['scn_2_essential'],'gifts':['scn_3_duplicate'],'subscriptions':['scn_5_deal'],'other':['scn_4_fine']}
from urllib.parse import quote
metadata=[]
for category,products in catalog.items():
 for j,(merchant,item,amount) in enumerate(products):
  offset=(j*11+categories.index(category)*5)%79
  day=start+timedelta(days=offset)
  # Fixed evidence dates: Friday late-night orders, two cases, September headphones.
  if category=='clothes' and j<5:day=[date(2026,8,14),date(2026,9,4),date(2026,9,18),date(2026,9,26),date(2026,10,5)][j]
  if category=='accessories' and j<4:day=[date(2026,9,1),date(2026,9,27),date(2026,10,2),date(2026,10,9)][j]
  if category=='tech' and j<3:day=[date(2026,9,15),date(2026,9,5),date(2026,10,3)][j]
  if category=='groceries' and j==0:day=start
  if category=='household' and j==4:day=end
  # A small real payday cluster, with unrelated days still left empty.
  if category in ('fun','clothes','gifts') and j==len(products)-1:day=date(2026,10,14)
  late=category in ('clothes','accessories','fun') and j<4
  ts=stamp(day,23 if late else 13)
  pid=f'online-{category}-{j+1:02d}'
  count,regretted=review_plan[category]
  outcome=('regretted' if j<regretted else 'happy') if j<count else None
  if category=='accessories' and j<4:outcome=['happy','regretted','regretted','regretted'][j]
  if category=='tech' and j<3:outcome=['happy','happy','regretted'][j]
  cue=['scarcity' if category=='clothes' else 'countdown' if category=='fun' else 'sale'] if late else []
  essential=category in ('groceries','health','household')
  risk=78 if outcome=='regretted' else 18 if essential else 28
  reflection=(datetime.fromisoformat(ts)+timedelta(days=3)).isoformat()
  owned('purchases',id=pid,merchant=merchant,item=item,category=category,amount_pence=amount,purchased_at=ts,source='feed',essential=essential,cues=cue,predicted_regret=risk,assessment_id=None,feedback=outcome,feedback_reason=('I already had something suitable.' if outcome=='regretted' else 'This was useful and fits my plans.') if outcome else None,feedback_at=(datetime.fromisoformat(ts)+timedelta(days=3)).isoformat() if outcome else None,reflection_due_at=reflection if not outcome and category=='clothes' and j==5 else None)
  owned('transactions',id='txn-'+pid,occurred_at=ts,kind='purchase',description=item,amount_pence=-amount,purchase_id=pid,income_source_id=None,bill_id=None)
  purpose={'clothes':'Late-night clothing history and the trainers pause rule.','accessories':'Duplicate-case history and reviewed accessory regret.','tech':'Useful headphones versus a repeated earbuds purchase.','books':'Happy reading purchases support a go-ahead.','health':'Essential override and sparse category history.','fun':'Countdown and Friday-night spending evidence.','household':'Practical online spending balances discretionary orders.','groceries':'Ordinary online essentials and budget context.','eating_out':'Takeaway budget provides the essential cover-it option.','gifts':'A genuine gift can change regret risk without changing price.','subscriptions':'Online recurring spending; limited purchase history.','other':'An unfamiliar online item demonstrates limited history.'}[category]
  metadata.append({'purchaseId':pid,'channel':'online','scenarioIds':scenarios_for[category],'purpose':purpose,'productReference':{'kind':'amazon_search','url':'https://www.amazon.co.uk/s?k='+quote(item),'note':'Search reference for demonstrating the item; not a historical order, verified listing or price.'}})
P.joinpath('demo-links.json').write_text(json.dumps(metadata,indent=2)+'\n')
# Fixed commitments remain outside shopping purchases.
for offset in range(90):
 day=start+timedelta(days=offset)
 if day.day==13:owned('transactions',id=f'salary-{day}',occurred_at=stamp(day,8),kind='income',description='Monthly take-home salary',amount_pence=125000,purchase_id=None,income_source_id='salary',bill_id=None)
 for bid,name,amount,bday,c in bills:
  if day.day==bday:owned('transactions',id=f'bill-{bid}-{day}',occurred_at=stamp(day,8),kind='bill',description=name,amount_pence=-amount,purchase_id=None,income_source_id=None,bill_id=bid)

# Eighteen past assessed orders, plus two postponed baskets (20 assessments total).
selected=[]
for cat,indices in {'clothes':[0,1,5],'accessories':[0,1,2],'tech':[0,1,2],'fun':[0,1,3],'health':[0,1],'books':[0,1],'groceries':[5],'household':[4]}.items():
 candidates=[p for p in rows['spending_purchases'] if p['category']==cat]
 selected.extend(candidates[i] for i in indices)
for j,purchase in enumerate(selected):
 aid=f'online-assessment-{j+1:02d}';purchase['assessment_id']=aid
 risk=purchase['predicted_regret'];essential=purchase['essential']
 verdict='essential_cover' if essential else 'strong_nudge' if risk>=70 else 'nudge' if risk>=40 else 'go_ahead'
 text='Worth pausing to check what you already own.' if risk>=70 else 'This fits your plans.'
 owned('assessments',id=aid,created_at=purchase['purchased_at'],merchant=purchase['merchant'],source='demo',total_pence=purchase['amount_pence'],verdict=verdict,regret_risk=risk,affordability=80,headline=text,reasoning='Prepared demo assessment; money is calculated from the recorded cash context.',decision='buy_anyway',reflection_days=3)
 factors=[{'key':'want_level','points':min(25,risk),'max':25,'text':'An everyday need.' if essential else 'An optional purchase.'}]
 remaining=risk-min(25,risk)
 for key,maximum in [('history',20),('pressure',10),('timing',10),('money_strain',15),('duplicate',15)]:
  points=min(maximum,remaining);remaining-=points
  if points:factors.append({'key':key,'points':points,'max':maximum,'text':'Prepared demonstration factor.'})
 owned('assessment_items',assessment_id=aid,item_index=0,name=purchase['item'],price_pence=purchase['amount_pence'],qty=1,category=purchase['category'],necessity=90 if essential else 25,necessity_tag='need' if essential else 'want',essential=essential,regret_risk=risk,factors=factors)
for j,(item,category,amount) in enumerate([('Mechanical keyboard','tech',6999),('Running trainers','clothes',8500)]):
 aid=f'online-paused-{j+1}';ts=stamp(end-timedelta(days=1),20+j)
 owned('assessments',id=aid,created_at=ts,merchant='Amazon',source='demo',total_pence=amount,verdict='strong_nudge',regret_risk=75,affordability=60,headline='Try a short pause before deciding.',reasoning='Waiting is an option; continuing is always your choice.',decision='wait',reflection_days=7)
 owned('assessment_items',assessment_id=aid,item_index=0,name=item,price_pence=amount,qty=1,category=category,necessity=20,necessity_tag='want',essential=False,regret_risk=75,factors=[{'key':k,'points':v,'max':v,'text':t} for k,v,t in [('want_level',25,'An optional upgrade.'),('history',20,'Your reviewed purchases offer context.'),('duplicate',15,'Check what you already own.'),('money_strain',15,'Leave room before payday.')]])
 owned('waiting_items',id=f'online-wait-{j+1}',assessment_id=aid,item_name=item,price_pence=amount,merchant='Amazon',saved_at=ts,reconsider_at=(datetime.fromisoformat(now)+timedelta(minutes=10 if j==0 else 1440)).isoformat(),status='waiting')

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
