# CivilLab Study Aid — Build Plan

**A slide-and-learn simulator suite for Civil Engineering students**

Based on the University of Moratuwa Civil Engineering Student Handbook 2022. Companion project to Water Lab by Thushan.

---

## 1. Purpose

Post A/L and early undergraduate students learn structural and geotechnical concepts far better when they can move a load and watch the diagram respond, drag a stress state and watch Mohr's circle rotate, or push a column and watch it buckle. Static textbook figures freeze one case. These apps let a student break a concept apart, change one variable at a time, and see the whole family of answers.

Each app follows the same idea used in Water Lab. A control panel of sliders and inputs on one side, a live figure on the other, and a short results readout underneath. The student learns by sliding, not by reading.

## 2. Scope decisions

- **Core focus is Semesters 1 to 5**, with a set of Semester 7 design apps added on top because they cover the topics students struggle with most and are strongly figure driven.
- **Hydraulics and hydrology are excluded on purpose.** Water Lab already covers Fluid Mechanics (CE1023, CE1122), Hydraulic Engineering (CE2032, CE3012) and related material through its 38 simulators. No duplication.
- **Construction Engineering is not included** in this suite.
- **Surveying is left out of the core set** because the Sikharaya tool already touches spatial work. It is listed as an optional later track.
- **Multiple files are fine.** Apps do not need to be single file. A modular layout is preferred, with shared JavaScript libraries (a beam builder, a Mohr engine, a section builder) imported across several apps.

## 3. Distribution of apps

| Discipline | Apps | Handbook modules |
|---|---|---|
| Structural Engineering | 12 | CE1112, CE2013, CE2113, CE3112 |
| Geotechnical Engineering | 6 | CE2042, CE2132, CE3132 |
| Foundations and Retaining Structures | 2 | CE4032 (Sem 7) |
| Actions and Load Combinations | 1 | EN 1990/1991, BS 6399 |
| Concrete | 6 | CE1132, CE2122, CE4012 (Sem 7) |
| Steel | 2 | CE2022 |
| Timber and Masonry | 2 | CE3122 |
| Transportation Engineering | 3 | CE3162, CE4042, CE4532 |
| Environmental Engineering | 3 | CE3152, CE4552 (Sem 7) |
| **Total** | **37** | |

Kept close to the scale of Water Lab so the two suites feel like matched companions.

---

## 4. The apps

Each entry lists the concept, the source module, the controls the student moves, the live figure they see, and why it teaches the concept better than a static page. Apps marked NEW were added or promoted in this revision.

### Structural Engineering (12)

**S1. Beam SFD and BMD Studio** *(flagship)*
Module: CE1112, CE2013.
Concept: shear force and bending moment diagrams for any loading.
Controls: choose support type (simply supported, cantilever, overhang, propped), drag point loads, set UDL magnitude and extent, add applied moments.
Live figure: the beam, the reactions, the shear force diagram and the bending moment diagram all redraw as the student drags. Maximum values and their locations are labelled.
Why it helps: the single most requested figure. Students see instantly why a UDL gives a parabolic moment and a point load gives a kink in shear.

**S2. Mohr's Circle for Stress**
Module: CE2013 (stress and strain at a point).
Concept: two dimensional stress transformation.
Controls: sliders for normal stresses and shear stress, and a rotation angle.
Live figure: the stress element on the left rotates with the angle, the Mohr's circle on the right shows the current plane, principal stresses, principal planes and maximum shear.
Why it helps: the link between the physical rotating element and the point moving round the circle is the hardest idea in the module. Motion makes it click.

**S3. Bending Stress Explorer**
Module: CE1112 (bending stresses, section modulus).
Concept: flexural stress distribution across a section.
Controls: build a section (rectangle, I, T, hollow, circle), enter the applied moment, toggle composite material sections.
Live figure: the section with the neutral axis marked and the linear stress distribution beside it, tension and compression coloured. Section modulus and extreme fibre stresses shown.
Why it helps: makes the neutral axis position and the meaning of section modulus tangible.

**S4. Shear Stress Distribution**
Module: CE1112 (transverse shear stresses, shear centre).
Concept: transverse shear stress across a section using the first moment of area.
Controls: pick the section, set the shear force.
Live figure: the parabolic or stepped shear stress profile through the depth, with the shear centre marked for open thin sections.
Why it helps: shows why shear stress peaks at the neutral axis and vanishes at the free edges.

**S5. Torsion Simulator**
Module: CE1112 (torsion of circular sections, hollow cylinders, tapering shafts).
Concept: torsional shear stress and angle of twist.
Controls: shaft radius, inner radius for hollow shafts, torque, length, taper.
Live figure: radial shear stress distribution across the section and the twisted shaft with the angle of twist animated.
Why it helps: shows the linear rise of stress from centre to surface and why hollow shafts are efficient.

**S6. Beam Deflection Visualiser**
Module: CE1112 (deflection of beams, Macaulay's method, moment-area).
Concept: slope and deflection under load.
Controls: same beam builder as S1.
Live figure: the exact deflected shape drawn to a chosen scale, with slope and deflection readable at any point the student hovers.
Why it helps: connects the loading to the actual sag, which the SFD and BMD alone do not show.

**S7. Column Buckling and Struts**
Module: CE1112 (theory of columns and struts, buckling, imperfections).
Concept: Euler buckling and effective length.
Controls: end conditions (pinned-pinned, fixed-free, fixed-fixed, fixed-pinned), length, section, initial imperfection.
Live figure: the buckled mode shape and the critical load, with a slenderness plot showing where Euler and short column behaviour meet.
Why it helps: makes the effective length factor concrete by showing the buckled shape change with the supports.

**S8. Truss Solver and Force Visualiser**
Module: CE2113, CE1112 (build and test a truss).
Concept: method of joints and sections for determinate trusses.
Controls: place nodes, connect members, add supports and loads.
Live figure: each member coloured by tension or compression with the force magnitude labelled, and the joint equilibrium shown when a joint is selected.
Why it helps: turns a dry equilibrium exercise into a visual load path.

**S9. Influence Lines**
Module: CE2013 (influence lines for determinate structures).
Concept: response at a fixed point as a unit load moves.
Controls: choose the response (a reaction, or shear or moment at a section), drag the section location, move the unit load.
Live figure: the influence line builds as the load moves, and the value at the current load position is highlighted.
Why it helps: influence lines confuse students because the load moves and the section is fixed. Animation separates the two.

**S10. Moment Distribution Method** *(NEW)*
Module: CE2113 (matrix and iterative analysis of indeterminate structures).
Concept: distributing and carrying over moments to solve continuous beams and frames.
Controls: span lengths, stiffness, applied loads, support conditions.
Live figure: the distribution table builds row by row as the student steps through each iteration, with the beam moment diagram updating at every step until it converges.
Why it helps: students lose the thread in the iteration. Stepping through it with the diagram alongside shows the moments settling.

**S11. Plastic Collapse Mechanisms** *(NEW)*
Module: CE2113 (plastic methods of analysis for beams, frames and slabs).
Concept: plastic hinges, collapse load and mechanisms.
Controls: choose a beam or portal frame, set the plastic moment capacity and the load pattern.
Live figure: plastic hinges appear at the critical sections, the collapse mechanism rotates, and the load factor is computed and compared across possible mechanisms.
Why it helps: shows why a structure has reserve strength beyond first yield and which mechanism governs.

**S12. Structural Dynamics: SDOF and Mode Shapes** *(NEW)*
Module: CE3112 Structural Analysis II (introduction to structural dynamics).
Concept: free vibration, natural frequency, damping and mode shapes.
Controls: mass, stiffness, damping ratio, and a switch to multi degree of freedom for mode shapes.
Live figure: a mass on a spring vibrates in real time with the displacement trace plotted, and for the multi mass case the first few mode shapes animate.
Why it helps: dynamics is motion, so a still figure fails it. Live vibration and animated modes carry the idea directly.

### Geotechnical Engineering (6)

**G1. Soil Phase Diagram and Weight-Volume**
Module: CE2042 (mass volume relationships).
Concept: the three phase system of soil.
Controls: sliders for void ratio, water content and specific gravity.
Live figure: the three phase block redraws with air, water and solids to scale, and porosity, degree of saturation, bulk and dry unit weights update live.
Why it helps: makes the web of phase relationships one connected picture instead of ten formulas.

**G2. Particle Size and Soil Classification**
Module: CE2042 (particle size analysis, Atterberg limits, classification).
Concept: grading and index properties.
Controls: enter sieve results or drag the grading curve, set liquid and plastic limits.
Live figure: the semi-log grading curve with D10, D30 and D60 marked, the plasticity chart with the sample plotted, and the resulting Unified Soil Classification label.
Why it helps: shows how the grading curve and the plasticity chart together decide the soil name.

**G3. Mohr-Coulomb Failure and Shear Strength**
Module: CE3132 (shear strength), CE2132 (effective stress).
Concept: the failure envelope and effective stress.
Controls: cohesion, friction angle, confining stress, pore pressure, drained or undrained.
Live figure: Mohr circles drawn to the failure envelope, the failure plane angle, and total against effective stress shown side by side.
Why it helps: ties directly back to the structural Mohr's circle app, so the student sees one idea reused in a new context.

**G4. Flow Nets and Seepage**
Module: CE2132 (flow through soils, flow nets).
Concept: two dimensional seepage under a structure.
Controls: choose a case (sheet pile, dam with cut-off), set head difference and permeability.
Live figure: flow lines and equipotential lines drawn as a net, with seepage quantity, pore pressure at a point and uplift force computed.
Why it helps: flow nets are hard to picture from a book. Watching the net respond to the cut-off depth builds intuition.

**G5. Consolidation Settlement over Time** *(NEW)*
Module: CE2132 (Terzaghi one dimensional consolidation).
Concept: time dependent settlement of soft clay under load.
Controls: layer thickness, coefficient of consolidation, applied stress, drainage on one or both faces.
Live figure: the settlement against time curve builds as a marker moves along it, with the pore pressure isochrones through the layer animating as excess pressure dissipates.
Why it helps: makes the slow squeezing of water and the settlement curve one connected story.

**G6. Slope Stability: Method of Slices** *(NEW)*
Module: CE3132 (stability of soil slopes, Bishop and ordinary methods).
Concept: factor of safety against rotational failure.
Controls: slope geometry, soil strength, water table, and a draggable trial slip circle.
Live figure: the slip circle drawn with the slices, the forces on a selected slice shown, and the factor of safety updating as the student drags the circle to find the critical surface.
Why it helps: shows that stability depends on the surface chosen, and lets the student hunt for the worst one.

### Foundations and Retaining Structures (2) — Semester 7

**F1. Earth Pressure and Retaining Wall** *(NEW)*
Module: CE4032 Geotechnical Design (earth pressure, gravity and embedded walls).
Concept: active and passive earth pressure and wall stability.
Controls: wall height, backfill friction angle, surcharge, water table, wall type.
Live figure: the pressure distribution behind the wall, the Coulomb failure wedge, and the stability checks for sliding, overturning and bearing shown as pass or fail bars.
Why it helps: the active and passive wedge is a classic figure that students find hard to picture until it moves with the friction angle.

**F2. Shallow Foundation Bearing Capacity** *(NEW)*
Module: CE4032 (shallow foundations, Terzaghi bearing capacity).
Concept: ultimate and allowable bearing capacity.
Controls: footing width and depth, soil strength, water table, load eccentricity.
Live figure: the failure wedge below the footing, the pressure bulb, and the bearing capacity factors with the ultimate and allowable capacity computed against the applied load.
Why it helps: links the soil strength and footing size to a capacity through a picture rather than a bare formula.

### How the design apps work (read before building any of them)

The design modules are where a student meets a code for the first time, and a
code is a long chain of small decisions. The risk is an app that looks like a
spreadsheet. These five rules keep the coverage wide and the screen calm.

1. **Both codes, one toggle.** Every design app carries a code switch, Eurocode
   with the UK National Annex or the British Standard it replaced. The same
   member, the same loads, two answers side by side. Students in Sri Lanka meet
   both, and the comparison teaches more than either alone.
2. **The check chain is the figure.** Never print a design strength as a bare
   number. Show it as the chain of multipliers that produced it, each box
   labelled with its symbol and its clause, ending in the design value. Timber
   is the clearest case, fd = kmod · fk / γM, but concrete, steel and masonry
   all have the same shape.
3. **One utilisation bar per check, the governing one highlighted.** A member
   passes or fails on the worst check, so the screen must make that one obvious
   and let the others recede. Build the bar component once in St1 and reuse it.
4. **Verdict first, derivation on demand.** The headline is pass or fail and by
   how much. The full substitution goes in an expandable trail, the same
   pattern G2 uses for the classification decision.
5. **Clause references on every result.** A small grey clause number next to
   each value, for example EN 1992-1-1 6.2.3 or BS 8110-1 3.4.5.12. This is what
   turns a toy into something a student can take into a design office.

Scope note: these apps teach the checks, they are not a substitute for design
software and every app says so in its footer.

---

### Actions and Load Combinations (1)

**D1. Actions and Load Combinations** *(NEW, gateway app)*
Module: CE2122 and CE2022, underpins every design app.
Codes: EN 1990 with EN 1991-1-1 and 1991-1-4, against BS 6399 and BS 8110.
Concept: turning characteristic actions into design actions.
Controls: permanent, imposed, wind and snow actions, building category, the
combination expression to use.
Live figure: a stacked bar of the factored contributions for each combination,
with 6.10 beside 6.10a and 6.10b so the student sees which governs and why, and
the serviceability combinations, characteristic, frequent and quasi-permanent,
shown from the same actions.
Why it helps: students meet γG, γQ and the ψ factors as a table to memorise.
Seeing the same actions produce different design values under each expression
is what makes the table make sense. Every other design app reads its actions
from here, so this is built first.

---

### Concrete (6) — EN 1992-1-1 against BS 8110

**C1. RC Beam Designer**
Module: CE2122.
Concept: a beam taken through every limit state that governs it.
Tabs: flexure, shear, deflection, cracking.
Controls: section including flanged and T sections, concrete and steel grades,
cover, tension and compression steel, applied moment and shear.
Live figure: the rectangular stress block with the neutral axis depth and the
lever arm to scale, switching to show a doubly reinforced or a flanged section
as the geometry demands. The shear tab draws the truss analogy with the strut
angle the student chooses, between 21.8 and 45 degrees, and shows VRd,c,
VRd,max and the link spacing that follows. Deflection is the span to depth
check, cracking is the bar spacing and crack width check.
Why it helps: a real beam is never only a flexure problem. Putting the four
checks in one app shows which one actually sizes the member, and it is usually
not the one students expect.

**C2. RC Column Designer**
Module: CE2122.
Concept: axial load with moment, short and slender.
Controls: section, bar layout, grades, effective length, first order moments
about both axes.
Live figure: the N-M interaction diagram traced by sweeping the neutral axis
depth through strain compatibility, with the balanced point marked and a
draggable design point. A slenderness panel decides short against slender and
adds the nominal curvature moment when it applies. A biaxial tab shows the
interaction surface as contours.
Why it helps: the interaction diagram stays abstract until a load case falls
inside or outside it and the student can drag it across the boundary.

**C3. RC Slab Designer** *(NEW)*
Module: CE2122.
Concept: one way and two way spanning slabs, and punching shear.
Controls: panel dimensions, support conditions, loads, slab depth, column size.
Live figure: the panel in plan with the moment coefficients on each strip, the
reinforcement layout that results, and a punching shear tab drawing the control
perimeters at 2d with the shear stress on each.
Why it helps: slabs are the most common element a graduate designs and the
least visualised in teaching. The control perimeter in particular is almost
impossible to picture from the clause alone.

**C4. Detailing, Anchorage and Durability** *(NEW)*
Module: CE2122.
Concept: the rules that decide whether the reinforcement can actually deliver
the capacity that was calculated.
Controls: bar size, concrete grade, bond condition, cover, exposure class,
required fire resistance.
Live figure: a bar drawn to scale with its anchorage length, the lap length
beside it, and the multiplier chain α1 to α5 that modifies lbd. A cover panel
takes exposure class and fire period to the required nominal cover, and a
spacing panel checks the bars fit in the width with the aggregate allowance.
Why it helps: this is where student designs actually fail in practice. It is
also the part of the code that is pure lookup, which makes it ideal for an app.

**C5. Concrete Mix Design Studio**
Module: CE1132.
Concept: mix proportioning and the water-cement relationship.
Controls: target mean strength, water-cement ratio, aggregate grading,
workability.
Live figure: mix proportions by weight and volume, a strength against
water-cement plot, and a slump indication. Document the method used.
Why it helps: connects a material choice to a strength outcome, which is the
core lesson of the materials module.

**C6. Prestressed Concrete Beam**
Module: CE4012, Semester 7.
Concept: prestressing, tendon profile, stresses at transfer and in service,
and losses.
Controls: prestress force, tendon eccentricity and profile, section, span, load.
Live figure: top and bottom fibre stresses at transfer and in service drawn
side by side, the Magnel diagram of the safe zone for the force and its
eccentricity, and the short and long term loss breakdown as a waterfall.
Why it helps: prestressing confuses students because two stress states apply at
once and the critical one flips between them. Showing both together fixes it.

---

### Steel (2) — EN 1993-1-1 against BS 5950

**St1. Steel Member Capacity Checker**
Module: CE2022.
Concept: classification first, then every member resistance that follows.
Tabs: classification, tension, compression, bending, combined.
Controls: a small embedded UB, UC and hollow section table, axial force and
moment, member length and restraint positions.
Live figure: the section drawn to scale with the outstand and web c/t ratios
measured on it and the resulting class, 1 to 4. Then Nt,Rd, Nb,Rd on the right
buckling curve, Mc,Rd, and Mb,Rd from the lateral torsional buckling check with
the restraint positions shown on a small elevation. A utilisation bar for each,
governing one highlighted, and the combined axial and bending interaction.
**Build the reusable utilisation-bar component here**, then reuse it in C1, C2,
C4, C6, St2, T1, M1, F1, F2 and Tr3.
Why it helps: section class decides which formula is even legal, and students
routinely apply a plastic modulus to a class 4 section. Measuring c/t on the
drawn section makes the classification concrete.

**St2. Steel Connection Designer**
Module: CE2022.
Concept: bolted and welded connections, and base plates.
Tabs: bolt group, welds, base plate.
Controls: bolt size, grade and layout, weld leg length and run, applied shear,
tension and moment.
Live figure: the connection drawn to scale with the force path traced through
it. Bolt shear, bearing on both plies, tension with prying, and the block tear
path drawn on the plate. Fillet weld capacity per unit length with the
directional method. A base plate tab with the effective area and the bearing
pressure on the concrete.
Why it helps: bolt group geometry drives the answer and it is the one thing a
formula sheet cannot convey.

---

### Timber and Masonry (2)

**T1. Timber Member Designer**
Module: CE3122.
Codes: EN 1995-1-1 against BS 5268.
Concept: design values from characteristic values, then the member checks.
Controls: strength class C16 to D40, section, load duration class, service
class, applied bending, shear, compression and tension.
Live figure: the modification chain shown as linked boxes, kmod and γM leading
to fd, with kh, kcrit and ksys appearing when they apply. Then the stress
against capacity bars for bending about both axes, shear, compression parallel
and perpendicular to the grain, and buckling with kc.
Why it helps: the modification factors are the whole story in timber design.
Showing them as a visible chain rather than a table makes them memorable.

**M1. Masonry Wall Design**
Module: CE3122.
Codes: EN 1996-1-1 against BS 5628.
Concept: vertically and laterally loaded walls.
Controls: wall height and thickness, unit group and strength, mortar
designation, restraint conditions, vertical load and its eccentricity, wind.
Live figure: the wall in elevation and section with the effective height and
effective thickness marked, the slenderness ratio and the eccentricity leading
to the capacity reduction factor Φ, and the vertical resistance that survives.
A lateral tab shows the panel with its orthogonal strength ratio and the
arching action when the supports can provide it.
Why it helps: shows how slenderness and eccentricity quietly remove most of the
capacity of a wall that looks perfectly solid.

### Transportation Engineering (3)

**Tr1. Traffic Flow and Fundamental Diagram**
Module: CE3162 (traffic flow theory).
Concept: the speed-flow-density relationship.
Controls: sliders for free flow speed and jam density, and a point on the diagram to drag.
Live figure: the three linked plots of speed against density, flow against density and speed against flow, with the current operating point moving across all three together.
Why it helps: students memorise the fundamental diagram without feeling how the three plots are one relationship. Linked motion fixes that.

**Tr2. Highway Alignment and Curve Designer**
Module: CE3162 (highway planning and geometric elements), CE4042.
Concept: horizontal and vertical curves and sight distance.
Controls: design speed, radius, superelevation, gradients for a vertical curve.
Live figure: a plan view of the horizontal curve and a profile view of the vertical curve, with the available sight distance drawn and checked against the required value.
Why it helps: geometric design is spatial and belongs in a figure, not a table.

**Tr3. Pavement Design** *(NEW)*
Module: CE4042 Highway Engineering, CE4532 (flexible pavement, Semester 7 and 8).
Concept: layered flexible pavement and material strength.
Controls: layer thicknesses and moduli, subgrade CBR, design traffic.
Live figure: the pavement cross section with each layer, the stress and strain reducing with depth, and a check of the design against the allowable strain.
Why it helps: shows why layers get weaker with depth and how the CBR of the subgrade drives the whole thickness.

### Environmental Engineering (3)

**En1. Water and Wastewater Treatment Train**
Module: CE3152 (water quality and pollution control).
Concept: the sequence of unit operations in a treatment plant.
Controls: switch units on and off (screening, coagulation, sedimentation, filtration, disinfection), set the raw water quality.
Live figure: the process flow with each unit shown, and the water quality tracked through the train so the student sees turbidity and load fall stage by stage.
Why it helps: shows why the units sit in that order and what each one removes.

**En2. Sedimentation and Settling Simulator**
Module: CE3152 (surface water quality and treatment principles).
Concept: particle settling and tank design.
Controls: particle size and density, water temperature, tank overflow rate.
Live figure: settling particles animated in a tank cross section, with the settling velocity from Stokes' law and whether a particle is captured or carried over.
Why it helps: the overflow rate concept is abstract until the student watches particles either settle out or escape.

**En3. Dissolved Oxygen Sag Curve** *(NEW)*
Module: CE4552 Water and Wastewater Treatment (Semester 7), CE3152.
Concept: river self-purification using the Streeter-Phelps model.
Controls: waste load, river flow, reaeration and deoxygenation rates, upstream oxygen.
Live figure: the dissolved oxygen sag curve along the river with the critical point and minimum oxygen marked, updating as the load changes.
Why it helps: makes the balance between deoxygenation and reaeration visible as one curve, and shows the danger point downstream of a discharge.

---

## 5. Suggested build order

Phase the work so the highest teaching value ships first and the shared code is proven early.

1. **Phase 1, structural core.** S1 Beam SFD and BMD Studio, S2 Mohr's Circle, S3 Bending Stress. These prove the slider-and-figure pattern and the shared libraries.
2. **Phase 2, rest of core structural.** S4 to S9. Reuse the beam builder from S1 across S4 and S6.
3. **Phase 3, advanced structural.** S10 Moment Distribution, S11 Plastic Collapse, S12 Dynamics. These reuse the beam and frame drawing from earlier apps.
4. **Phase 4, geotechnical.** G1 to G6. G3 reuses the Mohr's circle engine from S2.
5. **Phase 5, design modules.** Concrete C1 to C4, Steel St1 and St2, Timber T1, Masonry M1. These share a section builder and a capacity readout.
6. **Phase 6, foundations and breadth.** F1 and F2, Transportation Tr1 to Tr3, Environmental En1 to En3.

Reuse points to plan for from the start: one beam and frame builder shared by S1, S4, S6, S10 and S11. One Mohr's circle engine shared by S2 and G3. One section builder shared by S3, C1, C4, St1, T1. One utilisation bar and pass or fail component shared by every design app.

## 6. Shared design system

Keep it consistent with Water Lab so the two suites feel like one family.

- **Modular files.** Apps can be split across files. Share common logic through small JavaScript libraries (beam builder, Mohr engine, section builder, results components). This is the main reason to prefer multiple files over single file here.
- **Offline capable.** No build step needed, and each app should run from a phone in a lab with no internet.
- **Palette:** Deep Ocean Blue and Water Blue for structure and controls, Natural Green for pass or safe states, a warm accent for fail or exceeded states.
- **Type:** Poppins for headings, Inter for body and readouts.
- **Layout:** control panel on the left or top, live figure in the centre, a compact results strip below. Consistent across every app so a student learns the interface once.
- **Rendering:** SVG for line figures (diagrams, sections, Mohr's circle), canvas where many objects animate (settling particles, buckling, vibration).
- **A common landing page** grouping the apps by discipline, matching the Water Lab index, so both suites can sit under one roof.

## 7. Optional later tracks

Not counted in the current set, but natural next steps.

- **Surveying:** levelling and reduced levels, traverse adjustment, curve setting out (CE2062, CE2142, CE3912).
- **Structural extensions:** finite element stiffness assembly and plate and shell behaviour (CE3112, CE4442).
- **Concrete and geotechnical extensions:** water retaining structure crack width (CE4012), deep foundations and pile groups (CE4032).
- **Transportation extensions:** signal timing and intersection design, traffic microsimulation (CE4352).

---

*Prepared as a build plan for a Civil Engineering study aid, companion to Water Lab by Thushan.*
