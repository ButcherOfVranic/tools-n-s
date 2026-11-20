/* export.js — PowerPoint (.pptx), Excel (.xlsx), paylaşım HTML'i. Ek kütüphane yok. © Muhammed Emin URAL */

// ================= ZIP (Office dosyaları zip'tir) =================
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRCT[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
async function deflateRaw(u8){if(typeof CompressionStream==='undefined')return null;try{const cs=new CompressionStream('deflate-raw');const w=cs.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(cs.readable).arrayBuffer());}catch(e){return null;}}
async function makeZip(files,type){
  const te=new TextEncoder(),parts=[],cent=[];let off=0;const d0=new Date();
  const dt=((d0.getFullYear()-1980)<<9)|((d0.getMonth()+1)<<5)|d0.getDate(),tm=(d0.getHours()<<11)|(d0.getMinutes()<<5)|(d0.getSeconds()>>1);
  for(const f of files){
    const nm=te.encode(f.name),raw=typeof f.data==='string'?te.encode(f.data):f.data,crc=crc32(raw);
    let data=raw,meth=0;if(!f.store&&raw.length>256){const z=await deflateRaw(raw);if(z&&z.length<raw.length){data=z;meth=8;}}
    const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,meth,true);h.setUint16(10,tm,true);h.setUint16(12,dt,true);
    h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,raw.length,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),nm,data);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,meth,true);c.setUint16(12,tm,true);c.setUint16(14,dt,true);
    c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,raw.length,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
    cent.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+data.length;
  }
  const cs=cent.reduce((s,x)=>s+x.length,0),e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
  return new Blob([...parts,...cent,new Uint8Array(e.buffer)],{type});
}
const xe=s=>String(s??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const XH='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const stamp=()=>{const d=new Date();return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;};

// ================= görsel baytları =================
// q: 'orig' | 'hi' (1800px JPEG) | 'mid' (1300px) | 'lo' (900px)
const QMAX={hi:1800,mid:1300,lo:900};
async function imgBytes(src,q){
  if(q==='orig'){const r=await fetch(src);if(!r.ok)throw new Error('HTTP '+r.status);const b=new Uint8Array(await r.arrayBuffer());const im=await loadImage(src);
    const ext=b[0]===0x89?'png':(b[0]===0xFF?'jpeg':(b[0]===0x47?'gif':'png'));return{bytes:b,w:im.naturalWidth,h:im.naturalHeight,ext};}
  const im=await loadImage(src);const mx=QMAX[q]||1300,sc=Math.min(1,mx/im.naturalWidth);const w=Math.round(im.naturalWidth*sc),h=Math.round(im.naturalHeight*sc);
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(im,0,0,w,h);
  const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',q==='lo'?.82:.88));if(!blob)throw new Error('kodlanamadı');
  return{bytes:new Uint8Array(await blob.arrayBuffer()),w,h,ext:'jpeg'};
}
const b64=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s);};

// ================= EXCEL =================
function colL(i){let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;}
// stiller: 0 normal, 1 başlık, 2 kalın, 3..9 sayı (0..6 hane), 10..16 sayı ref satırı, 17 metin ref, 18 metin kaydırmalı, 19 yeşil sayı, 20 kırmızı sayı (3 hane)
function xlsxStyles(){
  const nf=[0,1,2,3,4,5,6].map(d=>`<numFmt numFmtId="${164+d}" formatCode="${d?'0.'+'0'.repeat(d):'0'}"/>`).join('');
  const num=(d,fill)=>`<xf numFmtId="${164+d}" fontId="0" fillId="${fill}" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>`;
  const xfs=['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>',
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>',
    ...[0,1,2,3,4,5,6].map(d=>num(d,0)),...[0,1,2,3,4,5,6].map(d=>num(d,3)),
    '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>',
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>',
    `<xf numFmtId="167" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>`,
    `<xf numFmtId="167" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>`];
  const fill=c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`;
  return XH+`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="7">${nf}</numFmts>`+
    `<fonts count="3"><font><sz val="10"/><name val="Segoe UI"/><family val="2"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/><family val="2"/></font><font><b/><sz val="10"/><name val="Segoe UI"/><family val="2"/></font></fonts>`+
    `<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill('1F2A44')}${fill('FFF6D6')}${fill('D9F2E0')}${fill('FBDCDC')}</fills>`+
    `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE4E7EC"/></left><right style="thin"><color rgb="FFE4E7EC"/></right><top style="thin"><color rgb="FFE4E7EC"/></top><bottom style="thin"><color rgb="FFE4E7EC"/></bottom><diagonal/></border></borders>`+
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`+
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}
function sheetXML(sh){
  const rows=sh.rows.map((r,ri)=>`<row r="${ri+1}"${sh.hh&&ri===0?' ht="30" customHeight="1"':''}>`+r.map((c,ci)=>{
    if(c==null||c==='')return'';const ref=colL(ci)+(ri+1);let v=c,s=0;if(typeof c==='object'){v=c.v;s=c.s||0;}
    if(v==null||v===''){return s?`<c r="${ref}" s="${s}"/>`:'';}
    if(typeof v==='number'&&isFinite(v))return`<c r="${ref}" s="${s}"><v>${+v.toPrecision(15)}</v></c>`;
    return`<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;}).join('')+'</row>').join('');
  const fr=sh.freeze||{r:1,c:0};const tl=colL(fr.c)+(fr.r+1);
  const pane=(fr.r||fr.c)?`<pane${fr.c?` xSplit="${fr.c}"`:''}${fr.r?` ySplit="${fr.r}"`:''} topLeftCell="${tl}" activePane="${fr.r&&fr.c?'bottomRight':fr.r?'bottomLeft':'topRight'}" state="frozen"/>`:'';
  const cols=(sh.widths||[]).length?'<cols>'+sh.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')+'</cols>':'';
  return XH+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData></worksheet>`;
}
async function buildXlsx(){
  const rows=selected(),mm=ovMetrics(false),allm=ovMetrics(true),ds=d=>Math.min(6,Math.max(0,d??4));
  const H=t=>({v:t,s:1});const sheets=[];
  const stat=bestWorst(rows,mm);
  // Özet
  const meta=['Analiz','Klasör','Durum','Ne değişti','Etiketler'];
  sheets.push({name:'Özet',hh:1,freeze:{r:1,c:1},widths:[22,18,13,40,18,...mm.map(()=>14)],rows:[[...meta.map(H),...mm.map(m=>H(m.label+(m.unit?' ['+m.unit+']':'')))],
    ...rows.map(a=>{const N=M.notes[a.name]||{},rf=a.name===REF;return[{v:dn(a.name)+(rf?' (ref)':''),s:rf?17:2},a.name,stLabel(N.status).replace('—',''),N.desc||'',N.tags||'',
      ...mm.map(m=>{const v=mval(a.name,m.key);const st=stat[m.key];if(v!=null&&st&&!rf&&m.digits===3&&(v===st.best||v===st.worst))return{v,s:v===st.best?19:20};return{v,s:(rf?10:3)+ds(m.digits)};})];})]});
  // Δ% referansa göre
  if(REF)sheets.push({name:'Fark (% ref)',hh:1,freeze:{r:1,c:1},widths:[22,...mm.map(()=>14)],rows:[[H('Analiz'),...mm.map(m=>H(m.label+' Δ%'))],
    ...rows.map(a=>[{v:dn(a.name),s:2},...mm.map(m=>{const v=mval(a.name,m.key),r=mval(REF,m.key);return(v!=null&&r)?{v:(v-r)/Math.abs(r)*100,s:5}:null;})])]});
  // Notlar
  sheets.push({name:'Notlar',hh:1,freeze:{r:1,c:1},widths:[22,18,14,18,40,50,60,50],rows:[['Analiz','Klasör','Durum','Türetildiği','Ne değişti','Değişiklikler','Not','Günlük'].map(H),
    ...A.map(a=>{const N=M.notes[a.name]||{};return[{v:dn(a.name),s:2},a.name,stLabel(N.status).replace('—',''),N.parent?dn(N.parent):'',{v:N.desc||'',s:18},{v:(N.changes||[]).filter(c=>c.what||c.chg).map(c=>`• ${c.what||''}: ${c.chg||''}`).join('\n'),s:18},{v:N.text||'',s:18},{v:(N.log||[]).map(l=>l.t+'  '+l.text).join('\n'),s:18}];})]});
  // Profiller (geniş biçim: her analiz için x,y sütunları)
  M.profiles.forEach(p=>{const ser=profSeries(p,rows,false);if(!ser.length)return;const n=Math.max(...ser.map(s=>s.x.length));
    const hdr=[];ser.forEach(s=>hdr.push(H(s.name+' · '+(s.xl||'x')),H(s.name+' · '+(p.ylabel||s.yl||'y'))));
    const r=[hdr];for(let i=0;i<n;i++){const row=[];ser.forEach(s=>row.push(s.x[i]??null,s.y[i]??null));r.push(row);}
    r.push([]);r.push([H('Analiz'),H('Maks'),H('Maks konumu'),H('Ortalama (span)')]);ser.forEach(s=>{const sr=getSer(byName(s.an),p);r.push([{v:s.name,s:2},s.max?s.max.y:null,s.max?s.max.x:null,sr?.st.imean??sr?.st.mean??null]);});
    sheets.push({name:('Profil '+p.label).replace(/[\[\]:*?/\\]/g,' ').slice(0,31),hh:1,freeze:{r:1,c:0},widths:hdr.map(()=>16),rows:r});});
  // Debi
  if(M.splits.length)sheets.push({name:'Debi dağılımı',hh:1,freeze:{r:1,c:1},widths:[24,...rows.map(()=>14)],rows:[[H('Grup [%]'),...rows.map(a=>H(dn(a.name)))],
    ...M.splits.map((g,i)=>[{v:g.label,s:2},...rows.map(a=>({v:mval(a.name,'split_'+i),s:(a.name===REF?10:3)+2}))]),[{v:'Σ',s:2},...rows.map(a=>({v:mval(a.name,'split_sum'),s:5}))]]});
  // Katalog (ham değerler)
  sheets.push({name:'Ham değerler',hh:1,freeze:{r:1,c:4},widths:[12,30,10,30,...rows.map(()=>15)],rows:[['Tür','Değişken','Birim','Yüzey'].map(H).concat(rows.map(a=>H(dn(a.name)))),
    ...[...CAT.values()].sort((a,b)=>descSc(a.k).localeCompare(descSc(b.k))).map(c=>[KIND[c.kind]||c.kind,[...c.vs].join(' ≡ '),c.unit,[...c.ss].join(' ≡ '),...rows.map(a=>{const s=a.scm.get(c.k);return s?s.v:null;})])]});
  // Bilgi
  sheets.push({name:'Bilgi',widths:[28,90],freeze:{r:0,c:0},rows:[[{v:'Combustor Post-Process',s:2},'v'+D.version],['Hazırlayan',AUTHOR],['Oluşturulma',nowStr()],['Analiz klasörü',D.root],['Referans',dn(REF||'')],['Operating pressure [Pa]',+M.op||0],
    [],[{v:'Tanımlar',s:2}],['dP/P','(Pt1 − Pt2)/Pt1 · 100, mutlak basınçla'],['OTDF','(T maks çıkış − Tt çıkış)/(Tt çıkış − Tt giriş)'],['RTDF','(circ-avg profil maks − Tt çıkış)/(Tt çıkış − Tt giriş)'],['Difüzör Cp','(Ps dif − Ps giriş)/(Pt giriş − Ps giriş)'],['Debi dağılımı','Σ|debi| grup / giriş debisi · 100'],
    ...M.formulas.map(f=>[f.label||f.name,f.expr+(f.unit?'  ['+f.unit+']':'')])]});
  const ct=sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  const files=[{name:'[Content_Types].xml',data:XH+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ct}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`},
    {name:'_rels/.rels',data:XH+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`},
    {name:'docProps/core.xml',data:corePropsXML('Combustor post-process sonuçları')},{name:'docProps/app.xml',data:XH+`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Combustor Post-Process (${xe(AUTHOR)})</Application></Properties>`},
    {name:'xl/workbook.xml',data:XH+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xe(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`},
    {name:'xl/_rels/workbook.xml.rels',data:XH+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:'xl/styles.xml',data:xlsxStyles()},...sheets.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXML(s)}))];
  return makeZip(files,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
function corePropsXML(title){const d=new Date().toISOString().replace(/\.\d+Z$/,'Z');
  return XH+`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(title)}</dc:title><dc:creator>${xe(AUTHOR)}</dc:creator><cp:lastModifiedBy>${xe(AUTHOR)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${d}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${d}</dcterms:modified></cp:coreProperties>`;}

// ================= POWERPOINT =================
const C={navy:'1F2A44',acc:'2457D6',acc2:'F59E0B',gray:'667085',light:'F4F6FA',line:'E4E7EC',good:'D9F2E0',bad:'FBDCDC',ref:'FFF6D6',white:'FFFFFF',fg:'1D2330'};
const PF='Segoe UI';
const EMU=v=>Math.round(v*914400);
class Deck{
  constructor(){this.slides=[];this.media=[];}
  add(o){const s=Object.assign({sh:[],rels:[],nid:2,bg:null,footer:true},o||{});this.slides.push(s);return s;}
  img(s,im){const n=this.media.length+1,nm=`image${n}.${im.ext==='jpeg'?'jpeg':im.ext}`;this.media.push({nm,bytes:im.bytes});s.rels.push({id:'rId'+(s.rels.length+2),t:'../media/'+nm});return s.rels[s.rels.length-1].id;}
}
function runX(r){const sz=Math.round((r.sz||14)*100);return `<a:r><a:rPr lang="tr-TR" sz="${sz}"${r.b?' b="1"':''}${r.i?' i="1"':''} dirty="0"><a:solidFill><a:srgbClr val="${r.c||C.fg}"/></a:solidFill><a:latin typeface="${r.f||PF}"/><a:cs typeface="${r.f||PF}"/></a:rPr><a:t>${xe(r.t)}</a:t></a:r>`;}
// paras: [ {runs:[..]|t, algn, sz, b, c, bul, sp} ]
function paraX(p,def){if(typeof p==='string')p={t:p};const o=Object.assign({},def,p);const runs=o.runs||[{t:o.t,sz:o.sz,b:o.b,c:o.c,i:o.i}];
  const ppr=`<a:pPr algn="${o.algn||'l'}"${o.bul?' marL="228600" indent="-228600"':''}>${o.sp?`<a:spcBef><a:spcPts val="${o.sp*100}"/></a:spcBef>`:''}${o.bul?`<a:buFont typeface="Arial"/><a:buChar char="•"/>`:'<a:buNone/>'}</a:pPr>`;
  return `<a:p>${ppr}${runs.map(r=>runX(Object.assign({sz:o.sz,b:o.b,c:o.c},r))).join('')}</a:p>`;}
function shp(s,x,y,w,h,o){o=o||{};const id=s.nid++;
  const fill=o.fill?`<a:solidFill><a:srgbClr val="${o.fill}"/></a:solidFill>`:'<a:noFill/>';
  const ln=o.line?`<a:ln w="${o.lw||9525}"><a:solidFill><a:srgbClr val="${o.line}"/></a:solidFill></a:ln>`:'<a:ln><a:noFill/></a:ln>';
  const tx=o.paras?`<p:txBody><a:bodyPr wrap="square" lIns="${EMU(o.ins??0.08)}" tIns="${EMU(0.04)}" rIns="${EMU(o.ins??0.08)}" bIns="${EMU(0.04)}" anchor="${o.anchor||'t'}">${o.fit?'<a:normAutofit/>':'<a:noAutofit/>'}</a:bodyPr><a:lstStyle/>${o.paras.map(p=>paraX(p,o.def||{})).join('')}</p:txBody>`:'';
  s.sh.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="S${id}"/><p:cNvSpPr${o.paras?' txBox="1"':''}/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${EMU(x)}" y="${EMU(y)}"/><a:ext cx="${EMU(w)}" cy="${EMU(h)}"/></a:xfrm><a:prstGeom prst="${o.geom||'rect'}"><a:avLst/></a:prstGeom>${fill}${ln}</p:spPr>${tx}</p:sp>`);}
function txt(s,x,y,w,h,paras,o){shp(s,x,y,w,h,Object.assign({paras:Array.isArray(paras)?paras:[paras]},o||{}));}
function pic(deck,s,x,y,w,h,im,o){o=o||{};const r=Math.min(w/im.w,h/im.h),pw=im.w*r,ph=im.h*r,px=x+(w-pw)/2,py=o.top?y:y+(h-ph)/2;const rid=deck.img(s,im),id=s.nid++;
  s.sh.push(`<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="P${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${EMU(px)}" y="${EMU(py)}"/><a:ext cx="${EMU(pw)}" cy="${EMU(ph)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${o.border?`<a:ln w="6350"><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:ln>`:''}</p:spPr></p:pic>`);
  return{x:px,y:py,w:pw,h:ph};}
// hücre: string | {t, b, c, fill, algn, sub, sz}
function table(s,x,y,colW,rows,o){o=o||{};const id=s.nid++,rh=o.rh||0.34,sz=o.sz||11;
  const bd=`<a:lnL w="6350"><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:lnL><a:lnR w="6350"><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:lnR><a:lnT w="6350"><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:lnT><a:lnB w="6350"><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:lnB>`;
  const tr=rows.map((r,ri)=>`<a:tr h="${EMU(rh)}">`+r.map((c,ci)=>{if(c==null)c='';if(typeof c!=='object')c={t:String(c)};const hdr=ri===0&&o.header!==false;
    const col=c.c||(hdr?C.white:C.fg),fill=c.fill||(hdr?C.navy:(ri%2===0?'F9FAFB':C.white));const al=c.algn||(o.al&&o.al[ci])||(ci===0?'l':(hdr?'ctr':'r'));
    const ps=String(c.t??'').split('\n').map(t=>paraX({t,algn:al,sz:c.sz||sz,b:c.b||hdr,c:col})).join('')+(c.sub?paraX({t:c.sub,algn:al,sz:Math.max(7,(c.sz||sz)-3),c:c.subc||C.gray}):'');
    return `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${ps}</a:txBody><a:tcPr marL="${EMU(.06)}" marR="${EMU(.06)}" marT="${EMU(.03)}" marB="${EMU(.03)}" anchor="ctr">${bd}<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill></a:tcPr></a:tc>`;}).join('')+'</a:tr>').join('');
  const W=colW.reduce((a,b)=>a+b,0);
  s.sh.push(`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="T${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${EMU(x)}" y="${EMU(y)}"/><a:ext cx="${EMU(W)}" cy="${EMU(rh*rows.length)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>${colW.map(w=>`<a:gridCol w="${EMU(w)}"/>`).join('')}</a:tblGrid>${tr}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`);}
const SW=13.333,SH=7.5;
function contentSlide(deck,title,sub){const s=deck.add();
  shp(s,0,0,SW,0.09,{fill:C.navy});shp(s,0.5,0.42,0.07,0.55,{fill:C.acc});
  txt(s,0.65,0.3,12.2,0.75,{t:title,sz:24,b:true,c:C.navy},{anchor:'ctr'});
  if(sub)txt(s,0.65,0.98,12.2,0.38,{t:sub,sz:12,c:C.gray});
  return s;}
function chunk(a,n){const r=[];for(let i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r.length?r:[[]];}
function slideXML(s){
  const bg=s.bg?`<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${s.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`:'';
  return XH+`<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld>${bg}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${s.sh.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;}
async function deckZip(deck,title){
  const N=deck.slides.length;
  deck.slides.forEach((s,i)=>{if(!s.footer)return;
    shp(s,0.5,7.02,12.33,0.01,{fill:C.line});
    txt(s,0.5,7.06,9,0.3,{runs:[{t:'Combustor Post-Process',b:true,c:C.navy},{t:'  ·  '+AUTHOR+'  ·  '+nowStr().slice(0,10),c:C.gray}],sz:9});
    txt(s,10.8,7.06,2.03,0.3,{t:`${i+1} / ${N}`,sz:9,c:C.gray,algn:'r'});});
  const NSA='xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const RT='http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const rels=l=>XH+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${l.map(r=>`<Relationship Id="${r[0]}" Type="${r[1].startsWith('http')?r[1]:RT+r[1]}" Target="${r[2]}"/>`).join('')}</Relationships>`;
  const grp='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  const clr=(n,v)=>`<a:${n}><a:srgbClr val="${v}"/></a:${n}>`;
  const theme=XH+`<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="CPP"><a:themeElements><a:clrScheme name="CPP"><a:dk1><a:srgbClr val="1D2330"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>${clr('dk2',C.navy)}${clr('lt2',C.light)}${clr('accent1',C.acc)}${clr('accent2',C.acc2)}${clr('accent3','2CA02C')}${clr('accent4','D62728')}${clr('accent5','9467BD')}${clr('accent6','17BECF')}${clr('hlink',C.acc)}${clr('folHlink','7F56D9')}</a:clrScheme>`+
    `<a:fontScheme name="CPP"><a:majorFont><a:latin typeface="${PF}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${PF}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>`+
    `<a:fmtScheme name="CPP"><a:fillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${'<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
  const master=XH+`<p:sldMaster ${NSA}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${grp}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
  const layout=XH+`<p:sldLayout ${NSA} type="blank" preserve="1"><p:cSld name="Boş"><p:spTree>${grp}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  const pres=XH+`<p:presentation ${NSA} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${deck.slides.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+10}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  const exts=[...new Set(deck.media.map(m=>m.nm.split('.').pop()))];
  const files=[
    {name:'[Content_Types].xml',data:XH+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${exts.map(e=>`<Default Extension="${e}" ContentType="image/${e}"/>`).join('')}<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>${deck.slides.map((_,i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`},
    {name:'_rels/.rels',data:rels([['rId1','officeDocument','ppt/presentation.xml'],['rId2','http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties','docProps/core.xml'],['rId3','extended-properties','docProps/app.xml']])},
    {name:'docProps/core.xml',data:corePropsXML(title)},
    {name:'docProps/app.xml',data:XH+`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Combustor Post-Process (${xe(AUTHOR)})</Application><Slides>${N}</Slides></Properties>`},
    {name:'ppt/presentation.xml',data:pres},
    {name:'ppt/_rels/presentation.xml.rels',data:rels([['rId1','slideMaster','slideMasters/slideMaster1.xml'],['rId2','theme','theme/theme1.xml'],['rId3','presProps','presProps.xml'],['rId4','viewProps','viewProps.xml'],['rId5','tableStyles','tableStyles.xml'],...deck.slides.map((_,i)=>['rId'+(i+10),'slide',`slides/slide${i+1}.xml`])])},
    {name:'ppt/presProps.xml',data:XH+`<p:presentationPr ${NSA}/>`},
    {name:'ppt/viewProps.xml',data:XH+`<p:viewPr ${NSA}><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`},
    {name:'ppt/tableStyles.xml',data:XH+`<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`},
    {name:'ppt/theme/theme1.xml',data:theme},
    {name:'ppt/slideMasters/slideMaster1.xml',data:master},
    {name:'ppt/slideMasters/_rels/slideMaster1.xml.rels',data:rels([['rId1','slideLayout','../slideLayouts/slideLayout1.xml'],['rId2','theme','../theme/theme1.xml']])},
    {name:'ppt/slideLayouts/slideLayout1.xml',data:layout},
    {name:'ppt/slideLayouts/_rels/slideLayout1.xml.rels',data:rels([['rId1','slideMaster','../slideMasters/slideMaster1.xml']])},
    ...deck.slides.flatMap((s,i)=>[{name:`ppt/slides/slide${i+1}.xml`,data:slideXML(s)},{name:`ppt/slides/_rels/slide${i+1}.xml.rels`,data:rels([['rId1','slideLayout','../slideLayouts/slideLayout1.xml'],...s.rels.map(r=>[r.id,'image',r.t])])}]),
    ...deck.media.map(m=>({name:'ppt/media/'+m.nm,data:m.bytes,store:true}))];
  return makeZip(files,'application/vnd.openxmlformats-officedocument.presentationml.presentation');
}
const PPT_SECTIONS=[['list','Analiz listesi'],['notes','Analiz notları (her analiz için)'],['table','Özet tablosu'],['charts','Metrik grafikleri'],['prof','Profiller'],['split','Debi dağılımı'],['sec','Kesit üzerinde debi (her analiz)'],['img','Görsel karşılaştırmaları'],['method','Yöntem ve tanımlar']];
async function buildPPT(o,prog){
  const rows=selected(),deck=new Deck(),ref=REF&&rows.some(a=>a.name===REF)?REF:null;
  if(!rows.length)throw new Error('soldan en az bir analiz seç');
  const has=k=>o.sec.includes(k)&&(k!=='method'||EXTRA.method);
  const T=(t,f)=>{prog(t);return f;};
  // --- kapak
  const cv=deck.add({bg:C.navy,footer:false});
  shp(cv,0,6.9,SW,0.6,{fill:'18213A'});shp(cv,0.8,2.15,0.09,2.05,{fill:C.acc2});
  txt(cv,1.05,1.95,11.3,1.25,{t:o.title||'Yanma Odası CFD Sonuçları',sz:40,b:true,c:C.white},{anchor:'b'});
  txt(cv,1.05,3.2,11.3,0.6,{t:o.subtitle||'Analiz karşılaştırması',sz:20,c:'C7D2FE'});
  txt(cv,1.05,3.85,11.3,0.45,{t:`${rows.length} analiz${ref?'  ·  Referans: '+dn(ref):''}  ·  ${nowStr().slice(0,10)}`,sz:14,c:'AAB4CF'});
  txt(cv,0.8,6.95,11.7,0.5,{runs:[{t:'Hazırlayan: ',c:'AAB4CF'},{t:o.author||AUTHOR,b:true,c:C.white},{t:'   ·   Combustor Post-Process',c:'AAB4CF'}],sz:12},{anchor:'ctr'});
  // --- içindekiler
  const secs=PPT_SECTIONS.filter(([k])=>has(k)&&!(k==='sec'&&!store.get('secimg',null))&&!(k==='split'&&!M.splits.length)&&!(k==='prof'&&!M.profiles.length));
  if(secs.length>2){const s=contentSlide(deck,'İçerik');secs.forEach(([k,l],i)=>{const y=1.65+i*0.55;txt(s,0.9,y,0.8,0.5,{t:pad(i+1),sz:22,b:true,c:C.acc});txt(s,1.7,y+0.03,10,0.5,{t:l.replace(/ \(.*\)$/,''),sz:18,c:C.fg},{anchor:'ctr'});});}
  // --- analiz listesi
  if(has('list')){T('analiz listesi');chunk(rows,11).forEach((ch,ci)=>{const s=contentSlide(deck,'Analizler'+(ci?' (devam)':''),'Bu sunumdaki analizler ve her birinde neyin değiştiği');
    table(s,0.5,1.5,[0.45,2.7,1.55,5.5,2.13],[['#','Analiz','Durum','Ne değişti','Etiketler'],...ch.map((a,i)=>{const N=M.notes[a.name]||{};return[String(ci*11+i+1),{t:dn(a.name)+(a.name===ref?'  (ref)':''),b:true,fill:a.name===ref?C.ref:null},{t:N.status?stLabel(N.status):'',c:stColor(N.status).slice(1).toUpperCase()},{t:N.desc||changesText(a.name)||'',algn:'l'},{t:N.tags||'',algn:'l',c:C.gray}];})],{rh:0.42,sz:11,al:['ctr','l','l','l','l']});});}
  // --- notlar
  if(has('notes'))rows.forEach(a=>{const N=M.notes[a.name]||{};const chs=(N.changes||[]).filter(c=>c.what||c.chg);const hasBase=(EXTRA.parent&&N.parent)||(a.name!==ref&&ref);if(!N.text&&!chs.length&&!(N.log||[]).length&&!(hasBase&&(N.desc||N.status)))return;T('notlar: '+dn(a.name));
    const s=contentSlide(deck,dn(a.name),[N.status?stLabel(N.status):'',N.desc||'',N.parent&&EXTRA.parent?'türetildiği: '+dn(N.parent):''].filter(Boolean).join('  ·  '));
    let y=1.5;
    if(chs.length){txt(s,0.5,y,6.3,0.35,{t:'Değişiklikler',sz:14,b:true,c:C.navy});y+=0.4;const sh=chs.slice(0,10);table(s,0.5,y,[2.6,3.7],[['Ne','Değişim'],...sh.map(c=>[{t:c.what||'',algn:'l'},{t:c.chg||'',algn:'l'}])],{rh:0.36,sz:11,al:['l','l']});y+=0.36*(sh.length+1)+0.25;}
    const body=[];if(N.text)String(N.text).split('\n').filter(Boolean).slice(0,12).forEach(l=>body.push({t:l,sz:12,bul:true,sp:3}));
    if((N.log||[]).length){body.push({t:'Günlük',sz:13,b:true,c:C.navy,sp:8});N.log.slice(0,6).forEach(l=>body.push({runs:[{t:l.t+'  ',c:C.gray,sz:10},{t:l.text,sz:11}],sp:2}));}
    if(body.length)txt(s,0.5,y,6.3,Math.max(0.6,6.85-y),[{t:'Not',sz:14,b:true,c:C.navy},...body],{fit:true});
    const base=(EXTRA.parent&&N.parent)||(a.name!==ref?ref:null);
    if(base){const kd=keyDiff(a.name,base).slice(0,13);txt(s,7.1,1.5,5.7,0.35,{t:'Sonuçlar — '+dn(base)+' ile',sz:14,b:true,c:C.navy});
      table(s,7.1,1.9,[2.5,1.1,1.1,1.0],[['Metrik',dn(a.name).slice(0,14),dn(base).slice(0,14),'Fark'],...kd.map(x=>{const bad=x.dv!=null&&x.d.better&&((x.d.better==='low'&&x.dv>0)||(x.d.better==='high'&&x.dv<0)),good=x.dv!=null&&x.d.better&&x.dv!==0&&!bad;
        return[{t:x.d.label,sz:10},fmt(x.v,x.d.digits),{t:fmt(x.r,x.d.digits),c:C.gray},{t:x.dv==null?'–':(x.dv>0?'+':'')+fmt(x.dv,x.d.digits),fill:good?C.good:bad?C.bad:null}];})],{rh:0.33,sz:10});}});
  // --- özet tablosu
  if(has('table')){T('özet tablosu');const mm=ovMetrics(false),stat=bestWorst(rows,mm);
    chunk(rows,6).forEach(rc=>chunk(mm,13).forEach((mc,mi)=>{const s=contentSlide(deck,'Özet tablosu'+(mi?' (devam)':''),'Yeşil = en iyi, kırmızı = en kötü'+(ref?' · küçük satır: referansa göre fark':''));
      const cw=Math.min(1.75,(12.33-3.3)/rc.length);
      table(s,0.5,1.5,[3.3,...rc.map(()=>cw)],[['Metrik',...rc.map(a=>({t:dn(a.name),fill:a.name===ref?'3B4A6B':C.navy,c:C.white,b:true,algn:'ctr'}))],
        ...mc.map(m=>[{t:m.label,sub:m.unit&&m.unit!=='-'?m.unit:'',b:true},...rc.map(a=>{const v=mval(a.name,m.key),r=ref?mval(ref,m.key):null,st=stat[m.key];
          const sub=(ref&&a.name!==ref&&v!=null&&r!=null&&r!==0)?((v-r)/Math.abs(r)*100>=0?'+':'')+fmt((v-r)/Math.abs(r)*100,1)+'%':'';
          return{t:fmt(v,m.digits),sub,fill:st&&v===st.best?C.good:st&&v===st.worst?C.bad:(a.name===ref?C.ref:null)};})])],{rh:0.37,sz:11});}));}
  // --- metrik grafikleri
  if(has('charts')){const defs=metricDefs();const ks=o.metrics.filter(k=>defs.some(d=>d.key===k)&&rows.some(a=>mval(a.name,k)!=null));
    for(const pr of chunk(ks,2)){if(!pr.length)break;T('grafik: '+pr.join(', '));const s=contentSlide(deck,pr.map(k=>defs.find(d=>d.key===k).label).join('  ·  '),'Çubuk etiketindeki % = referansa göre fark');
      for(let i=0;i<pr.length;i++){const d=defs.find(x=>x.key===pr[i]);const svg=barSVG(rows.map(a=>({name:dn(a.name),v:mval(a.name,d.key),color:color(a.name),ref:a.name===ref})),{W:760,rh:Math.max(30,Math.min(64,360/rows.length)),title:d.label,unit:d.unit,digits:d.digits,refv:ref?mval(ref,d.key):null});
        const im=await svgToPng(svg,2);pic(deck,s,pr.length===1?2.5:0.5+i*6.25,1.5,pr.length===1?8.3:6.05,5.35,im);}}}
  // --- profiller
  if(has('prof'))for(const p of M.profiles){const ser=profSeries(p,rows,false);if(!ser.length)continue;T('profil: '+p.label);
    const s=contentSlide(deck,p.label,(ser[0].span?'x: % span':'')+(p.id===M.rtdf?'  ·  RTDF bu profilin maksimumundan hesaplanır':''));
    const C2=chartSVG(ser,{W:1100,H:760,xlabel:ser[0].xl||'Span',ylabel:p.ylabel||ser[0].yl||'',swap:!!p.swap,markMax:true,legend:true,spanAxis:!!ser[0].span});
    pic(deck,s,0.4,1.45,8.2,5.5,await svgToPng(C2.svg,2));
    const rmax=ser.find(x=>x.ref)?.max?.y;
    table(s,8.8,1.6,[1.75,1.05,0.75,0.95],[['Analiz','Maks','Span','Δ maks'],...ser.slice(0,14).map(x=>[{t:x.name,fill:x.ref?C.ref:null,c:'000000',b:x.ref},sig(x.max.y,5),fmt(x.max.x,x.span?1:3),{t:(rmax!=null&&!x.ref)?((x.max.y-rmax>=0?'+':'')+sig(x.max.y-rmax,3)):'',c:C.gray}])],{rh:0.33,sz:10});}
  // --- debi
  if(has('split')&&M.splits.length){T('debi dağılımı');const s=contentSlide(deck,'Debi dağılımı','Giriş debisinin yüzdesi');
    const svg=stackSVG(rows.map(a=>({name:dn(a.name),vals:M.splits.map((_,i)=>mval(a.name,'split_'+i))})),M.splits.map((g,i)=>({label:g.label,color:PAL[i%PAL.length]})),{W:1300});
    const r1=pic(deck,s,0.5,1.45,12.33,rows.length>6?5.4:3.0,await svgToPng(svg,2),{top:true});
    if(rows.length<=6){const cw=Math.min(1.7,(12.33-2.6)/rows.length);table(s,0.5,r1.y+r1.h+0.2,[2.6,...rows.map(()=>cw)],[['Grup [%]',...rows.map(a=>({t:dn(a.name),algn:'ctr',fill:a.name===ref?'3B4A6B':C.navy,c:C.white,b:true}))],
      ...M.splits.map((g,i)=>[{t:g.label,b:true},...rows.map(a=>{const v=mval(a.name,'split_'+i),r=ref?mval(ref,'split_'+i):null;return{t:fmt(v,2),sub:(ref&&a.name!==ref&&v!=null&&r!=null)?((v-r>=0?'+':'')+fmt(v-r,2)+' pp'):''};})])],{rh:0.36,sz:10});}}
  if(has('sec')&&M.splits.length&&store.get('secimg',null)){const im0=await loadImage(store.get('secimg',null));
    for(const a of rows){T('kesit: '+dn(a.name));const s=contentSlide(deck,'Debi dağılımı — '+dn(a.name),ref&&a.name!==ref?'Kırmızı/yeşil: referansa ('+dn(ref)+') göre artış/azalış, yüzde puan':'');
      pic(deck,s,0.5,1.45,12.33,5.45,await secCanvas(im0,a.name,ref));}}
  // --- görseller
  if(has('img')){const G=imgGroups(rows,gv.f).filter(g=>o.groups.includes(g.label));
    for(const g of G){const have=rows.filter(a=>imgPick(g,a.name));for(const ch of chunk(have,4)){if(!ch.length)continue;T('görsel: '+g.label);
      const s=contentSlide(deck,g.label,'Görsel karşılaştırma');const n=ch.length,cols=n===4?2:n,rws=n===4?2:1,gw=12.33/cols,gh=(5.5/rws);
      for(let i=0;i<n;i++){const a=ch[i],cx=0.5+(i%cols)*gw,cy=1.45+Math.floor(i/cols)*gh;let im=null;
        try{im=await imgBytes(imgURL(a.name,imgPick(g,a.name)),o.q);}catch(e){}
        if(im)pic(deck,s,cx+0.08,cy,gw-0.16,gh-0.42,im,{border:true});else txt(s,cx,cy+gh/2-0.3,gw,0.5,{t:'görsel alınamadı',c:C.gray,algn:'ctr'});
        txt(s,cx,cy+gh-0.4,gw,0.36,{t:dn(a.name)+(a.name===ref?'  (ref)':''),sz:12,b:a.name===ref,c:C.navy,algn:'ctr'});}}}}
  // --- yöntem
  if(has('method')){const s=contentSlide(deck,'Yöntem ve tanımlar');const P=(t,b)=>({runs:[{t:b?b+': ':'',b:true,c:C.navy},{t}],sz:13,bul:true,sp:5});
    txt(s,0.5,1.5,12.3,5.4,[P('(Pt₁ − Pt₂)/Pt₁ · 100, mutlak basınçla'+(+M.op?` (operating pressure ${sig(+M.op)} Pa eklendi)`:''),'dP/P'),P('(T maks çıkış − Tt çıkış)/(Tt çıkış − Tt giriş)','OTDF'),
      P('(circ-avg profil maksimumu − Tt çıkış)/(Tt çıkış − Tt giriş); maksimumun span konumu ayrıca verilir','RTDF'),P('(Ps dif − Ps giriş)/(Pt giriş − Ps giriş)','Difüzör Cp'),P('grup yüzeylerinin |debi| toplamı / giriş debisi · 100','Debi dağılımı'),
      P('radius ya da 0–1 span olarak gelen profil x ekseni % span’e çevrildi','Profil ekseni'),...M.formulas.map(f=>P(f.expr+(f.unit?'  ['+f.unit+']':''),f.label||f.name)),
      P(ref?dn(ref):'—','Referans analiz'),{t:'Bu sunum Combustor Post-Process aracıyla otomatik oluşturuldu — '+AUTHOR,sz:11,c:C.gray,sp:14}],{fit:true});}
  prog('dosya hazırlanıyor…');
  return deckZip(deck,o.title||'Combustor post-process');
}
async function secCanvas(im,an,ref){
  const w=Math.min(1800,im.naturalWidth),h=Math.round(im.naturalHeight*w/im.naturalWidth),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(im,0,0,w,h);const k=w/900;
  M.splits.forEach((s,i)=>{const v=mval(an,'split_'+i),r=ref?mval(ref,'split_'+i):null,d=(v!=null&&r!=null&&an!==ref)?v-r:null;
    const l1=s.label,l2=v==null?'–':fmt(v,2)+' %',l3=d==null?'':(d>0?'+':'')+fmt(d,2)+' pp';
    g.font=`${12*k}px Segoe UI`;const w1=g.measureText(l1).width;g.font=`bold ${15*k}px Segoe UI`;const w2=g.measureText(l2).width;g.font=`${11*k}px Segoe UI`;const w3=g.measureText(l3).width;
    const bw=Math.max(w1,w2,w3)+16*k,bh=(l3?52:38)*k,x=(s.x??.1)*w-bw/2,y=(s.y??.1)*h-bh/2;
    g.fillStyle='rgba(255,255,255,.94)';g.strokeStyle='#2457d6';g.lineWidth=1.5*k;g.beginPath();g.roundRect?g.roundRect(x,y,bw,bh,6*k):g.rect(x,y,bw,bh);g.fill();g.stroke();
    g.textAlign='center';g.fillStyle='#111';g.font=`${12*k}px Segoe UI`;g.fillText(l1,x+bw/2,y+14*k);g.font=`bold ${15*k}px Segoe UI`;g.fillText(l2,x+bw/2,y+31*k);
    if(l3){g.font=`${11*k}px Segoe UI`;g.fillStyle=d>0.005?'#b42318':d<-0.005?'#067647':'#555';g.fillText(l3,x+bw/2,y+46*k);}});
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));return{bytes:new Uint8Array(await blob.arrayBuffer()),w,h,ext:'png'};
}

// ================= PAYLAŞIM HTML'i (görseller gömülü, tek dosya) =================
async function buildShare(o,prog){
  const rows=selected(),G=imgGroups(rows,gv.f).filter(g=>o.groups.includes(g.label));
  const list=[];G.forEach(g=>rows.forEach(a=>{const p=o.allCand?(g.items.get(a.name)||[]):[imgPick(g,a.name)].filter(Boolean);p.forEach(x=>list.push([a.name,x]));}));
  const embed={};let tot=0,i=0,fail=0;
  for(const [an,p] of list){i++;prog(`görseller: ${i}/${list.length} · ${(tot/1048576).toFixed(1)} MB`);
    try{const im=await imgBytes(imgURL(an,p),o.q);const u='data:image/'+im.ext+';base64,'+b64(im.bytes);embed[an+'/'+p]=u;tot+=u.length;}catch(e){fail++;}}
  prog('dosya yazılıyor…');
  const r=await fetch('api/share',{method:'POST',body:JSON.stringify({name:o.name||'paylasim',sel:rows.map(a=>a.name),embed,mapping:M})}).then(x=>x.json());
  if(!r.ok)throw new Error(r.err);
  return{...r,n:Object.keys(embed).length,fail};
}

// ================= Dışa aktar penceresi =================
const DEF_METRICS=['dPP_comb','dPP_liner','OTDF','RTDF','Cp_diff','split_sum'];
function openExport(){
  const rows=selected(),G=imgGroups(rows,gv.f);
  const o=Object.assign({title:'Yanma Odası CFD Sonuçları',subtitle:'Analiz karşılaştırması',author:AUTHOR,sec:PPT_SECTIONS.map(s=>s[0]).filter(k=>k!=='sec'),metrics:DEF_METRICS,groups:null,q:'mid',name:'',allCand:false},store.get('expOpt',{}));
  if(!o.groups)o.groups=(M.img.groups||[]).length?M.img.groups.map(g=>g.label||g.pat):G.slice(0,8).map(g=>g.label);
  const keep=()=>store.set('expOpt',o);
  const md=el('div',{class:'modal',onclick:e=>{if(e.target===md)md.remove();}});
  const prog=el('div',{class:'prog'});const P=t=>prog.textContent=t;
  const run=async(f,b)=>{b.disabled=true;try{await f();}catch(e){P('HATA: '+e.message);console.error(e);}finally{b.disabled=false;}};
  const chk=(arr,k,l)=>el('label',{},el('input',{type:'checkbox',checked:arr.includes(k),onchange:e=>{const i=arr.indexOf(k);if(e.target.checked&&i<0)arr.push(k);if(!e.target.checked&&i>=0)arr.splice(i,1);keep();}}),l);
  const defs=metricDefs().filter(d=>rows.some(a=>mval(a.name,d.key)!=null));
  const grpBox=el('div',{class:'opt'},G.map(g=>chk(o.groups,g.label,`${g.user?'★ ':''}${g.label} (${g.items.size})`)));
  const qSel=el('select',{onchange:e=>{o.q=e.target.value;keep();}},[['orig','Orijinal (en büyük)'],['hi','Yüksek (1800 px JPEG)'],['mid','Dengeli (1300 px JPEG)'],['lo','Küçük (900 px JPEG)']].map(([k,l])=>el('option',{value:k},l)));qSel.value=o.q;
  const inp=(k,w)=>el('input',{type:'text',value:o[k]||'',style:`width:${w}px`,oninput:e=>{o[k]=e.target.value;keep();}});
  const bP=btn('PowerPoint oluştur',()=>run(async()=>{const b=await buildPPT(o,P);dl(`sunum_${stamp()}.pptx`,b);P(`✓ sunum indirildi (${(b.size/1048576).toFixed(1)} MB)`);},bP),'p');
  const bX=btn('Excel oluştur',()=>run(async()=>{P('hazırlanıyor…');const b=await buildXlsx();dl(`sonuclar_${stamp()}.xlsx`,b);P('✓ Excel indirildi');},bX),'p');
  const bS=btn('Paylaşım HTML’i oluştur',()=>run(async()=>{const r=await buildShare(o,P);P(`✓ ${r.path}  (${(r.size/1048576).toFixed(1)} MB, ${r.n} görsel${r.fail?', '+r.fail+' görsel alınamadı':''})`);fetch('api/open',{method:'POST',body:JSON.stringify({rel:'_paylasim'})});},bS),'p');
  const allG=(v)=>{o.groups=v?G.map(g=>g.label):[];keep();md.remove();openExport();};
  md.append(el('div',{class:'card'},
    el('div',{class:'tools'},el('h2',{style:'margin:0;flex:1'},'Dışa aktar'),el('button',{class:'x',onclick:()=>md.remove()},'✕')),
    help(`<b>${rows.length}</b> analiz (soldaki seçim, aynı sırayla) · referans: <b>${esc(dn(REF||''))}</b> · özet tablosu, Özet sekmesindeki görünür sütunları ve sırayı kullanır.`),
    el('h3',{},'PowerPoint sunumu'),
    el('div',{class:'tools'},'Başlık',inp('title',300),'Alt başlık',inp('subtitle',240),'Hazırlayan',inp('author',180)),
    el('div',{class:'opt'},PPT_SECTIONS.filter(([k])=>k!=='method'||EXTRA.method).map(([k,l])=>chk(o.sec,k,l))),
    el('div',{class:'mut'},'Metrik grafikleri:'),el('div',{class:'opt'},defs.map(d=>chk(o.metrics,d.key,d.label))),
    el('div',{class:'tools',style:'margin-top:6px'},el('span',{class:'mut'},'Görsel grupları (PowerPoint ve paylaşım HTML’i için):'),btn('hepsi',()=>allG(true)),btn('hiçbiri',()=>allG(false))),grpBox,
    el('div',{class:'tools'},'Görsel kalitesi:',qSel,bP),
    el('h3',{},'Excel'),help('Sayfalar: Özet, Fark (% ref), Notlar, her profil için veri, Debi dağılımı, Ham değerler, Bilgi.'),el('div',{class:'tools'},bX,btn('CSV (Özet)',()=>exportCSV())),
    el('h3',{},'Paylaşım HTML’i'),
    SERVE?[help('Tek dosya: tüm sonuçlar, grafikler, notlar ve seçili görsel grupları <b>içine gömülü</b>. Karşı taraf sadece çift tıklayıp açar, kurulum gerekmez. Boyutu küçük tutmak için görseller yeniden sıkıştırılır (yukarıdaki kalite). Dosya <code>'+esc(D.root)+'\\_paylasim</code> klasörüne yazılır.'),
      el('div',{class:'tools'},'Dosya adı',inp('name',220),el('label',{},el('input',{type:'checkbox',checked:o.allCand,onchange:e=>{o.allCand=e.target.checked;keep();}}),' gruptaki tüm aday görseller'),bS)]
      :help('Paylaşım HTML’i yalnızca <code>py postproc.py</code> ile açılan canlı modda oluşturulur.'),
    prog));
  document.body.append(md);
}
function exportCSV(){
  const rows=selected(),mm=ovMetrics(false);
  const q=s=>'"'+String(s).replace(/"/g,'""')+'"';
  const lines=[['Analiz','Klasör','Ne değişti','Etiket',...mm.map(m=>m.label+' ['+m.unit+']')].map(q).join(';')];
  rows.forEach(a=>{const N=M.notes[a.name]||{};lines.push([q(dn(a.name)),q(a.name),q(N.desc||''),q(N.tags||''),...mm.map(m=>{const v=mval(a.name,m.key);return v==null?'':String(+v.toPrecision(10)).replace('.',',');})].join(';'));});
  lines.push('',q('Combustor Post-Process · '+AUTHOR+' · '+new Date().toLocaleString('tr-TR')));
  dl('ozet.csv','\ufeff'+lines.join('\r\n'),'text/csv');
}
