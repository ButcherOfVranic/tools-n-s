/* views.js — Özet, Profiller, Debi dağılımı, Katalog, Uyarılar. © Muhammed Emin URAL */

// sürükle-bırak: src = tutulan öğe, tgt = bırakma hedefi; kind 'col' ile bitiyorsa yatay
let DRAG=null;
function dnd(src,tgt,kind,id,onDrop){
  const hz=kind.endsWith('col');src.draggable=true;
  const clr=()=>document.querySelectorAll('.dropa,.dropb,.dropl,.dropr').forEach(x=>x.classList.remove('dropa','dropb','dropl','dropr'));
  src.addEventListener('dragstart',e=>{e.stopPropagation();DRAG={kind,id};e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(id));}catch(_){}tgt.classList.add('dragging');});
  src.addEventListener('dragend',()=>{DRAG=null;tgt.classList.remove('dragging');clr();});
  const side=e=>{const r=tgt.getBoundingClientRect();return hz?(e.clientX>r.left+r.width/2):(e.clientY>r.top+r.height/2);};
  tgt.addEventListener('dragover',e=>{if(!DRAG||DRAG.kind!==kind||DRAG.id===id)return;e.preventDefault();const af=side(e);
    tgt.classList.toggle(hz?'dropr':'dropa',af);tgt.classList.toggle(hz?'dropl':'dropb',!af);});
  tgt.addEventListener('dragleave',()=>tgt.classList.remove('dropa','dropb','dropl','dropr'));
  tgt.addEventListener('drop',e=>{if(!DRAG||DRAG.kind!==kind)return;e.preventDefault();const af=side(e);clr();const f=DRAG.id;DRAG=null;if(f!==id)onDrop(f,id,af);});
}
// tutup kaydırma (geniş tablolar)
function grabPan(box){
  let st=null,moved=false;
  box.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch'||e.target.closest('input,select,button,textarea,a,[draggable=true]'))return;st={x:e.clientX,y:e.clientY,l:box.scrollLeft,t:box.scrollTop,id:e.pointerId};moved=false;});
  box.addEventListener('pointermove',e=>{if(!st)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;if(!moved&&Math.abs(dx)+Math.abs(dy)<6)return;
    if(!moved){moved=true;try{box.setPointerCapture(st.id);}catch(_){}box.classList.add('panning');}box.scrollLeft=st.l-dx;box.scrollTop=st.t-dy;});
  const end=()=>{st=null;box.classList.remove('panning');};
  box.addEventListener('pointerup',end);box.addEventListener('pointercancel',end);
  box.addEventListener('click',e=>{if(moved){e.stopPropagation();e.preventDefault();moved=false;}},true);
}
function twBox(...c){const d=el('div',{class:'tw'},...c);grabPan(d);return d;}
function segBtns(opts,cur,on){return el('div',{class:'seg'},opts.map(([k,l])=>el('button',{class:k===cur?'on':'',onclick:()=>on(k)},l)));}

// ================= Özet =================
let mode=store.get('mode','abs'),sortKey=null,sortDir=1,ovT=EXTRA.transpose&&store.get('ovT',false),colPanel=false,ovChart=store.get('ovChart','dPP_comb');
// görünür metrikler (kullanıcının sırası ve gizledikleri uygulanmış)
function ovMetrics(all){
  const defs=metricDefs().filter(d=>A.some(a=>mval(a.name,d.key)!=null));
  const o=M.cols.order||[],base=defs.map(d=>d.key);const ix=k=>{const i=o.indexOf(k);return i<0?1e6+base.indexOf(k):i;};
  defs.sort((a,b)=>ix(a.key)-ix(b.key));
  return all?defs:defs.filter(d=>!(M.cols.hide||[]).includes(d.key));
}
function bestWorst(rows,mm){const stat={};mm.forEach(m=>{const vs=rows.map(a=>mval(a.name,m.key)).filter(v=>v!=null);if(!m.better||vs.length<2||Math.min(...vs)===Math.max(...vs))return;
  const sc=v=>m.better==='low'?v:-v;stat[m.key]={best:vs.reduce((p,c)=>sc(c)<sc(p)?c:p),worst:vs.reduce((p,c)=>sc(c)>sc(p)?c:p)};});return stat;}
function cellOf(a,m,stat,md){
  const v=mval(a.name,m.key),r=mval(REF,m.key);md=md||mode;
  if(v==null)return{t:'–',c:'na'};
  if(md==='abs'){let c='';if(stat[m.key]){if(v===stat[m.key].best)c='best';else if(v===stat[m.key].worst)c='worst';}return{t:fmt(v,m.digits),c};}
  if(r==null)return{t:'–',c:'na'};
  if(md==='delta'){const d=v-r;return{t:(d>0?'+':'')+fmt(d,m.digits),c:''};}
  if(r===0)return{t:'–',c:'na'};const p=(v-r)/Math.abs(r)*100;return{t:(p>0?'+':'')+fmt(p,2)+'%',c:''};
}
function nameCell(a,tag){
  const N=M.notes[a.name]||{};
  const nm=el('span',{title:'çift tıkla: yeniden adlandır'+(dn(a.name)!==a.name?'\nklasör: '+a.name:''),ondblclick:e=>{e.stopPropagation();renameAnalysis(a.name);}},dn(a.name));
  return[el('span',{class:'dot',style:'background:'+stColor(N.status)+';margin-right:6px',title:stLabel(N.status)}),nm,a.name===REF?el('span',{class:'mut'},' (ref)'):'',N.desc?el('small',{},N.desc):(N.tags&&tag?el('small',{},N.tags):'')];
}
function renderOverview(){
  const host=$('#t_overview');host.innerHTML='';
  if(!A.length){host.append(card(el('h2',{},'Analiz bulunamadı'),help(D.root_ok?`<b>${esc(D.root)}</b> içinde alt klasör yok.`:`Analiz klasörü ayarlı değil ya da bulunamadı: <b>${esc(D.root||'—')}</b>. Sağ üstteki <b>Klasör…</b> düğmesiyle seç (ör. D:\\analizler). Her analiz bu klasörün altında ayrı bir klasör olmalı.`)));return;}
  const rows=selected().slice(),allm=ovMetrics(true),mm=ovMetrics(!EXTRA.colHide);
  if(sortKey)rows.sort((x,y)=>sortDir*((mval(x.name,sortKey)??Infinity)-(mval(y.name,sortKey)??Infinity)));
  const stat=bestWorst(rows,mm);
  const modeSel=el('select',{onchange:e=>{mode=e.target.value;store.set('mode',mode);renderOverview();}},el('option',{value:'abs'},'Mutlak değer'),el('option',{value:'delta'},'Δ referansa göre'),el('option',{value:'pct'},'Δ% referansa göre'));modeSel.value=mode;
  const colMove=(f,t,af)=>{M.cols.order=moveIn(allm.map(d=>d.key),f,t,af);save();renderOverview();};
  const sortBy=k=>{sortDir=sortKey===k?-sortDir:1;sortKey=k;renderOverview();};
  const tbl=el('table',{class:'sticky'});
  if(!ovT){
    const groups=[];mm.forEach(m=>{const l=groups[groups.length-1];if(l&&l.g===m.group)l.n++;else groups.push({g:m.group,n:1});});
    const hr=el('tr',{},el('th',{},'Analiz'));
    mm.forEach(m=>{const th=el('th',{class:'s',title:'tıkla: sırala · sürükle: sütunu taşı'},m.label+(sortKey===m.key?(sortDir>0?' ▲':' ▼'):''),el('small',{},mode==='pct'?'Δ%':(mode==='delta'?'Δ ':'')+m.unit));
      th.onclick=()=>sortBy(m.key);dnd(th,th,'mcol',m.key,colMove);hr.append(th);});
    tbl.append(el('thead',{},el('tr',{},el('th',{class:'grp'},''),groups.map(g=>el('th',{class:'grp',colspan:g.n},g.g))),hr));
    const tb=el('tbody');
    rows.forEach(a=>{const h=el('span',{class:'hd',title:'sürükle: satırı taşı'},'⠿');
      const tr=el('tr',{class:a.name===REF?'ref':''},el('td',{title:(M.notes[a.name]||{}).text||''},h,nameCell(a,true)));
      dnd(h,tr,'arow',a.name,(f,t,af)=>{sortKey=null;reorder(f,t,af);});
      mm.forEach(m=>{const c=cellOf(a,m,stat);tr.append(el('td',{class:c.c},c.t));});tb.append(tr);});
    tbl.append(tb);
  }else{
    const hr=el('tr',{},el('th',{},'Metrik'));
    rows.forEach(a=>{const th=el('th',{class:a.name===REF?'ref':'',title:'sürükle: sütunu taşı · çift tıkla: yeniden adlandır'},nameCell(a,false));dnd(th,th,'acol',a.name,(f,t,af)=>{sortKey=null;reorder(f,t,af);});hr.append(th);});
    tbl.append(el('thead',{},hr));const tb=el('tbody');let lastG=null;
    mm.forEach(m=>{if(m.group!==lastG){lastG=m.group;tb.append(el('tr',{},el('td',{class:'l mut',style:'font-weight:400'},m.group),rows.map(()=>el('td',{}))));}
      const h=el('span',{class:'hd'},'⠿');const tr=el('tr',{},el('td',{},h,m.label,el('small',{},mode==='pct'?'Δ%':(mode==='delta'?'Δ ':'')+m.unit)));
      dnd(h,tr,'mrow',m.key,colMove);
      rows.forEach(a=>{const c=cellOf(a,m,stat);tr.append(el('td',{class:c.c+(a.name===REF&&!c.c?' ref':'')},c.t));});tb.append(tr);});
    tbl.append(tb);
  }
  const cp=el('div',{class:'colp'+(colPanel?'':' hide')});
  let lg=null;allm.forEach(d=>{if(d.group!==lg){lg=d.group;cp.append(el('b',{style:'width:100%;margin-top:4px'},d.group));}
    cp.append(el('label',{},el('input',{type:'checkbox',checked:!(M.cols.hide||[]).includes(d.key),onchange:e=>{const h=new Set(M.cols.hide||[]);e.target.checked?h.delete(d.key):h.add(d.key);M.cols.hide=[...h];save();renderOverview();}}),d.label));});
  cp.append(el('div',{style:'width:100%'},btn('Hepsini göster',()=>{M.cols.hide=[];save();renderOverview();}),' ',btn('Varsayılan sıra',()=>{M.cols.order=[];save();renderOverview();})));
  host.append(card(el('div',{class:'tools'},'Gösterim:',modeSel,
      EXTRA.transpose?segBtns([['0','Satır = analiz'],['1','Satır = metrik']],ovT?'1':'0',k=>{ovT=k==='1';store.set('ovT',ovT);renderOverview();}):'',
      EXTRA.colHide?btn((colPanel?'▾':'▸')+' Sütunlar ('+mm.length+'/'+allm.length+')',()=>{colPanel=!colPanel;renderOverview();}):'',
      sortKey?btn('Sıralamayı kaldır',()=>{sortKey=null;renderOverview();}):'',
      el('span',{class:'mut'},'Tabloyu tutup kaydır · ⠿ ile satır, başlıkla sütun sürükle · çift tıkla: yeniden adlandır · yeşil/kırmızı = en iyi/kötü')),
    cp,twBox(tbl)));
  if(EXTRA.metricChart&&mm.length){
    if(!mm.some(m=>m.key===ovChart))ovChart=mm[0].key;const md=mm.find(m=>m.key===ovChart);
    const s=el('select',{onchange:e=>{ovChart=e.target.value;store.set('ovChart',ovChart);renderOverview();}},mm.map(m=>el('option',{value:m.key},m.group+' · '+m.label)));s.value=ovChart;
    const box=el('div',{class:'chart'});
    host.append(card(el('div',{class:'tools'},el('b',{},'Metrik grafiği'),s,el('span',{class:'mut'},'Etiketteki % = referansa göre fark')),box));
    const items=rows.map(a=>({name:dn(a.name),v:mval(a.name,ovChart),color:color(a.name),ref:a.name===REF}));
    box.append(barSVG(items,{W:Math.max(box.clientWidth||800,500),unit:md.unit,digits:md.digits,th:liveTheme(),refv:mval(REF,ovChart)}));
  }
}

// ================= Profiller =================
let profSel=store.get('prof',''),profDelta=false,profSwap=null;const tmpProf={};
function profDef(){
  if(profSel.startsWith('p:'))return M.profiles.find(p=>'p:'+p.id===profSel);
  const k=profSel.slice(2);return tmpProf[k]||(tmpProf[k]={id:'',label:descSr(k),key:k,swap:SCAT.get(k)?.t==='xy',xm:SCAT.get(k)?.t==='xy'?'auto':'raw',over:{}});
}
function profSeries(pd,rows,delta){
  const ref=byName(REF),rs=ref&&getSer(ref,pd),rt=rs&&serX(rs,pd);
  let ser=rows.map(a=>({a,s:getSer(a,pd)})).filter(o=>o.s).map(({a,s})=>{const t=serX(s,pd);return{name:dn(a.name),an:a.name,color:color(a.name),x:t.x,y:t.y,max:{x:t.xmax,y:s.st.ymax},ref:a.name===REF,xl:t.xl,yl:s.yl,span:t.span};});
  if(delta&&rt)ser=ser.map(s=>({...s,y:s.x.map((x,i)=>s.y[i]-interp(rt.x,rt.y,x)),max:null}));
  return ser;
}
function renderProfiles(){
  const host=$('#t_profiles');host.innerHTML='';
  const opts=[el('optgroup',{label:'Tanımlı profiller (Eşleme)'},M.profiles.map(p=>el('option',{value:'p:'+p.id},p.label))),
    el('optgroup',{label:'Katalogdaki tüm seriler'},[...SCAT.values()].map(c=>el('option',{value:'k:'+c.k},descSr(c.k)+`  (${c.n}/${A.length})`)))];
  if(!profSel||(profSel.startsWith('p:')&&!M.profiles.some(p=>'p:'+p.id===profSel))||(profSel.startsWith('k:')&&!SCAT.has(profSel.slice(2))))profSel=M.profiles.length?'p:'+M.profiles[0].id:(SCAT.size?'k:'+SCAT.keys().next().value:'');
  if(!profSel){host.append(card('Hiç profil/seri bulunamadı.'));return;}
  const ps=el('select',{onchange:e=>{profSel=e.target.value;store.set('prof',profSel);profSwap=null;renderProfiles();}},opts);ps.value=profSel;
  const pd=profDef(),isDef=profSel.startsWith('p:');
  const upd=()=>{if(isDef)changed();renderProfiles();};
  const sw=profSwap==null?!!pd.swap:profSwap;
  const ser=profSeries(pd,selected(),profDelta);
  const xm=el('select',{onchange:e=>{pd.xm=e.target.value;upd();}},XMODES.map(([k,l])=>el('option',{value:k},l)));xm.value=pd.xm||'auto';
  const man=(pd.xm==='manual')?[' hub:',el('input',{type:'number',step:'any',value:pd.r0??'',style:'width:90px',onchange:e=>{pd.r0=e.target.value;upd();}}),' tip:',el('input',{type:'number',step:'any',value:pd.r1??'',style:'width:90px',onchange:e=>{pd.r1=e.target.value;upd();}})]:[];
  const ch=el('div',{class:'chart'}),f0=ser[0]||{};
  host.append(card(el('div',{class:'tools'},'Profil:',ps),
    el('div',{class:'tools'},'x ekseni:',xm,...man,el('label',{title:'0 = tip, 100 = hub olsun'},el('input',{type:'checkbox',checked:!!pd.rev,onchange:e=>{pd.rev=e.target.checked;upd();}}),' Ters çevir'),
      el('label',{},el('input',{type:'checkbox',checked:sw,onchange:e=>{profSwap=e.target.checked;renderProfiles();}}),' Span dikey eksende'),
      el('label',{},el('input',{type:'checkbox',checked:profDelta,onchange:e=>{profDelta=e.target.checked;renderProfiles();}}),' Referansa göre fark'),
      el('span',{class:'mut'},'● = maksimum (RTDF bu noktadan)'+(isDef?' · ayarlar profile kaydedilir':''))),ch,el('div',{class:'legend',id:'lg'})));
  lineChart(ch,ser,{xlabel:f0.xl||'Span',ylabel:(profDelta?'Δ ':'')+(pd.ylabel||f0.yl||''),swap:sw,markMax:!profDelta,zero:profDelta,spanAxis:!!f0.span});
  $('#lg').append(...ser.map(s=>el('span',{},el('i',{style:'background:'+s.color}),s.name+(s.ref?' (ref)':'')+(s.max?`  maks=${sig(s.max.y)} @ ${sig(s.max.x,4)}${s.span?'%':''}`:''))));
  const miss=selected().filter(a=>!getSer(a,pd)).map(a=>dn(a.name));
  if(miss.length)host.append(el('div',{class:'mut'},'Bu profil bulunamayanlar: '+miss.join(', ')+' (Eşleme sekmesinde analiz bazında seçilebilir)'));
}

// ================= Debi dağılımı =================
let splitSel=store.get('splitSel',null);
function renderSplit(){
  const host=$('#t_split');host.innerHTML='';
  if(!M.splits.length){host.append(card('Debi dağılımı grubu tanımlı değil. ',btn('Eşleme sekmesine git',()=>showTab('map'))));return;}
  const rows=selected();if(!rows.length){host.append(card('Soldan analiz seç.'));return;}
  if(!splitSel||!names.includes(splitSel))splitSel=rows[rows.length-1].name;
  const ss=el('select',{onchange:e=>{splitSel=e.target.value;store.set('splitSel',splitSel);renderSplit();}},A.map(a=>el('option',{value:a.name},dn(a.name))));ss.value=splitSel;
  const cur=RES.get(splitSel).m,refm=RES.get(REF)?.m;
  const c=card(el('div',{class:'tools'},'Analiz:',ss,el('span',{class:'mut'},'Etiketleri sürükleyerek kesit üzerine yerleştir (kaydedilir). Kırmızı/yeşil: referansa göre artış/azalış (yüzde puan).')));
  const img=store.get('secimg',null);
  const imgIn=el('input',{type:'file',accept:'image/*',onchange:e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{store.set('secimg',r.result);renderSplit();};r.readAsDataURL(f);}});
  c.append(el('div',{class:'tools'},'Kesit görseli:',imgIn,img?btn('Görseli kaldır',()=>{store.set('secimg',null);renderSplit();}):''));
  if(img){
    const box=el('div',{class:'sec'},el('img',{src:img,draggable:'false'}));
    M.splits.forEach((s,i)=>{
      const v=cur['split_'+i],r=refm?refm['split_'+i]:null,d=(v!=null&&r!=null&&splitSel!==REF)?v-r:null;
      const lab=el('div',{class:'lab'+(d==null?'':d>0.005?' up':d<-0.005?' dn':''),style:`left:${(s.x??.1)*100}%;top:${(s.y??.1)*100}%`},s.label,el('b',{},v==null?'–':fmt(v,2)+' %'),el('span',{},d==null?'':(d>0?'+':'')+fmt(d,2)+' pp'));
      lab.addEventListener('pointerdown',ev=>{ev.preventDefault();lab.setPointerCapture(ev.pointerId);
        const mv=e=>{const rc=box.getBoundingClientRect();s.x=+Math.min(1,Math.max(0,(e.clientX-rc.left)/rc.width)).toFixed(4);s.y=+Math.min(1,Math.max(0,(e.clientY-rc.top)/rc.height)).toFixed(4);lab.style.left=s.x*100+'%';lab.style.top=s.y*100+'%';};
        const up=()=>{lab.removeEventListener('pointermove',mv);lab.removeEventListener('pointerup',up);save();};
        lab.addEventListener('pointermove',mv);lab.addEventListener('pointerup',up);});
      box.append(lab);});
    c.append(box);
  }else c.append(el('div',{class:'mut'},'Kesit görseli seçersen değerler görselin üzerinde gösterilir (görsel bu bilgisayarda tarayıcıda saklanır; PowerPoint\'e de konur).'));
  host.append(c);
  const bars=el('div',{class:'card bars'},el('h2',{},'Debi dağılımı (giriş debisinin %’si)'));
  rows.forEach(a=>{const m=RES.get(a.name).m,bar=el('div',{class:'bar'});
    M.splits.forEach((s,i)=>{const v=m['split_'+i];if(v==null)return;bar.append(el('div',{class:'sg',style:`width:${Math.max(v,0)}%;background:${PAL[i%PAL.length]}`,title:`${s.label}: ${fmt(v,2)}%`},v>4?fmt(v,1):''));});
    bars.append(el('div',{class:'row'},el('div',{class:'nm',title:a.name},dn(a.name)),bar,el('span',{class:'mut'},'Σ '+fmt(m.split_sum,1)+'%')));});
  bars.append(el('div',{class:'legend'},M.splits.map((s,i)=>el('span',{},el('i',{style:'background:'+PAL[i%PAL.length]}),s.label))));
  host.append(bars);
}

// ================= Katalog =================
let catQ=store.get('catQ','');
function renderCatalog(){
  const host=$('#t_catalog');host.innerHTML='';
  const rows=selected();
  const q=el('input',{type:'text',value:catQ,placeholder:'ara: değişken, yüzey, dosya… (boşlukla birden çok kelime)',style:'width:420px',oninput:e=>{catQ=e.target.value;store.set('catQ',catQ);fillT();}});
  const tw=twBox(),sw=twBox();
  host.append(card(el('h2',{},'Bulunan tüm skaler değerler'),help('Analiz klasörlerinde okunan her şey (eşdeğer adlar birleştirilmiş). <b>değişken yap</b>: formüllerde kullanmak için ad ver.'),el('div',{class:'tools'},q,el('span',{class:'mut',id:'catn'})),tw),
    card(el('h2',{},'Bulunan seriler (profil / yakınsama geçmişi)'),sw));
  function fillT(){
    const ws=catQ.toLowerCase().split(/\s+/).filter(Boolean);
    const list=[...CAT.values()].filter(c=>{const t=(descSc(c.k)+' '+c.f).toLowerCase();return ws.every(w=>t.includes(w));}).sort((a,b)=>descSc(a.k).localeCompare(descSc(b.k)));
    $('#catn').textContent=list.length+' değer';
    const tb=el('tbody');
    list.slice(0,800).forEach(c=>tb.append(el('tr',{},el('td',{class:'l'},KIND[c.kind]||c.kind),el('td',{class:'l'},[...c.vs].join(' ≡ ')),el('td',{class:'l'},c.unit),el('td',{class:'l'},[...c.ss].join(' ≡ ')),
      rows.map(a=>{const s=a.scm.get(c.k);return el('td',{class:s?'':'na',title:s?s.f:''},s?sig(s.v,7):'–');}),
      el('td',{},btn('değişken yap',()=>{const n=prompt('Formüllerde kullanılacak ad (ör. mdot_swirl):',alnum(c.surf+'_'+c.kind).slice(0,20)||'x');if(!n)return;if(!isName(n)||scopeNames().includes(n)){alert('Geçersiz ya da kullanılan ad');return;}M.vars.push({name:n,key:c.k,show:true,over:{}});changed();alert(`'${n}' eklendi. Özet tablosunda sütun olarak görünür; Eşleme > Formüller'de kullanılabilir.`);})))));
    tw.innerHTML='';tw.append(el('table',{class:'sticky'},el('thead',{},el('tr',{},el('th',{class:'l'},'Tür'),el('th',{class:'l'},'Değişken'),el('th',{class:'l'},'Birim'),el('th',{class:'l'},'Yüzey'),rows.map(a=>el('th',{},dn(a.name))),el('th',{},''))),tb));
    if(list.length>800)tw.append(el('div',{class:'mut'},'İlk 800 gösteriliyor, aramayı daralt.'));
  }
  fillT();
  const tb=el('tbody');
  [...SCAT.values()].sort((a,b)=>a.f.localeCompare(b.f)).forEach(c=>tb.append(el('tr',{},el('td',{class:'l'},c.t==='xy'?'profil':'yakınsama'),el('td',{class:'l'},[...c.fs].join(' ≡ ')),el('td',{class:'l'},c.nm),el('td',{class:'l'},(c.xl||'')+' / '+(c.yl||'')),el('td',{},c.n+'/'+A.length),
    el('td',{},btn('çiz',()=>{profSel='k:'+c.k;store.set('prof',profSel);showTab('profiles');}),' ',btn('profil olarak ekle',()=>{let k=1;while(M.profiles.some(p=>p.id==='prof'+k))k++;M.profiles.push({id:'prof'+k,label:c.nm||c.f,key:c.k,swap:c.t==='xy',xm:c.t==='xy'?'auto':'raw',over:{}});changed();alert('Eklendi (Eşleme > Profiller).');})))));
  sw.append(el('table',{},el('thead',{},el('tr',{},['Tür','Dosya','Seri','x / y','Kapsam',''].map(h=>el('th',{class:'l'},h)))),tb));
}

// ================= Uyarılar =================
function renderWarn(){
  const host=$('#t_warn');host.innerHTML='';
  const c=card(el('h2',{},'Hesap uyarıları'));let n=0;
  A.forEach(a=>{const w=RES.get(a.name).w;if(!w.length)return;n+=w.length;c.append(el('h3',{},dn(a.name)),el('ul',{},w.map(x=>el('li',{},x))));});
  if(!n)c.append('Uyarı yok ✔');
  const t=el('tbody');
  A.forEach(a=>t.append(el('tr',{},el('td',{class:'l'},dn(a.name)),el('td',{class:'l mut'},a.name),el('td',{},a.nfiles),el('td',{},a.parsed.length),el('td',{},a.sc.length),el('td',{},a.sr.length),el('td',{},a.img.length),
    el('td',{class:'l',style:'white-space:normal'},[...a.skipped,...a.errors].join(' · ')||'—'))));
  host.append(c,card(el('h2',{},'Tarama özeti'),help('Okunan dosya = içeriği tanınan metin dosyası (report bloğu, XY, .out, tablo). Bir dosya tanınmıyorsa <code>py postproc.py diag klasör-adı</code> çıktısını paylaş (sayılar maskelenir).'),
    twBox(el('table',{},el('thead',{},el('tr',{},['Analiz','Klasör','Dosya','Okunan','Skaler','Seri','Görsel','Atlanan / hata'].map(h=>el('th',{class:'l'},h)))),t))));
}
