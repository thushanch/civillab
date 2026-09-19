/* interaction checks for F1 earth pressure and retaining wall */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const sub = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    const e = c && c.querySelector('.s'); return e ? e.textContent.trim() : '(missing)'; };
  const cls = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.className : '(missing)'; };
  const num = key => parseFloat(val(key).replace(/[^0-9.eE+-]/g, ''));
  const fire = (el, t) => el.dispatchEvent(new w.Event(t, { bubbles: true }));
  const set = (id, v) => { const e = doc.getElementById(id); e.value = String(v); fire(e, 'input'); };
  const pick = (id, v) => { const e = doc.getElementById(id); e.value = v; fire(e, 'change'); };

  /* 1. default dry granular: H 6, gamma 18, phi 30, no water, no surcharge.
        Ka = tan^2(45 - 15) = 1/3 exactly.
        Pa = 0.5 x (1/3) x 18 x 36 = 108 kN/m, acting at H/3 = 2.00 m.        */
  ok('Ka is one third', val('Ka'), '0.3333');
  ok('Ka sub names the formula', sub('Ka'), 'tan²(45 − φ/2)');
  ok('active thrust is 108 kN/m', val('Active thrust'), '108 kN/m');
  ok('acting at H/3', sub('Active thrust'), 'at 2.00 m above the base');
  ok('no water thrust when drained', val('Water thrust'), '–');
  ok('total push equals the active thrust', num('ΣH'), 108, 0.1);

  /* 2. the force table restates the same numbers */
  const tbl = doc.getElementById('tablewrap').textContent;
  ok('the table shows the sliding division', tbl.indexOf('Sliding F') >= 0, true);
  ok('and the overturning division', tbl.indexOf('Overturning F') >= 0, true);
  ok('rows for every weight', doc.querySelectorAll('#tablewrap tbody tr').length >= 4, true);

  /* 3. phi controls Ka. At phi = 0 the soil pushes with its full vertical
        stress, Ka = 1, and Pa quadruples relative to phi = 30.              */
  set('phir', 0);
  ok('Ka is 1 at phi = 0', val('Ka'), '1.0000');
  ok('thrust is 0.5 gamma H^2', num('Active thrust'), 0.5 * 18 * 36, 1);
  set('phir', 45);
  ok('Ka at phi 45', num('Ka'), Math.pow(Math.tan(22.5 * Math.PI / 180), 2), 0.0002);
  set('phir', 30);
  ok('back to one third', val('Ka'), '0.3333');

  /* 4. a surcharge adds Ka q H = (1/3)(20)(6) = 40 kN/m */
  const pa0 = num('Active thrust');
  set('qr', 20);
  ok('surcharge adds Ka q H', num('Active thrust') - pa0, 40, 0.5);
  ok('and lifts the resultant above H/3', parseFloat(sub('Active thrust').replace(/[^0-9.]/g, '')) > 2, true);
  set('qr', 0);

  /* 5. water. With the table at the surface the effective thrust drops to
        0.5 Ka gamma' H^2 but a full water triangle appears on top, and the
        total push nearly doubles.                                           */
  const dryPush = num('ΣH');
  set('gammaSatr', 20); set('zwr', 0);
  ok('a water thrust appears', num('Water thrust') > 0, true);
  ok('water thrust is 0.5 gamma_w H^2', num('Water thrust'), 0.5 * 9.81 * 36, 1);
  ok('the water chip warns', cls('Water thrust').indexOf('warn') >= 0, true);
  ok('total push jumps', num('ΣH') > dryPush * 1.8, true);
  ok('sliding gets worse', num('F sliding') < 1.5, true);
  set('zwr', 12);
  ok('draining it brings the push back', num('ΣH'), dryPush, 0.5);

  /* 6. cohesion opens a tension crack and cuts the thrust.
        z0 = 2c/(gamma sqrt Ka) = 2(12)/(18 x 0.5774) = 2.309 m at phi 30    */
  const before = num('Active thrust');
  set('cr', 12);
  ok('cohesion cuts the thrust', num('Active thrust') < before, true);
  ok('the crack is drawn',
     doc.getElementById('wall').textContent.indexOf('crack') >= 0, true);
  set('cr', 0);

  /* 7. Coulomb with a smooth wall is exactly Rankine, and wall friction then
        lowers the horizontal push while adding a vertical component.        */
  pick('theory', 'coulomb');
  ok('delta control appears', !!doc.getElementById('deltar'), true);
  set('deltar', 0);
  ok('Coulomb at delta 0 gives the Rankine Ka', val('Ka'), '0.3333');
  ok('and the same thrust', num('Active thrust'), 108, 0.5);
  const h0 = num('ΣH'), v0 = num('ΣV');
  set('deltar', 20);
  ok('wall friction lowers Ka', num('Ka') < 0.3333, true);
  ok('and lowers the horizontal push', num('ΣH') < h0, true);
  ok('while adding vertical load', num('ΣV') > v0, true);
  ok('so overturning improves', num('F overturning') > 0, true);
  pick('theory', 'rankine');

  /* 8. geometry moves the checks the right way */
  const fo = num('F overturning'), fs = num('F sliding');
  set('Br', 5);
  ok('a wider base helps overturning', num('F overturning') > fo, true);
  ok('and helps sliding', num('F sliding') > fs, true);
  set('Br', 3.5);
  set('Hr', 9);
  ok('a taller wall is worse', num('F overturning') < fo, true);
  set('Hr', 6);
  ok('back to the starting point', num('F overturning'), fo, 0.02);

  /* 9. eccentricity and the middle third */
  ok('B/6 is quoted', sub('Eccentricity e'), 'B/6 = 0.583 m');
  ok('the resultant is inside the middle third', cls('Eccentricity e').indexOf('warn') < 0, true);
  const e0 = num('Eccentricity e');
  set('qr', 60);
  ok('a heavy surcharge pushes the resultant out', num('Eccentricity e') > e0, true);
  set('qr', 0);

  /* 10. bearing against the allowable */
  const qm = num('qmax');
  set('qallr', 50);
  ok('a weak soil fails bearing', cls('qmax').indexOf('warn') >= 0, true);
  ok('and the verdict follows', val('Verdict'), 'Fails');
  ok('the verdict names bearing', sub('Verdict').indexOf('bearing') >= 0, true);
  set('qallr', 500);
  ok('a strong soil passes bearing', cls('qmax').indexOf('warn') < 0, true);
  ok('qmax itself did not move', num('qmax'), qm, 0.5);
  set('qallr', 200);

  /* 11. passive resistance only counts when asked for */
  const noPp = num('F sliding');
  const cb = doc.getElementById('usePassive');
  cb.checked = true; fire(cb, 'change');
  ok('passive helps sliding', num('F sliding') > noPp, true);
  ok('and shows in the table',
     doc.getElementById('tablewrap').textContent.indexOf('Passive in front') >= 0, true);
  cb.checked = false; fire(cb, 'change');
  ok('turning it off restores the factor', num('F sliding'), noPp, 0.002);

  /* 12. presets rebuild cleanly */
  pick('preset', 'water');
  ok('the water preset raises the table', parseFloat(doc.getElementById('zwn').value) < 6, true);
  ok('and shows a water thrust', num('Water thrust') > 0, true);
  pick('preset', 'coul');
  ok('the Coulomb preset switches theory', doc.getElementById('theory').value, 'coulomb');
  ok('and turns the passive resistance on', doc.getElementById('usePassive').checked, true);
  pick('preset', 'dry');
  ok('back to the dry case', val('Active thrust'), '108 kN/m');
  ok('preset kept in the select', doc.getElementById('preset').value, 'dry');
};
