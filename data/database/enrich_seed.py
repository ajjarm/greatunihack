# Executed by generate_seed.py with its deterministic context.
import copy, calendar
from collections import Counter
from statistics import mean

def feedback(p,value):
 p['feedback']=value
 p['feedback_at']=(datetime.fromisoformat(p['purchased_at'])+timedelta(days=3)).isoformat() if value else None
 p['feedback_reason']={'happy':'This fits my plans.','regretted':'I already had something that would do the job.','unsure':'I need more time to decide.'}.get(value)

# Curated evidence supplements ordinary day-to-day spending.
def curated(id,category,item,day,hour=23,merchant='Amazon',cue=False):
 owned('purchases',id=id,merchant=merchant,item=item,category=category,amount_pence=2199 if category=='accessories' else 2999,purchased_at=stamp(day,hour),source='feed',essential=False,cues=['sale'] if cue else [],predicted_regret=None,assessment_id=None,feedback=None,feedback_at=None,feedback_reason=None,reflection_due_at=None)
 owned('transactions',id='txn-'+id,occurred_at=stamp(day,hour),kind='purchase',description=item,amount_pence=-rows['spending_purchases'][-1]['amount_pence'],purchase_id=id,income_source_id=None,bill_id=None)
 return rows['spending_purchases'][-1]
for i in range(6):curated(f'curated-clothes-{i}','clothes','Overshirt' if i%2 else 'Trainers',date(2026,9,4)+timedelta(days=i*7),cue=True)
for i in range(4):curated(f'curated-case-{i}','accessories','Phone case',date(2026,9,20)+timedelta(days=i),cue=True)
for i in range(3):curated(f'curated-book-{i}','books','Evening reading',date(2026,9,10)+timedelta(days=i),13,'Waterstones')
for i in range(10):curated(f'curated-meal-{i}','eating_out','Evening takeaway',date(2026,9,7)+timedelta(days=i),20,'Deliveroo')
for i in range(2):curated(f'curated-earbuds-{i}','tech','Wireless earbuds',date(2026,9,5)+timedelta(days=i),13)
p=curated('curated-headphones','tech','Over-ear headphones',date(2026,9,15),13);feedback(p,'happy')
# Exact reviewed-category rates from the data guide, with unreviewed ordinary purchases retained.
for category,n,r in [('clothes',5,3),('accessories',4,3),('books',3,0),('eating_out',10,4)]:
 candidates=[p for p in rows['spending_purchases'] if p['category']==category]
 for p in candidates:feedback(p,None)
 chosen=sorted(candidates,key=lambda p:(not p['id'].startswith('curated'),p['purchased_at']))[:n]
 for i,p in enumerate(chosen):feedback(p,'regretted' if i<r else 'happy')
# One further reviewed late-night purchase ensures 4+ late-night regrets.
p=next(p for p in rows['spending_purchases'] if p['id']=='curated-clothes-5');feedback(p,'regretted')
# Keep the exact five reviews: drop one happy review and review this late-night row instead.
p=next(p for p in rows['spending_purchases'] if p['id']=='curated-clothes-2');feedback(p,'happy')
p=next(p for p in rows['spending_purchases'] if p['id']=='curated-clothes-4');feedback(p,None)
# Reconcile every transaction exactly. Opening balance is explicit, not invented income.
for t in rows['spending_transactions']:
 p=next((p for p in rows['spending_purchases'] if p['id']==t['purchase_id']),None)
 t['merchant']=p['merchant'] if p else 'Employer' if t['kind']=='income' else next(b[1] for b in bills if b[0]==t['bill_id'])
 t['category']=p['category'] if p else None if t['kind']=='income' else next(b[4] for b in bills if b[0]==t['bill_id'])
closing=41200
rows['spending_profiles'][0]['opening_balance_pence']=closing-sum(t['amount_pence'] for t in rows['spending_transactions'])
assert rows['spending_profiles'][0]['opening_balance_pence']>=0
persona={'name':'Alex Morgan','demoDate':str(end),'demoNow':now,'hourlyRatePence':1700,'balancePence':closing,
'incomes':[{'id':'salary','name':'Monthly salary','amountPence':165000,'schedule':{'type':'monthly','dayOfMonth':28},'nextDate':'2026-11-28'}],
'outgoings':[{'id':i,'name':n,'amountPence':a,'dayOfMonth':d,'category':c} for i,n,a,d,c in bills],
'limits':[{'category':r['category'],'weeklyLimitPence':r['weekly_limit_pence']} for r in rows['spending_budgets']],
'rules':[{'id':r['id'],'text':r['text'],'category':r['category'],'direction':r['direction']} for r in rows['spending_rules']],
'goal':{'name':'A quieter weekend away','targetPence':80000,'savedPence':23500}}
rows['spending_profiles'][0]['persona']=persona
for c in rows['spending_calibration']:
 reviewed=sorted([p for p in rows['spending_purchases'] if p['category']==c['category'] and p['feedback'] in ('happy','regretted')],key=lambda p:p['feedback_at'])
 mult=1.0
 for p in reviewed:mult=max(.5,min(1.5,round(mult+(.1 if p['feedback']=='regretted' else -.1),2)))
 predictions=[p for p in reviewed if p['predicted_regret'] is not None][-20:]
 c['multiplier']=mult;c['tuned_pct']=round(100*sum((p['predicted_regret']>=40)==(p['feedback']=='regretted') for p in predictions)/len(predictions)) if predictions else 0

def projection(day,balance,total=0):
 points=[]
 for i in range(60):
  d=day+timedelta(days=i);events=[]
  if i>0:
   if d.day==28:balance+=165000;events.append({'type':'income','name':'Monthly salary','amountPence':165000})
   for id,n,a,bd,c in bills:
    if d.day==bd:balance-=a;events.append({'type':'bill','name':n,'amountPence':-a})
  points.append({'date':str(d),'projectedPence':balance,'projectedAfterPence':balance-total,'events':events})
 return points

def next_events(day):
 income_day=date(day.year,day.month,28)
 if income_day<=day:income_day=(income_day.replace(day=1)+timedelta(days=32)).replace(day=28)
 candidates=[]
 for id,n,a,bd,c in bills:
  d=day.replace(day=bd)
  if d<=day:d=(day.replace(day=1)+timedelta(days=32)).replace(day=bd)
  candidates.append((d,n,a))
 d,n,a=min(candidates)
 return {'name':'Monthly salary','date':str(income_day),'amountPence':165000},{'name':n,'date':str(d),'amountPence':a}

def financials(day,balance,total,category):
 timeline=projection(day,balance,total);inc,bill=next_events(day)
 safe=min(p['projectedPence'] for p in timeline if p['date']<inc['date'])
 impact={'safeToSpendBeforePence':safe,'safeToSpendAfterPence':safe-total,'daysToNextIncome':(date.fromisoformat(inc['date'])-day).days,'nextIncome':inc,'nextBill':dict(bill,coveredAfter=next(p['projectedAfterPence'] for p in timeline if p['date']==bill['date'])>=0),'workingHours':round(total/1700,1),'goalSharePct':round(total/80000*100,1),'overdraftUntil':next((p['date'] for p in timeline if p['projectedAfterPence']>=0),None) if safe-total<0 else None}
 limit=next((b for b in persona['limits'] if b['category']==category),None)
 if limit:
  spent=sum(p['amount_pence'] for p in rows['spending_purchases'] if p['category']==category and day-timedelta(days=6)<=datetime.fromisoformat(p['purchased_at']).date()<=day)
  remaining=limit['weeklyLimitPence']-spent-total
  impact['limit']={**limit,'spentThisWeekPence':spent,'remainingAfterPence':remaining,'overByPence':max(0,-remaining)}
 return impact,timeline

def calibration(c):
 r=next(r for r in rows['spending_calibration'] if r['category']==c)
 return {'category':c,'multiplier':r['multiplier'],'tunedPct':r['tuned_pct']}

def camel(row):
 def key(k):
  a=k.split('_');return a[0]+''.join(v.title() for v in a[1:])
 return {key(k):v for k,v in row.items() if k!='profile_id' and (v is not None or k=='feedback')}
# Complete historical Assessment payloads; all nested fields match types.ts.
for a in rows['spending_assessments']:
 item=next(i for i in rows['spending_assessment_items'] if i['assessment_id']==a['id'])
 item.update(necessity_confidence='high',essential_prompt=item['essential'],limited_history=False,duplicate_of=None)
 ai=camel(item);ai.pop('assessmentId');ai['index']=ai.pop('itemIndex')
 day=datetime.fromisoformat(a['created_at']).date()
 bal=rows['spending_profiles'][0]['opening_balance_pence']+sum(t['amount_pence'] for t in rows['spending_transactions'] if t['occurred_at']<a['created_at'])
 impact,timeline=financials(day,bal,a['total_pence'],item['category'])
 payload=camel(a)
 payload.update(items=[ai],spokenLine=a['headline'],impact=impact,topFactors=[{'key':'want_level','text':'Check whether this fits your plans.'}],cues=[],negotiation=[],timeline=timeline,calibration=calibration(item['category']))
 a['payload']=payload
for w in rows['spending_waiting_items']:w['url']='https://www.amazon.co.uk/'
# Retain the five documented scenario IDs and full variants; adapt personal copy and money.
scenarios=json.loads(P.parent.joinpath('scenarios.json').read_text())
for s in scenarios:
 for a in [s['response']]+[v['response'] for v in s.get('variants',{}).values()]:
  a['createdAt']=now
  a['impact'],a['timeline']=financials(end,closing,a['totalPence'],a['items'][0]['category'])
  a['calibration']=calibration(a['items'][0]['category'])
  a['topFactors']=[{'key':'money_strain','text':f"£{a['impact']['safeToSpendAfterPence']/100:.0f} safe to spend after this until your next salary."}]
  for item in a['items']:
   for f in item['factors']:
    if f['key']=='money_strain':f['text']=a['topFactors'][0]['text']
    if f['key']=='history':f['text']='Your reviewed purchase history informs this demo estimate.'
  a['reasoning']='Demo assessment. The cash figures use your salary date, bills and current balance. The regret estimate is illustrative.'
  a['headline']=a['headline'].replace('£406 safe after this.',f"£{(a['impact']['safeToSpendAfterPence']/100):.0f} safe after this.")
  for item in a['items']:
   for f in item['factors']:
    if 'exams' in f['text'].lower():f['text']='Your rule asks for a pause on optional purchases.'
   if item.get('duplicateOf'):
    old=next(p for p in rows['spending_purchases'] if p['id']=='curated-case-0');item['duplicateOf']={'purchaseId':old['id'],'item':old['item'],'purchasedAt':old['purchased_at']}
  for option in a['negotiation']:
   option['resultSafeToSpendAfterPence']=a['impact']['safeToSpendAfterPence']+(a['items'][option['itemIndex']]['pricePence']*a['items'][option['itemIndex']]['qty'])
 s['request']['capturedAt']=now
 # Course-reader scenario becomes a personal reading purchase, same books category and shape.
 def rewrite(value):
  if isinstance(value,str):return value.replace('course books','books').replace('Course books','Books').replace('course reader','paperback').replace('Course reader','Paperback').replace('exams are over','next month').replace('next shift','next salary').replace('Friday\'s shift','next salary')
  if isinstance(value,list):return [rewrite(v) for v in value]
  if isinstance(value,dict):return {k:rewrite(v) for k,v in value.items()}
  return value
 s=rewrite(s)
 owned('scenarios',id=s['id'],payload=s)
# Supporting contract snapshots are generated from the same person and purchases.
purchases=rows['spending_purchases'];assessments=rows['spending_assessments']
impact,timeline=financials(end,closing,0,'other');inc=impact['nextIncome'];bill=impact['nextBill'].copy();bill.pop('coveredAfter')
summaries=[{k:a['payload'][k] for k in ['id','createdAt','merchant','totalPence','verdict','regretRisk','headline','decision']} for a in sorted(assessments,key=lambda a:a['created_at'],reverse=True)]
history=[{'weekStart':str(end-timedelta(days=end.weekday()+7*i)),'value':v} for i,v in reversed(list(enumerate([72,69,70,65,67,61,60,58]))) ]
score={'value':72,'band':'amber','trend':'up','explanation':'An illustrative demo score. You paused before some optional purchases. Review your later feedback to see what helped.','history':history}
pending=sum(p['feedback'] is None and p['reflection_due_at'] is not None and p['reflection_due_at']<=now for p in purchases)
home={'demoNow':now,'spendScore':score,'balancePence':closing,'safeToSpendPence':impact['safeToSpendBeforePence'],'daysToNextIncome':impact['daysToNextIncome'],'nextIncome':inc,'nextBill':bill,'insight':'Your feedback can help you spot which purchases still feel worthwhile.','recentAssessments':summaries[:8],'pendingReflections':pending}
rates=[]
for c in categories:
 reviewed=[p for p in purchases if p['category']==c and p['feedback'] in ('happy','regretted')];regretted=sum(p['feedback']=='regretted' for p in reviewed)
 rates.append({'category':c,'reviewed':len(reviewed),'regretted':regretted,'ratePct':round(100*regretted/len(reviewed)) if reviewed else 0})
def rate(ps):
 ps=[p for p in ps if p['feedback'] in ('happy','regretted')]
 return round(100*sum(p['feedback']=='regretted' for p in ps)/len(ps)) if ps else 0
with_cue=rate([p for p in purchases if p['cues']]);without=rate([p for p in purchases if not p['cues']])
late=[p for p in purchases if datetime.fromisoformat(p['purchased_at']).hour>=23 or datetime.fromisoformat(p['purchased_at']).hour<2]
friday=[p for p in purchases if datetime.fromisoformat(p['purchased_at']).weekday()==4 and datetime.fromisoformat(p['purchased_at']).hour>=22]
waits=rows['spending_waiting_items'];avoided=sum(w['price_pence'] for w in waits if w['status']=='removed')
counts=Counter(p['item'] for p in purchases)
duplicates=[{'item':i,'count':n,'purchaseIds':[p['id'] for p in purchases if p['item']==i]} for i,n in counts.items() if n>1 and i in ('Phone case','Wireless earbuds')]
sentences=[{'key':r['category'],'text':f"You regretted {r['regretted']} of {r['reviewed']} reviewed {r['category'].replace('_',' ')} purchases.",'evidence':f"{r['regretted']}/{r['reviewed']} reviewed; unsure excluded"} for r in rates if r['reviewed']][:4]
sentences += [{'key':'pressure','text':f'With sales cues, {with_cue}% of reviewed purchases were regretted; without, {without}%.','evidence':'Calculated from purchases with happy or regretted feedback.'},{'key':'duplicates','text':'You already bought phone cases and earbuds more than once.','evidence':'; '.join(f"{d['item']}: {d['count']}" for d in duplicates)}]
insights={'sentences':sentences,'regretByCategory':rates,'riskyWindows':[{'label':'Late at night','ratePct':rate(late),'evidence':f'{len(late)} purchases between 23:00 and 02:00'},{'label':'Friday after 10pm','ratePct':rate(friday),'evidence':f'{len(friday)} purchases'}], 'pressure':{'withCueRatePct':with_cue,'withoutCueRatePct':without,'sentence':sentences[-2]['text']},'duplicates':duplicates,'avoidedPence':avoided,'avoidedCouldBe':[{'label':'Weekend away','text':f'An estimated £{avoided/100:.0f} could stay available for your goal.'}],'calibration':{'overallPct':round(mean(c['tuned_pct'] for c in rows['spending_calibration'])),'byCategory':[{'category':c['category'],'pct':c['tuned_pct'],'multiplier':c['multiplier'],'deltaPct':c['tuned_pct']} for c in rows['spending_calibration']]},'limits':[dict(b,spentThisWeekPence=sum(p['amount_pence'] for p in purchases if p['category']==b['category'] and p['purchased_at'][:10]>=str(end-timedelta(days=6)))) for b in persona['limits']],'timeline':timeline}
week_start=end-timedelta(days=end.weekday());weekly=[a for a in assessments if a['created_at'][:10]>=str(week_start)]
over=[a for a in weekly if a['decision']=='buy_anyway'];outcomes=[p['feedback'] for p in purchases if p['assessment_id'] in [a['id'] for a in over]]
kept=sum(b['spentThisWeekPence']<=b['weeklyLimitPence'] for b in insights['limits'])
report={'weekStart':str(week_start),'nudgesShown':len(weekly),'heeded':sum(a['decision']=='wait' for a in weekly),'overridden':len(over),'overriddenHappy':outcomes.count('happy'),'overriddenRegretted':outcomes.count('regretted'),'limitsKept':kept,'limitsExceeded':len(persona['limits'])-kept,'avoidedPence':sum(w['price_pence'] for w in waits if w['status']=='removed' and w['saved_at'][:10]>=str(week_start)),'spendScore':72,'sentences':['This report uses your recorded decisions and feedback.','Unanswered reflections are excluded from regret rates.','Avoided spending is an estimate.']}
for kind,payload in [('home',home),('insights',insights),('report',report),('timeline',{'balancePence':closing,'safeToSpendPence':impact['safeToSpendBeforePence'],'nextIncome':inc,'nextBill':bill,'points':timeline})]:owned('snapshots',kind=kind,as_of=now,payload=payload)
# Income dates and report budgets use the seven-day demo window, as specified by the fixture checker.
# Compile-time contract verification artifact (no changes to shared types).
contract={'persona':persona,'purchases':[camel(p) for p in purchases],'assessments':[a['payload'] for a in assessments],'scenarios':[s['payload'] for s in rows['spending_scenarios']],'home':home,'insights':insights,'report':report,'timeline':rows['spending_snapshots'][-1]['payload'],'waiting':[camel(w) for w in waits]}
P.joinpath('contract-data.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n')
