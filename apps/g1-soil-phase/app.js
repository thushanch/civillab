/* CivilLab · G1 Soil Phase Diagram */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              muted:'#5C6A72', axis:'#B9C0C5', contour:'#C9CEC7', bg:'#F6F7F4' };

  const PRESETS = {
    loose:{label:'Loose sand', e:0.85, w:0.28, Gs:2.65},
    dense:{label:'Dense sand', e:0.45, w:0.12, Gs:2.65},
    soft:{label:'Soft clay', e:1.10, w:0.40, Gs:2.70},
    fill:{label:'Compacted fill', e:0.50, w:0.10, Gs:2.68}
  };
  const state = { e:0.60, w:0.15, Gs:2.70 };

  function txt(x,y,str,o={}){const a={x,y,'font-size':o.fs||12,fill:o.fill||C.muted,
    'text-anchor':o.an||'middle','font-weight':o.fw||400};
    if(o.halo!==0){a['paint-order']='stroke';a.stroke='#fff';a['stroke-width']=o.halo||3;a['stroke-linejoin']='round';}
    if(o.head)a['font-family']='Poppins, Inter, sans-serif';
    return s('text',a,str);}
  const line=(x1,y1,x2,y2,a={})=>s('line',Object.assign({x1,y1,x2,y2},a));

  const BLK={x:390,w:210,yb:452,hMax:352};

  function render(){
    const p=SoilEngine.phase(state.e,state.w,state.Gs);
    const k=BLK.hMax/(1+p.e);
    const hS=1*k, hW=p.S*p.e*k, hA=(1-p.S)*p.e*k;
    const yS=BLK.yb-hS, yW=yS-hW, yA=yW-hA;
    while(fig.firstChild)fig.removeChild(fig.firstChild);
    fig.appendChild(txt(BLK.x+BLK.w/2,26,'The three phase block (heights to scale)',
      {fs:13,fw:600,fill:C.ocean,halo:0,head:true}));

    /* segments */
    fig.appendChild(s('rect',{x:BLK.x,y:yS,width:BLK.w,height:hS,
      fill:'rgba(20,65,107,.85)',stroke:C.ocean,'stroke-width':1.5}));
    if(hW>0.5)fig.appendChild(s('rect',{x:BLK.x,y:yW,width:BLK.w,height:hW,
      fill:'rgba(30,120,176,.55)',stroke:C.water,'stroke-width':1.5}));
    if(hA>0.5)fig.appendChild(s('rect',{x:BLK.x,y:yA,width:BLK.w,height:hA,
      fill:C.bg,stroke:C.contour,'stroke-width':1.5,'stroke-dasharray':'5 4'}));

    const mid=BLK.x+BLK.w/2;
    fig.appendChild(txt(mid,yS+hS/2+4,'SOLIDS',{fs:13,fw:600,fill:'#fff',halo:0}));
    if(hW>18)fig.appendChild(txt(mid,yW+hW/2+4,'WATER',{fs:12,fw:600,fill:'#fff',halo:0}));
    if(hA>18)fig.appendChild(txt(mid,yA+hA/2+4,'AIR',{fs:12,fw:600,fill:C.muted,halo:0}));

    /* left: volumes, right: weights per Vs = 1 */
    const lx=BLK.x-16, rx=BLK.x+BLK.w+16;
    const vlab=(y,t)=>fig.appendChild(txt(lx,y+4,t,{an:'end',fs:11.5,halo:0}));
    const wlab=(y,t)=>fig.appendChild(txt(rx,y+4,t,{an:'start',fs:11.5,halo:0}));
    vlab(yS+hS/2,`Vs = 1`);
    if(hW>10)vlab(yW+hW/2,`Vw = Se = ${fmt(p.S*p.e,2)}`);
    if(hA>10)vlab(yA+hA/2,`Va = ${fmt((1-p.S)*p.e,2)}`);
    wlab(yS+hS/2,`Ws = Gs·γw = ${fmt(p.Gs*p.GW,1)} kN`);
    if(hW>10)wlab(yW+hW/2,`Ww = Se·γw = ${fmt(p.S*p.e*p.GW,1)} kN`);
    if(hA>10)wlab(yA+hA/2,'Wa ≈ 0');

    /* voids bracket on the far left */
    if(p.e*k>14){
      fig.appendChild(line(BLK.x-118,yA,BLK.x-118,yS,{stroke:C.axis,'stroke-width':1.2}));
      fig.appendChild(line(BLK.x-118,yA,BLK.x-110,yA,{stroke:C.axis,'stroke-width':1.2}));
      fig.appendChild(line(BLK.x-118,yS,BLK.x-110,yS,{stroke:C.axis,'stroke-width':1.2}));
      fig.appendChild(txt(BLK.x-126,(yA+yS)/2+4,`Vv = e = ${fmt(p.e,2)}`,{an:'end',fs:11.5,halo:0}));
    }
    fig.appendChild(txt(mid,BLK.yb+24,`Total V = 1 + e = ${fmt(1+p.e,2)} (per unit volume of solids)`,
      {fs:11,halo:0}));
    if(p.capped)
      fig.appendChild(txt(mid,BLK.yb+44,
        `w capped at saturation: w_sat = e/Gs = ${fmt(p.wSat,3)}`,
        {fs:11,fw:600,fill:C.load,halo:0}));
    fig.appendChild(txt(mid,68,`Se = wGs  →  S = ${fmt(p.w,3)} × ${fmt(p.Gs,2)} / ${fmt(p.e,2)} = ${fmt(p.S,2)}`,
      {fs:11.5,fill:C.ocean,fw:600,halo:0}));

    resultsEl.innerHTML=
      chip('Porosity n',`${fmt(p.n*100,1)} %`,'e/(1+e)')+
      chip('Saturation S',`${fmt(p.S*100,1)} %`,'wGs/e', p.S>0.999?'ok':'')+
      chip('γ dry',`${fmt(p.gdry,2)} kN/m³`,'Gs·γw/(1+e)')+
      chip('γ bulk',`${fmt(p.gbulk,2)} kN/m³`,'at this water content')+
      chip('γ saturated',`${fmt(p.gsat,2)} kN/m³`)+
      chip('γ′ submerged',`${fmt(p.gsub,2)} kN/m³`,'γsat − γw');
  }
  const chip=(k,v,sub,cls)=>`<div class="chip ${cls||''}"><div class="k">${k}</div><div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;

  function renderControls(){
    const presets=Object.entries(PRESETS)
      .map(([k,p])=>`<option value="${k}">${p.label}</option>`).join('');
    const row=(id,lab,min,max,st,val)=>`<div class="ctl"><label>${lab}</label><div class="row">
      <input type="range" id="${id}r" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${val}">
      <input type="number" id="${id}n" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${val}"></div></div>`;
    controls.innerHTML=`
      <h3>Presets</h3>
      <div class="ctl"><select id="preset"><option value="">Choose a soil…</option>${presets}</select></div>
      <h3>Phase quantities</h3>
      ${row('e','Void ratio e',0.2,1.5,0.05,state.e)}
      ${row('w','Water content w',0,0.6,0.01,state.w)}
      ${row('Gs','Specific gravity Gs',2.5,2.8,0.01,state.Gs)}`;
  }
  const KK={e:[0.2,1.5],w:[0,0.6],Gs:[2.5,2.8]};
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
    if(e.target.id==='preset'&&PRESETS[e.target.value]){
      const p=PRESETS[e.target.value];
      state.e=p.e;state.w=p.w;state.Gs=p.Gs;
      renderControls();document.getElementById('preset').value=e.target.value;render();
    }
  });

  renderControls();render();
})();
