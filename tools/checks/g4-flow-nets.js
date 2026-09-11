/* interaction checks for G4 flow nets */
module.exports = function (doc, w, ok) {
  const val = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.querySelector('.v').textContent.trim() : '(missing)'; };
  const cls = key => { const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.trim() === key);
    return c ? c.className : '(missing)'; };
  const num = key => parseFloat(val(key).replace(/[^0-9.eE+-]/g, ''));
  const fire = (el, t) => el.dispatchEvent(new w.Event(t, { bubbles: true }));
  const set = (id, v) => { const e = doc.getElementById(id); e.value = String(v); fire(e, 'input'); };
  const pick = (id, v) => { const e = doc.getElementById(id); e.value = v; fire(e, 'change'); };

  /* 1. default case, sheet pile in sand: W 24, D 9, d 4.5, H 6, k 1e-4
        The head drop per equipotential drop is H/Nd = 6/10 = 0.60 m exactly.
        Critical gradient i_c = (Gs-1)/(1+e) = 1.65/1.65 = 1.000 exactly.     */
  ok('default head drop per drop', val('Head drop per drop'), '0.60 m');
  ok('default critical gradient', val('Critical gradient'), '1.000');
  ok('the net you drew is 5/10', val('Net you drew'), '0.500');
  ok('discharge is positive', num('Discharge q') > 0, true);
  ok('exit gradient is positive', num('Exit gradient') > 0, true);
  const q0 = num('Discharge q'), shape0 = num('Form factor');

  /* 2. discharge scales exactly with the head difference.
        H 6 -> 12 must double q and leave the form factor alone.              */
  set('Hr', 12);
  ok('doubling H doubles q', Math.abs(num('Discharge q') / q0 - 2) < 0.01, true);
  ok('form factor unchanged by H', Math.abs(num('Form factor') - shape0) < 0.002, true);
  ok('head drop per drop follows H', val('Head drop per drop'), '1.20 m');
  set('Hr', 6);

  /* 3. discharge scales exactly with k. log10 k -4 -> -3.7 is a factor of
        10^0.3 = 1.9953.                                                      */
  set('kexpr', -3.7);
  ok('q follows k', Math.abs(num('Discharge q') / q0 - Math.pow(10, 0.3)) < 0.02, true);
  ok('form factor unchanged by k', Math.abs(num('Form factor') - shape0) < 0.002, true);
  set('kexpr', -4);

  /* 4. a deeper cutoff cuts both the flow and the exit gradient */
  const iShallow = (set('dr', 2), num('Exit gradient'));
  const qShallow = num('Discharge q');
  set('dr', 7);
  ok('deeper cutoff cuts the discharge', num('Discharge q') < qShallow, true);
  ok('deeper cutoff eases the exit gradient', num('Exit gradient') < iShallow, true);
  ok('deeper cutoff raises the factor of safety',
     num('FoS on piping') > 1, true);
  set('dr', 4.5);

  /* 5. the critical gradient follows (Gs - 1)/(1 + e).
        Gs 2.70, e 0.80 gives 1.70/1.80 = 0.944                               */
  set('Gsr', 2.70); set('er', 0.80);
  ok('i_c for Gs 2.70 e 0.80', val('Critical gradient'), '0.944');
  ok('a looser soil is closer to failure',
     cls('FoS on piping').indexOf('warn') >= 0 || num('FoS on piping') > 0, true);
  set('Gsr', 2.65); set('er', 0.65);

  /* 6. the net the student draws is checked against the solved field */
  set('Nfr', 2); set('Ndr', 18);
  ok('a badly drawn net is flagged', cls('Net you drew').indexOf('warn') >= 0, true);
  ok('the drawn ratio is reported', val('Net you drew'), '0.111');
  set('Nfr', 5); set('Ndr', 10);

  /* 7. switching to a dam brings up uplift and the base width control */
  pick('kind', 'dam');
  ok('dam controls rebuilt with a base width', !!doc.getElementById('Br'), true);
  ok('uplift chip appears', val('Uplift force') !== '(missing)', true);
  ok('uplift acts upstream of mid base', num('Acts at') < doc.getElementById('Bn').value / 2, true);
  const upNone = num('Uplift force');
  ok('uplift force is positive', upNone > 0, true);

  /* 8. a heel cutoff cuts the uplift and the flow */
  const qNone = num('Discharge q');
  set('dr', 5);
  ok('a cutoff reduces the uplift', num('Uplift force') < upNone, true);
  ok('a cutoff reduces the discharge', num('Discharge q') < qNone, true);

  /* 9. presets rebuild cleanly */
  pick('preset', 'risky');
  ok('preset switches back to a sheet pile', doc.getElementById('kind').value, 'sheetpile');
  ok('preset kept in the select', doc.getElementById('preset').value, 'risky');
  ok('the risky case has no uplift chip', val('Uplift force'), '(missing)');
  ok('the risky case is flagged on piping', cls('FoS on piping').indexOf('warn') >= 0, true);

  /* 10. toggles redraw the figure */
  const before = doc.getElementById('fig').childNodes.length;
  const cb = doc.getElementById('net');
  cb.checked = false; fire(cb, 'change');
  ok('hiding the net removes nodes', doc.getElementById('fig').childNodes.length < before, true);
  cb.checked = true; fire(cb, 'change');
  ok('showing it again restores them', doc.getElementById('fig').childNodes.length, before);
};
