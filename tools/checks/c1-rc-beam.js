/* interaction checks for C1 RC beam designer */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };
  const click = sel => doc.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

  // 300x500 d=450 C30, M=150: K = 150e6/(300*450^2*30) = 0.0823, As = 832
  ok('K default', parseFloat(val('K')), 0.0823, 0.0002);
  ok('As,req default', parseFloat(val('As,req')), 832, 2);
  // VRd,c = 0.12*1.667*(100*0.00667*30)^(1/3)*300*450 = 73.3 kN
  ok('VRd,c default', parseFloat(val('VRd,c')), 73.3, 0.2);
  ok('VRd,max at 21.8', parseFloat(val('VRd,max')), 376.0, 0.5);

  set('MEdr', 200);   // K = 200/150 * 0.0823 = 0.1097
  ok('K at M=200', parseFloat(val('K')), 0.1097, 0.0002);
  set('br', 350);     // K = 200e6/(350*450^2*30) = 0.0941
  ok('K at b=350', parseFloat(val('K')), 0.0941, 0.0002);

  set('preset', 'doubly', 'change');
  ok('doubly preset K', parseFloat(val('K')), 0.2177, 0.0002);
  ok('doubly flagged', doc.querySelectorAll('.chip.warn').length > 0, true);

  click('[data-tab="shear"]');
  ok('shear tab active', doc.querySelector('[data-tab="shear"]').classList.contains('ghost'), false);
  set('thetar', 45);  // doubly preset bw=250 d=350: 250*315*0.528*17/2 = 353.4 kN
  ok('VRd,max at 45', parseFloat(val('VRd,max')), 353.4, 0.5);

  set('code', 'bs', 'change');
  ok('BS chips appear', val('BS K') !== '(missing)', true);
};
