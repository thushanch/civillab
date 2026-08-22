/* CivilLab · S10 Moment Distribution */
(() => {
  const { s, fmt, clamp } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');
  const tableWrap = document.getElementById('tablewrap');
  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              muted:'#5C6A72', axis:'#B9C0C5', contour:'#C9CEC7' };

  const PRESETS = {
    two:{label:'Two equal spans · UDL', left:'pin', right:'pin',
         spans:()=>[{L:6,w:10,P:0,a:3,EI:1},{L:6,w:10,P:0,a:3,EI:1}]},
    prop:{label:'Propped cantilever · UDL', left:'fixed', right:'pin',
         spans:()=>[{L:8,w:12,P:0,a:4,EI:1}]},
    fixfix:{label:'Fixed both ends · UDL', left:'fixed', right:'fixed',
         spans:()=>[{L:6,w:10,P:0,a:3,EI:1}]},
    three:{label:'Three spans · mixed loads', left:'fixed', right:'pin',
         spans:()=>[{L:5,w:8,P:0,a:2.5,EI:1},{L:7,w:0,P:40,a:3,EI:2},{L:5,w:8,P:0,a:2.5,EI:1}]}
  };
  const state = { presetKey:'two', left:'pin', right:'pin', spans:PRESETS.two.spans() };
  let model=null, res=null, autoTimer=null;

  const cfg=()=>({left:state.left,right:state.right,spans:state.spans});
  function rebuild(){ model=MDMEngine.create(cfg()); res=MDMEngine.results(model); }

  function txt(x,y,str,o={}){const a={x,y,'font-size':o.fs||12,fill:o.fill||C.muted,
    'text-anchor':o.an||'middle','font-weight':o.fw||400};
    if(o.halo!==0){a['paint-order']='stroke';a.stroke='#fff';a['stroke-width']=o.halo||3;a['stroke-linejoin']='round';}
    if(o.head)a['font-family']='Poppins, Inter, sans-serif';
    return s('text',a,str);}
  const line=(x1,y1,x2,y2,a={})=>s('line',Object.assign({x1,y1,x2,y2},a));

  const W=960, PADL=64, PADR=34, BEAM_Y=104;
  const BMD={title:240, zero:360, amp:118};

  function render(){
    res=MDMEngine.results(model);
    const Ltot=res.Ltot;
    const xpx=x=>PADL+(x/Ltot)*(W-PADL-PADR);
    while(fig.firstChild)fig.removeChild(fig.firstChild);
    fig.appendChild(s('defs',{},
      s('marker',{id:'mLoad',viewBox:'0 0 10 10',refX:8.5,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'},
        s('path',{d:'M0,0 L10,5 L0,10 z',fill:C.load})),
      s('marker',{id:'mLoadS',viewBox:'0 0 10 10',refX:8.5,refY:5,markerWidth:5.5,markerHeight:5.5,orient:'auto-start-reverse'},
        s('path',{d:'M0,0 L10,5 L0,10 z',fill:C.load}))));

    /* beam */
    fig.appendChild(txt(PADL,22,'Continuous beam',{an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    state.spans.forEach((sp,i)=>{
      const x0=xpx(res.offs[i]), x1=xpx(res.offs[i+1]);
      if(sp.w){
        const top=BEAM_Y-40;
        fig.appendChild(s('rect',{x:x0,y:top,width:x1-x0,height:36,fill:'rgba(176,58,46,.07)'}));
        fig.appendChild(line(x0,top,x1,top,{stroke:C.load,'stroke-width':1.8}));
        const n=Math.max(2,Math.round((x1-x0)/32)+1);
        for(let q=0;q<n;q++){
          const x=x0+(x1-x0)*q/(n-1);
          fig.appendChild(line(x,top+2,x,BEAM_Y-7,{stroke:C.load,'stroke-width':1.4,'marker-end':'url(#mLoadS)'}));
        }
        fig.appendChild(txt((x0+x1)/2,top-7,`${fmt(sp.w)} kN/m`,{fs:11,fw:600,fill:C.load}));
      }
      if(sp.P){
        const x=xpx(res.offs[i]+sp.a);
        fig.appendChild(line(x,BEAM_Y-56,x,BEAM_Y-6,{stroke:C.load,'stroke-width':2.4,'marker-end':'url(#mLoad)'}));
        fig.appendChild(txt(x,BEAM_Y-62,`${fmt(sp.P)} kN`,{fs:11,fw:600,fill:C.load}));
      }
      fig.appendChild(txt((x0+x1)/2,BEAM_Y+52,
        `L = ${fmt(sp.L)} m${sp.EI!==1?`, EI = ${fmt(sp.EI)}`:''}`,{fs:10.5,halo:0}));
    });
    fig.appendChild(line(xpx(0),BEAM_Y,xpx(Ltot),BEAM_Y,{stroke:C.ocean,'stroke-width':7}));

    /* supports */
    for(let j=0;j<=state.spans.length;j++){
      const x=xpx(res.offs[j]);
      const fixed=(j===0&&state.left==='fixed')||(j===state.spans.length&&state.right==='fixed');
      if(fixed){
        fig.appendChild(line(x,BEAM_Y-26,x,BEAM_Y+26,{stroke:C.ocean,'stroke-width':5}));
        const out=j===0?-1:1;
        for(let y=BEAM_Y-22;y<=BEAM_Y+22;y+=10)
          fig.appendChild(line(x+out*3,y,x+out*11,y+7,{stroke:C.contour,'stroke-width':1.3}));
      } else {
        fig.appendChild(s('polygon',{points:`${x},${BEAM_Y+3} ${x-11},${BEAM_Y+22} ${x+11},${BEAM_Y+22}`,fill:C.ocean}));
        fig.appendChild(line(x-15,BEAM_Y+23,x+15,BEAM_Y+23,{stroke:C.ocean,'stroke-width':1.5}));
      }
      fig.appendChild(txt(x,BEAM_Y+38,`R = ${fmt(res.R[j])} kN`,{fs:10.5,fw:600,fill:C.green}));
      fig.appendChild(txt(x,BEAM_Y-70,String.fromCharCode(65+j),{fs:12,fw:600,fill:C.ocean,halo:3}));
    }

    /* BMD, sagging drawn downwards */
    fig.appendChild(txt(PADL,BMD.title,'Bending moment (sagging drawn downwards)',
      {an:'start',fs:13,fw:600,fill:C.ocean,halo:0,head:true}));
    fig.appendChild(txt(W-PADR,BMD.title, model.converged?'converged':`cycle ${model.cycles}, still balancing`,
      {an:'end',fs:10.5,fill:model.converged?C.green:C.load,halo:0}));
    const vmax=Math.max(Math.abs(res.Mmax.M),Math.abs(res.Mmin.M),1e-9);
    const k=BMD.amp/vmax, y=v=>BMD.zero+v*k;
    fig.appendChild(line(PADL,BMD.zero,W-PADR,BMD.zero,{stroke:C.axis,'stroke-width':1}));
    let d='';
    res.samples.forEach((p,i)=>{
      const prev=res.samples[i-1];
      d+=(i===0||(prev&&p.span!==prev.span&&Math.abs(p.x-prev.x)<1e-9)?' M ':' L ')+xpx(p.x).toFixed(1)+' '+y(p.M).toFixed(1);
    });
    const first=res.samples[0], last=res.samples[res.samples.length-1];
    fig.appendChild(s('path',{d:d+` L ${xpx(last.x).toFixed(1)} ${BMD.zero} L ${xpx(first.x).toFixed(1)} ${BMD.zero} Z`,
      fill:C.green,'fill-opacity':.12,stroke:'none'}));
    fig.appendChild(s('path',{d,fill:'none',stroke:C.green,'stroke-width':2.2,'stroke-linejoin':'round'}));
    // support moment labels
    for(let j=0;j<=state.spans.length;j++){
      const M=res.supM[j];
      if(Math.abs(M)<vmax*0.01)continue;
      fig.appendChild(s('circle',{cx:xpx(res.offs[j]),cy:y(M),r:3,fill:C.green}));
      fig.appendChild(txt(clamp(xpx(res.offs[j]),PADL+34,W-PADR-34),y(M)+(M<0?-8:16),
        fmt(M),{fs:11,fw:600,fill:C.green}));
    }
    if(res.Mmax.M>vmax*0.01){
      fig.appendChild(s('circle',{cx:xpx(res.Mmax.x),cy:y(res.Mmax.M),r:3,fill:C.green}));
      fig.appendChild(txt(clamp(xpx(res.Mmax.x),PADL+40,W-PADR-40),y(res.Mmax.M)+16,
        `${fmt(res.Mmax.M)} at ${fmt(res.Mmax.x,2)} m`,{fs:11,fw:600,fill:C.green}));
    }
    renderTable();
    renderChips();
  }

  function renderTable(){
    const n=state.spans.length;
    const hdr=[];
    for(let i=0;i<n;i++){
      hdr.push(`${String.fromCharCode(65+i)}${String.fromCharCode(66+i)}`);
      hdr.push(`${String.fromCharCode(66+i)}${String.fromCharCode(65+i)}`);
    }
    const dfRow=new Array(2*n).fill(0);
    for(const jt of model.joints)jt.mem.forEach((e,q)=>{dfRow[e]=jt.DF[q];});
    const cell=(v,b)=>`<td style="padding:4px 9px;text-align:right;font-variant-numeric:tabular-nums;${b||''}">${v}</td>`;
    let html=`<div style="font-family:Poppins,Inter,sans-serif;font-weight:600;color:#14416B;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">Distribution table (kN·m, clockwise positive)</div>`;
    html+=`<table style="border-collapse:collapse;font-size:12.5px;width:100%"><thead><tr>
      <th style="text-align:left;padding:4px 9px;color:#5C6A72;font-weight:500">Step</th>
      ${hdr.map(h=>`<th style="padding:4px 9px;text-align:right;color:#14416B">${h}</th>`).join('')}</tr></thead><tbody>`;
    html+=`<tr style="border-bottom:1px solid #DFE3DC"><td style="padding:4px 9px;color:#5C6A72">DF</td>
      ${dfRow.map(v=>cell(v.toFixed(3),'color:#5C6A72')).join('')}</tr>`;
    model.rows.forEach(r=>{
      const bold=r.type==='Total'?'font-weight:600;color:#14416B;':'';
      const bord=r.type==='Total'?'border-top:2px solid #14416B;':(r.type==='FEM'?'border-bottom:1px solid #DFE3DC;':'');
      html+=`<tr><td style="padding:4px 9px;${bold}${bord}">${r.type}</td>
        ${r.vals.map(v=>cell(Math.abs(v)<5e-4?'–':v.toFixed(2),bold+bord)).join('')}</tr>`;
    });
    if(!model.converged){
      const unb=new Array(2*n).fill('');
      for(const jt of model.joints){
        if(!jt.balance)continue;
        const U=jt.mem.reduce((a,e)=>a+model.ends[e],0);
        jt.mem.forEach(e=>{unb[e]=U.toFixed(2);});
      }
      html+=`<tr style="border-top:1px solid #DFE3DC"><td style="padding:4px 9px;color:#B03A2E">Out of balance</td>
        ${unb.map(v=>cell(v||'–','color:#B03A2E')).join('')}</tr>`;
    }
    html+=`</tbody></table>`;
    tableWrap.innerHTML=html;
  }

  const chip=(k,v,sub,cls)=>`<div class="chip ${cls||''}"><div class="k">${k}</div><div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;
  function renderChips(){
    let out=chip('Cycles',`${model.cycles}`, model.converged?'converged':'still balancing', model.converged?'ok':'warn');
    let worst=0,wj=0;
    res.supM.forEach((m,j)=>{if(m<worst){worst=m;wj=j;}});
    if(worst<-1e-6)out+=chip('Max hogging',`${fmt(worst)} kN·m`,`at support ${String.fromCharCode(65+wj)}`,'warn');
    if(res.Mmax.M>1e-6)out+=chip('Max sagging',`${fmt(res.Mmax.M)} kN·m`,`at x = ${fmt(res.Mmax.x,2)} m`);
    const tot=res.R.reduce((a,b)=>a+b,0);
    out+=chip('ΣReactions',`${fmt(tot)} kN`,'equals the total applied load','ok');
    resultsEl.innerHTML=out;
  }

  function renderControls(){
    const presets=Object.entries(PRESETS)
      .map(([k,p])=>`<option value="${k}" ${state.presetKey===k?'selected':''}>${p.label}</option>`).join('')
      +`<option value="custom" ${state.presetKey==='custom'?'selected':''}>Custom</option>`;
    const endSel=(id,val)=>`<select id="${id}">
      <option value="pin" ${val==='pin'?'selected':''}>Pinned</option>
      <option value="fixed" ${val==='fixed'?'selected':''}>Fixed</option></select>`;
    const spanCards=state.spans.map((sp,i)=>`
      <div class="loadcard"><div class="head"><span class="badge udl">Span ${String.fromCharCode(65+i)}${String.fromCharCode(66+i)}</span>
        ${state.spans.length>1?`<button class="del" data-del="${i}" title="Remove span">✕</button>`:''}</div>
        <div class="grid2">
          <div class="mini"><label>L (m)</label><input type="number" step="0.5" min="1" max="20" value="${sp.L}" data-sp="${i}" data-k="L"></div>
          <div class="mini"><label>EI (relative)</label><input type="number" step="0.5" min="0.5" max="10" value="${sp.EI}" data-sp="${i}" data-k="EI"></div>
          <div class="mini"><label>w (kN/m)</label><input type="number" step="1" min="0" max="200" value="${sp.w}" data-sp="${i}" data-k="w"></div>
          <div class="mini"><label>P (kN)</label><input type="number" step="1" min="0" max="500" value="${sp.P}" data-sp="${i}" data-k="P"></div>
          <div class="mini"><label>P at a (m)</label><input type="number" step="0.25" min="0" max="${sp.L}" value="${sp.a}" data-sp="${i}" data-k="a"></div>
        </div></div>`).join('');
    controls.innerHTML=`
      <h3>Presets</h3><div class="ctl"><select id="preset">${presets}</select></div>
      <h3>End conditions</h3>
      <div class="grid2">
        <div class="mini"><label>Left end</label>${endSel('left',state.left)}</div>
        <div class="mini"><label>Right end</label>${endSel('right',state.right)}</div>
      </div>
      <h3>Spans</h3>${spanCards}
      <div class="addrow">
        <button class="btn ghost small" id="addspan">+ Add span</button>
      </div>
      <h3>Iteration</h3>
      <div class="addrow">
        <button class="btn small" id="step">Next step</button>
        <button class="btn ghost small" id="auto">Run to convergence</button>
        <button class="btn ghost small" id="reset">Reset</button>
      </div>`;
  }

  const markCustom=()=>{state.presetKey='custom';const p=document.getElementById('preset');if(p)p.value='custom';};
  function stopAuto(){ if(autoTimer){clearInterval(autoTimer);autoTimer=null;
    const b=document.getElementById('auto'); if(b)b.textContent='Run to convergence';} }

  controls.addEventListener('input',e=>{
    const t=e.target;
    if(t.dataset&&t.dataset.sp!=null){
      const i=+t.dataset.sp, k=t.dataset.k, v=parseFloat(t.value);
      if(isNaN(v))return;
      const sp=state.spans[i];
      if(k==='L'){sp.L=clamp(v,1,20);sp.a=clamp(sp.a,0,sp.L);}
      else if(k==='EI')sp.EI=clamp(v,0.5,10);
      else if(k==='w')sp.w=clamp(v,0,200);
      else if(k==='P')sp.P=clamp(v,0,500);
      else sp.a=clamp(v,0,sp.L);
      stopAuto();rebuild();render();markCustom();
    }
  });
  controls.addEventListener('change',e=>{
    const t=e.target;
    if(t.id==='preset'){
      const P=PRESETS[t.value];
      if(!P){state.presetKey='custom';return;}
      state.presetKey=t.value;state.left=P.left;state.right=P.right;state.spans=P.spans();
      stopAuto();rebuild();renderControls();render();return;
    }
    if(t.id==='left'||t.id==='right'){
      state[t.id]=t.value;stopAuto();rebuild();render();markCustom();
    }
  });
  controls.addEventListener('click',e=>{
    const id=e.target.id;
    if(id==='step'){ if(MDMEngine.step(model))render(); return; }
    if(id==='reset'){ stopAuto();rebuild();render(); return; }
    if(id==='auto'){
      if(autoTimer){stopAuto();return;}
      e.target.textContent='Stop';
      autoTimer=setInterval(()=>{
        if(model.converged||!MDMEngine.step(model)){stopAuto();render();return;}
        render();
      },420);
      return;
    }
    if(id==='addspan'){
      if(state.spans.length>=4)return;
      state.spans.push({L:6,w:10,P:0,a:3,EI:1});
      stopAuto();rebuild();renderControls();render();markCustom();return;
    }
    const del=e.target.dataset&&e.target.dataset.del;
    if(del!=null&&state.spans.length>1){
      state.spans.splice(+del,1);
      stopAuto();rebuild();renderControls();render();markCustom();
    }
  });

  rebuild();renderControls();render();
})();
