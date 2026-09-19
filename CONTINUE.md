# CivilLab — continue here

Interactive civil engineering simulators for the University of Moratuwa syllabus.
**14 of 34 apps are live.** Companion suite to Water Lab.

| | |
|---|---|
| Repo | `thushanch/civillab` (public) |
| Live | https://thushanch.github.io/civillab/ |
| Sister suite | [`thushanch/water-lab`](https://github.com/thushanch/water-lab) |

**Read [`CLAUDE.md`](CLAUDE.md) before writing any code.** It is the build brief:
sign conventions, the brand, the exact page skeleton, the engine APIs and the
rules that all 14 existing apps were held to. This file only covers where the
work stopped and what to do next.

---

## The one next action

**Run the verification suite and confirm G3 passes.**

```bash
cd civillab && npm install && npm test
```

G3 (Mohr-Coulomb shear strength) is fully written and its engine passes 70
checks, but **its headless UI check has never completed successfully**, so treat
it as unverified. That is not a known bug in G3, it is a broken local machine:
`require("jsdom")` hangs indefinitely on the Windows box this was built on, even
from a clean install outside OneDrive. On any normal machine, a cloud session or
CI, `npm test` should just run.

If G3 fails, fix it. If it passes, G3 is done and you can start G4.

---

## What is live

Fourteen apps, each a folder holding exactly `index.html` + `app.js`:

```
s1-beam-studio        s2-mohrs-circle       s3-bending-stress
s4-shear-stress       s5-torsion            s6-deflection
s7-buckling           s8-truss              s9-influence-lines
s10-moment-distribution   s11-plastic-collapse   s12-dynamics
g1-soil-phase         g2-classification     g3-shear-strength
```

Shared engines in `assets/js/`, all pure and Node-testable:

| Engine | Covers |
|---|---|
| `ui.js` | `UI.s` / `fmt` / `clamp` / `snap` |
| `beam-engine.js` | determinate beams, `solve` and `deflect` |
| `mohr-engine.js` | plane stress transformation |
| `section-engine.js` | section properties |
| `truss-engine.js` | method of joints |
| `calc-engines.js` | torsion, columns, soil phase |
| `mdm-engine.js` | moment distribution, step by step |
| `phase3-engines.js` | plastic collapse, dynamics |
| `soil-class-engine.js` | grading curves, Atterberg, ASTM D2487 |
| `shear-engine.js` | Mohr-Coulomb failure, Skempton A |

---

## The last two apps, in detail

**G2 · Particle Size and Classification** (CE2042) — done and verified.
Draggable semi-log grading curve over an eleven sieve stack, editable sieve
table, D10/D30/D60 by log interpolation, Cu and Cc, a Casagrande chart with the
A line, U line and hatched CL-ML band, and the USCS symbol with its decision
trail. 106 engine checks and 61 headless interaction checks passed.

**G3 · Mohr-Coulomb Shear Strength** (CE3132) — written, engine verified, UI
check outstanding. A triaxial specimen with the failure plane at 45 + φ/2 that
visibly shears apart, beside total and effective Mohr circles against the
envelope. CD, CU and UU modes. The load slider is a percentage of the deviator
at failure, so 100 % is exactly where the circle touches the envelope. Pore
pressure follows Skempton with B = 1 and u = A·σd, giving the closed form

```
σd,f = [σ3(Nφ − 1) + 2c′√Nφ] / (1 + A(Nφ − 1))
```

which collapses to the drained result at A = 0 and to 2cu when φ = 0.
Interaction assertions are already written in `tools/checks/g3-shear-strength.js`
and will run automatically as part of `npm test`.

---

## Verifying

The harness now lives in the repo, so it works from a fresh clone or a phone.

```bash
npm install          # jsdom, dev only, the shipped site has no dependencies
npm test             # syntax, engine physics, offline audit, headless UI
npm run smoke apps/g3-shear-strength    # one app
npm run offline      # external references and broken asset paths
```

| Tool | Does |
|---|---|
| `tools/run-all.js` | all four levels in order |
| `tools/smoke.js` | loads a page in jsdom, checks errors, figures drew, chips rendered, then runs any `tools/checks/<app>.js` |
| `tools/test-shear.js` | 70 checks on `shear-engine.js` |
| `tools/check-offline.js` | fails on any external URL or missing local asset |

A new app is done when the engine tests pass against quoted textbook values,
`node --check` is clean, the headless run has zero page errors and at least two
hand-checked interactions, the landing page is updated, and every other app
still passes.

**Missing:** `tools/test-soil-class.js` was lost when a temp folder was wiped.
The G2 engine is unchanged and did pass 106 checks, but those checks are no
longer in the repo. Rewriting them is a good small first task. Anchors to use:
A line 21.9 at LL 50 and 58.4 at LL 100, U line 37.8 at LL 50, the A line meeting
PI = 4 at LL 25.479 and PI = 7 at LL 29.589, Cu = D60/D10, Cc = D30²/(D10·D60),
and the group symbols either side of the 5 % and 12 % fines boundaries.

---

## Next apps, in build order

Full prose specs are in [`PLAN.md`](PLAN.md), summaries in `CLAUDE.md` section 9.

1. **`g4-flow-nets`** CE2132 — sheet pile or dam with cutoff, flow and
   equipotential lines, q = k·H·Nf/Nd, uplift and exit gradient
2. **`g5-consolidation`** CE2132 — settlement against time, animated pore
   pressure isochrones. Anchors: Tv = 0.197 at U = 50 %, 0.848 at U = 90 %
3. **`g6-slope-stability`** CE3132 — draggable slip circle, method of slices
4. **`f1-earth-pressure`** CE4032 — Rankine Ka and Kp. Anchors:
   Ka = tan²(45 − φ/2), Kp = 1/Ka
5. **`f2-bearing-capacity`** CE4032 — Terzaghi factors, Nc = 5.7 for a strip
   footing on φ = 0 clay, or 5.14 for the Prandtl value, state which you use

Then concrete, steel, timber and masonry, transport and environmental. Build the
reusable utilisation-bar component in `st1-member-capacity`, because nine later
apps reuse it.

When an app ships, update the landing page: add a `.card`, remove its `.pchip`,
and bump the count line, currently "14 live · 20 in the pipeline".

---

## Gotchas that already cost time here

- **This folder is inside OneDrive and OneDrive has reverted finished edits.**
  After a batch of file writes, verify them before committing.
- **Never put `node_modules` inside the OneDrive path.** It makes file reads
  block. `node_modules/` is gitignored, keep it that way.
- Fonts are self hosted in `assets/fonts` and the suite has **zero external
  references**. Never reintroduce a Google Fonts link, `npm run offline` fails on
  one.
- When a test disagrees with an engine, derive the expected value on paper first.
  It has been the test that was wrong more often than the engine, including six
  times while building G2.
- `getBBox()` ignores transforms, so it reports false overlaps for rotated axis
  labels. Use `getBoundingClientRect()` mapped back into viewBox units.
- Mohr circles need the **same scale on both axes** or they stop being circles.
- Rebuild `controls.innerHTML` only on structural change. Rebuilding on a value
  change kills the slider mid-drag.
