/* CivilLab · SettlingEngine
   Discrete particle settling and the ideal rectangular settling tank.
   Units: particle diameter in mm, densities in kg/m3, temperature in deg C,
   flow in m3/day, tank dimensions in m, velocities in m/s unless named m/d.
   Water: density from the Tanaka formula, viscosity from Vogel,
     mu = 2.414e-5 x 10^(247.8 / (T + 273.15 - 140)) Pa s.
   Stokes: vs = g (rho_s - rho_w) d^2 / (18 mu), valid while Re = rho_w vs d / mu < 1.
   Above that the transitional drag Cd = 24/Re + 3/sqrt(Re) + 0.34 is solved by
   iteration with vs = sqrt(4 g (rho_s - rho_w) d / (3 Cd rho_w)).
   Ideal tank (Camp and Hazen): overflow rate vo = Q / (L W). A particle is
   wholly removed when vs >= vo and otherwise in the fraction vs / vo.
   Scour: Camp's critical horizontal velocity vc = sqrt(8 k (s - 1) g d / f)
   with k = 0.05 and f = 0.025. */
const SettlingEngine = (() => {
  const G = 9.81;
  const rhoW = T => 1000 * (1 - (T + 288.9414) / (508929.2 * (T + 68.12963)) * (T - 3.9863) ** 2);
  const muW = T => 2.414e-5 * Math.pow(10, 247.8 / (T + 273.15 - 140));

  function settle(dmm, rhos, T) {
    const d = dmm / 1000, rw = rhoW(T), mu = muW(T);
    const vStokes = G * (rhos - rw) * d * d / (18 * mu);
    const ReS = rw * Math.abs(vStokes) * d / mu;
    let v = vStokes, Re = ReS, Cd = 24 / Math.max(ReS, 1e-12), regime = 'Stokes';
    if (ReS > 1 && rhos > rw) {
      regime = 'transitional';
      v = vStokes;
      for (let i = 0; i < 200; i++) {
        Re = rw * v * d / mu;
        Cd = 24 / Re + 3 / Math.sqrt(Re) + 0.34;
        const vn = Math.sqrt(4 * G * (rhos - rw) * d / (3 * Cd * rw));
        if (Math.abs(vn - v) < 1e-12) { v = vn; break; }
        v = 0.5 * (v + vn);
      }
      Re = rw * v * d / mu;
    }
    return { d: dmm, rw, mu, vStokes, ReS, v, Re, Cd, regime, vmd: v * 86400 };
  }

  function tank(p) {
    const area = p.L * p.W;
    const vo = p.Q / area / 86400;                // m/s
    const vh = p.Q / (p.W * p.H) / 86400;
    const t = p.L * p.W * p.H / p.Q * 24;         // hours
    return { area, vo, vomd: vo * 86400, vh, t };
  }

  const removal = (vs, vo) => vs <= 0 ? 0 : Math.min(1, vs / vo);
  const scour = (dmm, rhos, rw) => Math.sqrt(8 * 0.05 * (rhos / rw - 1) * G * (dmm / 1000) / 0.025);

  const CLASSES = [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2];

  function solve(inp) {
    const tk = tank(inp);
    const main = settle(inp.d, inp.rhos, inp.T);
    const R = removal(main.v, tk.vo);
    const classes = CLASSES.map(d => { const s = settle(d, inp.rhos, inp.T); return { d, v: s.v, frac: removal(s.v, tk.vo) }; });
    const overall = classes.reduce((a, c) => a + c.frac, 0) / classes.length;
    const vc = scour(inp.d, inp.rhos, main.rw);
    /* the smallest particle wholly removed, vs = vo, under Stokes */
    const dcrit = Math.sqrt(18 * main.mu * tk.vo / (G * (inp.rhos - main.rw))) * 1000;
    return { tk, main, R, classes, overall, vc, dcrit, captured: main.v >= tk.vo,
             u:{ capture: tk.vo / Math.max(main.v, 1e-12), scour: tk.vh / vc, stokes: main.ReS } };
  }

  return { solve, settle, tank, removal, scour, rhoW, muW, CLASSES, G };
})();
if (typeof module !== 'undefined') module.exports = SettlingEngine;
