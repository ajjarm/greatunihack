# Finalize exact scenario evidence and all money fields from one adult cash context.
for s in rows['spending_scenarios']:
 record=s
 s=s['payload']
 if s['id']=='scn_5_steam':
  s['id']='scn_5_deal';record['id']=s['id'];s['request']['merchant']='Amazon';s['request']['url']='https://www.amazon.co.uk/gp/buy/';s['request']['scenarioId']=s['id'];s['trigger']={'merchant':'Amazon','keywords':['Place your order'],'urlPattern':'amazon.co.uk/gp/buy'}
  for a in [s['response']]+[v['response'] for v in s.get('variants',{}).values()]:a['merchant']='Amazon';a['url']=s['request']['url']
 if s['id']=='scn_4_fine':
  s['request']['items'][0]['name']='Paperback novel'
  for a in [s['response']]+[v['response'] for v in s.get('variants',{}).values()]:a['items'][0]['name']='Paperback novel'
 s['request']['basketHash']='amazon|'+ '|'.join(i['name'].lower()+':'+str(i['pricePence']) for i in s['request']['items'])+'|'+str(s['request']['totalPence'])
 if s['id']=='scn_3_duplicate':
  a=copy.deepcopy(s['response']);case=a['items'][1];before=case['regretRisk']
  case['regretRisk']=max(0,before-30);case['factors'].append({'key':'reason','points':case['regretRisk']-before,'max':0,'text':'The case is a birthday gift.'})
  a['regretRisk']=round(sum(i['regretRisk']*i['pricePence']*i['qty'] for i in a['items'])/a['totalPence']*a['calibration']['multiplier'])
  a['verdict']='nudge' if a['regretRisk']>=40 else 'go_ahead';a['headline']='That explains the case. The cash impact stays the same.'
  a['reason']={'text':'the case is a gift','accepted':True,'adjustment':-30,'verdictText':a['headline']}
  s.setdefault('variants',{})['reason']={'input':'the case is a gift','response':a}
 for a in [s['response']]+[v['response'] for v in s.get('variants',{}).values()]:
  c=a['items'][0]['category'];a['impact'],a['timeline']=financials(end,closing,a['totalPence'],c)
  if 'limit' in a['impact']:
   l=a['impact']['limit'];basket=sum(i['pricePence']*i['qty'] for i in a['items'] if i['category']==l['category']);l['remainingAfterPence']=l['weeklyLimitPence']-l['spentThisWeekPence']-basket;l['overByPence']=max(0,-l['remainingAfterPence'])
  # Basket risk follows the documented price-weighted, category-calibrated formula.
  a['regretRisk']=min(100,round(sum(i['regretRisk']*i['pricePence']*i['qty'] for i in a['items'])/max(1,a['totalPence'])*a['calibration']['multiplier']))
  if a['verdict']!='essential_cover' and not any(i['essentialPrompt'] for i in a['items']):
   a['verdict']='strong_nudge' if a['regretRisk']>=70 else 'nudge' if a['regretRisk']>=40 or a['affordability']<40 else 'go_ahead'
  for item in a['items']:
   reviewed=[p for p in rows['spending_purchases'] if p['category']==item['category'] and p['feedback'] in ('happy','regretted')]
   item['limitedHistory']=len(reviewed)<3
   for f in item['factors']:
    if f['key']=='history':f['text']=f"You regretted {sum(p['feedback']=='regretted' for p in reviewed)} of {len(reviewed)} reviewed {item['category'].replace('_',' ')} orders."
    if f['key']=='timing':f['text']='This checkout is at 23:40; late-night purchases are worth a pause.'
    if f['key']=='want_level' and item['category']=='books':f['text']='Your rule says books for personal reading are always fine.'
   if item['limitedHistory']:
    # Existing health examples carry zero history points: remove the unsupported factor.
    item['factors']=[f for f in item['factors'] if f['key']!='history']
  a['topFactors']=[{'key':'money_strain','text':f"£{a['impact']['safeToSpendAfterPence']/100:.0f} safe to spend after this until payday on 13 November."}]
  if c=='clothes':a['topFactors'] += [{'key':'history','text':'You regretted 3 of 5 reviewed clothing orders.'},{'key':'want_level','text':'Your rule: no more trainers this month.'}]
  if c=='tech':a['topFactors'] += [{'key':'duplicate','text':'Your order history already contains two phone cases.'}]
  a['reasoning']='The cash projection reserves £850 for rent on 10 November before payday on 13 November. Purchase feedback supplies the history evidence; regret risk is a prepared demonstration estimate.'
  if s['id']=='scn_4_fine':a['headline']=f"Looks fine. £{a['impact']['safeToSpendAfterPence']/100:.0f} safe after this."
  a['spokenLine']=a['headline']
  for o in a['negotiation']:
   if o['action']=='delay':
    o['delayUntil']='2026-11-13';o['text']='Wait until payday on 13 November.';o['resultSafeToSpendAfterPence']=a['impact']['safeToSpendBeforePence']
   else:o['resultSafeToSpendAfterPence']=a['impact']['safeToSpendAfterPence']+a['items'][o['itemIndex']]['pricePence']*a['items'][o['itemIndex']]['qty']
 if s['id']=='scn_5_deal':s['title']='Late-night game under a countdown; Friday-night history'
 if 'negotiated' in s.get('variants',{}):
  v=s['variants']['negotiated'];opt=next(o for o in s['response']['negotiation'] if o['id']==v['optionId'])
  opt['resultRegretRisk']=v['response']['regretRisk'];opt['resultVerdict']=v['response']['verdict'];opt['resultSafeToSpendAfterPence']=v['response']['impact']['safeToSpendAfterPence']
