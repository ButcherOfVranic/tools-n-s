/* charts.js — SVG grafikler (ekran + PowerPoint için PNG). © Muhammed Emin URAL */
const LIGHT={fg:'#1d2330',ln:'#e4e7ec',bg:'#ffffff',mut:'#667085'};
function liveTheme(){const cs=getComputedStyle(document.body);return{fg:cs.color,ln:cs.getPropertyValue('--line').trim()||'#ddd',bg:'none',mut:cs.getPropertyValue('--mut').trim()||'#888'};}
const FONT='Segoe UI, Roboto, Arial, sans-serif';
function niceTicks(a,b,n){n=n||6;if(a===b){a-=1;b+=1;}const sp=b-a,s0=sp/n,mag=Math.pow(10,Math.floor(Math.log10(s0))),r=s0/mag;
  const st=(r<1.5?1:r<3?2:r<7?5:10)*mag;const t=[];for(let v=Math.ceil(a/st-1e-9)*st;v<=b+st*1e-9;v+=st)t.push(+v.toPrecision(12));return t;}
function interp(xs,ys,x){if(x<=xs[0])return ys[0];if(x>=xs[xs.length-1])return ys[ys.length-1];let lo=0,hi=xs.length-1;while(hi-lo>1){const md=(lo+hi)>>1;if(xs[md]<=x)lo=md;else hi=md;}const t=(x-xs[lo])/((xs[hi]-xs[lo])||1);return ys[lo]+t*(ys[hi]-ys[lo]);}
function svgText(p,x,y,txt,a){const t=sv('text',Object.assign({x,y,'font-size':12,'font-family':FONT},a||{}),p);t.textContent=txt;return t;}
function legendSVG(svg,items,W,y0,th){ // dışa aktarılan PNG'ler için grafik içi lejant
  let x=60,y=y0;items.forEach(it=>{const w=Math.min(260,16+7*String(it.name).length+30);if(x+w>W-10){x=60;y+=18;}
    sv('rect',{x,y:y-6,width:16,height:4,fill:it.color},svg);svgText(svg,x+22,y,it.name,{fill:LIGHT.fg,'font-size':12});x+=w;});return y;}
function legendRows(items,W){let x=60,r=1;items.forEach(it=>{const w=Math.min(260,16+7*String(it.name).length+30);if(x+w>W-10){x=60;r++;}x+=w;});return r;}
// series: [{name,color,x,y,max:{x,y},ref}]  o: {xlabel,ylabel,swap,markMax,zero,W,H,th,legend,title}
function chartSVG(series,o){
  const th=o.th||LIGHT,W=o.W,legR=o.legend?legendRows(series,W):0;
  const H=o.H,m={l:84,r:18,t:o.title?34:16,b:54+legR*18};
  const sw=!!o.swap,hx=(x,y)=>sw?y:x,vy=(x,y)=>sw?x:y;
  const X=[],Y=[];series.forEach(s=>s.x.forEach((x,i)=>{X.push(hx(x,s.y[i]));Y.push(vy(x,s.y[i]));}));
  const svg=sv('svg',{width:W,height:H,viewBox:`0 0 ${W} ${H}`,'font-family':FONT});
  if(th.bg&&th.bg!=='none')sv('rect',{x:0,y:0,width:W,height:H,fill:th.bg},svg);
  if(o.title)svgText(svg,m.l,20,o.title,{fill:th.fg,'font-size':15,'font-weight':600});
  if(!X.length){svgText(svg,W/2,H/2,'veri yok',{fill:th.mut,'text-anchor':'middle'});return{svg};}
  const ext=arr=>{let a=Infinity,b=-Infinity;arr.forEach(v=>{if(v<a)a=v;if(v>b)b=v;});const p=(b-a||Math.abs(a)||1)*0.04;return[a-p,b+p];};
  let [x0,x1]=ext(X),[y0,y1]=ext(Y);
  if(o.spanAxis){if(!sw){x0=Math.min(x0,0);x1=Math.max(x1,100);}else{y0=Math.min(y0,0);y1=Math.max(y1,100);}}
  const px=v=>m.l+(v-x0)/(x1-x0)*(W-m.l-m.r),py=v=>H-m.b-(v-y0)/(y1-y0)*(H-m.t-m.b);
  niceTicks(x0,x1,8).forEach(t=>{if(t<x0||t>x1)return;sv('line',{x1:px(t),x2:px(t),y1:m.t,y2:H-m.b,stroke:th.ln},svg);svgText(svg,px(t),H-m.b+16,+t.toPrecision(6),{'text-anchor':'middle','font-size':11,fill:th.fg});});
  niceTicks(y0,y1,8).forEach(t=>{if(t<y0||t>y1)return;sv('line',{x1:m.l,x2:W-m.r,y1:py(t),y2:py(t),stroke:th.ln},svg);svgText(svg,m.l-6,py(t)+4,+t.toPrecision(6),{'text-anchor':'end','font-size':11,fill:th.fg});});
  sv('rect',{x:m.l,y:m.t,width:W-m.l-m.r,height:H-m.t-m.b,fill:'none',stroke:th.fg,'stroke-opacity':.4},svg);
  svgText(svg,(m.l+W-m.r)/2,H-m.b+38,sw?o.ylabel:o.xlabel,{'text-anchor':'middle',fill:th.fg});
  svgText(svg,0,0,sw?o.xlabel:o.ylabel,{transform:`translate(16 ${(m.t+H-m.b)/2}) rotate(-90)`,'text-anchor':'middle',fill:th.fg});
  if(o.zero&&y0<0&&y1>0&&!sw)sv('line',{x1:m.l,x2:W-m.r,y1:py(0),y2:py(0),stroke:th.fg,'stroke-opacity':.5},svg);
  if(o.zero&&x0<0&&x1>0&&sw)sv('line',{y1:m.t,y2:H-m.b,x1:px(0),x2:px(0),stroke:th.fg,'stroke-opacity':.5},svg);
  series.forEach(s=>{
    const d=s.x.map((x,i)=>(i?'L':'M')+px(hx(x,s.y[i])).toFixed(1)+' '+py(vy(x,s.y[i])).toFixed(1)).join('');
    sv('path',{d,fill:'none',stroke:s.color,'stroke-width':s.ref?3:1.8,'stroke-linejoin':'round'},svg);
    if(o.markMax&&s.max){const c=sv('circle',{cx:px(hx(s.max.x,s.max.y)),cy:py(vy(s.max.x,s.max.y)),r:5,fill:s.color,stroke:'#fff','stroke-width':1.5},svg);sv('title',{},c).textContent=`${s.name}: maks ${sig(s.max.y,7)} @ ${sig(s.max.x,4)}`;}
  });
  if(o.legend)legendSVG(svg,series.map(s=>({name:s.name+(s.ref?' (ref)':''),color:s.color})),W,H-legR*18+4,th);
  return{svg,px,py,x0,x1,y0,y1,m,W,H,sw};
}
function lineChart(host,series,o){
  host.innerHTML='';
  const W=Math.max(host.clientWidth||900,420),H=o.height||480;
  if(!series.length){host.append(el('div',{class:'mut',style:'padding:20px'},'Seçili analizlerde bu profil için veri yok.'));return;}
  const C=chartSVG(series,Object.assign({},o,{W,H,th:liveTheme()}));const svg=C.svg,m=C.m,sw=C.sw;
  const fg=liveTheme().fg;
  const cross=sv('line',{stroke:fg,'stroke-opacity':.5,'stroke-dasharray':'4 3',display:'none'},svg);
  const tip=el('div',{class:'tip'});host.append(svg,tip);
  svg.addEventListener('mousemove',ev=>{
    const r=svg.getBoundingClientRect(),mx=(ev.clientX-r.left)*W/r.width,my=(ev.clientY-r.top)*H/r.height;
    if(mx<m.l||mx>W-m.r||my<m.t||my>H-m.b){cross.setAttribute('display','none');tip.style.display='none';return;}
    const q=sw?C.y0+(H-m.b-my)/(H-m.t-m.b)*(C.y1-C.y0):C.x0+(mx-m.l)/(W-m.l-m.r)*(C.x1-C.x0);
    const rows=series.map(s=>{let bi=0,bd=Infinity;s.x.forEach((v,i)=>{const d=Math.abs(v-q);if(d<bd){bd=d;bi=i;}});return{s,i:bi};});
    const sq=rows[0].s.x[rows[0].i];
    if(sw){cross.setAttribute('x1',m.l);cross.setAttribute('x2',W-m.r);cross.setAttribute('y1',C.py(sq));cross.setAttribute('y2',C.py(sq));}
    else{cross.setAttribute('y1',m.t);cross.setAttribute('y2',H-m.b);cross.setAttribute('x1',C.px(sq));cross.setAttribute('x2',C.px(sq));}
    cross.setAttribute('display','');
    tip.innerHTML='';tip.append(el('b',{},`${o.xlabel||'x'}: ${sig(sq,4)}`),...rows.map(({s,i})=>el('div',{},el('span',{style:'color:'+s.color},'■ '),`${s.name}: ${sig(s.y[i])}`)));
    tip.style.display='block';const hr=host.getBoundingClientRect();
    tip.style.left=Math.min(ev.clientX-hr.left+14,host.clientWidth-220)+'px';tip.style.top=(ev.clientY-hr.top+14)+'px';
  });
  svg.addEventListener('mouseleave',()=>{cross.setAttribute('display','none');tip.style.display='none';});
}
// yatay çubuk: items [{name,v,color,ref}]  o: {W,title,unit,digits,th,refv}
function barSVG(items,o){
  const th=o.th||LIGHT,W=o.W||900,rh=o.rh||30,top=o.title?40:12,lw=Math.min(220,Math.max(90,8+7*Math.max(...items.map(i=>String(i.name).length),4)));
  const H=top+items.length*rh+34,vs=items.map(i=>i.v).filter(v=>v!=null&&isFinite(v));
  const svg=sv('svg',{width:W,height:H,viewBox:`0 0 ${W} ${H}`,'font-family':FONT});
  if(th.bg&&th.bg!=='none')sv('rect',{x:0,y:0,width:W,height:H,fill:th.bg},svg);
  if(o.title)svgText(svg,12,24,o.title+(o.unit&&o.unit!=='-'?' ['+o.unit+']':''),{fill:th.fg,'font-size':15,'font-weight':600});
  if(!vs.length){svgText(svg,W/2,H/2,'veri yok',{fill:th.mut,'text-anchor':'middle'});return svg;}
  let lo=Math.min(0,...vs),hi=Math.max(0,...vs);if(lo===hi)hi=lo+1;const pd=(hi-lo)*0.22;if(hi>0)hi+=pd;if(lo<0)lo-=pd;
  const x0=lw+10,x1=W-16,px=v=>x0+(v-lo)/(hi-lo)*(x1-x0);
  niceTicks(lo,hi,6).forEach(t=>{if(t<lo||t>hi)return;sv('line',{x1:px(t),x2:px(t),y1:top,y2:top+items.length*rh,stroke:th.ln},svg);svgText(svg,px(t),top+items.length*rh+16,+t.toPrecision(6),{'text-anchor':'middle','font-size':11,fill:th.mut});});
  items.forEach((it,i)=>{const y=top+i*rh;
    svgText(svg,lw,y+rh/2+4,it.name,{'text-anchor':'end',fill:th.fg,'font-weight':it.ref?700:400});
    if(it.v==null||!isFinite(it.v)){svgText(svg,x0+4,y+rh/2+4,'–',{fill:th.mut});return;}
    const a=px(Math.min(0,it.v)),b=px(Math.max(0,it.v));
    sv('rect',{x:a,y:y+rh*.18,width:Math.max(1,b-a),height:rh*.64,rx:3,fill:it.color,'fill-opacity':it.ref?1:.85,stroke:it.ref?th.fg:'none','stroke-width':it.ref?1.5:0},svg);
    let lab=fmt(it.v,o.digits??3);if(o.refv!=null&&!it.ref&&o.refv!==0)lab+=`  (${it.v-o.refv>=0?'+':''}${fmt((it.v-o.refv)/Math.abs(o.refv)*100,1)}%)`;
    const inside=it.v>=0?b+6:a-6;svgText(svg,inside,y+rh/2+4,lab,{'text-anchor':it.v>=0?'start':'end',fill:th.fg,'font-size':12});
  });
  sv('line',{x1:px(0),x2:px(0),y1:top,y2:top+items.length*rh,stroke:th.fg,'stroke-opacity':.6},svg);
  return svg;
}
// yığılmış debi dağılımı: rows [{name,vals:[..]}], groups [{label,color}]
function stackSVG(rows,groups,o){
  const th=o.th||LIGHT,W=o.W||1000,rh=30,top=o.title?40:12,lw=Math.min(220,Math.max(90,8+7*Math.max(...rows.map(r=>String(r.name).length),4)));
  const legR=legendRows(groups.map(g=>({name:g.label})),W),H=top+rows.length*rh+20+legR*18+10;
  const svg=sv('svg',{width:W,height:H,viewBox:`0 0 ${W} ${H}`,'font-family':FONT});
  if(th.bg&&th.bg!=='none')sv('rect',{x:0,y:0,width:W,height:H,fill:th.bg},svg);
  if(o.title)svgText(svg,12,24,o.title,{fill:th.fg,'font-size':15,'font-weight':600});
  const x0=lw+10,x1=W-70,mx=Math.max(100,...rows.map(r=>r.vals.reduce((s,v)=>s+(v>0?v:0),0)));const sc=(x1-x0)/mx;
  rows.forEach((r,i)=>{const y=top+i*rh;svgText(svg,lw,y+rh/2+4,r.name,{'text-anchor':'end',fill:th.fg});let x=x0,sum=0;
    r.vals.forEach((v,j)=>{if(v==null||v<=0)return;const w=v*sc;sv('rect',{x,y:y+4,width:w,height:rh-8,fill:groups[j].color},svg);
      if(w>34)svgText(svg,x+w/2,y+rh/2+4,fmt(v,1),{'text-anchor':'middle',fill:'#fff','font-size':11});x+=w;sum+=v;});
    svgText(svg,x+6,y+rh/2+4,'Σ '+fmt(sum,1)+'%',{fill:th.mut,'font-size':11});});
  legendSVG(svg,groups.map(g=>({name:g.label,color:g.color})),W,top+rows.length*rh+22,th);
  return svg;
}
// SVG -> PNG baytları
function svgToPng(svg,scale){scale=scale||2;const W=+svg.getAttribute('width'),H=+svg.getAttribute('height');
  return new Promise((res,rej)=>{const s=new XMLSerializer().serializeToString(svg);const img=new Image();
    img.onload=()=>{const c=document.createElement('canvas');c.width=W*scale;c.height=H*scale;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);
      c.toBlob(b=>b.arrayBuffer().then(x=>res({bytes:new Uint8Array(x),w:W,h:H,ext:'png'})),'image/png');};
    img.onerror=()=>rej(new Error('grafik çizilemedi'));img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);});}
