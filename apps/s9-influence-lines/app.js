/* CivilLab · S9 Influence Lines */
(() => {
  const { s, fmt, clamp, snap } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              muted:'#5C6A72', axis:'#B9C0C5', contour:'#C9CEC7' };

  const W=960, PADL=64, PADR=30, BEAM_Y=110, RULER_Y=200;
  const IL = { title:250, zero:440, amp:130 };

  const state = { mode:'ss', L:8, xA:1.5, xB:6.5, resp:'m', c:4, p:2 };
  let il=null, res=null, key='';

  const RESPS=[['ra','Reaction RA'],['rb','Reaction RB'],
               ['v','Shear V at a section'],['m','Moment M at a section']];

  const engineState=(loads)=> state.mode==='ss'
    ? {L:state.L,config:'ss',xA:0,xB:state.L,loads}
    : {L:state.L,config:'ss',xA:state.xA,xB:state.xB,loads};

  const supA=()=>state.mode==='ss'?0:state.xA;
  const supB=()=>state.mode==='ss'?state.L:state.xB;

  const xpx=x=>PADL+(x/state.L)*(W-PADL-PADR);
  const xval=px=>clamp((px-PADL)/(W-PADL-PADR)*state.L,0,state.L);
  const evX=e=>{const r=fig.getBoundingClientRect();return (e.clientX-r.left)*(W/r.width);};

  function txt(x,y,str,o={}){const a={x,y,'font-size':o.fs||12,fill:o.fill||C.muted,
    'text-anchor':o.an||'middle','font-weight':o.fw||400};
    if(o.halo!==0){a['paint-order']='stroke';a.stroke='#fff';a['stroke-width']=o.halo||3;a['stroke-linejoin']='round';}
    if(o.head)a['font-family']='Poppins, Inter, sans-serif';
    return s('text',a,str);}
  const line=(x1,y1,x2,y2,a={})=>s('line',Object.assign({x1,y1,x2,y2},a));

  function probeVM(solved,x){
    const S=solved.samples;
    if(x<=S[0].x)return S[0];
    if(x>=S[S.length-1].x)return S[S.length-1];
    let lo=0,hi=S.length-1;
    while(hi-lo>1){const m=(hi+lo)>>1;(S[m].x<=x?lo=m:hi=m);}
    const a=S[lo],b=S[hi],t=(x-a.x)/Math.max(b.x-a.x,1e-12);
    return {V:a.V+t*(b.V-a.V),M:a.M+t*(b.M-a.M)};
  }
  function eta(p){
    const solved=BeamEngine.solve(engineState([{type:'point',P:1,a:p}]));
    if(state.resp==='ra')return solved.reactions.RA;
    if(state.resp==='rb')return solved.reactions.RB;
    const q=probeVM(solved,state.c);
    return state.resp==='v'?q.V:q.M;
  }
  function buildIL(){
    const k=[state.mode,state.L,state.xA,state.xB,state.resp,state.c].join('|');
    if(k===key&&il)return;
    key=k;
    const pts=[];
    const N=240, d=1e-5;
    for(let i=0;i<=N;i++){
      let p=state.L*i/N;
      if((state.resp==='v'||state.resp==='m')&&Math.abs(p-state.c)<2*d)p=state.c+3*d;
      pts.push({p,eta:eta(p)});
    }
    if(state.resp==='v'||state.resp==='m'){
      pts.push({p:state.c-d,eta:eta(state.c-d)});
      pts.push({p:state.c+d,eta:eta(state.c+d)});
      pts.sort((a,b)=>a.p-b.p);
    }
    let mx=pts[0],mn=pts[0];
    for(const q of pts){if(q.eta>mx.eta)mx=q;if(q.eta<mn.eta)mn=q;}
    il={pts,mx,mn};
  }

  function render(){
    buildIL();
    res={now:eta(state.p)};
    while(fig.firstChild)fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs',{},
      s('marker',{id:'mLoad',viewBox:'0 0 10 10',refX:8.5,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'},
        s('path',{d:'M0,0 L10,5 L0,10 z',fill:C.load}))));

    /* beam panel */
    fig.appendChild(txt(PADL,22,'Unit load position',{an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    fig.appendChild(line(xpx(0),RULER_Y,xpx(state.L),RULER_Y,{stroke:C.axis,'stroke-width':1}));
    const step=state.L<=12?1:2;
    for(let x=0;x<=state.L+1e-9;x+=step){
      fig.appendChild(line(xpx(x),RULER_Y-3,xpx(x),RULER_Y+3,{stroke:C.axis,'stroke-width':1}));
      fig.appendChild(txt(xpx(x),RULER_Y+15,fmt(x,0),{fs:10.5,halo:0}));
    }
    for(const [xs,roller] of [[supA(),false],[supB(),true]]){
      const x=xpx(xs);
      fig.appendChild(s('polygon',{points:`${x},${BEAM_Y+3} ${x-12},${BEAM_Y+23} ${x+12},${BEAM_Y+23}`,fill:C.ocean}));
      if(roller){fig.appendChild(s('circle',{cx:x-5,cy:BEAM_Y+27,r:3.5,fill:'#fff',stroke:C.ocean,'stroke-width':1.5}));
        fig.appendChild(s('circle',{cx:x+5,cy:BEAM_Y+27,r:3.5,fill:'#fff',stroke:C.ocean,'stroke-width':1.5}));}
      fig.appendChild(line(x-16,BEAM_Y+(roller?31:24),x+16,BEAM_Y+(roller?31:24),{stroke:C.ocean,'stroke-width':1.5}));
    }
    fig.appendChild(line(xpx(0),BEAM_Y,xpx(state.L),BEAM_Y,{stroke:C.ocean,'stroke-width':7,'stroke-linecap':'butt'}));

    /* section marker (for V and M) */
    if(state.resp==='v'||state.resp==='m'){
      const xc=xpx(state.c), g=s('g',{'data-id':'sec'});
      g.appendChild(s('rect',{x:xc-12,y:BEAM_Y+4,width:24,height:44,fill:'transparent'}));
      g.appendChild(line(xc,BEAM_Y+6,xc,BEAM_Y+34,{stroke:C.green,'stroke-width':2.4}));
      g.appendChild(s('polygon',{points:`${xc},${BEAM_Y+34} ${xc-7},${BEAM_Y+46} ${xc+7},${BEAM_Y+46}`,fill:C.green}));
      g.appendChild(txt(xc,BEAM_Y+60,`section c = ${fmt(state.c,2)} m`,{fs:11,fw:600,fill:C.green}));
      fig.appendChild(g);
    }
    /* unit load */
    {
      const xp=xpx(state.p), g=s('g',{'data-id':'unit'});
      g.appendChild(s('rect',{x:xp-14,y:BEAM_Y-72,width:28,height:70,fill:'transparent'}));
      g.appendChild(line(xp,BEAM_Y-56,xp,BEAM_Y-6,{stroke:C.load,'stroke-width':2.8,'marker-end':'url(#mLoad)'}));
      g.appendChild(txt(xp,BEAM_Y-62,'1 (unit load)',{fs:11.5,fw:600,fill:C.load}));
      fig.appendChild(g);
    }

    /* IL panel */
    const respName=RESPS.find(r=>r[0]===state.resp)[1];
    const unit=state.resp==='m'?'m':'–';
    fig.appendChild(txt(PADL,IL.title,`Influence line for ${respName}${state.resp==='v'||state.resp==='m'?` at c = ${fmt(state.c,2)} m`:''}`,
      {an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    fig.appendChild(txt(W-PADR,IL.title,`ordinate units: ${unit==='m'?'metres':'dimensionless'}`,
      {an:'end',fs:10.5,halo:0}));
    fig.appendChild(line(PADL,IL.zero,W-PADR,IL.zero,{stroke:C.axis,'stroke-width':1}));
    const emax=Math.max(Math.abs(il.mx.eta),Math.abs(il.mn.eta),1e-9);
    const ke=IL.amp/emax;
    const y=v=>IL.zero-v*ke;
    let d='';
    il.pts.forEach((q,i)=>{d+=(i?' L ':'M ')+xpx(q.p).toFixed(1)+' '+y(q.eta).toFixed(1);});
    const dF=d+` L ${xpx(il.pts[il.pts.length-1].p).toFixed(1)} ${IL.zero} L ${xpx(il.pts[0].p).toFixed(1)} ${IL.zero} Z`;
    fig.appendChild(s('path',{d:dF,fill:C.water,'fill-opacity':.12,stroke:'none'}));
    fig.appendChild(s('path',{d,fill:'none',stroke:C.water,'stroke-width':2.2,'stroke-linejoin':'round'}));
    for(const m of [il.mx,il.mn]){
      if(Math.abs(m.eta)<emax*1e-3)continue;
      const px=clamp(xpx(m.p),PADL+44,W-PADR-52), py=y(m.eta);
      fig.appendChild(s('circle',{cx:xpx(m.p),cy:py,r:3,fill:C.water}));
      fig.appendChild(txt(px,m.eta>=0?py-8:py+16,`${fmt(m.eta,3)} at p = ${fmt(m.p,2)} m`,
        {fs:11,fw:600,fill:C.water}));
    }
    /* current point */
    fig.appendChild(line(xpx(state.p),IL.title+14,xpx(state.p),IL.zero+IL.amp+8,
      {stroke:'#7C8792','stroke-width':1,'stroke-dasharray':'3 3'}));
    fig.appendChild(s('circle',{cx:xpx(state.p),cy:y(res.now),r:5,fill:C.green,stroke:'#fff','stroke-width':1.6}));
    fig.appendChild(txt(clamp(xpx(state.p),PADL+60,W-PADR-60),y(res.now)+(res.now>=0?-12:20),
      `η = ${fmt(res.now,3)}`,{fs:12,fw:600,fill:C.green}));

    resultsEl.innerHTML=
      chip('η at the load',`${fmt(res.now,3)} ${unit==='m'?'m':''}`,`unit load at p = ${fmt(state.p,2)} m`,'ok')+
      chip('Max positive',`${fmt(il.mx.eta,3)}`,`load at p = ${fmt(il.mx.p,2)} m`)+
      (il.mn.eta<-1e-6?chip('Max negative',`${fmt(il.mn.eta,3)}`,`load at p = ${fmt(il.mn.p,2)} m`,'warn'):'')+
      (state.resp==='m'&&state.mode==='ss'
        ?chip('Check c(L−c)/L',`${fmt(state.c*(state.L-state.c)/state.L,3)} m`,'peak ordinate, simple span')
        :'');
  }
  const chip=(k,v,sub,cls)=>`<div class="chip ${cls||''}"><div class="k">${k}</div><div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;

  function renderControls(){
    const modes=[['ss','Simply supported'],['over','Overhanging (two supports)']]
      .map(([v,t])=>`<option value="${v}" ${state.mode===v?'selected':''}>${t}</option>`).join('');
    const resps=RESPS.map(([v,t])=>`<option value="${v}" ${state.resp===v?'selected':''}>${t}</option>`).join('');
    const needC=state.resp==='v'||state.resp==='m';
    controls.innerHTML=`
      <h3>Beam</h3>
      <div class="ctl"><select id="mode">${modes}</select></div>
      <div class="ctl"><label>Length L (m)</label><div class="row">
        <input type="range" id="Lr" min="4" max="16" step="0.5" value="${state.L}">
        <input type="number" id="Ln" min="4" max="16" step="0.5" value="${state.L}"></div></div>
      ${state.mode==='over'?`<div class="grid2">
        <div class="mini"><label>Support A at (m)</label>
          <input type="number" id="xA" step="0.1" min="0" value="${state.xA}"></div>
        <div class="mini"><label>Support B at (m)</label>
          <input type="number" id="xB" step="0.1" value="${state.xB}"></div></div>`:''}
      <h3>Response</h3>
      <div class="ctl"><select id="resp">${resps}</select></div>
      ${needC?`<div class="ctl"><label>Section c (m)</label><div class="row">
        <input type="range" id="cr" min="0.2" max="${state.L-0.2}" step="0.1" value="${state.c}">
        <input type="number" id="cn" min="0.2" max="${state.L-0.2}" step="0.1" value="${state.c}"></div></div>`:''}
      <h3>Unit load</h3>
      <div class="ctl"><label>Position p (m)</label><div class="row">
        <input type="range" id="pr" min="0" max="${state.L}" step="0.05" value="${state.p}">
        <input type="number" id="pn" min="0" max="${state.L}" step="0.05" value="${state.p}"></div></div>
      <div class="addrow"><button class="btn small" id="anim">Animate the load</button></div>`;
  }

  const syncPair=(a,b,v)=>{for(const id of [a,b]){const el=document.getElementById(id);
    if(el&&document.activeElement!==el)el.value=v;}};
  controls.addEventListener('input',e=>{
    const t=e.target,v=parseFloat(t.value);
    if(isNaN(v))return;
    if(t.id==='Lr'||t.id==='Ln'){
      state.L=clamp(v,4,16);
      state.c=clamp(state.c,0.2,state.L-0.2);
      state.p=clamp(state.p,0,state.L);
      state.xB=clamp(state.xB,1,state.L);state.xA=clamp(state.xA,0,state.xB-1);
      renderControls();render();return;
    }
    if(t.id==='xA'){state.xA=clamp(v,0,state.xB-1);render();return;}
    if(t.id==='xB'){state.xB=clamp(v,state.xA+1,state.L);render();return;}
    if(t.id==='cr'||t.id==='cn'){state.c=clamp(v,0.2,state.L-0.2);syncPair('cr','cn',state.c);render();return;}
    if(t.id==='pr'||t.id==='pn'){state.p=clamp(v,0,state.L);syncPair('pr','pn',state.p);render();return;}
  });
  controls.addEventListener('change',e=>{
    if(e.target.id==='mode'){state.mode=e.target.value;renderControls();render();}
    if(e.target.id==='resp'){state.resp=e.target.value;renderControls();render();}
  });

  let raf=null;
  controls.addEventListener('click',e=>{
    if(e.target.id!=='anim')return;
    const btn=e.target;
    if(raf){cancelAnimationFrame(raf);raf=null;btn.textContent='Animate the load';return;}
    btn.textContent='Stop';
    const stepFn=()=>{
      state.p+=state.L/300;
      if(state.p>state.L)state.p=0;
      state.p=+state.p.toFixed(3);
      syncPair('pr','pn',state.p);
      render();
      raf=requestAnimationFrame(stepFn);
    };
    raf=requestAnimationFrame(stepFn);
  });

  let drag=null;
  fig.addEventListener('pointerdown',e=>{
    const g=e.target.closest('[data-id]');if(!g)return;
    e.preventDefault();fig.setPointerCapture(e.pointerId);
    drag=g.getAttribute('data-id');
  });
  fig.addEventListener('pointermove',e=>{
    if(!drag)return;
    const x=xval(evX(e));
    if(drag==='unit'){state.p=+snap(x,0.05).toFixed(2);syncPair('pr','pn',state.p);}
    else{state.c=+snap(clamp(x,0.2,state.L-0.2),0.1).toFixed(2);syncPair('cr','cn',state.c);}
    render();
  });
  fig.addEventListener('pointerup',()=>{drag=null;});
  fig.addEventListener('pointercancel',()=>{drag=null;});

  renderControls();render();
})();
