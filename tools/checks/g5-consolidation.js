/* interaction checks for G5 consolidation */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const sub = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    const e = c && c.querySelector('.s'); return e ? e.textContent.trim() : '(missing)'; };
  const num = key => parseFloat(val(key).replace(/[^0-9.eE+-]/g, ''));
  const fire = (el, t) => el.dispatchEvent(new w.Event(t, { bubbles: true }));
  const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const set = (id, v) => { const e = doc.getElementById(id); e.value = String(v); fire(e, 'input'); };
  const pick = (id, v) => { const e = doc.getElementById(id); e.value = v; fire(e, 'change'); };

  /* 1. default soft clay: H 4, cv 10^-6.5, Δσ 100, two way, Cc 0.30,
        e0 0.90, σ0' 100, σp' 100 so normally consolidated.
        Sc = 4 × 0.30/1.90 × log10(200/100) = 0.63158 × 0.30103 = 0.19013 m
        = 190.1 mm                                                          */
  ok('ultimate settlement', val('Ultimate Sc'), '190.1 mm');
  ok('drainage path is half the layer', val('Drainage path'), '2.00 m');
  ok('T50 quoted on the chip', sub('t₅₀'), 'T₅₀ = 0.197');
  ok('T90 quoted on the chip', sub('t₉₀'), 'T₉₀ = 0.848');

  /* 2. jumping to t50 must put U at 50 per cent and settlement at half Sc */
  click(doc.getElementById('t50'));
  ok('U is 50 % at t50', sub('Settlement now'), 'U = 50.0 %');
  ok('settlement is half the ultimate', num('Settlement now'), 95.1, 0.2);
  // the true series value is 0.19675, which the textbooks round to 0.197
  ok('time factor at t50', val('Time factor T'), '0.1967');

  click(doc.getElementById('t90'));
  ok('U is 90 % at t90', sub('Settlement now'), 'U = 90.0 %');
  ok('settlement is nine tenths of the ultimate', num('Settlement now'), 171.1, 0.3);
  // the true series value is 0.84805, rounded to 0.848 in the textbooks
  ok('time factor at t90', val('Time factor T'), '0.8481');

  /* 3. switching to one way drainage doubles the path and so takes four
        times as long, while the ultimate settlement does not move          */
  const t90two = num('t₉₀');
  const sc = num('Ultimate Sc');
  pick('drainage', 'one');
  ok('drainage path is the whole layer', val('Drainage path'), '4.00 m');
  ok('the ultimate settlement is unchanged', num('Ultimate Sc'), sc, 0.05);
  ok('t90 is four times longer', num('t₉₀') / t90two, 4, 0.02);
  pick('drainage', 'two');

  /* 4. cv changes the rate and nothing else. log cv -6.5 to -6.2 is a
        factor of 10^0.3 = 1.9953, so t90 falls by the same factor          */
  const t90a = num('t₉₀');
  set('cvExpr', -6.2);
  ok('faster cv shortens t90', Math.abs(t90a / num('t₉₀') - Math.pow(10, 0.3)) < 0.03, true);
  ok('ultimate settlement untouched by cv', num('Ultimate Sc'), sc, 0.05);
  set('cvExpr', -6.5);

  /* 5. doubling the layer doubles the settlement and quadruples the time */
  const t90b = num('t₉₀');
  set('Hr', 8);
  ok('double thickness doubles the settlement', num('Ultimate Sc') / sc, 2, 0.02);
  ok('double thickness quadruples t90', num('t₉₀') / t90b, 4, 0.02);
  set('Hr', 4);

  /* 6. load 100 to 400 kPa is exactly twice the settlement of 100 to 200 */
  set('dsr', 300);
  ok('a second doubling adds the same again', num('Ultimate Sc') / sc, 2, 0.02);
  set('dsr', 100);

  /* 7. an overconsolidated clay settles less and is flagged.
        σp' 250 with σ0' 100 and Δσ 100 keeps the load below σp', so the
        whole move is on the recompression line with Cs.
        Sc = 4 × 0.06/1.90 × log10(2) = 0.12632 × 0.30103 = 0.03802 m       */
  set('spr', 250);
  ok('flagged overconsolidated', val('State'), 'Overconsolidated');
  ok('recompression settlement only', num('Ultimate Sc'), 38.0, 0.3);
  ok('much smaller than the normally consolidated case', num('Ultimate Sc') < sc / 3, true);
  set('spr', 100);
  ok('back to normally consolidated', val('State'), '(missing)');
  ok('and back to the original settlement', num('Ultimate Sc'), sc, 0.05);

  /* 8. the mv method, Sc = mv Δσ H = 2e-4 × 100 × 4 = 0.08 m = 80 mm */
  pick('method', 'mv');
  ok('mv control appears', !!doc.getElementById('mvr'), true);
  ok('mv settlement', val('Ultimate Sc'), '80.0 mm');
  ok('sub says which method', sub('Ultimate Sc'), 'mv · Δσ · H');
  pick('method', 'cc');
  ok('back to the compression index', num('Ultimate Sc'), sc, 0.05);

  /* 9. zero load gives no settlement but the clock still runs */
  set('dsr', 0);
  ok('no load, no settlement', val('Ultimate Sc'), '0.0 mm');
  ok('but the time factor is unaffected', num('Time factor T') > 0, true);
  set('dsr', 100);

  /* 10. the play button flips its own label and stops cleanly */
  const b = doc.getElementById('play');
  ok('starts as Play', b.textContent, 'Play');
  click(b);
  ok('flips to Stop', doc.getElementById('play').textContent, 'Stop');
  click(doc.getElementById('play'));
  ok('flips back to Play', doc.getElementById('play').textContent, 'Play');

  /* 11. presets rebuild cleanly */
  pick('preset', 'thick');
  ok('preset switches drainage', doc.getElementById('drainage').value, 'one');
  ok('preset kept in the select', doc.getElementById('preset').value, 'thick');
  ok('thick layer drains one way', val('Drainage path'), '8.00 m');
  pick('preset', 'soft');
  ok('back to the soft clay', num('Ultimate Sc'), sc, 0.05);

  /* 12. the isochrone toggle redraws */
  const before = doc.getElementById('prof').childNodes.length;
  const cb = doc.getElementById('ghosts');
  cb.checked = false; fire(cb, 'change');
  ok('hiding the ghosts removes nodes', doc.getElementById('prof').childNodes.length < before, true);
  cb.checked = true; fire(cb, 'change');
  ok('showing them again restores them', doc.getElementById('prof').childNodes.length, before);
};
