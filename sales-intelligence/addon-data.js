/* Venezia Ice: encrypted commercial update. Decrypt only on the user's device. */
(function(){
"use strict";
let cached=null,keyTag=null;
async function load(passphrase){
 if(!passphrase)throw Error("Clé privée requise.");
 if(cached&&keyTag===passphrase)return cached;
 if(!crypto?.subtle)throw Error("HTTPS est requis pour accéder aux chiffres.");
 const response=await fetch("./secure-airport-20261109.enc",{cache:"force-cache"});
 if(!response.ok)throw Error("Complément Aéroport indisponible (HTTP "+response.status+").");
 const raw=Uint8Array.from(atob((await response.text()).trim()),c=>c.charCodeAt(0));
 if(raw.length<40)throw Error("Complément chiffré invalide.");
 const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(passphrase),"PBKDF2",false,["deriveKey"]);
 const aes=await crypto.subtle.deriveKey({name:"PBKDF2",salt:raw.slice(0,16),iterations:250000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["decrypt"]);
 const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:raw.slice(16,28)},aes,raw.slice(28));
 const data=JSON.parse(await new Response(new Blob([clear]).stream().pipeThrough(new DecompressionStream("deflate"))).text());
 if(data?.meta?.version!==1||data?.meta?.store!=="Aéroport M5"||data?.meta?.rowCount!==3158||!Array.isArray(data.rows))throw Error("Structure de mise à jour inattendue.");
 const recorded=data.rows.reduce((a,r)=>a+(Number(r[6])||0),0);
 if(Math.abs(recorded-80863)>0.05||data.rows.reduce((a,r)=>a+(Number(r[9])||0),0)!==3158)throw Error("Réconciliation des ventes impossible.");
 cached=data;keyTag=passphrase;
 return data;
}
function summarized(data){
 const sales=new Map(),products=new Map(),families=new Map(),categories=new Map(),hours=new Map(),days=new Map(),dayHours=new Map(),paid=new Map();
 const add=(map,key,amount)=>map.set(key,(map.get(key)||0)+amount);
 for(const r of data.rows){
  add(sales,r[1],r[6]);add(products,r[5],r[6]);add(families,r[3],r[6]);add(categories,r[4],r[6]);add(hours,r[2],r[6]);add(days,r[1],r[6]);add(dayHours,r[1]+"|"+r[2],r[6]);add(paid,r[5],r[8]);
 }
 const rank=m=>[...m.entries()].sort((a,b)=>b[1]-a[1]);
 return {store:data.meta.store,meta:data.meta,sales:rank(sales),products:rank(products),families:rank(families),categories:rank(categories),hours:rank(hours),days:rank(days),dayHours:rank(dayHours),paid,ca:data.meta.revenue};
}
window.VeneziaAddon={load,summarized};
})();