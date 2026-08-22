/* CivilLab · S8 Truss Solver */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              muted:'#5C6A72', axis:'#B9C0C5', contour:'#C9CEC7' };

  const state = { type:'pratt', n:4, span:8, h:1.5, loads:{B1:10,B2:10,B3:10}, sel:null };
  let geom=null, sol=null;

  function txt(x,y,str,o={}){const a={x,y,'font-size':o.fs||12,fill:o.fill||C.muted,
    'text-anchor':o.an||'middle','font-weight':o.fw||400};
    if(o.halo!==0){a['paint-order']='stroke';a.stroke='#fff';a['stroke-width']=o.halo||3;a['stroke-linejoin']='round';}
    if(o.head)a['font-family']='Poppins, Inter, sans-serif';
    return s('text',a,str);}
  const line=(x1,y1,x2,y2,a={})=>s('line',Object.assign({x1,y1,x2,y2},a));

  const AREA={x0:80,x1:880,yb:400,hMax:230};

  function rebuildGeom(){
    geom=TrussEngine.build(state.type,state.n,state.span,state.h);
    const ids=new Set(geom.nodes.map(nd=>nd.id));
    for(const id in state.loads)if(!ids.has(id))delete state.loads[id];
    if(state.sel&&!ids.has(state.sel))state.sel=null;
  }

  function scale(){
    const k=Math.min((AREA.x1-AREA.x0)/state.span, AREA.hMax/state.h);
    const xoff=(AREA.x0+AREA.x1)/2 - k*state.span/2;
    return {k,xoff};
  }
  const nodeOf=id=>geom.nodes.find(nd=>nd.id===id);

  function render(){
    sol=TrussEngine.solve(geom,state.loads);
    const {k,xoff}=scale();
    const P=nd=>[xoff+nd.x*k, AREA.yb-nd.y*k];
    while(fig.firstChild)fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs',{},
      s('marker',{id:'mLoad',viewBox:'0 0 10 10',refX:8.5,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'},
        s('path',{d:'M0,0 L10,5 L0,10 z',fill:C.load})),
      s('marker',{id:'mReact',viewBox:'0 0 10 10',refX:8.5,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'},
        s('path',{d:'M0,0 L10,5 L0,10 z',fill:C.green}))));
    fig.appendChild(txt(AREA.x0,26,`${state.type[0].toUpperCase()+state.type.slice(1)} truss · ${state.n} panels · ${fmt(state.span)} m × ${fmt(state.h)} m`,
      {an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    fig.appendChild(txt(AREA.x1,26,'tension blue · compression brick',{an:'end',fs:10.5,halo:0}));

    if(!sol.ok){
      fig.appendChild(txt(480,220,'Cannot solve: '+sol.msg,{fs:14,fw:600,fill:C.load}));
      resultsEl.innerHTML=chip('Status','Unstable',sol.msg,'warn');
      drawNodes(P);
      return;
    }
    const Fmax=Math.max(...sol.forces.map(f=>Math.abs(f.F)),1e-9);

    /* members */
    for(const f of sol.forces){
      const a=P(nodeOf(f.a)), b=P(nodeOf(f.b));
      const mag=Math.abs(f.F);
      const col=mag<Fmax*1e-3?C.axis:(f.F>0?C.water:C.load);
      fig.appendChild(line(a[0],a[1],b[0],b[1],
        {stroke:col,'stroke-width':2+4*mag/Fmax,'stroke-linecap':'round'}));
    }
    /* force labels */
    const labelAll=sol.forces.length<=25;
    const ranked=[...sol.forces].sort((p,q)=>Math.abs(q.F)-Math.abs(p.F));
    const toLabel=labelAll?sol.forces:ranked.slice(0,10);
    for(const f of toLabel){
      if(Math.abs(f.F)<Fmax*1e-3)continue;
      const a=P(nodeOf(f.a)), b=P(nodeOf(f.b));
      fig.appendChild(txt((a[0]+b[0])/2,(a[1]+b[1])/2-5,fmt(f.F),
        {fs:9.5,fw:600,fill:f.F>0?C.water:C.load,halo:3}));
    }

    /* supports + reactions */
    const pinP=P(nodeOf(geom.pin)), rolP=P(nodeOf(geom.roller));
    for(const [pp,roller] of [[pinP,false],[rolP,true]]){
      fig.appendChild(s('polygon',{points:`${pp[0]},${pp[1]+4} ${pp[0]-11},${pp[1]+22} ${pp[0]+11},${pp[1]+22}`,fill:C.ocean}));
      if(roller){
        fig.appendChild(s('circle',{cx:pp[0]-5,cy:pp[1]+26,r:3.5,fill:'#fff',stroke:C.ocean,'stroke-width':1.5}));
        fig.appendChild(s('circle',{cx:pp[0]+5,cy:pp[1]+26,r:3.5,fill:'#fff',stroke:C.ocean,'stroke-width':1.5}));
      }
      fig.appendChild(line(pp[0]-15,pp[1]+(roller?30:23),pp[0]+15,pp[1]+(roller?30:23),{stroke:C.ocean,'stroke-width':1.5}));
    }
    fig.appendChild(line(pinP[0],pinP[1]+58,pinP[0],pinP[1]+38,{stroke:C.green,'stroke-width':2.4,'marker-end':'url(#mReact)'}));
    fig.appendChild(txt(pinP[0],pinP[1]+72,`RA = ${fmt(sol.reactions.R0y)} kN`,{fs:11,fw:600,fill:C.green}));
    fig.appendChild(line(rolP[0],rolP[1]+58,rolP[0],rolP[1]+38,{stroke:C.green,'stroke-width':2.4,'marker-end':'url(#mReact)'}));
    fig.appendChild(txt(rolP[0],rolP[1]+72,`RB = ${fmt(sol.reactions.Rny)} kN`,{fs:11,fw:600,fill:C.green}));

    /* loads */
    for(const id in state.loads){
      const v=state.loads[id];if(!v)continue;
      const p=P(nodeOf(id));
      fig.appendChild(line(p[0],p[1]-46,p[0],p[1]-10,{stroke:C.load,'stroke-width':2.4,'marker-end':'url(#mLoad)'}));
      fig.appendChild(txt(p[0],p[1]-52,`${fmt(v)} kN`,{fs:10.5,fw:600,fill:C.load}));
    }
    drawNodes(P);

    /* chips */
    const maxT=ranked.find(f=>f.F>0), maxC=ranked.find(f=>f.F<0);
    let out='';
    if(maxT)out+=chip('Max tension',`${fmt(maxT.F)} kN`,`${maxT.a}–${maxT.b}`);
    if(maxC)out+=chip('Max compression',`${fmt(maxC.F)} kN`,`${maxC.a}–${maxC.b}`,'warn');
    out+=chip('Reaction RA',`${fmt(sol.reactions.R0y)} kN`,'pin, '+geom.pin,'ok');
    out+=chip('Reaction RB',`${fmt(sol.reactions.Rny)} kN`,'roller, '+geom.roller,'ok');
    out+=chip('Members',`${geom.members.length}`,`m + 3 = 2j = ${2*geom.nodes.length}, determinate`);
    resultsEl.innerHTML=out;
  }

  function drawNodes(P){
    for(const nd of geom.nodes){
      const p=P(nd);
      const g=s('g',{'data-node':nd.id});
      g.appendChild(s('circle',{cx:p[0],cy:p[1],r:12,fill:'transparent'}));
      g.appendChild(s('circle',{cx:p[0],cy:p[1],r:5.5,fill:'#fff',stroke:C.ocean,'stroke-width':2}));
      if(state.sel===nd.id)
        g.appendChild(s('circle',{cx:p[0],cy:p[1],r:9.5,fill:'none',stroke:C.green,'stroke-width':2.4}));
      fig.appendChild(g);
      fig.appendChild(txt(p[0],p[1]+(nd.y>0?-14:20),nd.id,{fs:9.5,halo:3}));
    }
  }
  const chip=(k,v,sub,cls)=>`<div class="chip ${cls||''}"><div class="k">${k}</div><div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;

  function renderControls(){
    const types=[['pratt','Pratt'],['howe','Howe'],['warren','Warren']]
      .map(([v,t])=>`<option value="${v}" ${state.type===v?'selected':''}>${t}</option>`).join('');
    const row=(id,lab,min,max,st,val)=>`<div class="ctl"><label>${lab}</label><div class="row">
      <input type="range" id="${id}r" data-g="${id}" min="${min}" max="${max}" step="${st}" value="${val}">
      <input type="number" id="${id}n" data-g="${id}" min="${min}" max="${max}" step="${st}" value="${val}"></div></div>`;
    const selBlock = state.sel ? `
      <div class="loadcard"><div class="head"><span class="badge point">Node ${state.sel}</span></div>
        <div class="mini"><label>Load at ${state.sel} (kN, down)</label>
        <input type="number" step="1" min="0" max="500" id="selLoad" value="${state.loads[state.sel]||0}"></div>
      </div>` : `<p style="font-size:12.5px;color:#5C6A72;margin:6px 0">Click a node on the truss to set its load.</p>`;
    controls.innerHTML=`
      <h3>Geometry</h3>
      <div class="ctl"><select id="type">${types}</select></div>
      ${row('N','Panels',2,8,1,state.n)}
      ${row('S','Span (m)',4,24,1,state.span)}
      ${row('H','Height (m)',0.8,4,0.1,state.h)}
      <h3>Loads</h3>
      <div class="ctl"><label>Load at every interior bottom node (kN)</label>
        <div class="row"><input type="number" id="allP" min="0" max="500" step="1" value="10">
        <button class="btn small" id="apply">Apply</button></div></div>
      ${selBlock}
      <div class="addrow"><button class="btn ghost small" id="clear">Clear all loads</button></div>`;
  }
  const GK={N:['n',2,8],S:['span',4,24],H:['h',0.8,4]};
  controls.addEventListener('input',e=>{
    const t=e.target;
    if(t.dataset&&t.dataset.g&&GK[t.dataset.g]){
      const v=parseFloat(t.value);if(isNaN(v))return;
      const [prop,lo,hi]=GK[t.dataset.g];
      state[prop]=t.dataset.g==='N'?Math.round(clamp(v,lo,hi)):clamp(v,lo,hi);
      for(const suf of ['r','n']){
        const el=document.getElementById(t.dataset.g+suf);
        if(el&&el!==t&&document.activeElement!==el)el.value=state[prop];
      }
      rebuildGeom();render();return;
    }
    if(t.id==='selLoad'&&state.sel){
      const v=parseFloat(t.value);if(isNaN(v))return;
      state.loads[state.sel]=clamp(v,0,500);
      render();
    }
  });
  controls.addEventListener('change',e=>{
    if(e.target.id==='type'){state.type=e.target.value;rebuildGeom();renderControls();render();}
  });
  controls.addEventListener('click',e=>{
    if(e.target.id==='apply'){
      const v=clamp(parseFloat(document.getElementById('allP').value)||0,0,500);
      for(let i=1;i<state.n;i++)state.loads['B'+i]=v;
      render();
    }
    if(e.target.id==='clear'){state.loads={};renderControls();render();}
  });
  fig.addEventListener('pointerdown',e=>{
    const g=e.target.closest('[data-node]');if(!g)return;
    state.sel=g.getAttribute('data-node');
    renderControls();render();
  });

  rebuildGeom();renderControls();render();
})();
