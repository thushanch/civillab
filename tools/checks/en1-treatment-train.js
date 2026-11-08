/* interaction checks for En1 water treatment train */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };

  // 50 NTU through the full train: 50 x 0.15 x 0.10 = 0.75 NTU, 1 + 2 + 4 = 7 log
  ok('turbidity out', parseFloat(val('Turbidity out')), 0.75, 0.006);
  ok('log removal', parseFloat(val('Log removal')), 7, 0.06);
  ok('safe', val('Verdict'), 'Safe');

  // click the settling tank off: direct filtration of 50 NTU overloads the bed
  doc.querySelector('#fig [data-id="sed"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('overloaded filter leaves 15 NTU', parseFloat(val('Turbidity out')), 15, 0.06);
  ok('unsafe', val('Verdict'), 'Unsafe');
  ok('the checkbox follows the figure', doc.querySelector('[data-u="sed"]').checked, false);

  set('preset', 'nocoag', 'change');   // 50 x 0.6 x 0.5 = 15 NTU, chlorine only 1 log
  ok('no coagulant, 15 NTU', parseFloat(val('Turbidity out')), 15, 0.06);
  ok('0.3 + 0.5 + 1 log', parseFloat(val('Log removal')), 1.8, 0.06);

  set('preset', 'lake', 'change');      // 8 NTU filtered directly to 0.8, full kill
  ok('reservoir filters to 0.8 NTU', parseFloat(val('Turbidity out')), 0.8, 0.006);
  ok('reservoir water safe', val('Verdict'), 'Safe');

  set('preset', 'river', 'change');
  set('turbr', 100);                    // 100 x 0.015 = 1.5 NTU reaches the chlorine
  ok('1.5 NTU before chlorine', parseFloat(val('Before chlorine')), 1.5, 0.006);
  ok('so only 1 + 2 + 2 log', parseFloat(val('Log removal')), 5, 0.06);
};
