/* CivilLab · DesignKit
   Shared figure pieces for the design apps, so every code check looks the same.
     bars   one utilisation bar per check, the governing one highlighted
     chain  a design strength drawn as its chain of multipliers
     trail  the full substitution, hidden in an expandable list
   util is always demand over resistance, so 1.0 is the limit.
   Needs ui.js for UI.s and UI.fmt. Pure drawing, holds no state. */
const DesignKit = (() => {
  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F', load:'#B03A2E',
              muted:'#5C6A72', hair:'#DFE3DC', contour:'#C9CEC7', faint:'#F2F4F0' };

  const s = (...a) => UI.s(...a);
  const fmt = (v, d) => UI.fmt(v, d);

  function txt(x, y, str, o = {}) {
    const a = { x, y, 'font-size': o.fs || 12, fill: o.fill || C.muted,
      'text-anchor': o.an || 'start', 'font-weight': o.fw || 400 };
    if (o.halo) { a['paint-order'] = 'stroke'; a.stroke = '#fff';
      a['stroke-width'] = o.halo; a['stroke-linejoin'] = 'round'; }
    if (o.head) a['font-family'] = 'Poppins, Inter, sans-serif';
    return s('text', a, str);
  }

  /* index of the worst check, ignoring any without a finite utilisation */
  function governing(items) {
    let g = -1, worst = -Infinity;
    items.forEach((it, i) => { if (isFinite(it.util) && it.util > worst) { worst = it.util; g = i; } });
    return g;
  }

  /* opts { x, y, w, title, gap = 44, max = 1.25 }
     items [{ name, util, clause, note }] */
  function bars(svg, opts, items) {
    const x = opts.x, w = opts.w, gap = opts.gap || 44, max = opts.max || 1.25;
    let y = opts.y;
    const g = governing(items);
    if (opts.title) {
      svg.appendChild(txt(x, y, opts.title, { fs: 13, fw: 600, fill: C.ocean, head: true }));
      y += 22;
    }
    const BW = w - 54, BH = 14;
    items.forEach((it, i) => {
      const gov = i === g, u = isFinite(it.util) ? Math.max(0, it.util) : max;
      const pass = u <= 1 + 1e-9;
      const col = pass ? C.green : C.load;
      svg.appendChild(txt(x, y, it.name,
        { fs: 11.5, fw: gov ? 600 : 500, fill: gov ? C.ocean : C.muted }));
      if (it.clause) svg.appendChild(txt(x + BW, y, it.clause, { fs: 9.5, an: 'end', fill: '#8A969D' }));
      const by = y + 5;
      svg.appendChild(s('rect', { x, y: by, width: BW, height: BH, rx: 4,
        fill: gov ? '#fff' : C.faint, stroke: gov ? C.ocean : C.hair, 'stroke-width': gov ? 1.4 : 1 }));
      const fw = Math.min(u, max) / max * BW;
      if (fw > 0.5) svg.appendChild(s('rect', { x, y: by, width: fw, height: BH, rx: 4,
        fill: col, 'fill-opacity': gov ? .55 : .25, stroke: col, 'stroke-width': gov ? 1.4 : .8 }));
      const lx = x + BW / max;
      svg.appendChild(s('line', { x1: lx, y1: by - 3, x2: lx, y2: by + BH + 3,
        stroke: C.ocean, 'stroke-width': 1.2, 'stroke-dasharray': '3 2' }));
      svg.appendChild(txt(x + BW + 6, by + BH - 2.5,
        isFinite(it.util) ? fmt(it.util * 100, 0) + '%' : '>' + fmt(max * 100, 0) + '%',
        { fs: 12, fw: 600, fill: col, head: gov }));
      if (it.note) svg.appendChild(txt(x, by + BH + 12, it.note, { fs: 9.5, fill: '#8A969D' }));
      if (gov) svg.appendChild(txt(x + BW + 6, y, 'governs', { fs: 9, fw: 600, fill: C.ocean }));
      y += gap;
    });
    return { gov: g, bottom: y };
  }

  /* opts { x, y, w, h = 42, title, clause }
     boxes [{ op, sym, val }]; op is drawn in the gap before the box,
     and the last box is the design value so it is outlined in ocean */
  function chain(svg, opts, boxes) {
    const x = opts.x, w = opts.w, h = opts.h || 42, n = boxes.length;
    let y = opts.y;
    if (opts.title) { svg.appendChild(txt(x, y, opts.title, { fs: 11.5, fw: 600, fill: C.ocean })); y += 8; }
    const OP = 16, bw = (w - OP * (n - 1)) / n;
    boxes.forEach((b, i) => {
      const bx = x + i * (bw + OP), last = i === n - 1;
      if (i > 0) svg.appendChild(txt(bx - OP / 2, y + h / 2 + 5, b.op || '×',
        { fs: 15, fw: 600, an: 'middle', fill: C.ocean }));
      svg.appendChild(s('rect', { x: bx, y, width: bw, height: h, rx: 6,
        fill: last ? '#fff' : C.faint, stroke: last ? C.ocean : C.hair, 'stroke-width': last ? 1.6 : 1 }));
      svg.appendChild(txt(bx + bw / 2, y + 15, b.sym, { fs: 10.5, an: 'middle', fill: C.muted }));
      svg.appendChild(txt(bx + bw / 2, y + h - 9, b.val,
        { fs: last ? 13 : 12, an: 'middle', fw: 600, fill: last ? C.ocean : '#1C2A33', head: last }));
    });
    if (opts.clause) svg.appendChild(txt(x + w, y + h + 12, opts.clause, { fs: 9.5, an: 'end', fill: '#8A969D' }));
    return y + h + (opts.clause ? 16 : 4);
  }

  /* fills a <details> element; its open state lives on the element, so a
     re-render keeps it open if the student opened it */
  function trail(el, title, steps) {
    if (!el) return;
    el.innerHTML = `<summary>${title}</summary><ol style="margin:8px 0 4px;padding-left:20px;font-size:13.5px">` +
      steps.map(st => `<li style="margin:4px 0">${st.t}` +
        (st.c ? ` <span style="color:#8A969D;font-size:11.5px;white-space:nowrap">${st.c}</span>` : '') +
        '</li>').join('') + '</ol>';
  }

  /* verdict line for a results chip: [value, sub, cls] */
  function verdict(items) {
    const g = governing(items);
    if (g < 0) return ['–', '', ''];
    const u = items[g].util, pass = u <= 1 + 1e-9;
    return [pass ? 'Passes' : 'Fails', `${items[g].name} at ${fmt(u * 100, 0)}%`, pass ? 'ok' : 'warn'];
  }

  return { bars, chain, trail, governing, verdict, C };
})();
if (typeof module !== 'undefined') module.exports = DesignKit;
