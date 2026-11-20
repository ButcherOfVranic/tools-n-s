/* Combustor Post-Process Tool — © Muhammed Emin URAL. Tüm hakları saklıdır.
   core.js: yardımcılar, veri dizini, eşleme (mapping), hesaplar. */
const AUTHOR='Muhammed Emin URAL';
const D=__DATA__;
const SERVE=D.mode==='serve', SHARED=!!D.embed;
// Kullanıcının istemediği, benim eklediğim özellikler. Geri almak için false yap (bkz. README "Ek özellikler").
const EXTRA={
  conv:true,        // yakınsama kontrolü (.out geçmişinin son %10'u oynuyorsa uyarı)
  metricChart:true, // Özet altında seçili metriğin çubuk grafiği
  transpose:true,   // Özet tablosunu çevirme (satır = metrik)
  parent:true,      // notlarda "türetildiği analiz" ve ona göre farklar
  method:true,      // PowerPoint'te "Yöntem ve tanımlar" sayfası
  diffImg:true,     // görsel karşılaştırmada piksel farkı modu
  colHide:true,     // Özet'te sütun gizleme paneli
};
const $=s=>document.querySelector(s);
const PAL=['#1f77b4','#d62728','#2ca02c','#ff7f0e','#9467bd','#8c564b','#e377c2','#17becf','#bcbd22','#7f7f7f','#393b79','#ad494a','#637939','#843c39'];
const NS='http://www.w3.org/2000/svg';
function el(t,a,...c){const e=document.createElement(t);for(const k in(a||{})){const v=a[k];if(v==null||v===false)continue;if(k==='class')e.className=v;else if(k==='html')e.innerHTML=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='value')e.value=v;else if(k==='checked')e.checked=!!v;else e.setAttribute(k,v===true?'':v);}c.flat(9).forEach(x=>{if(x==null||x===false)return;e.append(x.nodeType?x:document.createTextNode(String(x)));});return e;}
function sv(t,a,p){const e=document.createElementNS(NS,t);for(const k in(a||{}))e.setAttribute(k,a[k]);if(p)p.append(e);return e;}
const SKEY='cbt3_'+String(D.root||'').toLowerCase()+'_';
const store={get(k,d){try{const v=localStorage.getItem(SKEY+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(SKEY+k,JSON.stringify(v));}catch(e){}}};
const fmt=(v,d)=>(v==null||!isFinite(v))?'–':Number(v).toFixed(d);
const sig=(v,p)=>(v==null||!isFinite(v))?'–':String(+Number(v).toPrecision(p||6));
const alnum=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const nrm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const btn=(t,f,cls,title)=>el('button',{class:'b '+(cls||''),onclick:f,title},t);
const card=(...c)=>el('div',{class:'card'},...c);
const help=t=>el('div',{class:'help',html:t});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const nowStr=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;};
function dl(name,data,type){const b=data instanceof Blob?data:new Blob([data],{type});const u=URL.createObjectURL(b);const a=el('a',{href:u,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
const enc=p=>p.split('/').map(encodeURIComponent).join('/');
const debounce=(f,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>f(...a),ms);};};
const imgURL=(an,rel)=>{const k=an+'/'+rel;return(D.embed&&D.embed[k])||(D.base+enc(k));};

// ================= veri dizini =================
const A=D.analyses;let names=A.map(a=>a.name);
if(SHARED)A.forEach(a=>a.img=a.img.filter(p=>D.embed[a.name+'/'+p]));
const COL=new Map(A.map((a,i)=>[a.name,PAL[i%PAL.length]]));   // renk klasöre bağlı: sıralama değişse de aynı kalır
const color=n=>COL.get(n)||'#888';
const byName=n=>A.find(a=>a.name===n);
const CAT=new Map(),SCAT=new Map();
let EQ={surf:new Map(),var:new Map(),ser:new Map()};
const canonSc=k=>{if(!k)return k;const p=k.split('|');if(p.length<3)return k;return p[0]+'|'+(EQ.var.get(p[1])||p[1])+'|'+(EQ.surf.get(p.slice(2).join('|'))||p.slice(2).join('|'));};
const canonSr=k=>k&&(EQ.ser.get(k)||k);
// Eşdeğer adları uygulayarak katalogları kur (eşdeğerler değişince yeniden çağrılır)
function buildIndex(){
  const mk=(g,f)=>{const m=new Map();(g||[]).forEach(grp=>{if(!grp||grp.length<2)return;const c=f(grp[0]);grp.forEach(n=>m.set(f(n),c));});return m;};
  const eq=M.eq||{};EQ={surf:mk(eq.surf,nrm),var:mk(eq.var,nrm),ser:mk(eq.ser,x=>x)};
  CAT.clear();SCAT.clear();
  A.forEach(a=>{
    a.scm=new Map();a.sc.forEach(s=>{a.scm.set(canonSc(s.k),s);});
    a.srm=new Map();a.sr.forEach(s=>{a.srm.set(canonSr(s.k),s);});
    a.scm.forEach((s,k)=>{let c=CAT.get(k);if(!c){const p=k.split('|');c={k,kind:s.kind,kt:s.kt,var:s.var,unit:s.unit,surf:s.surf,f:s.f,n:0,vs:new Set(),ss:new Set(),cv:p[1],cs:p.slice(2).join('|')};CAT.set(k,c);}
      c.n++;c.vs.add(s.var);c.ss.add(s.surf);if(nrm(s.surf)===c.cs)c.surf=s.surf;if(nrm(s.var)===c.cv)c.var=s.var;});
    a.srm.forEach((s,k)=>{let c=SCAT.get(k);if(!c){c={k,t:s.t,nm:s.nm,xl:s.xl,yl:s.yl,f:s.f,n:0,fs:new Set()};SCAT.set(k,c);}c.n++;c.fs.add(s.f);if(s.k===k){c.f=s.f;c.nm=s.nm;}});
  });
}
const KIND={mwa:'Kütle ort.',awa:'Alan ort.',mfr:'Debi',max:'Maks',min:'Min',rdef:'Report def.'};
function descSc(k){const c=CAT.get(canonSc(k));if(!c)return k?('(bu klasörde yok) '+k):'—';
  const alt=(s,cur)=>{const o=[...s].filter(x=>x!==cur);return o.length?' (≡ '+o.join(', ')+')':'';};
  return `${KIND[c.kind]||c.kt||c.kind} · ${c.var}${alt(c.vs,c.var)}${c.unit?' ['+c.unit+']':''}${c.surf?' @ '+c.surf+alt(c.ss,c.surf):''}`;}
function descSr(k){const c=SCAT.get(canonSr(k));if(!c)return k?('(bu klasörde yok) '+k):'—';
  return `${c.t==='hist'?'[yakınsama] ':''}${c.f}${c.fs.size>1?' (≡ '+[...c.fs].filter(x=>x!==c.f).join(', ')+')':''} · ${c.nm||'seri'}${c.yl&&c.yl!==c.nm?' ('+c.yl+')':''}`;}

// ================= eşleme (mapping) =================
const ROLES=[
 ['Pt_in','Pt giriş','pt','in'],['Pt_diff','Pt difüzör çıkışı','pt','diff'],['Pt_out','Pt çıkış','pt','out'],
 ['Ps_in','Ps giriş','ps','in'],['Ps_diff','Ps difüzör çıkışı','ps','diff'],
 ['Tt_in','Tt giriş','tt','in'],['Tt_out','Tt çıkış (ortalama)','tt','out'],
 ['Tmax_exit','T maks, çıkış düzlemi (OTDF için)','tmax','out'],
 ['mdot_in','Debi giriş','mfr','in'],['mdot_out','Debi çıkış','mfr','out'],
];
const RL=Object.fromEntries(ROLES.map(r=>[r[0],r[1]]));
const PSLOTS=[
 {id:'in_Pt',label:'Giriş - circ avg Pt',q:['circ','pres','in']},
 {id:'diff_Pt',label:'Difüzör çıkışı - circ avg Pt',q:['circ','pres','diff']},
 {id:'out_Pt',label:'Çıkış - circ avg Pt',q:['circ','pres','out']},
 {id:'out_T',label:'Çıkış - circ avg Tt',q:['circ','temp','out']},
 {id:'out_radT',label:'Çıkış - radyal avg Tt',q:['rad','temp','out']},
];
const blankMap=()=>({version:3,saved:0,op:0,roles:{},profiles:[],rtdf:'',splits:[],vars:[],formulas:[],notes:{},
  alias:{},order:[],eq:{surf:[],var:[],ser:[]},img:{tok:2,groups:[],pick:{}},cols:{hide:[],order:[]}});
let M=(()=>{
  const f=D.mapping,l=store.get('map',null);
  let m=SERVE?f:((l&&(!f||(l.saved||0)>=(f.saved||0)))?l:f);
  let fresh=false;
  if(!m){m=D.default_mapping?Object.assign({},D.default_mapping,{notes:{},alias:{},order:[]}):null;fresh=true;if(m&&m.img)m.img.pick={};}
  m=Object.assign(blankMap(),m||{});
  ['eq','img','cols'].forEach(k=>m[k]=Object.assign(blankMap()[k],m[k]||{}));
  Object.values(m.notes||{}).forEach(n=>{if(n&&n.note&&!n.text){n.text=n.note;}if(n)delete n.note;});  // v3.0 notları
  m._fresh=fresh;return m;
})();
buildIndex();

// ---- görünen ad, sıra ----
const dn=n=>(M.alias&&M.alias[n])||n;
function renameAnalysis(n,v){
  if(v===undefined){v=prompt(`'${n}' klasörünün uygulamada görünecek adı (boş = klasör adı):`,dn(n));if(v==null)return false;}
  const t=String(v).trim();
  if(t&&A.some(a=>a.name!==n&&dn(a.name).toLowerCase()===t.toLowerCase())){alert('Bu ad başka bir analizde kullanılıyor.');return false;}
  if(!t||t===n)delete M.alias[n];else M.alias[n]=t;save();fillRef();render();return true;}
const ORIG=names.slice();   // klasörlerin doğal sırası
function applyOrder(){const o=M.order||[];const ix=n=>{const i=o.indexOf(n);return i<0?1e6+ORIG.indexOf(n):i;};
  A.sort((x,y)=>ix(x.name)-ix(y.name));names=A.map(a=>a.name);}
applyOrder();
function moveIn(list,from,to,after){const l=list.filter(x=>x!==from);const i=l.indexOf(to);if(i<0)return list.slice();l.splice(after?i+1:i,0,from);return l;}
function reorder(from,to,after){M.order=moveIn(names,from,to,after);applyOrder();save();render();}

// ---- notlar ----
const STATUS=[['','—','#98a2b3'],['devam','Devam ediyor','#f79009'],['tamam','Tamamlandı','#12b76a'],['aday','Aday tasarım','#2e90fa'],['iptal','Elendi / iptal','#f04438']];
const NOTE=n=>M.notes[n]||(M.notes[n]={});
const stColor=s=>(STATUS.find(x=>x[0]===(s||''))||STATUS[0])[2];
const stLabel=s=>(STATUS.find(x=>x[0]===(s||''))||STATUS[0])[1];
const changesText=n=>(NOTE(n).changes||[]).filter(c=>c.what||c.chg).map(c=>(c.what||'')+(c.chg?': '+c.chg:'')).join('; ');

// ---- otomatik tahmin ----
const RX={pt:/total[\s_-]*pres|(^|[^a-z])pt([^a-z]|$)|p[\s_-]?tot|toplam[\s_-]*bas/i,ps:/static[\s_-]*pres|(^|[^a-z])ps([^a-z]|$)|p[\s_-]?stat|statik/i,
 tt:/total[\s_-]*temp|(^|[^a-z])tt([^a-z]|$)|t[\s_-]?tot|toplam[\s_-]*s[ıi]cak/i,t:/temp|s[ıi]cak|(^|[^a-z])t[st]?([^a-z]|$)/i,mfr:/mass[\s_-]*flow|mfr|m[\s_-]?dot|debi/i,
 pres:/pres|(^|[^a-z])p[ts]?([^a-z]|$)|bas[ıi]n/i,circ:/circ|[çc]evresel|circum/i,rad:/rad/i};
const EXC=/diff|dil|swirl|cool|fuel|ann|liner|hole|prim|sec|jet|eff?us|dome|cowl|wall|film|igni|plenum|mix/i;
const POS={in:t=>/(^|[^a-z])(inlet|in|giri[sş]|intake|inflow)([^a-z]|$)/i.test(t)&&!EXC.test(t),
  diff:t=>/diff/i.test(t)&&/(out|exit|exi|[çc][ıi]k[ıi][sş])/i.test(t)||/diff/i.test(t)&&!/(inlet|(^|[^a-z])in([^a-z]|$))/i.test(t),
  out:t=>/(^|[^a-z])(outlet|out|exit|[çc][ıi]k[ıi][sş]|ngv|turb)([^a-z]|$)/i.test(t)&&!EXC.test(t)};
const TYPEF={pt:c=>c.kind!=='mfr'&&c.kind!=='max'&&c.kind!=='min'&&RX.pt.test(c.var),ps:c=>c.kind!=='mfr'&&c.kind!=='max'&&c.kind!=='min'&&RX.ps.test(c.var),
  tt:c=>c.kind!=='mfr'&&c.kind!=='max'&&c.kind!=='min'&&RX.tt.test(c.var),tmax:c=>(c.kind==='max'&&RX.t.test(c.var))||(c.kind==='rdef'&&/max/i.test(c.var)&&RX.t.test(c.var)),
  mfr:c=>c.kind==='mfr'||RX.mfr.test(c.var),any:c=>true};
function guessScalar(type,pos){
  let best=null,bs=-1;
  CAT.forEach(c=>{if(!TYPEF[type](c))return;const t=c.surf||c.var;if(!POS[pos](t))return;
    let s=c.n*10;if(type==='pt'||type==='tt')s+=c.kind==='mwa'?5:c.kind==='awa'?2:0;if(type==='ps')s+=c.kind==='awa'?5:c.kind==='mwa'?2:0;
    if(c.surf&&POS[pos](c.surf)&&/^(inlet|outlet|in|out|exit)$/i.test(c.surf.replace(/[-_ ]/g,'')))s+=3;
    if(s>bs){bs=s;best=c.k;}});
  return best||'';
}
function serClass(c){const t=(c.f+' '+c.nm+' '+c.yl).toLowerCase(),tn=t.replace(/\.[a-z]+(\s|$)/,' ');
  return[RX.circ.test(t)?'circ':RX.rad.test(t)?'rad':'',RX.t.test(c.yl||'')||(RX.t.test(t)&&!RX.pres.test(c.yl||''))?'temp':RX.pres.test(t)?'pres':'',POS.in(tn)?'in':POS.diff(tn)?'diff':POS.out(tn)?'out':''];}
function guessSeries(q){
  let best=null,bs=-1;
  SCAT.forEach(c=>{if(c.t!=='xy')return;const t=(c.f+' '+c.nm+' '+c.yl).toLowerCase();
    const ok=q.every(w=>w==='circ'?RX.circ.test(t):w==='rad'?RX.rad.test(t)&&!RX.circ.test(t):w==='pres'?RX.pres.test(t)&&!RX.t.test(c.yl||''):w==='temp'?RX.t.test(t):POS[w](t.replace(/\.[a-z]+$/,'')));
    if(ok&&c.n>bs){bs=c.n;best=c.k;}});
  return best||'';
}
function guessSplits(){
  const used=new Set(['mdot_in','mdot_out'].map(r=>M.roles[r]&&canonSc(M.roles[r].key)));
  const groups=new Map();
  CAT.forEach(c=>{if(c.kind!=='mfr'||!c.surf||used.has(c.k))return;const s=c.surf.toLowerCase();
    if(POS.in(s)||POS.out(s)||/diff/.test(s))return;
    const g=s.replace(/[-_\s.]*\d+$/,'');if(!groups.has(g))groups.set(g,[]);groups.get(g).push(c.k);});
  if(groups.size>14)return [];
  return [...groups].map(([g,keys],i)=>({label:g,keys,x:0.12+0.16*(i%5),y:0.2+0.3*Math.floor(i/5)}));
}
function autoGuess(over){
  ROLES.forEach(([id,,type,pos])=>{const r=M.roles[id];if(!over&&r&&r.key)return;M.roles[id]={key:guessScalar(type,pos),over:(r&&!over&&r.over)||{}};});
  if(over||!M.profiles.length){M.profiles=PSLOTS.map(p=>({id:p.id,label:p.label,key:guessSeries(p.q),ylabel:'',swap:true,xm:'auto',over:{}}));M.rtdf='out_T';}
  else M.profiles.forEach(p=>{if(!p.key){const s=PSLOTS.find(x=>x.id===p.id);if(s)p.key=guessSeries(s.q);}});
  if(over||!M.splits.length)M.splits=guessSplits();
}
if(M._fresh&&A.length){autoGuess(false);}
delete M._fresh;

// ---- eşdeğer adlar ----
function addEq(type,main,other){
  const g=M.eq[type]||(M.eq[type]=[]);const f=type==='ser'?(x=>x):nrm;
  const gi=g.findIndex(x=>x.some(n=>f(n)===f(main))),gj=g.findIndex(x=>x.some(n=>f(n)===f(other)));
  if(gi>=0&&gi===gj)return;
  if(gi>=0&&gj>=0){g[gi].push(...g[gj]);g.splice(gj,1);}
  else if(gi>=0)g[gi].push(other);else if(gj>=0)g[gj].push(main);else g.push([main,other]);
}
// analiz bazında seçim yapılırken: fark yalnızca yüzey/değişken adıysa tüm uygulamada eşdeğer yapmayı öner
function offerEqSc(baseKey,chosen){
  const a=CAT.get(canonSc(baseKey)),b=CAT.get(canonSc(chosen));if(!a||!b||a.kind!==b.kind)return false;
  let type=null,x,y;
  if(a.cv===b.cv&&a.cs!==b.cs){type='surf';x=a.surf;y=b.surf;}else if(a.cs===b.cs&&a.cv!==b.cv){type='var';x=a.var;y=b.var;}
  if(!type)return false;
  if(!confirm(`'${y}' ile '${x}' aynı ${type==='surf'?'yüzey':'değişken'} olarak TÜM uygulamada eşleştirilsin mi?\n\nTamam = eşdeğer ad olarak kaydet (her yerde geçerli)\nİptal = sadece bu satır için bu analize özel seçim`))return false;
  addEq(type,x,y);buildIndex();return true;
}
function offerEqSr(baseKey,chosen){
  if(!confirm(`'${descSr(chosen)}' serisi '${descSr(baseKey)}' ile aynı şey olarak TÜM uygulamada eşleştirilsin mi?\n\nİptal = sadece bu profil için bu analize özel seçim`))return false;
  addEq('ser',canonSr(baseKey),chosen);buildIndex();return true;
}

// ---- kaydetme ----
let saveT,statusEl=el('span',{class:'status mut'});
function setStatus(t,bad){statusEl.textContent=t;statusEl.className='status '+(bad?'badc':'mut');}
function save(){
  M.saved=Date.now();store.set('map',M);
  if(!SERVE){setStatus('tarayıcıya kaydedildi');return;}
  setStatus('kaydediliyor…');clearTimeout(saveT);
  saveT=setTimeout(()=>fetch('api/mapping',{method:'POST',body:JSON.stringify(M)}).then(r=>r.json()).then(j=>setStatus(j.ok?'kaydedildi ✓':'KAYDEDİLEMEDİ: '+j.err,!j.ok)).catch(()=>setStatus('sunucuya ulaşılamadı (konsol penceresi kapandı mı?)',true)),350);
}
function changed(){save();recompute();}

// ================= hesap =================
function getSc(a,ref){
  if(!ref)return null;const key=(ref.over&&ref.over[a.name])||ref.key;if(!key)return null;
  const ck=canonSc(key);const s=a.scm.get(ck);if(s)return{v:s.v,s,k:ck,exact:true};
  const [kind,v,sf]=ck.split('|');const fk=kind+'|'+alnum(v)+'|'+alnum(sf);
  const c=[...a.scm.entries()].filter(([k])=>{const p=k.split('|');return p[0]+'|'+alnum(p[1])+'|'+alnum(p[2])===fk;});
  return c.length===1?{v:c[0][1].v,s:c[0][1],k:c[0][0],exact:false}:null;
}
function getSer(a,p){
  if(!p)return null;const key=(p.over&&p.over[a.name])||p.key;if(!key)return null;
  const ck=canonSr(key);const s=a.srm.get(ck);if(s)return s;
  const t=ck.split('|')[0],rest=ck.slice(ck.indexOf('|')+1);const [b,nm]=rest.split('#');
  const all=[...a.srm.entries()];
  let c=nm?all.filter(([k,x])=>x.t===t&&k.split('#')[1]===nm):[];if(c.length===1)return c[0][1];
  const bn=alnum(b.replace(/\d+/g,''));c=all.filter(([k,x])=>x.t===t&&alnum(k.slice(k.indexOf('|')+1).split('#')[0].replace(/\d+/g,''))===bn);
  return c.length===1?c[0][1]:null;
}
// ---- profil x ekseni: radius / span -> % span ----
const RADX=/rad|yar[ıi]?[çc]ap|^\s*r\s*(\[|\(|$)/i;
const XMODES=[['auto','Otomatik → % span'],['norm','% span (min–maks)'],['manual','% span (hub/tip elle)'],['raw','Ham x']];
function xfun(s,p){
  const xm=(p&&p.xm)||'auto';if(xm==='raw')return null;
  let lo=Infinity,hi=-Infinity;s.x.forEach(v=>{if(v<lo)lo=v;if(v>hi)hi=v;});
  let f;const rad=RADX.test(s.xl||'');
  if(xm==='manual'&&p.r0!==''&&p.r1!==''&&p.r0!=null&&p.r1!=null&&isFinite(+p.r0)&&isFinite(+p.r1)&&+p.r1!==+p.r0){const a=+p.r0,b=+p.r1;f=x=>(x-a)/(b-a)*100;}
  else if(xm==='auto'&&!rad&&lo>-0.02&&lo<0.05&&hi>0.95&&hi<1.02)f=x=>x*100;   // 0–1 span
  else if(xm==='auto'&&!rad&&lo>-2&&lo<5&&hi>95&&hi<101)f=x=>x;                 // zaten %
  else if(hi>lo)f=x=>(x-lo)/(hi-lo)*100;                                        // radius vb. -> min–maks
  else return null;
  return p&&p.rev?(x=>100-f(x)):f;
}
function serX(s,p){
  const f=xfun(s,p);if(!f)return{x:s.x,y:s.y,xmax:s.st.xmax,xmin:s.st.xmin,xl:s.xl||'x',span:false};
  let x=s.x.map(f),y=s.y;if(x.length>1&&x[0]>x[x.length-1]){x=x.slice().reverse();y=y.slice().reverse();}
  return{x,y,xmax:f(s.st.xmax),xmin:f(s.st.xmin),xl:'Span [%]',span:true};
}
const FUN={abs:Math.abs,sqrt:Math.sqrt,min:Math.min,max:Math.max,pow:Math.pow,log:Math.log,log10:Math.log10,exp:Math.exp,PI:Math.PI};
const fcache=new Map();
function compileF(expr){
  if(fcache.has(expr))return fcache.get(expr);
  const toks=String(expr).match(/[A-Za-z_][A-Za-z0-9_]*|\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?|\*\*|[-+*/^(),]|\S/g)||[];
  const ids=new Set();let js='';
  for(const t of toks){
    if(/^[A-Za-z_]/.test(t)){if(FUN[t]!==undefined)js+='F.'+t;else{ids.add(t);js+='S["'+t+'"]';}}
    else if(/^[\d.]/.test(t)||/^(\*\*|[-+*/(),])$/.test(t))js+=t;
    else if(t==='^')js+='**';
    else{const r={err:`geçersiz karakter: ${t}`};fcache.set(expr,r);return r;}
  }
  let fn;try{fn=new Function('S','F','return ('+js+');');}catch(e){const r={err:'sözdizimi hatası'};fcache.set(expr,r);return r;}
  const r={fn,ids:[...ids]};fcache.set(expr,r);return r;
}
function evalF(expr,S){
  const c=compileF(expr);if(c.err)return{err:c.err};
  const miss=c.ids.filter(i=>!(i in S));if(miss.length)return{err:'tanımsız: '+miss.join(', ')};
  if(c.ids.some(i=>S[i]==null))return{v:null,err:'eksik değer: '+c.ids.filter(i=>S[i]==null).join(', ')};
  try{const v=c.fn(S,FUN);return{v:isFinite(v)?v:null};}catch(e){return{err:String(e.message)};}
}
const BASE_DEFS=[
 ['mdot_in','Giriş debisi','kg/s',4,null,'Debi'],['mdot_out','Çıkış debisi','kg/s',4,null,'Debi'],
 ['mass_diff','Kütle farkı (çıkış−giriş)/giriş','%',3,null,'Debi'],
 ['Pt_in','Pt giriş (mutlak)','Pa',1,null,'Basınç'],['Pt_diff','Pt difüzör çıkışı','Pa',1,null,'Basınç'],['Pt_out','Pt çıkış','Pa',1,null,'Basınç'],
 ['dPP_comb','dP/P toplam','%',3,'low','Basınç'],['dPP_diff','dP/P difüzör','%',3,'low','Basınç'],['dPP_liner','dP/P liner','%',3,'low','Basınç'],
 ['Cp_diff','Difüzör Cp','-',4,'high','Basınç'],
 ['Tt_in','Tt giriş','K',2,null,'Sıcaklık'],['Tt_out','Tt çıkış','K',2,null,'Sıcaklık'],['dT','ΔT (çıkış−giriş)','K',2,null,'Sıcaklık'],
 ['Tmax_exit','T maks çıkış düzlemi','K',2,'low','Sıcaklık'],['OTDF','OTDF','-',4,'low','Sıcaklık'],
 ['Tmax_circ','T maks (circ avg profil)','K',2,'low','Sıcaklık'],['span_Tmax_circ','T maks span konumu','-',3,null,'Sıcaklık'],['RTDF','RTDF','-',4,'low','Sıcaklık'],
].map(([key,label,unit,digits,better,group])=>({key,label,unit,digits,better,group}));
function metricDefs(){
  const d=BASE_DEFS.map(x=>({...x}));
  const rp=M.profiles.find(p=>p.id===M.rtdf);
  if(rp&&rp.xm!=='raw'){const s=d.find(x=>x.key==='span_Tmax_circ');s.unit='% span';s.digits=1;}
  M.splits.forEach((s,i)=>d.push({key:'split_'+i,label:s.label||('grup '+(i+1)),unit:'%',digits:2,group:'Debi dağılımı'}));
  if(M.splits.length)d.push({key:'split_sum',label:'Dağılım toplamı',unit:'%',digits:2,group:'Debi dağılımı'});
  M.vars.forEach(v=>v.show&&d.push({key:'v_'+v.name,label:v.name,unit:(CAT.get(canonSc(v.key))||{}).unit||'',digits:v.digits??4,group:'Değişkenler'}));
  M.formulas.forEach(f=>d.push({key:'f_'+f.name,label:f.label||f.name,unit:f.unit||'',digits:f.digits??4,better:f.better||null,group:'Formüller'}));
  return d;
}
function scopeNames(){
  const s=['P_op',...ROLES.map(r=>r[0]),...BASE_DEFS.map(d=>d.key),...M.splits.map((_,i)=>'split_'+i),'split_sum',...M.vars.map(v=>v.name)];
  M.profiles.forEach(p=>['max','xmax','min','xmin','mean','imean'].forEach(k=>s.push(p.id+'_'+k)));
  M.formulas.forEach(f=>s.push(f.name));
  return [...new Set(s)];
}
// yakınsama kontrolü (EXTRA.conv)
A.forEach(a=>{a.conv=[];if(!EXTRA.conv)return;a.sr.forEach(s=>{if(s.t!=='hist'||s.y.length<20)return;
  const n=s.y.length,k=Math.max(5,Math.floor(n*0.1)),t=s.y.slice(n-k);const mn=Math.min(...t),mx=Math.max(...t),av=t.reduce((p,c)=>p+c,0)/k;
  if(av&&Math.abs((mx-mn)/av)>0.01)a.conv.push(`yakınsama şüpheli: '${s.nm||s.f}' son %10 iterasyonda ±${fmt(Math.abs((mx-mn)/av)*50,2)}% oynuyor`);});});
function compute(a){
  const w=[],m={},P={},S={},op=+M.op||0;S.P_op=op;
  const R=id=>{const r=M.roles[id];if(!r||!(r.key||(r.over&&r.over[a.name])))return null;const g=getSc(a,r);
    if(!g){w.push(`${RL[id]}: bu analizde bulunamadı → Eşleme sekmesinde bu analiz için seç`);return null;}
    if(!g.exact)w.push(`${RL[id]}: aynı ad yok, benzeri kullanıldı: ${descSc(g.k)}`);return g.v;};
  const addOp=v=>v==null?null:v+op;
  m.Pt_in=addOp(R('Pt_in'));m.Pt_diff=addOp(R('Pt_diff'));m.Pt_out=addOp(R('Pt_out'));
  const psi=addOp(R('Ps_in')),psd=addOp(R('Ps_diff'));
  if(m.Pt_in!=null&&m.Pt_in<5e4)w.push(`Pt giriş = ${sig(m.Pt_in)} Pa: gauge basınç olabilir → Eşleme > Operating pressure`);
  m.Tt_in=R('Tt_in');m.Tt_out=R('Tt_out');
  const mi=R('mdot_in'),mo=R('mdot_out');m.mdot_in=mi==null?null:Math.abs(mi);m.mdot_out=mo==null?null:Math.abs(mo);
  const loss=(x,y)=>(x&&y!=null)?(x-y)/x*100:null;
  m.dPP_comb=loss(m.Pt_in,m.Pt_out);m.dPP_diff=loss(m.Pt_in,m.Pt_diff);m.dPP_liner=loss(m.Pt_diff,m.Pt_out);
  if(m.mdot_in&&m.mdot_out!=null)m.mass_diff=(m.mdot_out-m.mdot_in)/m.mdot_in*100;
  if(psi!=null&&psd!=null&&m.Pt_in!=null&&m.Pt_in!==psi)m.Cp_diff=(psd-psi)/(m.Pt_in-psi);
  let dT=null;if(m.Tt_in!=null&&m.Tt_out!=null){dT=m.Tt_out-m.Tt_in;m.dT=dT;if(dT<=0){w.push('Tt çıkış ≤ Tt giriş: OTDF/RTDF hesaplanamaz');dT=null;}}
  const N=M.notes[a.name]||{};
  let tmax;if(N.Tmax_exit!=null&&N.Tmax_exit!==''){tmax=+N.Tmax_exit;w.push('T maks çıkış elle girildi (Notlar)');}else tmax=R('Tmax_exit');
  m.Tmax_exit=tmax;if(tmax!=null&&dT)m.OTDF=(tmax-m.Tt_out)/dT;
  const KS=['max','xmax','min','xmin','mean','imean'];
  M.profiles.forEach(p=>{const s=getSer(a,p);
    if(s){const t=serX(s,p);P[p.id]={s,t};const v={max:s.st.ymax,xmax:t.xmax,min:s.st.ymin,xmin:t.xmin,mean:s.st.mean,imean:s.st.imean};KS.forEach(k=>S[p.id+'_'+k]=v[k]??null);}
    else{KS.forEach(k=>S[p.id+'_'+k]=null);if(p.key)w.push(`profil '${p.label}' bulunamadı → Eşleme`);}});
  const rp=P[M.rtdf];if(rp){m.Tmax_circ=rp.s.st.ymax;m.span_Tmax_circ=rp.t.xmax;if(dT)m.RTDF=(rp.s.st.ymax-m.Tt_out)/dT;}
  let tot=0,have=false;
  M.splits.forEach((g,i)=>{let sum=0,ok=0;(g.keys||[]).forEach(k=>{const r=getSc(a,{key:k});if(r){sum+=Math.abs(r.v);ok++;}else w.push(`debi '${g.label}': ${descSc(k)} bu analizde yok`);});
    const v=(ok&&m.mdot_in)?sum/m.mdot_in*100:null;m['split_'+i]=v;if(v!=null&&g.in_sum!==false){tot+=v;have=true;}});
  if(M.splits.length)m.split_sum=have?tot:null;
  ROLES.forEach(([id])=>{if(!(id in S))S[id]=m[id]!==undefined?m[id]:null;});
  S.Ps_in=psi;S.Ps_diff=psd;
  BASE_DEFS.forEach(d=>S[d.key]=m[d.key]??null);
  M.splits.forEach((_,i)=>S['split_'+i]=m['split_'+i]??null);S.split_sum=m.split_sum??null;
  M.vars.forEach(v=>{const r=getSc(a,{key:v.key,over:v.over});S[v.name]=r?r.v:null;m['v_'+v.name]=S[v.name];if(!r&&v.key)w.push(`değişken '${v.name}' bulunamadı`);});
  M.formulas.forEach(f=>{const r=evalF(f.expr,S);S[f.name]=r.v??null;m['f_'+f.name]=r.v??null;if(r.err&&r.v===undefined)w.push(`formül '${f.name}': ${r.err}`);});
  w.push(...a.conv);
  return{m,w,P,S};
}
let RES=new Map();
function recompute(){RES=new Map(A.map(a=>[a.name,compute(a)]));if(typeof updateWarnBadge==='function')updateWarnBadge();}
const mval=(n,k)=>{const r=RES.get(n);return r?r.m[k]:null;};

// ================= görsel grupları =================
// Aynı görsel her analizde farklı adla kaydedilebilir (ATP_cp_analiz3_v2.png). Gruplama:
//  1) kullanıcı grupları (önek / joker kalıbı), 2) otomatik: analiz adı çıkarılmış dosya adının ilk N parçası.
const imgBase=p=>p.split('/').pop().replace(/\.[^.]+$/,'');
const sepn=s=>String(s).toLowerCase().replace(/[-\s.]+/g,'_');
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function stripName(b,a){let t=b;[a.name,dn(a.name)].forEach(n=>{const parts=String(n).split(/[-_\s.]+/).filter(Boolean);if(!parts.length)return;
  t=t.replace(new RegExp(parts.map(reEsc).join('[-_\\s.]*'),'ig'),' ');});return t;}
function imgToks(a,p){return stripName(imgBase(p),a).toLowerCase().split(/[-_\s.]+/).filter(Boolean);}
function patMatch(pat,a,p){
  pat=String(pat||'').trim().toLowerCase();if(!pat)return false;
  const tgt=pat.includes('/')?p.toLowerCase():p.split('/').pop().toLowerCase();
  if(/[*?]/.test(pat)){const re=new RegExp('^'+pat.split('').map(c=>c==='*'?'.*':c==='?'?'.':reEsc(c)).join('')+(pat.includes('.')?'$':''),'i');return re.test(tgt);}
  const P=sepn(pat);return sepn(tgt).startsWith(P)||sepn(stripName(imgBase(p),a)).replace(/^_+/,'').startsWith(P);
}
function imgFilterOK(p,f){const ws=String(f||'').toLowerCase().split(/\s+/).filter(Boolean);return ws.every(w=>w.startsWith('-')?!p.toLowerCase().includes(w.slice(1)):p.toLowerCase().includes(w));}
// dönüş: [{key,label,user,pat,items:Map(analiz->[yollar])}]
function imgGroups(rows,filter){
  const G=new Map(),ug=M.img.groups||[];
  ug.forEach((g,i)=>G.set('u:'+i,{key:'u:'+i,label:g.label||g.pat,user:true,pat:g.pat,idx:i,items:new Map()}));
  const N=Math.max(1,+M.img.tok||2);
  rows.forEach(a=>a.img.forEach(p=>{if(!imgFilterOK(a.name+'/'+p,filter))return;
    let gi=ug.findIndex(g=>patMatch(g.pat,a,p)),key;
    if(gi>=0)key='u:'+gi;else{const t=imgToks(a,p);key='a:'+(t.slice(0,N).join('_')||imgBase(p).toLowerCase());if(!G.has(key))G.set(key,{key,label:key.slice(2),user:false,items:new Map()});}
    const g=G.get(key);if(!g.items.has(a.name))g.items.set(a.name,[]);g.items.get(a.name).push(p);}));
  const arr=[...G.values()];
  arr.forEach(g=>g.items.forEach(l=>l.sort((x,y)=>x.length-y.length||x.localeCompare(y,undefined,{numeric:true}))));
  return arr.filter(g=>g.user||g.items.size).sort((x,y)=>(x.user===y.user?(x.user?x.idx-y.idx:x.label.localeCompare(y.label,undefined,{numeric:true})):x.user?-1:1));
}
// grupta bir analiz için kullanılacak görsel (birden çok aday varsa kullanıcının seçtiği)
function imgPick(g,an){const l=g.items.get(an);if(!l||!l.length)return null;const pk=((M.img.pick||{})[g.label]||{})[an];return(pk&&l.includes(pk))?pk:l[0];}
function setImgPick(g,an,p){const P=M.img.pick||(M.img.pick={});(P[g.label]||(P[g.label]={}))[an]=p;save();}

// ================= durum =================
let sel=new Set(store.get('sel',names));sel=new Set([...sel].filter(n=>names.includes(n)));if(!sel.size)sel=new Set(names);
let REF=store.get('ref',names[0]);if(!names.includes(REF))REF=names[0];
const selected=()=>A.filter(a=>sel.has(a.name));
let tab='overview';
