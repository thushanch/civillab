/* CivilLab · S7 Column Buckling & Struts */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              muted:'#5C6A72', axis:'#B9C0C5', contour:'#C9CEC7' };

  const ENDS = [['pp','Pinned – pinned  (k = 1.0)'],['ff','Fixed – fixed  (k = 0.5)'],
                ['fp','Fixed – pinned  (k = 0.7)'],['fr','Fixed – free  (k = 2.0)']];
  const state = { end:'pp', L:3, E:200, I6:100, A:7600, fy:275 };

  function txt(x,y,str,o={}){const a={x,y,'font-size':o.fs||12,fill:o.fill||C.muted,
    'text-anchor':o.an||'middle','font-weight':o.fw||400};
    if(o.halo!==0){a['paint-order']='stroke';a.stroke='#fff';a['stroke-width']=o.halo||3;a['stroke-linejoin']='round';}
    if(o.head)a['font-family']='Poppins, Inter, sans-serif';
    return s('text',a,str);}
  const line=(x1,y1,x2,y2,a={})=>s('line',Object.assign({x1,y1,x2,y2},a));

  const COL={x:200, yb:452, yt:132};          // column base and top on screen
  const PLT={x0:470, x1:920, y0:96, y1:440};  // design curve plot

  function endGlyphs(end){
    const g=s('g'), x=COL.x;
    const hatch=(y,dir)=>{ // dir +1 hatches below, -1 above
      g.appendChild(line(x-26,y,x+26,y,{stroke:C.ocean,'stroke-width':2}));
      for(let i=-22;i<=22;i+=8)g.appendChild(line(x+i,y,x+i-6,y+7*dir,{stroke:C.contour,'stroke-width':1.4}));
    };
    const pin=(y,tipUp)=>{
      const s1=tipUp?1:-1;
      g.appendChild(s('polygon',{points:`${x},${y} ${x-11},${y+16*s1} ${x+11},${y+16*s1}`,fill:C.ocean}));
      g.appendChild(line(x-16,y+17*s1,x+16,y+17*s1,{stroke:C.ocean,'stroke-width':1.6}));
    };
    // base
    if(end==='pp')pin(COL.yb,true); else hatch(COL.yb,1);
    // top
    if(end==='pp'||end==='fp')pin(COL.yt,false);
    else if(end==='ff')hatch(COL.yt,-1);
    // load arrow at top
    g.appendChild(line(x,COL.yt-52,x,COL.yt-14,{stroke:C.load,'stroke-width':2.6,'marker-end':'url(#mLoad)'}));
    g.appendChild(txt(x,COL.yt-58,'P',{fs:12,fw:600,fill:C.load}));
    fig.appendChild(g);
  }

  function render(){
    const r=ColumnEngine.solve(state);
    while(fig.firstChild)fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs',{},
      s('marker',{id:'mLoad',viewBox:'0 0 10 10',refX:8.5,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'},
        s('path',{d:'M0,0 L10,5 L0,10 z',fill:C.load}))));

    /* left: column + mode shape */
    fig.appendChild(txt(60,26,'Buckled shape',{an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    fig.appendChild(line(COL.x,COL.yb,COL.x,COL.yt,{stroke:C.contour,'stroke-width':1.4,'stroke-dasharray':'5 4'}));
    endGlyphs(state.end);
    // normalise the shape so its peak is 1
    const N=90;let mx=0;const sh=[];
    for(let i=0;i<=N;i++){const v=ColumnEngine.shape(state.end,i/N);sh.push(v);mx=Math.max(mx,Math.abs(v));}
    let d='';
    for(let i=0;i<=N;i++){
      const y=COL.yb+(COL.yt-COL.yb)*(i/N);
      const x=COL.x+55*sh[i]/(mx||1);
      d+=(i?' L ':'M ')+x.toFixed(1)+' '+y.toFixed(1);
    }
    fig.appendChild(s('path',{d,fill:'none',stroke:C.water,'stroke-width':3,'stroke-linejoin':'round'}));
    fig.appendChild(txt(COL.x,COL.yb+38,`L = ${fmt(state.L)} m,  Le = kL = ${fmt(r.Le,2)} m`,{fs:11.5,halo:0}));

    /* right: sigma against slenderness */
    fig.appendChild(txt(PLT.x0,26,'Design curve  σ against slenderness λ',
      {an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    const lamMax=Math.max(220,r.lam*1.15), sigMax=state.fy*1.35;
    const px=l=>PLT.x0+(l/lamMax)*(PLT.x1-PLT.x0);
    const py=v=>PLT.y1-(v/sigMax)*(PLT.y1-PLT.y0);
    fig.appendChild(line(PLT.x0,PLT.y1,PLT.x1,PLT.y1,{stroke:C.axis,'stroke-width':1.2}));
    fig.appendChild(line(PLT.x0,PLT.y1,PLT.x0,PLT.y0,{stroke:C.axis,'stroke-width':1.2}));
    fig.appendChild(txt(PLT.x1,PLT.y1+16,'λ = Le / r',{an:'end',fs:11,halo:0}));
    fig.appendChild(txt(PLT.x0-6,PLT.y0+4,'σ (MPa)',{an:'end',fs:11,halo:0}));
    for(const l of [50,100,150,200]){
      fig.appendChild(line(px(l),PLT.y1,px(l),PLT.y1+4,{stroke:C.axis,'stroke-width':1}));
      fig.appendChild(txt(px(l),PLT.y1+16,''+l,{fs:10,halo:0}));
    }
    // squash line
    fig.appendChild(line(PLT.x0,py(state.fy),px(r.lamLimit),py(state.fy),
      {stroke:C.green,'stroke-width':2.4}));
    fig.appendChild(txt(PLT.x0+8,py(state.fy)-7,`squash  fy = ${state.fy} MPa`,
      {an:'start',fs:11,fw:600,fill:C.green}));
    // euler curve from the changeover slenderness outward
    let de='';let first=true;
    for(let l=Math.max(20,r.lamLimit);l<=lamMax;l+=2){
      const v=Math.PI**2*state.E*1e3/(l*l);
      if(v>sigMax)continue;
      de+=(first?'M ':' L ')+px(l).toFixed(1)+' '+py(v).toFixed(1);first=false;
    }
    fig.appendChild(s('path',{d:de,fill:'none',stroke:C.water,'stroke-width':2.4}));
    fig.appendChild(txt(px(Math.min(lamMax*0.8,r.lamLimit*1.7)),py(Math.PI**2*state.E*1e3/Math.min(lamMax*0.8,r.lamLimit*1.7)**2)-10,
      'Euler  π²E/λ²',{fs:11,fw:600,fill:C.water}));
    // changeover
    fig.appendChild(line(px(r.lamLimit),PLT.y1,px(r.lamLimit),py(state.fy),
      {stroke:C.contour,'stroke-width':1.2,'stroke-dasharray':'4 4'}));
    fig.appendChild(txt(px(r.lamLimit),PLT.y1-8,`λ = ${fmt(r.lamLimit,0)}`,{fs:10.5,halo:3}));
    // design point
    const sig=Math.min(r.sigCr,state.fy);
    fig.appendChild(s('circle',{cx:px(Math.min(r.lam,lamMax)),cy:py(sig),r:6,
      fill:r.governing==='euler'?C.water:C.green,stroke:'#fff','stroke-width':2}));
    fig.appendChild(txt(px(Math.min(r.lam,lamMax)),py(sig)-14,
      `this column  λ = ${fmt(r.lam,0)}`,{fs:11.5,fw:600,fill:C.ocean}));

    resultsEl.innerHTML=
      chip('Euler load Pcr',`${fmt(r.Pcr,0)} kN`,`π²EI/(kL)², k = ${r.k}`) +
      chip('Squash load',`${fmt(r.Psquash,0)} kN`,'fy · A') +
      chip('Capacity',`${fmt(r.Pu,0)} kN`, r.governing==='euler'?'buckling governs':'squash governs',
        r.governing==='euler'?'warn':'ok') +
      chip('Slenderness λ',`${fmt(r.lam,0)}`,`r = ${fmt(r.r,1)} mm`) +
      chip('Effective length',`${fmt(r.Le,2)} m`,`k = ${r.k}`);
  }
  const chip=(k,v,sub,cls)=>`<div class="chip ${cls||''}"><div class="k">${k}</div><div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;

  function renderControls(){
    const opts=ENDS.map(([v,t])=>`<option value="${v}" ${state.end===v?'selected':''}>${t}</option>`).join('');
    const row=(id,lab,min,max,st,val)=>`<div class="ctl"><label>${lab}</label><div class="row">
      <input type="range" id="${id}r" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${val}">
      <input type="number" id="${id}n" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${val}"></div></div>`;
    controls.innerHTML=`
      <h3>End conditions</h3>
      <div class="ctl"><select id="end">${opts}</select></div>
      <h3>Column</h3>
      ${row('L','Length L (m)',1,10,0.25,state.L)}
      ${row('E','E (GPa)',10,250,5,state.E)}
      ${row('I','I (×10⁶ mm⁴)',5,2000,5,state.I6)}
      ${row('A','A (mm²)',500,50000,100,state.A)}
      ${row('F','fy (MPa)',200,460,5,state.fy)}`;
  }
  const KEY={L:['L',1,10],E:['E',10,250],I:['I6',5,2000],A:['A',500,50000],F:['fy',200,460]};
  controls.addEventListener('input',e=>{
    const k=e.target.dataset&&e.target.dataset.k;if(!k||!KEY[k])return;
    const v=parseFloat(e.target.value);if(isNaN(v))return;
    const [prop,lo,hi]=KEY[k];
    state[prop]=clamp(v,lo,hi);
    for(const suf of ['r','n']){
      const el=document.getElementById(k+suf);
      if(el&&el!==e.target&&document.activeElement!==el)el.value=state[prop];
    }
    render();
  });
  controls.addEventListener('change',e=>{
    if(e.target.id==='end'){state.end=e.target.value;render();}
  });

  renderControls();render();
})();
