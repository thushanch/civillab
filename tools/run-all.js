/* CivilLab full verification: syntax, engine physics, offline audit, headless UI.
   Usage: node tools/run-all.js  [--syntax] */
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const only = process.argv[2];
let failed = [];

function step(name, fn) {
  console.log('\n=== ' + name + ' ===');
  try { fn(); console.log('  PASS'); }
  catch (e) { failed.push(name); console.log('  FAIL'); }
}
const run = (args) => execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });

step('syntax', () => {
  const files = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'assets/js'))) if (f.endsWith('.js')) files.push('assets/js/' + f);
  for (const d of fs.readdirSync(path.join(ROOT, 'apps'))) files.push('apps/' + d + '/app.js');
  for (const f of fs.readdirSync(path.join(ROOT, 'tools'))) if (f.endsWith('.js')) files.push('tools/' + f);
  for (const f of files) execFileSync(process.execPath, ['--check', f], { cwd: ROOT });
  console.log('  ' + files.length + ' files parse');
});
if (only === '--syntax') { report(); }

step('engine physics', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'tools')))
    if (/^test-.*\.js$/.test(f)) run(['tools/' + f]);
});
step('offline audit', () => run(['tools/check-offline.js']));
step('headless UI', () => run(['tools/smoke.js']));
report();

function report() {
  console.log('\n' + (failed.length ? 'FAILED: ' + failed.join(', ') : 'everything passed'));
  process.exit(failed.length ? 1 : 0);
}
