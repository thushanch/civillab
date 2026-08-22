/* CivilLab · S12 Structural Dynamics */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              midblue:'#2E6FA3', pale:'#9FC4E6', muted:'#5C6A72', axis:'#B9C0C5', contour:'#C9CEC7' };

  const state = { mode:'sdof', m:10, k:1000, z:0.05, u0:1, storeys:3,
                  ms:2, ks:1200, t:0, playing:false };
  let raf=null;

  function txt(x,y,str,o={}){const a={x,y,'font-size':o.fs||12,fill:o.fill||C.muted,
    'text-anchor':o.an||'middle','font-weight':o.fw||400};
    if(o.halo!==0){a['paint-order']='stroke';a.stroke='#fff';a['stroke-width']=o.halo||3;a['stroke-linejoin']='round';}
    if(o.head)a['font-family']='Poppins, Inter, sans-serif';
    return s('text',a,str);}
  const line=(x1,y1,x2,y2,a={})=>s('line',Object.assign({x1,y1,x2,y2},a));

  /* spring drawn as a zigzag between two points */
  function spring(x0,y0,x1,y1,coils=8,w=13){
    const dx=x1-x0, dy=y1-y0, L=Math.hypot(dx,dy);
    const ux=dx/L, uy=dy/L, nx=-uy, ny=ux;
    const lead=L*0.16;
    let d=`M ${x0} ${y0} L ${(x0+ux*lead).toFixed(1)} ${(y0+uy*lead).toFixed(1)}`;
    const seg=(L-2*lead)/coils;
    for(let i=0;i<coils;i++){
      const t=lead+seg*(i+0.5), sgn=i%2?-1:1;
      d+=` L ${(x0+ux*t+nx*w*sgn).toFixed(1)} ${(y0+uy*t+ny*w*sgn).toFixed(1)}`;
    }
    d+=` L ${(x1-ux*lead).toFixed(1)} ${(y1-uy*lead).toFixed(1)} L ${x1} ${y1}`;
    return s('path',{d,fill:'none',stroke:C.midblue,'stroke-width':2.2,'stroke-linejoin':'round'});
  }
  function ground(x0,x1,y){
    const g=s('g');
    g.appendChild(line(x0,y,x1,y,{stroke:C.ocean,'stroke-width':3}));
    for(let x=x0;x<=x1-6;x+=13)g.appendChild(line(x,y,x-7,y+9,{stroke:C.contour,'stroke-width':1.4}));
    return g;
  }

  function render(){
    while(fig.firstChild)fig.removeChild(fig.firstChild);
    if(state.mode==='sdof')renderSDOF(); else renderMDOF();
  }

  /* ---------------- SDOF ---------------- */
  function renderSDOF(){
    const r=DynEngine.sdof(state.m,state.k,state.z);
    const u=DynEngine.freeResp(state.m,state.k,state.z,state.u0,0,state.t);
    const CX=180, CY=250, AMP=78;
    fig.appendChild(txt(50,26,'Free vibration of a single degree of freedom system',
      {an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));

    /* wall + spring + mass */
    fig.appendChild(line(70,CY-70,70,CY+70,{stroke:C.ocean,'stroke-width':5}));
    for(let y=CY-64;y<=CY+64;y+=12)
      fig.appendChild(line(67,y,57,y+9,{stroke:C.contour,'stroke-width':1.4}));
    const ux=CX+u/Math.max(Math.abs(state.u0),1e-9)*AMP;
    fig.appendChild(spring(70,CY,ux-36,CY));
    // dashpot
    fig.appendChild(line(70,CY+46,ux-52,CY+46,{stroke:C.axis,'stroke-width':2}));
    fig.appendChild(s('rect',{x:ux-52,y:CY+36,width:22,height:20,fill:'#fff',stroke:C.axis,'stroke-width':1.8}));
    fig.appendChild(line(ux-41,CY+46,ux-36,CY+46,{stroke:C.axis,'stroke-width':2}));
    fig.appendChild(txt(140,CY+70,`c → ζ = ${fmt(state.z,3)}`,{fs:11,halo:0}));
    fig.appendChild(txt(120,CY-24,`k = ${fmt(state.k,0)} kN/m`,{fs:11,fill:C.midblue,halo:3}));
    // mass block
    fig.appendChild(s('rect',{x:ux-36,y:CY-40,width:72,height:80,rx:5,
      fill:'rgba(20,65,107,.90)',stroke:C.ocean,'stroke-width':2}));
    fig.appendChild(txt(ux,CY+5,`m`,{fs:16,fw:600,fill:'#fff',halo:0}));
    fig.appendChild(txt(ux,CY+62,`${fmt(state.m)} t`,{fs:11,halo:0}));
    // reference line
    fig.appendChild(line(CX,CY-72,CX,CY+80,{stroke:C.contour,'stroke-width':1,'stroke-dasharray':'4 4'}));
    fig.appendChild(ground(60,320,CY+92));

    /* trace */
    const P={x0:400,x1:920,y:250,amp:105,T:Math.max(6*r.T,1e-6)};
    fig.appendChild(txt(P.x0,26,'Displacement trace',{an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    fig.appendChild(line(P.x0,P.y,P.x1,P.y,{stroke:C.axis,'stroke-width':1}));
    fig.appendChild(txt(P.x1,P.y+18,`t (s), showing ${fmt(P.T,2)} s`,{an:'end',fs:10.5,halo:0}));
    const px=t=>P.x0+(t/P.T)*(P.x1-P.x0);
    const py=v=>P.y-(v/Math.max(Math.abs(state.u0),1e-9))*P.amp;
    // envelope
    if(state.z>0&&state.z<1){
      let de='',dn='';
      for(let i=0;i<=160;i++){
        const t=P.T*i/160, e=Math.exp(-state.z*r.wn*t)*state.u0;
        de+=(i?' L ':'M ')+px(t).toFixed(1)+' '+py(e).toFixed(1);
        dn+=(i?' L ':'M ')+px(t).toFixed(1)+' '+py(-e).toFixed(1);
      }
      for(const dd of [de,dn])
        fig.appendChild(s('path',{d:dd,fill:'none',stroke:C.pale,'stroke-width':1.6,'stroke-dasharray':'5 4'}));
    }
    let d='';
    for(let i=0;i<=520;i++){
      const t=P.T*i/520;
      d+=(i?' L ':'M ')+px(t).toFixed(1)+' '+py(DynEngine.freeResp(state.m,state.k,state.z,state.u0,0,t)).toFixed(1);
    }
    fig.appendChild(s('path',{d,fill:'none',stroke:C.water,'stroke-width':2.2,'stroke-linejoin':'round'}));
    // current marker
    const tc=state.t%P.T;
    fig.appendChild(line(px(tc),P.y-P.amp-12,px(tc),P.y+P.amp+12,
      {stroke:'#7C8792','stroke-width':1,'stroke-dasharray':'3 3'}));
    fig.appendChild(s('circle',{cx:px(tc),cy:py(DynEngine.freeResp(state.m,state.k,state.z,state.u0,0,tc)),
      r:5,fill:C.green,stroke:'#fff','stroke-width':1.6}));
    // period marker
    if(r.T<P.T){
      fig.appendChild(line(P.x0,P.y+P.amp+26,px(r.T),P.y+P.amp+26,{stroke:C.green,'stroke-width':1.8}));
      fig.appendChild(txt((P.x0+px(r.T))/2,P.y+P.amp+42,`T = ${fmt(r.T,3)} s`,{fs:11,fw:600,fill:C.green}));
    }

    resultsEl.innerHTML=
      chip('ωn',`${fmt(r.wn,2)} rad/s`,'√(k/m)','ok')+
      chip('fn',`${fmt(r.fn,3)} Hz`)+
      chip('Period T',`${fmt(r.T,3)} s`)+
      chip('ωd damped',`${fmt(r.wd,2)} rad/s`,`ζ = ${fmt(state.z,3)}`)+
      chip('Log decrement δ',`${fmt(r.logdec,3)}`,'ln of successive peaks')+
      chip('Damping',state.z<1?(state.z===0?'undamped':'under-damped'):'critical or over','ζ vs 1',state.z<1?'':'warn');
  }

  /* ---------------- MDOF shear building ---------------- */
  function renderMDOF(){
    const n=state.storeys;
    const ms=new Array(n).fill(state.ms), ks=new Array(n).fill(state.ks);
    const r=DynEngine.shear(ms,ks);
    fig.appendChild(txt(50,26,`Shear building · ${n} storeys · mode shapes`,
      {an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));

    const H=300, yb=430, hs=H/n, W=110;
    const cols=[130,430,730].slice(0,n);
    r.modes.forEach((phi,mi)=>{
      if(mi>=cols.length)return;
      const cx=cols[mi];
      const amp=Math.min(58,W*0.62);
      fig.appendChild(txt(cx,72,`Mode ${mi+1}`,{fs:12.5,fw:600,fill:C.ocean,halo:0,head:true}));
      fig.appendChild(txt(cx,90,`ω = ${fmt(r.omegas[mi],2)} rad/s · ${fmt(r.fns[mi],3)} Hz`,{fs:11,halo:0}));
      // reference
      fig.appendChild(line(cx,yb,cx,yb-H,{stroke:C.contour,'stroke-width':1.2,'stroke-dasharray':'5 4'}));
      fig.appendChild(ground(cx-70,cx+70,yb));
      const anim=state.playing?Math.sin(state.t*r.omegas[mi]/Math.max(r.omegas[0],1e-9)*1.2):1;
      const pos=[[cx,yb]];
      for(let i=0;i<n;i++)pos.push([cx+phi[i]*amp*anim, yb-hs*(i+1)]);
      // columns as smooth curves between floors
      let d=`M ${pos[0][0].toFixed(1)} ${pos[0][1]}`;
      for(let i=1;i<pos.length;i++){
        const [x0,y0]=pos[i-1],[x1,y1]=pos[i];
        const my=(y0+y1)/2;
        d+=` C ${x0.toFixed(1)} ${my.toFixed(1)}, ${x1.toFixed(1)} ${my.toFixed(1)}, ${x1.toFixed(1)} ${y1}`;
      }
      for(const off of [-26,26]){
        fig.appendChild(s('path',{d:d.replace(/M ([\d.]+)/,(m,v)=>'M '+(parseFloat(v)+off).toFixed(1))
          .split(' ').map(tok=>tok).join(' '),fill:'none',stroke:'none'}));
      }
      fig.appendChild(s('path',{d,fill:'none',stroke:C.midblue,'stroke-width':2.4,'stroke-linejoin':'round'}));
      // floor slabs
      for(let i=1;i<pos.length;i++){
        const [x,y]=pos[i];
        fig.appendChild(s('rect',{x:x-34,y:y-9,width:68,height:18,rx:3,
          fill:'rgba(20,65,107,.88)',stroke:C.ocean,'stroke-width':1.6}));
        fig.appendChild(txt(x,y+5,`${fmt(phi[i-1],2)}`,{fs:10.5,fw:600,fill:'#fff',halo:0}));
      }
    });
    fig.appendChild(txt(480,478,
      `each storey: m = ${fmt(state.ms)} t, k = ${fmt(state.ks,0)} kN/m · ordinates normalised to the largest`,
      {fs:11,halo:0}));

    let out='';
    r.omegas.forEach((w,i)=>{
      out+=chip(`Mode ${i+1} ω`,`${fmt(w,2)} rad/s`,`T = ${fmt(2*Math.PI/w,3)} s`,i===0?'ok':'');
    });
    out+=chip('Fundamental f',`${fmt(r.fns[0],3)} Hz`,'lowest mode governs sway','ok');
    resultsEl.innerHTML=out;
  }

  const chip=(k,v,sub,cls)=>`<div class="chip ${cls||''}"><div class="k">${k}</div><div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;

  function renderControls(){
    const row=(id,lab,min,max,st)=>`<div class="ctl"><label>${lab}</label><div class="row">
      <input type="range" id="${id}r" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${state[id]}">
      <input type="number" id="${id}n" data-k="${id}" min="${min}" max="${max}" step="${st}" value="${state[id]}"></div></div>`;
    controls.innerHTML=`
      <h3>System</h3>
      <div class="ctl"><select id="mode">
        <option value="sdof" ${state.mode==='sdof'?'selected':''}>Single degree of freedom</option>
        <option value="mdof" ${state.mode==='mdof'?'selected':''}>Shear building (modes)</option>
      </select></div>
      ${state.mode==='sdof'?`
        <h3>Properties</h3>
        ${row('m','Mass m (tonnes)',1,50,1)}
        ${row('k','Stiffness k (kN/m)',100,5000,50)}
        ${row('z','Damping ratio ζ',0,0.99,0.01)}
        ${row('u0','Initial displacement u₀ (m)',0.1,2,0.1)}`
      :`
        <h3>Building</h3>
        ${row('storeys','Storeys',2,3,1)}
        ${row('ms','Storey mass (tonnes)',0.5,10,0.5)}
        ${row('ks','Storey stiffness (kN/m)',200,4000,50)}`}
      <div class="addrow"><button class="btn small" id="play">${state.playing?'Stop':'Play'}</button>
      <button class="btn ghost small" id="reset">Reset time</button></div>`;
  }
  const KK={m:[1,50],k:[100,5000],z:[0,0.99],u0:[0.1,2],storeys:[2,3],ms:[0.5,10],ks:[200,4000]};
  controls.addEventListener('input',e=>{
    const k=e.target.dataset&&e.target.dataset.k;if(!k||!KK[k])return;
    const v=parseFloat(e.target.value);if(isNaN(v))return;
    state[k]=k==='storeys'?Math.round(clamp(v,2,3)):clamp(v,KK[k][0],KK[k][1]);
    for(const suf of ['r','n']){
      const el=document.getElementById(k+suf);
      if(el&&el!==e.target&&document.activeElement!==el)el.value=state[k];
    }
    render();
  });
  controls.addEventListener('change',e=>{
    if(e.target.id==='mode'){
      state.mode=e.target.value;state.t=0;
      renderControls();render();
    }
  });
  controls.addEventListener('click',e=>{
    if(e.target.id==='reset'){state.t=0;render();return;}
    if(e.target.id!=='play')return;
    if(raf){cancelAnimationFrame(raf);raf=null;state.playing=false;
      e.target.textContent='Play';return;}
    state.playing=true;e.target.textContent='Stop';
    const step=()=>{state.t+=0.02;render();raf=requestAnimationFrame(step);};
    raf=requestAnimationFrame(step);
  });

  renderControls();render();
})();
