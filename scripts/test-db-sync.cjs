const assert = require('node:assert/strict');
const { syncDatabase } = require('./db-sync');
async function run({ project = 'Project', migrations = null, history = [], drift = false, env = { VERCEL: '1', DATABASE_URL: 'postgresql://test.invalid/beacon' } } = {}) {
  const calls = [];
  let closed = false;
  class Client {
    async $queryRaw(strings) { return strings.join('').includes('to_regclass') ? [{ project, migrations }] : history; }
    async $disconnect() { closed = true; }
  }
  const action = syncDatabase({ env, Client, log() {}, exec(_command, args) {
    calls.push(args.slice(1));
    if (drift && args.includes('diff')) throw new Error('Schema drift');
  } });
  if (drift) await assert.rejects(action, /No baseline was marked/); else await action;
  return { calls, closed };
}
(async () => {
  const legacy = await run();
  assert.deepEqual(legacy.calls.map(c => c[1]), ['diff', 'resolve', 'deploy']);
  assert.ok(legacy.closed);
  const mismatch = await run({ drift: true });
  assert.deepEqual(mismatch.calls.map(c => c[1]), ['diff']);
  assert.ok(mismatch.closed);
  const managed = await run({ migrations: '_prisma_migrations', history: [{ migration_name: 'baseline' }] });
  assert.deepEqual(managed.calls.map(c => c[1]), ['deploy']);
  const fresh = await run({ project: null });
  assert.deepEqual(fresh.calls.map(c => c[1]), ['deploy']);
  const local = await run({ env: { DATABASE_URL: 'file:./dev.db' } });
  assert.equal(local.calls.length, 0);
  console.log('Migration checks passed: exact-baseline adoption, drift blocks all writes, existing history, fresh database, local build.');
})().catch(error => { console.error(error); process.exitCode = 1; });
