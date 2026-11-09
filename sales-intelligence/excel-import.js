/* Venezia Ice: local XLSX reader. Zero network requests and no third-party scripts. */
(function(){
"use strict";
const NS="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const decoder=new TextDecoder("utf-8");
function zipFiles(buffer){
  const bytes=new Uint8Array(buffer),dv=new DataView(buffer);
  let end=-1;
  const min=Math.max(0,bytes.length-65558);
  for(let i=bytes.length-22;i>=min;i--){if(dv.getUint32(i,true)===0x06054b50){end=i;break}}
  if(end<0)throw Error("Ce fichier ne ressemble pas à un XLSX valide (ZIP illisible).");
  const size=dv.getUint32(end+12,true),offset=dv.getUint32(end+16,true);
  if(offset+size>bytes.length)throw Error("Répertoire ZIP corrompu.");
  const files=new Map();let p=offset;
  while(p<offset+size){
    if(dv.getUint32(p,true)!==0x02014b50)throw Error("Entrée ZIP invalide.");
    const method=dv.getUint16(p+10,true),compressed=dv.getUint32(p+20,true),uncompressed=dv.getUint32(p+24,true);
    const namelen=dv.getUint16(p+28,true),exlen=dv.getUint16(p+30,true),comment=dv.getUint16(p+32,true),local=dv.getUint32(p+42,true);
    const name=decoder.decode(bytes.slice(p+46,p+46+namelen));
    files.set(name,{method,compressed,uncompressed,local});
    p+=46+namelen+exlen+comment;
  }
  return {files,bytes,dv};
}
async function extract(zip,name){
  const item=zip.files.get(name);
  if(!item)throw Error("Le fichier Excel ne contient pas "+name+".");
  if(item.uncompressed>100*1024*1024)throw Error("Feuille XLSX trop volumineuse pour le navigateur.");
  const off=item.local;if(zip.dv.getUint32(off,true)!==0x04034b50)throw Error("Entrée XLSX endommagée : "+name);
  const start=off+30+zip.dv.getUint16(off+26,true)+zip.dv.getUint16(off+28,true);
  const src=zip.bytes.slice(start,start+item.compressed);
  if(src.length!==item.compressed)throw Error("Contenu XLSX incomplet.");
  if(item.method===0)return decoder.decode(src);
  if(item.method!==8)throw Error("Compression XLSX non prise en charge.");
  if(!("DecompressionStream" in window))throw Error("Navigateur trop ancien pour XLSX : utilisez Chrome ou Edge récent.");
  const stream=new Blob([src]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}
function xml(text,name){
  const doc=new DOMParser().parseFromString(text,"application/xml");
  if(doc.getElementsByTagName("parsererror").length)throw Error("XML Excel invalide : "+name);
  return doc;
}
function elems(n,name){return [...n.getElementsByTagNameNS(NS,name)]}
function cellNumber(ref){
  const m=/^[A-Z]+/.exec(ref);if(!m)return -1;let n=0;
  for(const ch of m[0])n=n*26+ch.charCodeAt(0)-64;
  return n-1;
}
function normalizeDateSerial(n){
  const serial=Number(n);
  if(!Number.isFinite(serial)||serial<20000||serial>100000)return String(n);
  const d=new Date(Date.UTC(1899,11,30)+Math.floor(serial)*86400000);
  return d.toISOString().slice(0,10);
}
async function readRows(file,onRow){
  if(!/\.xlsx$/i.test(file.name))throw Error("Importer un fichier .xlsx, pas .xls. Pour .xls, exporter au format .xlsx.");
  if(file.size>30*1024*1024)throw Error("XLSX de plus de 30 Mo : demandez une extraction CSV.");
  const zip=zipFiles(await file.arrayBuffer());
  const names=[...zip.files.keys()],shared=names.includes("xl/sharedStrings.xml")
    ?elems(xml(await extract(zip,"xl/sharedStrings.xml"),"sharedStrings"),"si").map(si=>elems(si,"t").map(t=>t.textContent).join(""))
    :[];
  let name="xl/worksheets/sheet1.xml";
  if(names.includes("xl/workbook.xml")&&names.includes("xl/_rels/workbook.xml.rels")){
    const w=xml(await extract(zip,"xl/workbook.xml"),"workbook");
    const all=[...w.getElementsByTagNameNS(NS,"sheet")];
    const sheet=all.find(s=>/VENTES|SALES|EXPORT/i.test(s.getAttribute("name")||""))||all[0];
    const rid=sheet?.getAttribute("r:id")||sheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
    const rel=xml(await extract(zip,"xl/_rels/workbook.xml.rels"),"relationships");
    const node=[...rel.getElementsByTagName("Relationship")].find(r=>r.getAttribute("Id")===rid);
    const target=node?.getAttribute("Target");
    if(target)name=target.startsWith("/")?target.slice(1):"xl/"+target.replace(/^\.\//,"");
  }
  const doc=xml(await extract(zip,name),"worksheet");
  const rows=elems(doc,"row");
  let header=null,count=0;
  for(const row of rows){
    const cells=elems(row,"c"),max=Math.max(29,...cells.map(c=>cellNumber(c.getAttribute("r")||"")+1));
    const values=Array(max).fill("");
    for(const c of cells){
      const col=cellNumber(c.getAttribute("r")||"");if(col<0)continue;
      const t=c.getAttribute("t");let val="";
      const v=elems(c,"v")[0];
      if(t==="inlineStr")val=elems(c,"t").map(x=>x.textContent).join("");
      else if(v){val=t==="s"?(shared[Number(v.textContent)]??""):v.textContent}
      values[col]=val;
    }
    if(!header){header=values.map(x=>String(x).trim());const dateCol=header.indexOf("Date");onRow(header)}
    else{const col=header.indexOf("Date");if(col>=0&&values[col]&&!/^\d{4}-\d{2}-\d{2}$/.test(String(values[col])))values[col]=normalizeDateSerial(values[col]);onRow(values)}
    count++;
  }
  return count;
}
window.VeneziaExcel={readRows};
})();