"""Reproducible feasibility calculation; downloaded PVGIS hourly files in tmp/solar.
No tariffs, loads, roof heights or tree shading in this study are measured bills/survey data.
"""
import json,math,pathlib,datetime,statistics
root=pathlib.Path(__file__).resolve().parent.parent
layout=json.loads((root/'tmp/solar/layout.json').read_text())
faces=['main-east','main-west','guest-east','guest-west']
data={name:json.loads((root/f'tmp/solar/{name}.json').read_text()) for name in faces}
hours=data[faces[0]]['outputs']['hourly'];n=len(hours);years=19
stamp=[datetime.datetime.strptime(row['time'],'%Y%m%d:%H%M') for row in hours]
counts={f:sum(p['roof']+'-'+('east' if p['side']==1 else 'west')==f for p in layout['solarPanels'])for f in faces}
powers={f:[r['P']/1000 for r in data[f]['outputs']['hourly']]for f in faces}
assert all([r['time']for r in data[f]['outputs']['hourly']]==[r['time']for r in hours]for f in faces)
# PVGIS 14% system losses, followed by an explicit additional 10% local shade allowance;
# 5% additional snow allowance Dec-Feb. These are scenarios, not measured loss factors.
pv=[sum(powers[f][i]*counts[f]*.45 for f in faces)*.9*(.95 if stamp[i].month in [12,1,2]else 1)for i in range(n)]
# Synthetic existing-electricity profile; all heating remains on gas. CET, no DST.
baseProfile=[.5,.45,.4,.4,.45,.7,1.1,1.5,1.25,.85,.8,.85,.95,.8,.8,.85,1.1,1.5,1.65,1.6,1.4,1.05,.8,.6]
baseWeights=[baseProfile[(dt.hour+1)%24]for dt in stamp]
evWeights=[1 if 19<=(dt.hour+1)%24<=22 else 0 for dt in stamp]
def annualShape(amount,weights):
 factor=amount*years/sum(weights);return [x*factor for x in weights]
scenarios=[]
for name,elecTariff,elecFixed in [('Lower demand',.4,240),('Working case',.35,180),('Higher demand',.3,120)]:
 base=(412*12-elecFixed)/elecTariff
 components={'existingElectricity':base,'cars':2000}
 load=[sum(v)for v in zip(annualShape(base,baseWeights),annualShape(2000,evWeights))]
 scenario={'name':name,'tariffs':{'electricity':elecTariff,'electricityStanding':elecFixed},'existingElectricityKwh':base,'components':components,'annualDemand':sum(load)/years}
 scenarios.append(scenario)
 if name=='Working case':centralLoad=load
annualPV=sum(pv)/years
kwp=layout['solarArray']['kwp'];yieldPer=annualPV/kwp
# Battery capacity expressed as deliverable AC kWh, with 10% reserve excluded.
# 90% AC roundtrip (all loss on charge); 4.6kW per PW3-equivalent, 10W/unit standby.
def simulate(pvScale,units):
 capacity=13.5*units*.9;state=0;imp=exp=0;power=4.6*min(units,4);chargeLoss=0
 # Start empty; no free initial energy. Conservative end-of-period unspent charge is not consumed.
 for gen,demand in zip(pv,centralLoad):
  delta=gen*pvScale-demand-.01*units
  if delta>=0:
   charge=min(delta,power,(capacity-state)/.9);state+=charge*.9;exp+=delta-charge;chargeLoss+=charge*.1
  else:
   take=min(-delta,power,state);state-=take;imp+=-delta-take
 return {'units':units,'nominalKwh':13.5*units,'dispatchKwh':capacity,'annualImport':imp/years,'annualExport':exp/years,'selfSufficiency':1-imp/(sum(centralLoad)+.01*units*n),'annualBatteryLoss':chargeLoss/years,'endingSocKwh':state}
batteryCases=[simulate(1,u)for u in [0,1,2,4,7]]
# Annual balancing is production matching demand, WITHOUT requiring storage or hourly matching.
annualPanels=math.ceil(scenarios[1]['annualDemand']/yieldPer/.45)
monthly=[]
for month in range(1,13):
 ids=[i for i,t in enumerate(stamp)if t.month==month]
 monthly.append({'month':month,'generation':sum(pv[i]for i in ids)/years,'demand':sum(centralLoad[i]for i in ids)/years,'temperature':statistics.mean(hours[i]['T2m']for i in ids)})
# Cyclic maximum drawdown on 2 repetitions of the full chronological 19-year series.
# Storage equation incorporates 90% charging efficiency and 10% reserve, unlimited inverter power.
# Zero self-discharge & standby: an optimistic energy-only LOWER BOUND, not an off-grid design.
def lowerBound(scale):
 increments=[(g*scale-l)*(.9 if g*scale>=l else 1)for g,l in zip(pv,centralLoad)]
 if sum(increments)<=0:return None
 total=peak=draw=0
 for _ in range(2):
  for x in increments:total+=x;peak=max(peak,total);draw=max(draw,peak-total)
 nominal=draw/.9
 return {'scale':scale,'panels':math.ceil(layout['solarArray']['panels']*scale),'kwp':kwp*scale,'moduleArea':layout['solarArray']['area']*scale,'dispatchKwh':draw,'nominalKwh':nominal,'powerwallCapacityEquivalent':math.ceil(nominal/13.5)}
independence=[lowerBound(s)for s in [1,2,3,4]]
annuals=[]
for year in range(2005,2024):
 ids=[i for i,t in enumerate(stamp)if t.year==year];annuals.append({'year':year,'generation':sum(pv[i]for i in ids),'demand':sum(centralLoad[i]for i in ids)})
# Ten winter days with effectively no PV, using average Dec-Feb daily load.
winter=[i for i,t in enumerate(stamp)if t.month in [12,1,2]];winterDay=sum(centralLoad[i]for i in winter)/len(winter)*24
faceResults=[]
for f in faces:
 r=next(r for r in layout['solarRoofs']if r['id']==f.split('-')[0]);mount=data[f]['inputs']['mounting_system']['fixed'];faceResults.append({'id':f,'panels':counts[f],'kwp':counts[f]*.45,'moduleArea':counts[f]*1.134*1.722,'roofPitch':math.degrees(math.atan2(r['ridge']-r['eave'],r['width']/2)),'azimuthNorth':r['eastAzimuth']+(180 if f.endswith('west')else 0),'pvgisInputs':mount,'pvgisYield':sum(powers[f])/years,'grossRoofArea':math.hypot(r['width']/2,r['ridge']-r['eave'])*r['length']})
sensitivity={}
for f in ['east','west']:
 for a in [30,40]:
  file=root/f'tmp/solar/sensitivity-{f}-{a}.json'
  if file.exists():sensitivity[f'{f}-{a}']=json.loads(file.read_text())['outputs']['totals']['fixed']['E_y']
capacityCounts={f:sum(p['roof']+'-'+('east' if p['side']==1 else 'west')==f for p in layout['solarCapacityPanels'])for f in faces}
capacityPV=[sum(powers[f][i]*capacityCounts[f]*.45 for f in faces)*.9*(.95 if stamp[i].month in [12,1,2]else 1)for i in range(n)]
selectedPV=pv
pv=capacityPV
fullRoof={'panels':117,'kwp':52.65,'area':117*1.134*1.722,'annualPV':sum(pv)/years,'batteries':[simulate(1,u)for u in [0,1,2,4,7]],'independenceLowerBound':lowerBound(1)}
pv=selectedPV
# lowerBound above reports size from the selected array: correct metadata for the capacity array.
if fullRoof['independenceLowerBound']:
 fullRoof['independenceLowerBound'].update(panels=117,kwp=52.65,moduleArea=117*1.134*1.722)
result={'fullRoof':fullRoof,'prepared':'2026-09-26','heating':'Gas retained; no new electric heating or cooling loads','location':data['main-east']['inputs']['location'],'period':'2005–2023','hours':n,'array':layout['solarArray'],'faces':faceResults,'annualPV':annualPV,'specificYield':yieldPer,'annualMin':min(x['generation']for x in annuals),'annualMax':max(x['generation']for x in annuals),'annuals':annuals,'monthly':monthly,'scenarios':scenarios,'batteries':batteryCases,'annualBalance':{'panels':annualPanels,'kwp':annualPanels*.45,'area':annualPanels*1.134*1.722,'extraPanels':annualPanels-layout['solarArray']['panels']},'independenceLowerBounds':independence,'winterDailyLoad':winterDay,'tenDarkDaysNominalKwh':winterDay*10/.9,'tenDarkDaysPowerwallEquivalent':math.ceil(winterDay*10/.9/13.5),'pitchSensitivity':sensitivity,'assumptions':{'localShadeLoss':.1,'winterSnowLoss':.05,'pvgisSystemLoss':.14,'batteryRoundTrip':.9,'reserve':.1,'batteryStandbyKwPerUnit':.01,'evCount':2,'evKmEach':5000,'evKwhPer100KmAtSocket':20}}
(root/'public/assets/solar-feasibility.json').write_text(json.dumps(result,indent=2))
print(json.dumps({k:v for k,v in result.items()if k not in ['annuals','faces','assumptions']},indent=2))
