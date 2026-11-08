/* CivilLab · TrafficEngine
   Macroscopic traffic flow, the fundamental diagram q = k v.
   Units: density k in veh/km, speed v in km/h, flow q in veh/h.
   Models, each with free flow speed vf and jam density kj:
     Greenshields  v = vf (1 - k/kj),           qmax = vf kj / 4 at k = kj/2
     Greenberg     v = vm ln(kj/k), vm = vf/2,  qmax = vm kj / e at k = kj/e
     Underwood     v = vf exp(-k/ko), ko = kj/2, qmax = vf ko / e at k = ko
   The shockwave between an upstream state A and a downstream state B moves at
   uw = (qB - qA) / (kB - kA), negative meaning it travels upstream. */
const TrafficEngine = (() => {
  function model(type, vf, kj) {
    if (type === 'greenberg') {
      const vm = vf / 2;
      const v = k => k <= 0 ? Infinity : Math.max(0, vm * Math.log(kj / k));
      return { type, vm, v, q: k => k * v(k), kc: kj / Math.E, qmax: vm * kj / Math.E, vc: vm,
               kOfV: s => kj * Math.exp(-s / vm) };
    }
    if (type === 'underwood') {
      const ko = kj / 2;
      const v = k => vf * Math.exp(-k / ko);
      return { type, ko, v, q: k => k * v(k), kc: ko, qmax: vf * ko / Math.E, vc: vf / Math.E,
               kOfV: s => -ko * Math.log(Math.max(s, 1e-9) / vf) };
    }
    const v = k => Math.max(0, vf * (1 - k / kj));
    return { type:'greenshields', v, q: k => k * v(k), kc: kj / 2, qmax: vf * kj / 4, vc: vf / 2,
             kOfV: s => kj * (1 - s / vf) };
  }

  /* both densities that carry flow q under Greenshields */
  function densitiesForFlow(vf, kj, q) {
    const qmax = vf * kj / 4;
    if (q > qmax) return null;
    const r = Math.sqrt(1 - q / qmax);
    return { low: kj / 2 * (1 - r), high: kj / 2 * (1 + r) };
  }

  function state(m, k) {
    const v = m.v(k), q = m.q(k);
    return { k, v, q, headway: q > 0 ? 3600 / q : Infinity, spacing: k > 0 ? 1000 / k : Infinity,
             regime: k < m.kc ? 'uncongested' : k > m.kc ? 'congested' : 'at capacity', vc: q / m.qmax };
  }

  const shock = (a, b) => Math.abs(b.k - a.k) < 1e-12 ? 0 : (b.q - a.q) / (b.k - a.k);

  function solve(inp) {
    const m = model(inp.model, inp.vf, inp.kj);
    const A = state(m, inp.kA);
    const B = state(m, inp.kB);
    return { m, A, B, uw: shock(A, B) };
  }

  return { solve, model, state, shock, densitiesForFlow };
})();
if (typeof module !== 'undefined') module.exports = TrafficEngine;
