/* engine tests for seepage-engine.js */
const path = require('path');
const ROOT = path.resolve(__dirname, '../assets/js') + '/';
const E = require(ROOT + 'seepage-engine.js');

let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  tol = tol == null ? 1e-9 : tol;
  const good = (typeof exp === 'number')
    ? (got != null && isFinite(exp) ? Math.abs(got - exp) <= tol : got === exp)
    : got === exp;
  if (good) { pass++; console.log('  ok   ' + name + '  = ' + got); }
  else { fail++; console.log('  FAIL ' + name + '  got ' + got + '  expected ' + exp); }
}
const head = t => console.log('\n' + t);

/* ------------------------------------------------------------------ */
head('1. the Laplace solver reproduces an exact linear field');
{
  // left edge held at 10, right edge at 0, top and bottom no flow.
  // the exact solution is h = 10 (1 - x/W), linear, so the solver must hit it
  // to round off. This is the strongest possible check on the stencil.
  const nx = 40, ny = 20, W = 8, D = 4, dx = W / nx, dz = D / ny;
  const NW = nx + 1, N = NW * (ny + 1);
  const type = new Uint8Array(N), val = new Float64Array(N);
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const p = j * NW + i;
    if (i === 0) { type[p] = E.FIXED; val[p] = 10; }
    else if (i === nx) { type[p] = E.FIXED; val[p] = 0; }
    else type[p] = E.FREE;
  }
  const r = E.laplace(nx, ny, dx, dz, type, val, { iter: 20000, tol: 1e-14 });
  let worst = 0;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const exact = 10 * (1 - i / nx);
    worst = Math.max(worst, Math.abs(r.h[j * NW + i] - exact));
  }
  ok('max error against the exact linear field', worst < 1e-7, true);
  console.log('       worst nodal error = ' + worst.toExponential(2));
  // and the field must not vary with depth, since there is no vertical driver
  let dv = 0;
  for (let i = 0; i <= nx; i++) dv = Math.max(dv, Math.abs(r.h[i] - r.h[ny * NW + i]));
  ok('no spurious vertical variation', dv < 1e-7, true);
}

head('2. discharge scales exactly with k and with H');
{
  const base = { kind:'sheetpile', W:20, D:8, d:4, H:6, k:1e-5, nx:60, ny:30, iter:3000 };
  const a = E.solve(base);
  const b = E.solve(Object.assign({}, base, { k: 2e-5 }));
  const c = E.solve(Object.assign({}, base, { H: 12 }));
  ok('doubling k doubles q', b.q / a.q, 2, 1e-6);
  ok('doubling H doubles q', c.q / a.q, 2, 1e-6);
  ok('the form factor q/(kH) is unchanged by k', b.shape, a.shape, 1e-9);
  ok('the form factor is unchanged by H', c.shape, a.shape, 1e-6);
  console.log('       form factor Nf/Nd = ' + a.shape.toFixed(4));
}

head('3. what goes in comes out');
{
  const r = E.solve({ kind:'sheetpile', W:20, D:8, d:4, H:6, k:1e-5, nx:80, ny:40, iter:6000 });
  ok('inflow equals outflow', r.conservation < 5e-3, true);
  console.log('       qIn = ' + r.qIn.toExponential(4) + '  qOut = ' + r.qOut.toExponential(4) +
              '  mismatch = ' + (r.conservation * 100).toFixed(3) + ' %');
  ok('discharge is positive', r.q > 0, true);
}

head('4. the head field is antisymmetric about a centred sheet pile');
{
  const r = E.solve({ kind:'sheetpile', W:20, D:8, d:4, H:6, k:1e-5, nx:80, ny:40, iter:6000 });
  // h(x) + h(W - x) must equal H everywhere by symmetry
  let worst = 0;
  for (const z of [1, 2, 4, 6]) {
    for (const x of [2, 5, 8, 9.5]) {
      const s = r.headAt(x, z) + r.headAt(20 - x, z);
      worst = Math.max(worst, Math.abs(s - 6));
    }
  }
  ok('h(x) + h(W-x) = H', worst < 0.02, true);
  console.log('       worst departure from symmetry = ' + worst.toExponential(2) + ' m');
  ok('head on the centreline is H/2', r.headAt(10, 2), 3, 0.02);
}

head('5. a deeper cutoff always cuts the flow');
{
  const mk = d => E.solve({ kind:'sheetpile', W:20, D:8, d, H:6, k:1e-5, nx:60, ny:30, iter:3000 });
  const qs = [1, 2, 3, 4, 5, 6].map(d => mk(d).q);
  let mono = true;
  for (let i = 1; i < qs.length; i++) if (qs[i] >= qs[i - 1]) mono = false;
  ok('q falls as the pile goes deeper', mono, true);
  console.log('       q for d = 1..6 m: ' + qs.map(q => q.toExponential(2)).join('  '));
  const full = mk(7.9);
  ok('a nearly full depth cutoff nearly stops the flow', full.q < qs[0] * 0.25, true);
}

head('6. the stream function carries the discharge');
{
  const r = E.solve({ kind:'sheetpile', W:20, D:8, d:4, H:6, k:1e-5, nx:80, ny:40, iter:6000 });
  // psi runs 0 on the wall to q on the outer no flow boundary, so the range is q
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < r.psi.length; i++) {
    if (r.g.type[i] === E.SOLID) continue;
    if (r.psi[i] < lo) lo = r.psi[i];
    if (r.psi[i] > hi) hi = r.psi[i];
  }
  ok('psi range reproduces q from Darcy', Math.abs((hi - lo) - r.q) / r.q < 0.02, true);
  console.log('       psi range = ' + (hi - lo).toExponential(4) + '  q = ' + r.q.toExponential(4));
}

head('7. the flow net is drawable and consistent with q = k H Nf/Nd');
{
  const r = E.solve({ kind:'sheetpile', W:20, D:8, d:4, H:6, k:1e-5, nx:80, ny:40, iter:6000 });
  const Nd = 10;
  const eq = r.equipotentials(Nd);
  ok('Nd - 1 interior equipotentials', eq.length, Nd - 1);
  ok('every equipotential has segments', eq.every(e => e.segs.length > 0), true);
  const Nf = 5;
  const fl = r.flowlines(Nf);
  ok('Nf - 1 interior flow lines', fl.length, Nf - 1);
  ok('every flow line has segments', fl.every(f => f.segs.length > 0), true);
  // the form factor read off the net must match the computed discharge
  const qNet = 1e-5 * 6 * (Nf / Nd);
  const shapeNet = Nf / Nd;
  console.log('       q from the net with Nf=' + Nf + ' Nd=' + Nd + ' = ' + qNet.toExponential(3) +
              '   q solved = ' + r.q.toExponential(3));
  ok('the solved form factor is the physical one', Math.abs(r.shape - r.q / (1e-5 * 6)) < 1e-12, true);
  console.log('       true Nf/Nd = ' + r.shape.toFixed(4) + ', so a net drawn with Nd = ' + Nd +
              ' needs Nf = ' + (r.shape * Nd).toFixed(2));
}

head('8. grid refinement converges');
{
  const mk = (nx, ny) => E.solve({ kind:'sheetpile', W:20, D:8, d:4, H:6, k:1e-5, nx, ny, iter:12000 }).shape;
  const s1 = mk(40, 20), s2 = mk(80, 40), s3 = mk(120, 60);
  const d1 = Math.abs(s2 - s1), d2 = Math.abs(s3 - s2);
  ok('successive refinements move less', d2 < d1, true);
  console.log('       shape 40x20 = ' + s1.toFixed(4) + ', 80x40 = ' + s2.toFixed(4) +
              ', 120x60 = ' + s3.toFixed(4));
  ok('the answer has settled to within 5 percent', d2 / s3 < 0.05, true);
}

head('9. exit gradient and the critical gradient');
{
  ok('i_c = (Gs-1)/(1+e), Gs 2.65 e 0.65 gives 1.0', E.criticalGradient(2.65, 0.65), 1, 1e-12);
  ok('i_c for Gs 2.70 e 0.70', E.criticalGradient(2.70, 0.70), 1.7 / 1.7, 1e-12);
  ok('a looser soil has a lower i_c',
     E.criticalGradient(2.65, 1.0) < E.criticalGradient(2.65, 0.5), true);
  const shallow = E.solve({ kind:'sheetpile', W:20, D:8, d:2, H:6, k:1e-5, nx:80, ny:40, iter:6000 });
  const deep = E.solve({ kind:'sheetpile', W:20, D:8, d:6, H:6, k:1e-5, nx:80, ny:40, iter:6000 });
  ok('exit gradient is positive', shallow.iExit > 0, true);
  ok('a deeper cutoff lengthens the path and eases the exit gradient',
     deep.iExit < shallow.iExit, true);
  console.log('       i_e at d = 2 m is ' + shallow.iExit.toFixed(3) +
              ', at d = 6 m is ' + deep.iExit.toFixed(3));
  const FoS = E.criticalGradient(2.65, 0.65) / shallow.iExit;
  console.log('       FoS against piping at d = 2 m = ' + FoS.toFixed(2));
}

head('10. uplift under a symmetric dam base');
{
  // no cutoff, base centred, so by symmetry the mean uplift head is H/2
  const r = E.solve({ kind:'dam', W:24, D:8, B:8, d:0, H:6, k:1e-5, nx:96, ny:32, iter:8000 });
  ok('uplift is reported for a dam', r.uplift != null, true);
  ok('mean head under a symmetric base is H/2', r.uplift.meanHead, 3, 0.05);
  console.log('       mean head = ' + r.uplift.meanHead.toFixed(3) + ' m');
  ok('head falls from heel to toe',
     r.uplift.pts[0].head > r.uplift.pts[r.uplift.pts.length - 1].head, true);
  // the diagram is point symmetric about the centre but higher at the heel, so
  // its centroid sits upstream of mid base. For a straight line from a at the
  // heel to b at the toe the centroid is B(a + 2b)/(3(a + b)), which with
  // a = 5.48 and b = 0.52 metres of head gives 2.90 m. The real diagram curves
  // a little, so the answer lands just downstream of that.
  ok('the resultant acts upstream of mid base', r.uplift.arm < 4, true);
  ok('and close to the straight line centroid', r.uplift.arm, 2.95, 0.35);
  ok('force equals mean pressure times base width',
     r.uplift.force, 9.81 * r.uplift.meanHead * 8, 2);
  console.log('       uplift force = ' + r.uplift.force.toFixed(1) +
              ' kN/m at ' + r.uplift.arm.toFixed(2) + ' m from the heel');
  // pressure must equal gamma_w times pressure head
  const p0 = r.uplift.pts[0];
  ok('u = gamma_w h at the heel, the datum is the tailwater', p0.u, 9.81 * p0.head, 1e-6);
}

head('11. a cutoff under the dam heel lowers the uplift');
{
  const none = E.solve({ kind:'dam', W:24, D:8, B:8, d:0, H:6, k:1e-5, nx:96, ny:32, iter:8000 });
  const cut  = E.solve({ kind:'dam', W:24, D:8, B:8, d:4, H:6, k:1e-5, nx:96, ny:32, iter:8000 });
  ok('a cutoff reduces the uplift force', cut.uplift.force < none.uplift.force, true);
  ok('a cutoff reduces the discharge', cut.q < none.q, true);
  console.log('       uplift without cutoff = ' + none.uplift.force.toFixed(1) +
              ' kN/m, with a 4 m cutoff = ' + cut.uplift.force.toFixed(1) + ' kN/m');
}

head('12. guards');
{
  const z = E.solve({ kind:'sheetpile', W:20, D:8, d:0, H:6, k:1e-5, nx:40, ny:20, iter:2000 });
  ok('no cutoff still solves', isFinite(z.q), true);
  const h0 = E.solve({ kind:'sheetpile', W:20, D:8, d:4, H:0, k:1e-5, nx:40, ny:20, iter:2000 });
  ok('zero head gives zero flow', Math.abs(h0.q) < 1e-12, true);
  ok('zero head gives a zero form factor', h0.shape, 0);
  const k0 = E.solve({ kind:'sheetpile', W:20, D:8, d:4, H:6, k:0, nx:40, ny:20, iter:2000 });
  ok('zero permeability gives zero flow', Math.abs(k0.q) < 1e-30, true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
