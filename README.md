# CivilLab · Study Aid

Interactive simulators for civil engineering fundamentals, built on the
University of Moratuwa Civil Engineering Student Handbook 2022.
A companion suite to Water Lab by Thushan.

## Run it

No build step, no server and no dependencies. Clone or unzip, then open
`index.html` in any browser. Everything runs from `file://` with no network
at all: Poppins and Inter are bundled as woff2 subsets in `assets/fonts`,
so the typography is the same offline as online. The Latin and Greek
subsets are included, which covers the sigma, tau, theta and lambda labels
the figures use. Both faces are SIL Open Font License 1.1, see
`assets/fonts/OFL.txt`.

## Live apps (v0.7: 17 apps)

1. **Beam SFD & BMD Studio** (`apps/s1-beam-studio/`)
   Simply supported, overhanging and cantilever beams with draggable point
   loads, UDLs and applied moments. Live reactions, SFD and BMD with extremes
   labelled, a hover tracker for V and M at any section, and a toggle for the
   BMD sign convention (tension side or sagging up).

2. **Mohr's Circle for Stress** (`apps/s2-mohrs-circle/`)
   Plane stress element linked to a live Mohr's circle. Rotate the cutting
   plane and both figures move together. Principal stresses, maximum shear,
   the 2θ rule and a sweep animation.


3. **Bending Stress Explorer**, **Shear Stress Distribution**, **Torsion
   Simulator**, **Beam Deflection Visualiser**, **Column Buckling & Struts**,
   **Truss Solver**, **Influence Lines** (`apps/s3…s9`) and **Soil Phase
   Diagram** (`apps/g1-soil-phase/`). New shared engines:
   `section-engine.js`, `calc-engines.js` (torsion, column, soil) and
   `truss-engine.js`, plus `BeamEngine.deflect` for double integration.
   All verified: 45 engine checks and 23 headless UI checks pass.

4. **Moment Distribution** (`apps/s10-moment-distribution/`), **Plastic
   Collapse Mechanisms** (`apps/s11-plastic-collapse/`) and **Structural
   Dynamics** (`apps/s12-dynamics/`). Engines: `mdm-engine.js` (Hardy Cross
   with step-through iteration) and `phase3-engines.js` (mechanism method,
   SDOF response, Jacobi eigensolver for shear buildings). Verified against
   wL2/12, wL2/8, 8Mp/L, the 2 - root2 hinge position, the golden ratio 2DOF
   mode shape and the closed-form 3DOF frequencies.

5. **Particle Size & Classification** (`apps/g2-classification/`)
   A draggable semi-log grading curve over an eleven sieve stack, with the
   sieve table editable directly below it. D10, D30 and D60 are read off the
   curve by log interpolation, and Cu and Cc fall out of them. The sample
   also sits on a Casagrande plasticity chart with the A line, the U line
   and the hatched CL-ML band, and can be dragged there to set LL and PI.
   The Unified group symbol and full name are worked out and the decision
   trail is written out step by step. New engine: `soil-class-engine.js`,
   verified by 106 checks against ASTM D2487.

6. **Mohr-Coulomb Shear Strength** (`apps/g3-shear-strength/`)
   A triaxial specimen loaded until it shears along the plane at 45 + phi/2,
   beside the total and effective Mohr circles running up against the failure
   envelope. Drained, consolidated undrained and unconsolidated undrained
   tests, with pore pressure from Skempton A so the two circles pull apart as
   the load rises. The load slider is a percentage of the deviator at failure,
   so 100 per cent is exactly where the circle touches the envelope.
   New engine: `shear-engine.js`, verified by 70 checks. It reuses
   `MohrEngine` for the circle geometry rather than repeating it.

7. **Flow Nets & Seepage** (`apps/g4-flow-nets/`)
   A flow net that is solved rather than sketched. A finite difference Laplace
   solver gives the head field, a second solve gives the stream function, and
   marching squares turns both into the flow lines and equipotentials. Drag the
   cutoff tip and the whole net redraws. Reports the discharge, the true form
   factor Nf/Nd against the net the student drew, the exit gradient against the
   critical gradient, and the uplift diagram on a dam base.
   New engine: `seepage-engine.js`, verified by 38 checks including an exact
   linear field, exact proportionality to k and H, flow conservation, symmetry
   and grid convergence.

8. **Consolidation over Time** (`apps/g5-consolidation/`)
   The Terzaghi series solved directly, so the isochrones are the real thing
   rather than a sketch. Press play and the excess pore pressure collapses
   while the settlement curve fills in against log time, with t50 and t90
   marked and the marker draggable. Compression index or mv, normally or
   overconsolidated, one or two way drainage, and secondary creep past t90.
   New engine: `consol-engine.js`, verified by 80 checks including T50 = 0.197,
   T90 = 0.848, the two textbook approximations, and single drainage taking
   exactly four times as long as double.

## Structure

```
civillab/
├── index.html                  landing page
├── assets/
│   ├── css/civillab.css        shared design system (brand tokens)
│   ├── js/
│   │   ├── ui.js               small shared helpers
│   │   ├── beam-engine.js      determinate beam solver (shared)
│   │   └── mohr-engine.js      stress transformation maths (shared)
│   └── img/                    brand mark and watermarks
└── apps/
    ├── s1-beam-studio/
    └── s2-mohrs-circle/
```

The engines are plain script libraries with CommonJS exports, so they can be
unit tested with Node and reused by later apps. The beam engine will serve
S4 (shear stress), S6 (deflection), S10 (moment distribution) and S11
(plastic collapse). The Mohr engine will serve G3 (soil shear strength).

## Verified physics

The beam engine passes 20 checks against textbook cases, including
PL/4 and wL²/8 midspan moments, cantilever fixing moments both ways,
moment-load steps in the BMD, and overhang uplift reactions.
The Mohr engine passes 7 checks including principal stresses, the trace
invariant and the pure shear 45° result.

## Conventions

- Point loads positive downward (kN), UDLs positive downward (kN/m)
- Applied moments positive anticlockwise (kN·m)
- Shear positive with the left segment resultant acting up, so dM/dx = V
- Bending moment sagging positive, drawn on the tension side by default
- Mohr's circle plots τ positive downwards, so a rotation θ of the element
  moves the stress point 2θ around the circle in the same sense

## Brand

Design follows the Thushan Chamika brand guide. Deep Ocean Blue leads,
Poppins for headings, Inter for body, hairline borders, no shadows, one
topographic contour motif per page, watermark lower right.
