/* notes.js — analiz notları (kalıcı; eşleme dosyasında saklanır). © Muhammed Emin URAL */
let noteSel=store.get('noteSel',''),noteQ='';
const saveSoft=debounce(()=>{save();drawList();},600);
function keyDiff(an,base){ // ana metriklerde base'e göre fark
  const defs=metricDefs().filter(d=>d.better||['dPP_comb','OTDF','RTDF','Tt_out','mdot_in'].includes(d.key)||d.group==='Debi dağılımı');
  return defs.map(d=>{const v=mval(an,d.key),r=mval(base,d.key);return{d,v,r,dv:(v!=null&&r!=null)?v-r:null};}).filter(x=>x.v!=null);
}
function renderNotes(){
  const host=$('#t_notes');host.innerHTML='';
  if(!A.length){host.append(card('Analiz yok.'));return;}
  if(!names.includes(noteSel))noteSel=selected()[0]?.name||names[0];
  const list=el('div',{class:'card nlist'});
  const q=el('input',{type:'text',value:noteQ,placeholder:'notlarda ara…',style:'width:100%;margin-bottom:6px',oninput:e=>{noteQ=e.target.value;fillL();}});
  const lbox=el('div',{});list.append(q,lbox);
  function fillL(){lbox.innerHTML='';const w=noteQ.toLowerCase();
    A.forEach(a=>{const N=M.notes[a.name]||{};const txt=[dn(a.name),a.name,N.desc,N.text,N.tags,changesText(a.name),(N.log||[]).map(l=>l.text).join(' ')].join(' ').toLowerCase();if(w&&!txt.includes(w))return;
      lbox.append(el('div',{class:'it'+(a.name===noteSel?' on':''),onclick:()=>{noteSel=a.name;store.set('noteSel',noteSel);renderNotes();}},
        el('b',{},el('span',{class:'dot',style:'background:'+stColor(N.status)}),dn(a.name)),el('div',{},N.desc||(N.text||'').split('\n')[0]||el('i',{},'not yok'))));});}
  fillL();
  const a=byName(noteSel),N=NOTE(a.name);
  const ed=el('div',{class:'card'});
  const inp=(k,ph,w)=>el('input',{type:'text',value:N[k]??'',placeholder:ph,style:`width:${w||'100%'}`,oninput:e=>{N[k]=e.target.value;saveSoft();}});
  const idx=names.indexOf(a.name);
  ed.append(el('div',{class:'tools'},btn('◀',()=>{noteSel=names[(idx-1+names.length)%names.length];renderNotes();},'','önceki analiz'),btn('▶',()=>{noteSel=names[(idx+1)%names.length];renderNotes();},'','sonraki analiz'),
    el('h2',{style:'margin:0'},dn(a.name)),el('span',{class:'mut'},'klasör: '+a.name+' · son değişiklik: '+a.mtime),
    SERVE?btn('📂 klasörü aç',()=>fetch('api/open',{method:'POST',body:JSON.stringify({rel:a.name})})):'',el('span',{style:'flex:1'}),statusEl));
  const nameIn=el('input',{type:'text',value:M.alias[a.name]||'',placeholder:a.name,style:'width:100%',onchange:e=>{if(!renameAnalysis(a.name,e.target.value))e.target.value=M.alias[a.name]||'';}});
  const stSel=el('select',{onchange:e=>{N.status=e.target.value;save();renderNotes();}},STATUS.map(([k,l])=>el('option',{value:k},l)));stSel.value=N.status||'';
  const parSel=el('select',{onchange:e=>{N.parent=e.target.value;save();renderNotes();}},el('option',{value:''},'—'),A.filter(x=>x.name!==a.name).map(x=>el('option',{value:x.name},dn(x.name))));parSel.value=N.parent||'';
  const frm=el('div',{class:'frm'},
    el('label',{},'Görünen ad'),nameIn,
    el('label',{},'Durum'),el('div',{class:'tools',style:'margin:0'},stSel,EXTRA.parent?[el('span',{class:'mut'},'Türetildiği analiz:'),parSel]:''),
    el('label',{},'Ne değişti (kısa)'),inp('desc','tek satır özet — ör. "dilution-1 çapı +2 mm, swirler açısı 45°→50°"'),
    el('label',{},'Etiketler'),inp('tags','virgülle ayır — ör. dilution, iterasyon-3, aday'));
  ed.append(frm);
  // değişiklik tablosu
  const ch=N.changes||(N.changes=[]);const ctb=el('tbody');
  const drawCh=()=>{ctb.innerHTML='';ch.forEach((c,i)=>ctb.append(el('tr',{},
    el('td',{class:'l'},el('input',{type:'text',value:c.what||'',placeholder:'parça / parametre (ör. Dilution-1 deliği)',style:'width:300px',oninput:e=>{c.what=e.target.value;saveSoft();}})),
    el('td',{class:'l'},el('input',{type:'text',value:c.chg||'',placeholder:'değişim (ör. +2 mm uzatıldı, Ø8→Ø10)',style:'width:340px',oninput:e=>{c.chg=e.target.value;saveSoft();}})),
    el('td',{},i?el('button',{class:'x',onclick:()=>{[ch[i-1],ch[i]]=[ch[i],ch[i-1]];save();drawCh();}},'↑'):'',el('button',{class:'x',onclick:()=>{ch.splice(i,1);save();drawCh();}},'✕')))));};
  drawCh();
  ed.append(el('h3',{},'Geometri / kurulum değişiklikleri'),el('table',{},el('thead',{},el('tr',{},el('th',{class:'l'},'Ne'),el('th',{class:'l'},'Değişim'),el('th',{}))),ctb),
    el('div',{class:'tools',style:'margin-top:4px'},btn('+ satır',()=>{ch.push({what:'',chg:''});save();drawCh();ctb.querySelector('tr:last-child input')?.focus();}),
      N.parent&&M.notes[N.parent]&&(M.notes[N.parent].changes||[]).length?btn('türetildiği analizin değişikliklerini kopyala',()=>{M.notes[N.parent].changes.forEach(c=>ch.push({...c}));save();drawCh();}):''));
  // serbest not
  const ta=el('textarea',{rows:7,placeholder:'Detaylı not: neden yapıldı, ne bekleniyordu, sonuç ne oldu, sonraki adım…',oninput:e=>{N.text=e.target.value;saveSoft();}});ta.value=N.text||'';
  ed.append(el('h3',{},'Not'),ta);
  // günlük
  const log=N.log||(N.log=[]);const lin=el('input',{type:'text',placeholder:'günlüğe ekle (tarih otomatik) — ör. "mesh 12M’e çıkarıldı, tekrar koşuldu"',style:'flex:1;min-width:300px'});
  const addLog=()=>{const t=lin.value.trim();if(!t)return;log.unshift({t:nowStr(),text:t});lin.value='';save();renderNotes();};
  lin.addEventListener('keydown',e=>{if(e.key==='Enter')addLog();});
  ed.append(el('h3',{},'Günlük'),el('div',{class:'tools'},lin,btn('Ekle',addLog,'p')),
    el('div',{},log.map((l,i)=>el('div',{class:'log'},el('small',{},l.t),' ',l.text,el('button',{class:'x',onclick:()=>{if(confirm('Bu günlük kaydı silinsin mi?')){log.splice(i,1);save();renderNotes();}}},'✕')))));
  // otomatik karşılaştırma
  const base=(EXTRA.parent&&N.parent)||(a.name!==REF?REF:null);
  if(base){const kd=keyDiff(a.name,base);
    ed.append(el('h3',{},`Sonuçlar — ${N.parent&&EXTRA.parent?'türetildiği analize':'referansa'} (${dn(base)}) göre`),
      kd.length?twBox(el('table',{},el('thead',{},el('tr',{},['Metrik','Bu analiz',dn(base),'Fark'].map(h=>el('th',{class:'l'},h)))),
        el('tbody',{},kd.map(x=>{const bad=x.dv!=null&&x.d.better&&((x.d.better==='low'&&x.dv>0)||(x.d.better==='high'&&x.dv<0)),good=x.dv!=null&&x.d.better&&x.dv!==0&&!bad;
          return el('tr',{},el('td',{class:'l'},x.d.label+(x.d.unit&&x.d.unit!=='-'?' ['+x.d.unit+']':'')),el('td',{},fmt(x.v,x.d.digits)),el('td',{},fmt(x.r,x.d.digits)),el('td',{class:good?'best':bad?'worst':''},x.dv==null?'–':(x.dv>0?'+':'')+fmt(x.dv,x.d.digits)));})))):el('div',{class:'mut'},'karşılaştırılacak değer yok'));}
  // gelişmiş
  ed.append(el('details',{style:'margin-top:10px'},el('summary',{class:'mut'},'Gelişmiş'),el('div',{class:'tools',style:'margin-top:6px'},'T maks çıkış [K] (report’ta Maximum yoksa OTDF için):',
    el('input',{type:'number',step:'any',value:N.Tmax_exit??'',placeholder:'boş = otomatik',style:'width:120px',onchange:e=>{N.Tmax_exit=e.target.value;changed();renderNotes();}}))));
  host.append(el('div',{class:'nwrap'},list,ed));
}
