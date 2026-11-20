/* mapping.js — Eşleme & formüller sekmesi. © Muhammed Emin URAL */
let SHOWALL=false;
const isName=s=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)&&FUN[s]===undefined;
function scOptions(type,cur,a){
  const src=a?[...a.scm.keys()].map(k=>CAT.get(k)):[...CAT.values()];
  let list=SHOWALL||type==='any'?src:src.filter(TYPEF[type]);if(!list.length)list=src;
  list=list.slice().sort((x,y)=>(y.n-x.n)||descSc(x.k).localeCompare(descSc(y.k)));
  const o=[el('option',{value:''},'— seçilmedi —')];
  if(cur&&!list.some(c=>c.k===canonSc(cur)))o.push(el('option',{value:cur},descSc(cur)));
  list.forEach(c=>o.push(el('option',{value:c.k},descSc(c.k)+(a?'  = '+sig(a.scm.get(c.k).v):`   (${c.n}/${A.length} analiz)`))));
  return o;
}
function scSelect(type,cur,on,a){const s=el('select',{onchange:e=>on(e.target.value)},scOptions(type,cur,a));s.value=cur?(CAT.has(canonSc(cur))?canonSc(cur):cur):'';return s;}
function srSelect(cur,on,a){
  const src=a?[...a.srm.keys()].map(k=>SCAT.get(k)):[...SCAT.values()];
  const cc=canonSr(cur);
  const s=el('select',{onchange:e=>on(e.target.value)},el('option',{value:''},'— seçilmedi —'),cur&&!src.some(c=>c.k===cc)?el('option',{value:cur},descSr(cur)):'',
    src.slice().sort((x,y)=>(x.t===y.t?0:x.t==='xy'?-1:1)||(y.n-x.n)).map(c=>el('option',{value:c.k},descSr(c.k)+(a?'':`  (${c.n}/${A.length})`))));
  s.value=cur?(SCAT.has(cc)?cc:cur):'';return s;
}
function coverage(found,mk,onOver){
  const miss=A.filter(a=>!found(a));
  const td=el('td',{class:'l'});
  if(!miss.length){td.append(el('span',{class:'ok'},`✓ ${A.length}/${A.length}`));return td;}
  td.append(el('span',{class:'badc'},`${A.length-miss.length}/${A.length}`));
  miss.slice(0,12).forEach(a=>td.append(el('div',{class:'over'},dn(a.name)+': ',mk(a,v=>onOver(a.name,v)))));
  if(miss.length>12)td.append(el('div',{class:'mut'},`… +${miss.length-12} analiz`));
  return td;
}
function refVal(v,d){return el('td',{},v==null?el('span',{class:'na'},'–'):sig(v,d||7));}

// ---- eşdeğer ad önerileri: hiçbir analizde birlikte geçmeyen, benzer adlar ----
function lev(a,b){if(a===b)return 0;const m=a.length,n=b.length;if(!m||!n)return m||n;let p=[...Array(n+1).keys()];for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c;}return p[n];}
function eqNames(type){ // ad -> {n, set(analiz)}
  const m=new Map();
  A.forEach(a=>{const add=(nm,disp)=>{if(!nm)return;let e=m.get(nm);if(!e){e={nm,disp:disp||nm,an:new Set()};m.set(nm,e);}e.an.add(a.name);};
    if(type==='ser')a.sr.forEach(s=>s.t==='xy'&&add(s.k,descSr(s.k)));else a.sc.forEach(s=>add(type==='surf'?s.surf:s.var));});
  return m;
}
function inGroup(type,n){const f=type==='ser'?(x=>x):nrm;return(M.eq[type]||[]).some(g=>g.some(x=>f(x)===f(n)));}
function suggestEq(type){
  const m=eqNames(type),L=[...m.values()],out=[];
  const sigS=type==='ser'?(e=>{const c=SCAT.get(canonSr(e.nm))||{f:'',nm:'',yl:''};return serClass(c).join('/');}):null;
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const x=L[i],y=L[j];
    if([...x.an].some(a=>y.an.has(a)))continue;          // aynı analizde ikisi de varsa farklı şeylerdir
    if(type!=='ser'&&nrm(x.nm)===nrm(y.nm))continue;
    if(type==='ser'?canonSr(x.nm)===canonSr(y.nm):(type==='surf'?EQ.surf:EQ.var).get(nrm(x.nm))&&(type==='surf'?EQ.surf:EQ.var).get(nrm(x.nm))===(type==='surf'?EQ.surf:EQ.var).get(nrm(y.nm)))continue;
    let sc=0,why='';
    if(type==='ser'){const sx=sigS(x),sy=sigS(y);if(sx===sy&&!sx.split('/').includes('')){sc=3;why='aynı tür: '+sx;}}
    else{const a=alnum(x.nm),b=alnum(y.nm);if(!a||!b)continue;
      if(a.startsWith(b)||b.startsWith(a)){sc=3;why='biri diğerini içeriyor';}
      else if(a.includes(b)||b.includes(a)){sc=2;why='biri diğerini içeriyor';}
      else{const d=lev(a,b)/Math.max(a.length,b.length);if(d<=.34){sc=2-d;why='yazımı benzer';}}
      if(sc&&type==='surf'){const px=['in','diff','out'].find(k=>POS[k](x.nm)),py=['in','diff','out'].find(k=>POS[k](y.nm));if(px&&px===py)sc+=1;else if(px&&py)sc=0;}}
    if(sc>0){const big=x.an.size>=y.an.size?x:y,sm=big===x?y:x;out.push({a:big,b:sm,sc,why});}}
  return out.sort((p,q)=>q.sc-p.sc||(q.a.an.size+q.b.an.size)-(p.a.an.size+p.b.an.size)).slice(0,12);
}
function eqCard(rerender){
  const T=[['surf','Yüzey adları','ör. outlet ≡ outlet-plane ≡ exit'],['var','Değişken adları','ör. Total Temperature ≡ Total-Temperature'],['ser','Profil / seri dosyaları','ör. outlet-circ-temp ≡ cikis_circ_T']];
  const c=card(el('h2',{},'Eşdeğer adlar'),help('Farklı post-process’lerde aynı şeyin adı farklı olabilir. Burada eşleştirdiğin adlar <b>uygulamanın her yerinde</b> tek bir şey sayılır (roller, profiller, debi grupları, katalog, formüller). İlk ad (kalın) görünen addır; bir ada tıklarsan ana ad olur. Aşağıdaki rol/profil satırlarında bir analiz için seçim yaparken de sorulur.'));
  T.forEach(([type,title,ex])=>{
    const groups=M.eq[type]||(M.eq[type]=[]),names=eqNames(type);
    const disp=n=>type==='ser'?descSr(n):n;
    const free=[...names.values()].filter(e=>!inGroup(type,e.nm)).sort((x,y)=>disp(x.nm).localeCompare(disp(y.nm)));
    const sec=el('div',{},el('h3',{},title,el('span',{class:'mut',style:'font-weight:400'},'  '+ex)));
    groups.forEach((g,gi)=>{
      const add=el('select',{onchange:e=>{if(e.target.value){g.push(e.target.value);buildIndex();rerender();}}},el('option',{value:''},'+ ad ekle'),free.map(e=>el('option',{value:e.nm},`${disp(e.nm)}  (${e.an.size} analiz)`)));
      sec.append(el('div',{},g.map((n,j)=>el('span',{class:'chip'+(j?'':' main'),title:j?'tıkla: ana ad yap':'ana (görünen) ad',style:'cursor:pointer',onclick:()=>{if(!j)return;g.splice(j,1);g.unshift(n);buildIndex();rerender();}},
        `${disp(n)} (${(names.get(n)||names.get([...names.keys()].find(k=>nrm(k)===nrm(n)))||{an:new Set()}).an.size})`,el('button',{class:'x',onclick:e=>{e.stopPropagation();g.splice(j,1);if(g.length<1)groups.splice(gi,1);buildIndex();rerender();}},'✕'))),
        add,el('button',{class:'x',title:'grubu sil',onclick:()=>{groups.splice(gi,1);buildIndex();rerender();}},'🗑'),g.length<2?el('span',{class:'mut'},' (en az 2 ad gerekli)'):''));});
    const nw=el('select',{onchange:e=>{if(e.target.value){groups.push([e.target.value]);rerender();}}},el('option',{value:''},'+ yeni grup başlat…'),free.map(e=>el('option',{value:e.nm},`${disp(e.nm)}  (${e.an.size} analiz)`)));
    const sug=suggestEq(type);
    sec.append(el('div',{class:'tools',style:'margin-top:4px'},nw));
    if(sug.length)sec.append(el('div',{class:'mut'},'Öneriler (hiçbir analizde birlikte geçmeyen benzer adlar):'),
      el('div',{},sug.map(s=>el('span',{class:'chip',title:s.why},`${disp(s.a.nm)} (${s.a.an.size}) ≡ ${disp(s.b.nm)} (${s.b.an.size})`,btn('eşle',()=>{addEq(type,s.a.nm,s.b.nm);buildIndex();rerender();})))));
    c.append(sec);});
  return c;
}

function renderMap(){
  const host=$('#t_map');host.innerHTML='';
  const ref=byName(REF);
  const rerender=()=>{changed();renderMap();};
  // ---- genel
  const fileIn=el('input',{type:'file',accept:'.json',style:'max-width:220px',onchange:e=>{const f=e.target.files[0];if(!f)return;f.text().then(t=>{try{const j=JSON.parse(t);M=Object.assign(blankMap(),j,{notes:Object.assign({},j.notes||{},M.notes)});['eq','img','cols'].forEach(k=>M[k]=Object.assign(blankMap()[k],M[k]||{}));buildIndex();applyOrder();rerender();}catch(err){alert('JSON okunamadı: '+err.message);}});}});
  host.append(card(el('h2',{},'Genel'),
    help(`Araç analiz klasörlerindeki <b>tüm</b> metin dosyalarını içeriğine göre okur; dosya adı/yeri önemli değil. Aşağıda hangi değerin ne anlama geldiğini seçersin. Seçimler otomatik kaydedilir${SERVE?' (<code>'+esc(D.root)+'\\postproc_eslesme.json</code>)':''}.`),
    el('div',{class:'tools'},'Operating pressure [Pa]:',el('input',{type:'number',step:'any',value:M.op,style:'width:140px',onchange:e=>{M.op=+e.target.value||0;rerender();}}),
      el('span',{class:'mut'},'Fluent basınçları gauge ise (varsayılan) buraya yaz; dP/P mutlak basınçla hesaplanır. Basınçlar zaten mutlaksa 0 bırak.')),
    el('div',{class:'tools'},el('label',{},el('input',{type:'checkbox',checked:SHOWALL,onchange:e=>{SHOWALL=e.target.checked;renderMap();}}),' Listelerde filtreyi kapat (tüm değerleri göster)')),
    el('div',{class:'tools'},btn('Boşları otomatik doldur',()=>{autoGuess(false);rerender();}),
      btn('Sıfırla + yeniden tahmin',()=>{if(confirm('Roller, profiller ve debi grupları silinip yeniden tahmin edilsin mi? (Değişkenler, formüller, eşdeğer adlar ve notlar kalır)')){M.roles={};M.profiles=[];M.splits=[];autoGuess(true);rerender();}}),
      btn('Eşlemeyi indir (.json)',()=>dl('postproc_eslesme.json',JSON.stringify(M,null,1),'application/json')),'Yükle:',fileIn,statusEl)));
  // ---- roller
  const rt=el('tbody');
  ROLES.forEach(([id,label,type])=>{const r=M.roles[id]||(M.roles[id]={key:'',over:{}});r.over=r.over||{};
    rt.append(el('tr',{},el('td',{class:'l'},el('b',{},label),el('div',{class:'mut'},id)),
      el('td',{class:'l'},scSelect(type,r.key,v=>{r.key=v;r.over={};rerender();})),
      refVal(ref&&r.key?(getSc(ref,r)||{}).v:null),
      r.key?coverage(a=>getSc(a,r),(a,on)=>scSelect(type,r.over[a.name]||'',on,a),(n,v)=>{if(v&&offerEqSc(r.key,v)){delete r.over[n];}else if(v)r.over[n]=v;else delete r.over[n];rerender();}):el('td',{class:'l mut'},'—')));});
  host.append(card(el('h2',{},'Temel değerler'),help('dP/P = (Pt₁−Pt₂)/Pt₁ · OTDF = (T<sub>maks,çıkış</sub>−T<sub>çıkış</sub>)/(T<sub>çıkış</sub>−T<sub>giriş</sub>) · RTDF = (maks circ-avg T − T<sub>çıkış</sub>)/ΔT · Difüzör Cp = (Ps<sub>dif</sub>−Ps<sub>giriş</sub>)/(Pt<sub>giriş</sub>−Ps<sub>giriş</sub>)'),
    twBox(el('table',{},el('thead',{},el('tr',{},['Rol','Kaynak değer','Referans ('+dn(REF||'')+')','Kapsam / analiz bazında seçim'].map(h=>el('th',{class:'l'},h)))),rt))));
  // ---- eşdeğer adlar
  host.append(eqCard(rerender));
  // ---- profiller
  const pt=el('tbody');
  M.profiles.forEach((p,i)=>{p.over=p.over||{};
    const xm=el('select',{onchange:e=>{p.xm=e.target.value;rerender();}},XMODES.map(([k,l])=>el('option',{value:k},l)));xm.value=p.xm||'auto';
    pt.append(el('tr',{},
      el('td',{class:'l'},el('input',{type:'text',value:p.label,style:'width:200px',onchange:e=>{p.label=e.target.value;changed();}}),el('div',{class:'mut'},'formülde: '+p.id+'_max, _xmax, _mean, _imean, _min')),
      el('td',{class:'l'},srSelect(p.key,v=>{p.key=v;p.over={};rerender();})),
      el('td',{class:'l'},xm,p.xm==='manual'?el('div',{},'hub ',el('input',{type:'number',step:'any',value:p.r0??'',style:'width:80px',onchange:e=>{p.r0=e.target.value;rerender();}}),' tip ',el('input',{type:'number',step:'any',value:p.r1??'',style:'width:80px',onchange:e=>{p.r1=e.target.value;rerender();}})):'',
        el('label',{class:'mut',style:'display:block'},el('input',{type:'checkbox',checked:!!p.rev,onchange:e=>{p.rev=e.target.checked;rerender();}}),' ters')),
      el('td',{},el('input',{type:'checkbox',checked:p.swap,title:'Span dikey eksende',onchange:e=>{p.swap=e.target.checked;changed();}})),
      el('td',{},el('input',{type:'radio',name:'rtdf',checked:M.rtdf===p.id,title:'RTDF bu profilin maksimumundan hesaplanır',onchange:()=>{M.rtdf=p.id;rerender();}})),
      refVal(ref&&p.key?(getSer(ref,p)||{st:{}}).st.ymax:null),
      p.key?coverage(a=>getSer(a,p),(a,on)=>srSelect(p.over[a.name]||'',on,a),(n,v)=>{if(v&&offerEqSr(p.key,v)){delete p.over[n];}else if(v)p.over[n]=v;else delete p.over[n];rerender();}):el('td',{class:'l mut'},'—'),
      el('td',{},el('button',{class:'x',title:'sil',onclick:()=>{M.profiles.splice(i,1);rerender();}},'✕'))));});
  host.append(card(el('h2',{},'Profiller (circumferential / radial average)'),help('Span-parametre grafikleri ve RTDF için. <b>x ekseni</b>: radius ya da 0–1 span olarak gelen x, % span’e çevrilir (otomatik: 0–1 ise ×100, radius ise min–maks arası 0–100). Hub/tip yarıçapını biliyorsan “elle” seç.'),
    twBox(el('table',{},el('thead',{},el('tr',{},['Ad','Seri','x ekseni','Span dikey','RTDF','Ref. maks','Kapsam',''].map(h=>el('th',{class:'l'},h)))),pt)),
    el('div',{class:'tools',style:'margin-top:8px'},btn('+ Profil ekle',()=>{let k=1;while(M.profiles.some(p=>p.id==='prof'+k))k++;M.profiles.push({id:'prof'+k,label:'Profil '+k,key:'',swap:true,xm:'auto',over:{}});rerender();}))));
  // ---- debi grupları
  const st=el('tbody');
  M.splits.forEach((g,i)=>{g.keys=g.keys||[];
    const add=scSelect('mfr','',v=>{if(v&&!g.keys.includes(v)){g.keys.push(v);rerender();}});add.options[0].textContent='+ yüzey ekle';
    st.append(el('tr',{},el('td',{class:'l'},el('input',{type:'text',value:g.label,style:'width:150px',onchange:e=>{g.label=e.target.value;changed();}}),el('div',{class:'mut'},'formülde: split_'+i)),
      el('td',{class:'l',style:'white-space:normal;max-width:620px'},g.keys.map((k,j)=>el('span',{class:'chip',title:k},descSc(k).replace(/^Debi · [^@]*@ /,''),el('button',{class:'x',onclick:()=>{g.keys.splice(j,1);rerender();}},'✕'))),add),
      el('td',{},el('input',{type:'checkbox',checked:g.in_sum!==false,title:'Σ toplamına dahil',onchange:e=>{g.in_sum=e.target.checked;rerender();}})),
      refVal(ref?mval(REF,'split_'+i):null,4),
      el('td',{},el('button',{class:'x',onclick:()=>{M.splits.splice(i,1);rerender();}},'✕'))));});
  host.append(card(el('h2',{},'Debi dağılımı grupları'),help('Her grup, seçilen yüzeylerin |debi| toplamının giriş debisine oranıdır (%). Ör. tüm dilution delikleri tek grupta toplanabilir.'),
    twBox(el('table',{},el('thead',{},el('tr',{},['Grup','Yüzeyler','Σ\'ya dahil','Ref. %',''].map(h=>el('th',{class:'l'},h)))),st)),
    el('div',{class:'tools',style:'margin-top:8px'},btn('+ Grup ekle',()=>{M.splits.push({label:'grup '+(M.splits.length+1),keys:[],x:.5,y:.5});rerender();}),
      btn('Otomatik grupla (mevcutları değiştirir)',()=>{if(confirm('Debi grupları yeniden oluşturulsun mu?')){M.splits=guessSplits();rerender();}}))));
  // ---- değişkenler
  const vt=el('tbody');
  M.vars.forEach((v,i)=>{v.over=v.over||{};
    vt.append(el('tr',{},el('td',{class:'l'},el('input',{type:'text',value:v.name,style:'width:130px;font-family:monospace',onchange:e=>{const n=e.target.value.trim();if(!isName(n)||scopeNames().includes(n)&&n!==v.name){alert('Geçersiz ya da kullanılan ad: harf/rakam/_ , harfle başlamalı');e.target.value=v.name;return;}v.name=n;rerender();}})),
      el('td',{class:'l'},scSelect('any',v.key,x=>{v.key=x;v.over={};rerender();})),
      refVal(ref&&v.key?(getSc(ref,v)||{}).v:null),
      el('td',{},el('input',{type:'checkbox',checked:v.show,title:'Özet tablosunda sütun olarak göster',onchange:e=>{v.show=e.target.checked;changed();}})),
      v.key?coverage(a=>getSc(a,v),(a,on)=>scSelect('any',v.over[a.name]||'',on,a),(n,x)=>{if(x&&offerEqSc(v.key,x)){delete v.over[n];}else if(x)v.over[n]=x;else delete v.over[n];rerender();}):el('td',{class:'l mut'},'—'),
      el('td',{},el('button',{class:'x',onclick:()=>{M.vars.splice(i,1);rerender();}},'✕'))));});
  host.append(card(el('h2',{},'Değişkenler'),help('Katalogdaki herhangi bir değere ad ver; formüllerde bu adla kullanılır. Katalog sekmesinden de “değişken yap” ile eklenebilir.'),
    twBox(el('table',{},el('thead',{},el('tr',{},['Ad','Kaynak değer','Referans','Özette göster','Kapsam',''].map(h=>el('th',{class:'l'},h)))),vt)),
    el('div',{class:'tools',style:'margin-top:8px'},btn('+ Değişken ekle',()=>{let k=1;while(scopeNames().includes('x'+k))k++;M.vars.push({name:'x'+k,key:'',show:false,over:{}});rerender();}))));
  // ---- formüller
  const ft=el('tbody');
  M.formulas.forEach((f,i)=>{
    const S=ref?RES.get(REF).S:{};const r=ref?evalF(f.expr,S):{};
    const better=el('select',{onchange:e=>{f.better=e.target.value||null;rerender();}},el('option',{value:''},'—'),el('option',{value:'low'},'düşük iyi'),el('option',{value:'high'},'yüksek iyi'));better.value=f.better||'';
    ft.append(el('tr',{},
      el('td',{class:'l'},el('input',{type:'text',value:f.name,style:'width:110px;font-family:monospace',onchange:e=>{const n=e.target.value.trim();if(!isName(n)||(scopeNames().includes(n)&&n!==f.name)){alert('Geçersiz ya da kullanılan ad');e.target.value=f.name;return;}f.name=n;rerender();}})),
      el('td',{class:'l'},el('input',{type:'text',value:f.label||'',placeholder:'tabloda görünen ad',style:'width:170px',onchange:e=>{f.label=e.target.value;changed();}})),
      el('td',{class:'l'},el('input',{type:'text',value:f.expr,style:'width:340px;font-family:monospace',onchange:e=>{f.expr=e.target.value;rerender();}})),
      el('td',{class:'l'},el('input',{type:'text',value:f.unit||'',style:'width:60px',onchange:e=>{f.unit=e.target.value;changed();}})),
      el('td',{},el('input',{type:'number',value:f.digits??4,min:0,max:10,style:'width:52px',onchange:e=>{f.digits=+e.target.value;changed();}})),
      el('td',{},better),
      el('td',{class:'l'},r.err&&r.v===undefined?el('span',{class:'badc'},r.err):r.v==null?el('span',{class:'na',title:r.err||''},'–'):sig(r.v)),
      el('td',{},el('button',{class:'x',onclick:()=>{M.formulas.splice(i,1);rerender();}},'✕'))));});
  host.append(card(el('h2',{},'Formüller'),
    help(`Özet tablosuna kendi hesabını ekle. Yukarıdan aşağı hesaplanır; bir formül öncekileri adıyla kullanabilir. Operatörler: <code>+ - * / ^ ( )</code>, fonksiyonlar: <code>abs sqrt min max pow log log10 exp PI</code>.<br>Kullanılabilir adlar: ${scopeNames().map(n=>'<code>'+n+'</code>').join(' ')}`),
    twBox(el('table',{},el('thead',{},el('tr',{},['Ad','Etiket','İfade','Birim','Hane','Renk',`Ref. (${dn(REF||'')})`,''].map(h=>el('th',{class:'l'},h)))),ft)),
    el('div',{class:'tools',style:'margin-top:8px'},btn('+ Formül ekle',()=>{let k=1;while(scopeNames().includes('f'+k))k++;M.formulas.push({name:'f'+k,label:'',expr:'',unit:'',digits:4});rerender();}),
      btn('Örnek: liner kaybı / toplam kayıp',()=>{if(!scopeNames().includes('liner_share'))M.formulas.push({name:'liner_share',label:'Liner kaybı / toplam kayıp',expr:'dPP_liner / dPP_comb * 100',unit:'%',digits:2});rerender();}),
      btn('Örnek: T maks − T çıkış',()=>{if(!scopeNames().includes('T_peak_rise'))M.formulas.push({name:'T_peak_rise',label:'T maks − T çıkış',expr:'Tmax_exit - Tt_out',unit:'K',digits:1,better:'low'});rerender();}))));
}
