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
| Concrete | 4 | CE1132, CE2122, CE4012 (Sem 7) |
| Steel | 2 | CE2022 |
| Timber and Masonry | 2 | CE3122 |
| Transportation Engineering | 3 | CE3162, CE4042, CE4532 |
| Environmental Engineering | 3 | CE3152, CE4552 (Sem 7) |
| **Total** | **34** | |

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

### Concrete (4)

**C1. RC Beam Flexure Designer**
Module: CE2122 (design of beams).
Concept: singly and doubly reinforced section design at the ultimate limit state.
Controls: section size, concrete grade, steel grade, applied moment, tension and compression steel.
Live figure: the rectangular stress block, the neutral axis depth, and whether the section is under or over reinforced, with the moment capacity shown against the applied moment.
Why it helps: shows the stress block and the balanced condition as the reinforcement changes.

**C2. RC Column Interaction Diagram**
Module: CE2122 (design of columns).
Concept: combined axial load and moment capacity.
Controls: section, reinforcement layout, concrete and steel grades.
Live figure: the N-M interaction diagram with the balanced point marked, and a design point that the student can drag to test whether a load case is safe.
Why it helps: the interaction diagram is abstract until the student sees a load case fall inside or outside it.

**C3. Concrete Mix Design Studio**
Module: CE1132 (concrete mix design, tests on aggregates).
Concept: mix proportioning and the water-cement relationship.
Controls: target strength, water-cement ratio, aggregate grading, workability.
Live figure: the mix proportions by weight and volume, a strength against water-cement plot, and a slump indication.
Why it helps: connects a material choice to a strength outcome, which is the core lesson of the materials module.

**C4. Prestressed Concrete Beam** *(NEW)*
Module: CE4012 Design of Concrete Structures II (Semester 7).
Concept: prestressing, tendon profile, stresses at transfer and service, prestress losses.
Controls: prestress force, tendon eccentricity and profile, section, span, load.
Live figure: the stress distribution at top and bottom fibres at transfer and in service, the Magnel diagram of the safe zone, and the short and long term loss breakdown.
Why it helps: prestressing is one of the most confusing topics because two stress states apply at once. Showing both together fixes it.

### Steel (2)

**St1. Steel Member Capacity Checker**
Module: CE2022 (members in tension, compression and bending).
Concept: section classification and member capacity to Eurocode 3.
Controls: pick a section, apply axial force and moment, set the member length for buckling.
Live figure: the section class, the capacity checks for tension, compression and bending, and a utilisation bar for each.
Why it helps: shows how slenderness and section class change which failure mode governs.

**St2. Steel Connection Designer**
Module: CE2022 (design of steel connections, bolts and welds).
Concept: bolted and welded connection capacity.
Controls: bolt size and grade, bolt layout, weld size and length, applied force.
Live figure: the bolt group or weld drawn to scale with the force path, and the governing capacity check.
Why it helps: makes the bolt group geometry and its effect on capacity visible.

### Timber and Masonry (2)

**T1. Timber Member Designer**
Module: CE3122 (timber members).
Concept: timber design to Eurocode 5 with strength classes and modification factors.
Controls: strength class, section size, load duration, service class for moisture, applied bending and axial actions.
Live figure: the design stresses against the modified design strengths, with the modification factors shown as a chain of multipliers.
Why it helps: the modification factors are the whole story in timber design, and showing them as a visible chain makes them memorable.

**M1. Masonry Wall Design** *(NEW)*
Module: CE3122 (load bearing masonry, Eurocode 6).
Concept: vertically and laterally loaded masonry walls and infill panels.
Controls: wall height and thickness, unit and mortar strength, slenderness, vertical and lateral loads.
Live figure: the wall with its slenderness and eccentricity shown, the vertical load capacity, and the arching action for a laterally loaded panel.
Why it helps: shows how slenderness and eccentricity cut the capacity of a wall that looks solid.

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
