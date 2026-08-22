/* CivilLab · S5 Torsion Simulator */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              muted:'#5C6A72', axis:'#B9C0C5', contour:'#C9CEC7', bg:'#F6F7F4' };

  const state = { d1:100, taper:false, d2:70, hollow:false, di:60, T:10, L:2, G:80 };

  function txt(x,y,str,o={}){const a={x,y,'font-size':o.fs||12,fill:o.fill||C.muted,
    'text-anchor':o.an||'middle','font-weight':o.fw||400};
    if(o.halo!==0){a['paint-order']='stroke';a.stroke='#fff';a['stroke-width']=o.halo||3;a['stroke-linejoin']='round';}
    if(o.head)a['font-family']='Poppins, Inter, sans-serif';
    return s('text',a,str);}
  const line=(x1,y1,x2,y2,a={})=>s('line',Object.assign({x1,y1,x2,y2},a));

  const EL={x0:120,x1:560,yc:220,rMax:70};
  const PLT={ax:660,y0:150,y1:440,amp:200};

  function fix(){
    state.d1=clamp(state.d1,20,300);
    state.d2=clamp(state.d2,20,300);
    const dmin=Math.min(state.d1,state.taper?state.d2:state.d1);
    state.di=clamp(state.di,5,dmin-10);
  }

  function render(){
    fix();
    const di=state.hollow?state.di:0;
    const r=TorsionEngine.solve({d1:state.d1,d2:state.taper?state.d2:null,di,T:state.T,L:state.L,G:state.G});
    while(fig.firstChild)fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs',{},
      s('marker',{id:'mT',viewBox:'0 0 10 10',refX:8.5,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'},
        s('path',{d:'M0,0 L10,5 L0,10 z',fill:C.load}))));

    /* elevation */
    fig.appendChild(txt(EL.x0,26,'Shaft in torsion (twist exaggerated)',{an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    const dEnd=state.taper?state.d2:state.d1;
    const ksc=EL.rMax/Math.max(state.d1,dEnd)*2;
    const rAt=x=>((state.d1+(dEnd-state.d1)*x)/2)*ksc;   // x in 0..1
    // outline
    fig.appendChild(s('polygon',{points:
      `${EL.x0},${EL.yc-rAt(0)} ${EL.x1},${EL.yc-rAt(1)} ${EL.x1},${EL.yc+rAt(1)} ${EL.x0},${EL.yc+rAt(0)}`,
      fill:'rgba(20,65,107,.08)',stroke:C.ocean,'stroke-width':2}));
    if(state.hollow){
      const riScr=(di/2)*ksc;
      fig.appendChild(line(EL.x0,EL.yc-riScr,EL.x1,EL.yc-riScr,{stroke:C.ocean,'stroke-width':1,'stroke-dasharray':'5 4'}));
      fig.appendChild(line(EL.x0,EL.yc+riScr,EL.x1,EL.yc+riScr,{stroke:C.ocean,'stroke-width':1,'stroke-dasharray':'5 4'}));
    }
    fig.appendChild(line(EL.x0-6,EL.yc,EL.x1+6,EL.yc,{stroke:C.contour,'stroke-width':1,'stroke-dasharray':'6 4'}));
    // fixed wall left
    fig.appendChild(line(EL.x0,EL.yc-EL.rMax-16,EL.x0,EL.yc+EL.rMax+16,{stroke:C.ocean,'stroke-width':5}));
    for(let y=EL.yc-EL.rMax-12;y<=EL.yc+EL.rMax+12;y+=12)
      fig.appendChild(line(EL.x0-3,y,EL.x0-13,y+9,{stroke:C.contour,'stroke-width':1.4}));

    // twist fraction along the shaft: uniform → linear, taper → prefix of 1/J
    const N=120, frac=[0];
    let acc=0;
    for(let i=1;i<=N;i++){
      const xm=(i-0.5)/N;
      acc+= state.taper ? 1/TorsionEngine.J(state.d1+(dEnd-state.d1)*xm,di) : 1;
      frac.push(acc);
    }
    for(let i=0;i<=N;i++)frac[i]/=acc;
    const phiEnd=Math.min(2.0,Math.max(0.5,r.theta*40));
    // reference straight generator on the top surface
    fig.appendChild(line(EL.x0,EL.yc-rAt(0),EL.x1,EL.yc-rAt(1),
      {stroke:C.contour,'stroke-width':1.4,'stroke-dasharray':'5 4'}));
    // twisted generator: surface point at angle φ(x) from top, projected
    let d='';
    for(let i=0;i<=N;i++){
      const xi=i/N, x=EL.x0+(EL.x1-EL.x0)*xi;
      const y=EL.yc-rAt(xi)*Math.cos(phiEnd*frac[i]);
      d+=(i?' L ':'M ')+x.toFixed(1)+' '+y.toFixed(1);
    }
    fig.appendChild(s('path',{d,fill:'none',stroke:C.water,'stroke-width':2.6,'stroke-linejoin':'round'}));
    // torque arrow at the free end
    const rr=rAt(1)+14;
    fig.appendChild(s('path',{d:`M ${EL.x1+18} ${EL.yc+rr} A ${rr} ${rr} 0 1 0 ${EL.x1+18} ${EL.yc-rr}`,
      fill:'none',stroke:C.load,'stroke-width':2.4,'marker-end':'url(#mT)'}));
    fig.appendChild(txt(EL.x1+40,EL.yc+4,`T = ${fmt(state.T)} kN·m`,{an:'start',fs:11.5,fw:600,fill:C.load}));
    fig.appendChild(txt((EL.x0+EL.x1)/2,EL.yc+EL.rMax+40,
      `L = ${fmt(state.L)} m · θ = ${fmt(r.theta*180/Math.PI,2)}°`,{fs:11.5,halo:0}));

    /* tau against r at the governing end */
    fig.appendChild(txt(PLT.ax-30,26,`Shear stress across the section${state.taper?' (thin end governs)':''}`,
      {an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    const R=r.dMin/2, ri=di/2;
    const ry=v=>PLT.y1-(v/R)*(PLT.y1-PLT.y0);      // radius axis, up
    const tx=v=>PLT.ax+(v/r.tauMax)*PLT.amp;
    fig.appendChild(line(PLT.ax,PLT.y0-14,PLT.ax,PLT.y1+8,{stroke:C.axis,'stroke-width':1.2}));
    fig.appendChild(line(PLT.ax-8,PLT.y1,PLT.ax+PLT.amp+30,PLT.y1,{stroke:C.axis,'stroke-width':1.2}));
    fig.appendChild(txt(PLT.ax+PLT.amp+34,PLT.y1+4,'τ',{an:'start',fs:12,halo:0}));
    fig.appendChild(txt(PLT.ax-10,PLT.y0-2,'r',{an:'end',fs:12,halo:0}));
    if(state.hollow){
      fig.appendChild(s('rect',{x:PLT.ax,y:ry(ri),width:PLT.amp+20,height:PLT.y1-ry(ri),
        fill:'rgba(201,206,199,.25)'}));
      fig.appendChild(txt(PLT.ax+70,(ry(ri)+PLT.y1)/2+4,'bore (no material)',{fs:10.5,halo:0}));
      fig.appendChild(s('polygon',{points:`${PLT.ax},${ry(ri)} ${tx(r.tauAt(ri))},${ry(ri)} ${tx(r.tauMax)},${ry(R)} ${PLT.ax},${ry(R)}`,
        fill:'rgba(30,120,176,.14)',stroke:'none'}));
      fig.appendChild(line(tx(r.tauAt(ri)),ry(ri),tx(r.tauMax),ry(R),{stroke:C.water,'stroke-width':2.4}));
    } else {
      fig.appendChild(s('polygon',{points:`${PLT.ax},${PLT.y1} ${tx(r.tauMax)},${ry(R)} ${PLT.ax},${ry(R)}`,
        fill:'rgba(30,120,176,.14)',stroke:'none'}));
      fig.appendChild(line(PLT.ax,PLT.y1,tx(r.tauMax),ry(R),{stroke:C.water,'stroke-width':2.4}));
    }
    fig.appendChild(s('circle',{cx:tx(r.tauMax),cy:ry(R),r:3.5,fill:C.water}));
    fig.appendChild(txt(tx(r.tauMax)-6,ry(R)-10,`τmax = ${fmt(r.tauMax,1)} MPa at the surface`,
      {an:'end',fs:11.5,fw:600,fill:C.water}));

    resultsEl.innerHTML=
      chip('J at the governing end',`${fmt(r.Jmin/1e6,2)} ×10⁶ mm⁴`)+
      chip('τmax',`${fmt(r.tauMax,1)} MPa`,`at r = ${fmt(r.dMin/2)} mm`,'warn')+
      chip('Angle of twist θ',`${fmt(r.theta*180/Math.PI,2)}°`,`${fmt(r.theta*1000,2)} mrad over ${fmt(state.L)} m`)+
      chip('Twist rate',`${fmt(r.theta*180/Math.PI/state.L,2)} °/m`);
  }
  const chip=(k,v,sub,cls)=>`<div class="chip ${cls||''}"><div class="k">${k}</div><div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;

  function renderControls(){
    const row=(id,lab,min,max,st,val)=>`<div class="ctl"><label>${lab}</label><div class="row">
      <input type="range" id="${id}r" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${val}">
      <input type="number" id="${id}n" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${val}"></div></div>`;
    controls.innerHTML=`
      <h3>Shaft</h3>
      ${row('d1','Diameter d (mm)',20,300,5,state.d1)}
      <div class="ctl"><label class="chk"><input type="checkbox" id="taper" ${state.taper?'checked':''}>
        <span>Tapered (outer diameter varies)</span></label></div>
      ${state.taper?row('d2','End diameter d2 (mm)',20,300,5,state.d2):''}
      <div class="ctl"><label class="chk"><input type="checkbox" id="hollow" ${state.hollow?'checked':''}>
        <span>Hollow (constant bore)</span></label></div>
      ${state.hollow?row('di','Bore di (mm)',5,290,5,state.di):''}
      <h3>Loading & material</h3>
      ${row('T','Torque T (kN·m)',1,100,1,state.T)}
      ${row('L','Length L (m)',0.5,6,0.25,state.L)}
      ${row('G','G (GPa)',20,120,5,state.G)}`;
  }
  const KK={d1:[20,300],d2:[20,300],di:[5,290],T:[1,100],L:[0.5,6],G:[20,120]};
  controls.addEventListener('input',e=>{
    const t=e.target;
    if(t.id==='taper'){state.taper=t.checked;renderControls();render();return;}
    if(t.id==='hollow'){state.hollow=t.checked;renderControls();render();return;}
    const k=t.dataset&&t.dataset.k;if(!k||!KK[k])return;
    const v=parseFloat(t.value);if(isNaN(v))return;
    state[k]=clamp(v,KK[k][0],KK[k][1]);
    for(const suf of ['r','n']){
      const el=document.getElementById(k+suf);
      if(el&&el!==t&&document.activeElement!==el)el.value=state[k];
    }
    render();
  });

  renderControls();render();
})();
