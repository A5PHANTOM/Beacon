// Real Prisma transactions against an isolated migrated SQLite database; GitHub is stubbed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'beacon-github-test-'));
const dbPath = path.join(directory, 'test.db');
fs.closeSync(fs.openSync(dbPath, 'w'));
process.env.DATABASE_URL = `file:${dbPath}`;
delete process.env.POSTGRES_PRISMA_URL;
process.env.GITHUB_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32);
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env: process.env, stdio: 'pipe' });
let session;
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  if (name === '@/lib/auth') return { requireAuth: async () => { if (!session) throw new Error('Unauthorized'); return session; } };
  if (name === 'next/cache') return { revalidatePath() {} };
  if (name === '@/lib/ai') return {};
  if (name.startsWith('@/')) name = path.join(process.cwd(), 'src', name.slice(2));
  return originalLoad.call(this, name, parent, main);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
const { prisma } = require('../src/lib/db.ts');
const integration = require('../src/app/(dashboard)/projects/[id]/github-actions.ts');
const actions = require('../src/app/(dashboard)/projects/[id]/actions.ts');
const { syncIssueToGitHub } = require('../src/lib/github.ts');
const remote = [];
const comments = [];
let unavailable = false;
let calls = 0;
global.fetch = async (url, options = {}) => {
  calls++;
  if (unavailable) return new Response('{}', { status: 503 });
  const parsed = new URL(url);
  const method = options.method ?? 'GET';
  const body = options.body ? JSON.parse(options.body) : {};
  let result;
  if (parsed.pathname === '/repos/acme/app') result = { has_issues: true };
  else if (parsed.pathname.endsWith('/comments')) {
    if (method === 'POST') { comments.push(body); result = body; } else result = comments;
  } else if (method === 'POST') { result = { ...body, number: remote.length + 1, state: 'open' }; remote.push(result); }
  else if (method === 'PATCH') { result = remote.find(i => i.number === Number(parsed.pathname.split('/').pop())); Object.assign(result, body); }
  else result = remote;
  return Response.json(result);
};
async function main() {
  for (const [id, role] of [['dev', 'MEMBER'], ['dev2', 'MEMBER'], ['viewer', 'MEMBER'], ['outsider', 'MEMBER'], ['qa', 'MEMBER']]) await prisma.user.create({ data: { id, name: id, email: `${id}@test.local`, passwordHash: 'unused', role } });
  await prisma.project.create({ data: { id: 'p', key: 'TEST', name: 'Test', createdById: 'dev', members: { create: [{ userId: 'dev', roleInProject: 'DEVELOPER' }, { userId: 'dev2', roleInProject: 'DEVELOPER' }, { userId: 'viewer', roleInProject: 'VIEWER' }, { userId: 'qa', roleInProject: 'QA' }] } } });
  const login = id => session = { user: { id, role: 'MEMBER' } };
  const config = { projectId: 'p', owner: 'acme', repo: 'app', token: 'secret-token' };
  for (const id of ['viewer', 'outsider', 'qa']) {
    login(id);
    assert.equal((await integration.connectGitHubAction(config)).success, false);
    assert.equal((await integration.retryGitHubSyncAction({ projectId: 'p' })).success, false);
    assert.equal((await integration.disconnectGitHubAction({ projectId: 'p' })).success, false);
  }
  assert.equal(calls, 0, 'wrong-role/wrong-project requests never reach GitHub');
  login('dev');
  assert.equal((await integration.connectGitHubAction(config)).success, true);
  assert.ok(!(await prisma.gitHubConnection.findUnique({ where: { projectId: 'p' } })).encryptedToken.includes(config.token));
  assert.equal((await integration.connectGitHubAction({ ...config, owner: '..' })).success, false);
  const input = { projectId: 'p', title: 'A real issue', assigneeId: 'dev' };
  for (const id of ['viewer', 'outsider']) { login(id); assert.equal((await actions.createIssueAction(input)).success, false); }
  login('dev');
  assert.equal((await actions.createIssueAction({ ...input, assigneeId: 'outsider' })).success, false);
  const created = await actions.createIssueAction(input);
  assert.equal(created.success, true, JSON.stringify(created));
  const id = created.data.id;
  assert.equal(remote.length, 1);
  assert.match(comments[0].body, /Assigned in Beacon: dev\./);
  assert.equal((await actions.updateIssueStatusAction(id, 'CLOSED')).success, true);
  assert.equal(remote[0].state, 'closed');
  assert.equal((await actions.updateIssueStatusAction(id, 'IN_PROGRESS')).success, true);
  assert.equal(remote[0].state, 'open');
  for (const user of ['viewer', 'outsider']) {
    login(user);
    assert.equal((await actions.updateIssueStatusAction(id, 'CLOSED')).success, false);
    assert.equal((await actions.updateIssueDetailsAction(id, { assigneeId: 'dev2' })).success, false);
  }
  login('dev');
  assert.equal((await actions.updateIssueDetailsAction(id, { assigneeId: 'outsider' })).success, false);
  assert.equal((await actions.updateIssueDetailsAction(id, { assigneeId: 'dev2', description: 'Updated description' })).success, true);
  assert.match(comments.at(-1).body, /Assigned in Beacon: dev2\./);
  assert.ok(await prisma.issueHistory.findFirst({ where: { issueId: id, fieldChanged: 'description' } }));
  assert.ok(await prisma.issueHistory.findFirst({ where: { issueId: id, fieldChanged: 'github' } }));
  assert.equal((await actions.updateIssueStatusAction(id, "FIXED")).success, true);
  unavailable = true;
  assert.equal((await actions.updateIssueStatusAction(id, 'CLOSED')).success, true, 'local changes survive GitHub outage');
  assert.ok((await prisma.gitHubIssueSync.findUnique({ where: { issueId: id } })).lastError);
  unavailable = false;
  assert.equal((await integration.retryGitHubSyncAction({ projectId: 'p' })).success, true);
  assert.equal(remote[0].state, 'closed');
  assert.equal((await prisma.gitHubIssueSync.findUnique({ where: { issueId: id } })).lastError, null);
  // Recover an accepted issue and comment after a failed local acknowledgement.
  const count = comments.length;
  await prisma.gitHubIssueSync.update({ where: { issueId: id }, data: { number: null, assigneeSnapshot: null } });
  await Promise.all([syncIssueToGitHub(id, 'dev'), syncIssueToGitHub(id, 'dev')]);
  assert.equal(remote.length, 1, 'recovery must not duplicate the GitHub issue');
  assert.equal(comments.length, count, "recovery must not duplicate the assignment comment");
  await syncIssueToGitHub(id, 'dev');
  assert.equal(comments.length, count, 'repeat sync must not duplicate assignment comments');
  assert.equal((await integration.disconnectGitHubAction({ projectId: 'p' })).success, true);
  const before = calls;
  await actions.updateIssueStatusAction(id, 'IN_PROGRESS');
  assert.equal(calls, before, 'paused connection does not call GitHub');
  console.log('GitHub integration passed: permissions, validation, encrypted token, create/close/reopen, assignment comments, history, outage/retry, duplicate recovery, and pause.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); fs.rmSync(directory, { recursive: true, force: true }); });
