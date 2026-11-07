"""Run the fork's semantic checks on the replacement export.
Two documented adaptations: Amazon scenario name and cash-reserved bill coverage.
The shared checker file is never modified.
"""
import json, tempfile, subprocess, shutil
from pathlib import Path
p=Path(__file__).resolve().parent;repo=p.parents[1]
s=(repo/'apps/web/scripts/check-data.ts').read_text()
s=s.replace('"../src/lib/types"',json.dumps(str(repo/'apps/web/src/lib/types.ts')))
s=s.replace('"scn_5_steam"','"scn_5_deal"')
s=s.replace('a.impact.nextBill.coveredAfter !== a.impact.safeToSpendAfterPence >= best.amountPence','a.impact.nextBill.coveredAfter !== (a.timeline.find((p: any) => p.date === best.date)?.projectedAfterPence >= 0)')
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp);shutil.copytree(p/'fixtures',root/'data');script=root/'check.ts';script.write_text(s)
 subprocess.run([str(repo/'apps/web/node_modules/.bin/tsx'),str(script)],cwd=root,check=True)
c=json.loads((p/'contract-data.json').read_text());m=json.loads((p/'demo-links.json').read_text());r=json.loads((p/'sample-data.json').read_text())
assert len(c['purchases'])==66 and len(m)==66
assert {p['id'] for p in c['purchases']}=={x['purchaseId'] for x in m}
assert all(x['channel']=='online' and x['scenarioIds'] for x in m)
assert all(s['request']['merchant']=='Amazon' for s in c['scenarios'])
assert sum(p['category']=='transport' for p in c['purchases'])==0
assert all(v['response']['impact']==s['response']['impact'] for s in c['scenarios'] for k,v in s.get('variants',{}).items() if k=='reason')
assert r['spending_profiles'][0]['opening_balance_pence']+sum(t['amount_pence'] for t in r['spending_transactions'])==100000
assert c['home']['pendingReflections']>=1
print('PASS: online demo links, Amazon-only scenarios, unchanged justification impact, cash reconciliation and due reflection')
