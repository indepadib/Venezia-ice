(()=>{
"use strict";
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),C=$("#content");
const nf=new Intl.NumberFormat("fr-MA",{maximumFractionDigits:0}),p1=new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1});
const mad=x=>nf.format(Number(x)||0)+" DH",num=x=>nf.format(Number(x)||0),pct=x=>p1.format(x||0)+" %";
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dayNames=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"],sep="\x1f";
const IDX={store:0,date:1,hour:2,family:3,category:4,product:5,rev:6,qty:7,paid:8,lines:9,zero:10,cost:11};
const M={rows:[],actions:[],db:null,tab:"command",start:"",end:"",store:"",family:"",min:"",max:"",product:"",sort:"revenue",scope:null,unfiltered:null,loading:false};
function day(s){return new Date(s+"T00:00:00Z")}function shift(s,n){let d=day(s);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function dot(a,b){return a?100*b/a:0}function diff(now,prev){return prev!==0?100*(now/prev-1):null}
function arrow(n){return n===null?'<span class="muted">Pas de référence</span>':'<span class="'+(n>=0?"positive":"negative")+'">'+(n>=0?"+":"")+pct(n)+'</span>'}
function kv(map,k,increment){map.set(k,(map.get(k)||0)+increment)}
function kvobj(map,k,revenue,quantity=0,lines=0){let a=map.get(k);if(!a){a={rev:0,qty:0,lines:0};map.set(k,a)}a.rev+=revenue;a.qty+=quantity;a.lines+=lines}
function rank(map){return [...map].sort((a,b)=>b[1]-a[1])}
function metric(title,value,description,icon="↗"){return '<div class="kpi"><div class="kpi-top"><span class="kpi-label">'+escape(title)+'</span><div class="kpi-icon">'+escape(icon)+'</div></div><strong>'+escape(value)+'</strong><small>'+escape(description)+'</small></div>'}
function metricRow(items){return '<div class="metricCards">'+items.join("")+'</div>'}
function panel(title,note,body,tag="ANALYSE"){return '<section class="panel"><div class="panelhead"><div><h3>'+escape(title)+'</h3><p>'+escape(note)+'</p></div><span class="capsule">'+escape(tag)+'</span></div>'+body+'</section>'}
function table(headers,rows){return '<div class="overflow"><table class="data-table"><thead><tr>'+headers.map(h=>'<th>'+escape(h)+'</th>').join("")+'</tr></thead><tbody>'+rows.join("")+'</tbody></table></div>'}
function bars(list,maxRows=12){const a=list.slice(0,maxRows),mx=Math.max(1,...a.map(x=>x[1]));return a.map(x=>'<div class="rowbar" title="'+escape(x[0])+' · '+mad(x[1])+'"><span class="title">'+escape(x[0])+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(0,100*x[1]/mx).toFixed(1)+'%"></div></div><b class="amount">'+mad(x[1])+'</b></div>').join("")||'<p class="muted">Aucune donnée</p>'}
function tile(title,description,evidence,kind="insight",button=false){return '<div class="edge"><span class="topic">'+escape(title)+'</span><h3>'+escape(description)+'</h3><p>'+escape(evidence)+'</p>'+(button?'<button class="ctaBtn addAction" data-title="'+escape(description)+'">Créer une action →</button>':'')+'</div>'}
function save(key,value){return new Promise((ok,fail)=>{const tx=M.db.transaction("kv","readwrite");tx.objectStore("kv").put(value,key);tx.oncomplete=()=>ok(true);tx.onerror=()=>fail(tx.error)})}
function read(key){return new Promise((ok,fail)=>{let r=M.db.transaction("kv","readonly").objectStore("kv").get(key);r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)})}
function openDatabase(){return new Promise((ok,fail)=>{let req=indexedDB.open("VeneziaIceSalesIntelligence",1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("kv"))req.result.createObjectStore("kv")};req.onsuccess=()=>ok(req.result);req.onerror=()=>fail(req.error)})}
function baseAgg(rows){
 const a={rev:0,paid:0,lines:0,zero:0,cost:0,invalid:0,dates:new Set(),stores:new Map(),products:new Map(),families:new Map(),categories:new Map(),hours:new Map(),weekdays:new Map(),daily:new Map(),storeDay:new Map(),storeHour:new Map(),storeFamily:new Map(),storeProduct:new Map(),productHour:new Map(),productDay:new Map(),familyHour:new Map(),familyDay:new Map(),productStores:new Map(),productDays:new Map(),storeDays:new Map(),storeDayHour:new Map(),familyProduct:new Map()};
 for(const r of rows){
  const [st,date,h,fam,cat,prod]=r;const revenue=Number(r[6])||0,paid=Number(r[8])||0,lines=Number(r[9])||0;
  a.rev+=revenue;a.paid+=paid;a.lines+=lines;a.zero+=(r[10]||0);a.cost+=(r[11]||0);if(h<0||h>23)a.invalid+=lines;
  a.dates.add(date);kv(a.stores,st,revenue);kvobj(a.products,prod,revenue,paid,lines);kv(a.families,fam,revenue);kv(a.categories,cat,revenue);
  if(h>=0&&h<=23){kv(a.hours,h,revenue);kv(a.storeHour,st+sep+h,revenue);kv(a.productHour,prod+sep+h,revenue);kv(a.familyHour,fam+sep+h,revenue);a.storeDayHour.set(st+sep+date+sep+h,true)}
  kv(a.daily,date,revenue);kv(a.storeDay,st+sep+date,revenue);kv(a.storeFamily,st+sep+fam,revenue);kvobj(a.storeProduct,st+sep+prod,revenue,paid,lines);kv(a.productDay,prod+sep+date,revenue);kv(a.familyDay,fam+sep+date,revenue);
  const wd=day(date).getUTCDay();kv(a.weekdays,wd,revenue);if(!a.storeDays.has(st))a.storeDays.set(st,new Set());a.storeDays.get(st).add(date);
  if(!a.productStores.has(prod))a.productStores.set(prod,new Set());if(revenue!==0)a.productStores.get(prod).add(st);
  if(!a.productDays.has(prod))a.productDays.set(prod,new Set());if(revenue!==0)a.productDays.get(prod).add(date);
  kv(a.familyProduct,fam+sep+prod,revenue);
 }
 return a;
}
function filter(){const st=M.store,fam=M.family,lo=M.start,hi=M.end;return M.rows.filter(r=>(!st||r[0]===st)&&(!fam||r[3]===fam)&&(!lo||r[1]>=lo)&&(!hi||r[1]<=hi))}
function present(){const s=M.scope;return s? s:""}
function syncFilter(){M.scope=baseAgg(filter());const s=M.scope;$("#dataStatus").textContent="● "+num(M.rows.length)+" lignes agrégées";$("#dateStatus").textContent=M.min+" → "+M.max;return s}
function updateInputs(){
 $("#fStore").innerHTML='<option value="">Tout le réseau</option>'+[...M.unfiltered.stores.keys()].sort().map(s=>'<option value="'+escape(s)+'">'+escape(s)+'</option>').join("");
 $("#fFamily").innerHTML='<option value="">Toutes les familles</option>'+[...M.unfiltered.families.keys()].sort().map(s=>'<option value="'+escape(s)+'">'+escape(s)+'</option>').join("");
 $("#fStore").value=M.store;$("#fFamily").value=M.family;$("#fStart").value=M.start;$("#fEnd").value=M.end;
}
function labels(t,subtitle){$("#viewTitle").textContent=t;$("#viewSubtitle").textContent=subtitle}
function exportCSV(name,header,rows){const text=[header,...rows].map(r=>r.map(v=>{let s=String(v??"");if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}).join(";")).join("\r\n");let blob=new Blob(["\ufeff",text],{type:"text/csv;charset=utf-8"});let url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function dateLine(series){const a=rank(new Map([...series].sort((x,y)=>x[0].localeCompare(y[0]))));return a}
function compactTrend(map){const d=[...map].sort((a,b)=>a[0].localeCompare(b[0]));if(!d.length)return '<p class="muted">Pas de données</p>';const max=Math.max(1,...d.map(x=>x[1]));const W=800,H=215,P=27,xx=i=>P+(W-2*P)*i/Math.max(1,d.length-1),yy=n=>H-P-(H-2*P)*n/max;let path=d.map((x,i)=>(i?"L":"M")+xx(i).toFixed(1)+" "+yy(x[1]).toFixed(1)).join(" ");return '<svg class="chart" viewBox="0 0 800 250" role="img" aria-label="Évolution quotidienne du CA"><path d="'+path+'" fill="none" stroke="#7659cc" stroke-width="3" stroke-linejoin="round"/>'+d.filter((_,i)=>i%Math.max(1,Math.floor(d.length/12))===0).map(x=>{let i=d.findIndex(y=>y[0]===x[0]);return '<circle r="3.6" cx="'+xx(i)+'" cy="'+yy(x[1])+'" fill="#fff" stroke="#7054cb" stroke-width="2"><title>'+x[0]+': '+mad(x[1])+'</title></circle><text x="'+xx(i)+'" y="245" font-size="11" fill="#9da5b6" text-anchor="middle">'+x[0].slice(5)+'</text>'}).join("")+'</svg>'}
function getWk(){let end=M.max;if(!end)return null;let wd=day(end).getUTCDay();let sun=shift(end,-(wd||7));return {a:shift(sun,-6),b:sun,c:shift(sun,-13),d:shift(sun,-7)}}
function weekly(scopeName=""){const w=getWk(),good=[],prior=[];if(!w)return {w,cur:baseAgg([]),prior:baseAgg([])};
 for(const r of M.rows){if(M.store&&r[0]!==M.store)continue;if(M.family&&r[3]!==M.family)continue;if(w.a<=r[1]&&r[1]<=w.b)good.push(r);else if(w.c<=r[1]&&r[1]<=w.d)prior.push(r)}
 return {w,cur:baseAgg(good),prior:baseAgg(prior)}
}
function computedCaveats(){return '<div class="notice">Lecture méthodologique : CA enregistré tel que dans la source ; prix de vente déjà étendu par quantité ; coûts et marges non fiables ; produits à 0 DH possibles dans les formules ; jours de vente ≠ jours d’ouverture ; une baisse peut venir d’une rupture, d’une fermeture ou d’un changement de menu.</div>'}
function command(){
 labels("Commercial Command Center","De la vue réseau jusqu’aux produits et aux heures : compréhension, détection, action.");
 const a=present(),w=weekly(),mx=rank(a.families),products=[...a.products].sort((x,y)=>y[1].rev-x[1].rev),activeDays=a.storeDay.size,top10=products.slice(0,10).reduce((z,x)=>z+x[1].rev,0),days=a.dates.size;
 const cards=metricRow([metric("CA enregistré",mad(a.rev),"Période filtrée"),metric("Magasins avec ventes",num(a.stores.size),"Périmètre actif","⌂"),metric("Quantités payées",num(a.paid),"Ne compte pas les lignes à 0 DH","◈"),metric("Concentration Top 10",pct(dot(a.rev,top10)),"Poids du CA des 10 leaders","★")]);
 const wshare=w.prior.rev?arrow(diff(w.cur.rev,w.prior.rev)):"—";
 let insights=tile("MOTEUR COMMERCIAL",mx[0]?.[0]||"Aucune famille","La première famille représente "+pct(dot(a.rev,mx[0]?.[1]||0))+" du CA sélectionné.")+tile("DYNAMIQUE",("Semaine complète : "+wshare.replace(/<[^>]+>/g,"")),"Variation comparant les deux dernières semaines complètes ; ne pas conclure sans contexte.")+tile("QUALITÉ DES DONNÉES",pct(dot(a.lines,a.zero))+" de lignes à zéro","En général : composants de formules, remises ou opérations spécifiques à vérifier.");
 C.innerHTML=cards+'<div class="fineGrid"><div class="c7">'+panel("Trajectoire quotidienne","Évolution du CA sur la période filtrée",compactTrend(a.daily),"TEMPS")+'</div><div class="c5">'+panel("Familles moteurs","Qui construit le chiffre d’affaires ?",bars(mx,9),"MIX PRODUIT")+'</div><div class="c6">'+panel("Top 15 produits","Classement CA global ou magasin",bars(products.map(x=>[x[0],x[1].rev]),15),"LEADERS")+'</div><div class="c6">'+panel("Magasins : contribution","Lignes de ventes par établissement",bars(rank(a.stores),10),"RÉSEAU")+'</div><div class="c12">'+panel("Trois signaux à examiner","Lecture descriptive, sans interprétation causale",'<div class="insights">'+insights+'</div>',"SIGNALS")+'</div></div>'+computedCaveats();
}
function productsPage(){
 labels("Produits : tops, flops et trajectoires","Identifier les vrais leaders en CA ou volumes, et les produits qui nécessitent une enquête.");
 let a=present(),items=[...a.products].sort((x,y)=>(M.sort==="volume"?y[1].qty-x[1].qty:y[1].rev-x[1].rev)),count=items.length;
 let productDetail=M.product&&a.products.has(M.product)?M.product:items[0]?.[0];M.product=productDetail||"";
 let pdata=productDetail?a.products.get(productDetail):null;const prodStores=productDetail?rank(new Map([...a.storeProduct].filter(x=>x[0].endsWith(sep+productDetail)).map(x=>[x[0].split(sep)[0],x[1].rev]))):[];
 const hours=productDetail?rank(new Map([...a.productHour].filter(x=>x[0].startsWith(productDetail+sep)).map(x=>[x[0].split(sep)[1]+"h",x[1]]))):[];
 let trend=new Map([...a.productDay].filter(x=>x[0].startsWith(productDetail+sep)).map(x=>[x[0].split(sep)[1],x[1]]));
 const prodRows=items.slice(0,150).map((x,i)=>'<tr><td>'+num(i+1)+'</td><td><button type="button" class="btnlink chooseProduct" data-name="'+escape(x[0])+'" style="border:0;background:none;color:#6240b7;font-weight:800;cursor:pointer">'+escape(x[0])+'</button></td><td class="r">'+mad(x[1].rev)+'</td><td class="r">'+num(x[1].qty)+'</td><td class="r">'+pct(dot(a.rev,x[1].rev))+'</td><td class="r">'+num(a.productStores.get(x[0])?.size||0)+'</td></tr>');
 C.innerHTML=metricRow([metric("Produits vendus",num(count),"Produits avec lignes enregistrées"),metric("Top 5 CA",mad(items.slice().sort((x,y)=>y[1].rev-x[1].rev).slice(0,5).reduce((t,x)=>t+x[1].rev,0)),"CA cumulé","★"),metric("Qté payée",num(a.paid),"Payée > 0 DH","◈"),metric("Top 20 · % CA",pct(dot(a.rev,items.slice().sort((x,y)=>y[1].rev-x[1].rev).slice(0,20).reduce((t,x)=>t+x[1].rev,0))),"Concentration des ventes","↗")])+
 '<div class="toolrow"><label>Classement <select id="sortProd" class="miniSelect"><option value="revenue">Par CA</option><option value="volume">Par quantité payée</option></select></label><button id="exportProducts">↧ Exporter tous les produits</button></div>'+
 '<div class="fineGrid"><div class="c7">'+panel("Top 150 produits","Cliquez sur un produit pour ouvrir son diagnostic",table(["#","Produit","CA","Qté payée","Part","Magasins"],prodRows),"RANKING")+'</div><div class="c5">'+panel("Produit : "+(productDetail||"—"),"CA, volume, réseau, heures et évolution",metricRow([metric("CA produit",mad(pdata?.rev||0),"Dans la sélection"),metric("Qté facturée",num(pdata?.qty||0),"Prix de vente > 0 DH","◈")])+'<div class="statnote">Prix moyen réalisé sur lignes payées : '+(pdata?.qty>0?mad(pdata.rev/pdata.qty):"Indisponible")+' / unité. Interprétation limitée pour formules et promotions.</div><h3 style="margin:18px 0 7px">Ventes par magasin</h3>'+bars(prodStores,10)+'<h3 style="margin:18px 0 7px">Heures les plus contributrices</h3>'+bars(hours,9),"PRODUCT 360")+'</div><div class="c12">'+panel("Trajectoire · "+(productDetail||"—"),"CA quotidien du produit",compactTrend(trend),"ÉVOLUTION")+'</div></div>'+computedCaveats();
 $("#sortProd").value=M.sort;$("#sortProd").onchange=e=>{M.sort=e.target.value;productsPage()};
 $("#exportProducts").onclick=()=>exportCSV("venezia-produits-"+M.start+"-"+M.end+".csv",["Produit","CA","Qté payée","Part CA","Magasins"],items.map(x=>[x[0],x[1].rev,x[1].qty,dot(a.rev,x[1].rev).toFixed(2),a.productStores.get(x[0])?.size||0]));
 $$(".chooseProduct").forEach(b=>b.onclick=()=>{M.product=b.dataset.name;productsPage()});
}
function timePage(){
 labels("Heures × magasins × familles","Les créneaux de vente qui comptent : pilotage des services et meilleure programmation.");
 let a=present();const max=Math.max(1,...a.hours.values());let orderedHours=Array.from({length:24},(_,h)=>[h,a.hours.get(h)||0]);
 let hourly='<div class="hourchart">'+orderedHours.map(([h,v])=>'<div class="houritem" title="'+h+'h : '+mad(v)+'"><div class="hourcolumn" style="height:'+Math.max(1,v/max*160)+'px"></div><small>'+(h%3===0?h+"h":"")+'</small></div>').join("")+'</div>';
 const families=rank(a.families).slice(0,7);let dateHour=new Map();
 for(const r of M.rows){if(M.store&&r[0]!==M.store)continue;if(M.family&&r[3]!==M.family)continue;if(r[1]<M.start||r[1]>M.end||r[2]<0||r[2]>23)continue;const wd=day(r[1]).getUTCDay();kv(dateHour,wd+sep+r[2],Number(r[6])||0)}
 let hmax=Math.max(1,...dateHour.values()),days=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];let heat='<div class="overflow"><div class="hourMatrix"><span></span>'+Array.from({length:24},(_,h)=>'<span>'+(h%3===0?h+"h":"")+'</span>').join("");
 for(let i=0;i<7;i++){let wd=(i+1)%7;heat+='<span>'+days[i]+'</span>';for(let h=0;h<24;h++){let v=dateHour.get(wd+sep+h)||0;heat+='<div class="hcell" style="background:rgba(110,82,208,'+(0.04+0.9*v/hmax).toFixed(3)+')" title="'+days[i]+" "+h+"h : "+mad(v)+'"></div>'}}heat+="</div></div>";
 let storeHourRank=rank(a.storeHour).slice(0,25),shrows=storeHourRank.map(x=>'<tr><td>'+escape(x[0].split(sep)[0])+'</td><td>'+escape(x[0].split(sep)[1])+'h</td><td class="r">'+mad(x[1])+'</td></tr>');
 C.innerHTML=metricRow([metric("Heure leader",String(rank(a.hours)[0]?.[0]??"—")+"h",mad(rank(a.hours)[0]?.[1]||0),"◷"),metric("CA avant 12h",mad(orderedHours.filter(x=>x[0]<12).reduce((v,x)=>v+x[1],0)),"Avant-midi","↗"),metric("CA 12–17h",mad(orderedHours.filter(x=>x[0]>=12&&x[0]<18).reduce((v,x)=>v+x[1],0)),"Après-midi","◈"),metric("CA après 18h",mad(orderedHours.filter(x=>x[0]>=18).reduce((v,x)=>v+x[1],0)),"Soir","★")])+
 '<div class="fineGrid"><div class="c8">'+panel("CA par heure","Précision horaire sur le magasin, la famille et les dates filtrées",hourly,"24H")+'</div><div class="c4">'+panel("Moments forts","Heures les plus contributrices",bars(rank(a.hours).map(x=>[x[0]+"h",x[1]]),10),"CRENEAUX")+'</div><div class="c12">'+panel("Heatmap : jour de semaine × heure","CA cumulé, à interpréter avec les heures de fonctionnement",heat,"HEATMAP")+'</div><div class="c6">'+panel("Heures × magasins","Top créneaux magasin (CA cumulé)",table(["Magasin","Heure","CA"],shrows),"SITES")+'</div><div class="c6">'+panel("Jours de semaine","CA cumulé selon le jour",bars(rank(new Map([...a.weekdays].map(x=>[dayNames[x[0]],x[1]]))),7),"SEMAINE")+'</div></div><div class="notice">La comparaison de CA à 9h et 21h ne suffit pas à décider des horaires de personnel. Vérifiez les heures réelles d’ouverture, la capacité de service et le nombre de jours comparables. L’analyse croisée horaire est néanmoins calculée sur les vraies ventes de la sélection.</div>';
}
