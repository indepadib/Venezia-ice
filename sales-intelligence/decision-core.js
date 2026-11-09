/* Analytical kernel for Venezia Decision Lab. Units are cents and milli-units. */
(function(root){
'use strict';
const I={STORE:0,DAY:1,HOUR:2,FAMILY:3,CATEGORY:4,PRODUCT:5,CHANNEL:6,REVENUE:7,PAID_REVENUE:8,PAID_QTY:9,QTY:10,LINES:11,ZEROS:12,MISSING_COST:13,RETURNS:14};
const KEYS=['revenueCents','positiveRevenueCents','paidQuantityMilli','allQuantityMilli','lines','zeroPriceLines','missingCostLines','negativePriceLines'];
const HOURS=["Nuit","Nuit","Nuit","Nuit","Nuit","Nuit","Matin","Matin","Matin","Matin","Matin","Matin","Midi","Midi","Midi","Midi","Après-midi","Après-midi","Après-midi","Soir","Soir","Soir","Soir","Soir"];
const partIds=['Nuit','Matin','Midi','Après-midi','Soir'];
const partCode=h=>h<0||h>23?-1:h<6?0:h<12?1:h<16?2:h<19?3:4;
const zero=()=>[0,0,0,0,0,0,0,0];
function incr(m,r){m[0]+=r[7]||0;m[1]+=r[8]||0;m[2]+=r[9]||0;m[3]+=r[10]||0;m[4]+=r[11]||0;m[5]+=r[12]||0;m[6]+=r[13]||0;m[7]+=r[14]||0;return m}
function sum(a,b){for(let i=0;i<8;i++)a[i]+=b[i];return a}
function mapAdd(map,k,r){let v=map.get(k);if(!v){v=zero();map.set(k,v)}return incr(v,r)}
function mapSum(map,k,m){let v=map.get(k);if(!v){v=zero();map.set(k,v)}return sum(v,m)}
function collectDays(map,store,day){let s=map.get(store);if(!s){s=new Set();map.set(store,s)}s.add(day)}
function metrics(m){return {revenue:(m?.[0]||0)/100,paidRevenue:(m?.[1]||0)/100,paidQuantity:(m?.[2]||0)/1000,allQuantity:(m?.[3]||0)/1000,lines:m?.[4]||0,zeroLines:m?.[5]||0,missingCost:m?.[6]||0,returnLines:m?.[7]||0}}
function prepare(cube){
 if(!cube||cube.version!==3||!Array.isArray(cube.rows)||!cube.dims||cube.audit?.totalRevenueCents!==2330609910)throw Error('Cube analytique incorrect ou incomplet');
 const airport=cube.dims.stores.indexOf('Aéroport M5');if(airport<0)throw Error('Périmètre Aéroport non reconnu');
 const orig=new Date(cube.baseDate+'T00:00:00Z').getTime();
 const validDay=new Map(),weekDays=new Map();
 const asDate=day=>{if(!validDay.has(day))validDay.set(day,new Date(orig+day*864e5).toISOString().slice(0,10));return validDay.get(day)};
 const asDay=date=>Math.round((new Date(date+'T00:00:00Z').getTime()-orig)/864e5);
 const dow=day=>(day+1)%7;
 const dayName=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
 const entries=cube.rows.length;const sumCents=cube.rows.reduce((a,r)=>a+(r[7]||0),0);
 if(Math.abs(sumCents-cube.audit.totalRevenueCents)>5)throw Error('Réconciliation financière des ventes impossible');
 return {cube,airport,asDate,asDay,dow,dayName,entries};
}
function scoped(env,filter,overrideDates=false){
 const c=env.cube,airport=env.airport,dims=c.dims;
 const selectedStore=filter.store?dims.stores.indexOf(filter.store):-1;
 const family=filter.family?dims.families.indexOf(filter.family):-1;
 const category=filter.category?dims.categories.indexOf(filter.category):-1;
 const channel=filter.channel?dims.channels.indexOf(filter.channel):-1;
 const part=filter.part||'';
 let from=env.asDay(filter.from||'2026-06-01'),to=env.asDay(filter.to||'2026-10-12');
 if(overrideDates){from=-99999;to=99999}
 const cohort=filter.cohort||'historical';
 return c.rows.filter(r=>{
  if(cohort==='historical'&&r[0]===airport)return false;
  if(cohort==='airport'&&r[0]!==airport)return false;
  if(selectedStore>=0&&r[0]!==selectedStore)return false;
  if(family>=0&&r[3]!==family)return false;
  if(category>=0&&r[4]!==category)return false;
  if(channel>=0&&r[6]!==channel)return false;
  if(part&&partIds[partCode(r[2])]!==part)return false;
  return r[1]>=from&&r[1]<=to;
 });
}
function aggregate(env,rows){
 const a={total:zero(),store:new Map(),family:new Map(),category:new Map(),product:new Map(),day:new Map(),hour:new Map(),part:new Map(),channel:new Map(),weekday:new Map(),storeProduct:new Map(),storeFamily:new Map(),storeCategory:new Map(),familyPart:new Map(),channelPart:new Map(),storeHour:new Map(),storeDay:new Map(),productDay:new Map(),storeDays:new Map(),productStoreDays:new Map(),dates:new Set(),sourceRows:rows.length};
 for(const r of rows){
  const s=r[0],d=r[1],h=r[2],f=r[3],c=r[4],p=r[5],ch=r[6],pr=partCode(h);
  incr(a.total,r);a.dates.add(d);collectDays(a.storeDays,s,d);
  mapAdd(a.store,s,r);mapAdd(a.family,f,r);mapAdd(a.category,c,r);mapAdd(a.product,p,r);mapAdd(a.day,d,r);mapAdd(a.channel,ch,r);mapAdd(a.weekday,env.dow(d),r);mapAdd(a.storeProduct,s+'|'+p,r);mapAdd(a.storeFamily,s+'|'+f,r);mapAdd(a.storeCategory,s+'|'+c,r);mapAdd(a.storeDay,s+'|'+d,r);mapAdd(a.productDay,p+'|'+d,r);collectDays(a.productStoreDays,s+'|'+p,d);
  if(h>=0&&h<=23){mapAdd(a.hour,h,r);mapAdd(a.part,pr,r);mapAdd(a.familyPart,f+'|'+pr,r);mapAdd(a.channelPart,ch+'|'+pr,r);mapAdd(a.storeHour,s+'|'+h,r)}
 }
 return a;
}
function entries(map,index=0,descending=true){return [...map.entries()].sort((x,y)=>descending?(y[1][index]-x[1][index]):(x[1][index]-y[1][index]))}
function absolute(map){return [...map.entries()].sort((a,b)=>b[1]-a[1])}
function rankProducts(agg,positiveOnly=true){let p=entries(agg.product).filter(x=>!positiveOnly||x[1][0]>0),total=p.reduce((n,x)=>n+x[1][0],0),running=0;
 return p.map(([id,m],i)=>{running+=m[0];const cumulative=total?100*running/total:0;const group=total?(100*(running-m[0])/total<80?'A':100*(running-m[0])/total<95?'B':'C'):'C';return{id,metrics:metrics(m),share:total?100*m[0]/total:0,cumulative,group,rank:i+1}});
}
function weekBounds(env,filter){
 const end=env.asDay(filter.to||'2026-10-12'),sunday=end-env.dow(end);
 return {current:[sunday-6,sunday],previous:[sunday-13,sunday-7],labelCurrent:env.asDate(sunday-6)+' → '+env.asDate(sunday),labelPrevious:env.asDate(sunday-13)+' → '+env.asDate(sunday-7)};
}
function weekly(env,filter,minDays=5){
 const dates=weekBounds(env,filter),scope=scoped(env,filter,true),curr=scope.filter(r=>r[1]>=dates.current[0]&&r[1]<=dates.current[1]),prev=scope.filter(r=>r[1]>=dates.previous[0]&&r[1]<=dates.previous[1]);
 const curAll=aggregate(env,curr),oldAll=aggregate(env,prev);
 const presentIds=new Set([...curAll.store.keys(),...oldAll.store.keys()]);
 const coverage=[...presentIds].map(id=>({id,cur:curAll.storeDays.get(id)?.size||0,prev:oldAll.storeDays.get(id)?.size||0}));
 const eligible=new Set(coverage.filter(x=>x.cur>=minDays&&x.prev>=minDays).map(x=>x.id));
 const comparable=eligible.size>0&&filter.cohort==='historical';
 const filteredCur=comparable?curr.filter(r=>eligible.has(r[0])):curr;
 const filteredPrev=comparable?prev.filter(r=>eligible.has(r[0])):prev;
 const a=aggregate(env,filteredCur),b=aggregate(env,filteredPrev);
 const base={dates,a,b,curAll,oldAll,eligible:[...eligible],coverage,comparable,excluded:coverage.filter(x=>!eligible.has(x.id)),minDays};
 base.delta=metrics(a.total).revenue-metrics(b.total).revenue;
 base.change=metrics(b.total).revenue?100*base.delta/metrics(b.total).revenue:null;
 return base;
}
function movement(curMap,prevMap,index=0){const ids=new Set([...curMap.keys(),...prevMap.keys()]);return [...ids].map(id=>{const current=curMap.get(id)?.[index]||0,previous=prevMap.get(id)?.[index]||0;return{id,current,previous,delta:current-previous,pct:previous?100*(current-previous)/Math.abs(previous):null}}).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));}
function storePeers(env,agg,target,minimumPeer=3){
 const s=typeof target==='string'?env.cube.dims.stores.indexOf(target):target;
 const focal=agg.store.get(s);if(!focal||focal[0]<=0)return [];
 const allMetric=agg.total,restRev=allMetric[0]-focal[0];
 if(restRev<=0)return [];
 const dayCount=agg.storeDays.get(s)?.size||0;
 const validPeers=new Set([...agg.storeDays].filter(([id,days])=>id!==s&&days.size>=14&&agg.store.get(id)?.[0]>=1000000).map(x=>x[0]));
 if(validPeers.size<minimumPeer||dayCount<14)return [];
 const peerRevenue=[...validPeers].reduce((n,id)=>n+(agg.store.get(id)?.[0]||0),0);
 const peerDays=[...validPeers].reduce((n,id)=>n+(agg.storeDays.get(id)?.size||0),0);
 let out=[];
 for(const [productId,overall] of agg.product){
  const own=agg.storeProduct.get(s+'|'+productId);if(!own||own[0]<=0||own[0]<25000)continue;
  let matched=0,otherRev=0,otherQty=0;
  for(const id of validPeers){const v=agg.storeProduct.get(id+'|'+productId);if(v&&v[0]>0){matched++;otherRev+=v[0];otherQty+=v[2]}}
  if(matched<minimumPeer||otherRev<1500000)continue;
  const ownMix=own[0]/focal[0],peerMix=otherRev/peerRevenue;
  if(peerMix<=0)continue;
  const index=ownMix/peerMix;const hypotheticalGap=Math.max(0,peerMix-ownMix)*focal[0]/100;
  const ownVelocity=dayCount?own[2]/dayCount/1000:0,peerVelocity=peerDays?otherQty/peerDays/1000:0;
  out.push({id:productId,store:s,own:metrics(own),localMix:ownMix,peerMix,index,peers:matched,peerPool:validPeers.size,days:dayCount,peerDays,hypotheticalGap,ownVelocity,peerVelocity});
 }
 return out.sort((x,y)=>x.index-y.index);
}
function overlapBenchmark(env,rows,a,b){
 const datesA=new Set(rows.filter(x=>x[0]===a).map(x=>x[1]));const datesB=new Set(rows.filter(x=>x[0]===b).map(x=>x[1]));
 const common=new Set([...datesA].filter(x=>datesB.has(x)));
 const view=aggregate(env,rows.filter(x=>(x[0]===a||x[0]===b)&&common.has(x[1])));
 const fam=[];
 for(const id of new Set([...env.cube.dims.families.keys()])){
  const ma=view.storeFamily.get(a+'|'+id),mb=view.storeFamily.get(b+'|'+id);
  if(!ma&&!mb)continue;
  const revenueA=ma?.[0]||0,revenueB=mb?.[0]||0;
  fam.push({id,a:revenueA/100,b:revenueB/100,shareA:view.store.get(a)?.[0]?revenueA/view.store.get(a)[0]:0,shareB:view.store.get(b)?.[0]?revenueB/view.store.get(b)[0]:0});
 }
 fam.sort((x,y)=>Math.abs(y.shareA-y.shareB)-Math.abs(x.shareA-x.shareB));
 return {commonDays:common.size,daysA:datesA.size,daysB:datesB.size,a:metrics(view.store.get(a)),b:metrics(view.store.get(b)),families:fam};
}
function auditCoverage(env,cohort){const scope=scoped(env,{cohort,from:'2026-06-01',to:'2026-11-09'});const a=aggregate(env,scope);return [...a.storeDays].map(([id,days])=>({id,days:days.size,first:env.asDate(Math.min(...days)),last:env.asDate(Math.max(...days)),revenue:metrics(a.store.get(id)).revenue})).sort((x,y)=>y.revenue-x.revenue)}
function insightSignals(env,filter,agg,week){
 const signals=[],total=metrics(agg.total);
 if(total.lines>0&&total.missingCost/total.lines>=.65)signals.push({type:'quality',level:'high',title:'Coûts d’achat incomplets',evidence:(100*total.missingCost/total.lines).toFixed(1)+' % des lignes ont un coût nul.',action:'Corriger le référentiel coûts avant tout arbitrage de marge.',confidence:'forte sur la qualité, aucune marge inférée',score:100});
 if(total.lines>0&&total.zeroLines/total.lines>=.15)signals.push({type:'quality',level:'medium',title:'Lignes à prix nul à qualifier',evidence:(100*total.zeroLines/total.lines).toFixed(1)+' % des lignes sont à 0 DH.',action:'Identifier composants de formules et remises avant le calcul des volumes indépendants.',confidence:'forte sur le constat',score:68});
 if(filter.cohort!=='historical')signals.push({type:'coverage',level:'high',title:'Périmètres non comparables',evidence:'Les 10 magasins historiques s’arrêtent au 12/10 ; Aéroport M5 est le seul nouveau relevé au 09/11.',action:'Limiter les évolutions au même magasin et aux mêmes semaines complètes.',confidence:'forte',score:95});
 if(week?.comparable){
  const movements=movement(week.a.product,week.b.product).filter(x=>x.previous>50000&&x.delta<-Math.max(25000,0.2*x.previous));
  for(const x of movements.slice(0,4)){
   const name=env.cube.dims.products[x.id];
   signals.push({type:'decline',level:'medium',title:'Baisse : '+name,evidence:'Écart de '+(x.delta/100).toFixed(0)+' DH entre deux semaines comparables ; base '+(x.previous/100).toFixed(0)+' DH.',action:'Vérifier stock, présence sur menu, promotions, fermetures et événements locaux.',confidence:'comparaison sur magasins avec ≥ '+week.minDays+' jours vendus/semaine',score:65+Math.min(25,Math.abs(x.delta)/100000)});
  }
 }
 const f=entries(agg.family)[0];if(f&&total.revenue>0){const share=100*f[1][0]/agg.total[0];if(share>=25)signals.push({type:'mix',level:'info',title:'Forte concentration : '+env.cube.dims.families[f[0]],evidence:'Cette famille pèse '+share.toFixed(1)+' % du CA du périmètre.',action:'Suivre son évolution par magasin et moment de journée ; pas de changement d’assortiment sans test.',confidence:'constat descriptif',score:42})}
 return signals.sort((a,b)=>b.score-a.score);
}
const api={I,KEYS,HOURS,partIds,partCode,prepare,scoped,aggregate,metrics,entries,absolute,rankProducts,weekBounds,weekly,movement,storePeers,overlapBenchmark,auditCoverage,insightSignals};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.VeneziaDecisionCore=api;
})(typeof window!=='undefined'?window:undefined);