/* CivilLab · soil-class-engine.js
   Particle size distribution and the Unified Soil Classification System.

   Units and conventions
   - sieve aperture d in mm, percent passing P in percent of total dry mass, 0 to 100
   - percent passing is a non decreasing function of d
   - size boundaries, ASTM D2487: cobbles above 75 mm, gravel 75 to 4.75 mm,
     sand 4.75 to 0.075 mm, fines below 0.075 mm
   - grain diameters are read off the curve by linear interpolation in log d
   - Cu = D60/D10 and Cc = D30^2/(D10 D60), both null when D10 cannot be read,
     which happens whenever more than 10 percent passes the 75 micron sieve
   - Atterberg limits LL and PL in percent, plasticity index PI = LL - PL
   - Casagrande A line PI = 0.73(LL - 20), U line PI = 0.9(LL - 8)
   - a point on the A line counts as above it, which is the ASTM rule
   - soils are assumed inorganic, so the organic groups OL, OH and Pt are
     never returned. Organic content has to be judged in the laboratory.
*/
const SoilClassEngine = (() => {

  /* standard sieve stack, aperture in mm, coarsest first */
  const STACK = [
    { d: 75,    tag: '75 mm' },
    { d: 37.5,  tag: '37.5 mm' },
    { d: 19,    tag: '19 mm' },
    { d: 9.5,   tag: '9.5 mm' },
    { d: 4.75,  tag: '4.75 mm · No.4' },
    { d: 2.36,  tag: '2.36 mm · No.8' },
    { d: 1.18,  tag: '1.18 mm · No.16' },
    { d: 0.6,   tag: '600 µm · No.30' },
    { d: 0.3,   tag: '300 µm · No.50' },
    { d: 0.15,  tag: '150 µm · No.100' },
    { d: 0.075, tag: '75 µm · No.200' }
  ];

  const GRAVEL_SAND = 4.75;   // mm
  const SAND_FINES  = 0.075;  // mm
  const COBBLE      = 75;     // mm

  const NAME = {
    GW: 'Well-graded gravel',      GP: 'Poorly graded gravel',
    GM: 'Silty gravel',            GC: 'Clayey gravel',
    'GC-GM': 'Silty, clayey gravel',
    'GW-GM': 'Well-graded gravel with silt',
    'GW-GC': 'Well-graded gravel with clay',
    'GP-GM': 'Poorly graded gravel with silt',
    'GP-GC': 'Poorly graded gravel with clay',
    SW: 'Well-graded sand',        SP: 'Poorly graded sand',
    SM: 'Silty sand',              SC: 'Clayey sand',
    'SC-SM': 'Silty, clayey sand',
    'SW-SM': 'Well-graded sand with silt',
    'SW-SC': 'Well-graded sand with clay',
    'SP-SM': 'Poorly graded sand with silt',
    'SP-SC': 'Poorly graded sand with clay',
    CL: 'Lean clay',   CH: 'Fat clay',
    ML: 'Silt',        MH: 'Elastic silt',
    'CL-ML': 'Silty clay'
  };

  const L10 = x => Math.log(x) / Math.LN10;

  /* ---------- grading curve ---------- */

  // sort ascending in d, clamp to 0..100, force non decreasing
  function prep(points) {
    const p = (points || [])
      .filter(q => q && isFinite(q.d) && q.d > 0 && isFinite(q.pass))
      .map(q => ({ d: +q.d, pass: Math.min(100, Math.max(0, +q.pass)) }))
      .sort((a, b) => a.d - b.d);
    let monotonic = true, run = -Infinity;
    for (const q of p) {
      if (q.pass < run - 1e-9) { monotonic = false; q.pass = run; }
      else run = q.pass;
    }
    return { pts: p, monotonic };
  }

  // percent passing at any aperture, flat outside the measured range
  function passAt(pts, d) {
    if (!pts.length) return NaN;
    if (d <= pts[0].d) return pts[0].pass;
    const last = pts[pts.length - 1];
    if (d >= last.d) return last.pass;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (d <= b.d) {
        const t = (L10(d) - L10(a.d)) / (L10(b.d) - L10(a.d));
        return a.pass + t * (b.pass - a.pass);
      }
    }
    return last.pass;
  }

  // aperture at a given percent passing, null when it falls outside the sieve range
  function dAt(pts, P) {
    if (!pts.length) return null;
    if (P < pts[0].pass - 1e-9) return null;
    if (P > pts[pts.length - 1].pass + 1e-9) return null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (P >= a.pass - 1e-9 && P <= b.pass + 1e-9) {
        const dp = b.pass - a.pass;
        if (Math.abs(dp) < 1e-9) return Math.sqrt(a.d * b.d);  // flat step
        const t = (P - a.pass) / dp;
        return Math.pow(10, L10(a.d) + t * (L10(b.d) - L10(a.d)));
      }
    }
    return null;
  }

  function grading(points) {
    const { pts, monotonic } = prep(points);
    const D10 = dAt(pts, 10), D30 = dAt(pts, 30), D60 = dAt(pts, 60);
    const Cu = (D10 && D60) ? D60 / D10 : null;
    const Cc = (D10 && D30 && D60) ? (D30 * D30) / (D10 * D60) : null;
    const pTop = passAt(pts, COBBLE);
    const p475 = passAt(pts, GRAVEL_SAND);
    const p075 = passAt(pts, SAND_FINES);
    const cobbles = Math.max(0, 100 - pTop);
    const gravel  = Math.max(0, pTop - p475);
    const sand    = Math.max(0, p475 - p075);
    const fines   = Math.max(0, p075);
    return {
      pts, monotonic, D10, D30, D60, Cu, Cc,
      cobbles, gravel, sand, fines,
      passAt: d => passAt(pts, d),
      dAt: P => dAt(pts, P)
    };
  }

  /* ---------- Atterberg limits and the plasticity chart ---------- */

  const aLine = LL => 0.73 * (LL - 20);
  const uLine = LL => 0.9 * (LL - 8);

  function atterberg(LL, PL) {
    LL = Math.max(0, +LL || 0);
    PL = Math.max(0, +PL || 0);
    const valid = PL <= LL + 1e-9;
    const PI = Math.max(0, LL - PL);
    const A = aLine(LL), U = uLine(LL);
    const above = PI >= A;                 // on or above the A line
    const aboveU = PI > U + 1e-9;          // physically improbable, flag it
    let fine;
    if (LL >= 50)      fine = above ? 'CH' : 'MH';
    else if (PI < 4)   fine = 'ML';
    else if (PI > 7)   fine = above ? 'CL' : 'ML';
    else               fine = above ? 'CL-ML' : 'ML';
    return { LL, PL, PI, A, U, above, aboveU, valid, fine, highPlast: LL >= 50 };
  }

  /* ---------- USCS group symbol and name ---------- */

  function lower(str) { return str.charAt(0).toLowerCase() + str.slice(1); }

  function classify(points, LL, PL) {
    const g = grading(points);
    const at = atterberg(LL, PL);
    const steps = [];
    const notes = [];
    if (!g.monotonic) notes.push('Percent passing was not decreasing with sieve size, the curve has been forced monotonic.');
    if (g.cobbles > 0.05) notes.push('Part of the sample is coarser than 75 mm, so it is cobbles. The group symbol only describes the fraction passing 75 mm, but the percentages here are of the whole sample.');
    if (!at.valid) notes.push('Plastic limit is above the liquid limit, PI has been held at zero.');
    if (at.aboveU) notes.push('The sample plots above the U line, which almost never happens. Recheck the limits.');

    let symbol, name, group;

    // nothing passes the 75 mm sieve, so there is no soil left to classify
    if (g.gravel + g.sand + g.fines < 1e-6) {
      steps.push('Nothing passes the 75 mm sieve, so the sample is all cobbles or boulders.');
      steps.push('The Unified system classifies the fraction passing 75 mm, and here there is none.');
      return { g, at, symbol: '—', name: 'Cobbles or boulders, no soil fraction to classify',
               group: 'oversize', steps, notes, gradationKnown: false };
    }

    if (g.fines >= 50) {
      group = 'fine';
      steps.push(`${g.fines.toFixed(0)} % passes 75 µm, so 50 % or more is fines. The soil is fine grained.`);
      steps.push(`LL = ${at.LL.toFixed(0)}, PL = ${at.PL.toFixed(0)}, so PI = ${at.PI.toFixed(0)}.`);
      steps.push(`A line at this LL is PI = 0.73(${at.LL.toFixed(0)} − 20) = ${at.A.toFixed(1)}, the sample plots ${at.above ? 'on or above' : 'below'} it.`);
      symbol = at.fine;
      name = NAME[symbol];
      const coarse = g.gravel + g.sand;
      if (coarse >= 30) {
        name = (g.sand >= g.gravel ? 'Sandy ' : 'Gravelly ') + lower(name);
        steps.push(`Coarse fraction is ${coarse.toFixed(0)} %, 30 % or more, so the name takes ${g.sand >= g.gravel ? 'Sandy' : 'Gravelly'}.`);
      } else if (coarse >= 15) {
        name += (g.sand >= g.gravel ? ' with sand' : ' with gravel');
        steps.push(`Coarse fraction is ${coarse.toFixed(0)} %, between 15 and 30 %, so the name takes "with ${g.sand >= g.gravel ? 'sand' : 'gravel'}".`);
      }
      return { g, at, symbol, name, group, steps, notes, gradationKnown: g.Cu != null };
    }

    group = 'coarse';
    const isG = g.gravel > g.sand;
    const P = isG ? 'G' : 'S';
    steps.push(`${g.fines.toFixed(0)} % passes 75 µm, less than 50 %, so the soil is coarse grained.`);
    steps.push(`Gravel ${g.gravel.toFixed(0)} % against sand ${g.sand.toFixed(0)} %, so the first letter is ${P}.`);

    const cuLimit = isG ? 4 : 6;
    const gradationKnown = g.Cu != null && g.Cc != null;
    const wellGraded = gradationKnown && g.Cu >= cuLimit && g.Cc >= 1 && g.Cc <= 3;
    const grad = wellGraded ? 'W' : 'P';
    if (!gradationKnown) {
      notes.push('D10 falls below the 75 µm sieve, so Cu and Cc cannot be read. A hydrometer test would be needed, and the gradation letter is taken as P here.');
    }

    const finesLetter = (at.fine === 'ML' || at.fine === 'MH') ? 'M'
                      : (at.fine === 'CL-ML' ? 'CM' : 'C');

    if (g.fines < 5) {
      symbol = P + grad;
      steps.push(`Fines are under 5 %, so the soil is clean and the second letter comes from the shape of the curve.`);
      if (gradationKnown)
        steps.push(`Cu = ${g.Cu.toFixed(1)} and Cc = ${g.Cc.toFixed(2)}, ${wellGraded ? 'both inside' : 'not both inside'} the well graded limits Cu ≥ ${cuLimit} and 1 ≤ Cc ≤ 3.`);
    } else if (g.fines > 12) {
      symbol = finesLetter === 'CM' ? `${P}C-${P}M` : P + finesLetter;
      steps.push(`Fines are over 12 %, so the second letter comes from the plasticity chart, where the fines plot as ${at.fine}.`);
    } else {
      const second = finesLetter === 'M' ? 'M' : 'C';
      symbol = `${P}${grad}-${P}${second}`;
      steps.push(`Fines are between 5 and 12 %, so a dual symbol is used, gradation first and fines second.`);
      if (gradationKnown)
        steps.push(`Cu = ${g.Cu.toFixed(1)} and Cc = ${g.Cc.toFixed(2)} give ${grad}, and the fines plot as ${at.fine} giving ${second}.`);
    }

    name = NAME[symbol] || symbol;
    const other = isG ? g.sand : g.gravel;
    if (other >= 15) {
      const word = isG ? 'sand' : 'gravel';
      name += (name.indexOf(' with ') >= 0 ? ' and ' : ' with ') + word;
      steps.push(`The other coarse fraction is ${other.toFixed(0)} %, 15 % or more, so the name records the ${word}.`);
    }

    return { g, at, symbol, name, group, steps, notes, gradationKnown };
  }

  return {
    STACK, NAME, GRAVEL_SAND, SAND_FINES, COBBLE,
    grading, atterberg, classify, aLine, uLine, passAt, dAt
  };
})();
if (typeof module !== 'undefined') module.exports = SoilClassEngine;
