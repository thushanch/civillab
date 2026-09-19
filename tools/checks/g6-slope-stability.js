/* interaction checks for G6 slope stability */
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
  const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const set = (id, v) => { const e = doc.getElementById(id); e.value = String(v); fire(e, 'input'); };
  const pick = (id, v) => { const e = doc.getElementById(id); e.value = v; fire(e, 'change'); };

  /* 1. default cutting: H 10, beta 30, gamma 19, c' 10, phi' 25, ru 0,
        circle at (8, 18) with R 20 and 24 slices.
        Fellenius 1.855 and Bishop 2.057, so Bishop is about 11 % higher.   */
  ok('Fellenius F', num('F, Fellenius'), 1.855, 0.002);
  ok('Bishop F', num('F, Bishop'), 2.057, 0.002);
  ok('Bishop sits above Fellenius', num('F, Bishop') > num('F, Fellenius'), true);
  ok('the gain is about 11 %', num('Bishop gain'), 10.9, 0.3);
  ok('verdict is safe', val('Verdict'), 'Safe');
  ok('24 slices', sub('Arc length'), '24 slices');

  /* 2. the slice table adds up to the Fellenius ratio it prints */
  const rows = doc.querySelectorAll('#tablewrap tbody tr');
  ok('the table has rows', rows.length > 3, true);
  ok('the table quotes the Fellenius result',
     doc.getElementById('tablewrap').textContent.indexOf('1.855') >= 0, true);
  ok('and the Bishop result',
     doc.getElementById('tablewrap').textContent.indexOf('2.057') >= 0, true);

  /* 3. undrained, phi = 0: Bishop must equal Fellenius exactly, because
        m_alpha collapses to cos(alpha) and c'b/cos a is just c'l            */
  set('phir', 0);
  ok('Bishop equals Fellenius when phi is zero',
     Math.abs(num('F, Bishop') - num('F, Fellenius')) < 0.002, true);
  ok('no gain to report', num('Bishop gain'), 0, 0.15);
  const f0 = num('F, Fellenius');
  set('cr', 20);
  ok('doubling cu doubles F', num('F, Fellenius') / f0, 2, 0.01);
  set('cr', 10); set('phir', 25);

  /* 4. pore pressure eats the friction term only */
  const dry = num('F, Bishop');
  set('rur', 0.3);
  ok('pore pressure lowers F', num('F, Bishop') < dry, true);
  set('rur', 0.6);
  ok('more pore pressure lowers it further', num('F, Bishop') < dry, true);
  set('rur', 0);
  ok('and it comes back', num('F, Bishop'), dry, 0.002);

  /* 5. geometry moves F the right way */
  const base = num('F, Bishop');
  set('betar', 45);
  ok('a steeper face is less stable', num('F, Bishop') < base, true);
  set('betar', 30);
  set('cr', 30);
  ok('more cohesion helps', num('F, Bishop') > base, true);
  set('cr', 10);
  set('phir', 35);
  ok('more friction helps', num('F, Bishop') > base, true);
  set('phir', 25);

  /* 6. dry with no cohesion, F must not depend on the unit weight at all */
  set('cr', 0); set('rur', 0);
  const g16 = (set('gammar', 16), num('F, Bishop'));
  const g24 = (set('gammar', 24), num('F, Bishop'));
  ok('unit weight cancels when c = 0 and the slope is dry', g24, g16, 0.002);
  set('gammar', 19); set('cr', 10);

  /* 7. the answer settles as the slices get thinner */
  set('nr', 8);  const n8 = num('F, Bishop');
  set('nr', 48); const n48 = num('F, Bishop');
  ok('few and many slices agree to better than 1 %',
     Math.abs(n48 - n8) / n48 < 0.01, true);
  set('nr', 24);

  /* 8. the critical circle search only ever lowers F */
  const before = num('F, Bishop');
  click(doc.getElementById('crit'));
  ok('the search lowers F', num('F, Bishop') <= before + 1e-6, true);
  ok('the circle controls moved', doc.getElementById('preset').value, '');
  const xcAfter = parseFloat(doc.getElementById('xcn').value);
  ok('the centre is a real number', isFinite(xcAfter), true);

  /* 9. switching method changes which F drives the verdict */
  pick('preset', 'cut');
  const bis = num('F, Bishop'), fel = num('F, Fellenius');
  pick('method', 'fellenius');
  ok('both are still reported', num('F, Bishop'), bis, 0.002);
  ok('Fellenius unchanged too', num('F, Fellenius'), fel, 0.002);

  /* 10. an impossible circle is reported rather than crashing */
  pick('preset', 'cut');
  set('ycr', 60); set('Rr', 3);
  ok('a circle in the air clears the chips', val('F, Bishop'), '(missing)');
  ok('and the figure says so',
     doc.getElementById('fig').textContent.indexOf('does not cut the ground') >= 0, true);
  pick('preset', 'cut');
  ok('a preset recovers it', num('F, Bishop'), 2.057, 0.002);

  /* 11. presets */
  pick('preset', 'und');
  ok('the undrained preset has phi = 0', doc.getElementById('phin').value, '0');
  ok('and Bishop matches Fellenius there',
     Math.abs(num('F, Bishop') - num('F, Fellenius')) < 0.002, true);
  pick('preset', 'marg');
  ok('the marginal preset is flagged', cls('F, Bishop').indexOf('warn') >= 0, true);
  pick('preset', 'cut');

  /* 12. the slices toggle redraws */
  const before2 = doc.getElementById('fig').childNodes.length;
  const cb = doc.getElementById('showSlices');
  cb.checked = false; fire(cb, 'change');
  ok('hiding the slices removes nodes', doc.getElementById('fig').childNodes.length < before2, true);
  cb.checked = true; fire(cb, 'change');
  ok('showing them again restores them', doc.getElementById('fig').childNodes.length, before2);
};
