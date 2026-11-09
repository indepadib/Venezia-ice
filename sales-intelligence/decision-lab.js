(function(){'use strict';
const Core=window.VeneziaDecisionCore,$=sel=>document.querySelector(sel),$$=sel=>document.querySelectorAll(sel),root=$('#content');
if(!Core){root.innerHTML='<div class="warning-box">Moteur d’analyse indisponible. Veuillez recharger la page.</div>';return}
const S={env:null,view:'cockpit',cube:null,agg:null,rows:null,week:null,actions:[],db:null,focus:-1,peer:-1,productSort:'ca',productSearch:'',opportunitySort:'gap',filters:{cohort:'historical',store:'',family:'',category:'',channel:'',from:'2026-06-01',to:'2026-10-12',part:''},exportData:null};
const euro=x=>new Intl.NumberFormat('fr-MA',{maximumFractionDigits:0}).format(Number(x)||0)+' DH';
const full=x=>new Intl.NumberFormat('fr-MA',{maximumFractionDigits:1}).format(Number(x)||0);
const integer=x=>new Intl.NumberFormat('fr-MA',{maximumFractionDigits:0}).format(Number(x)||0);
const pct=x=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(Number(x)||0)+' %';
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=m=>euro((m?.[0]||0)/100),rev=m=>Core.metrics(m).revenue;
const change=(now,was)=>was?100*(now-was)/Math.abs(was):null;
const arrow=x=>x===null?'<span class="neutral">Sans base</span>':'<span class="'+(x>=0?'positive':'negative')+'">'+(x>0?'+':'')+pct(x)+'</span>';
const str=(dim,id)=>S.env.cube.dims[dim][Number(id)]??'Inconnu';
const labelPart=i=>Core.partIds[Number(i)]||'Non renseigné';
const signed=x=>(x>=0?'+':'')+euro(x);
let toastTimer=null;
function toast(message){const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,4000)}
function card(label,value,desc){return '<div class="kpi"><span>'+safe(label)+'</span><strong>'+safe(value)+'</strong><small>'+safe(desc)+'</small></div>'}
function cards(...items){return '<div class="kpis">'+items.join('')+'</div>'}
function panel(title,subtitle,html,tag='ANALYSE'){return '<section class="panel"><div class="panel-top"><div><h3>'+safe(title)+'</h3><p class="panel-sub">'+safe(subtitle)+'</p></div><span class="micro">'+safe(tag)+'</span></div>'+html+'</section>'}
function grid(...cells){return '<div class="grid">'+cells.join('')+'</div>'}
function col(span,html){return '<div class="span'+span+'">'+html+'</div>'}
function table(columns,rows){return '<div class="scroll-table"><table><thead><tr>'+columns.map(x=>'<th>'+safe(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'}
function listBars(items,limit=10,kind='',fn=x=>euro(x)){const data=items.slice(0,limit),max=Math.max(1,...data.map(x=>Math.max(0,x[1])));return '<div class="bars">'+data.map(item=>{let label=item[0],value=item[1],click=kind&&item[2]!==undefined;return '<div class="bar-row'+(click?' clickable':'')+'" title="'+safe(label)+' : '+safe(fn(value))+'"'+(click?' data-cross="'+safe(kind)+'" data-id="'+safe(item[2])+'"':'')+'><span class="bar-label">'+safe(label)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(0,Math.min(100,100*value/max)).toFixed(1)+'%"></div></div><b class="bar-amount">'+safe(fn(value))+'</b></div>'}).join('')+'</div>'}
function trendChart(points){const data=points.slice().sort((a,b)=>a[0]-b[0]);if(!data.length)return '<div class="empty">Aucune date avec ventes</div>';
const w=850,h=240,p=29,max=Math.max(1,...data.map(x=>x[1]))*1.13,x=i=>p+i*(w-2*p)/Math.max(1,data.length-1),y=v=>h-p-(h-p*2)*v/max;
const path=data.map((v,i)=>(i?'L':'M')+x(i).toFixed(2)+' '+y(v[1]).toFixed(2)).join(' ');
let labels=data.map((v,i)=>(i===0||i===data.length-1||i%Math.max(1,Math.ceil(data.length/10))===0)?'<text x="'+x(i)+'" y="236" text-anchor="middle" fill="#9ca3b5" font-size="11">'+safe(S.env.asDate(v[0]).slice(5))+'</text>':'').join('');
let dot=data.filter((v,i)=>i%Math.max(1,Math.floor(data.length/60))===0).map(v=>{let i=data.findIndex(x=>x[0]===v[0]);return '<circle cx="'+x(i)+'" cy="'+y(v[1])+'" r="3.4" fill="#fff" stroke="#7b61cf" stroke-width="2"><title>'+safe(S.env.asDate(v[0]))+' : '+safe(euro(v[1]))+'</title></circle>'}).join('');
return '<svg width="100%" viewBox="0 0 850 245" role="img" aria-label="Évolution journalière des ventes">'+[.25,.5,.75].map(t=>'<line x1="'+p+'" x2="'+(w-p)+'" y1="'+y(max*t)+'" y2="'+y(max*t)+'" stroke="#eeedf5" stroke-dasharray="4 6"/>').join('')+'<path d="'+path+'" stroke="#7357ca" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+dot+labels+'</svg>'}
function hourChart(items){const map=new Map(items),max=Math.max(1,...map.values());return '<div class="day-chart">'+Array.from({length:24},(_,h)=>{let v=map.get(h)||0;return '<div class="day-col" title="'+h+'h : '+euro(v)+'"><div class="day-stick" style="height:'+Math.max(2,v/max*162)+'px"></div><small>'+(h%3===0?h+'h':'')+'</small></div>'}).join('')+'</div>'}
function heatGrid(rowHeaders,colHeaders,valueFn,maxVal,tooltipFn){const max=Math.max(1,maxVal);let html='<div class="heat-scroller"><div class="heat-grid" style="grid-template-columns:80px repeat('+colHeaders.length+',minmax(12px,1fr))"><span></span>'+colHeaders.map(x=>'<span>'+safe(x)+'</span>').join('');for(let i=0;i<rowHeaders.length;i++){html+='<span title="'+safe(rowHeaders[i])+'">'+safe(rowHeaders[i])+'</span>';for(let j=0;j<colHeaders.length;j++){const v=valueFn(i,j)||0,alpha=(.06+.82*Math.max(0,v)/max).toFixed(3);html+='<div class="heat-cell" style="background:rgba(111,84,202,'+alpha+')" title="'+safe(tooltipFn(i,j,v))+'"></div>'}}return html+'</div></div>'}
function note(msg,warning=false){return '<div class="'+(warning?'warning-box':'info-box')+'">'+msg+'</div>'}
function insight(t,heading,explanation,style=''){return '<div class="insight '+style+'"><span class="tag">'+safe(t)+'</span><strong>'+safe(heading)+'</strong><p>'+safe(explanation)+'</p></div>'}
function getStoreIds(){let c=S.env.cube.dims.stores,airport=S.env.airport,f=S.filters;return [...c.keys()].filter(i=>(f.cohort==='historical'?i!==airport:f.cohort==='airport'?i===airport:true))}
function scopeLabel(){const f=S.filters;return f.store||{historical:'Réseau historique · 10 magasins',airport:'Aéroport M5 uniquement',all:'11 magasins · couverture hétérogène'}[f.cohort]}
function coverageWarning(){if(S.filters.cohort==='airport')return note('<b>Couverture limitée :</b> le fichier du magasin Aéroport M5 compte 20 dates avec ventes entre le 12/10 et le 09/11. Les premières journées sont très peu représentées ; aucune conclusion sur la croissance à périmètre stable.',true);if(S.filters.cohort==='all')return note('<b>Périmètres différents :</b> les 10 magasins historiques s’arrêtent au 12/10, tandis que seul Aéroport M5 dispose de ventes jusqu’au 09/11. Ne jamais interpréter la variation d’ensemble comme une variation réseau comparable.',true);return ''}
function axisRows(map,dim,limit=10,kind=''){return Core.entries(map).slice(0,limit).map(([id,m])=>[str(dim,id),rev(m),id])}
function netDayMetrics(agg){return [...agg.storeDays.values()].reduce((n,s)=>n+s.size,0)}
function selectedCoverage(){const a=S.agg;return {storedays:netDayMetrics(a),observed:a.dates.size,stores:a.store.size}}
function factSource(){return S.env.cube.sources}
function renderCockpit(){const a=S.agg,m=Core.metrics(a.total),covered=selectedCoverage(),leaders=Core.rankProducts(a),family=Core.entries(a.family),weekly=S.week,daily=Core.entries(a.day,0,false).map(([id,mm])=>[id,rev(mm)]);
 const sourceText=S.filters.cohort==='historical'?'Historique principal · 01/06–12/10/2026':S.filters.cohort==='airport'?'Aéroport M5 · 12/10–09/11/2026':'Périmètre combiné · périodes non synchronisées';
 const best=leaders[0];const risk=Core.insightSignals(S.env,S.filters,a,weekly);
 const anchor=family[0],part=Core.entries(a.part)[0];
 const hero='<section class="hero"><div class="hero-copy"><span class="hero-kicker">COMMAND CENTER / '+safe(scopeLabel())+'</span><h2>Comprendre les ventes.<br>Décider à la finesse.</h2><p>'+safe(sourceText)+'. Analyse multidimensionnelle avec décomposition du CA, performance locale et contrôles de comparabilité.</p></div><div class="hero-metric"><small>CHIFFRE D’AFFAIRES ENREGISTRÉ</small><strong>'+euro(m.revenue)+'</strong><small>'+integer(covered.stores)+' magasin(s) observé(s) · '+integer(covered.observed)+' date(s) avec ventes</small></div></section>';
 const perf=cards(card('CA enregistré',euro(m.revenue),'Montant net du périmètre'),card('Unités payées',full(m.paidQuantity),'Lignes de vente à prix positif'),card('CA par jour-magasin',covered.storedays?euro(m.revenue/covered.storedays):'—','Jours avec ventes, non jours ouverts'),card('Poids des 10 leaders',pct(leaders.slice(0,10).reduce((n,p)=>n+p.metrics.revenue,0)/(m.revenue||1)*100),'Concentration des produits'));
 const risks='<div class="insights">'+[
 insight('FAMILLE LEADER',str('families',anchor?.[0]),anchor?pct(100*anchor[1][0]/(a.total[0]||1))+' du CA de la sélection.':'Aucune vente.', 'success'),
 insight('MOMENT FORT',part?Core.partIds[part[0]]:'—',part?euro(rev(part[1]))+' enregistrés pour ce moment de journée.':'Aucune heure exploitable.'),
 insight('COMPARABILITÉ',weekly.comparable?integer(weekly.eligible.length)+' magasins comparables':'Comparaison à examiner',weekly.comparable?'Au moins 5 dates avec ventes pour chacun des deux intervalles de 7 jours.':'Pas de magasins remplissant le seuil de couverture.', 'risk')
 ].join('')+'</div>';
 const dailyPanel=panel('Trajectoire des ventes','Évolution par jour · passage au détail sur une date identique',trendChart(daily),'TENDANCE');
 const familyPanel=panel('Quels univers construisent le CA ?','Familles, clic pour filtrer',listBars(axisRows(a.family,'families',10),10,'family'),'MIX PRODUIT');
 const productsPanel=panel('Bestsellers','Classement par CA · cliquez pour le Produit 360',listBars(leaders.slice(0,12).map(x=>[str('products',x.id),x.metrics.revenue,x.id]),12,'product'),'TOP 12');
 const storesPanel=panel('Contributions par magasin','CA cumulé et non CA par jour vendu',listBars(axisRows(a.store,'stores',11),11,'store'),'RÉSEAU');
 const signalPanel=panel('Signaux qui méritent une décision','Faits observés, hypothèses séparées',risk.length?'<div class="report-list">'+risk.slice(0,5).map(x=>'<div class="report-item"><span class="pill '+(x.level==='high'?'alert':'')+'">'+safe(x.type)+'</span><h4>'+safe(x.title)+'</h4><p>'+safe(x.evidence)+' '+safe(x.action)+'</p></div>').join('')+'</div>':'<div class="empty">Aucun signal dépassant les seuils prudents.</div>','INSIGHTS');
 return hero+coverageWarning()+perf+grid(col(7,dailyPanel),col(5,familyPanel),col(6,productsPanel),col(6,storesPanel),col(12,panel('Trois constats immédiatement exploitables','Indices descriptifs calculés sur les ventes',risks,'LECTURE DIRECTION')),col(12,signalPanel))+note('Les produits et les familles sont analysés en valeur nette enregistrée. Le prix moyen facturé utilise uniquement les lignes à prix positif. Le coût d’achat n’est pas assez fiable pour calculer la marge.');
}
function rankRow(item,idx,allRevenues){const id=item.id,m=item.metrics,share=100*m.revenue/(allRevenues||1);return '<tr><td>'+integer(idx+1)+'</td><td><button class="click-text" data-focus="'+id+'">'+safe(str('products',id))+'</button></td><td class="r">'+euro(m.revenue)+'</td><td class="r">'+full(m.paidQuantity)+'</td><td class="r">'+pct(share)+'</td><td class="r">'+pct(item.cumulative)+'</td><td><span class="pill">'+item.group+'</span></td></tr>'}
function renderProducts(){const a=S.agg,m=Core.metrics(a.total);let fullList=Core.rankProducts(a),rows=fullList;
 if(S.productSearch)rows=rows.filter(x=>str('products',x.id).toLowerCase().includes(S.productSearch.toLowerCase()));
 if(S.productSort==='volume')rows=rows.slice().sort((x,y)=>y.metrics.paidQuantity-x.metrics.paidQuantity);
 const base=fullList.reduce((n,x)=>n+x.metrics.revenue,0),shareA=fullList.filter(x=>x.group==='A').reduce((n,x)=>n+x.metrics.revenue,0),shareB=fullList.filter(x=>x.group==='B').reduce((n,x)=>n+x.metrics.revenue,0),shareC=fullList.filter(x=>x.group==='C').reduce((n,x)=>n+x.metrics.revenue,0);
 const positive=fullList.filter(x=>x.metrics.revenue>0);const low=positive.slice(-15).reverse();
 const focus=Number.isInteger(S.focus)&&S.focus>=0&&a.product.has(S.focus)?S.focus:fullList[0]?.id??-1;
 S.focus=focus;const productMetric=focus>=0?Core.metrics(a.product.get(focus)):null;
 const acrossStores=Core.entries(a.store).map(([s,m])=>{const pm=a.storeProduct.get(s+'|'+focus);const v=Core.metrics(pm);return{id:s,name:str('stores',s),revenue:v.revenue,qty:v.paidQuantity,share:m[0]?100*(pm?.[0]||0)/m[0]:0,price:v.paidQuantity>0?v.paidRevenue/v.paidQuantity:null,days:a.productStoreDays.get(s+'|'+focus)?.size||0}}).filter(x=>x.revenue!==0).sort((x,y)=>y.revenue-x.revenue);
 const salesByDay=[...a.productDay].filter(x=>x[0].startsWith(focus+'|')).map(x=>[Number(x[0].split('|')[1]),rev(x[1])]);
 const names=fullList.length;
 let headline=cards(card('Produits avec CA positif',integer(names),'Produits distincts'),card('Classe A',integer(fullList.filter(x=>x.group==='A').length),pct(base?100*shareA/base:0)+' du CA produits positifs'),card('Classe B',integer(fullList.filter(x=>x.group==='B').length),pct(base?100*shareB/base:0)+' du CA produits positifs'),card('Classe C',integer(fullList.filter(x=>x.group==='C').length),pct(base?100*shareC/base:0)+' du CA produits positifs'));
 const list=panel('Classement exhaustif','CA, volume, part, cumul et segmentation ABC',
 '<div class="controls"><input id="prodSearch" placeholder="Rechercher un produit" value="'+safe(S.productSearch)+'" style="flex:1;min-width:150px"><select id="prodSort"><option value="ca"'+(S.productSort==='ca'?' selected':'')+'>CA décroissant</option><option value="volume"'+(S.productSort==='volume'?' selected':'')+'>Volume payé</option></select></div>'+
 table(['Rang','Produit','CA','Qté payée','Part CA','Part cumulée','ABC'],rows.slice(0,250).map(x=>rankRow(x,fullList.indexOf(x),base))), 'PRODUCT INTELLIGENCE');
 const priceRows=acrossStores.map(x=>'<tr><td>'+safe(x.name)+'</td><td class="r">'+euro(x.revenue)+'</td><td class="r">'+full(x.qty)+'</td><td class="r">'+pct(x.share)+'</td><td class="r">'+(x.price!==null?euro(x.price):'—')+'</td></tr>');
 const focusPanel=panel('Produit 360 · '+str('products',focus),'Performance locale, prix facturé, évolution par date',
 cards(card('CA produit',euro(productMetric?.revenue||0),'Net enregistré'),card('Qté payée',full(productMetric?.paidQuantity||0),'Prix positif'))+
 '<div class="pills"><span class="pill green">'+integer(acrossStores.length)+' magasin(s) avec ventes</span><span class="pill">Poids CA : '+pct(m.revenue?100*(productMetric?.revenue||0)/m.revenue:0)+'</span></div>'+
 '<h3>CA quotidien du produit</h3>'+trendChart(salesByDay)+
 '<h3>Par magasin</h3>'+table(['Magasin','CA','Qté payée','Part locale','Prix réalisé*'],priceRows)+
 '<p class="muted">*Prix réalisé = CA des lignes à prix positif / quantités payées. Pour Aéroport M5, la ventilation des prix positifs est reconstituée à partir d’agrégats et reste indicative.</p>','DRILL DOWN');
 const tail=panel('Produits à faible contribution','À investiguer, jamais un « flop » confirmé sans information de disponibilité',table(['Produit','CA','Qté payée'],low.map(x=>'<tr><td>'+safe(str('products',x.id))+'</td><td class="r">'+euro(x.metrics.revenue)+'</td><td class="r">'+full(x.metrics.paidQuantity)+'</td></tr>')),'SLOW MOVERS');
 return coverageWarning()+headline+grid(col(7,list),col(5,tail),col(12,focusPanel))+note('ABC = contribution à la valeur positive cumulée des produits, pas une segmentation de marge. « Faible vente » ne signifie pas produit référencé et disponible. Aucune décision de suppression d’assortiment ne doit être automatique.',true);
}
function renderCross(){const a=S.agg,dims=S.env.cube.dims,stores=Core.entries(a.store).map(x=>x[0]),families=Core.entries(a.family).slice(0,9).map(x=>x[0]),channels=Core.entries(a.channel).map(x=>x[0]),hourNumbers=Array.from({length:24},(_,i)=>i),dayparts=Core.partIds.map((p,i)=>({name:p,id:i}));
 const storeFamValue=(i,j)=>{let s=stores[i],f=families[j],m=a.storeFamily.get(s+'|'+f),st=a.store.get(s);return st?.[0]?100*(m?.[0]||0)/st[0]:0};
 const storeHours=(i,j)=>{let s=stores[i],h=hourNumbers[j];return (a.storeHour.get(s+'|'+h)?.[0]||0)/100/(a.storeDays.get(s)?.size||1)};
 const fpValue=(i,j)=>{let f=families[i],part=dayparts[j].id;return (a.familyPart.get(f+'|'+part)?.[0]||0)/100};
 const cpValue=(i,j)=>{let c=channels[i],part=dayparts[j].id;return (a.channelPart.get(c+'|'+part)?.[0]||0)/100};
 let famHeat=heatGrid(stores.map(i=>str('stores',i)),families.map(i=>str('families',i)),storeFamValue,Math.max(1,...stores.flatMap((s,i)=>families.map((f,j)=>storeFamValue(i,j)))),(i,j,v)=>str('stores',stores[i])+' × '+str('families',families[j])+' : '+pct(v)+' du CA magasin');
 let hourHeat=heatGrid(stores.map(i=>str('stores',i)),hourNumbers.map(h=>h%3===0?h+'h':''),storeHours,Math.max(1,...stores.flatMap((s,i)=>hourNumbers.map((h,j)=>storeHours(i,j)))),(i,j,v)=>str('stores',stores[i])+' · '+hourNumbers[j]+'h : '+euro(v)+' / jour vendu');
 let familyDay=heatGrid(families.map(i=>str('families',i)),dayparts.map(x=>x.name),fpValue,Math.max(1,...families.flatMap((x,i)=>dayparts.map((d,j)=>fpValue(i,j)))),(i,j,v)=>str('families',families[i])+' · '+dayparts[j].name+' : '+euro(v));
 let channelDay=heatGrid(channels.map(i=>str('channels',i)),dayparts.map(x=>x.name),cpValue,Math.max(1,...channels.flatMap((x,i)=>dayparts.map((d,j)=>cpValue(i,j)))),(i,j,v)=>str('channels',channels[i])+' · '+dayparts[j].name+' : '+euro(v));
 const channelMix=panel('Canaux de vente','CA sur place, emporter, livraison, etc.',listBars(axisRows(a.channel,'channels',9),9,'channel'),'CHANNEL MIX');
 const hour=panel('Heures de ventes','CA total par heure',hourChart(Core.entries(a.hour).map(([id,m])=>[Number(id),rev(m)])),'DÉCOUPAGE HORAIRE');
 return coverageWarning()+cards(card('Lignes observées',integer(a.total[4]),'Périmètre filtré'),card('Heure la plus contributrice',(Core.entries(a.hour)[0]?.[0]??'—')+'h',euro(rev(Core.entries(a.hour)[0]?.[1]))),card('Familles',integer(a.family.size),'Avec lignes de vente'),card('Canaux',integer(a.channel.size),'Canaux présents dans les ventes'))+
 grid(col(12,panel('Magasin × famille','Poids de la famille dans le CA de chaque magasin ; comparaison de mix, pas marge',famHeat,'MATRICE DE SPÉCIALISATION')),
 col(12,panel('Magasin × heure','CA moyen par jour avec ventes à chaque heure, sans supposer des horaires d’ouverture',hourHeat,'MATRICE DE CRÉNEAUX')),
 col(6,panel('Famille × moment de journée','Où se réalise le CA de chaque famille ?',familyDay,'DAYPART')),
 col(6,panel('Canal × moment de journée','Sur place / emporter / livraison par tranche horaire',channelDay,'CANAL')),
 col(6,channelMix),col(6,hour))+note('Ces heatmaps croisent directement les lignes de vente. Attention : un créneau avec zéro vente peut correspondre à un magasin fermé. Les canaux d’Aéroport M5 ne sont pas disponibles dans son export agrégé et sont « Non renseigné ».',true);
}
function familyVector(agg,storeId){const total=agg.store.get(storeId)?.[0]||1;return new Map([...agg.family].map(([fid,m])=>[fid,(agg.storeFamily.get(storeId+'|'+fid)?.[0]||0)/total]))}
function cosine(a,b){let dot=0,aa=0,bb=0;for(const [k,v] of a){let x=b.get(k)||0;dot+=v*x;aa+=v*v}for(const v of b.values())bb+=v*v;return aa&&bb?dot/Math.sqrt(aa*bb):0}
function renderBenchmark(){const f=S.filters,env=S.env,allRows=Core.scoped(env,{...f,store:''}),all=Core.aggregate(env,allRows),stores=Core.entries(all.store).map(x=>Number(x[0]));
 const t=S.peerTarget>=0&&stores.includes(S.peerTarget)?S.peerTarget:(f.store?env.cube.dims.stores.indexOf(f.store):stores[0]);
 let peer=S.peer>=0&&stores.includes(S.peer)&&S.peer!==t?S.peer:stores.find(x=>x!==t);S.peerTarget=t;S.peer=peer??-1;
 const rows=stores.map(id=>({id,revenue:rev(all.store.get(id)),days:all.storeDays.get(id)?.size||0})).map(x=>({...x,speed:x.days?x.revenue/x.days:0})).sort((a,b)=>b.speed-a.speed);
 const perDay=table(['#','Magasin','CA','Dates vendues','CA / jour vendu'],rows.map((x,i)=>'<tr><td>'+integer(i+1)+'</td><td><b>'+safe(str('stores',x.id))+'</b></td><td class="r">'+euro(x.revenue)+'</td><td class="r">'+integer(x.days)+'</td><td class="r">'+euro(x.speed)+'</td></tr>'));
 const comparison=peer>=0?Core.overlapBenchmark(env,allRows,t,peer):null;
 const fRows=comparison?.families.map(x=>'<tr><td>'+safe(str('families',x.id))+'</td><td class="r">'+pct(100*x.shareA)+'</td><td class="r">'+pct(100*x.shareB)+'</td><td class="r">'+(x.shareB?full(x.shareA/x.shareB)+' ×':'Sans base')+'</td></tr>')||[];
 const mixSelect='<div class="controls"><label>MAGASIN CIBLE&nbsp;<select id="benchmarkTarget">'+stores.map(id=>'<option value="'+id+'"'+(id===t?' selected':'')+'>'+safe(str('stores',id))+'</option>').join('')+'</select></label><label>COMPARATEUR&nbsp;<select id="benchmarkPeer">'+stores.filter(id=>id!==t).map(id=>'<option value="'+id+'"'+(id===peer?' selected':'')+'>'+safe(str('stores',id))+'</option>').join('')+'</select></label></div>';
 const families=Core.entries(all.family).map(x=>x[0]);const profiles=stores.map(id=>({id,sim:cosine(familyVector(all,t),familyVector(all,id)),days:all.storeDays.get(id)?.size||0})).filter(x=>x.id!==t&&x.days>=14).sort((a,b)=>b.sim-a.sim);
 const similar=panel('Proximité de mix commercial','Similarité des répartitions par famille ; pas une preuve de comparabilité de clientèle',table(['Magasin','Proximité de mix','Jours vendus'],profiles.map(x=>'<tr><td>'+safe(str('stores',x.id))+'</td><td class="r">'+pct(100*x.sim)+'</td><td class="r">'+integer(x.days)+'</td></tr>')),'STORE DNA');
 const compar=panel('Comparaison sur dates communes','Les deux magasins sont comparés uniquement sur les dates avec ventes dans les deux sites',mixSelect+
 (comparison?cards(card('Dates communes',integer(comparison.commonDays),'Réconciliation de calendrier'),card(str('stores',t),euro(comparison.a.revenue),'CA sur dates communes'),card(str('stores',peer),euro(comparison.b.revenue),'CA sur mêmes dates')):note('Sélectionner deux magasins valides.'))+
 (comparison?table(['Famille','Poids magasin A','Poids magasin B','Indice A/B'],fRows):''),'APPARIEMENT');
 const warning=comparison&&comparison.commonDays<14?note('Moins de 14 dates communes : ce benchmark manque de puissance. Ne pas en déduire une conclusion de performance.',true):'';
 return coverageWarning()+cards(card('Magasins dans le périmètre',integer(stores.length),'Avec ventes observées'),card('CA/jour vendu · leader',rows[0]?euro(rows[0].speed):'—','Ne tient pas compte des heures d’ouverture'),card('Jours communs',integer(comparison?.commonDays||0),'Pour les deux sites sélectionnés'),card('Similitude de mix max',profiles[0]?pct(100*profiles[0].sim):'—','Proximité commerciale descriptive'))+
 grid(col(12,panel('Classement magasins normalisé','CA total et CA / dates avec ventes, avec coverage explicite',perDay,'NORMALISATION')),col(8,compar),col(4,similar))+warning+
 note('La comparaison sur dates communes réduit un biais de période, mais ne contrôle pas la surface, les heures d’ouverture, le format, le tourisme ou le stock. La similarité de mix ne démontre pas que deux magasins ont la même clientèle.',true);
}
function renderPulse(){const w=S.week;const a=w.a,b=w.b,base=Core.metrics(a.total).revenue,ref=Core.metrics(b.total).revenue;
 const cov=table(['Magasin','Dates cette semaine','Dates précédente','Statut'],w.coverage.map(x=>'<tr><td>'+safe(str('stores',x.id))+'</td><td class="r">'+x.cur+' / 7</td><td class="r">'+x.prev+' / 7</td><td><span class="pill '+(w.eligible.includes(x.id)?'green':'alert')+'">'+(w.eligible.includes(x.id)?'Inclus':'Non comparable')+'</span></td></tr>'));
 const movesProduct=Core.movement(a.product,b.product),movesFamilies=Core.movement(a.family,b.family),movesStore=Core.movement(a.store,b.store);
 const mTable=(arr,dim,limit=25)=>table(['Dimension','Cette semaine','Précédente','Écart DH','Variation'],arr.slice(0,limit).map(x=>'<tr><td><b>'+safe(str(dim,x.id))+'</b></td><td class="r">'+euro(x.current/100)+'</td><td class="r">'+euro(x.previous/100)+'</td><td class="r">'+signed(x.delta/100)+'</td><td class="r">'+arrow(x.pct)+'</td></tr>'));
 const positive=movesProduct.filter(x=>x.delta>0).sort((x,y)=>y.delta-x.delta),negative=movesProduct.filter(x=>x.delta<0).sort((x,y)=>x.delta-y.delta);
 const contribution=table(['Produit','Contribution à ΔCA','Var. hebdomadaire'],[...positive.slice(0,8),...negative.slice(0,8)].map(x=>'<tr><td>'+safe(str('products',x.id))+'</td><td class="r">'+signed(x.delta/100)+'</td><td class="r">'+arrow(x.pct)+'</td></tr>'));
 const quality=w.comparable?'<span class="pill green">'+integer(w.eligible.length)+' magasin(s) avec ≥ '+w.minDays+' dates / semaine</span>': '<span class="pill alert">Aucune paire de semaines à couverture suffisante</span>';
 const warning=!w.comparable?note('Aucun magasin ne dispose d’au moins '+w.minDays+' jours avec ventes dans les deux semaines : évolution descriptive uniquement, pas de % comparable.',true):w.excluded.length?note('<b>Exclus du comparatif :</b> '+w.excluded.map(x=>safe(str('stores',x.id))+' ('+x.cur+'/7 vs '+x.prev+'/7)').join(', ')+'. Les KPI hebdomadaires ne concernent que les magasins inclus.',true):'';
 const cardsBlock=cards(card('CA · semaine A',euro(base),w.dates.labelCurrent),card('CA · semaine B',euro(ref),w.dates.labelPrevious),card('Variation comparable',w.comparable?arrow(w.change).replace(/<[^>]+>/g,''):'—','Seulement les magasins admissibles'),card('Écart de CA',signed(w.delta),'Somme des écarts produit'));
 const insightBlock='<div class="insights">'+[
 insight('PRODUIT HAUSSIER',positive[0]?str('products',positive[0].id):'—',positive[0]?signed(positive[0].delta/100)+' entre semaines comparées.':'Aucun contributeur identifié.','success'),
 insight('PRODUIT EN RECUL',negative[0]?str('products',negative[0].id):'—',negative[0]?signed(negative[0].delta/100)+' entre semaines comparées.':'Aucune baisse observée.','risk'),
 insight('COUVERTURE',w.comparable?'Périmètre comparable':'Attention : base fragile',w.comparable?'Les mêmes magasins sont conservés dans les deux semaines.':'Différences de couverture observée entre les deux semaines.','risk')].join('')+'</div>';
 return coverageWarning()+note('<b>Semaines calendaires comparées :</b> '+safe(w.dates.labelCurrent)+' contre '+safe(w.dates.labelPrevious)+'. '+quality)+warning+cardsBlock+
 grid(col(12,panel('Ce qui explique le mouvement','Décomposition des produits en hausse et en baisse, sans attribution de cause',insightBlock,'REVENUE BRIDGE')),
 col(8,panel('Décomposition par produit','Somme des contributions = différence totale à périmètre comparable',contribution,'BRIDGE PRODUIT')),
 col(4,panel('Couverture des magasins','Dates ayant des ventes dans chaque semaine',cov,'COHORT CHECK')),
 col(12,panel('Variations par magasin','Même cohorte dans les deux semaines',mTable(movesStore,'stores',20),'MAGASINS')),
 col(7,panel('Mouvements par produit','Classement par impact absolu sur CA',mTable(movesProduct,'products',40),'TOP CONTRIBUTIONS')),
 col(5,panel('Mouvements par famille','CA hebdomadaire et écart',mTable(movesFamilies,'families',20),'CATÉGORIES')))+
 note('La différence est une différence de ventes enregistrées, pas la conséquence prouvée d’une opération. Contrôler ruptures, météo, ouvertures, mise en avant et promotions. Un produit absent de la première semaine n’est pas nécessairement un nouveau produit.',true);
}
function renderOpportunities(){const f=S.filters,env=S.env,allScope=Core.scoped(env,{...f,store:''}),all=Core.aggregate(env,allScope);
 const candidates=[],targets=f.store?[env.cube.dims.stores.indexOf(f.store)]:[...all.store.keys()].map(Number);
 for(const sid of targets){const peers=Core.storePeers(env,all,sid,3).filter(x=>x.index<.72&&x.hypotheticalGap>=500);for(const x of peers){let conf=x.peers>=5&&x.days>=35?'moyenne':'exploratoire';const score=x.hypotheticalGap*(1+Math.min(x.peers,7)/10);candidates.push({...x,confidence:conf,score})}}
 candidates.sort((a,b)=>b.score-a.score);
 const fObs=Core.insightSignals(env,f,S.agg,S.week);
 const rows=candidates.slice(0,75).map(x=>'<tr><td><b>'+safe(str('stores',x.store))+'</b></td><td>'+safe(str('products',x.id))+'</td><td class="r">'+pct(100*x.localMix)+'</td><td class="r">'+pct(100*x.peerMix)+'</td><td class="r">'+full(x.index)+' ×</td><td class="r">'+integer(x.peers)+'</td><td class="r">'+euro(x.hypotheticalGap)+'</td><td><button class="click-text" data-action-product="'+x.id+'" data-action-store="'+x.store+'">Créer un test</button></td></tr>');
 const highlights=candidates.slice(0,3).map((x,i)=>'<div class="insight '+(i?'':'risk')+'"><span class="tag">PISTE '+(i+1)+' · '+safe(str('stores',x.store))+'</span><strong>'+safe(str('products',x.id))+'</strong><p>Poids du CA local '+pct(100*x.localMix)+' contre '+pct(100*x.peerMix)+' chez '+x.peers+' magasins de référence. Écart de mix indicatif '+euro(x.hypotheticalGap)+', non prévision de gain.</p><button data-action-product="'+x.id+'" data-action-store="'+x.store+'">Formaliser un test →</button></div>').join('');
 const negatives=fObs.filter(x=>x.type==='decline').slice(0,5).map(x=>'<div class="report-item"><h4>'+safe(x.title)+'</h4><p>'+safe(x.evidence)+' '+safe(x.action)+'</p></div>').join('');
 return coverageWarning()+cards(card('Hypothèses identifiées',integer(candidates.length),'Produit vendu localement, sous-indexé'),card('Magasins testables',integer(new Set(candidates.map(x=>x.store)).size),'≥14 dates observées'),card('Facteur de priorité','Écart de mix','Pas un gain garanti'),card('Signaux de baisse',integer(fObs.filter(x=>x.type==='decline').length),'Sur semaines comparables'))+
 grid(col(12,panel('Trois pistes à examiner en priorité','Écarts de mix fondés sur les magasins vendant déjà le produit',highlights?'<div class="insights">'+highlights+'</div>':'<div class="empty">Pas assez de données comparables pour établir une opportunité prudente sur cette sélection.</div>','DECISION ENGINE')),
 col(12,panel('Matrice de sous-indexation','Ciblage produit par produit, avec preuve de vente locale et au moins 3 magasins pairs',table(['Magasin','Produit','Part locale','Part pairs','Indice','Pairs','Écart mix indicatif','Action'],rows),'OPPORTUNITÉS')),
 col(12,panel('Décrochages hebdomadaires','Variations à investiguer, sans attribuer automatiquement une cause',negatives||'<div class="empty">Aucune baisse satisfaisant les seuils.</div>','VIGILANCE')))+
 note('<b>Règle de décision :</b> le « gap » = (mix des autres magasins − mix local) × CA local. Ce n’est ni un gain prévisionnel ni un diagnostic de flop. Une vraie décision nécessite de vérifier la présence au menu, le stock, l’exposition, les horaires et le format du magasin. Les magasins comparés ne sont pas automatiquement similaires.',true);
}
function renderQuality(){const env=S.env,a=S.agg,m=Core.metrics(a.total),audit=env.cube.audit,source=env.cube.sources;
 const coverage=Core.auditCoverage(env,S.filters.cohort);
 const coverRows=coverage.map(x=>'<tr><td><b>'+safe(str('stores',x.id))+'</b></td><td>'+safe(x.first)+'</td><td>'+safe(x.last)+'</td><td class="r">'+integer(x.days)+'</td><td class="r">'+euro(x.revenue)+'</td><td><span class="pill '+(x.id===env.airport?'alert':'')+'">'+(x.id===env.airport?'Source partielle':'Historique')+'</span></td></tr>');
 const totalAudit=source.map(x=>'<tr><td><b>'+safe(x.id===0?'Réseau initial · 10 magasins':'Aéroport M5 · 1 magasin')+'</b></td><td>'+safe(x.start)+'</td><td>'+safe(x.end)+'</td><td><span class="pill '+(x.id?'alert':'green')+'">'+safe(x.coverage)+'</span></td></tr>');
 const problemFamily=env.cube.dims.families.indexOf('personnel'),personnelRevenue=problemFamily>=0?(a.family.get(problemFamily)?.[0]||0)/100:0;
 const canonical=new Map();for(let id=0;id<env.cube.dims.products.length;id++){const product=env.cube.dims.products[id];const key=product.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();if(!canonical.has(key))canonical.set(key,[]);canonical.get(key).push({id,name:product,ca:(a.product.get(id)?.[0]||0)/100})}
 const duplicateGroups=[...canonical.values()].filter(v=>v.length>1&&v.some(x=>x.ca>0)).sort((x,y)=>y.reduce((n,a)=>n+a.ca,0)-x.reduce((n,a)=>n+a.ca,0));
 const duplicateRows=duplicateGroups.map(group=>'<tr><td>'+group.map(x=>safe(x.name)).join(' <span class="muted">/</span> ')+'</td><td class="r">'+euro(group.reduce((n,x)=>n+x.ca,0))+'</td><td><span class="pill alert">À vérifier</span></td></tr>');
 const totalNetwork=audit.baselineRevenueCents/100,airportRevenue=audit.airportRevenueCents/100,allTotal=audit.totalRevenueCents/100;
 return coverageWarning()+cards(card('Lignes de ventes du périmètre',integer(m.lines),'Agrégation de données source'),card('Lignes à 0 DH',pct(m.lines?100*m.zeroLines/m.lines:0),integer(m.zeroLines)+' lignes'),card('Coûts nuls',pct(m.lines?100*m.missingCost/m.lines:0),'Aucune marge fiable'),card('Lignes avec valeur négative',integer(m.returnLines),'Retours et corrections éventuels'))+
 grid(col(6,panel('Réconciliation à la source','Montants exactement recoupés dans le cube chiffré',table(['Source','CA enregistré'],[
 '<tr><td>Historique réseau</td><td class="r">'+euro(totalNetwork)+'</td></tr>',
 '<tr><td>Aéroport M5 uniquement</td><td class="r">'+euro(airportRevenue)+'</td></tr>',
 '<tr><td><b>Somme de tous les relevés</b></td><td class="r"><b>'+euro(allTotal)+'</b></td></tr>',
 '<tr><td>Lignes H&S Casablanca exclues</td><td class="r">'+integer(audit.excludedRows)+' lignes</td></tr>']),'AUDIT')),
 col(6,panel('Règles de confiance','Ce que les exports ne permettent pas d’affirmer',
 '<div class="report-list">'+[
 ['Coût unitaire incomplet','La marge produit et la rentabilité des menus ne sont pas publiées.'],
 ['Tickets non réconciliés','Pas de panier moyen ni de produits achetés ensemble sans identifiants transaction fiables.'],
 ['Disponibilité inconnue','Un produit absent des ventes ne prouve pas sa présence sur le menu ou son stock.'],
 ['Aéroport M5 sans canal détaillé','Son fichier transmis précédemment est agrégé sans segmentation fiable des canaux.']].map(x=>'<div class="report-item"><h4>'+safe(x[0])+'</h4><p>'+safe(x[1])+'</p></div>').join('')+'</div>','GUARDRAILS')),
 col(12,panel('Couverture par magasin','Première et dernière date avec ventes observées ; ne suppose pas une ouverture complète',table(['Magasin','Première vente','Dernière vente','Dates vendues','CA','Périmètre'],coverRows),'CALENDRIER')),
 col(12,panel('Provenance des deux exports','Historique consolidé et relevé additionnel',table(['Source','Premier jour','Dernier jour','Périmètre'],totalAudit),'SOURCE')),
 col(12,panel('Référentiel produits : doublons possibles','Orthographes, accents et ponctuation proches : revue humaine avant fusion',table(['Libellés proches','CA cumulé','Statut'],duplicateRows),'PRODUCT MASTER')),
 col(12,panel('Classification métier à vérifier','Éléments qui peuvent fausser l’analyse commerciale',
 '<div class="insights">'+[
 insight('FAMILLE « PERSONNEL »',euro(personnelRevenue),personnelRevenue?'CA classé dans « personnel » dans la sélection. Vérifier si ces mouvements sont des ventes commerciales normales.':'Aucun chiffre dans « personnel » sur la sélection.','risk'),
 insight('TICKET MOYEN','Indisponible','Les numéros de ticket ne sont pas prouvés uniques sur tous les magasins et toutes les heures.','risk'),
 insight('ANALYSE DES CANAUX','À périmètre documenté','Les ventes historiques possèdent un canal ; les données Aéroport agrégées ont un canal « Non renseigné ».','success')].join('')+'</div>','DATA QUALITY')))+
 note('Les indicateurs présentés ici sont des contrôles descriptifs. Les sources restent chiffrées sur l’hébergement ; elles sont déchiffrées et analysées uniquement dans votre navigateur. Ajouter un fichier dans l’ancien module d’import ne modifie pas automatiquement ce cube : une synchronisation cloud sécurisée reste à construire.',true);
}
async function openDB(){return new Promise((resolve,reject)=>{const request=indexedDB.open('VeneziaIceSalesIntelligence',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('kv'))request.result.createObjectStore('kv')};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
function dbGet(key){return new Promise((resolve,reject)=>{if(!S.db)return resolve(undefined);const req=S.db.transaction('kv','readonly').objectStore('kv').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function dbSet(key,value){return new Promise((resolve,reject)=>{if(!S.db)return resolve(false);const tx=S.db.transaction('kv','readwrite');tx.objectStore('kv').put(value,key);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error)})}
async function loadActions(){try{S.db=await openDB();const a=await dbGet('actions');S.actions=Array.isArray(a)?a:[]}catch(e){console.warn('Local action storage unavailable',e);try{S.actions=JSON.parse(localStorage.getItem('venezia_decisions_v2')||'[]')}catch{S.actions=[]}}}
async function persistActions(){if(S.db){await dbSet('actions',S.actions);return}localStorage.setItem('venezia_decisions_v2',JSON.stringify(S.actions))}
async function createAction(productId,storeId){const pName=str('products',productId),name=str('stores',storeId),summary='Étudier la sous-indexation de '+pName+' à '+name;
 S.actions.push({id:Date.now(),date:new Date().toISOString().slice(0,10),title:summary,store:name,owner:'',status:'À investiguer',result:'',note:'Écart de mix constaté dans Decision Lab. Vérifier disponibilité, offre locale et profil du magasin.',source:'decision-lab',period:S.filters.from+' → '+S.filters.to});
 await persistActions();toast('Test ajouté au journal des décisions.');S.view='decisions';render();}
function renderDecisions(){const actions=S.actions.slice().reverse(),statuses=['À investiguer','À tester','En cours','Mesuré','Clôturé'];
 const rows=actions.map(x=>'<tr><td>'+safe((x.date||'').slice(0,10))+'</td><td><b>'+safe(x.title||'')+'</b><small class="muted" style="display:block">'+safe(x.note||'')+'</small></td><td>'+safe(x.store||'Réseau')+'</td><td>'+safe(x.owner||'—')+'</td><td><select class="result-state" data-stage="'+safe(x.id)+'">'+statuses.map(st=>'<option'+(st===x.status?' selected':'')+'>'+st+'</option>').join('')+'</select></td><td><button class="click-text" data-result="'+safe(x.id)+'">'+safe(x.result?'Modifier la mesure':'Documenter →')+'</button></td></tr>');
 return cards(card('Actions suivies',integer(S.actions.length),'Issues des diagnostics ou créées manuellement'),card('À investiguer',integer(S.actions.filter(x=>x.status==='À investiguer').length),'Prochains contrôles terrain'),card('Tests en cours',integer(S.actions.filter(x=>x.status==='En cours'||x.status==='À tester').length),'Expérimentations'),card('Mesurées',integer(S.actions.filter(x=>x.status==='Mesuré').length),'Résultat documenté'))+
 grid(col(5,panel('Créer une action','Décrire le magasin, le test et le responsable',
 '<form id="actionForm"><div class="controls" style="display:block"><label class="muted">Action / hypothèse</label><input name="title" required placeholder="Ex. Tester le menu midi à Marrakech" style="display:block;width:100%;margin:6px 0 11px"><label class="muted">Magasin</label><select name="store" style="display:block;width:100%;margin:6px 0 11px"><option value="">Réseau</option>'+S.env.cube.dims.stores.map(name=>'<option>'+safe(name)+'</option>').join('')+'</select><label class="muted">Pilote / responsable</label><input name="owner" placeholder="Nom ou équipe" style="display:block;width:100%;margin:6px 0 11px"><label class="muted">Observation à vérifier</label><textarea name="note" rows="3" placeholder="Ex. Contrôler la disponibilité et tester une meilleure visibilité" style="display:block;width:100%;margin:6px 0 12px"></textarea><button class="primary" type="submit">Ajouter au plan d’action</button></div></form>','ACTION')),
 col(7,panel('Méthode de mesure','Éviter les conclusions causales à partir de simples écarts',
 '<div class="report-list">'+[
 ['01 · Constater','Magasin, produit, famille et période de référence explicites.'],
 ['02 · Vérifier','Disponibilité, assortiment, prix, promotions, météo, jours et heures réellement ouverts.'],
 ['03 · Tester','Date de départ, responsable, magasin témoin et durée suffisante.'],
 ['04 · Mesurer','Comparer une période équivalente, calculer le gain observé et documenter les limites.']].map(x=>'<div class="report-item"><h4>'+safe(x[0])+'</h4><p>'+safe(x[1])+'</p></div>').join('')+'</div>','TEST & LEARN')),
 col(12,panel('Suivi des actions','Ce journal est partagé avec le module analytique avancé sur le même navigateur',table(['Date','Hypothèse / action','Magasin','Pilote','Statut','Évaluation'],rows),'ACTION TRACKER')))+
 note('Le journal des décisions est enregistré sur cet appareil (IndexedDB du site). Une base cloud sécurisée reste nécessaire pour le partager entre managers et appareils.');
}
function escCsv(v){let s=typeof v==='number'?String(v):String(v??'');if(typeof v!=='number'&&/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function csvDownload(filename,columns,rows){const body=[columns,...rows].map(x=>x.map(escCsv).join(';')).join('\r\n');const blob=new Blob(['\ufeff',body],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),2500)}
function exportReport(){const env=S.env,a=S.agg,f=S.filters,w=S.week,rows=[];let columns=[];
 switch(S.view){
 case 'products':columns=['Produit','CA net DH','CA positif DH','Quantité payée','Lignes 0 DH','Part CA %'];for(const p of Core.rankProducts(a)){const val=p.metrics;rows.push([str('products',p.id),val.revenue,val.paidRevenue,val.paidQuantity,val.zeroLines,p.share])}break;
 case 'cross':columns=['Magasin','Famille','CA DH','Part magasin %'];for(const [key,m] of a.storeFamily){const [sid,fid]=key.split('|'),st=a.store.get(Number(sid));rows.push([str('stores',sid),str('families',fid),rev(m),st?.[0]?100*m[0]/st[0]:0])}break;
 case 'benchmark':columns=['Magasin','CA DH','Dates avec ventes','CA / jour vendu'];for(const [sid,m] of a.store)rows.push([str('stores',sid),rev(m),a.storeDays.get(sid)?.size||0,rev(m)/(a.storeDays.get(sid)?.size||1)]);break;
 case 'pulse':columns=['Produit','CA semaine A DH','CA semaine B DH','Ecart DH','Variation %'];for(const m of Core.movement(w.a.product,w.b.product))rows.push([str('products',m.id),m.current/100,m.previous/100,m.delta/100,m.pct??'sans base']);break;
 case 'quality':columns=['Magasin','CA DH','Première date','Dernière date','Dates vendues'];for(const x of Core.auditCoverage(env,f.cohort))rows.push([str('stores',x.id),x.revenue,x.first,x.last,x.days]);break;
 case 'opportunities':columns=['Magasin','Produit','Part locale','Part pairs','Indice','Gap indicatif DH'];{const all=Core.aggregate(env,Core.scoped(env,{...f,store:''}));for(const sid of all.store.keys())for(const x of Core.storePeers(env,all,sid).filter(x=>x.index<.72&&x.hypotheticalGap>=500))rows.push([str('stores',x.store),str('products',x.id),x.localMix,x.peerMix,x.index,x.hypotheticalGap]);}break;
 case 'decisions':columns=['Date','Action','Magasin','Responsable','Statut','Résultat'];for(const x of S.actions)rows.push([x.date,x.title,x.store,x.owner,x.status,x.result]);break;
 default:columns=['Dimension','Libellé','CA DH'];for(const [id,m] of a.store)rows.push(['Magasin',str('stores',id),rev(m)]);for(const [id,m] of a.family)rows.push(['Famille',str('families',id),rev(m)]);for(const [id,m] of a.product)rows.push(['Produit',str('products',id),rev(m)]);
 }
 const header=['Source des exports Venezia Ice','Cohorte: '+f.cohort,'Période: '+f.from+' / '+f.to,'Données non retraitées en marge'];
 csvDownload('venezia-decision-'+S.view+'-'+f.to+'.csv',columns,rows);toast(integer(rows.length)+' lignes exportées, avec périmètre filtré.');
}
async function decrypt(pass){if(!window.crypto?.subtle)throw Error('Navigateur HTTPS requis pour déchiffrer la synthèse.');
 const res=await fetch('./decision-cube.enc',{cache:'force-cache'});if(!res.ok)throw Error('Base analytique chiffrée inaccessible (HTTP '+res.status+').');
 const b64=(await res.text()).trim();const enc=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));if(enc.length<60)throw Error('Fichier chiffré invalide.');
 const m=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:enc.slice(0,16),iterations:250000,hash:'SHA-256'},m,{name:'AES-GCM',length:256},false,['decrypt']);
 const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:enc.slice(16,28)},key,enc.slice(28));
 const decompressed=await new Response(new Blob([plaintext]).stream().pipeThrough(new DecompressionStream('deflate'))).text();
 return JSON.parse(decompressed);
}
function showLock(error=''){S.cube=null;$('#filters').hidden=true;$('#context').hidden=true;$('#exportBtn').disabled=true;$('#status').textContent='● Accès chiffré';
 root.innerHTML='<div class="lock-wrap"><div class="lock-card"><div class="lock-left"><div class="overline" style="color:#d2beff">VENEZIA ICE · DECISION LAB</div><h2>Des chiffres. Des croisements. Des décisions.</h2><p>Votre historique est déjà préparé : 692 851 lignes pour les dix magasins historiques, plus 3 158 lignes Aéroport M5. Des analyses combinées, et une protection du périmètre temporel.</p><div class="pills"><span class="pill">Produit × magasin</span><span class="pill">Date × heure</span><span class="pill">Benchmark comparable</span></div></div><div class="lock-right"><div class="overline">ACCÈS AUX DONNÉES</div><h2>Votre cockpit de précision</h2><p>Les données sont stockées chiffrées sur le site. Utilisez la même clé privée que la Vue Direction ; le déchiffrement s’effectue uniquement dans votre navigateur.</p><form id="unlockForm"><input required type="password" id="unlockKey" placeholder="Clé de déchiffrement" autocomplete="off"><button type="submit" class="primary">Ouvrir Decision Lab →</button><div class="lock-error" id="unlockError">'+safe(error)+'</div></form><p style="margin-top:18px">La dernière actualisation comprend <b>uniquement Aéroport M5</b> après le 12 octobre. Le réseau historique n’est pas présenté comme actualisé à novembre.</p></div></div></div>';
 $('#unlockForm').onsubmit=async e=>{e.preventDefault();const pass=$('#unlockKey').value.trim();$('#unlockError').textContent='Déchiffrement et réconciliation en cours…';try{await activate(pass);sessionStorage.setItem('venezia_session',pass)}catch(err){console.error(err);$('#unlockError').textContent='Accès impossible : clé incorrecte ou ressource indisponible. '+err.message}}
}
function defaultDates(cohort){if(cohort==='airport')return ['2026-10-12','2026-11-09'];if(cohort==='all')return ['2026-06-01','2026-11-09'];return ['2026-06-01','2026-10-12']}
function refillSelect(id,options,value,placeholder){let el=$(id);el.innerHTML='<option value="">'+safe(placeholder)+'</option>'+options.map(x=>'<option value="'+safe(x)+'"'+(x===value?' selected':'')+'>'+safe(x)+'</option>').join('');el.value=options.includes(value)?value:''}
function eligibleOptionRows(){const f=S.filters,air=S.env.airport,stores=getStoreIds();let families=new Set(),cats=new Set(),channels=new Set();
 for(const r of S.env.cube.rows){if(!stores.includes(r[0]))continue;if(f.store&&str('stores',r[0])!==f.store)continue;families.add(str('families',r[3]));channels.add(str('channels',r[6]));if(!f.family||str('families',r[3])===f.family)cats.add(str('categories',r[4]))}
 return {families:[...families].sort(),categories:[...cats].sort(),channels:[...channels].sort()}
}
function refillFilters(){const f=S.filters;$('#cohort').value=f.cohort;const stores=getStoreIds().map(id=>str('stores',id)).sort();refillSelect('#store',stores,f.store,'Tout le périmètre');const options=eligibleOptionRows();refillSelect('#family',options.families,f.family,'Toutes les familles');refillSelect('#category',options.categories,f.category,'Toutes les catégories');refillSelect('#channel',options.channels,f.channel,'Tous les canaux');
 $('#from').value=f.from;$('#to').value=f.to;const partValues={'':'','Matin':'Matin','Midi':'Midi','Après-midi':'Après-midi','Soir':'Soir','Nuit':'Nuit'};
 // The daypart values are stable English tokens in the form, mapped to core daypart labels before analysis.
 $('#daypart').value=({Matin:'morning',Midi:'lunch','Après-midi':'afternoon',Soir:'evening',Nuit:'night'})[f.part]||'';
 $('#from').min=f.cohort==='airport'?'2026-10-12':'2026-06-01';$('#to').max=f.cohort==='historical'?'2026-10-12':'2026-11-09';
}
function readFilters(){const form=$('#daypart').value;const map={morning:'Matin',lunch:'Midi',afternoon:'Après-midi',evening:'Soir',night:'Nuit'};
 S.filters={cohort:$('#cohort').value,store:$('#store').value,family:$('#family').value,category:$('#category').value,channel:$('#channel').value,from:$('#from').value,to:$('#to').value,part:map[form]||''};
}
function applyFilters(){const f=S.filters;if(!f.from||!f.to||f.from>f.to){toast('Sélectionnez une plage de dates valide.');return}
 root.innerHTML='<div class="loader"><div class="spinner"></div>Analyse des lignes, calcul des croisements et vérification des cohortes…</div>';
 setTimeout(()=>{try{S.rows=Core.scoped(S.env,f);S.agg=Core.aggregate(S.env,S.rows);S.week=Core.weekly(S.env,f,5);render()}catch(err){console.error(err);root.innerHTML='<div class="warning-box">Erreur de calcul : '+safe(err.message)+'. Vérifiez les filtres.</div>'}},20);
}
function render(){if(!S.env)return;const names={cockpit:['Executive cockpit','Vue consolidée, du chiffre d’affaires jusqu’aux signaux de décision.'],products:['Product intelligence','Classement ABC, volumes payés, performance locale et produit 360.'],cross:['Analyses croisées','Magasin × famille × horaire × canal : les croisements opérationnels.'],benchmark:['ADN des magasins','Comparer à dates communes et distinguer les spécificités des magasins.'],pulse:['Weekly performance','Décomposer la variation hebdomadaire à périmètre comparable.'],opportunities:['Opportunity engine','Prioriser les écarts de mix à investiguer et tester.'],quality:['Fiabilité & couverture','Audit des sources, des coûts et des périodes réellement représentées.'],decisions:['Journal des décisions','Transformer les constats en expérimentations documentées.']};
 $('#title').textContent=names[S.view][0];$('#subtitle').textContent=names[S.view][1];$$('[data-view]').forEach(el=>el.classList.toggle('selected',el.dataset.view===S.view));
 $('#filters').hidden=false;$('#context').hidden=false;$('#exportBtn').disabled=false;
 const d=S.filters,m=Core.metrics(S.agg.total),state=d.store||scopeLabel();let parts=[state,d.from+' → '+d.to,integer(S.agg.store.size)+' magasin(s) avec ventes',integer(S.agg.dates.size)+' date(s) vendue(s)'];if(d.family)parts.push('Famille : '+d.family);if(d.category)parts.push('Catégorie : '+d.category);if(d.part)parts.push('Moment : '+d.part);if(d.channel)parts.push('Canal : '+d.channel);
 $('#context').textContent=parts.join(' · ');$('#context').classList.toggle('warning',d.cohort==='all');$('#status').textContent='● Données déchiffrées · '+integer(S.env.entries)+' groupes';
 try{root.innerHTML=({cockpit:renderCockpit,products:renderProducts,cross:renderCross,benchmark:renderBenchmark,pulse:renderPulse,opportunities:renderOpportunities,quality:renderQuality,decisions:renderDecisions}[S.view])()}
 catch(e){console.error(e);root.innerHTML='<div class="warning-box">Une analyse a échoué : '+safe(e.message)+'</div>'}
 bindDynamic();
}
function bindDynamic(){
 $$('[data-cross]').forEach(el=>el.onclick=()=>{const kind=el.dataset.cross,id=Number(el.dataset.id),f=S.filters;
 if(kind==='product'){S.focus=id;S.view='products';render();return}
 if(kind==='store')f.store=str('stores',id);
 if(kind==='family'){f.family=str('families',id);f.category=''}
 if(kind==='channel')f.channel=str('channels',id);
 refillFilters();applyFilters();});
 $$('[data-focus]').forEach(el=>el.onclick=()=>{S.focus=Number(el.dataset.focus);render()});
 const search=$('#prodSearch');if(search)search.onchange=e=>{S.productSearch=e.target.value.trim();render()};
 const sort=$('#prodSort');if(sort)sort.onchange=e=>{S.productSort=e.target.value;render()};
 const target=$('#benchmarkTarget');if(target)target.onchange=e=>{S.peerTarget=Number(e.target.value);S.peer=-1;render()};
 const peer=$('#benchmarkPeer');if(peer)peer.onchange=e=>{S.peer=Number(e.target.value);render()};
 $$('[data-action-product]').forEach(el=>el.onclick=()=>createAction(Number(el.dataset.actionProduct),Number(el.dataset.actionStore)));
 const form=$('#actionForm');if(form)form.onsubmit=async e=>{e.preventDefault();const data=new FormData(e.currentTarget);S.actions.push({id:Date.now(),date:new Date().toISOString().slice(0,10),title:String(data.get('title')||''),store:String(data.get('store')||''),owner:String(data.get('owner')||''),note:String(data.get('note')||''),result:'',status:'À investiguer'});try{await persistActions();toast('Action enregistrée.');render()}catch(err){toast('Sauvegarde impossible : '+err.message)}};
 $$('[data-stage]').forEach(el=>el.onchange=async()=>{const a=S.actions.find(x=>String(x.id)===el.dataset.stage);if(a){a.status=el.value;await persistActions();toast('Statut mis à jour.')}});
 $$('[data-result]').forEach(el=>el.onclick=async()=>{const a=S.actions.find(x=>String(x.id)===el.dataset.result);if(!a)return;const res=prompt('Notez la mesure du test ou le résultat à confirmer :',a.result||'');if(res===null)return;a.result=res;await persistActions();render()});
}
async function activate(key){const cube=await decrypt(key);S.env=Core.prepare(cube);S.cube=cube;S.focus=-1;S.peer=-1;S.peerTarget=-1;S.view='cockpit';
 $('#status').textContent='● Contrôles de réconciliation validés';$('#filters').hidden=false;refillFilters();applyFilters();}
function register(){
 $$('[data-view]').forEach(btn=>btn.onclick=()=>{S.view=btn.dataset.view;render();window.scrollTo({top:0,behavior:'smooth'})});
 $('#cohort').onchange=e=>{S.filters.cohort=e.target.value;S.filters.store='';S.filters.family='';S.filters.category='';S.filters.channel='';S.filters.part='';[S.filters.from,S.filters.to]=defaultDates(e.target.value);S.focus=-1;S.peer=-1;refillFilters();applyFilters()};
 $('#family').onchange=e=>{S.filters.family=e.target.value;S.filters.category='';refillFilters()};
 $('#store').onchange=e=>{S.filters.store=e.target.value;refillFilters()};
 $('#apply').onclick=()=>{readFilters();applyFilters()};
 $('#reset').onclick=()=>{const cohort=S.filters.cohort;const [from,to]=defaultDates(cohort);S.filters={cohort,store:'',family:'',category:'',channel:'',from,to,part:''};S.focus=-1;S.productSearch='';S.peer=-1;refillFilters();applyFilters()};
 $('#exportBtn').onclick=exportReport;
}
async function initialize(){register();await loadActions();const key=sessionStorage.getItem('venezia_session');if(key){try{await activate(key);return}catch(err){console.warn('Session key invalid',err);sessionStorage.removeItem('venezia_session')}}showLock()}
initialize();
})();