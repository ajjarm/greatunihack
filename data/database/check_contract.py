import json
from pathlib import Path
p=Path(__file__).parent
d=json.loads((p/'contract-data.json').read_text())
types={'persona':'Persona','purchases':'Purchase[]','assessments':'Assessment[]','scenarios':'Scenario[]','home':'Home','insights':'Insights','report':'Report','timeline':'TimelineResponse','waiting':'WaitingItem[]'}
s='import type {Persona, Purchase, Assessment, Scenario, Home, Insights, Report, TimelineResponse, WaitingItem} from '+json.dumps(str(p.resolve().parents[1]/'apps/web/src/lib/types'))+';\n'
for key,t in types.items():s+=f'const {key} = '+json.dumps(d[key],ensure_ascii=False)+f' satisfies {t};\n'
import tempfile, subprocess
with tempfile.TemporaryDirectory() as tmp:
 f=Path(tmp)/'contract.ts';f.write_text(s)
 subprocess.run([str(p.resolve().parents[1]/'apps/web/node_modules/.bin/tsc'),'--noEmit','--skipLibCheck','--target','ES2020',str(f)],check=True)
print('PASS: all nine contract surfaces typecheck against shared types.ts')
