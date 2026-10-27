const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const bcrypt = require('bcryptjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'beacon-assignment-email-'));
const dbPath = path.join(directory, 'test.db');
fs.closeSync(fs.openSync(dbPath, 'w'));
process.env.DATABASE_URL = `file:${dbPath}`;
delete process.env.POSTGRES_PRISMA_URL;
process.env.GITHUB_TOKEN_ENCRYPTION_KEY = 'cd'.repeat(32);
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env: process.env, stdio: 'pipe' });
let session;
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'next-auth') return { getServerSession: async () => session };
  if (name === 'next-auth/providers/credentials') return { __esModule: true, default: config => config };
  if (name === 'next/cache') return { revalidatePath() {} };
  if (name === '@/lib/ai') return {};
  if (name.startsWith('@/')) name = path.join(process.cwd(), 'src', name.slice(2));
  return originalLoad.call(this, name, parent, main);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
const { prisma } = require('../src/lib/db.ts');
const auth = require('../src/lib/auth.ts');
const { resolveGitHubLogin } = require('../src/lib/github-login.ts');
const actions = require('../src/app/(dashboard)/projects/[id]/actions.ts');
const integration = require('../src/app/(dashboard)/projects/[id]/github-actions.ts');
const assigneeActions = require('../src/app/(dashboard)/projects/[id]/assignee-actions.ts');
const admin = require('../src/app/(dashboard)/admin/users/actions.ts');
const { syncIssueToGitHub } = require('../src/lib/github.ts');
const fixtures = [{ id: 101, login: 'alpha' }, { id: 102, login: 'beta' }, { id: 103, login: 'outsider' }, { id: 104, login: 'tester' }, { id: 105, login: 'viewer' }];
let available = [...fixtures];
const remote = new Map();
const comments = new Map();
let remoteNumber = 0, calls = 0, listingCalls = 0, listingFailure = 0, malformedList = false, ignoreAssignment = false, failPatch = false, failAcceptedCreate = false, forceConflict = false;
let failListingOn = -1;
let listingThrows = false, malformedPatch = false;
let onPatch = null;
let beforeTransaction = null;
let oauthEmails = [];
global.fetch = async (url, options = {}) => {
  calls++;
  const parsed = new URL(url);
  const method = options.method ?? 'GET';
  const body = options.body ? JSON.parse(options.body) : {};
  const route = parsed.pathname;
  if (route === '/user/emails') return Response.json(oauthEmails);
  assert.equal(options.headers.Authorization, 'Bearer fake-project-token');
  if (route === '/repos/acme/app') return Response.json({ has_issues: true });
  if (route.endsWith('/assignees')) {
    listingCalls++;
    if (listingThrows) throw new Error("Simulated network timeout");
    if (listingFailure || listingCalls === failListingOn) return Response.json({}, { status: listingFailure || 503 });
    if (malformedList) return Response.json([{ id: 'untrusted', login: 'alpha' }]);
    const page = Number(parsed.searchParams.get('page') ?? 1);
    return Response.json(available.slice((page - 1) * 100, page * 100));
  }
  if (route.endsWith('/comments')) {
    const number = Number(route.split('/').at(-2));
    const rows = comments.get(number) ?? [];
    if (method === 'POST') { rows.push(body); comments.set(number, rows); return Response.json(body, { status: 201 }); }
    const page = Number(parsed.searchParams.get('page') ?? 1);
    return Response.json(rows.slice((page - 1) * 100, page * 100));
  }
  if (route.endsWith('/issues')) {
    if (method === 'POST') {
      const issue = { ...body, number: ++remoteNumber, state: 'open', assignees: [] };
      remote.set(issue.number, issue);
      if (failAcceptedCreate) { failAcceptedCreate = false; return Response.json({}, { status: 503 }); }
      return Response.json(issue, { status: 201 });
    }
    return Response.json([...remote.values()]);
  }
  const number = Number(route.split('/').at(-1));
  if (method === 'PATCH') {
    if (failPatch) return Response.json({}, { status: 503 });
    const issue = remote.get(number);
    assert.ok(issue);
    const { assignees, ...fields } = body;
    Object.assign(issue, fields);
    if (assignees !== undefined && !ignoreAssignment) issue.assignees = assignees.map(login => available.find(user => user.login === login)).filter(Boolean);
    if (onPatch) { const hook = onPatch; onPatch = null; await hook(); }
    return Response.json(malformedPatch ? { number: issue.number } : issue);
  }
  throw new Error(`Unexpected mock route ${method} ${route}`);
};
const transaction = prisma.$transaction.bind(prisma);
prisma.$transaction = async (callback, ...options) => {
  if (beforeTransaction) { const hook=beforeTransaction; beforeTransaction=null; await hook(); }
  return typeof callback !== 'function' ? transaction(callback, ...options) : transaction(tx => callback(new Proxy(tx, {
  get(target, key) {
    if (key === 'issue' && forceConflict) return new Proxy(target.issue, { get(model, action) { return action === 'updateMany' ? async () => ({ count: 0 }) : Reflect.get(model, action); } });
    return Reflect.get(target, key);
  },
})), ...options);
};
const login = id => session = id ? { user: { id, email: `${id}@test.local`, role: id === 'admin' ? 'ADMIN' : 'MEMBER' } } : null;
const results = [];
async function test(name, run) {
  try { await run(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
const create = (assigneeId = 'a', title = 'Test issue') => actions.createIssueAction({ projectId: 'p', title, assigneeId });
const syncRecord = id => prisma.gitHubIssueSync.findUniqueOrThrow({ where: { issueId: id } });
const remoteIssue = async id => remote.get((await syncRecord(id)).number);
const choices = () => assigneeActions.getProjectAssigneesAction({ projectId: 'p' });
let issueId;
let attributedIssueId;
async function main() {
  const passwordHash = await bcrypt.hash('Test-password-2026!', 4);
  for (const [id, githubId, role] of [['admin', '10', 'ADMIN'], ['a', '101', 'MEMBER'], ['b', '102', 'MEMBER'], ['outside', '103', 'MEMBER'], ['qa', '104', 'MEMBER'], ['viewer', '105', 'MEMBER'], ['unlinked', null, 'MEMBER'], ['noRepo', '107', 'MEMBER']]) {
    await prisma.user.create({ data: { id, name: id, email: `${id}@test.local`, passwordHash, role, githubId, githubLogin: githubId ? `stored-${id}` : null } });
  }
  await prisma.project.create({ data: { id: 'p', key: 'ONE', name: 'One', createdById: 'admin', members: { create: [['a','DEVELOPER'],['b','DEVELOPER'],['qa','QA'],['viewer','VIEWER'],['unlinked','DEVELOPER'],['noRepo','DEVELOPER']].map(([userId, roleInProject])=>({userId,roleInProject})) } } });
  await prisma.project.create({ data: { id: 'other', key: 'OTHER', name: 'Other', createdById: 'admin', members: { create: { userId: 'outside', roleInProject: 'DEVELOPER' } } } });
  login('a');
  await test('unconnected projects retain local developer assignment', async () => { const r = await choices(); assert.ok(r.success); assert.equal(r.data.mode,'beacon'); assert.equal(r.data.developers.length,4); assert.equal(calls,0); });
  await test('only project managers can connect the repo', async () => { login('viewer'); assert.equal((await integration.connectGitHubAction({projectId:'p',owner:'acme',repo:'app',token:'fake-project-token'})).success,false); login('admin'); assert.equal((await integration.connectGitHubAction({projectId:'p',owner:'acme',repo:'app',token:'fake-project-token'})).success,true); });
  await test('eligible list intersects linked Beacon developers and repository IDs', async () => { login('qa'); const r=await choices(); assert.ok(r.success); assert.equal(r.data.mode,'github'); assert.deepEqual(r.data.developers.map(d=>d.userId),['a','b']); assert.equal(r.data.developers[0].githubLogin,'alpha'); });
  await test('outsiders and anonymous callers cannot enumerate assignees', async () => { const before=calls; for(const id of ['outside',null]) {login(id); assert.equal((await choices()).success,false);} assert.equal(calls,before); login('a'); });
  await test('forged viewer and wrong-project mutations are rejected', async () => { const before=calls; for(const id of ['viewer','outside']) {login(id);assert.equal((await create()).success,false);} assert.equal(calls,before); login('a'); });
  await test('pagination includes eligible developers beyond the first page', async () => { available=[fixtures[0],...Array.from({length:99},(_,n)=>({id:1000+n,login:`filler-${n}`})),fixtures[1]]; const before=listingCalls;const r=await choices();assert.ok(r.success);assert.equal(r.data.developers.length,2);assert.equal(listingCalls-before,2);available=[...fixtures]; });
  await test('an unlinked or cross-project target cannot be assigned', async () => { for(const id of ['unlinked','outside','noRepo','qa']) assert.equal((await create(id)).success,false); assert.equal(await prisma.issue.count(),0); });
  await test('stale choices are revalidated when repository access is removed', async () => { assert.ok((await choices()).success); available=fixtures.filter(u=>u.id!==101); assert.equal((await create()).success,false); assert.equal(await prisma.issue.count(),0); available=[...fixtures]; });
  await test('token failures fail closed without showing an unverified list', async () => { for(const status of [401,403,429,503]) {listingFailure=status;assert.equal((await choices()).success,false);assert.equal((await create()).success,false);} listingFailure=0; });
  await test('malformed GitHub data fails closed', async () => { malformedList=true;assert.equal((await choices()).success,false);malformedList=false; });
  await test('invalid project input is rejected before external calls', async () => { const before=calls;assert.equal((await assigneeActions.getProjectAssigneesAction({projectId:''})).success,false);assert.equal(calls,before); });
  await test('a saved username without a verified GitHub ID cannot match another person', async () => { await prisma.user.update({where:{id:'unlinked'},data:{githubLogin:'alpha'}});const r=await choices();assert.ok(r.success);assert.ok(!r.data.developers.some(d=>d.userId==='unlinked')); });
  await test('a truncated repository list is rejected rather than used partially', async () => { const saved=available;available=[fixtures[0],...Array.from({length:1000},(_,n)=>({id:2000+n,login:`large-${n}`}))];assert.equal((await choices()).success,false);available=saved; });
  await test('network exceptions fail closed without creating local issues', async () => { const before=await prisma.issue.count();listingThrows=true;assert.equal((await choices()).success,false);assert.equal((await create()).success,false);listingThrows=false;assert.equal(await prisma.issue.count(),before); });
  await test('creation assigns the selected GitHub user and records history', async () => { const r=await create();assert.ok(r.success,JSON.stringify(r));assert.equal(r.warning,undefined);issueId=r.data.id;assert.equal((await remoteIssue(issueId)).assignees[0].id,101);assert.equal((await syncRecord(issueId)).assignmentSynced,true);assert.ok(await prisma.issueHistory.findFirst({where:{issueId,fieldChanged:'github_assignee'}})); });
  await test('GitHub descriptions credit the real tester and ignore a forged reporter ID', async () => {
    await prisma.user.update({where:{id:'qa'},data:{name:'Tester Tara'}});login('qa');
    const r=await actions.createIssueAction({projectId:'p',title:'Tester attribution issue',assigneeId:'a',reporterId:'admin'});
    assert.ok(r.success,JSON.stringify(r));attributedIssueId=r.data.id;
    assert.equal(r.data.reporterId,'qa');
    const body=(await remoteIssue(attributedIssueId)).body;
    assert.ok(body.includes('**Reported by:** Tester Tara (Beacon)'));
    assert.ok(!body.includes('qa@test.local'));login('a');
  });
  await test('initial assignment comments credit the tester who raised the issue', async () => {
    const issue=await remoteIssue(attributedIssueId);const comment=comments.get(issue.number).at(-1).body;
    assert.ok(comment.includes('**Assigned by:** Tester Tara (Beacon)'));
    assert.ok(comment.includes('**Reported by:** Tester Tara (Beacon)'));
  });
  await test('retrying as an administrator preserves the original assignment actor', async () => {
    login('a');failPatch=true;const r=await actions.updateIssueDetailsAction(attributedIssueId,{assigneeId:'b'});failPatch=false;
    assert.ok(r.success);assert.ok(r.warning);await syncIssueToGitHub(attributedIssueId,'admin');
    const issue=await remoteIssue(attributedIssueId);const comment=comments.get(issue.number).at(-1).body;
    assert.ok(comment.includes('**Assigned by:** a (Beacon)'));
    assert.ok(!comment.includes('**Assigned by:** admin'));
    assert.ok(issue.body.includes('**Reported by:** Tester Tara (Beacon)'));
  });
  await test('status updates retain the original reporter and current assignment actor', async () => {
    login('admin');assert.ok((await actions.updateIssueStatusAction(attributedIssueId,'CLOSED')).success);
    const issue=await remoteIssue(attributedIssueId);assert.equal(issue.state,'closed');
    assert.ok(issue.body.includes('**Reported by:** Tester Tara (Beacon)'));
    assert.ok(issue.body.includes('**Assigned by:** a (Beacon)'));login('a');
  });
  await test('assignment history is credited even when a batch returns to the last synced person', async () => {
    const issue=await remoteIssue(attributedIssueId);const before=comments.get(issue.number).length;
    await prisma.gitHubConnection.update({where:{projectId:'p'},data:{enabled:false}});
    login('a');assert.ok((await actions.updateIssueDetailsAction(attributedIssueId,{assigneeId:'a'})).success);
    login('qa');assert.ok((await actions.updateIssueDetailsAction(attributedIssueId,{assigneeId:'b'})).success);
    await prisma.gitHubConnection.update({where:{projectId:'p'},data:{enabled:true}});
    await syncIssueToGitHub(attributedIssueId,'admin');
    assert.equal(comments.get(issue.number).length,before+1);
    assert.ok(comments.get(issue.number).at(-1).body.includes('**Assigned by:** Tester Tara (Beacon)'));login('a');
  });
  await test('attribution comments remain idempotent when another user retries recovery', async () => {
    const issue=await remoteIssue(attributedIssueId);const before=comments.get(issue.number).length;
    await prisma.gitHubIssueSync.update({where:{issueId:attributedIssueId},data:{assigneeSnapshot:null}});
    await syncIssueToGitHub(attributedIssueId,'admin');await syncIssueToGitHub(attributedIssueId,'b');
    assert.equal(comments.get(issue.number).length,before);
  });
  await test('names are escaped as labels rather than interpreted as GitHub Markdown', async () => {
    await prisma.user.update({where:{id:'qa'},data:{name:'Tester [Tara] (QA)'}});
    await syncIssueToGitHub(attributedIssueId,'admin');
    assert.ok((await remoteIssue(attributedIssueId)).body.includes('**Reported by:** Tester \\[Tara\\] \\(QA\\) (Beacon)'));
    await prisma.user.update({where:{id:'qa'},data:{name:'Tester Tara'}});
  });
  await test('reassignment changes both systems and records the old developer', async () => { const r=await actions.updateIssueDetailsAction(issueId,{assigneeId:'b'});assert.ok(r.success);assert.equal((await remoteIssue(issueId)).assignees[0].id,102);const h=await prisma.issueHistory.findFirst({where:{issueId,fieldChanged:'assignee'},orderBy:{changedAt:'desc'}});assert.equal(h.oldValue,'a');assert.equal(h.newValue,'b'); });
  await test('GitHub username changes are resolved by immutable account ID', async () => { available=fixtures.map(u=>u.id===101?{...u,login:'alpha-renamed'}:u);const r=await actions.updateIssueDetailsAction(issueId,{assigneeId:'a'});assert.ok(r.success);assert.equal((await remoteIssue(issueId)).assignees[0].login,'alpha-renamed');available=[...fixtures]; });
  await test('clearing an assignee also clears GitHub assignment', async () => { assert.ok((await actions.updateIssueDetailsAction(issueId,{assigneeId:null})).success);assert.deepEqual((await remoteIssue(issueId)).assignees,[]); });
  await test('silent GitHub assignment rejection remains pending and warns the user', async () => { ignoreAssignment=true;const r=await actions.updateIssueDetailsAction(issueId,{assigneeId:'b'});assert.ok(r.success);assert.match(r.warning,/pending/);const s=await syncRecord(issueId);assert.equal(s.assignmentSynced,false);assert.match(s.lastError,/did not apply/);ignoreAssignment=false;await syncIssueToGitHub(issueId,'a');assert.equal((await remoteIssue(issueId)).assignees[0].id,102);assert.equal((await syncRecord(issueId)).lastError,null); });
  await test('an incomplete GitHub success response cannot mark assignment complete', async () => { malformedPatch=true;const r=await actions.updateIssueDetailsAction(issueId,{assigneeId:'a'});assert.ok(r.success);assert.ok(r.warning);assert.equal((await syncRecord(issueId)).assignmentSynced,false);malformedPatch=false;await syncIssueToGitHub(issueId,'a');assert.equal((await syncRecord(issueId)).assignmentSynced,true); });
  await test('viewers and outsiders cannot reassign existing issues', async () => { const before=calls;for(const id of ['viewer','outside']){login(id);assert.equal((await actions.updateIssueDetailsAction(issueId,{assigneeId:'b'})).success,false);}assert.equal(calls,before);login('a'); });
  await test('access lost between validation and sync is visible and retryable', async () => { failListingOn=listingCalls+2;const r=await actions.updateIssueDetailsAction(issueId,{assigneeId:'a'});assert.ok(r.success);assert.match(r.warning,/pending/);assert.equal((await syncRecord(issueId)).assignmentSynced,false);failListingOn=-1;await syncIssueToGitHub(issueId,'a');assert.equal((await remoteIssue(issueId)).assignees[0].id,101); });
  await test('a GitHub outage preserves local changes and closure can be retried', async () => { failPatch=true;const r=await actions.updateIssueStatusAction(issueId,'CLOSED');assert.ok(r.success);assert.ok(r.warning);assert.equal((await prisma.issue.findUnique({where:{id:issueId}})).status,'CLOSED');failPatch=false;await syncIssueToGitHub(issueId,'a');assert.equal((await remoteIssue(issueId)).state,'closed');assert.ok((await actions.updateIssueStatusAction(issueId,'IN_PROGRESS')).success);assert.equal((await remoteIssue(issueId)).state,'open'); });
  await test('accepted creation with a lost response is recovered without duplicates', async () => { failAcceptedCreate=true;const before=remote.size;const r=await create('a','Lost response test');assert.ok(r.success);assert.ok(r.warning);await syncIssueToGitHub(r.data.id,'a');assert.equal(remote.size,before+1);assert.equal((await syncRecord(r.data.id)).lastError,null); });
  await test('concurrent sync requests do not create duplicate issues or comments', async () => { const s=await syncRecord(issueId);const count=comments.get(s.number).length;const before=remote.size;await Promise.all([syncIssueToGitHub(issueId,'a'),syncIssueToGitHub(issueId,'a')]);assert.equal(remote.size,before);assert.equal(comments.get(s.number).length,count); });
  await test('concurrent edits fail safely and roll back their history', async () => { const count=await prisma.issueHistory.count({where:{issueId}});forceConflict=true;const r=await actions.updateIssueDetailsAction(issueId,{assigneeId:'b'});forceConflict=false;assert.equal(r.success,false);assert.equal((await prisma.issue.findUnique({where:{id:issueId}})).assigneeId,'a');assert.equal(await prisma.issueHistory.count({where:{issueId}}),count); });
  await test('an edit during remote sync stays pending until the latest revision is synced', async () => { onPatch=async()=>{const r=await actions.updateIssueDetailsAction(issueId,{priority:'URGENT'});assert.ok(r.success);assert.ok(r.warning);};await syncIssueToGitHub(issueId,'a');let i=await prisma.issue.findUnique({where:{id:issueId}});let s=await syncRecord(issueId);assert.ok(s.syncedAt<i.updatedAt);await syncIssueToGitHub(issueId,'a');i=await prisma.issue.findUnique({where:{id:issueId}});s=await syncRecord(issueId);assert.equal(s.syncedAt.getTime(),i.updatedAt.getTime()); });
  await test('concurrent creates allocate distinct project issue numbers', async () => { const rows=await Promise.all([create('a','Concurrent create A'),create('b','Concurrent create B')]);assert.ok(rows.every(r=>r.success),JSON.stringify(rows));assert.notEqual(rows[0].data.number,rows[1].data.number); });
  await test('email changes are denied to members and anonymous callers', async () => { const before=await prisma.user.findUnique({where:{id:'qa'}});for(const id of ['a',null]){login(id);assert.equal((await admin.resetUserEmailAction({userId:'qa',email:'new@test.local',expectedEmail:'qa@test.local'})).success,false);}assert.deepEqual(await prisma.user.findUnique({where:{id:'qa'}}),before);login('admin'); });
  await test('email validation rejects malformed, duplicate, unchanged and stale values', async () => { for(const [email,expectedEmail] of [['bad','qa@test.local'],['a@test.local','qa@test.local'],['qa@test.local','qa@test.local'],['new@test.local','stale@test.local']]) assert.equal((await admin.resetUserEmailAction({userId:'qa',email,expectedEmail})).success,false);assert.equal((await admin.resetUserEmailAction({userId:'unknown',email:'new@test.local',expectedEmail:'qa@test.local'})).success,false); });
  await test('email reset cannot inject roles or GitHub identities', async () => { const before=await prisma.user.findUnique({where:{id:'qa'}});assert.equal((await admin.resetUserEmailAction({userId:'qa',email:'qa.new@test.local',expectedEmail:'qa@test.local',role:'ADMIN',githubId:'101'})).success,false);assert.deepEqual(await prisma.user.findUnique({where:{id:'qa'}}),before); });
  await test('resetting a tester email preserves password, role, and project access', async () => { const before=await prisma.user.findUnique({where:{id:'qa'}});const membership=await prisma.projectMember.findMany({where:{userId:'qa'}});const r=await admin.resetUserEmailAction({userId:'qa',email:'  QA.NEW@TEST.LOCAL  ',expectedEmail:'qa@test.local'});assert.ok(r.success,JSON.stringify(r));const after=await prisma.user.findUnique({where:{id:'qa'}});assert.equal(after.email,'qa.new@test.local');assert.equal(after.passwordHash,before.passwordHash);assert.equal(after.role,before.role);assert.equal(after.githubId,null);assert.equal(after.githubLogin,null);assert.equal(after.sessionVersion,before.sessionVersion+1);assert.deepEqual(await prisma.projectMember.findMany({where:{userId:'qa'}}),membership); });
  await test('email changes invalidate old sessions and the old password login email', async () => { const token={id:'qa',role:'MEMBER',email:'qa@test.local',sessionVersion:0};await assert.rejects(auth.authOptions.callbacks.jwt({token}),/SessionInvalidated/);const authorize=auth.authOptions.providers[0].authorize;assert.equal(await authorize({email:'qa@test.local',password:'Test-password-2026!'}),null);assert.equal((await authorize({email:'QA.NEW@TEST.LOCAL',password:'Test-password-2026!'})).id,'qa'); });
  await test('the old GitHub identity cannot bypass an email reset', async () => { oauthEmails=[{email:'qa@test.local',verified:true}];await assert.rejects(resolveGitHubLogin({id:104,login:'tester'},'104','oauth-test-token'),e=>e.code==='GitHubNoBeaconAccount');oauthEmails=[{email:'qa.new@test.local',verified:true}];assert.equal((await resolveGitHubLogin({id:104,login:'tester'},'104','oauth-test-token')).id,'qa'); });
  await test('an email reset racing an OAuth callback cannot resurrect the old GitHub identity', async () => { beforeTransaction=async()=>{const r=await admin.resetUserEmailAction({userId:'qa',email:'qa.race@test.local',expectedEmail:'qa.new@test.local'});assert.ok(r.success);};await assert.rejects(resolveGitHubLogin({id:104,login:'tester'},'104','oauth-test-token'),e=>e.code==='GitHubAccountConflict');const user=await prisma.user.findUnique({where:{id:'qa'}});assert.equal(user.githubId,null);assert.equal(user.githubLogin,null);assert.equal(user.sessionVersion,2); });
  await test('developer email reset removes eligibility and flags linked issues for retry', async () => { assert.ok((await admin.resetUserEmailAction({userId:'a',email:'a.new@test.local',expectedEmail:'a@test.local'})).success);assert.equal((await syncRecord(issueId)).assignmentSynced,false);const r=await choices();assert.ok(r.success);assert.ok(!r.data.developers.some(d=>d.userId==='a')); });
  await test('the existing Edit user route applies the same identity reset protections', async () => { const r=await admin.updateUserDetailsAction({userId:'unlinked',name:'Updated name',email:'local.new@test.local',role:'MEMBER'});assert.ok(r.success,JSON.stringify(r));assert.equal((await prisma.user.findUnique({where:{id:'unlinked'}})).sessionVersion,1); });
  await test('simultaneous duplicate email resets produce one winner without partial writes', async () => { const rows=await Promise.all([admin.resetUserEmailAction({userId:'unlinked',email:'shared@test.local',expectedEmail:'local.new@test.local'}),admin.resetUserEmailAction({userId:'noRepo',email:'shared@test.local',expectedEmail:'noRepo@test.local'})]);assert.equal(rows.filter(r=>r.success).length,1);assert.equal(await prisma.user.count({where:{email:'shared@test.local'}}),1); });
  await test('resetting the legacy administrator email cannot recreate the old default admin', async () => {
    await prisma.user.create({data:{id:'legacy-admin',name:'Legacy admin',email:'admin@gmail.com',role:'ADMIN',passwordHash}});
    const result=await admin.resetUserEmailAction({userId:'legacy-admin',email:'legacy.new@test.local',expectedEmail:'admin@gmail.com'});
    assert.ok(result.success);
    assert.equal(await auth.authOptions.providers[0].authorize({email:'admin@gmail.com',password:'5678'}),null);
    assert.equal(await prisma.user.findUnique({where:{email:'admin@gmail.com'}}),null);
  });
  await test('paused sync makes no GitHub requests and retains local developer assignment', async () => { assert.ok((await integration.disconnectGitHubAction({projectId:'p'})).success);const before=calls;const r=await choices();assert.ok(r.success);assert.equal(r.data.mode,'beacon');assert.equal(calls,before); });
  await test('a browser session update cannot inject a role, email, or GitHub identity', async () => { const refreshed=await auth.authOptions.callbacks.jwt({token:{id:'b',role:'MEMBER',sessionVersion:0},trigger:'update',session:{user:{role:'ADMIN',email:'admin@test.local',githubLogin:'admin'}}});assert.equal(refreshed.role,'MEMBER');assert.equal(refreshed.email,'b@test.local');assert.notEqual(refreshed.githubLogin,'admin'); });
  await test('deleted users and demoted roles cannot retain authorization through JWT refresh', async () => { const token={id:'b',role:'ADMIN',email:'b@test.local',sessionVersion:0};const refreshed=await auth.authOptions.callbacks.jwt({token});assert.equal(refreshed.role,'MEMBER');await assert.rejects(auth.authOptions.callbacks.jwt({token:{id:'deleted',sessionVersion:0}}),/SessionInvalidated/); });
  const passed=results.filter(r=>r.passed).length;
  console.log(`\n${passed}/${results.length} assignment/email cases passed. GitHub was stubbed; no external issues were created.`);
  fs.writeFileSync('/private/tmp/beacon-assignment-email-results.json',JSON.stringify(results,null,2));
  if(passed!==results.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await prisma.$disconnect();fs.rmSync(directory,{recursive:true,force:true});});
