/* main.js — arayüz iskeleti ve başlatma. © Muhammed Emin URAL */
$('#gen').textContent=(SERVE?'Canlı':SHARED?'Paylaşım':'Statik')+' · '+D.generated+' · '+A.length+' analiz';
$('#fver').textContent='v'+D.version+(SHARED?'':' · '+(D.root||''));
const TABS=[['overview','Özet'],['profiles','Profiller'],['split','Debi dağılımı'],['gallery','Görseller'],['notes','Notlar'],['map','Eşleme & formüller'],['catalog','Katalog'],['warn','Uyarılar']];
tab=(location.hash||'').slice(1)||store.get('tab',A.length?'overview':'map');
TABS.forEach(([k,l])=>{$('#main').append(el('section',{id:'t_'+k,class:'hide'}));$('#nav').append(el('button',{onclick:()=>showTab(k),'data-k':k},l));});
function showTab(t){tab=t;store.set('tab',t);history.replaceState(null,'','#'+t);TABS.forEach(([k])=>$('#t_'+k).classList.toggle('hide',k!==t));[...$('#nav').children].forEach(b=>b.classList.toggle('on',b.dataset.k===t));render();}
function updateWarnBadge(){const n=[...RES.values()].reduce((s,r)=>s+r.w.length,0);const b=$('#nav [data-k=warn]');if(b){b.innerHTML='';b.append('Uyarılar',n?el('span',{class:'n'},n):'');}}
function fillRef(){const s=$('#refSel');s.innerHTML='';s.append(...A.map(a=>el('option',{value:a.name},dn(a.name))));s.value=REF;}
$('#refSel').onchange=e=>{REF=e.target.value;store.set('ref',REF);render();};
$('#allB').onclick=()=>{sel=new Set(names);store.set('sel',[...sel]);render();};
$('#noneB').onclick=()=>{sel=new Set();store.set('sel',[]);render();};
$('#aflt').oninput=()=>drawList();
function drawList(){
  const box=$('#alist');box.innerHTML='';const f=$('#aflt').value.toLowerCase();
  A.forEach(a=>{const N=M.notes[a.name]||{};
    if(f&&![a.name,dn(a.name),N.tags,N.desc,N.text].join(' ').toLowerCase().includes(f))return;
    const cb=el('input',{type:'checkbox',checked:sel.has(a.name)});
    cb.onchange=()=>{cb.checked?sel.add(a.name):sel.delete(a.name);store.set('sel',[...sel]);render();};
    const r=RES.get(a.name);
    const lab=el('label',{title:[dn(a.name)!==a.name?'klasör: '+a.name:'',N.desc,N.tags?'etiket: '+N.tags:'',a.mtime,'çift tıkla: yeniden adlandır'].filter(Boolean).join('\n')},
      cb,el('i',{class:'sw',style:'background:'+color(a.name)}),el('span',{class:'dn',ondblclick:e=>{e.preventDefault();renameAnalysis(a.name);}},dn(a.name)),
      N.status?el('span',{class:'dot',style:'background:'+stColor(N.status),title:stLabel(N.status)}):'',
      r&&r.w.length?el('span',{class:'warn',title:r.w.join('\n')},'⚠'):'');
    dnd(lab,lab,'side',a.name,reorder);box.append(lab);});
}
(function(){
  const s=$('#srv');
  if(SERVE)s.append(btn('↻ Yeniden tara',()=>location.reload()),
      btn('Klasör…',()=>{const r=prompt('Analiz klasörlerinin bulunduğu klasör (ör. D:\\analizler):',D.root);if(!r)return;
        fetch('api/root',{method:'POST',body:JSON.stringify({root:r})}).then(x=>x.json()).then(j=>j.ok?location.reload():alert(j.err));}));
  else s.append(el('span',{class:'mut',title:'Değişiklikler bu tarayıcıda saklanır'},SHARED?'paylaşılan görünüm':'statik görünüm'));
  s.append(btn('⇪ Dışa aktar',()=>openExport(),'p','PowerPoint, Excel, paylaşım HTML’i'));
})();
function render(){drawList();({overview:renderOverview,profiles:renderProfiles,split:renderSplit,gallery:renderGallery,map:renderMap,catalog:renderCatalog,notes:renderNotes,warn:renderWarn})[tab]();}
let rsz;window.addEventListener('resize',()=>{clearTimeout(rsz);rsz=setTimeout(()=>{if(tab==='profiles'||tab==='overview')render();},200);});
recompute();fillRef();
if(SERVE&&!D.mapping&&A.length)save();
showTab(TABS.some(t=>t[0]===tab)?tab:'overview');
console.log('%cCombustor Post-Process · '+AUTHOR,'font-weight:bold');
