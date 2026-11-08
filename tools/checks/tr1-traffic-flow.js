/* interaction checks for Tr1 traffic flow */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const sub = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c && c.querySelector('.s') ? c.querySelector('.s').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };

  // urban arterial: vf 60, kj 120, qmax = 60 x 120 / 4 = 1800 at k = 60
  ok('qmax = vf kj / 4', parseFloat(val('Capacity qmax')), 1800, 0.5);
  ok('kc = kj / 2', parseFloat(val('At density kc')), 60, 0.05);
  // kA = 30: v = 60(1 - 0.25) = 45, q = 1350
  ok('speed at A', parseFloat(val('Speed A')), 45, 0.05);
  ok('flow at A', parseFloat(val('Flow A')), 1350, 0.5);
  ok('headway 3600 / 1350', parseFloat(val('Headway')), 3600 / 1350, 0.006);

  set('kAr', 90);   // the same flow, congested: v = 15, q = 1350
  ok('same flow on the congested side', parseFloat(val('Flow A')), 1350, 0.5);
  ok('congested', sub('Density A'), 'congested');

  set('model', 'greenberg', 'change');   // vm = 30, qmax = 30 x 120 / e
  ok('Greenberg qmax = vm kj / e', parseFloat(val('Capacity qmax')), 30 * 120 / Math.E, 0.5);
  set('model', 'greenshields', 'change');

  set('preset', 'queue', 'change');   // uw = vf (1 - (kA + kB)/kj) = 60(1 - 145/120)
  ok('shockwave', parseFloat(val('Shockwave')), 60 * (1 - 145 / 120), 0.05);
  ok('moves upstream', sub('Shockwave'), 'travels upstream');

  set('vfr', 100); set('kjr', 150);
  ok('motorway capacity 3750', parseFloat(val('Capacity qmax')), 3750, 0.5);
};
