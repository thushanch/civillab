/* interaction checks for G3, appended to the generic smoke run */
module.exports = function (doc, w, ok) {
  const val = key => { const c=[...doc.querySelectorAll('.chip')]
    .find(c=>c.querySelector('.k').textContent.trim()===key);
    return c?c.querySelector('.v').textContent.trim():'(missing)'; };
  const sub = key => { const c=[...doc.querySelectorAll('.chip')]
    .find(c=>c.querySelector('.k').textContent.trim()===key);
    const e=c&&c.querySelector('.s'); return e?e.textContent.trim():'(missing)'; };
  const fire=(el,t)=>el.dispatchEvent(new w.Event(t,{bubbles:true}));
  const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const set=(id,v)=>{const e=doc.getElementById(id);e.value=String(v);fire(e,'input');};
  const pick=(id,v)=>{const e=doc.getElementById(id);e.value=v;fire(e,'change');};

  /* 1. default: loose sand CD, c'=0 phi'=30 s3=100, load 60 %
        sd_f = s3(N-1) + 2c*sqrt(N) = 100(3-1) = 200
        sd   = 0.60 x 200 = 120,  s1 = 220
        u = 0 so effective equals total
        margin = 200/120 = 1.667
        sin(phiMob) = R/C = 60/160 = 0.375 -> 22.024 deg
        theta = 45 + 15 = 60                                        */
  ok('default sd at failure', val('σd at failure'), '200 kPa');
  ok('default deviator', val('Deviator σd'), '120 kPa');
  ok('default u is zero', val('u'), '0 kPa');
  ok('default effective s1', val('σ1′'), '220 kPa');
  ok('default margin', val('Load margin'), '1.67');
  ok('default mobilised phi', val('Mobilised φ'),
     (Math.asin(0.375)*180/Math.PI).toFixed(1)+'°');
  ok('default failure plane', val('Failure plane'), '60.0°');
  ok('default state', val('State'), 'Stable');

  /* 2. load to failure */
  click(doc.getElementById('tofail'));
  ok('at failure deviator', val('Deviator σd'), '200 kPa');
  ok('at failure margin', val('Load margin'), '1.00');
  ok('at failure mobilised phi reaches 30', val('Mobilised φ'), '30.0°');
  ok('at failure state', val('State'), 'FAILED');
  ok('at failure effective s1', val('σ1′'), '300 kPa');

  /* 3. raise phi to 38 at 100 % load, sd_f = 100(N-1), N = tan^2(64) */
  set('phir', 38);
  const N38 = (1+Math.sin(38*Math.PI/180))/(1-Math.sin(38*Math.PI/180));
  ok('phi 38 sd at failure', val('σd at failure'), Math.round(100*(N38-1))+' kPa');
  ok('phi 38 failure plane', val('Failure plane'), '64.0°');
  ok('editing a strength slider clears the preset', doc.getElementById('preset').value, '');

  /* 4. UU mode: cu = 35, s3 = 150, sd_f = 2cu = 70, phi = 0 so theta = 45 */
  pick('mode','uu');
  ok('uu controls rebuilt, cu slider exists', !!doc.getElementById('cur'), true);
  set('cur', 35); set('s3r', 150);
  ok('uu sd at failure is 2cu', val('σd at failure'), '70 kPa');
  ok('uu failure plane', val('Failure plane'), '45.0°');
  ok('uu effective stresses unknown', val('σ3′'), '–');
  ok('uu u unknown', val('u'), '–');
  ok('uu sub says not measured', sub('u'), 'not measured in UU');
  /* cell pressure must not change the UU strength */
  set('s3r', 400);
  ok('uu strength ignores cell pressure', val('σd at failure'), '70 kPa');

  /* 5. CU mode with Skempton A: c'=0, phi'=30 (N=3), s3=200, A=1
        sd_f = 200(3-1)/(1+1(3-1)) = 400/3 = 133.3 -> 133
        at failure u = A sd = 133.3, s3' = 66.7 -> 67, s1' = 200        */
  pick('mode','cu');
  set('cr', 0); set('phir', 30); set('s3r', 200); set('Ar', 1);
  click(doc.getElementById('tofail'));
  ok('cu sd at failure', val('σd at failure'), '133 kPa');
  ok('cu u at failure', val('u'), '133 kPa');
  ok('cu effective s3 at failure', val('σ3′'), '67 kPa');
  ok('cu effective s1 at failure', val('σ1′'), '200 kPa');
  ok('cu mobilised phi reaches 30', val('Mobilised φ'), '30.0°');
  ok('cu state', val('State'), 'FAILED');

  /* 6. a negative A makes the soil stronger, A = -0.5 with N = 3 never fails */
  set('Ar', -0.5);
  ok('A = -0.5 never fails', val('σd at failure'), '–');
  ok('A = -0.5 margin blank', val('Load margin'), '–');
  set('Ar', 0);
  ok('back to A = 0 gives the drained value', val('σd at failure'), '400 kPa');

  /* 7. unload button */
  click(doc.getElementById('unload'));
  ok('unloaded deviator', val('Deviator σd'), '0 kPa');
  ok('unloaded state', val('State'), 'Stable');

  /* 8. preset restores everything */
  pick('preset','soft');
  ok('preset switches mode to uu', doc.getElementById('mode').value, 'uu');
  ok('preset cu strength', val('σd at failure'), '70 kPa');
  ok('preset kept in the select', doc.getElementById('preset').value, 'soft');
};
