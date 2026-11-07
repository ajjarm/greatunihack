"""Extend the starter Sam fixtures; preserve original IDs and demo contracts.
Run from any directory, then run npm run check:data from apps/web.
"""
import json
from pathlib import Path
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from collections import Counter
P=Path(__file__).resolve().parent
Z=ZoneInfo('Europe/London')
def read(n):return json.loads((P/(n+'.json')).read_text())
def write(n,d):(P/(n+'.json')).write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
def stamp(d,h=13,m=10):return datetime.combine(date.fromisoformat(d),datetime.min.time()).replace(hour=h,minute=m,tzinfo=Z).isoformat()
def dt(s):return datetime.fromisoformat(s)
ps=[p for p in read('purchases') if int(p['id'].split('_')[1])<=24]
original={p['id']:dict(p) for p in ps}
new=[]
def purchase(merchant,item,cat,amount,day,h=13,feedback=None):
 p={'id':f'p_{25+len(new):02d}','merchant':merchant,'item':item,'category':cat,'amountPence':amount,'purchasedAt':stamp(day,h),'source':'feed','essential':cat in ('groceries','transport','health','household'),'cues':[],'feedback':feedback}
 if feedback:
  p['feedbackAt']=(dt(p['purchasedAt'])+timedelta(days=1)).isoformat()
  p['feedbackReason']='A planned meal with friends.' if feedback=='happy' else 'I had food at home and ordered on a weeknight.'
 new.append(p);return p
# Complete exactly ten reviewed takeaways, four regretted; preserve the original five.
for day,merchant,item,amount,outcome in [
 ('2026-10-28','Deliveroo','Wednesday takeaway delivery',2147,'regretted'),
 ('2026-10-21','Uber Eats','Wednesday pizza delivery',1949,'regretted'),
 ('2026-08-29','Just Eat','Saturday meal with flatmates',1849,'happy'),
 ('2026-09-12','Deliveroo','Saturday dinner delivery',2267,'happy'),
 ('2026-09-26','Uber Eats','Saturday takeaway delivery',1697,'happy')]:purchase(merchant,item,'eating_out',amount,day,19,outcome)
# Four orders in each known 48-hour job payday window. Additional orders are unreviewed.
paydays=['2026-08-21','2026-09-04','2026-09-18','2026-10-02','2026-10-16','2026-10-30']
cluster_catalog=[('Tesco','Grocery top-up','groceries',1347),('Trainline','Advance train ticket','transport',1249),('Amazon','Laundry detergent refill','household',987),('Boots','Toiletries order','health',849)]
for payday in paydays:
 a=dt(stamp(payday,0,0));count=sum(a<=dt(p['purchasedAt'])<a+timedelta(days=2) for p in ps+new)
 for i in range(4-count):
  merchant,item,c,amount=cluster_catalog[i]
  p=purchase(merchant,item,c,amount,payday,9+i*3)
# Ordinary essentials across the rest of the 90-day window; leave the last-week limits intact.
extras=[
 ('2026-08-11','Tesco','Pantry top-up','groceries',1647),('2026-08-25','Trainline','Advance ticket home','transport',1849),
 ('2026-08-28','Tesco','Fresh food delivery','groceries',2867),('2026-09-01','Amazon','USB-C cable','tech',899),
 ('2026-09-07','Tesco','Fruit and breakfast groceries','groceries',1943),('2026-09-10','Trainline','Advance train booking','transport',1547),
 ('2026-09-15','Boots','Prescription collection order','health',349),('2026-09-22','Tesco','Weekly grocery top-up','groceries',2583),
 ('2026-09-29','Amazon','Birthday gift mug','gifts',1199),('2026-10-05','Trainline','Weekend advance ticket','transport',1749),
 ('2026-10-08','Tesco','Grocery delivery','groceries',3217),('2026-10-12','Amazon','Kitchen storage tubs','household',1299),
 ('2026-10-19','Trainline','Advance rail fare','transport',1649),('2026-10-22','Tesco','Fresh food order','groceries',2743),
 ('2026-10-25','Amazon','Notebook refill','other',649),('2026-08-12','Tesco','Household grocery top-up','groceries',2137)]
for day,m,item,c,amount in extras:
 if len(ps)+len(new)<60:purchase(m,item,c,amount,day)
assert len(ps)+len(new)==60
ps+=new;ps.sort(key=lambda p:dt(p['purchasedAt']),reverse=True)
write('purchases',ps)
# Preserve all eight original assessment summaries. Add seven in last week's report period.
history=[h for h in read('assessments-history') if int(h['id'].split('_')[1])<=8]
def summary(id,when,merchant,amount,risk,decision,outcome=None,headline=None):
 h={'id':id,'createdAt':when,'merchant':merchant,'totalPence':amount,'verdict':'strong_nudge' if risk>=70 else 'nudge' if risk>=40 else 'go_ahead','regretRisk':risk,'headline':headline or 'Worth a pause before deciding.','decision':decision,'outcome':outcome};history.append(h);return h
for j,(day,amount) in enumerate([('2026-10-26',1200),('2026-10-27',1500),('2026-10-29',2000),('2026-10-31',2500)]):
 summary(f'ah_{9+j:02d}',stamp(day,21),'Amazon',amount,58+j,'wait' if j%2==0 else 'dismiss',headline='You chose to leave this optional order for now.')
# Link actual completed orders to three new summaries; do not invent another purchase.
linked=[next(p for p in ps if p['id']=='p_21'),next(p for p in ps if p['id']=='p_25'),next(p for p in new if p['purchasedAt'].startswith('2026-10-30'))]
for j,p in enumerate(linked):
 id=f'ah_{13+j:02d}';risk=28 if p['feedback']=='happy' else 71 if p['feedback']=='regretted' else 54
 # A low-risk order still has a valid buy-anyway decision; this is a report of all assessments.
 h=summary(id,(dt(p['purchasedAt'])-timedelta(minutes=5)).isoformat(),p['merchant'],p['amountPence'],risk,'buy_anyway',p['feedback'],headline='You chose to continue; later feedback helps tune the next estimate.')
 p['assessmentId']=id;p['predictedRegret']=risk
for j,p in enumerate([next(p for p in ps if p['id']==i) for i in ['p_01','p_08','p_09','p_10','p_12']]):
 id=f'ah_{16+j:02d}';risk=75 if p['feedback']=='regretted' else 12
 summary(id,(dt(p['purchasedAt'])-timedelta(minutes=5)).isoformat(),p['merchant'],p['amountPence'],risk,'buy_anyway',p['feedback'],headline='Your earlier order gives the next decision some context.')
 # Existing purchase IDs and original feedback remain unchanged; just add the assessment link.
 p['assessmentId']=id;p['predictedRegret']=risk
history.sort(key=lambda h:dt(h['createdAt']),reverse=True);write('assessments-history',history);write('purchases',ps)
# Derive all insight denominators and evidence from the expanded purchases.
persona=read('persona');now=dt(persona['demoNow']);insights=read('insights')
reviewed=[p for p in ps if p['feedback'] in ('happy','regretted')]
def regretted(xs):return sum(p['feedback']=='regretted' for p in xs)
def rate(xs):return round(100*regretted(xs)/len(xs)) if xs else 0
def evidence(xs):return f'{regretted(xs)} of {len(xs)} reviewed orders regretted'
catrows=[]
for c in ['accessories','clothes','fun','eating_out','tech','transport','books','health','groceries','household','gifts','subscriptions','other']:
 xs=[p for p in reviewed if p['category']==c];catrows.append({'category':c,'reviewed':len(xs),'regretted':regretted(xs),'ratePct':rate(xs)})
late=[p for p in reviewed if (dt(p['purchasedAt']).astimezone(Z).hour>=23 or dt(p['purchasedAt']).astimezone(Z).hour<2)]
friday=[p for p in reviewed if dt(p['purchasedAt']).astimezone(Z).weekday()==4 and dt(p['purchasedAt']).astimezone(Z).hour>=22]
in_windows=lambda p:any(dt(stamp(d,0,0))<=dt(p['purchasedAt'])<dt(stamp(d,0,0))+timedelta(days=2) for d in paydays)
pay=[p for p in reviewed if in_windows(p)];withcue=[p for p in reviewed if p['cues']];without=[p for p in reviewed if not p['cues']]
insights['regretByCategory']=catrows
insights['pressure']={'withCueRatePct':rate(withcue),'withoutCueRatePct':rate(without),'sentence':f'With sales cues, you regretted {rate(withcue)}% of reviewed orders. Without them, {rate(without)}%.'}
insights['riskyWindows']=[{'label':label,'ratePct':rate(xs),'evidence':evidence(xs)} for label,xs in [('Friday after 10pm',friday),('Late night, 11pm to 2am',late),('48 hours after payday',pay)]]
insights['sentences']=[
 {'key':'category','text':'You regretted 3 of 5 reviewed clothing orders and 3 of 4 accessory orders. Your three reviewed books were all happy purchases.','evidence':'clothes 3/5; accessories 3/4; books 0/3; eating out 4/10'},
 {'key':'late_night','text':f'{evidence(late).capitalize()} between 11pm and 2am. A short pause may help.','evidence':', '.join(p['id'] for p in late)},
 {'key':'friday','text':f'On Fridays after 10pm, {evidence(friday)}.','evidence':', '.join(p['id'] for p in friday)},
 {'key':'payday','text':f'Within 48 hours of payday, you regretted {rate(pay)}% of reviewed orders, compared with {rate(reviewed)}% overall.','evidence':evidence(pay)+'; overall '+evidence(reviewed)},
 {'key':'pressure','text':insights['pressure']['sentence'],'evidence':'With cues: '+evidence(withcue)+'; without cues: '+evidence(without)},
 {'key':'duplicates','text':'You have two phone cases and two pairs of earbuds. The second phone case was a regret.','evidence':'p_02 and p_10: phone cases; p_04 and p_14: earbuds'},
 {'key':'calibration','text':"I'm 81% tuned to you, up from 64% a month ago.",'evidence':'Prepared demo calibration: accessories 81%, clothes 78%, books 90%'}]
heeded=[h for h in history if h['verdict']!='go_ahead' and h['decision'] in ('wait','dismiss') and dt(h['createdAt'])>now-timedelta(days=30)]
avoided=sum(h['totalPence'] for h in heeded);insights['avoidedPence']=avoided
insights['avoidedCouldBe']=[{'label':'Trip fund','text':f'An estimated £{avoided/100:.0f} is {round(100*avoided/(persona["goal"]["targetPence"]-persona["goal"]["savedPence"]))}% of what is left for your summer trip.'},{'label':'Rent buffer','text':f'An estimated £{avoided/100:.0f} could stay available for rent.'},{'label':'Days of spending','text':f'An estimated £{avoided/100:.0f} is about {round(avoided/(sum(p["amountPence"] for p in ps)/90))} days at your recent purchase pace.'}]
insights['timeline']=read('timeline');write('insights',insights)
home=read('home');home['recentAssessments']=history[:8]
home['pendingReflections']=sum(p['feedback'] is None and p.get('reflectionDueAt') is not None and dt(p['reflectionDueAt'])<=now for p in ps)
write('home',home)
# Report period and counts reconcile exactly to the nine stored assessments that week.
report=read('report');a=dt('2026-10-26T00:00:00+00:00');b=a+timedelta(days=7);week=[h for h in history if a<=dt(h['createdAt'])<b]
over=[h for h in week if h['decision']=='buy_anyway'];heededweek=[h for h in week if h['decision'] in ('wait','dismiss')]
report.update(nudgesShown=len(week),heeded=len(heededweek),overridden=len(over),overriddenHappy=sum(h['outcome']=='happy' for h in over),overriddenRegretted=sum(h['outcome']=='regretted' for h in over),avoidedPence=sum(h['totalPence'] for h in heededweek if h['verdict']!='go_ahead'))
report['sentences']=[f'You paused or dismissed {len(heededweek)} of {len(week)} assessments; the estimated avoided spend was £{report["avoidedPence"]/100:.0f}.',f'Of {len(over)} orders you continued with, {report["overriddenHappy"]} later felt worthwhile and {report["overriddenRegretted"]} were regretted. One is unanswered.','You kept three of your four weekly limits. Clothes went over; groceries stayed within the limit.']
# Validate last-week category limits against purchases in the same report interval.
limits=[(l,sum(p['amountPence'] for p in ps if p['category']==l['category'] and a<=dt(p['purchasedAt'])<b)) for l in persona['limits']]
report['limitsKept']=sum(spend<=l['weeklyLimitPence'] for l,spend in limits);report['limitsExceeded']=len(limits)-report['limitsKept']
report['sentences'][2]=f'You kept {report["limitsKept"]} of {len(limits)} weekly category limits.'
write('report',report)
waiting=read('waiting');waiting[0]['reconsiderAt']=(now+timedelta(minutes=10)).isoformat();write('waiting',waiting)
# Keep exact starter source records except added optional assessment links/predictions.
for id,old in original.items():
 current=next(p for p in ps if p['id']==id)
 assert all(current[k]==v for k,v in old.items()),id
assert len(history)==20 and len(reviewed)==25
assert all(sum(dt(stamp(d,0,0))<=dt(p['purchasedAt'])<dt(stamp(d,0,0))+timedelta(days=2) for p in ps)==4 for d in paydays)
assert rate(pay)>rate(reviewed)
assert len(friday)>=4 and len(late)>=6 and regretted(late)>=4
print(f'Extended fixtures: {len(ps)} purchases, {len(reviewed)} reviews, {len(history)} assessments; avoided {avoided}p')
print('Report:',{k:report[k] for k in ['nudgesShown','heeded','overridden','overriddenHappy','overriddenRegretted','avoidedPence','limitsKept','limitsExceeded']})
# Keep the starter scenario ID consumed by the existing checker/API, but align its
# checkout surface with the current Amazon-only interface contract.
scenarios=read('scenarios')
s=next(s for s in scenarios if s['id']=='scn_5_steam')
s['title']='An Amazon lightning deal with Friday-night history'
s['trigger']={'merchant':'Amazon','keywords':['Place your order'],'urlPattern':'amazon.co.uk/gp/buy'}
s['request'].update(merchant='Amazon',url='https://www.amazon.co.uk/gp/buy/',basketHash='amazon|hollow knight: silksong:3999|3999')
s['request']['cues'][0]['text']='Lightning deal ends in 2h 10m'
for response in [s['response']]+[v['response'] for v in s.get('variants',{}).values()]:
 response['merchant']='Amazon';response['url']=s['request']['url']
 response['topFactors']=[{'key':'timing','text':f'Friday after 10pm: {evidence(friday)}.'},{'key':'pressure','text':'The countdown is a sales cue. Waiting until payday is still an option.'},{'key':'money_strain','text':'£40 is above your £30 weekly fun limit.'}]
 for cue in response['cues']:
  if cue['key']=='countdown':cue['text']='Lightning deal ends in 2h 10m';cue['note']='The timer encourages a quick decision. It does not tell you whether this fits your plans.'
 response['reasoning']='Your Friday-night order history and the countdown suggest pausing. The cash and category-limit figures show what this order changes. Waiting until payday is an option.'
 for item in response['items']:
  for factor in item['factors']:
   if factor['key']=='pressure':factor['text']='A countdown asks for a quick decision.'
write('scenarios',scenarios)
# Extra transactions are deliberately not loaded into purchases at startup.
import csv
with (P/'feed-rows.csv').open('w',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=['externalId','date','merchant','description','amountPence','category']);writer.writeheader()
 for i,(item,amount,category) in enumerate([('Nike Air Max 90',8500,'clothes'),('Cotton hoodie',4500,'clothes'),('Noise-cancelling headphones',5400,'tech'),('Phone case gift',3500,'accessories'),('Paracetamol',349,'health'),('Course reader',600,'books')]):
  writer.writerow({'externalId':f'sam-demo-feed-{i+1:02d}','date':persona['demoNow'],'merchant':'Amazon','description':item,'amountPence':amount,'category':category})
