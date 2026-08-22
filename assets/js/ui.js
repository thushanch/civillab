/* CivilLab · ui.js — tiny shared helpers */
const UI = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  // create an SVG element with attributes and children
  function s(tag, attrs = {}, ...kids) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    for (const c of kids) {
      if (c == null) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  // number formatting that never prints "-0.0"
  function fmt(v, d = 1) {
    if (!isFinite(v)) return '–';
    const n = +(+v).toFixed(d);
    return (Object.is(n, -0) ? 0 : n).toFixed(d);
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const snap = (v, st) => Math.round(v / st) * st;

  return { s, fmt, clamp, snap, NS };
})();
if (typeof module !== 'undefined') module.exports = UI;
