// Exercise real route handlers and Prisma transactions against an isolated migrated DB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync, spawn } = require('node:child_process');
const ts = require('typescript');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'beacon-project-api-'));
process.env.DATABASE_URL = `file:${path.join(directory, 'test.db')}`;
delete process.env.POSTGRES_PRISMA_URL;
delete process.env.POSTGRES_URL;
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env: process.env, stdio: 'pipe' });
let session;
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'next-auth') return { getServerSession: async () => session };
  if (name === 'next/cache') return { revalidatePath() {} };
  if (name === '@/lib/github') return { attemptGitHubSync: async () => undefined };
  if (name.startsWith('@/')) name = path.join(process.cwd(), 'src', name.slice(2));
  return originalLoad.call(this, name, parent, main);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
const { prisma } = require('../src/lib/db.ts');
const route = require('../src/app/api/v1/projects/[projectId]/route.ts');
const discovery = require('../src/app/api/v1/projects/route.ts');
const keys = require('../src/app/(dashboard)/projects/[id]/api-actions.ts');
const { apiSession } = require('../src/lib/project-api/context.ts');
let p, other, issue, otherIssue;
async function call(key, method = 'GET', query = '', body, projectId = p.id, extra = {}) {
  const request = new Request(`https://beacon.test/api/v1/projects/${projectId}${query}`, { method, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', ...extra }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
  const response = await route[method](request, { params: Promise.resolve({ projectId }) });
  return { status: response.status, body: await response.json() };
}
async function makeKey(user, access = 'WRITE') {
  session = { user, expires: '2099-01-01' };
  const result = await keys.createProjectApiKey({ projectId: p.id, name: 'Test key', access, days: 90 });
  assert.equal(result.success, true, JSON.stringify(result));
  return result.data.key;
}
async function main() {
  const admin = await prisma.user.create({ data: { name: 'Admin', email: 'admin@test.local', passwordHash: 'secret-hash', role: 'ADMIN' } });
  const dev = await prisma.user.create({ data: { name: 'Developer', email: 'dev@test.local', passwordHash: 'secret-hash' } });
  const viewer = await prisma.user.create({ data: { name: 'Viewer', email: 'viewer@test.local', passwordHash: 'secret-hash' } });
  p = await prisma.project.create({ data: { name: 'One', key: 'ONE', createdById: admin.id, members: { create: [{ userId: dev.id, roleInProject: 'DEVELOPER' }, { userId: viewer.id, roleInProject: 'VIEWER' }] } } });
  other = await prisma.project.create({ data: { name: 'Other', key: 'OTHER', createdById: admin.id } });
  issue = await prisma.issue.create({ data: { projectId: p.id, number: 1, title: 'Original issue', reporterId: admin.id } });
  otherIssue = await prisma.issue.create({ data: { projectId: other.id, number: 1, title: 'Private issue', reporterId: admin.id } });
  const adminKey = await makeKey(admin);
  const devKey = await makeKey(dev);
  const readKey = await makeKey(viewer, 'READ');
  assert.equal((await call('bad')).status, 401);
  assert.equal((await call(adminKey, 'GET', '', undefined, other.id)).status, 403);
  assert.equal((await call(adminKey, 'GET', `?resource=issue&issueId=${otherIssue.id}`)).status, 404);
  assert.equal((await call(adminKey, 'POST', '', { action: 'update_issue', issueId: otherIssue.id, updates: { title: 'Breach' } })).status, 404);
  assert.equal((await call(readKey, 'POST', '', { action: 'add_comment', issueId: issue.id, body: 'Denied' })).status, 403);
  assert.equal((await call(devKey, 'POST', '', { action: 'assign_member', userId: viewer.id, roleInProject: 'LEAD' })).status, 403);
  assert.equal((await call(devKey, 'POST', '', { action: 'update_issue', projectId: other.id, issueId: issue.id, updates: { title: 'Breach' } })).status, 400);
  assert.equal((await call(devKey, 'POST', '', '{')).status, 400);
  assert.equal((await call(devKey, 'GET', '?limit=oops')).status, 400);
  assert.equal((await call(adminKey, 'GET', '?resource=schema')).status, 200);
  const updated = await call(devKey, 'POST', '', { action: 'update_issue', issueId: issue.id, updates: { title: 'Updated via API', environment: 'test' } }, p.id, { 'x-beacon-user-id': admin.id });
  assert.equal(updated.status, 200, JSON.stringify(updated));
  const history = await prisma.issueHistory.findMany({ where: { issueId: issue.id } });
  assert.equal(history.length, 2);
  assert(history.every(h => h.userId === dev.id), 'Actor headers must not change identity');
  for (const status of ['FIXED', 'IN_PROGRESS']) assert.equal((await call(devKey, 'POST', '', { action: 'update_status', issueId: issue.id, status })).status, 200);
  assert.equal((await call(devKey, 'POST', '', { action: 'update_status', issueId: issue.id, status: 'MADE_UP' })).status, 400);
  const created = await call(devKey, 'POST', '', { action: 'create_issue', title: 'Created via API', assigneeId: dev.id });
  assert.equal(created.status, 200, JSON.stringify(created));
  assert.equal(await prisma.issueHistory.count({ where: { issueId: created.body.data.id, fieldChanged: 'created' } }), 1);
  const comment = await call(devKey, 'POST', '', { action: 'add_comment', issueId: issue.id, body: 'A comment' });
  assert.equal(comment.status, 200);
  const attached = await call(devKey, 'POST', '', { action: 'add_attachments', issueId: issue.id, images: [{ filename: 'image.png', fileUrl: 'https://example.com/image.png', size: 12 }] });
  assert.equal(attached.status, 200);
  assert.equal((await call(devKey, 'POST', '', { action: 'delete_attachment', attachmentId: attached.body.data.attachments[0].id })).status, 200);
  const detail = await call(readKey, 'GET', `?resource=issue&issueId=${issue.id}`);
  assert.equal(detail.body.data.comments.length, 1);
  assert(!JSON.stringify(detail.body).includes('passwordHash'));
  const first = await call(readKey, 'GET', '?resource=issues&limit=1');
  assert(first.body.data.nextCursor);
  const second = await call(readKey, 'GET', `?resource=issues&limit=1&cursor=${first.body.data.nextCursor}`);
  assert.notEqual(first.body.data.items[0].id, second.body.data.items[0].id);
  assert.equal(second.body.data.nextCursor, null);
  const listed = await discovery.GET(new Request('https://beacon.test/api/v1/projects', { headers: { authorization: `Bearer ${adminKey}` } }));
  assert.equal((await listed.json()).data.length, 1);
  assert.equal(apiSession.getStore(), undefined, 'API session must not escape its request');
  await prisma.projectMember.update({ where: { projectId_userId: { projectId: p.id, userId: dev.id } }, data: { roleInProject: 'VIEWER' } });
  assert.equal((await call(devKey, 'POST', '', { action: 'add_comment', issueId: issue.id, body: 'Denied' })).status, 403);
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId: p.id, userId: dev.id } } });
  assert.equal((await call(devKey)).status, 403);
  session = { user: viewer, expires: '2099-01-01' };
  assert.equal((await keys.createProjectApiKey({ projectId: other.id, name: 'No', access: 'READ', days: 90 })).success, false);
  assert.equal((await keys.createProjectApiKey({ projectId: p.id, name: 'No', access: 'WRITE', days: 90 })).success, false);
  const own = await keys.listProjectApiKeys(p.id);
  assert.equal(own.data.length, 1);
  await keys.revokeProjectApiKey({ projectId: p.id, id: own.data[0].id });
  assert.equal((await call(readKey)).status, 401);
  const expiring = await makeKey(admin, 'READ');
  await prisma.projectApiToken.updateMany({ where: { userId: admin.id }, data: { expiresAt: new Date(0) } });
  assert.equal((await call(expiring)).status, 401);
  const invalidated = await makeKey(admin);
  await prisma.user.update({ where: { id: admin.id }, data: { sessionVersion: { increment: 1 } } });
  assert.equal((await call(invalidated)).status, 401);
  assert.equal((await prisma.issue.findUnique({ where: { id: otherIssue.id } })).title, 'Private issue');
  if (process.argv.includes('--http')) {
    const httpKey = await makeKey(admin);
    const secret = 'isolated-http-test-secret-not-for-production';
    const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', '3189'], {
      env: { ...process.env, NEXTAUTH_SECRET: secret, NEXTAUTH_URL: 'http://localhost:3189' }, stdio: 'pipe',
    });
    let logs = '';
    server.stdout.on('data', chunk => { logs += chunk; });
    server.stderr.on('data', chunk => { logs += chunk; });
    try {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (server.exitCode !== null) throw new Error(`HTTP server exited: ${logs}`);
        try { if ((await fetch('http://localhost:3189/api/v1/projects')).status === 401) { ready = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert(ready, 'HTTP server did not become ready');
      const url = `http://localhost:3189/api/v1/projects/${p.id}`;
      const headers = { authorization: `Bearer ${httpKey}`, 'content-type': 'application/json' };
      const read = await fetch(url, { headers });
      assert.equal(read.status, 200);
      assert.equal((await read.json()).data.id, p.id);
      const write = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ action: 'update_issue', issueId: issue.id, updates: { title: 'HTTP runtime verified' } }) });
      assert.equal(write.status, 200, await write.text());
      assert.equal((await prisma.issue.findUnique({ where: { id: issue.id } })).title, 'HTTP runtime verified');
      const { encode } = require('next-auth/jwt');
      const currentAdmin = await prisma.user.findUnique({ where: { id: admin.id } });
      const cookie = await encode({ secret, token: { id: admin.id, role: 'ADMIN', name: admin.name, email: admin.email, sessionVersion: currentAdmin.sessionVersion } });
      const page = await fetch(`http://localhost:3189/projects/${p.id}`, { headers: { cookie: `next-auth.session-token=${cookie}` }, redirect: 'manual' });
      assert.equal(page.status, 200);
      assert((await page.text()).includes('External app API'), 'Project must render the integration panel');
      console.log('Production HTTP smoke passed: bearer read, mutation, database persistence, authenticated project panel render.');
    } finally {
      if (server.exitCode === null && server.signalCode === null) {
        const exited = new Promise(resolve => server.once('exit', resolve));
        server.kill('SIGTERM');
        await exited;
      }
    }
  }
  console.log('Project API tests passed: isolation, role checks, read-only keys, validation, pagination, actor identity, history, reopen, attachments, expiry, revocation and session invalidation.');
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
