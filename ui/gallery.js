/* gallery.js — görsel gruplama ve karşılaştırma. © Muhammed Emin URAL */
let gv={mode:store.get('gvMode','cmp'),lay:store.get('gvLay','grid'),grp:store.get('gvGrp',''),f:store.get('galF',''),cols:store.get('gvCols',0),
  size:store.get('galSize',260),a:'',b:'',fade:.5,swipe:50,gain:4,showG:false};
let Z={s:1,x:0,y:0},blinkT=null;
const ZV=[];
function applyZ(){ZV.forEach(v=>v.querySelectorAll('.zin').forEach(i=>i.style.transform=`translate(${Z.x*100}%,${Z.y*100}%) scale(${Z.s})`));}
function clampZ(){Z.s=Math.min(30,Math.max(1,Z.s));Z.x=Math.min(0,Math.max(1-Z.s,Z.x));Z.y=Math.min(0,Math.max(1-Z.s,Z.y));}
// senkron yakınlaştırılabilir görüntüleyici. layers: [alt, üst?] öğeler (img/canvas)
function zview(layers,caps){
  const v=el('div',{class:'zv',title:'tekerlek: yakınlaştır · sürükle: kaydır · çift tık: sıfırla'});
  layers.forEach((n,i)=>v.append(el('div',{class:'lay'+(i?' top':'')},el('div',{class:'zin'},n))));
  (caps||[]).forEach((c,i)=>c&&v.append(el('div',{class:'cap'+(i?' r':'')},c)));
  v.addEventListener('wheel',e=>{e.preventDefault();const r=v.getBoundingClientRect(),fx=(e.clientX-r.left)/r.width,fy=(e.clientY-r.top)/r.height;
    const s2=Math.min(30,Math.max(1,Z.s*(e.deltaY<0?1.2:1/1.2)));const ux=(fx-Z.x)/Z.s,uy=(fy-Z.y)/Z.s;Z.s=s2;Z.x=fx-ux*s2;Z.y=fy-uy*s2;clampZ();applyZ();},{passive:false});
  let st=null;
  v.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.classList.contains('bar'))return;st={x:e.clientX,y:e.clientY,zx:Z.x,zy:Z.y,w:v.clientWidth,h:v.clientHeight};v.setPointerCapture(e.pointerId);v.classList.add('panning');});
  v.addEventListener('pointermove',e=>{if(!st)return;Z.x=st.zx+(e.clientX-st.x)/st.w;Z.y=st.zy+(e.clientY-st.y)/st.h;clampZ();applyZ();});
  const end=()=>{st=null;v.classList.remove('panning');};v.addEventListener('pointerup',end);v.addEventListener('pointercancel',end);
  v.addEventListener('dblclick',()=>{Z={s:1,x:0,y:0};applyZ();});
  ZV.push(v);return v;
}
function mkImg(an,rel){const i=el('img',{src:imgURL(an,rel),alt:rel,draggable:'false'});i.onerror=()=>i.replaceWith(el('div',{class:'miss'},'Açılamadı: '+rel+(SHARED?' (paylaşıma dahil edilmemiş)':'')));return i;}
function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('yüklenemedi'));i.src=src;});}

function renderGallery(){
  const host=$('#t_gallery');host.innerHTML='';ZV.length=0;clearInterval(blinkT);
  const rows=selected();
  const G=imgGroups(rows,gv.f);
  if(!rows.some(a=>a.img.length)){host.append(card('Seçili analizlerde görsel bulunamadı.'));return;}
  const set=(k,v,keep)=>{gv[k]=v;if(keep)store.set(keep,v);renderGallery();};
  const fl=el('input',{type:'text',value:gv.f,placeholder:'klasör/ad filtresi (ör. summary  -comprehensive)',style:'width:300px',onchange:e=>set('f',e.target.value,'galF')});
  const tok=el('select',{title:'Otomatik gruplama: analiz adı çıkarılmış dosya adının ilk kaç parçası (_ - . ile ayrılan) aynıysa aynı görsel sayılır',onchange:e=>{M.img.tok=+e.target.value;save();renderGallery();}},[1,2,3,4,5].map(n=>el('option',{value:n},'ilk '+n+' parça')));tok.value=M.img.tok||2;
  host.append(card(el('div',{class:'tools'},segBtns([['cmp','Karşılaştır'],['mtx','Matris'],['all','Tüm görseller']],gv.mode,k=>set('mode',k,'gvMode')),
      fl,'Eşleştirme:',tok,btn((gv.showG?'▾':'▸')+' Görsel grupları ('+(M.img.groups||[]).length+')',()=>set('showG',!gv.showG)),
      el('span',{class:'mut'},G.length+' grup')),gv.showG?groupEditor(rows,G):''));
  if(gv.mode==='mtx')return host.append(matrixView(rows,G));
  if(gv.mode==='all')return host.append(allView(rows));
  host.append(compareView(rows,G));
}
function groupEditor(rows,G){
  const box=el('div',{});
  box.append(help('Farklı analizlerde aynı görsel farklı adla kaydedilmiş olabilir (ör. <code>ATP_cp_analiz3_v2.png</code>, <code>ATP_cp_final.png</code>). Burada <b>önek</b> (ATP_cp) ya da joker kalıp (<code>*_cp_*</code>) ile grup tanımla; tanımsız görseller otomatik gruplanır. Analiz adı dosya adından otomatik çıkarılır.'));
  const tb=el('tbody');
  (M.img.groups||[]).forEach((g,i)=>{const gg=G.find(x=>x.key==='u:'+i);
    tb.append(el('tr',{},el('td',{class:'l'},el('input',{type:'text',value:g.label||'',placeholder:'ad (ör. Pt kontur)',style:'width:180px',onchange:e=>{g.label=e.target.value;save();renderGallery();}})),
      el('td',{class:'l'},el('input',{type:'text',value:g.pat||'',placeholder:'önek / kalıp',style:'width:200px;font-family:monospace',onchange:e=>{g.pat=e.target.value;save();renderGallery();}})),
      el('td',{class:'l'},gg?`${gg.items.size}/${rows.length} analiz`:'0'),
      el('td',{},i?el('button',{class:'x',title:'yukarı',onclick:()=>{const l=M.img.groups;[l[i-1],l[i]]=[l[i],l[i-1]];save();renderGallery();}},'↑'):'',el('button',{class:'x',onclick:()=>{M.img.groups.splice(i,1);save();renderGallery();}},'✕'))));});
  box.append(el('table',{},el('thead',{},el('tr',{},['Grup adı','Önek / kalıp','Kapsam',''].map(h=>el('th',{class:'l'},h)))),tb));
  const auto=G.filter(g=>!g.user);
  const pick=el('select',{},el('option',{value:''},'— otomatik gruptan ekle —'),auto.map(g=>el('option',{value:g.label},`${g.label}  (${g.items.size}/${rows.length})`)));
  box.append(el('div',{class:'tools',style:'margin-top:6px'},btn('+ Grup ekle',()=>{M.img.groups.push({label:'',pat:''});save();renderGallery();}),pick,
    btn('Ekle',()=>{if(!pick.value)return;M.img.groups.push({label:pick.value,pat:pick.value});save();renderGallery();}),
    btn('Tüm otomatik grupları kalıcı yap',()=>{auto.forEach(g=>M.img.groups.push({label:g.label,pat:g.label}));save();renderGallery();})));
  return box;
}
function compareView(rows,G){
  const wrap=el('div',{id:'gv'});
  if(!G.length){wrap.append(card('Filtreye uyan görsel yok.'));return wrap;}
  let gi=G.findIndex(g=>g.key===gv.grp||g.label===gv.grp);if(gi<0)gi=0;const g=G[gi];gv.grp=g.label;
  const go=d=>{const n=G[(gi+d+G.length)%G.length];gv.grp=n.label;store.set('gvGrp',n.label);Z={s:1,x:0,y:0};renderGallery();};
  window._galGo=go;
  const gs=el('select',{onchange:e=>{gv.grp=e.target.value;store.set('gvGrp',gv.grp);renderGallery();}},G.map(x=>el('option',{value:x.label},`${x.user?'★ ':''}${x.label}  (${x.items.size}/${rows.length})`)));gs.value=g.label;
  const have=rows.filter(a=>g.items.has(a.name));
  if(!have.some(a=>a.name===gv.a))gv.a=have.some(a=>a.name===REF)?REF:(have[0]||{}).name;
  if(!have.some(a=>a.name===gv.b)||gv.b===gv.a)gv.b=(have.find(a=>a.name!==gv.a)||{}).name;
  const lays=[['grid','Yan yana'],['swipe','Kaydırmalı'],['fade','Üst üste'],['blink','Yanıp sönme']];if(EXTRA.diffImg)lays.push(['diff','Fark']);
  const aSel=(k)=>{const s=el('select',{onchange:e=>{gv[k]=e.target.value;renderGallery();}},have.map(a=>el('option',{value:a.name},dn(a.name))));s.value=gv[k]||'';return s;};
  const ab=gv.lay!=='grid'&&have.length>=2;
  const tools=el('div',{class:'tools'},btn('◀',()=>go(-1),'','önceki grup (←)'),gs,btn('▶',()=>go(1),'','sonraki grup (→)'),
    segBtns(lays,gv.lay,k=>{gv.lay=k;store.set('gvLay',k);renderGallery();}),
    gv.lay==='grid'?['Sütun:',(()=>{const s=el('select',{onchange:e=>{gv.cols=+e.target.value;store.set('gvCols',gv.cols);renderGallery();}},[0,1,2,3,4,5].map(n=>el('option',{value:n},n?n:'oto')));s.value=gv.cols;return s;})()]:'',
    ab?['A:',aSel('a'),'B:',aSel('b'),btn('⇄',()=>{[gv.a,gv.b]=[gv.b,gv.a];renderGallery();},'','A ile B yer değiştir')]:'',
    gv.lay==='fade'&&ab?['B opaklığı',el('input',{type:'range',min:0,max:1,step:.01,value:gv.fade,oninput:e=>{gv.fade=+e.target.value;wrap.querySelectorAll('.lay.top').forEach(t=>t.style.opacity=gv.fade);}})]:'',
    gv.lay==='diff'&&ab?['Kazanç',el('input',{type:'range',min:1,max:20,step:1,value:gv.gain,onchange:e=>{gv.gain=+e.target.value;renderGallery();}})]:'',
    btn('Zoom sıfırla',()=>{Z={s:1,x:0,y:0};applyZ();}),btn('⛶ Tam ekran',()=>{const w=$('#gv');(document.fullscreenElement?document.exitFullscreen():w.requestFullscreen&&w.requestFullscreen());}));
  wrap.append(card(tools,el('div',{class:'mut'},'Tekerlek = yakınlaştır, sürükle = kaydır (tüm görseller birlikte hareket eder) · çift tık = sıfırla · ← → = grup değiştir')));
  const body=el('div',{class:'card'});wrap.append(body);
  const capOf=an=>dn(an)+(an===REF?' (ref)':'');
  if(gv.lay==='grid'||!ab){
    const n=rows.length,cols=gv.cols||Math.min(n,n<=4?n:3);
    const grid=el('div',{class:'vgrid',style:`grid-template-columns:repeat(${cols},minmax(0,1fr))`});
    rows.forEach(a=>{const p=imgPick(g,a.name),l=g.items.get(a.name)||[];
      const cand=l.length>1?(()=>{const s=el('select',{title:'bu analizde gruba uyan birden çok görsel var',onchange:e=>{setImgPick(g,a.name,e.target.value);renderGallery();}},l.map(x=>el('option',{value:x},x)));s.value=p;return s;})():el('span',{},p||'');
      grid.append(el('figure',{class:'vfig'},p?zview([mkImg(a.name,p)],[capOf(a.name)]):el('div',{class:'zv'},el('div',{class:'miss'},capOf(a.name)+': bu grupta görsel yok')),el('figcaption',{},cand)));});
    body.append(grid);
  }else{
    const pa=imgPick(g,gv.a),pb=imgPick(g,gv.b);
    if(gv.lay==='diff'){const cv=el('canvas',{});const msg=el('div',{class:'mut'},'fark hesaplanıyor…');const box=el('div',{style:'max-width:1400px;margin:auto'},zview([cv],[`|${dn(gv.a)} − ${dn(gv.b)}|`]));body.append(msg,box);fitH(box,imgURL(gv.a,pa));
      diffInto(cv,imgURL(gv.a,pa),imgURL(gv.b,pb),gv.gain).then(r=>msg.textContent=`Beyaz = aynı, kırmızı = farklı. Farklı piksel oranı: ${fmt(r*100,1)}% (kazanç ×${gv.gain})`).catch(e=>msg.textContent='Fark hesaplanamadı: '+e.message+(location.protocol==='file:'?' (dosyadan açılan HTML\'de tarayıcı izin vermiyor; canlı modda çalışır)':''));}
    else{
      const v=zview([mkImg(gv.a,pa),mkImg(gv.b,pb)],[capOf(gv.a),capOf(gv.b)]);
      const top=v.querySelector('.lay.top');
      // üst katman B, alt A. kaydırmalıda B sağ tarafta görünür
      if(gv.lay==='swipe'){const bar=el('div',{class:'bar',style:`left:${gv.swipe}%`});const ap=()=>{top.style.clipPath=`inset(0 0 0 ${gv.swipe}%)`;bar.style.left=gv.swipe+'%';};ap();
        bar.addEventListener('pointerdown',e=>{e.stopPropagation();bar.setPointerCapture(e.pointerId);const mv=ev=>{const r=v.getBoundingClientRect();gv.swipe=Math.min(100,Math.max(0,(ev.clientX-r.left)/r.width*100));ap();};
          const up=()=>{bar.removeEventListener('pointermove',mv);bar.removeEventListener('pointerup',up);};bar.addEventListener('pointermove',mv);bar.addEventListener('pointerup',up);});v.append(bar);}
      if(gv.lay==='fade')top.style.opacity=gv.fade;
      if(gv.lay==='blink'){let on=true;blinkT=setInterval(()=>{if(!document.body.contains(top)){clearInterval(blinkT);return;}on=!on;top.style.visibility=on?'visible':'hidden';v.querySelector('.cap.r').style.visibility=on?'visible':'hidden';},700);}
      const box=el('div',{style:'max-width:1400px;margin:auto'},v);body.append(box);fitH(box,imgURL(gv.a,pa));
    }
  }
  applyZ();
  return wrap;
}
// tek büyük görüntüleyici ekran yüksekliğini aşmasın
function fitH(box,src){loadImage(src).then(im=>{box.style.maxWidth=Math.min(1400,Math.round((window.innerHeight-260)*im.naturalWidth/im.naturalHeight))+'px';}).catch(()=>{});}
async function diffInto(cv,ua,ub,gain){
  const [ia,ib]=await Promise.all([loadImage(ua),loadImage(ub)]);
  const w=ia.naturalWidth,h=ia.naturalHeight;cv.width=w;cv.height=h;
  const c1=document.createElement('canvas');c1.width=w;c1.height=h;const g1=c1.getContext('2d');g1.drawImage(ia,0,0);const da=g1.getImageData(0,0,w,h).data;
  g1.clearRect(0,0,w,h);g1.drawImage(ib,0,0,w,h);const db=g1.getImageData(0,0,w,h).data;
  const g=cv.getContext('2d'),out=g.createImageData(w,h),o=out.data;let nd=0;
  for(let i=0;i<da.length;i+=4){const d=Math.min(255,(Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2]))/3*gain);if(d>24)nd++;
    o[i]=255;o[i+1]=255-d;o[i+2]=255-d;o[i+3]=255;}
  g.putImageData(out,0,0);return nd/(w*h);
}
function matrixView(rows,G){
  const tb=el('tbody');
  G.forEach(g=>tb.append(el('tr',{},el('td',{class:'l'},el('b',{},(g.user?'★ ':'')+g.label),el('div',{class:'mut'},`${g.items.size}/${rows.length}`)),
    rows.map(a=>{const p=imgPick(g,a.name);if(!p)return el('td',{class:'na'},'–');
      const i=el('img',{src:imgURL(a.name,p),loading:'lazy',style:`width:${gv.size}px`,title:p+'\n(tıkla: karşılaştır)',onclick:()=>{gv.mode='cmp';gv.grp=g.label;store.set('gvMode','cmp');store.set('gvGrp',g.label);renderGallery();}});
      i.onerror=()=>i.replaceWith(el('span',{class:'warn'},'açılamadı'));return el('td',{},i);}))));
  return card(el('div',{class:'tools'},'Boyut',el('input',{type:'range',min:100,max:600,value:gv.size,onchange:e=>{gv.size=+e.target.value;store.set('galSize',gv.size);renderGallery();}}),el('span',{class:'mut'},'Satır = görsel grubu, sütun = analiz. Bir görsele tıkla → karşılaştırma.')),
    twBox(el('table',{class:'mtx sticky'},el('thead',{},el('tr',{},el('th',{class:'l'},'Grup'),rows.map(a=>el('th',{class:a.name===REF?'ref':''},dn(a.name))))),tb)));
}
function allView(rows){
  const grid=el('div',{class:'grid',style:`grid-template-columns:repeat(auto-fill,minmax(${gv.size}px,1fr))`});
  const items=rows.flatMap(a=>a.img.filter(p=>imgFilterOK(a.name+'/'+p,gv.f)).map(p=>({an:a.name,p})));
  items.slice(0,400).forEach(it=>{const u=imgURL(it.an,it.p);const img=el('img',{src:u,loading:'lazy',title:it.p});img.onerror=()=>img.replaceWith(el('div',{class:'warn',style:'padding:8px'},'Açılamadı: '+it.p));
    grid.append(el('figure',{},el('a',{href:u,target:'_blank'},img),el('figcaption',{},dn(it.an)+' / '+it.p)));});
  return card(el('div',{class:'tools'},'Boyut',el('input',{type:'range',min:120,max:900,value:gv.size,onchange:e=>{gv.size=+e.target.value;store.set('galSize',gv.size);renderGallery();}}),el('span',{class:'mut'},items.length+' görsel'+(items.length>400?' (ilk 400)':''))),grid);
}
document.addEventListener('keydown',e=>{if(tab!=='gallery'||gv.mode!=='cmp'||e.target.closest('input,select,textarea'))return;if(e.key==='ArrowLeft'&&window._galGo)window._galGo(-1);if(e.key==='ArrowRight'&&window._galGo)window._galGo(1);});
