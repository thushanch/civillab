/* CivilLab · S11 Plastic Collapse Mechanisms */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              muted:'#5C6A72', axis:'#B9C0C5', contour:'#C9CEC7' };

  const KINDS = [
    ['ssP','Simply supported · central P'],
    ['propP','Propped cantilever · central P'],
    ['fixP','Fixed ends · central P'],
    ['fixU','Fixed ends · UDL'],
    ['propU','Propped cantilever · UDL'],
    ['frame','Portal frame · fixed bases']
  ];
  const state = { kind:'fixP', Mp:100, L:8, P:50, w:10, V:40, l:6, H:20, h:4, t:0 };
  let raf=null;

  function txt(x,y,str,o={}){const a={x,y,'font-size':o.fs||12,fill:o.fill||C.muted,
    'text-anchor':o.an||'middle','font-weight':o.fw||400};
    if(o.halo!==0){a['paint-order']='stroke';a.stroke='#fff';a['stroke-width']=o.halo||3;a['stroke-linejoin']='round';}
    if(o.head)a['font-family']='Poppins, Inter, sans-serif';
    return s('text',a,str);}
  const line=(x1,y1,x2,y2,a={})=>s('line',Object.assign({x1,y1,x2,y2},a));
  const hinge=(x,y)=>{const g=s('g');
    g.appendChild(s('circle',{cx:x,cy:y,r:7,fill:'#fff',stroke:C.load,'stroke-width':2.6}));
    g.appendChild(s('circle',{cx:x,cy:y,r:2.4,fill:C.load}));return g;};

  const BM={x0:110,x1:850,y:210};
  const FR={x0:250,x1:710,yb:400,yt:180};

  function drawSupport(x,y,kind){
    const g=s('g');
    if(kind==='fixed'){
      g.appendChild(line(x,y-26,x,y+26,{stroke:C.ocean,'stroke-width':5}));
      const out=x<(BM.x0+BM.x1)/2?-1:1;
      for(let yy=y-22;yy<=y+22;yy+=10)
        g.appendChild(line(x+out*3,yy,x+out*11,yy+7,{stroke:C.contour,'stroke-width':1.3}));
    } else {
      g.appendChild(s('polygon',{points:`${x},${y+3} ${x-12},${y+24} ${x+12},${y+24}`,fill:C.ocean}));
      g.appendChild(line(x-16,y+25,x+16,y+25,{stroke:C.ocean,'stroke-width':1.5}));
      for(let i=-12;i<=12;i+=8)g.appendChild(line(x+i,y+25,x+i-5,y+31,{stroke:C.contour,'stroke-width':1.3}));
    }
    fig.appendChild(g);
  }

  function render(){
    const r=PlasticEngine.solve(state);
    const amp=26*Math.sin(state.t);       // animation amplitude
    while(fig.firstChild)fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs',{},
      s('marker',{id:'mLoad',viewBox:'0 0 10 10',refX:8.5,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'},
        s('path',{d:'M0,0 L10,5 L0,10 z',fill:C.load})),
      s('marker',{id:'mLoadS',viewBox:'0 0 10 10',refX:8.5,refY:5,markerWidth:5.5,markerHeight:5.5,orient:'auto-start-reverse'},
        s('path',{d:'M0,0 L10,5 L0,10 z',fill:C.load}))));
    fig.appendChild(txt(BM.x0-30,26,r.name,{an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));

    if(state.kind==='frame'){ drawFrame(r,amp); }
    else { drawBeam(r,amp); }

    /* work equation strip */
    fig.appendChild(txt(480,458,'Work equation:  '+r.work,{fs:12.5,fw:500,fill:C.ocean,halo:0}));
    fig.appendChild(txt(480,482,`External work = internal work at the hinges  →  λ = ${fmt(r.lambda,3)}`,
      {fs:12,halo:0}));

    /* chips */
    let out=chip('Load factor λc',`${fmt(r.lambda,3)}`,'collapse / applied', r.lambda>=1?'ok':'warn');
    out+=chip('Collapse load',r.collapse,'with Mp = '+fmt(state.Mp)+' kN·m');
    out+=chip('Hinges',state.kind==='frame'?'3 or 4':String(r.hinges.length),'mechanism formed');
    if(state.kind==='frame'){
      out+=chip('Governing',r.governing,'lowest λ governs','warn');
      for(const b of r.bars)
        out+=chip(b.name+' mech.',`λ = ${fmt(b.lam,3)}`,'',b.name===r.governing?'warn':'');
    }
    if(state.kind==='propU')
      out+=chip('Hinge position',`${fmt(r.xs,4)} L`,'= 2 − √2, from the fixed end');
    resultsEl.innerHTML=out;
  }
  const chip=(k,v,sub,cls)=>`<div class="chip ${cls||''}"><div class="k">${k}</div><div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;

  function drawBeam(r,amp){
    const {x0,x1,y}=BM, span=x1-x0;
    const leftFixed = state.kind==='fixP'||state.kind==='fixU'||state.kind==='propP'||state.kind==='propU';
    const rightFixed = state.kind==='fixP'||state.kind==='fixU';
    drawSupport(x0,y,leftFixed?'fixed':'pin');
    drawSupport(x1,y,rightFixed?'fixed':'pin');

    /* undeformed reference */
    fig.appendChild(line(x0,y,x1,y,{stroke:C.contour,'stroke-width':1.4,'stroke-dasharray':'5 4'}));

    /* mechanism: piecewise straight rigid links between hinges */
    const hs=r.hinges.slice();
    if(!hs.includes(0))hs.unshift(0);
    if(!hs.includes(1))hs.push(1);
    hs.sort((a,b)=>a-b);
    const sag=r.hinges.filter(h=>h>0&&h<1);
    const defl=t=>{
      if(!sag.length)return 0;
      const c=sag[0];
      return t<=c ? amp*(t/c) : amp*((1-t)/(1-c));
    };
    let d='';
    for(let i=0;i<hs.length;i++)
      d+=(i?' L ':'M ')+(x0+span*hs[i]).toFixed(1)+' '+(y+defl(hs[i])).toFixed(1);
    fig.appendChild(s('path',{d,fill:'none',stroke:C.ocean,'stroke-width':6,'stroke-linejoin':'round','stroke-linecap':'round'}));

    /* loads */
    if(state.kind==='fixU'||state.kind==='propU'){
      const top=y-74;
      fig.appendChild(s('rect',{x:x0,y:top,width:span,height:34,fill:'rgba(176,58,46,.07)'}));
      fig.appendChild(line(x0,top,x1,top,{stroke:C.load,'stroke-width':1.8}));
      for(let q=0;q<=18;q++){
        const x=x0+span*q/18;
        fig.appendChild(line(x,top+2,x,y-44,{stroke:C.load,'stroke-width':1.4,'marker-end':'url(#mLoadS)'}));
      }
      fig.appendChild(txt((x0+x1)/2,top-8,`λ · w = λ · ${fmt(state.w)} kN/m`,{fs:11.5,fw:600,fill:C.load}));
    } else {
      const x=x0+span/2;
      fig.appendChild(line(x,y-88,x,y-30+defl(0.5),{stroke:C.load,'stroke-width':2.8,'marker-end':'url(#mLoad)'}));
      fig.appendChild(txt(x,y-96,`λ · P = λ · ${fmt(state.P)} kN`,{fs:11.5,fw:600,fill:C.load}));
    }

    /* hinges on the deformed shape */
    for(const h of r.hinges)
      fig.appendChild(hinge(x0+span*h, y+defl(h)));
    /* rotation labels */
    if(sag.length){
      fig.appendChild(txt(x0+span*sag[0], y+defl(sag[0])+34,'2θ',{fs:12,fw:600,fill:C.load}));
      if(r.hinges.includes(0))fig.appendChild(txt(x0+16,y+30,'θ',{fs:12,fw:600,fill:C.load}));
      if(r.hinges.includes(1))fig.appendChild(txt(x1-16,y+30,'θ',{fs:12,fw:600,fill:C.load}));
    }
    fig.appendChild(txt((x0+x1)/2,y+86,`L = ${fmt(state.L)} m,  Mp = ${fmt(state.Mp)} kN·m`,{fs:11.5,halo:0}));
  }

  function drawFrame(r,amp){
    const {x0,x1,yb,yt}=FR;
    const gov=r.governing;
    const sway = gov==='Sway'||gov==='Combined' ? amp : 0;
    const beam = gov==='Beam'||gov==='Combined' ? Math.abs(amp)*0.9 : 0;
    // reference
    fig.appendChild(s('path',{d:`M ${x0} ${yb} L ${x0} ${yt} L ${x1} ${yt} L ${x1} ${yb}`,
      fill:'none',stroke:C.contour,'stroke-width':1.4,'stroke-dasharray':'5 4'}));
    // deformed: columns lean by sway, beam sags at midspan
    const xtL=x0+sway, xtR=x1+sway, xm=(x0+x1)/2+sway;
    fig.appendChild(s('path',{
      d:`M ${x0} ${yb} L ${xtL} ${yt} L ${xm} ${yt+beam} L ${xtR} ${yt} L ${x1} ${yb}`,
      fill:'none',stroke:C.ocean,'stroke-width':6,'stroke-linejoin':'round','stroke-linecap':'round'}));
    drawSupport(x0,yb,'fixed');drawSupport(x1,yb,'fixed');
    // loads
    fig.appendChild(line(xm,yt-70,xm,yt-14+beam,{stroke:C.load,'stroke-width':2.8,'marker-end':'url(#mLoad)'}));
    fig.appendChild(txt(xm,yt-78,`λ · V = λ · ${fmt(state.V)} kN`,{fs:11.5,fw:600,fill:C.load}));
    fig.appendChild(line(x0-84,yt,x0+sway-12,yt,{stroke:C.load,'stroke-width':2.8,'marker-end':'url(#mLoad)'}));
    fig.appendChild(txt(x0-88,yt+4,`λ · H = λ · ${fmt(state.H)} kN`,{an:'end',fs:11.5,fw:600,fill:C.load}));
    // hinges by mechanism
    const pts=[];
    if(gov==='Beam')pts.push([xtL,yt],[xm,yt+beam],[xtR,yt]);
    else if(gov==='Sway')pts.push([x0,yb],[xtL,yt],[xtR,yt],[x1,yb]);
    else pts.push([x0,yb],[xm,yt+beam],[xtR,yt],[x1,yb]);
    for(const [px,py] of pts)fig.appendChild(hinge(px,py));
    fig.appendChild(txt((x0+x1)/2,yb+56,
      `l = ${fmt(state.l)} m,  h = ${fmt(state.h)} m,  Mp = ${fmt(state.Mp)} kN·m`,{fs:11.5,halo:0}));
    fig.appendChild(txt((x0+x1)/2,yb+76,`${gov} mechanism governs`,{fs:11.5,fw:600,fill:C.load,halo:0}));
  }

  function renderControls(){
    const kinds=KINDS.map(([v,t])=>`<option value="${v}" ${state.kind===v?'selected':''}>${t}</option>`).join('');
    const row=(id,lab,min,max,st)=>`<div class="ctl"><label>${lab}</label><div class="row">
      <input type="range" id="${id}r" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${state[id]}">
      <input type="number" id="${id}n" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${state[id]}"></div></div>`;
    const isFrame=state.kind==='frame';
    const isUDL=state.kind==='fixU'||state.kind==='propU';
    controls.innerHTML=`
      <h3>Mechanism</h3>
      <div class="ctl"><select id="kind">${kinds}</select></div>
      <h3>Section</h3>
      ${row('Mp','Plastic moment Mp (kN·m)',20,400,10)}
      <h3>Geometry & loads</h3>
      ${isFrame?`${row('l','Beam span l (m)',3,12,0.5)}${row('h','Column height h (m)',2,8,0.5)}
        ${row('V','Vertical load V (kN)',5,200,5)}${row('H','Horizontal load H (kN)',5,200,5)}`
       :`${row('L','Span L (m)',3,16,0.5)}${isUDL?row('w','UDL w (kN/m)',1,100,1):row('P','Point load P (kN)',5,300,5)}`}
      <div class="addrow"><button class="btn small" id="play">Animate collapse</button></div>`;
  }
  const KK={Mp:[20,400],L:[3,16],P:[5,300],w:[1,100],V:[5,200],l:[3,12],H:[5,200],h:[2,8]};
  controls.addEventListener('input',e=>{
    const k=e.target.dataset&&e.target.dataset.k;if(!k||!KK[k])return;
    const v=parseFloat(e.target.value);if(isNaN(v))return;
    state[k]=clamp(v,KK[k][0],KK[k][1]);
    for(const suf of ['r','n']){
      const el=document.getElementById(k+suf);
      if(el&&el!==e.target&&document.activeElement!==el)el.value=state[k];
    }
    render();
  });
  controls.addEventListener('change',e=>{
    if(e.target.id==='kind'){state.kind=e.target.value;renderControls();render();}
  });
  controls.addEventListener('click',e=>{
    if(e.target.id!=='play')return;
    const btn=e.target;
    if(raf){cancelAnimationFrame(raf);raf=null;state.t=0;btn.textContent='Animate collapse';render();return;}
    btn.textContent='Stop';
    const step=()=>{state.t+=0.045;render();raf=requestAnimationFrame(step);};
    raf=requestAnimationFrame(step);
  });

  renderControls();render();
})();
