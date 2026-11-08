/* Engine tests for TreatmentEngine, the documented removal values stage by stage */
const E = require('../assets/js/treatment-engine.js');
let pass = 0, fail = 0;
function ok(name, got, exp, tol) {
  const good = typeof exp === 'boolean' || typeof exp === 'string' ? got === exp
    : Math.abs(got - exp) <= (tol == null ? 1e-9 : tol);
  if (good) { pass++; console.log('  ok   ' + name + ' = ' + got); }
  else { fail++; console.log('  FAIL ' + name + ' got ' + got + ' expected ' + exp + (tol != null ? ' +/- ' + tol : '')); }
}
const raw = { turb:50, tss:80, ecoli:1e4 };
const all = { screen:true, coag:true, sed:true, filter:true, disinf:true };

console.log('=== The full conventional train ===');
{
  const r = E.solve({ raw, units:all });
  ok('six stages including the raw water', r.stages.length, 6);
  ok('screening takes 5% of the solids', r.stages[1].tss, 76, 1e-9);
  ok('coagulation removes nothing itself', r.stages[2].turb, 50);
  ok('settled turbidity 15%', r.stages[3].turb, 7.5, 1e-9);
  ok('settled solids 10%', r.stages[3].tss, 7.6, 1e-9);
  ok('settling 1 log E. coli', r.stages[3].ecoli, 1e3, 1e-9);
  ok('filtered turbidity', r.stages[4].turb, 0.75, 1e-9);
  ok('filtration 2 log', r.stages[4].ecoli, 10, 1e-9);
  ok('clear water, chlorine 4 log', r.stages[5].log, 4);
  ok('final E. coli 0.001', r.final.ecoli, 1e-3, 1e-12);
  ok('total 7 log', r.totalLog, 7, 1e-9);
  ok('turbidity removal 98.5%', r.removal.turb, 0.985, 1e-12);
  ok('meets the 1 NTU target', r.u.turbDisinf <= 1, true);
  ok('meets the E. coli target', r.u.ecoli < 1, true);
}

console.log('\n=== Without coagulation ===');
{
  const r = E.solve({ raw, units:Object.assign({}, all, { coag:false }) });
  ok('plain settling 40%', r.stages[3].turb, 30, 1e-9);
  ok('plain filtration 50%', r.stages[4].turb, 15, 1e-9);
  ok('turbid water shields, chlorine only 1 log', r.stages[5].log, 1);
  ok('fails the turbidity target', r.u.turbDisinf > 1, true);
  ok('fails the E. coli target', r.u.ecoli > 1, true);
}

console.log('\n=== Direct filtration ===');
{
  const clean = E.solve({ raw:{ turb:10, tss:15, ecoli:1e3 }, units:Object.assign({}, all, { sed:false }) });
  ok('clean raw water filters to 1 NTU', clean.stages[4].turb, 1, 1e-9);
  ok('chlorine full kill at 1 NTU', clean.stages[5].log, 4);
  const dirty = E.solve({ raw, units:Object.assign({}, all, { sed:false }) });
  ok('turbid raw water overloads the filter', dirty.stages[4].turb, 15, 1e-9);
  ok('then only 1 log from chlorine', dirty.stages[5].log, 1);
}

console.log('\n=== Chlorine alone and its turbidity bands ===');
{
  const only = u => E.solve({ raw:{ turb:u, tss:5, ecoli:1e4 }, units:{ disinf:true } }).stages[5].log;
  ok('0.8 NTU gives 4 log', only(0.8), 4);
  ok('3 NTU gives 2 log', only(3), 2);
  ok('20 NTU gives 1 log', only(20), 1);
  const none = E.solve({ raw, units:{} });
  ok('nothing switched on changes nothing', none.final.turb, 50);
  ok('switched off stages carry the water through', none.stages[4].note, 'switched off');
}

console.log('\n=== Filter floor ===');
ok('filtration does not go below 0.1 NTU', E.solve({ raw:{ turb:0.5, tss:1, ecoli:10 }, units:{ coag:true, filter:true } }).stages[4].turb, 0.1, 1e-12);
ok('water already clearer is left alone', E.solve({ raw:{ turb:0.05, tss:1, ecoli:10 }, units:{ coag:true, filter:true } }).stages[4].turb, 0.05, 1e-12);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
