/* CivilLab · S6 Beam Deflection Visualiser */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              muted:'#5C6A72', axis:'#B9C0C5', contour:'#C9CEC7' };

  const W=960, PADL=64, PADR=30, BEAM_Y=100, RULER_Y=196;
  const DEF = { title:246, base:430, amp:150, top:270, bot:590 };

  let uid=1; const nid=()=>'ld'+(uid++);
  const pt=(P,a)=>({id:nid(),type:'point',P,a});
  const ud=(w,x1,x2)=>({id:nid(),type:'udl',w,x1,x2});
  const mo=(M,a)=>({id:nid(),type:'moment',M,a});

  const PRESETS = {
    udlf:{label:'Simply supported · full UDL', mode:'ss', L:6, loads:()=>[ud(10,0,6)]},
    pmid:{label:'Simply supported · central load', mode:'ss', L:8, loads:()=>[pt(20,4)]},
    ctip:{label:'Cantilever · tip load', mode:'cantl', L:4, loads:()=>[pt(15,4)]},
    mix:{label:'Point + partial UDL', mode:'ss', L:8, loads:()=>[pt(20,3),ud(10,5,8)]}
  };
  const state = { presetKey:'udlf', mode:'ss', L:6, E:200, I6:100, loads:PRESETS.udlf.loads() };

  const engineState=()=> state.mode==='ss'
    ? {L:state.L,config:'ss',xA:0,xB:state.L,loads:state.loads}
    : {L:state.L,config:'cant',cantSide:state.mode==='cantl'?'left':'right',loads:state.loads};

  const xpx=x=>PADL+(x/state.L)*(W-PADL-PADR);
  const xval=px=>clamp((px-PADL)/(W-PADL-PADR)*state.L,0,state.L);
  const evX=e=>{const r=fig.getBoundingClientRect();return (e.clientX-r.left)*(W/r.width);};

  let res=null, dfl=null, kv=0, trk=null;

  function txt(x,y,str,o={}){const a={x,y,'font-size':o.fs||12,fill:o.fill||C.muted,
    'text-anchor':o.an||'middle','font-weight':o.fw||400};
    if(o.halo!==0){a['paint-order']='stroke';a.stroke='#fff';a['stroke-width']=o.halo||3;a['stroke-linejoin']='round';}
    if(o.head)a['font-family']='Poppins, Inter, sans-serif';
    return s('text',a,str);}
  const line=(x1,y1,x2,y2,a={})=>s('line',Object.assign({x1,y1,x2,y2},a));
  const marker=(id,c,w=7)=>s('marker',{id,viewBox:'0 0 10 10',refX:8.5,refY:5,markerWidth:w,markerHeight:w,orient:'auto-start-reverse'},
    s('path',{d:'M0,0 L10,5 L0,10 z',fill:c}));

  function support(x,roller){
    const g=s('g');
    g.appendChild(s('polygon',{points:`${x},${BEAM_Y+3} ${x-13},${BEAM_Y+25} ${x+13},${BEAM_Y+25}`,fill:C.ocean}));
    let gy=BEAM_Y+26;
    if(roller){
      g.appendChild(s('circle',{cx:x-6,cy:BEAM_Y+30,r:4,fill:'#fff',stroke:C.ocean,'stroke-width':1.6}));
      g.appendChild(s('circle',{cx:x+6,cy:BEAM_Y+30,r:4,fill:'#fff',stroke:C.ocean,'stroke-width':1.6}));
      gy=BEAM_Y+35;
    }
    g.appendChild(line(x-17,gy,x+17,gy,{stroke:C.ocean,'stroke-width':1.6}));
    for(let i=-12;i<=12;i+=8)g.appendChild(line(x+i,gy,x+i-5,gy+6,{stroke:C.contour,'stroke-width':1.4}));
    fig.appendChild(g);
  }
  function fixedSupport(side){
    const x=side==='left'?xpx(0):xpx(state.L), out=side==='left'?-1:1, g=s('g');
    g.appendChild(line(x,BEAM_Y-28,x,BEAM_Y+28,{stroke:C.ocean,'stroke-width':5}));
    for(let y=BEAM_Y-24;y<=BEAM_Y+24;y+=10)
      g.appendChild(line(x+out*3,y,x+out*12,y+8,{stroke:C.contour,'stroke-width':1.4}));
    fig.appendChild(g);
  }
  function reactionArrow(xd,val,label){
    const x=xpx(xd),up=val>=0;
    fig.appendChild(line(x,up?BEAM_Y+60:BEAM_Y+42,x,up?BEAM_Y+42:BEAM_Y+60,
      {stroke:C.green,'stroke-width':2.4,'marker-end':'url(#mReact)'}));
    fig.appendChild(txt(x,BEAM_Y+74,`${label} = ${fmt(val)} kN`,{fs:11,fw:600,fill:C.green}));
  }
  function drawPoint(ld){
    const x=xpx(ld.a),g=s('g',{'data-id':ld.id});
    g.appendChild(s('rect',{x:x-12,y:BEAM_Y-72,width:24,height:70,fill:'transparent'}));
    if(ld.P>=0)g.appendChild(line(x,BEAM_Y-58,x,BEAM_Y-6,{stroke:C.load,'stroke-width':2.6,'marker-end':'url(#mLoad)'}));
    else g.appendChild(line(x,BEAM_Y-6,x,BEAM_Y-58,{stroke:C.load,'stroke-width':2.6,'marker-end':'url(#mLoad)'}));
    g.appendChild(txt(x,BEAM_Y-64,`${fmt(ld.P)} kN`,{fs:11.5,fw:600,fill:C.load}));
    fig.appendChild(g);
  }
  function drawUdl(ld){
    const x1=xpx(ld.x1),x2=xpx(ld.x2),top=BEAM_Y-44,g=s('g',{'data-id':ld.id});
    g.appendChild(s('rect',{x:x1,y:top,width:x2-x1,height:40,fill:'rgba(176,58,46,.07)'}));
    g.appendChild(line(x1,top,x2,top,{stroke:C.load,'stroke-width':2}));
    const n=Math.max(2,Math.round((x2-x1)/30)+1);
    for(let i=0;i<n;i++){
      const x=x1+(x2-x1)*i/(n-1);
      if(ld.w>=0)g.appendChild(line(x,top+2,x,BEAM_Y-7,{stroke:C.load,'stroke-width':1.6,'marker-end':'url(#mLoadS)'}));
      else g.appendChild(line(x,BEAM_Y-7,x,top+2,{stroke:C.load,'stroke-width':1.6,'marker-end':'url(#mLoadS)'}));
    }
    g.appendChild(txt((x1+x2)/2,top-8,`${fmt(ld.w)} kN/m`,{fs:11.5,fw:600,fill:C.load}));
    fig.appendChild(g);
  }
  function drawMoment(ld){
    const x=xpx(ld.a),cy=BEAM_Y-24,r=15,g=s('g',{'data-id':ld.id});
    g.appendChild(s('circle',{cx:x,cy,r:22,fill:'transparent'}));
    const RAD=Math.PI/180,a0=-50*RAD,a1=230*RAD,P=a=>[x+r*Math.cos(a),cy-r*Math.sin(a)];
    const ccw=ld.M>=0,[sx,sy]=ccw?P(a0):P(a1),[ex,ey]=ccw?P(a1):P(a0);
    g.appendChild(s('path',{d:`M ${sx} ${sy} A ${r} ${r} 0 1 ${ccw?0:1} ${ex} ${ey}`,
      fill:'none',stroke:C.load,'stroke-width':2.4,'marker-end':'url(#mMom)'}));
    g.appendChild(s('circle',{cx:x,cy:BEAM_Y,r:3,fill:C.load}));
    g.appendChild(txt(x,cy-r-9,`${fmt(ld.M)} kN·m`,{fs:11.5,fw:600,fill:C.load}));
    fig.appendChild(g);
  }

  function renderFigure(){
    const est=engineState();
    res=BeamEngine.solve(est);
    const EI=state.E*state.I6;                 // kN·m²
    dfl=BeamEngine.deflect(res,est,EI);
    while(fig.firstChild)fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs',{},marker('mLoad',C.load),marker('mLoadS',C.load,5.5),
      marker('mReact',C.green),marker('mMom',C.load,6)));

    /* loading panel */
    fig.appendChild(txt(PADL,22,'Loading',{an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    fig.appendChild(line(xpx(0),RULER_Y,xpx(state.L),RULER_Y,{stroke:C.axis,'stroke-width':1}));
    const step=state.L<=12?1:2;
    for(let x=0;x<=state.L+1e-9;x+=step){
      fig.appendChild(line(xpx(x),RULER_Y-3,xpx(x),RULER_Y+3,{stroke:C.axis,'stroke-width':1}));
      fig.appendChild(txt(xpx(x),RULER_Y+15,fmt(x,0),{fs:10.5,halo:0}));
    }
    const R=res.reactions;
    if(R.type==='ss'){support(xpx(R.xA),false);support(xpx(R.xB),true);
      reactionArrow(R.xA,R.RA,'RA');reactionArrow(R.xB,R.RB,'RB');}
    else{fixedSupport(R.side);reactionArrow(R.x0,R.R,'R');
      fig.appendChild(txt(xpx(R.x0),BEAM_Y+86,`Mfix = ${fmt(R.MR)} kN·m`,{fs:11,fw:600,fill:C.green}));}
    fig.appendChild(line(xpx(0),BEAM_Y,xpx(state.L),BEAM_Y,{stroke:C.ocean,'stroke-width':7,'stroke-linecap':'butt'}));
    for(const ld of state.loads){
      if(ld.type==='point')drawPoint(ld);
      else if(ld.type==='udl')drawUdl(ld);
      else drawMoment(ld);
    }

    /* deflection panel */
    const vAbs=Math.max(Math.abs(dfl.vmin.v),Math.abs(dfl.vmax.v),1e-12);
    kv=DEF.amp/vAbs;                                        // px per m of deflection
    const exag=kv/((W-PADL-PADR)/state.L);
    fig.appendChild(txt(PADL,DEF.title,'Deflected shape',{an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    fig.appendChild(txt(W-PADR,DEF.title,
      vAbs>1e-9?`vertical scale ×${fmt(exag,0)} exaggerated`:'no deflection',
      {an:'end',fs:10.5,halo:0}));
    fig.appendChild(line(PADL,DEF.base,W-PADR,DEF.base,
      {stroke:C.contour,'stroke-width':1.2,'stroke-dasharray':'6 4'}));
    if(R.type==='ss'){
      for(const xs of [R.xA,R.xB])
        fig.appendChild(s('polygon',{points:`${xpx(xs)},${DEF.base+2} ${xpx(xs)-8},${DEF.base+16} ${xpx(xs)+8},${DEF.base+16}`,fill:C.ocean}));
    } else {
      const x=R.side==='left'?xpx(0):xpx(state.L);
      fig.appendChild(line(x,DEF.base-40,x,DEF.base+40,{stroke:C.ocean,'stroke-width':4}));
    }
    let d='';
    dfl.samples.forEach((p,i)=>{d+=(i?' L ':'M ')+xpx(p.x).toFixed(1)+' '+(DEF.base-p.v*kv).toFixed(1);});
    fig.appendChild(s('path',{d,fill:'none',stroke:C.water,'stroke-width':2.6,'stroke-linejoin':'round'}));
    for(const m of [dfl.vmin,dfl.vmax]){
      if(Math.abs(m.v)<vAbs*1e-3||Math.abs(m.v)<1e-9)continue;
      const px=xpx(m.x),py=DEF.base-m.v*kv;
      fig.appendChild(s('circle',{cx:px,cy:py,r:3.5,fill:C.water}));
      fig.appendChild(txt(clamp(px,PADL+50,W-PADR-60),py+(m.v<0?18:-9),
        `${fmt(Math.abs(m.v)*1000,2)} mm ${m.v<0?'↓':'↑'} at ${fmt(m.x,2)} m`,
        {fs:11.5,fw:600,fill:C.water}));
    }
    trk={
      g:s('g',{visibility:'hidden','pointer-events':'none'}),
      vl:line(0,DEF.top,0,DEF.bot,{stroke:'#7C8792','stroke-width':1,'stroke-dasharray':'3 3'}),
      dot:s('circle',{r:3.6,fill:'#fff',stroke:C.water,'stroke-width':2}),
      t:txt(W-PADR,DEF.title+20,'',{an:'end',fs:12,fw:500,fill:'#1C2A33'})
    };
    trk.g.append(trk.vl,trk.dot,trk.t);
    fig.appendChild(trk.g);
    updateResults();
  }

  function probe(x){
    const S=dfl.samples;
    if(x<=S[0].x)return S[0];
    if(x>=S[S.length-1].x)return S[S.length-1];
    let lo=0,hi=S.length-1;
    while(hi-lo>1){const m=(hi+lo)>>1;(S[m].x<=x?lo=m:hi=m);}
    const a=S[lo],b=S[hi],t=(x-a.x)/Math.max(b.x-a.x,1e-12);
    return {x,v:a.v+t*(b.v-a.v),th:a.th+t*(b.th-a.th)};
  }
  function showTracker(x){
    if(!trk)return;
    const p=probe(x),px=xpx(x);
    trk.g.setAttribute('visibility','visible');
    trk.vl.setAttribute('x1',px);trk.vl.setAttribute('x2',px);
    trk.dot.setAttribute('cx',px);trk.dot.setAttribute('cy',DEF.base-p.v*kv);
    trk.t.textContent=`x = ${fmt(x,2)} m    v = ${fmt(p.v*1000,2)} mm    θ = ${fmt(p.th*1000,2)} mrad`;
  }

  const chip=(k,v,sub,cls)=>`<div class="chip ${cls||''}"><div class="k">${k}</div><div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;
  function updateResults(){
    const EI=state.E*state.I6;
    const down=-dfl.vmin.v, up=dfl.vmax.v;
    let out=chip('EI',`${fmt(EI,0)} kN·m²`,`E = ${state.E} GPa, I = ${state.I6} ×10⁶ mm⁴`);
    out+=chip('Max deflection ↓',`${fmt(down*1000,2)} mm`,`at x = ${fmt(dfl.vmin.x,2)} m`,'ok');
    if(up>1e-9&&up>down*0.01)
      out+=chip('Max deflection ↑',`${fmt(up*1000,2)} mm`,`at x = ${fmt(dfl.vmax.x,2)} m`,'warn');
    out+=chip('Max slope',`${fmt(Math.abs(dfl.thmax.th)*1000,2)} mrad`,`at x = ${fmt(dfl.thmax.x,2)} m`);
    if(down>1e-9)out+=chip('Span / deflection',`L/${fmt(state.L/down,0)}`,'often limited to L/250 or L/360');
    resultsEl.innerHTML=out;
  }

  /* ------- controls (S1 pattern, trimmed) ------- */
  function loadCard(ld){
    const L=state.L;
    const del=`<button class="del" data-del="${ld.id}" title="Remove load">✕</button>`;
    const num=(k,lab,val,st,min,max)=>`<div class="mini"><label>${lab}</label>
      <input type="number" step="${st}" ${min!=null?`min="${min}"`:''} ${max!=null?`max="${max}"`:''}
      value="${val}" data-ld="${ld.id}" data-k="${k}"></div>`;
    if(ld.type==='point')return `<div class="loadcard"><div class="head"><span class="badge point">Point</span>${del}</div>
      <div class="grid2">${num('P','P (kN)',ld.P,1)}${num('a','x (m)',ld.a,0.1,0,L)}</div></div>`;
    if(ld.type==='udl')return `<div class="loadcard"><div class="head"><span class="badge udl">UDL</span>${del}</div>
      <div class="grid3">${num('w','w (kN/m)',ld.w,1)}${num('x1','from (m)',ld.x1,0.1,0,L)}${num('x2','to (m)',ld.x2,0.1,0,L)}</div></div>`;
    return `<div class="loadcard"><div class="head"><span class="badge moment">Moment</span>${del}</div>
      <div class="grid2">${num('M','M (kN·m)',ld.M,1)}${num('a','x (m)',ld.a,0.1,0,L)}</div></div>`;
  }
  function renderControls(){
    const presetOpts=Object.entries(PRESETS)
      .map(([k,p])=>`<option value="${k}" ${state.presetKey===k?'selected':''}>${p.label}</option>`).join('')
      +`<option value="custom" ${state.presetKey==='custom'?'selected':''}>Custom</option>`;
    const modeOpts=[['ss','Simply supported'],['cantl','Cantilever · fixed left'],['cantr','Cantilever · fixed right']]
      .map(([v,t])=>`<option value="${v}" ${state.mode===v?'selected':''}>${t}</option>`).join('');
    controls.innerHTML=`
      <h3>Presets</h3><div class="ctl"><select id="preset">${presetOpts}</select></div>
      <h3>Beam</h3>
      <div class="ctl"><label for="mode">Configuration</label><select id="mode">${modeOpts}</select></div>
      <div class="ctl"><label>Length L (m)</label><div class="row">
        <input type="range" id="Lr" min="2" max="16" step="0.5" value="${state.L}">
        <input type="number" id="Ln" min="2" max="16" step="0.5" value="${state.L}"></div></div>
      <h3>Stiffness</h3>
      <div class="ctl"><label>E (GPa)</label><div class="row">
        <input type="range" id="Er" min="10" max="250" step="5" value="${state.E}">
        <input type="number" id="En" min="10" max="250" step="5" value="${state.E}"></div></div>
      <div class="ctl"><label>I (×10⁶ mm⁴)</label><div class="row">
        <input type="range" id="Ir" min="5" max="2000" step="5" value="${state.I6}">
        <input type="number" id="In" min="5" max="2000" step="5" value="${state.I6}"></div></div>
      <h3>Loads</h3>
      <div id="loadlist">${state.loads.map(loadCard).join('')}</div>
      <div class="addrow">
        <button class="btn ghost small" data-add="point">+ Point load</button>
        <button class="btn ghost small" data-add="udl">+ UDL</button>
        <button class="btn ghost small" data-add="moment">+ Moment</button>
      </div>`;
  }
  const markCustom=()=>{state.presetKey='custom';const p=document.getElementById('preset');if(p)p.value='custom';};
  function clampLoads(){
    for(const ld of state.loads){
      if(ld.type==='udl'){ld.x1=clamp(ld.x1,0,state.L-0.1);ld.x2=clamp(ld.x2,ld.x1+0.1,state.L);}
      else ld.a=clamp(ld.a,0,state.L);
    }
  }
  function syncLoadInputs(ld){
    for(const k of ['P','w','M','a','x1','x2']){
      if(!(k in ld))continue;
      const inp=controls.querySelector(`input[data-ld="${ld.id}"][data-k="${k}"]`);
      if(inp&&document.activeElement!==inp)inp.value=ld[k];
    }
  }
  const twin={Lr:'Ln',Ln:'Lr',Er:'En',En:'Er',Ir:'In',In:'Ir'};
  controls.addEventListener('input',e=>{
    const t=e.target;
    if(twin[t.id]){
      const v=parseFloat(t.value);if(isNaN(v))return;
      if(t.id[0]==='L'){state.L=clamp(v,2,16);clampLoads();for(const ld of state.loads)syncLoadInputs(ld);}
      else if(t.id[0]==='E')state.E=clamp(v,10,250);
      else state.I6=clamp(v,5,2000);
      const o=document.getElementById(twin[t.id]);
      if(o)o.value=t.id[0]==='L'?state.L:t.id[0]==='E'?state.E:state.I6;
      renderFigure();markCustom();return;
    }
    if(t.dataset.ld){
      const ld=state.loads.find(l=>l.id===t.dataset.ld),k=t.dataset.k,v=parseFloat(t.value);
      if(!ld||isNaN(v))return;
      if(k==='a')ld.a=clamp(v,0,state.L);
      else if(k==='x1')ld.x1=clamp(v,0,ld.x2-0.1);
      else if(k==='x2')ld.x2=clamp(v,ld.x1+0.1,state.L);
      else ld[k]=clamp(v,-500,500);
      renderFigure();markCustom();
    }
  });
  controls.addEventListener('change',e=>{
    const t=e.target;
    if(t.id==='mode'){state.mode=t.value;renderFigure();markCustom();}
    if(t.id==='preset'){
      const P=PRESETS[t.value];if(!P){state.presetKey='custom';return;}
      state.presetKey=t.value;state.mode=P.mode;state.L=P.L;state.loads=P.loads();
      renderControls();renderFigure();
    }
  });
  controls.addEventListener('click',e=>{
    const add=e.target.dataset&&e.target.dataset.add, del=e.target.dataset&&e.target.dataset.del;
    if(add){
      if(add==='point')state.loads.push(pt(10,snap(state.L/2,0.1)));
      if(add==='udl')state.loads.push(ud(5,snap(state.L*0.25,0.1),snap(state.L*0.75,0.1)));
      if(add==='moment')state.loads.push(mo(10,snap(state.L/2,0.1)));
      renderControls();renderFigure();markCustom();
    }
    if(del){state.loads=state.loads.filter(l=>l.id!==del);renderControls();renderFigure();markCustom();}
  });

  let drag=null;
  fig.addEventListener('pointerdown',e=>{
    const g=e.target.closest('[data-id]');if(!g)return;
    const ld=state.loads.find(l=>l.id===g.getAttribute('data-id'));if(!ld)return;
    e.preventDefault();fig.setPointerCapture(e.pointerId);
    const gx=xval(evX(e));
    drag=ld.type==='udl'?{ld,off:ld.x1-gx}:{ld};
    markCustom();
  });
  fig.addEventListener('pointermove',e=>{
    const x=xval(evX(e));
    if(drag){
      const ld=drag.ld;
      if(ld.type==='udl'){
        const len=ld.x2-ld.x1;
        const nx1=snap(clamp(x+drag.off,0,state.L-len),0.1);
        ld.x1=+nx1.toFixed(2);ld.x2=+(nx1+len).toFixed(2);
      } else ld.a=+snap(clamp(x,0,state.L),0.1).toFixed(2);
      renderFigure();syncLoadInputs(ld);
    }
    showTracker(x);
  });
  fig.addEventListener('pointerup',()=>{drag=null;});
  fig.addEventListener('pointercancel',()=>{drag=null;});
  fig.addEventListener('pointerleave',()=>{if(!drag&&trk)trk.g.setAttribute('visibility','hidden');});

  renderControls();renderFigure();
})();
