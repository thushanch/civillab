# CivilLab — build brief

Paste this file into the project root as `CLAUDE.md`, next to `index.html`.
Claude Code reads it automatically at the start of every session.

You are continuing **CivilLab**, an interactive civil engineering simulator
suite by Thushan Chamika, built on the University of Moratuwa Civil
Engineering Student Handbook 2022. Companion suite to Water Lab.

16 of 37 apps are live. Your job is to build the next app to exactly the
same standard, or fix an existing one. Read this whole file before writing
any code.

---

## 1. How to run and check

No build step, no server, no dependencies. Open `index.html` in a browser.
Everything must keep working from `file://` with no network. There are now
zero external references: Poppins and Inter are self hosted as woff2
subsets in `assets/fonts` and declared by `@font-face` at the top of
`civillab.css`. Never reintroduce a Google Fonts link.

Verification is mandatory and has three levels. Do all three for every app.

```bash
# 1. syntax
node --check assets/js/<engine>.js
node --check apps/<app>/app.js

# 2. engine physics (write this file yourself, see section 6)
node /tmp/test_<engine>.js

# 3. headless UI, needs jsdom once per session
mkdir -p /tmp/h && cd /tmp/h && npm init -y && npm i jsdom --no-audit --no-fund
node /tmp/h/smoke.js          # harness template in section 7
```

Definition of done for a new app:

- engine tests pass, with textbook values quoted back to the user
- `node --check` clean
- headless run: zero page errors, figure svg has children, chips render,
  and at least two simulated interactions produce hand-checked numbers
- landing page updated (new card, pipeline chip removed, count bumped)
- full regression: all apps still pass the headless check

---

## 2. Current state

```
civillab/
├── index.html                  landing page, 16 live cards + pipeline chips
├── README.md
├── PLAN.md                     full prose roadmap for all 37 apps
├── assets/
│   ├── css/civillab.css        the ONLY stylesheet, all shared classes
│   ├── img/                    markB.png, wm_horizontal_dark.png, _white.png
│   ├── fonts/                  self hosted Poppins + Inter woff2, OFL.txt
│   └── js/
│       ├── ui.js               UI.s / UI.fmt / UI.clamp / UI.snap
│       ├── beam-engine.js      BeamEngine.solve, BeamEngine.deflect
│       ├── mohr-engine.js      MohrEngine.analyse, .transform
│       ├── section-engine.js   SectionEngine.build, .DEFAULTS
│       ├── truss-engine.js     TrussEngine.build, .solve
│       ├── calc-engines.js     TorsionEngine, ColumnEngine, SoilEngine
│       ├── mdm-engine.js       MDMEngine.create/step/run/results
│       ├── phase3-engines.js   PlasticEngine, DynEngine
│       ├── soil-class-engine.js  SoilClassEngine.grading/atterberg/classify
│       ├── shear-engine.js     ShearEngine.solve, Mohr-Coulomb failure
│       └── seepage-engine.js   SeepageEngine.solve, Laplace flow net
└── apps/
    s1-beam-studio  s2-mohrs-circle  s3-bending-stress  s4-shear-stress
    s5-torsion      s6-deflection    s7-buckling        s8-truss
    s9-influence-lines  s10-moment-distribution
    s11-plastic-collapse  s12-dynamics  g1-soil-phase  g2-classification
    g3-shear-strength  g4-flow-nets
```

Every app folder holds exactly `index.html` + `app.js`. No per-app CSS.

---

## 3. Hard rules

Do not relax any of these. They are what the existing 13 apps were held to.

1. **Physics first, verified.** Write the engine as a standalone library,
   test it in Node against closed-form textbook values, and only then build
   any UI. If a test fails, fix the engine, not the test, unless you can
   derive on paper that the expected value was wrong.
2. **Plain scripts only.** No ES modules, no bundler, no npm dependency in
   the shipped code, no framework. Engines are IIFEs assigned to a global,
   with a CommonJS export guard at the bottom so Node can test them.
3. **No browser storage.** Never `localStorage` or `sessionStorage`. State
   lives in a plain JS object.
4. **Brand is law.** Section 4. Blue leads, no shadows, no teal, no brown,
   one contour motif per page, Poppins headings, Inter body, watermark
   lower right.
5. **Sign conventions are fixed** across the suite. Section 5.
6. **Prose style** in learn boxes, README and replies: British English,
   plain short sentences, no semicolons, no em dashes, no hype.

---

## 4. Design system

Brand tokens, already in `civillab.css` as CSS variables:

```
--ocean   #14416B  primary: headings, beam line, section outlines, circle
--water   #1E78B0  secondary: SFD, links, tension members, sigma arrows
--green   #2E6B4F  response and pass: reactions, BMD, safe states
--bg      #F6F7F4  page background
--ink     #1C2A33  body text
--midblue #2E6FA3  support tint, art only (tau arrows, springs)
--pale    #9FC4E6  support tint, art only (reference diameters, envelopes)
--contour #C9CEC7  hatching, dashed guides
--hair    #DFE3DC  1px borders on panels and chips
--load    #B03A2E  FUNCTIONAL ONLY: applied loads, compression, fail states
```

Figure colour semantics, keep consistent:

- what the student applies (loads, torque, applied stress) → `--load`
- what the structure answers with (reactions, fixing moments) → `--green`
- shear force diagram → `--water`; bending moment diagram → `--green`
- primary geometry → `--ocean`; axes #B9C0C5; dashed guides → `--contour`
- truss and design apps: tension `--water`, compression `--load`

**Exact page skeleton.** Copy this for every new app, changing only the
title, aria label, module codes, viewBox height, engine scripts and learn
bullets. Paths are relative from `apps/<id>/`.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CivilLab · APP TITLE</title>
<link rel="icon" href="../../assets/img/markB.png">
<link rel="stylesheet" href="../../assets/css/civillab.css">
</head>
<body>
<div class="shell">
  <header class="top">
    <img class="mark" src="../../assets/img/markB.png" alt="">
    <div class="titles">
      <div class="suite">CivilLab <span>· Study Aid</span></div>
      <h1>APP TITLE</h1>
    </div>
    <a class="back" href="../../index.html">All apps</a>
  </header>

  <svg class="contour" viewBox="0 0 1180 24" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 15 C 60 6, 120 24, 180 13 S 300 4, 360 15 S 480 24, 540 11
             S 660 4, 720 15 S 840 24, 900 11 S 1020 6, 1080 15 S 1150 21, 1180 11"
          fill="none" stroke="#C9CEC7" stroke-width="1.5"/>
  </svg>

  <div class="workbench">
    <aside class="panel" id="controls" aria-label="..."></aside>
    <div>
      <div class="figwrap">
        <svg id="fig" viewBox="0 0 960 520" role="img" aria-label="..."></svg>
      </div>
      <div class="results" id="results"></div>
      <details class="learn">
        <summary>What am I seeing?</summary>
        <ul>
          <li>Three to five short bullets, each one physical insight.</li>
        </ul>
      </details>
    </div>
  </div>

  <footer>
    <span class="note">CivilLab · DISCIPLINE · MODULE CODE · University of Moratuwa syllabus</span>
    <img src="../../assets/img/wm_horizontal_dark.png" alt="Thushan Chamika">
  </footer>
</div>
<script src="../../assets/js/ui.js"></script>
<script src="../../assets/js/RELEVANT-engine.js"></script>
<script src="app.js"></script>
</body>
</html>
```

Two-figure apps swap the single `.figwrap` for `<div class="mohrgrid">`
holding two, which already handles the split and mobile stacking. An app
needing an HTML table below the figure adds
`<div id="tablewrap" class="panel" style="margin-top:14px;overflow-x:auto"></div>`
before the results div, as S10 does.

**Classes available** (all already in the stylesheet, do not add new CSS
files): `.shell .top .contour .workbench .panel .figwrap .mohrgrid`,
controls `.ctl .row .chk .btn .btn.ghost .btn.small .addrow .grid2 .grid3
.mini`, load cards `.loadcard .badge.point|.udl|.moment .del`, results
`.results .chip .k .v .s .chip.ok .chip.warn`, learn `details.learn`,
landing `.hero .cards .card .disc .pgroup .pchips .pchip h2.sec`.

---

## 5. Sign conventions, fixed suite wide

Beams and frames:

- x from the left end, metres, span 0..L
- point load P positive downward (kN), UDL w positive downward (kN/m)
- applied moment M positive anticlockwise (kN·m)
- shear V positive when the left segment resultant acts up, so dM/dx = V
- bending moment sagging positive, BMD drawn on the tension side
  (sagging downwards) by default

Moment distribution (S10 only, different by necessity): member end moments
**clockwise positive**, the Hibbeler convention. Internal sagging moment at
the left end of a span is +m_AB and at the right end is −m_BA. FEM for a
UDL is ∓wL²/12, for a central point load ∓PL/8.

Stress: tension positive; τxy positive acting +y on the +x face; rotation
θ anticlockwise positive. On Mohr's circle τ is plotted **positive
downwards** so a physical rotation θ moves the point 2θ the same visual way.

Soil: compression positive (this flips the structural convention, so state
it in the engine header when relevant), σ' = σ − u, τf = c' + σ' tanφ'.

Units: kN, kN/m, kN·m, m, MPa for stress, kPa for soils, mm for section
dimensions, degrees in the UI and radians inside engines. Dynamics uses
tonnes and kN/m so ωn = √(k/m) directly. Format every number with `UI.fmt`,
which normalises −0.

---

## 6. Existing engine APIs

Reuse these. Do not duplicate their maths in a new engine.

```js
// ui.js
UI.s(tag, attrs, ...children)   // SVG element in the right namespace
UI.fmt(v, d = 1)                // fixed decimals, never prints "-0.0"
UI.clamp(v, a, b)
UI.snap(v, step)

// beam-engine.js  — statically determinate only
BeamEngine.solve({ L, config:'ss'|'cant', xA, xB, cantSide:'left'|'right',
  loads:[{type:'point',P,a},{type:'udl',w,x1,x2},{type:'moment',M,a}] })
  // → { reactions, samples:[{x,V,M}], Vmax, Vmin, Mmax, Mmin, W }
BeamEngine.deflect(result, state, EI)   // EI in kN·m²
  // → { samples:[{x, v, th}], vmax, vmin, thmax }   v in m, upward positive

// mohr-engine.js
MohrEngine.analyse(sx, sy, txy)  // → { C, R, s1, s2, tmax, thetaP }  radians
MohrEngine.transform(sx, sy, txy, th)  // → { sxp, syp, txyp }  th radians

// section-engine.js  — all dimensions mm
SectionEngine.build(type, dims)
  // types: rect{b,h} ibeam{bf,tf,tw,hw} tee{bf,tf,tw,hw} box{b,h,t}
  //        circle{do} pipe{do,di}
  // → { A, ybar, I, h, ytop, ybot, Ztop, Zbot, bAt(y), QAt(y), rects }
  //   y measured from the NEUTRAL AXIS, up positive
SectionEngine.DEFAULTS[type]

// truss-engine.js
TrussEngine.build('pratt'|'howe'|'warren', panels, span, height)
  // → { nodes:[{id,x,y}], members:[[a,b]], pin, roller }
TrussEngine.solve(geom, { nodeId: Pdown })
  // → { ok, forces:[{a,b,F}], reactions:{R0x,R0y,Rny} }  F positive = tension

// calc-engines.js
TorsionEngine.solve({ d1, d2, di, T, L, G })  // mm, kN·m, m, GPa
  // → { J1, Jmin, tauMax, theta, dMin, tauAt(r) }
ColumnEngine.solve({ end:'pp'|'ff'|'fp'|'fr', E, I6, A, L, fy })
  // → { k, EI, Le, Pcr, r, lam, sigCr, Psquash, Pu, governing, lamLimit }
ColumnEngine.shape(end, xi)     // normalised buckled shape, xi 0..1
SoilEngine.phase(e, w, Gs)
  // → { e, w, wSat, capped, Gs, S, n, gdry, gbulk, gsat, gsub, GW }

// mdm-engine.js
MDMEngine.create({ left:'pin'|'fixed', right, spans:[{L,w,P,a,EI}] })
MDMEngine.step(model)   // one Balance or one Carry over, returns false when done
MDMEngine.run(model)    // to convergence
MDMEngine.results(model)  // → { samples:[{x,M,span}], Mmax, Mmin, supM, R, offs, Ltot }

// phase3-engines.js
PlasticEngine.solve({ kind:'ssP'|'propP'|'fixP'|'fixU'|'propU'|'frame',
  Mp, L, P, w, V, l, H, h })
  // → { lambda, hinges, work, name, collapse, bars?, governing?, xs? }
DynEngine.sdof(m, k, z)             // → { wn, wd, fn, T, logdec }
DynEngine.freeResp(m, k, z, u0, v0, t)
DynEngine.shear(masses[], stiffnesses[])   // bottom → top
  // → { omegas[], modes[][], fns[] }   Jacobi eigensolver

// soil-class-engine.js  — d in mm, percent passing 0..100, limits in percent
SoilClassEngine.STACK                 // 11 standard sieves, 75 mm down to 75 µm
SoilClassEngine.grading(points)       // points:[{d,pass}], any order
  // → { pts, monotonic, D10, D30, D60, Cu, Cc,
  //     cobbles, gravel, sand, fines, passAt(d), dAt(P) }
  //   D values are null when that percentage is off the sieve range
SoilClassEngine.atterberg(LL, PL)
  // → { PI, A, U, above, aboveU, valid, fine, highPlast }
  //   fine is the plasticity chart group: CL, CH, ML, MH or CL-ML
SoilClassEngine.classify(points, LL, PL)
  // → { g, at, symbol, name, group:'coarse'|'fine'|'oversize',
  //     steps[], notes[], gradationKnown }
SoilClassEngine.aLine(LL)   // 0.73(LL − 20)
SoilClassEngine.uLine(LL)   // 0.9(LL − 8)

// shear-engine.js  — kPa, degrees in, radians inside, COMPRESSION POSITIVE
ShearEngine.solve({ mode:'cd'|'cu'|'uu', c, phi, cu, s3, A, sd })
  // → { s1, s3e, s1e, u, tot, eff, act, sdf, margin, failed,
  //     phiMob, atFailure:{ C, R, tangent:{s,t}, theta }, neverFails }
ShearEngine.Nphi(phiDeg)          // tan^2(45 + phi/2)
ShearEngine.failureS1(c, phi, s3e)        // s3e Nphi + 2c sqrt(Nphi)
ShearEngine.failureDeviator(c, phi, s3, A)  // Skempton, B = 1

// seepage-engine.js  — metres, k in m/s, q in m3/s per metre run
//   h is measured above the downstream ground surface, z up from the base
SeepageEngine.solve({ kind:'sheetpile'|'dam', W, D, d, B, H, k, nx, ny })
  // → { h, psi, q, shape (Nf/Nd), iExit, uplift:{pts,force,arm,meanHead},
  //     conservation, headAt(x,z), equipotentials(Nd), flowlines(Nf) }
SeepageEngine.criticalGradient(Gs, e)   // (Gs − 1)/(1 + e)
SeepageEngine.laplace(nx, ny, dx, dz, type, val, opts)  // general FD solver
```

### Writing a new engine

Header comment stating every sign convention and unit. Pure functions, no
DOM, no state. Guard divisions, clamp inputs, sample either side of
discontinuities with ε = max(domain·1e-7, 1e-9), refine extremes at zero
crossings of the derivative. End with:

```js
const MyEngine = (() => { /* ... */ return { solve }; })();
if (typeof module !== 'undefined') module.exports = MyEngine;
// or, when several globals share one file:
if (typeof module !== 'undefined' && typeof exports !== 'undefined')
  exports.MyEngine = MyEngine;
```

### Anchor values for tests

Already used and passing (45 + 38 + 106 + 70 + 38 checks):
PL/4, wL²/8, PL³/48EI, 5wL⁴/384EI, PL³/3EI, τmax = 1.5V/A rectangle and
4/3V/A circle, τ = 16T/πd³, Euler k = 1 / 0.5 / 0.6992 / 2, Se = wGs,
∓wL²/12 fixed end moments, −wL²/8 propped, 8Mp/L, 16Mp/L², hinge at
(2 − √2)L, 2DOF mode ratio 0.618, 3DOF ω/√(k/m) = 0.445 / 1.247 / 1.802.
Classification: A line 21.9 at LL 50 and 58.4 at LL 100, U line 37.8 at
LL 50, the A line meeting PI = 4 at LL 25.479 and PI = 7 at LL 29.589,
Cu = D60/D10, Cc = D30²/(D10 D60), and the ASTM D2487 group symbols with
their 5 and 12 percent fines boundaries.
Shear strength: Nphi = tan²(45 + φ/2) giving 1, 3 and 5.828 at φ = 0, 30 and
45, the failure plane at 45 + φ/2, the tangent point at (C − R sinφ, R cosφ),
and sd = [σ3(N−1) + 2c√N] / (1 + A(N−1)) which gives 2cu when φ = 0.
Seepage: the FD Laplace solver reproduces an exact linear field to 1e-7, q is
exactly proportional to k and to H, inflow equals outflow, h(x) + h(W−x) = H
about a centred pile, the ψ range reproduces q, and i_c = (Gs−1)/(1+e) = 1.0
at Gs 2.65 with e 0.65.

For engines still to be written:
Tv = 0.197 at U = 50% and 0.848 at U = 90%; Ka = tan²(45 − φ/2) and
Kp = 1/Ka; Terzaghi strip footing on φ = 0 clay Nc = 5.7 (or 5.14 for the
Prandtl value, state which you use); Greenshields qmax = vf·kj/4 at
k = kj/2; Stokes vs = g(ρs − ρ)d²/18μ with a Re < 1 check.

---

## 7. app.js pattern

One IIFE. This is the shape all 13 apps follow.

```js
(() => {
  const { s, fmt, clamp, snap } = UI;
  const fig = document.getElementById('fig');
  const controls = document.getElementById('controls');
  const resultsEl = document.getElementById('results');

  const C = { ocean:'#14416B', water:'#1E78B0', green:'#2E6B4F',
              load:'#B03A2E', midblue:'#2E6FA3', pale:'#9FC4E6',
              muted:'#5C6A72', axis:'#B9C0C5', contour:'#C9CEC7' };

  // layout constants, state object, PRESETS table
  // scale helpers: data → px and px → data
  // txt() line() marker() helpers, copy from any existing app
  // render(): clear the svg, defs, draw, then set resultsEl.innerHTML
  // delegated events on #controls, pointer events on #fig
  // boot: renderControls(); render();
})();
```

Copy the `txt`, `line` and `marker` helpers verbatim from an existing app,
they are identical everywhere. `txt` uses the halo trick so labels stay
readable over fills:
`paint-order:stroke; stroke:#fff; stroke-width:3; stroke-linejoin:round`.

Control rules that matter:

- twin range + number inputs share a `data-k`; on input sync the twin but
  **never overwrite an input that currently has focus**
- rebuild `controls.innerHTML` only on structural change (preset, mode,
  add or remove). For value changes update state, re-render the figure,
  then surgically sync affected inputs. Rebuilding mid-drag kills the slider
- delegate all events to `#controls` once at boot, because innerHTML
  rebuilds replace the children
- any manual edit sets the preset select to "custom"
- presets are factories (functions returning fresh objects), never shared
  object literals

Results chips:

```js
const chip = (k, v, sub, cls) =>
  `<div class="chip ${cls||''}"><div class="k">${k}</div>` +
  `<div class="v">${v}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;
```

`.ok` for response values, `.warn` for exceedance, hogging or compression.

SVG techniques:

- full re-render each frame is fine at this scale, clear with a
  while-firstChild loop
- arrowheads need one `<marker>` per colour, markers do not inherit stroke
- draggable glyphs go in `<g data-id="...">` with a generous transparent
  hit rect. On pointerdown call `fig.setPointerCapture(e.pointerId)` on the
  **root svg**, never the glyph, because re-render destroys the glyph
  mid-drag
- pointer to data: `(e.clientX - rect.left) * (viewBoxW / rect.width)` then
  invert the scale. Snap positions to 0.1
- diagram fills close the polyline to the zero axis, `fill-opacity:.13`,
  stroke width 2.2
- label extremes with a dot plus "value at x m", clamped inside the plot
- animations use requestAnimationFrame toggled by one button that flips its
  own label to Stop, always user initiated

### Headless harness

```js
// /tmp/h/smoke.js — run: node /tmp/h/smoke.js <root> <apps/app-dir>
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2], APP = process.argv[3];
const hp = path.join(ROOT, APP, 'index.html');
let html = fs.readFileSync(hp, 'utf8')
  .replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
    '<script>' + fs.readFileSync(path.resolve(path.dirname(hp), src), 'utf8') + '</script>')
  .replace(/<link[^>]+>/g, '');
const errs = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) { w.addEventListener('error', e => errs.push(e.message)); } });
const doc = dom.window.document, w = dom.window;
const val = key => {
  const c = [...doc.querySelectorAll('.chip')]
    .find(c => c.querySelector('.k').textContent.includes(key));
  return c ? c.querySelector('.v').textContent : '(missing)';
};
console.log('errors', errs.length, 'chips', doc.querySelectorAll('.chip').length);
// simulate: set .value then dispatch
//   new w.Event('input', {bubbles:true}) / new w.Event('change', {bubbles:true})
//   new w.MouseEvent('click', {bubbles:true})
// then assert val('Some chip key') against a hand computed number
```

Re-query any element by id after a `change` that rebuilds the controls
panel, otherwise you hold a detached node and the next dispatch does
nothing.

---

## 8. Pitfalls that already bit this build

- shell brace expansion may not work; use explicit `mkdir -p a b c`
- `/tmp` can be wiped between sessions, reinstall jsdom if requires fail
- diagram closure: at an end support the SFD and BMD legitimately drop to
  zero at the very last sample. Keep those samples for drawing but exclude
  them from extreme scans or the chips report a fake zero
- `-0.0` leaks into output unless you use `UI.fmt`
- SVG `rotate()` is visually clockwise because y points down. For physics
  drawings do the rotation maths manually so labels stay horizontal. The
  mapping used in S2: a local point (x, y) with x right and y up maps to
  `[cx + x·cosθ − y·sinθ, cy − x·sinθ − y·cosθ]`
- moment arcs: compute both endpoints and set the sweep flag from the sign,
  visual anticlockwise means sweep 0
- when a test disagrees with an engine, derive the expected value on paper
  first. Three times in this build the test was wrong and the engine right
- keep `viewBox` fixed and let CSS scale the svg, never hardcode pixel width
- number inputs: parseFloat, bail on NaN, clamp to sane ranges

---

## 9. Remaining 21 apps

Build order: geotechnical, then foundations, then design modules, then
transport and environmental. Full prose specs are in `PLAN.md`.

**Geotechnical (2)**

- `g5-consolidation` CE2132. H, cv, Δσ, one or two way drainage. Settlement
  against time with a moving marker and animated pore pressure isochrones.
- `g6-slope-stability` CE3132. Draggable slip circle, method of slices,
  one slice's force polygon, FoS updating live.

**Foundations (2, Semester 7)**

- `f1-earth-pressure` CE4032. Rankine Ka and Kp, wall height, φ, surcharge,
  water table. Pressure diagrams, Coulomb wedge, sliding, overturning and
  bearing bars.
- `f2-bearing-capacity` CE4032. Terzaghi or EC7 factors, B, D, water table,
  eccentricity. Failure wedge, pressure bulb, qu against applied.

**Design apps, shared rules (PLAN.md has the full briefs)**

Every design app carries a **code toggle, Eurocode with the UK NA against the
BS it replaced**, shows each design strength as a **visible chain of
multipliers** ending in the design value, gives **one utilisation bar per
check with the governing one highlighted**, leads with the verdict and hides
the substitution in an expandable trail, and prints a **clause reference**
beside every result. Footer must say these teach the checks and are not design
software.

**Actions (1)**

- `d1-actions` EN 1990 + EN 1991 against BS 6399. Permanent, imposed, wind and
  snow to design actions. 6.10 beside 6.10a/b, the psi factors, and the three
  SLS combinations from the same inputs. **Build this first**, the other design
  apps read their actions from it.

**Concrete (6)** EN 1992-1-1 against BS 8110

- `c1-rc-beam` CE2122. **Reuses SectionEngine.** Tabs for flexure, shear,
  deflection and cracking. Stress block to scale, singly, doubly and flanged.
  Variable strut angle 21.8 to 45 degrees, VRd,c and VRd,max, link spacing.
- `c2-rc-column` CE2122. Strain compatibility sweep of the NA depth for the
  N-M diagram, draggable design point, short against slender with the nominal
  curvature moment, biaxial contours.
- `c3-rc-slab` CE2122. One way and two way panels, moment coefficients on each
  strip, punching shear with the control perimeters drawn at 2d.
- `c4-detailing` CE2122. Anchorage and lap lengths with the alpha1 to alpha5
  chain, cover from exposure class and fire period, bar spacing against the
  available width.
- `c5-mix-design` CE1132. Target strength, w/c, grading, workability.
  Document the method used.
- `c6-prestressed` CE4012. **Reuses SectionEngine.** Transfer and service
  fibre stresses side by side, Magnel diagram, losses as a waterfall.

**Steel (2)** EN 1993-1-1 against BS 5950

- `st1-member-capacity` CE2022. Embedded UB, UC and hollow section table.
  Tabs for classification with c/t measured on the drawn section, tension,
  compression on the right buckling curve, bending with lateral torsional
  buckling and restraint positions, and the combined interaction.
  **Build the reusable utilisation-bar component here**, then reuse it in
  c1, c2, c4, c6, st2, t1, m1, f1, f2, tr3.
- `st2-connections` CE2022. Tabs for the bolt group, welds and the base plate.
  Bolt shear, bearing on both plies, tension with prying, block tear drawn on
  the plate, fillet welds by the directional method, base plate effective area.

**Timber and masonry (2)**

- `t1-timber` CE3122. EN 1995-1-1 against BS 5268. kmod and gammaM chain to fd,
  with kh, kcrit and ksys when they apply, then bending both axes, shear,
  compression parallel and perpendicular, and buckling with kc.
- `m1-masonry` CE3122. EN 1996-1-1 against BS 5628. Effective height and
  thickness, slenderness and eccentricity to the reduction factor Phi, vertical
  resistance, then a lateral tab with orthogonal ratio and arching.


**Transportation (3)**

- `tr1-traffic-flow` CE3162. Greenshields, three linked plots v-k, q-k, v-q
  with one synchronised draggable operating point. qmax = vf·kj/4.
- `tr2-alignment` CE3162 and CE4042. Horizontal curve in plan and vertical
  curve in profile, SSD drawn and checked.
- `tr3-pavement` CE4042. Layered section, stress decay with depth, subgrade
  CBR driving thickness, strain check bar.

**Environmental (3)**

- `en1-treatment-train` CE3152. Unit toggles, water quality tracked stage
  by stage. Document the removal efficiency source.
- `en2-sedimentation` CE3152. Animated particles, Stokes settling velocity,
  captured against carried over by vs > vo.
- `en3-do-sag` CE4552. Streeter-Phelps curve, critical point and minimum DO.

### Landing page maintenance when an app ships

Remove its `.pchip` from the pipeline group (and drop the group if it
empties), add a `.card` under "Live now" with discipline plus module code in
`.disc`, two or three sentences, and an Open button. Update the hero count
line, currently "16 live · 21 in the pipeline". Keep cards in build order.

---

## 10. Working style

Build one app at a time unless told otherwise. For each: spec it from the
roadmap entry, write or extend the engine, test the engine in Node, build
the HTML from the skeleton, build app.js, run the headless check with real
interaction assertions, update the landing page, then run the full
regression across all apps.

Report back with the textbook values that passed, what the headless run
simulated, and anything that needs a real device test, usually the drag and
touch interactions since jsdom cannot verify those.
