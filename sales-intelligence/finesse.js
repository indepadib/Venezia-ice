(()=>{
"use strict";
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),C=$("#content");
const nf=new Intl.NumberFormat("fr-MA",{maximumFractionDigits:0}),p1=new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1});
const mad=x=>nf.format(Number(x)||0)+" DH",num=x=>nf.format(Number(x)||0),pct=x=>p1.format(x||0)+" %";
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dayNames=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"],sep="\x1f";
const IDX={store:0,date:1,hour:2,family:3,category:4,product:5,rev:6,qty:7,paid:8,lines:9,zero:10,cost:11};
const M={rows:[],actions:[],db:null,tab:"command",start:"",end:"",store:"",family:"",category:"",min:"",max:"",product:"",sort:"revenue",scope:null,unfiltered:null,loading:false};
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
function filter(){const st=M.store,fam=M.family,cat=M.category,lo=M.start,hi=M.end;return M.rows.filter(r=>(!st||r[0]===st)&&(!fam||r[3]===fam)&&(!cat||r[4]===cat)&&(!lo||r[1]>=lo)&&(!hi||r[1]<=hi))}
function present(){const s=M.scope;return s? s:""}
function syncFilter(){M.scope=baseAgg(filter());const s=M.scope;$("#dataStatus").textContent="● "+num(M.rows.length)+" lignes agrégées";$("#dateStatus").textContent=M.min+" → "+M.max;return s}
function updateInputs(){
 $("#fStore").innerHTML='<option value="">Tout le réseau</option>'+[...M.unfiltered.stores.keys()].sort().map(s=>'<option value="'+escape(s)+'">'+escape(s)+'</option>').join("");
 $("#fFamily").innerHTML='<option value="">Toutes les familles</option>'+[...M.unfiltered.families.keys()].sort().map(s=>'<option value="'+escape(s)+'">'+escape(s)+'</option>').join("");
 $("#fStore").value=M.store;$("#fFamily").value=M.family;refreshCategoryOptions();$("#fStart").value=M.start;$("#fEnd").value=M.end;
}
function refreshCategoryOptions(){const source=new Set();for(const row of M.rows){if(!M.family||row[3]===M.family)source.add(row[4])}const cats=[...source].sort();$("#fCategory").innerHTML='<option value="">Toutes les catégories</option>'+cats.map(x=>'<option value="'+escape(x)+'">'+escape(x)+'</option>').join("");if(!cats.includes(M.category))M.category="";$("#fCategory").value=M.category}
function labels(t,subtitle){$("#viewTitle").textContent=t;$("#viewSubtitle").textContent=subtitle}
function exportCSV(name,header,rows){const text=[header,...rows].map(r=>r.map(v=>{let s=String(v??"");if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}).join(";")).join("\r\n");let blob=new Blob(["\ufeff",text],{type:"text/csv;charset=utf-8"});let url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function dateLine(series){const a=rank(new Map([...series].sort((x,y)=>x[0].localeCompare(y[0]))));return a}
function compactTrend(map){const d=[...map].sort((a,b)=>a[0].localeCompare(b[0]));if(!d.length)return '<p class="muted">Pas de données</p>';const max=Math.max(1,...d.map(x=>x[1]));const W=800,H=215,P=27,xx=i=>P+(W-2*P)*i/Math.max(1,d.length-1),yy=n=>H-P-(H-2*P)*n/max;let path=d.map((x,i)=>(i?"L":"M")+xx(i).toFixed(1)+" "+yy(x[1]).toFixed(1)).join(" ");return '<svg class="chart" viewBox="0 0 800 250" role="img" aria-label="Évolution quotidienne du CA"><path d="'+path+'" fill="none" stroke="#7659cc" stroke-width="3" stroke-linejoin="round"/>'+d.filter((_,i)=>i%Math.max(1,Math.floor(d.length/12))===0).map(x=>{let i=d.findIndex(y=>y[0]===x[0]);return '<circle r="3.6" cx="'+xx(i)+'" cy="'+yy(x[1])+'" fill="#fff" stroke="#7054cb" stroke-width="2"><title>'+x[0]+': '+mad(x[1])+'</title></circle><text x="'+xx(i)+'" y="245" font-size="11" fill="#9da5b6" text-anchor="middle">'+x[0].slice(5)+'</text>'}).join("")+'</svg>'}
function getWk(){let end=M.max;if(!end)return null;let wd=day(end).getUTCDay();let sun=shift(end,-(wd||7));return {a:shift(sun,-6),b:sun,c:shift(sun,-13),d:shift(sun,-7)}}
function weekly(scopeName=""){const w=getWk(),good=[],prior=[];if(!w)return {w,cur:baseAgg([]),prior:baseAgg([])};
 for(const r of M.rows){if(M.store&&r[0]!==M.store)continue;if(M.family&&r[3]!==M.family)continue;if(M.category&&r[4]!==M.category)continue;if(w.a<=r[1]&&r[1]<=w.b)good.push(r);else if(w.c<=r[1]&&r[1]<=w.d)prior.push(r)}
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
 const storePrices=productDetail?[...a.storeProduct].filter(x=>x[0].endsWith(sep+productDetail)&&x[1].qty>=10&&x[1].rev>0).map(x=>({store:x[0].split(sep)[0],rev:x[1].rev,qty:x[1].qty,unit:x[1].rev/x[1].qty})).sort((x,y)=>y.unit-x.unit):[];
 const priceRows=storePrices.map(x=>'<tr><td>'+escape(x.store)+'</td><td class="r">'+mad(x.rev)+'</td><td class="r">'+num(x.qty)+'</td><td class="r">'+mad(x.unit)+'</td></tr>');
 C.insertAdjacentHTML("beforeend",'<div class="fineGrid"><div class="c12">'+panel("Prix moyen réalisé · "+(productDetail||"—"),"CA ÷ unités payées, magasins avec au moins 10 unités",table(["Magasin","CA produit","Qté payée","Prix moyen réalisé"],priceRows),"PRIX / MAGASIN")+'</div></div><div class="notice">Prix réalisés indicatifs : un mix de déclinaisons, formules, promotions ou retours peut créer des écarts ; ne pas conclure à une anomalie tarifaire sans confronter les tickets et le référentiel des prix.</div>');
 $("#sortProd").value=M.sort;$("#sortProd").onchange=e=>{M.sort=e.target.value;productsPage()};
 $("#exportProducts").onclick=()=>exportCSV("venezia-produits-"+M.start+"-"+M.end+".csv",["Produit","CA","Qté payée","Part CA","Magasins"],items.map(x=>[x[0],x[1].rev,x[1].qty,dot(a.rev,x[1].rev).toFixed(2),a.productStores.get(x[0])?.size||0]));
 $$(".chooseProduct").forEach(b=>b.onclick=()=>{M.product=b.dataset.name;productsPage()});
}
function timePage(){
 labels("Heures × magasins × familles","Les créneaux de vente qui comptent : pilotage des services et meilleure programmation.");
 let a=present();const max=Math.max(1,...a.hours.values());let orderedHours=Array.from({length:24},(_,h)=>[h,a.hours.get(h)||0]);
 let hourly='<div class="hourchart">'+orderedHours.map(([h,v])=>'<div class="houritem" title="'+h+'h : '+mad(v)+'"><div class="hourcolumn" style="height:'+Math.max(1,v/max*160)+'px"></div><small>'+(h%3===0?h+"h":"")+'</small></div>').join("")+'</div>';
 const families=rank(a.families).slice(0,7);let dateHour=new Map();
 for(const r of M.rows){if(M.store&&r[0]!==M.store)continue;if(M.family&&r[3]!==M.family)continue;if(M.category&&r[4]!==M.category)continue;if(r[1]<M.start||r[1]>M.end||r[2]<0||r[2]>23)continue;const wd=day(r[1]).getUTCDay();kv(dateHour,wd+sep+r[2],Number(r[6])||0)}
 let hmax=Math.max(1,...dateHour.values()),days=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];let heat='<div class="overflow"><div class="hourMatrix"><span></span>'+Array.from({length:24},(_,h)=>'<span>'+(h%3===0?h+"h":"")+'</span>').join("");
 for(let i=0;i<7;i++){let wd=(i+1)%7;heat+='<span>'+days[i]+'</span>';for(let h=0;h<24;h++){let v=dateHour.get(wd+sep+h)||0;heat+='<div class="hcell" style="background:rgba(110,82,208,'+(0.04+0.9*v/hmax).toFixed(3)+')" title="'+days[i]+" "+h+"h : "+mad(v)+'"></div>'}}heat+="</div></div>";
 let storeHourRank=rank(a.storeHour).slice(0,25),shrows=storeHourRank.map(x=>'<tr><td>'+escape(x[0].split(sep)[0])+'</td><td>'+escape(x[0].split(sep)[1])+'h</td><td class="r">'+mad(x[1])+'</td></tr>');
 C.innerHTML=metricRow([metric("Heure leader",String(rank(a.hours)[0]?.[0]??"—")+"h",mad(rank(a.hours)[0]?.[1]||0),"◷"),metric("CA avant 12h",mad(orderedHours.filter(x=>x[0]<12).reduce((v,x)=>v+x[1],0)),"Avant-midi","↗"),metric("CA 12–17h",mad(orderedHours.filter(x=>x[0]>=12&&x[0]<18).reduce((v,x)=>v+x[1],0)),"Après-midi","◈"),metric("CA après 18h",mad(orderedHours.filter(x=>x[0]>=18).reduce((v,x)=>v+x[1],0)),"Soir","★")])+
 '<div class="fineGrid"><div class="c8">'+panel("CA par heure","Précision horaire sur le magasin, la famille et les dates filtrées",hourly,"24H")+'</div><div class="c4">'+panel("Moments forts","Heures les plus contributrices",bars(rank(a.hours).map(x=>[x[0]+"h",x[1]]),10),"CRENEAUX")+'</div><div class="c12">'+panel("Heatmap : jour de semaine × heure","CA cumulé, à interpréter avec les heures de fonctionnement",heat,"HEATMAP")+'</div><div class="c6">'+panel("Heures × magasins","Top créneaux magasin (CA cumulé)",table(["Magasin","Heure","CA"],shrows),"SITES")+'</div><div class="c6">'+panel("Jours de semaine","CA cumulé selon le jour",bars(rank(new Map([...a.weekdays].map(x=>[dayNames[x[0]],x[1]]))),7),"SEMAINE")+'</div></div><div class="notice">La comparaison de CA à 9h et 21h ne suffit pas à décider des horaires de personnel. Vérifiez les heures réelles d’ouverture, la capacité de service et le nombre de jours comparables. L’analyse croisée horaire est néanmoins calculée sur les vraies ventes de la sélection.</div>';
}

function benchmarkPage(){
 labels("Benchmark magasins","Comparer les magasins sans confondre ancienneté et performance commerciale.");
 const a=present(),peer=peerData(),ranks=rank(a.stores),rows=[];const week=weekly();
 for(const [st,ca] of ranks){
  const dates=a.storeDays.get(st)||new Set(),d=dates.size,prod=[...a.storeProduct].filter(x=>x[0].startsWith(st+sep)).sort((x,y)=>y[1].rev-x[1].rev)[0];
  const dominant=[...a.storeFamily].filter(x=>x[0].startsWith(st+sep)).sort((x,y)=>y[1]-x[1])[0];
  const wCur=week.cur.stores.get(st)||0,wOld=week.prior.stores.get(st)||0;
  rows.push({st,ca,days:d,avg:ca/(d||1),product:prod?.[0].split(sep)[1]||"—",family:dominant?.[0].split(sep)[1]||"—",growth:diff(wCur,wOld)});
 }
 rows.sort((x,y)=>y.avg-x.avg);
 const trs=rows.map((x,i)=>'<tr><td>'+num(i+1)+'</td><td><b>'+escape(x.st)+'</b></td><td class="r">'+mad(x.ca)+'</td><td class="r">'+num(x.days)+'</td><td class="r">'+mad(x.avg)+'</td><td>'+escape(x.family)+'</td><td class="r">'+arrow(x.growth)+'</td></tr>');
 const st=M.store||rows[0]?.st||"",ca=a.stores.get(st)||0,other=a.rev-ca;
 const mixes=[...peer.families].map(([fam,whole])=>{const local=peer.storeFamily.get(st+sep+fam)||0,peers=whole-local,peerMix=(peer.rev-ca)?peers/(peer.rev-ca):0,localMix=ca?local/ca:0;return {fam,local,localMix,peerMix,ratio:peerMix?localMix/peerMix:null}}).filter(x=>x.local>4000&&x.peerMix>0.005).sort((x,y)=>(y.ratio??0)-(x.ratio??0));
 const mixRows=mixes.slice(0,30).map(x=>'<tr><td>'+escape(x.fam)+'</td><td class="r">'+pct(x.localMix*100)+'</td><td class="r">'+pct(x.peerMix*100)+'</td><td class="r">'+(x.ratio===null?"—":'<span class="'+(x.ratio>=1?"positive":"negative")+'">'+p1.format(x.ratio)+'×</span>')+'</td></tr>');
 C.innerHTML=metricRow([metric("Magasins avec ventes",num(ranks.length),"Sur votre sélection","⌂"),metric("Meilleur CA/jour",mad(rows[0]?.avg||0),"Jours avec ventes observées","↗"),metric("CA réseau filtré",mad(a.rev),"Périmètre sélectionné","◈"),metric("Période",M.start+" → "+M.end,"Filtre temporel","◷")])+
 '<div class="fineGrid"><div class="c12">'+panel("Classement normalisé","Comparer CA/jour vendu, le CA global et la spécialisation",table(["#","Magasin","CA","Jours avec ventes","CA / jour","Famille dominante","Variation hebdo"],trs),"BENCHMARK")+'</div><div class="c7">'+panel("Indice de spécialisation · "+st,"Part locale / part dans les autres magasins (même période filtrée)",table(["Famille","Part locale","Part autres","Indice"],mixRows),"LOCAL VS RÉSEAU")+'</div><div class="c5">'+panel("Les points de vigilance","Quels ajustements sont nécessaires avant de décider ?",tile("ÉQUITÉ", "Ne pas comparer les CA cumulés seuls","Un magasin avec 89 jours de ventes ne peut pas être comparé sur le même total avec un magasin en comptant 134.")+tile("EXPOSITION", "Contrôler les jours réels ouverts","Jours avec ventes enregistrées ne prouvent ni ouverture complète ni disponibilité.")+tile("PAIRING", "Comparer les bons formats","Tourisme, mall, street, saison et menu conditionnent le mix de ventes."),"MÉTHODE")+'</div></div>'+computedCaveats();
}
function compareMaps(cur,prev,prop,minimum=0){
 const aa=prop(cur),bb=prop(prev),names=new Set([...aa.keys(),...bb.keys()]);return [...names].map(name=>({name,now:aa.get(name)?.rev??aa.get(name)??0,was:bb.get(name)?.rev??bb.get(name)??0})).filter(x=>Math.abs(x.now)+Math.abs(x.was)>=minimum);
}
function pulsePage(){
 labels("Weekly Pulse","Chaque semaine : les mouvements significatifs, les responsables et les priorités terrain.");
 const {w,cur,prior}=weekly(),e=diff(cur.rev,prior.rev),difference=cur.rev-prior.rev;
 if(!w){C.innerHTML='<div class="fineEmpty"><h2>Aucune semaine disponible</h2></div>';return}
 const stores=compareMaps(cur,prior,x=>x.stores,0).sort((a,b)=>Math.abs(b.now-b.was)-Math.abs(a.now-a.was));
 const prods=compareMaps(cur,prior,x=>x.products,700).sort((a,b)=>Math.abs(b.now-b.was)-Math.abs(a.now-a.was)).slice(0,30);
 const family=compareMaps(cur,prior,x=>x.families,1000).sort((a,b)=>Math.abs(b.now-b.was)-Math.abs(a.now-a.was));
 const hours=compareMaps(cur,prior,x=>x.hours,1000).sort((a,b)=>Math.abs(b.now-b.was)-Math.abs(a.now-a.was));
 const tr=x=>'<tr><td><b>'+escape(x.name)+'</b></td><td class="r">'+mad(x.now)+'</td><td class="r">'+mad(x.was)+'</td><td class="r">'+(x.now>=x.was?"+":"")+mad(x.now-x.was)+'</td><td class="r">'+arrow(diff(x.now,x.was))+'</td></tr>';
 let positives=prods.filter(x=>x.now>x.was).sort((a,b)=>b.now-b.was-(a.now-a.was)),negatives=prods.filter(x=>x.now<x.was).sort((a,b)=>(a.now-a.was)-(b.now-b.was));
 let insight='<div class="insights">'+tile("ÉVOLUTION GLOBALE",difference>=0?"Le CA augmente de "+mad(difference):"Le CA recule de "+mad(-difference),"Sur "+w.a+" → "+w.b+" contre "+w.c+" → "+w.d)+
 tile("HAUSSES LES PLUS IMPORTANTES",positives[0]?.name||"Aucune hausse significative",positives[0]?"Variation de "+mad(positives[0].now-positives[0].was)+". Vérifier promotions et disponibilité.":"Vérifier couverture des données.")+
 tile("BAISSES À INVESTIGUER",negatives[0]?.name||"Aucune baisse significative",negatives[0]?"Variation de "+mad(negatives[0].now-negatives[0].was)+". Identifier fermeture, stock ou offre.":"Vérifier couverture des données.")+"</div>";
 C.innerHTML='<div class="statnote"><b>Semaine complète :</b> '+w.a+" → "+w.b+" &nbsp;&nbsp; <b>Comparatif :</b> "+w.c+" → "+w.d+". "+(M.store?"Magasin : "+escape(M.store)+". ":"")+(M.family?"Famille : "+escape(M.family)+".":"")+'</div>'+
 metricRow([metric("CA cette semaine",mad(cur.rev),"Sept jours calendaires"),metric("CA semaine précédente",mad(prior.rev),"Sept jours calendaires","◷"),metric("Variation",e===null?"—":(e>=0?"+":"")+pct(e),"Même durée","↗"),metric("Écart CA",(difference>=0?"+":"")+mad(difference),"En valeur","★")])+
 '<div class="fineGrid"><div class="c12">'+panel("Les trois faits à retenir","Classement des mouvements, sans attribution de cause",insight,"DÉCRYPTAGE")+'</div><div class="c12">'+panel("Magasins qui bougent","Même semaine, même métrique de CA",table(["Magasin","Cette semaine","Précédente","Écart","Évolution"],stores.map(tr)),"MAGASINS")+'</div><div class="c7">'+panel("Mouvements produits","Produits avec au moins 700 DH sur les deux semaines",table(["Produit","Cette semaine","Précédente","Écart","Évolution"],prods.map(tr)),"PRODUITS")+'</div><div class="c5">'+panel("Mouvements familles","Contributions des familles",table(["Famille","Cette semaine","Précédente","Écart","Évolution"],family.map(tr)),"FAMILLES")+'</div><div class="c12">'+panel("Déplacement des heures de vente","Les horaires concernés par les changements",table(["Heure","Cette semaine","Précédente","Écart","Évolution"],hours.map(x=>tr({...x,name:x.name+"h"}))),"HORAIRES")+'</div></div>'+
 '<div class="toolrow"><button id="downloadWeekly">↧ Exporter le Weekly Pulse</button></div><div class="notice">Les deux semaines sont comparées à horaires calendaires identiques, mais ne sont pas corrigées des fermetures, ruptures, événements ou disponibilité menu. Un changement de vente ne suffit pas à conclure sur la cause. Attention : le filtre de dates historique n’affecte pas le Weekly Pulse, qui porte toujours sur les deux dernières semaines entièrement achevées.</div>';
 $("#downloadWeekly").onclick=()=>exportCSV("venezia-weekly-pulse-"+w.b+".csv",["Dimension","Libellé","Semaine récente","Semaine précédente","Ecart MAD"],[...stores.map(x=>["Magasin",x.name,x.now,x.was,x.now-x.was]),...family.map(x=>["Famille",x.name,x.now,x.was,x.now-x.was]),...prods.map(x=>["Produit",x.name,x.now,x.was,x.now-x.was]),...hours.map(x=>["Heure",x.name,x.now,x.was,x.now-x.was])]);
}
function peerData(){const key=[M.start,M.end,M.family,M.category].join("|");if(M._peerKey!==key){M._peer=baseAgg(M.rows.filter(r=>(!M.family||r[3]===M.family)&&(!M.category||r[4]===M.category)&&r[1]>=M.start&&r[1]<=M.end));M._peerKey=key}return M._peer}
function opportunityCandidates(){
 const a=peerData();const result=[];
 const stores=[...a.stores.keys()].filter(s=>(!M.store||s===M.store)&&(a.storeDays.get(s)?.size||0)>=28&&a.stores.get(s)>=100000);
 const productTotals=new Map([...a.products].map(x=>[x[0],x[1].rev]));
 const famTotals=new Map(a.families);
 for(const st of stores){
  const rev=a.stores.get(st)||0,otherRev=a.rev-rev;if(otherRev<250000)continue;
  for(const [f,global] of famTotals){
   const val=a.storeFamily.get(st+sep+f)||0,peerVal=global-val,localMix=val/rev,peerMix=peerVal/otherRev,index=peerMix?localMix/peerMix:1;
   if(peerVal>30000&&peerMix>=0.045&&val>=2000&&index<0.72)result.push({kind:"Famille",store:st,item:f,actual:val,mix:localMix,peer:peerMix,index,gap:(peerMix-localMix)*rev,support:1});
  }
  for(const [prod,global] of productTotals){
   const v=a.storeProduct.get(st+sep+prod)?.rev||0,peerVal=global-v,coverage=(a.productStores.get(prod)?.size||0)-(v>0?1:0),localMix=v/rev,peerMix=peerVal/otherRev,index=peerMix?localMix/peerMix:1;
   if(coverage>=3&&v>=250&&peerVal>=15000&&peerMix>=0.01&&index<0.58)result.push({kind:"Produit",store:st,item:prod,actual:v,mix:localMix,peer:peerMix,index,gap:(peerMix-localMix)*rev,support:coverage});
  }
 }
 result.sort((x,y)=>y.gap-x.gap);
 return result;
}
function opportunitiesPage(){
 labels("Opportunités sous surveillance","Sous-indexation locale, preuves de vente, comparabilité et actions commerciales testables.");
 const a=present(),items=opportunityCandidates(),fam=items.filter(x=>x.kind==="Famille"),prod=items.filter(x=>x.kind==="Produit");
 const rows=items.slice(0,80).map(x=>'<tr><td><b>'+escape(x.store)+'</b></td><td><span class="mixMarker '+(x.kind==="Produit"?"low":"")+'">'+escape(x.kind)+'</span></td><td>'+escape(x.item)+'</td><td class="r">'+pct(100*x.mix)+'</td><td class="r">'+pct(100*x.peer)+'</td><td class="r">'+p1.format(x.index)+'×</td><td class="r">'+mad(x.gap)+'</td><td><button class="btn" style="padding:5px 8px;font-size:10px" data-create="'+escape(x.store+" : examiner "+x.item)+'">Tester →</button></td></tr>');
 const leaders=items.slice(0,3).map((x,i)=>tile("PRIORITÉ "+(i+1)+" · "+x.kind,x.store+" · "+x.item,"Poids local "+pct(x.mix*100)+" vs "+pct(x.peer*100)+" autres magasins ; indice "+p1.format(x.index)+"×. Vérifier le listing, les stocks et la clientèle avant un test.",true)).join("");
 C.innerHTML=metricRow([metric("Hypothèses identifiées",num(items.length),"Avec seuils de sélection","◎"),metric("Familles sous-indexées",num(fam.length),"Mix plus faible que les pairs","↘"),metric("Produits à investiguer",num(prod.length),"Vendus localement et chez ≥ 3 pairs","★"),metric("Magasins analysés",num(new Set(items.map(x=>x.store)).size),"Au moins 28 jours avec ventes","⌂")])+
 '<div class="fineGrid"><div class="c12">'+panel("Des pistes de terrain priorisées","Basées sur les écarts de mix entre magasins, pas sur une marge estimée",'<div class="insights">'+(leaders||tile("AUCUN SIGNAL","Pas de sous-indexation significative détectée","Les seuils sont volontairement prudents pour éviter les faux positifs."))+'</div>',"RECOMMANDATIONS")+'</div><div class="c12">'+panel("Matrice des opportunités","Écart de mix théorique en DH = (mix des pairs − mix local) × CA du magasin",table(["Magasin","Niveau","Produit / famille","Mix local","Mix pairs","Indice","Écart théorique","Action"],rows),"OPPORTUNITÉS")+'</div></div>'+
 '<div class="notice"><b>Important :</b> l’écart théorique est un indicateur de taille de l’écart, <b>pas une prévision de gains</b>. La sous-indexation peut s’expliquer par le format, la saison, la disponibilité, l’assortiment ou les prix. Les produits absents localement sont volontairement exclus ; leur absence de vente ne prouve pas qu’ils soient référencés.</div>';
 $$("[data-create]").forEach(b=>b.onclick=()=>createAction(b.dataset.create));
 $$(".addAction").forEach(b=>b.onclick=()=>createAction(b.dataset.title));
}
async function createAction(title){
 let store=M.store||title.split(" :")[0]||"",action={id:Date.now(),date:new Date().toISOString().slice(0,10),title,store,owner:"",status:"À investiguer",result:"",note:"Hypothèse identifiée par analyse de mix, à vérifier en magasin."};
 M.actions.push(action);await save("actions",M.actions);alert("Action créée dans le plan d’action.");view("actions");
}
function actionsPage(){
 labels("Plans d’action : pilotez le résultat","De la donnée à la décision et de la décision à la mesure réelle.");
 const stages=["À investiguer","À tester","En cours","Mesuré","Clôturé"];
 let rows=M.actions.slice().reverse().map(x=>'<tr><td>'+escape(x.date?.slice(0,10)||"—")+'</td><td><b>'+escape(x.title)+'</b></td><td>'+escape(x.store||"Réseau")+'</td><td>'+escape(x.owner||"—")+'</td><td><select class="miniSelect state" data-id="'+escape(x.id)+'">'+stages.map(y=>'<option '+(x.status===y?"selected":"")+'>'+y+'</option>').join("")+'</select></td><td><button class="editOutcome" style="border:0;background:none;color:#7450cd;cursor:pointer;font-weight:800" data-id="'+escape(x.id)+'">'+escape(x.result||"Mesurer →")+'</button></td></tr>');
 C.innerHTML=metricRow([metric("Actions suivies",num(M.actions.length),"Journal commun avec l’analyse avancée","✓"),metric("En cours",num(M.actions.filter(x=>x.status==="En cours").length),"En exécution","↗"),metric("À investiguer",num(M.actions.filter(x=>x.status==="À investiguer").length),"À cadrer","◎"),metric("Mesurées",num(M.actions.filter(x=>x.status==="Mesuré").length),"Résultat documenté","★")])+
 '<div class="fineGrid"><div class="c6">'+panel("Créer une action","Responsable, hypothèse et point de contrôle",'<form id="newAction"><input class="control" required name="title" placeholder="Ex : tester le petit-déjeuner à Marrakech" style="width:100%;margin-bottom:10px"><select class="control" name="store" style="width:100%;margin-bottom:10px"><option value="">Réseau</option>'+[...M.unfiltered.stores.keys()].sort().map(x=>'<option>'+escape(x)+'</option>').join("")+'</select><input class="control" name="owner" placeholder="Responsable" style="width:100%;margin-bottom:10px"><button class="btn" type="submit">Créer et suivre →</button></form>',"SUIVI")+'</div><div class="c6">'+panel("Mesurez vraiment le résultat","Sans promesse de causalité",tile("PROTOCOLE","Avant / après sur semaines équivalentes","Noter l’action, sa date, le magasin, le produit, les jours d’ouverture et les événements locaux.")+tile("GARDE-FOU","Éviter les faux gains","Un changement peut venir de la météo, des stocks, de la promotion ou de la saison. Comparer un témoin comparable si possible."),"MÉTHODE")+'</div><div class="c12">'+panel("Registre des décisions","Cliquer Mesurer pour noter un résultat",table(["Date","Action","Magasin","Pilote","Statut","Résultat"],rows),"WORKFLOW")+'</div></div>';
 $("#newAction").onsubmit=async e=>{e.preventDefault();let f=new FormData(e.currentTarget);M.actions.push({id:Date.now(),date:new Date().toISOString().slice(0,10),title:String(f.get("title")),store:String(f.get("store")),owner:String(f.get("owner")),status:"À investiguer",result:""});await save("actions",M.actions);actionsPage()};
 $$(".state").forEach(s=>s.onchange=async()=>{let x=M.actions.find(a=>String(a.id)===s.dataset.id);if(x){x.status=s.value;await save("actions",M.actions)}});
 $$(".editOutcome").forEach(s=>s.onclick=async()=>{let x=M.actions.find(a=>String(a.id)===s.dataset.id);if(!x)return;let note=prompt("Résultat du test, observation ou prochaine mesure :",x.result||"");if(note!==null){x.result=note;await save("actions",M.actions);actionsPage()}});
}
function qualityPage(){
 labels("Fiabilité des données","Un indicateur n’a de valeur que si sa source et ses limites sont maîtrisées.");
 const a=M.unfiltered;const imported=window._fineImports||[],diffs=[["Magasins",a.rev,[...a.stores.values()].reduce((x,y)=>x+y,0)],["Produits",a.rev,[...a.products.values()].reduce((x,y)=>x+y.rev,0)],["Familles",a.rev,[...a.families.values()].reduce((x,y)=>x+y,0)],["Dates",a.rev,[...a.daily.values()].reduce((x,y)=>x+y,0)]];
 let anomalies=[];for(const [st,dates] of a.storeDays){const series=[...a.storeDay].filter(x=>x[0].startsWith(st+sep)).map(x=>[x[0].split(sep)[1],x[1]]).sort((x,y)=>x[1]-y[1]);if(series.length<14)continue;const med=series[Math.floor(series.length/2)][1];for(const [date,v] of series.filter(x=>x[1]>Math.max(10000,med*3.2)).sort((a,b)=>b[1]-a[1]).slice(0,3)) anomalies.push([st,date,v,med]);}anomalies.sort((a,b)=>b[2]-a[2]);
 C.innerHTML=metricRow([metric("Lignes d'origine",num(a.lines),"Après périmètre Venezia","▤"),metric("Lignes à prix nul",pct(dot(a.lines,a.zero)),"Possible formule / gratuité","◈"),metric("Coûts à zéro",pct(dot(a.lines,a.cost)),"Marge non publiable","◎"),metric("Horaires non valides",num(a.invalid),"Lignes sans heure fiable","◷")])+
 '<div class="fineGrid"><div class="c6">'+panel("Reconciliation financière","Tout niveau doit totaliser le CA source",table(["Contrôle","CA calculé","Différence"],diffs.map(x=>'<tr><td>'+escape(x[0])+'</td><td class="r">'+mad(x[2])+'</td><td class="r">'+(Math.abs(x[1]-x[2])<0.05?'<span class="positive">OK</span>':'<span class="negative">'+mad(x[1]-x[2])+'</span>')+'</td></tr>')),"CONTRÔLES")+'</div><div class="c6">'+panel("Historique des imports","Traçabilité des derniers fichiers importés",table(["Date","Fichier","Lignes source"],imported.slice(-10).reverse().map(x=>'<tr><td>'+escape((x.date||"").slice(0,10))+'</td><td>'+escape(x.name||"—")+'</td><td class="r">'+num(x.lines||0)+'</td></tr>')),"IMPORTS")+'</div><div class="c12">'+panel("Journées atypiques à vérifier","CA observé > 3,2 × médiane magasin ET > 10 000 DH ; ce n’est pas une anomalie confirmée",table(["Magasin","Jour","CA","Médiane des jours vendus"],anomalies.slice(0,40).map(x=>'<tr><td>'+escape(x[0])+'</td><td>'+escape(x[1])+'</td><td class="r">'+mad(x[2])+'</td><td class="r">'+mad(x[3])+'</td></tr>')),"ALERTES QUALITÉ")+'</div></div>'+
 '<div class="notice">Les exports ne donnent pas des coûts suffisamment complets pour calculer des marges fiables. Les identifiants de tickets demandent vérification avant calcul du panier moyen. Les écarts > 3,2× peuvent être de véritables événements commerciaux, et ne doivent pas être supprimés automatiquement.</div>';
}
function empty(){
 $("#filters").style.display="none";labels("Analyse de précision","Connectez une fois votre historique pour aller au produit, à l’heure, au magasin et à la semaine.");
 C.innerHTML='<div class="fineEmpty"><div class="eyebrow" style="color:#7658c8">VENEZIA ICE · PRÉCISION</div><h2>Une lecture à la finesse demande les lignes de vente.</h2><p>Le tableau de bord exécutif est préchargé avec une synthèse historique chiffrée. Pour approfondir les journées, heures, familles et produits de chaque magasin, importez <b>une seule fois</b> votre export CSV historique dans le module d’analyse avancée. Les rapports hebdomadaires enrichiront ensuite les calculs sans double comptage.</p><a class="btn" href="./advanced.html">Importer mon historique Venezia →</a><p style="font-size:11px;margin-top:20px">Vos ventes restent sur cet appareil, et ne sont pas publiées sur GitHub ou Netlify.</p></div>';
}

async function decryptPack(path,pass){
 if(!crypto?.subtle)throw Error("La page doit être ouverte en HTTPS.");
 const r=await fetch(path,{cache:"force-cache"});if(!r.ok)throw Error("Impossible de charger le jeu de données chiffré (HTTP "+r.status+").");
 const data=Uint8Array.from(atob((await r.text()).trim()),x=>x.charCodeAt(0)),salt=data.slice(0,16),iv=data.slice(16,28),cipher=data.slice(28);
 const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass),"PBKDF2",false,["deriveKey"]);
 const k=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:250000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["decrypt"]);
 const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv},k,cipher);
 return JSON.parse(await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream("deflate"))).text());
}
function previewUnlock(error=""){
 $("#filters").style.display="none";labels("Analyse de précision","L’historique est déjà disponible sous forme chiffrée.");
 C.innerHTML='<div class="fineEmpty"><div class="eyebrow" style="color:#7555c9">VENEZIA ICE · ACCÈS AUX CHIFFRES</div><h2>Vos analyses détaillées sont préchargées.</h2><p>Les ventes historiques ont été préparées et chiffrées. Utilisez la même clé privée que dans la Vue Direction pour explorer immédiatement les performances par magasin, horaire, famille et semaine. Aucun CSV à importer pour cette première lecture.</p><form id="previewPass"><input class="control" type="password" id="previewKey" required autocomplete="off" placeholder="Clé privée de déchiffrement" style="width:min(400px,100%);padding:12px"><button class="btn" type="submit" style="margin:8px">Afficher mes données →</button></form><p id="keyErr" style="font-size:11px;color:#d55270">'+escape(error)+'</p></div>';
 $("#previewPass").onsubmit=async e=>{e.preventDefault();$("#keyErr").textContent="Déchiffrement…";let key=$("#previewKey").value.trim();try{await loadPreview(key);sessionStorage.setItem("venezia_session",key);view("command")}catch(err){$("#keyErr").textContent="Impossible de déchiffrer : "+err.message}};
}
async function loadPreview(key){
 const [fine,summary]=await Promise.all([decryptPack("./secure-finesse.enc",key),decryptPack("./secure-summary.enc",key)]);
 if(fine.version!==1||summary.v!==5||fine.stores.length!==summary.stores.length)throw Error("Format historique inattendu");
 M.preview={fine,summary};M.min="2026-06-01";M.max="2026-10-12";M.start=M.min;M.end=M.max;M.store="";M.family="";M.category="";
 M.unfiltered={stores:new Map(summary.stores.map(x=>[x[0],x[1]]))};
 $("#fStore").innerHTML='<option value="">Tout le réseau</option>'+fine.stores.map(s=>'<option>'+escape(s)+'</option>').join("");
 $("#fFamily").innerHTML='<option value="">Toutes les familles</option>';$("#fFamily").disabled=true;$("#fCategory").disabled=true;$("#fCategory").title="Filtre catégorie disponible après import complet";$("#fFamily").title="Filtre famille disponible après import de détail";
 $("#fStart").value=M.min;$("#fEnd").value=M.max;$("#fStore").value="";
 $("#dataStatus").textContent="● Historique chiffré chargé";$("#dateStatus").textContent="01/06 → 12/10/2026";$("#filters").style.display="flex";
}
function previewStoreIndex(){return M.preview?.fine?.stores?.indexOf(M.store)??-1}
function pRows(source,idx=0){const a=M.preview.fine[source]||[],k=previewStoreIndex();return a.filter(x=>k<0||x[idx]===k)}
function pDates(){return pRows("daily").map(x=>[shift(M.preview.fine.start,x[1]),x[2],x[3],M.preview.fine.stores[x[0]]]).filter(x=>x[0]>=M.start&&x[0]<=M.end)}
function pStoreTotal(){return pDates().reduce((a,x)=>a+x[1],0)}
function pWk(){const k=previewStoreIndex(),a=M.preview.summary.weeklyStore;return [a.filter(x=>x[0]===0&&(k<0||x[1]===M.store)).reduce((t,x)=>t+x[2],0),a.filter(x=>x[0]===1&&(k<0||x[1]===M.store)).reduce((t,x)=>t+x[2],0)]}
function pProds(){const d=M.preview.summary;return M.store?d.storeProducts.filter(x=>x[0]===M.store).map(x=>[x[1],x[2],x[3]]):d.globalProducts}
function pFamilies(){const d=M.preview.summary;return M.store?d.storeFamily.filter(x=>x[0]===M.store).map(x=>[x[1],x[2]]):d.familyGlobal}
function previewNotice(){return '<div class="notice"><b>Historique préchargé :</b> CA, jours, heures, catégories et évolution issus de vos données réelles. Le filtre de dates agit ici uniquement sur le CA quotidien et le benchmark des magasins ; les produits, familles, heures et semaines restent sur leurs périodes historiques définies. Les tops produits préchargés sont limités aux 24 premiers du réseau et aux 8 premiers par magasin. Les analyses sur tous les produits, le filtre famille et les futurs CSV sont disponibles après import du rapport détaillé via <a href="./advanced.html" style="color:#6b4ac2;font-weight:800">Imports CSV</a>.</div>'}
function pHour(){const k=previewStoreIndex();return k<0?M.preview.summary.hourly.map(x=>[Number(x[0]),x[1]]):pRows("storeHour").map(x=>[Number(x[1]),x[2]])}
function pBarsHour(){const raw=new Map(pHour()),max=Math.max(1,...raw.values());return '<div class="hourchart">'+Array.from({length:24},(_,h)=>{const v=raw.get(h)||0;return '<div class="houritem" title="'+h+"h : "+mad(v)+'"><div class="hourcolumn" style="height:'+Math.max(2,v/max*160)+'px"></div><small>'+(h%3===0?h+"h":"")+'</small></div>'}).join("")+'</div>'}
function pWeekCategory(key,storeSpecific=true){
 const d=M.preview.summary;const k=previewStoreIndex();let out;
 if(k<0||!storeSpecific){out=d[key==="family"?"weeklyFamily":"weeklyProduct"].map(x=>[x[0],x[1],x[2]])}
 else {out=pRows(key==="family"?"storeWeeklyFamily":"storeWeeklyProduct").map(x=>[x[1],x[2],x[3]])}
 const old=new Map(out.filter(x=>x[0]===0).map(x=>[x[1],x[2]])),now=new Map(out.filter(x=>x[0]===1).map(x=>[x[1],x[2]]));
 return [...new Set([...old.keys(),...now.keys()])].map(name=>({name,now:now.get(name)||0,was:old.get(name)||0})).sort((a,b)=>Math.abs(b.now-b.was)-Math.abs(a.now-a.was));
}
function previewOverview(){
 labels("Command Center · précis","Chiffres historiques déjà intégrés : jours, magasins, familles, produits, semaine.");
 const d=M.preview.summary,rows=pDates(),tot=pStoreTotal(),w=pWk(),f=pFamilies(),prods=pProds(),rev=[...new Map(rows.map(x=>[x[0],0]))];
 const daily=new Map();for(const [date,sale] of rows)kv(daily,date,sale);
 const weak=pWeekCategory("product").filter(x=>x.was>=1500&&x.now<x.was*.6).slice(0,3),best=f[0];
 C.innerHTML=metricRow([metric("CA enregistré",mad(tot),"Période des dates sélectionnées"),metric("Magasins",num(M.store?1:d.stores.length),"Données Venezia","⌂"),metric("Ventes dernier 7j",mad(w[1]),"05–11 octobre","◈"),metric("Dynamique 7j",w[0]?pct(diff(w[1],w[0])):"—","Comparaison semaine précédente","↗")])+
 '<div class="fineGrid"><div class="c7">'+panel("CA quotidien","Évolution filtrable jour par jour, tous magasins ou un magasin",compactTrend(daily),"134 JOURS")+'</div><div class="c5">'+panel("Les familles qui construisent le CA","Composition des ventes historiques du magasin",bars(f,9),"MIX")+'</div><div class="c6">'+panel("Tops produits","Produits les plus importants dans ce magasin",bars(prods.map(x=>[x[0],x[1]]),12),"TOP CA")+'</div><div class="c6">'+panel("Tops magasins","CA historique par magasin",bars(d.stores.map(x=>[x[0],x[1]]),10),"RÉSEAU")+'</div><div class="c12">'+panel("Trois signaux direction","Constats chiffrés avec points de contrôle",'<div class="insights">'+tile("MIX LEADER",best?.[0]||"—","Première famille sur le périmètre du magasin.")+tile("DERNIÈRE SEMAINE","Variation CA : "+(w[0]?pct(diff(w[1],w[0])):"sans base"),"5–11 octobre vs 28 septembre–4 octobre, sans attribution de cause.")+tile("PRODUITS EN RETRAIT",weak[0]?.name||"Aucun sur top visible",weak[0]?"Recul de "+mad(weak[0].now-weak[0].was)+" entre deux semaines. Vérifier stock, promo et exposition.":"Aucun signal significatif dans les produits préchargés.")+'</div>',"INSIGHTS")+'</div></div>'+previewNotice();
}
function previewStores(){
 labels("Benchmark des magasins","Mêmes journées, mêmes métriques ; les mixes restent sur le total historique.");
 const f=M.preview.fine;let grouped=new Map();
 for(const [ix,days,ca] of f.daily){const st=f.stores[ix],date=shift(f.start,days);if(date<M.start||date>M.end||M.store&&st!==M.store)continue;let a=grouped.get(st);if(!a){a={rev:0,days:0};grouped.set(st,a)}a.rev+=ca;a.days++}
 const rows=[...grouped].map(([name,x])=>({name,rev:x.rev,days:x.days,avg:x.rev/x.days})).sort((a,b)=>b.avg-a.avg);
 const html=rows.map((x,i)=>'<tr><td>'+num(i+1)+'</td><td><b>'+escape(x.name)+'</b></td><td class="r">'+mad(x.rev)+'</td><td class="r">'+num(x.days)+'</td><td class="r">'+mad(x.avg)+'</td></tr>');
 const wd=pRows("storeWeekday").map(x=>[dayNames[x[1]],x[2]]);
 const wdmap=new Map();for(const [name,ca] of wd)kv(wdmap,name,ca);
 C.innerHTML=metricRow([metric("Points analysés",num(rows.length),"Présence de ventes"),metric("CA sélection",mad(rows.reduce((a,x)=>a+x.rev,0)),"Période commune","↗"),metric("Meilleur CA par jour",mad(rows[0]?.avg||0),"Jours avec ventes seulement","★"),metric("Dernière semaine",mad(pWk()[1]),"Périmètre magasin","◷")])+
 '<div class="fineGrid"><div class="c12">'+panel("Classement normalisé","Jours avec ventes observées, horaires réels à vérifier",table(["#","Magasin","CA","Jours vendus","CA / jour"],html),"BENCHMARK")+'</div><div class="c6">'+panel("Top catégories locales","Catégories historiques en CA",bars(pRows("storeCategory").map(x=>[x[1],x[2]]).sort((a,b)=>b[1]-a[1]),12),"CATÉGORIES")+'</div><div class="c6">'+panel("Jour de semaine : ventes","CA par jour de semaine, non normalisé par ouverture",bars(rank(wdmap),7),"MIX SEMAINE")+'</div></div>'+previewNotice();
}
function previewProducts(){
 labels("Tops et signaux produits","Pour chaque magasin : tops historiques, quantité payée et reculs hebdomadaires.");
 const p=pProds(),tot=M.store?M.preview.summary.stores.find(x=>x[0]===M.store)?.[1]:M.preview.summary.overall[0],week=pWeekCategory("product");
 const leaders=p.map((x,i)=>'<tr><td>'+num(i+1)+'</td><td><b>'+escape(x[0])+'</b></td><td class="r">'+mad(x[1])+'</td><td class="r">'+num(x[2])+'</td><td class="r">'+pct(100*x[1]/Math.max(1,tot))+'</td></tr>');
 const movements=week.slice(0,26).map(x=>'<tr><td><b>'+escape(x.name)+'</b></td><td class="r">'+mad(x.now)+'</td><td class="r">'+mad(x.was)+'</td><td class="r">'+arrow(diff(x.now,x.was))+'</td></tr>');
 const parts=["Matin < 12h","12–18h","Après 18h"],topParts=pRows("topProductHour").filter(x=>p.some(z=>z[0]===x[1])).sort((a,b)=>b[3]-a[3]).slice(0,18).map(x=>'<tr><td>'+escape(M.preview.fine.stores[x[0]])+'</td><td>'+escape(x[1])+'</td><td>'+escape(parts[x[2]])+'</td><td class="r">'+mad(x[3])+'</td></tr>');
 C.innerHTML=metricRow([metric("Leader",p[0]?.[0]||"—","Produit à plus gros CA","★"),metric("CA leader",mad(p[0]?.[1]||0),"Historique total","↗"),metric("Qté leader",num(p[0]?.[2]||0),"Lignes facturées > 0 DH","◈"),metric("Top 5 poids CA",pct(100*p.slice(0,5).reduce((a,x)=>a+x[1],0)/(tot||1)),"Concentration historique","◎")])+
 '<div class="fineGrid"><div class="c7">'+panel("Tops produit : CA et quantité","La sélection de magasin modifie le ranking",table(["#","Produit","CA","Qté payée","Part CA"],leaders),"TOPS")+'</div><div class="c5">'+panel("Mouvements cette semaine","Top produits des deux dernières semaines",table(["Produit","CA récent","Précédent","Δ"],movements),"DYNAMIQUE")+'</div><div class="c12">'+panel("Produit × moment × magasin","Heures de consommation regroupées par moments de journée",table(["Magasin","Produit","Moment","CA"],topParts),"FINESSE JOURNÉE")+'</div></div>'+previewNotice();
}
function previewTime(){
 labels("Heures × magasin","Comprendre les moments de vente sans attendre le prochain fichier.");
 const hrs=pHour(),ordered=[...hrs].sort((a,b)=>b[1]-a[1]),days=pRows("storeWeekday").map(x=>[dayNames[x[1]],x[2]]),ymap=new Map();for(const [nm,ca] of days)kv(ymap,nm,ca);
 const pieces=pRows("storeFamilyHour").reduce((m,x)=>{kv(m,x[1]+sep+x[2],x[3]);return m},new Map());
 const parts=["Avant 12h","12–18h","Après 18h"],rows=rank(pieces).slice(0,24).map(x=>{let [fam,part]=x[0].split(sep);return '<tr><td>'+escape(fam)+'</td><td>'+escape(parts[Number(part)])+'</td><td class="r">'+mad(x[1])+'</td></tr>'});
 C.innerHTML=metricRow([metric("Heure leader",String(ordered[0]?.[0]??"—")+"h",mad(ordered[0]?.[1]||0),"◷"),metric("CA avant 12h",mad(hrs.filter(x=>x[0]<12).reduce((a,x)=>a+x[1],0)),"Matin","↗"),metric("CA 12–18h",mad(hrs.filter(x=>x[0]>=12&&x[0]<18).reduce((a,x)=>a+x[1],0)),"Midi après-midi","◈"),metric("CA après 18h",mad(hrs.filter(x=>x[0]>=18).reduce((a,x)=>a+x[1],0)),"Soir","★")])+
 '<div class="fineGrid"><div class="c8">'+panel("Répartition par heure","CA horaire de l’ensemble ou du magasin choisi",pBarsHour(),"24 HEURES")+'</div><div class="c4">'+panel("Top 10 créneaux","Moments les plus vendeurs",bars(ordered.map(x=>[x[0]+"h",x[1]]),10),"CRENEAUX")+'</div><div class="c6">'+panel("Famille × moment","Matrice CA par grandes plages horaires",table(["Famille","Créneau","CA"],rows),"CROISEMENT")+'</div><div class="c6">'+panel("Semaine × magasin","CA par jour de semaine du magasin",bars(rank(ymap),7),"JOURS")+'</div></div>'+previewNotice();
}
function previewPulse(){
 labels("Weekly Pulse · local","Les plus gros changements par magasin, famille et produit.");
 const w=pWk(),d=M.preview.summary,fs=pWeekCategory("family"),ps=pWeekCategory("product");
 const wstore=d.weeklyStore,old=new Map(wstore.filter(x=>x[0]===0).map(x=>[x[1],x[2]])),now=new Map(wstore.filter(x=>x[0]===1).map(x=>[x[1],x[2]]));
 const tr=x=>'<tr><td><b>'+escape(x.name)+'</b></td><td class="r">'+mad(x.now)+'</td><td class="r">'+mad(x.was)+'</td><td class="r">'+(x.now>=x.was?"+":"")+mad(x.now-x.was)+'</td><td class="r">'+arrow(diff(x.now,x.was))+'</td></tr>';
 const stores=d.stores.filter(x=>!M.store||x[0]===M.store).map(x=>({name:x[0],now:now.get(x[0])||0,was:old.get(x[0])||0}));
 C.innerHTML='<div class="statnote"><b>05–11 octobre 2026</b> versus <b>28 septembre–04 octobre 2026</b>. Les dates personnalisées ne modifient pas ce comparatif préchargé.</div>'+
 metricRow([metric("CA semaine",mad(w[1]),"05–11 octobre"),metric("CA référence",mad(w[0]),"28 sept.–04 oct.","◷"),metric("Écart en DH",(w[1]>=w[0]?"+":"")+mad(w[1]-w[0]),"Changement de CA","↗"),metric("Croissance",w[0]?pct(diff(w[1],w[0])):"—","Même durée","◎")])+
 '<div class="fineGrid"><div class="c12">'+panel("Évolution par magasin","Tous les sites Venezia",table(["Magasin","CA récent","CA précédent","Différence","Δ %"],stores.map(tr)),"NETWORK")+'</div><div class="c6">'+panel("Familles qui bougent","Classées par amplitude de variation",table(["Famille","CA récent","CA précédent","Écart","Δ %"],fs.slice(0,22).map(tr)),"FAMILLES")+'</div><div class="c6">'+panel("Produits qui bougent","Classement basé sur les meilleurs produits observés chaque semaine",table(["Produit","CA récent","CA précédent","Écart","Δ %"],ps.slice(0,24).map(tr)),"PRODUITS")+'</div></div>'+previewNotice();
}
function previewOpportunities(){
 labels("Opportunités magasin","Lecture descriptive des écarts de mix : hypothèses à tester avec le terrain.");
 const d=M.preview.summary,stores=d.stores.filter(x=>x[2]>=28&&x[1]>=100000&&(!M.store||x[0]===M.store)),result=[];
 const byFamily=new Map(d.familyGlobal);
 for(const [name,rev] of stores){for(const [fam,global] of byFamily){let local=d.storeFamily.find(x=>x[0]===name&&x[1]===fam)?.[2]||0,others=global-local,otherRev=d.overall[0]-rev,mix=local/rev,peer=others/otherRev;if(local>=3000&&peer>=.035&&mix/peer<.72){result.push({name,fam,mix,peer,gap:(peer-mix)*rev})}}}
 result.sort((a,b)=>b.gap-a.gap);
 const entries=result.slice(0,45).map(x=>'<tr><td><b>'+escape(x.name)+'</b></td><td>'+escape(x.fam)+'</td><td class="r">'+pct(x.mix*100)+'</td><td class="r">'+pct(x.peer*100)+'</td><td class="r">'+p1.format(x.mix/x.peer)+' ×</td><td><button class="btn previewAction" data-title="'+escape(x.name+" : vérifier le mix "+x.fam)+'" style="padding:6px 10px;font-size:10px">Tester</button></td></tr>');
 C.innerHTML=metricRow([metric("Hypothèses mix",num(result.length),"Familles sous représentées","◎"),metric("Périmètre",num(stores.length),"Sites comparés","⌂"),metric("Dimension","Familles","Comparaison au reste du réseau","◈"),metric("Diagnostic","À confirmer","Disponibilité, format, saison","★")])+
 '<div class="fineGrid"><div class="c12">'+panel("Sous-indexations de mix à investiguer","Part des familles dans le magasin vs les autres magasins",table(["Magasin","Famille","Mix local","Mix autres","Indice","Action"],entries),"EXPERTISE")+'</div></div>'+
 '<div class="notice">Ces écarts ne constituent ni des flops confirmés ni du chiffre d’affaires additionnel garanti. Magasins touristiques, malls, saisonnalité et politique produits peuvent expliquer les différences. Une vraie comparaison de produits exige l’import transactionnel complet.</div>';
 $(".previewAction").forEach(b=>b.onclick=()=>createAction(b.dataset.title));
}
function previewQuality(){
 labels("Qualité de la source historique","Un diagnostic commercial est aussi solide que ses données.");
 const d=M.preview.summary,f=M.preview.fine,imported=window._fineImports||[];
 const value=d.overall[0],byStore=d.stores.reduce((n,x)=>n+x[1],0),byFam=d.familyGlobal.reduce((n,x)=>n+x[1],0),checks=[["Somme magasins",byStore],["Somme familles",byFam]];
 const unusual=f.daily.map(x=>({store:f.stores[x[0]],date:shift(f.start,x[1]),rev:x[2]})).filter(x=>x.rev>=90000).sort((a,b)=>b.rev-a.rev).slice(0,12);
 C.innerHTML=metricRow([metric("Enregistrements",num(d.overall[1]),"Lignes de vente source"),metric("CA réseau",mad(value),"Montant historique","↗"),metric("Quantités payées",num(d.overall[2]),"Prix > 0","◈"),metric("Lignes zéro DH",num(d.overall[3]),"Formules et cas à vérifier","◎")])+
 '<div class="fineGrid"><div class="c6">'+panel("Contrôles des totaux","Arrondis des agrégations, tolérance 20 DH",table(["Recalcul","CA","Écart vs réseau"],checks.map(x=>'<tr><td>'+x[0]+'</td><td class="r">'+mad(x[1])+'</td><td class="r">'+(Math.abs(x[1]-value)<=20?'<span class="positive">OK</span>':'<span class="negative">'+mad(x[1]-value)+'</span>')+'</td></tr>')),"RÉCONCILIATION")+'</div><div class="c6">'+panel("Import complet","Le prochain niveau de fiabilité",tile("COÛTS", "Ne pas conclure sur la marge","Majorité des coûts d’achat nuls ; marge non publiée.")+tile("TICKETS", "Panier moyen non validé","Identifiant de ticket non démontré comme unique au niveau réseau.")+tile("ZERO PRIX", "Lignes de formules","Un produit à 0 DH peut être un élément inclus dans une formule."),"ALERTES")+'</div><div class="c12">'+panel("Journées de CA atypiquement élevé","Seuil descriptif ≥ 90 000 DH, pas une fraude démontrée",table(["Magasin","Date","CA"],unusual.map(x=>'<tr><td>'+escape(x.store)+'</td><td>'+escape(x.date)+'</td><td class="r">'+mad(x.rev)+'</td></tr>')),"VIGILANCE")+'</div></div>'+previewNotice();
}
function previewRoute(name){
 const routes={command:previewOverview,stores:previewStores,products:previewProducts,time:previewTime,pulse:previewPulse,benchmark:previewStores,opportunities:previewOpportunities,actions:actionsPage,quality:previewQuality};
 try{(routes[name]||previewOverview)()}catch(e){console.error(e);C.innerHTML='<div class="notice">Erreur de calcul : '+escape(e.message)+'. Rechargez ou ouvrez les imports détaillés.</div>'}
}

function view(name){M.tab=name;$$("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));if(!M.rows.length){if(M.preview){$("#filters").style.display="flex";const allowDates=(name==="command"||name==="stores"||name==="benchmark");$("#fStart").disabled=!allowDates;$("#fEnd").disabled=!allowDates;previewRoute(name)}else previewUnlock();return}$("#filters").style.display="flex";const routes={command,products:productsPage,time:timePage,pulse:pulsePage,benchmark:benchmarkPage,opportunities:opportunitiesPage,actions:actionsPage,quality:qualityPage};try{routes[name]()}catch(e){console.error(e);C.innerHTML='<div class="notice">Un calcul a échoué : '+escape(e.message)+'. Rechargez la page ; les données importées restent dans le navigateur.</div>'}}
async function init(){
 try{
  M.db=await openDatabase();M.rows=await read("rows")||[];M.actions=await read("actions")||[];window._fineImports=await read("imports")||[];
  if(!Array.isArray(M.rows)||!M.rows.length){const key=sessionStorage.getItem("venezia_session");if(!key){previewUnlock();return}try{await loadPreview(key);view("command")}catch(e){console.error(e);previewUnlock("Accès à la synthèse impossible : "+e.message)}return}
  M.unfiltered=baseAgg(M.rows);$("#fFamily").onchange=()=>{M.family=$("#fFamily").value;M.category="";refreshCategoryOptions()};M.min=[...M.unfiltered.dates].sort()[0]||"";M.max=[...M.unfiltered.dates].sort().slice(-1)[0]||"";M.start=M.min;M.end=M.max;
  syncFilter();updateInputs();view(M.tab);
 }catch(e){console.error(e);C.innerHTML='<div class="fineEmpty"><h2>Lecture impossible</h2><p>Impossible de charger les données locales : '+escape(e.message)+'</p><a class="btn" href="./advanced.html">Vérifier vos imports →</a></div>'}
}
$$("[data-view]").forEach(b=>b.onclick=()=>{view(b.dataset.view);window.scrollTo({top:0,behavior:"smooth"})});
$("#fApply").onclick=()=>{M.store=$("#fStore").value;M.family=$("#fFamily").value;M.category=$("#fCategory").value;M.start=$("#fStart").value||M.min;M.end=$("#fEnd").value||M.max;if(M.start>M.end){alert("La date de début doit précéder la date de fin.");return}C.innerHTML='<div class="statnote">Calcul en cours…</div>';setTimeout(()=>{if(!M.preview)syncFilter();M._peerKey=null;view(M.tab)},20)};
$("#fReset").onclick=()=>{M.store="";M.family="";M.category="";M.start=M.min;M.end=M.max;if(M.preview){$("#fStore").value="";$("#fStart").value=M.min;$("#fEnd").value=M.max}else{updateInputs();syncFilter()}M._peerKey=null;view(M.tab)};
init();
})();