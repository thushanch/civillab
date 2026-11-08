/* CivilLab · TreatmentEngine
   A conventional surface water treatment train, tracked stage by stage.
   Units: turbidity in NTU, suspended solids in mg/L, E. coli in CFU per 100 mL.
   The removal values are typical teaching figures, not a plant design. They
   follow the ranges in MWH, Water Treatment: Principles and Design (3rd ed.)
   and Davis and Cornwell, Introduction to Environmental Engineering, with
   pathogen removal as log credits in the spirit of the USEPA Long Term 2 rule.
     screening           removes 5% of the solids, the coarse and floating part
     coagulation         removes nothing itself, it builds floc so that the
                         next two units work far better
     sedimentation       plain 40% turbidity, 50% solids, 0.3 log E. coli
                         after coagulation 85%, 90%, 1.0 log
     rapid filtration    plain 50%, 70%, 0.5 log; after coagulation 90%, 95%,
                         2.0 log, not below 0.1 NTU. Direct filtration of water
                         above 15 NTU overloads the filter, so only 70% then
     chlorination        4 log when the water reaching it is at or below 1 NTU,
                         2 log up to 5 NTU, 1 log above, because particles
                         shield the organisms from the chlorine
   Targets: turbidity at or below 1 NTU before disinfection (WHO), 2 NTU at the
   tap (SLS 614), and no E. coli in 100 mL, taken here as below 1 CFU. */
const TreatmentEngine = (() => {
  const UNITS = ['screen', 'coag', 'sed', 'filter', 'disinf'];
  const NAMES = { screen:'Screening', coag:'Coagulation and flocculation', sed:'Sedimentation', filter:'Rapid sand filtration', disinf:'Chlorination' };

  function stage(unit, q, ctx) {
    let turb = q.turb, tss = q.tss, log = 0, note = '';
    if (unit === 'screen') { tss *= 0.95; note = 'coarse and floating solids out'; }
    else if (unit === 'coag') { note = 'floc formed, nothing removed yet'; }
    else if (unit === 'sed') {
      if (ctx.coag) { turb *= 0.15; tss *= 0.10; log = 1.0; note = 'floc settles out'; }
      else { turb *= 0.60; tss *= 0.50; log = 0.3; note = 'only the heavier particles settle'; }
    } else if (unit === 'filter') {
      if (ctx.coag && !ctx.sed && ctx.rawTurb > 15) { turb *= 0.30; tss *= 0.30; log = 1.0; note = 'direct filtration overloaded, the bed clogs'; }
      else if (ctx.coag) { turb = Math.max(turb * 0.10, Math.min(turb, 0.1)); tss *= 0.05; log = 2.0; note = 'floc strained out in the bed'; }
      else { turb *= 0.50; tss *= 0.30; log = 0.5; note = 'fine particles pass the bed'; }
    } else if (unit === 'disinf') {
      log = q.turb <= 1 ? 4 : q.turb <= 5 ? 2 : 1;
      note = q.turb <= 1 ? 'clear water, full kill' : 'particles shield the organisms';
    }
    return { turb, tss, ecoli: q.ecoli / Math.pow(10, log), log, note };
  }

  function solve(inp) {
    const on = inp.units;
    const ctx = { coag: !!on.coag, sed: !!on.sed, rawTurb: inp.raw.turb };
    let q = { turb: inp.raw.turb, tss: inp.raw.tss, ecoli: inp.raw.ecoli };
    const stages = [{ unit:'raw', name:'Raw water', on:true, turb:q.turb, tss:q.tss, ecoli:q.ecoli, log:0, note:'from the river' }];
    let preDisinfTurb = q.turb;
    UNITS.forEach(u => {
      if (!on[u]) { stages.push({ unit:u, name:NAMES[u], on:false, turb:q.turb, tss:q.tss, ecoli:q.ecoli, log:0, note:'switched off' }); return; }
      if (u === 'disinf') preDisinfTurb = q.turb;
      const r = stage(u, q, ctx);
      q = { turb:r.turb, tss:r.tss, ecoli:r.ecoli };
      stages.push({ unit:u, name:NAMES[u], on:true, turb:q.turb, tss:q.tss, ecoli:q.ecoli, log:r.log, note:r.note });
    });
    if (!on.disinf) preDisinfTurb = q.turb;
    const final = q;
    const totalLog = Math.log10(inp.raw.ecoli / Math.max(final.ecoli, 1e-12));
    return { stages, final, totalLog, preDisinfTurb,
             u:{ turbDisinf: preDisinfTurb / 1, turbTap: final.turb / 2, ecoli: final.ecoli / 1 },
             removal:{ turb: 1 - final.turb / inp.raw.turb, tss: 1 - final.tss / inp.raw.tss } };
  }

  return { solve, stage, UNITS, NAMES };
})();
if (typeof module !== 'undefined') module.exports = TreatmentEngine;
