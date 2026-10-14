"""Rebuild the public dataset and descriptive logistic fits from pinned GCAT snapshots.
Run: python3 scripts/prepare_data.py (requires numpy, scipy).
"""
import csv, json, re, math, calendar, hashlib
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import Counter, defaultdict
import numpy as np
from scipy.optimize import curve_fit
ROOT = Path(__file__).resolve().parents[1]
AS_OF = datetime(2026,9,19,tzinfo=timezone.utc) # end of Sep 18 UTC, exclusive

def decimal_year(d):
    start=datetime(d.year,1,1,tzinfo=timezone.utc)
    return d.year+(d-start).total_seconds()/((366 if calendar.isleap(d.year) else 365)*86400)

def read(name):
    text=(ROOT/'raw'/name).read_text()
    header=next(l for l in text.splitlines() if l.startswith('Launch_Tag'))
    cols=[(m.group(),m.start()) for m in re.finditer(r'\S+',header)]
    rows=[]
    for line in text.splitlines():
        if not re.match(r'^\d{4}-',line): continue
        row={key:line[pos:cols[i+1][1] if i+1<len(cols) else None].strip() for i,(key,pos) in enumerate(cols)}
        dstr=row['Launch_Date'].replace('?','').strip(); parts=dstr.split()
        d=datetime.strptime(' '.join(parts[:3]),'%Y %b %d').replace(tzinfo=timezone.utc)
        if len(parts)>3:
            tm=parts[3].replace(':',''); d=d.replace(hour=int(tm[:2]),minute=int(tm[2:4]),second=int(tm[4:6] or 0))
        if d>=AS_OF: continue
        row['dt']=d;rows.append(row)
    return rows

allrows=read('falcon9-gcat.html')
flights=[];last={};excluded=[];pairs=[]
for r in sorted(allrows,key=lambda r:r['dt']):
    if r['LV_Type']!='Falcon 9' or r['Laun']=='OE':
        excluded.append({'id':r['Launch_Tag'],'vehicle':r['LV_Type'],'code':r['Laun']});continue
    m=re.search(r'(B\d{4})(?:\.(\d+))?(\?)?',r['Flight_ID'])
    booster=m[1] if m and not m[3] else None
    count=(int(m[2]) if m[2] else 1) if booster else None
    prev=last.get(booster) if booster else None
    days=(r['dt']-prev['dt']).total_seconds()/86400 if prev else None
    # Only adjacent serial flight numbers; cross-type histories/incomplete identities are not mistaken for turnaround.
    contiguous=prev is not None and count is not None and prev['boosterFlight'] is not None and count==prev['boosterFlight']+1
    days=round(days,4) if contiguous else None
    f={'id':r['Launch_Tag'],'date':r['dt'].isoformat().replace('+00:00','Z'),'catalogDate':r['Launch_Date'],'year':r['dt'].year,'x':decimal_year(r['dt']),'mission':r['Mission'] if r['Mission']!='-' else r['Flight'],'vehicle':r['LV_Type'],'variant':r['Varian'],'booster':booster,'boosterFlight':count,'turnaroundDays':days,'previousDate':prev['date'] if days else None,'pad':r['Launch_S']+' / '+r['Launch_Pad'],'launchCode':r['Laun'],'source':'https://planet4589.org/space/gcat/data/launch/Falcon9.html'}
    flights.append(f)
    if booster: last[booster]={**f,'dt':r['dt']}
    if days: pairs.append(f)
assert len(flights)==len({f['id'] for f in flights})
assert all(p['turnaroundDays']>0 for p in pairs)
# Complete Monday-Sunday UTC weeks only; zero-launch weeks included.
first=datetime(2010,1,4,tzinfo=timezone.utc); last_monday=AS_OF-timedelta(days=AS_OF.weekday(),hours=AS_OF.hour)
weekly=[];d=first
while d+timedelta(days=7)<=last_monday:
    count=sum(d<=datetime.fromisoformat(f['date'].replace('Z','+00:00'))<d+timedelta(days=7) for f in flights)
    weekly.append({'date':d.date().isoformat(),'x':decimal_year(d+timedelta(days=3.5)),'count':count})
    d+=timedelta(days=7)
for i,w in enumerate(weekly):w['smoothed']=sum(x['count'] for x in weekly[max(0,i-12):i+1])/len(weekly[max(0,i-12):i+1])
def logistic(x,L,k,t0):return L/(1+np.exp(-k*(np.array(x)-t0)))
x=[w['x'] for w in weekly];y=[w['count'] for w in weekly]
p,_=curve_fit(logistic,x,y,p0=[3.5,.5,2022],bounds=([.1,.01,2010],[20,3,2040]),maxfev=50000)
def metrics(y,yhat):
    y=np.array(y);yh=np.array(yhat)
    return {'rmse':float(np.sqrt(np.mean((y-yh)**2))),'r2':float(1-np.sum((y-yh)**2)/np.sum((y-np.mean(y))**2))}
fit={'ceiling':float(p[0]),'k':float(p[1]),'midpoint':float(p[2]),**metrics(y,logistic(x,*p)),'points':[{'x':float(x),'y':float(logistic(x,*p))} for x in np.linspace(2010,2027,241)]}
qs=defaultdict(list)
for f in pairs:qs[(f['year'],(int(f['date'][5:7])-1)//3+1)].append(f['turnaroundDays'])
quarterly=[{'year':y,'quarter':q,'x':y+(q-.5)/4,'n':len(v),'median':float(np.median(v)),'p10':float(np.percentile(v,10)),'p90':float(np.percentile(v,90)),'min':min(v)} for (y,q),v in sorted(qs.items())]
qfit=[q for q in quarterly if q['n']>=3 and not(q['year']==2026 and q['quarter']==3)]
upper=pairs[0]['turnaroundDays'] # first demonstrated reuse interval; fixed upper asymptote for identification
# With sparse early observations, a free four-parameter curve has an unidentifiable upper plateau.
def decline(x,floor,k,t0):return floor+(upper-floor)/(1+np.exp(k*(np.array(x)-t0)))
x=[q['x'] for q in qfit];y=[q['median'] for q in qfit]
r,_=curve_fit(decline,x,y,p0=[35,.7,2018],bounds=([0,.01,2015],[200,5,2027]),maxfev=50000)
reusefit={'upper':upper,'floor':float(r[0]),'span':upper-float(r[0]),'k':float(r[1]),'midpoint':float(r[2]),**metrics(y,decline(x,*r)),'points':[{'x':float(x),'y':float(decline(x,*r))} for x in np.linspace(2017,2027,201)]}
stars=[{'date':r['dt'].isoformat().replace('+00:00','Z'),'mission':r['Flight'],'vehicle':r['LV_Type'],'id':r['Launch_Tag']} for r in read('starship-gcat.html') if r['Flight'].startswith('Starship Flight ')]
annual=[{'year':y,'count':sum(f['year']==y for f in flights)} for y in range(2010,2027)]
recent=[f['turnaroundDays'] for f in pairs if f['year']==2026]
output={'asOf':'2026-09-18','cutoff':decimal_year(AS_OF),'catalogUpdated':'2026-09-18 07:30 UTC','source':'https://planet4589.org/space/gcat/data/launch/Falcon9.html','flights':flights,'starship':stars,'annual':annual,'weekly':weekly,'quarterly':quarterly,'cadenceFit':fit,'reuseFit':reusefit,'stats':{'flights':len(flights),'pairs':len(pairs),'knownBooster':sum(bool(f['booster']) for f in flights),'latestFlight':flights[-1]['date'],'recentMedian':float(np.median(recent)),'recentP10':float(np.percentile(recent,10)),'recentPairs':len(recent),'record':min(pairs,key=lambda f:f['turnaroundDays']),'latest13Week':weekly[-1]['smoothed']}}
(ROOT/'dist/data/history.json').write_text(json.dumps(output,separators=(',',':')))
for name,rows in [('falcon9-flights',flights),('falcon9-turnarounds',pairs),('starship-flights',stars),('falcon9-weekly',weekly)]:
    with (ROOT/f'dist/data/{name}.csv').open('w') as file:
        writer=csv.DictWriter(file,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
audit={'asOf':output['asOf'],'includedFalcon9':len(flights),'excluded':excluded,'annual':annual,'pairedIntervals':len(pairs),'missingBoosterIdentity':sum(not f['booster'] for f in flights),'cadenceFit':{k:v for k,v in fit.items() if k!='points'},'reuseFit':{k:v for k,v in reusefit.items() if k!='points'},'sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'raw').glob('*.html')}}
(ROOT/'notes/data-audit.json').write_text(json.dumps(audit,indent=2))
print(json.dumps({k:v for k,v in output.items() if k in ['stats','annual']},indent=2));print('Cadence fit:',p,'Reuse fit:',r)
