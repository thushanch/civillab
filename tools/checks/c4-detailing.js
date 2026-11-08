/* interaction checks for C4 detailing, numbers worked by hand */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const sub = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c && c.querySelector('.s') ? c.querySelector('.s').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };

  // H20, C30, good bond: fbd = 2.25 x 0.7 x 0.3 x 30^2/3 / 1.5 = 3.04, lb,rqd = 5 x 434.8 / 3.04
  const fbd = 2.25 * 0.7 * 0.3 * Math.pow(30, 2 / 3) / 1.5, lb = 5 * 500 / 1.15 / fbd;
  ok('lb,rqd', parseFloat(val('lb,rqd')), lb, 0.5);
  // 3 bars in 300 with 35 cover and H10 links: clear (210 - 60)/2 = 75, cd = 37.5
  ok('clear gap', parseFloat(val('Clear gap')), 75, 0.5);
  const a2 = 1 - 0.15 * (37.5 - 20) / 20;
  ok('lbd = alpha2 lb,rqd', parseFloat(val('lbd')), a2 * lb, 0.5);
  ok('lap l0 = alpha2 alpha6 lb,rqd', parseFloat(val('Lap l0')), a2 * Math.SQRT2 * lb, 0.5);
  // XC3, C30, S4: cmin,dur 25 + 10
  ok('cover needed', val('Cover needed'), '35 mm');
  ok('verdict passes', val('Verdict'), 'Passes');

  // five bars: clear (210 - 100)/4 = 27.5, cd = 13.75 < phi so alpha2 = 1 and lbd = lb,rqd > 650
  set('nr', 5);
  ok('clear gap with 5 bars', parseFloat(val('Clear gap')), 27.5, 0.5);
  ok('lbd back to lb,rqd', parseFloat(val('lbd')), lb, 0.5);
  ok('anchorage now fails', val('Verdict'), 'Fails');

  set('bond', 'poor', 'change');
  ok('poor bond lb,rqd / 0.7', parseFloat(val('lb,rqd')), lb / 0.7, 0.5);
  set('exposure', 'XS3', 'change');
  ok('XS3 cover 45 + 10', val('Cover needed'), '55 mm');

  set('code', 'bs', 'change');   // l = 20 x 435 / (4 x 0.5 sqrt 35)
  ok('BS anchorage', parseFloat(val('Anchorage')), 20 * 435 / (2 * Math.sqrt(35)), 0.5);
  set('code', 'ec2', 'change');

  // narrow beam R120, b 250: a = 60 - 5(10/60) = 59.2, cover = a - 10 - 10 = 39.2 governs
  set('preset', 'fire', 'change');
  ok('fire cover', parseFloat(val('Cover needed')), 60 - 5 / 6 - 20, 0.5);
  ok('fire governs', sub('Cover needed'), 'fire governs');
};
