/* interaction checks for St2 steel connections, numbers worked by hand */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const sub = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c && c.querySelector('.s') ? c.querySelector('.s').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };
  const tab = t => doc.querySelector(`[data-tab="${t}"]`).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

  // fin plate: 3 M20 8.8 in 10 mm S275, V 220 concentric
  ok('worst bolt V/n', parseFloat(val('Worst bolt')), 220 / 3, 0.06);
  ok('Fv,Rd = 0.6 x 800 x 245 / 1.25', parseFloat(val('Fv,Rd')), 94.08, 0.06);
  ok('Fb,Rd = 2.5 x (40/66) x 410 x 20 x 10 / 1.25', parseFloat(val('Fb,Rd')), 2.5 * 40 / 66 * 410 * 200 / 1.25 / 1e3, 0.06);
  ok('block tearing Veff,1', parseFloat(val('Block tearing')), (410 * 290 / 1.25 + 275 * 1250 / Math.sqrt(3)) / 1e3, 0.6);
  ok('verdict passes', val('Verdict'), 'Passes');

  set('eccr', 100);   // M = 22000 kN mm, sum r^2 = 2 x 70^2 = 9800
  ok('eccentric corner bolt', parseFloat(val('Worst bolt')), Math.hypot(22000 * 70 / 9800, 220 / 3), 0.06);
  ok('now fails', val('Verdict'), 'Fails');

  // end plate T-stub, tp 12: Mpl = 0.25 x 150 x 144 x 275 = 1.485 kNm, mode 1 = 4 Mpl / m
  set('preset', 'tstub', 'change');
  ok('tension per bolt', sub('Ft,Rd'), 'Ft,Ed = 55.0 kN per bolt');
  ok('T-stub mode 1', parseFloat(val('T-stub')), 4 * 1485 / 40, 0.6);
  ok('mode 1 named', sub('T-stub'), 'mode 1');

  // welded bracket, s 8, L 200, b 150, V 150 at 100
  set('preset', 'bracket', 'change');
  const Ip = 2 * (200 ** 3 / 12 + 200 * 75 ** 2), M = 15000;
  const wx = M * 100 / Ip, wy = 150 / 400 + M * 75 / Ip, th = Math.atan2(wx, wy);
  ok('weld force at the worst point', parseFloat(val('Force at worst point')), Math.hypot(wx, wy), 0.0006);
  const Rd = 410 * 5.6 / (0.85 * 1.25 * Math.sqrt(2 * Math.sin(th) ** 2 + 3 * Math.cos(th) ** 2)) / 1e3;
  ok('directional resistance', parseFloat(val('Resistance')), Rd, 0.0006);

  // base plate, 254 UC on C30, 25 mm plate: fjd = 2/3 x 17
  set('preset', 'base', 'change');
  ok('fjd', parseFloat(val('fjd')), 2 / 3 * 17, 0.006);
  ok('c = 25 sqrt(265 / 3 fjd)', parseFloat(val('c')), 25 * Math.sqrt(265 / (3 * 2 / 3 * 17)), 0.06);
  ok('base passes at 25 mm', val('Verdict'), 'Passes');
  set('code', 'bs', 'change');
  ok('BS bearing 0.6 fcu', parseFloat(val('Bearing w')), 21, 0.006);
};
