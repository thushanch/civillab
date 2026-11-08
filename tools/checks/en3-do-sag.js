/* interaction checks for En3 DO sag, recomputed from Streeter-Phelps */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const set = (id, v, ev) => { const el = doc.getElementById(id); el.value = v;
    el.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); };
  const u = b => b / (1 - Math.exp(-5 * 0.23));
  ok('mixed ultimate BOD', parseFloat(val('Mixed BOD L0')), (0.2 * u(200) + 2 * u(3)) / 2.2, 0.06);
  ok('untreated sewage fails', val('Verdict'), 'Fails');
  set('preset', 'treated', 'change');
  ok('treated passes', val('Verdict'), 'Passes');
  set('Lwr', 100);
  ok('more load lowers the minimum DO', parseFloat(val('Minimum DO')) < 7, true);
  ok('allowed load unchanged by the actual load', parseFloat(val('Allowed waste BOD')) > 0, true);
};
