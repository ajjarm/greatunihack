"""Export database data into the existing fixture file contracts; no API changes."""
import json
from pathlib import Path
p=Path(__file__).parent
c=json.loads((p/'contract-data.json').read_text());r=json.loads((p/'sample-data.json').read_text())
out=p/'fixtures';out.mkdir(exist_ok=True)
history=[]
for a in c['assessments']:
 h={k:a[k] for k in ['id','createdAt','merchant','totalPence','verdict','regretRisk','headline','decision']}
 purchase=next((p for p in c['purchases'] if p.get('assessmentId')==a['id']),None)
 h['outcome']=purchase['feedback'] if purchase else None;history.append(h)
files={'persona':c['persona'],'purchases':c['purchases'],'assessments-history':history,'scenarios':c['scenarios'],'home':c['home'],'insights':c['insights'],'report':c['report'],'timeline':c['timeline']['points'],'waiting':c['waiting'],'calibration':[{'category':x['category'],'multiplier':x['multiplier'],'tunedPct':x['tuned_pct']} for x in r['spending_calibration']]}
for name,value in files.items():(out/(name+'.json')).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n')
print('Exported compatible fixture files to',out)
