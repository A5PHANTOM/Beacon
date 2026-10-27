const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const Module=require('node:module');
const {execFileSync}=require('node:child_process');
const {createHmac,randomUUID}=require('node:crypto');
const ts=require('typescript');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'beacon-github-webhooks-'));
const dbPath=path.join(directory,'test.db');fs.closeSync(fs.openSync(dbPath,'w'));
process.env.DATABASE_URL=`file:${dbPath}`;delete process.env.POSTGRES_PRISMA_URL;
process.env.GITHUB_TOKEN_ENCRYPTION_KEY='ef'.repeat(32);
process.env.NEXTAUTH_URL='https://beacon.test';
execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{env:process.env,stdio:'pipe'});
let session={user:{id:'dev',role:'MEMBER'}};
const originalLoad=Module._load;
Module._load=function(name,parent,main){
 if(name==='@/lib/auth')return{requireAuth:async()=>{if(!session)throw new Error('UNAUTHORIZED');return session;}};
 if(name==='next/cache')return{revalidatePath(){}};
 if(name==='@/lib/ai')return{};
 if(name.startsWith('@/'))name=path.join(process.cwd(),'src',name.slice(2));
 return originalLoad.call(this,name,parent,main);
};
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,filename);
const {prisma}=require('../src/lib/db.ts');
const api=require('../src/lib/github-api.ts');
const service=require('../src/lib/github-webhooks.ts');
const route=require('../src/app/api/github/webhooks/[projectId]/route.ts');
const actions=require('../src/app/(dashboard)/projects/[id]/github-actions.ts');
const {syncIssueToGitHub}=require('../src/lib/github.ts');
let secret='';let hookId=77;let hooks=[];let networkFailure=false;let hookFailure=false;let calls=0;let writes=0;let nextNumber=1;
const remote=new Map();
const when='2026-10-27T13:00:00Z';
global.fetch=async(url,options={})=>{
 calls++;const u=new URL(url),method=options.method??'GET',body=options.body?JSON.parse(options.body):{};
 if(networkFailure)throw new Error('Simulated GitHub outage');
 assert.equal(options.headers.Authorization,'Bearer fake-project-token');
 if(u.pathname==='/repos/acme/app')return Response.json({id:123,has_issues:true});
 if(u.pathname.includes('/hooks')){
  if(hookFailure)return Response.json({}, {status:403});
  if(method==='GET')return Response.json(hooks);
  const record={id:hookId,active:true,events:['issues'],config:{url:body.config.url}};secret=body.config.secret;hooks=[record];writes++;return Response.json(record,{status:method==='POST'?201:200});
 }
 if(u.pathname.endsWith('/assignees'))return Response.json([{id:101,login:'developer'}]);
 if(u.pathname.endsWith('/comments'))return Response.json(method==='GET'?[]:{id:1,...body});
 if(u.pathname.endsWith('/issues'))return Response.json([...remote.values()]);
 const number=Number(u.pathname.split('/').at(-1));const issue=remote.get(number);assert.ok(issue,'Unknown mock issue');
 if(method==='PATCH'){writes++;const {assignees,...values}=body;Object.assign(issue,values);if(assignees)issue.assignees=assignees.map(login=>({id:101,login}));}
 return Response.json(issue);
};
const results=[];
async function test(name,run){try{await run();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.message});console.error('FAIL '+name+': '+error.message);}}
async function fixture(status='CLOSED',projectId='p'){
 const number=nextNumber++;
 const issue=await prisma.issue.create({data:{projectId,number,title:'Webhook issue',reporterId:'dev',assigneeId:'dev',status}});
 await prisma.gitHubIssueSync.create({data:{issueId:issue.id,number,lastConfirmedStatus:status,assignmentSynced:true}});
 remote.set(number,{id:5000+number,number,state:status==='CLOSED'?'closed':'open',updated_at:when,body:'',assignees:[{id:101,login:'developer'}]});
 return{id:issue.id,number};
}
function payload(issue,action='reopened',sender=101){const r=remote.get(issue.number);return{action,repository:{id:123},issue:{id:r.id,number:r.number,state:action==='reopened'?'open':'closed',updated_at:r.updated_at},sender:{id:sender,login:sender===101?'developer':sender===102?'tester':'sender'}};}
async function deliver(data,{id=randomUUID(),signature,projectId='p',event='issues',headerHook=String(hookId),body,signingSecret=secret}={}){
 const raw=body??JSON.stringify(data);
 const sig=signature??'sha256='+createHmac('sha256',signingSecret).update(raw).digest('hex');
 const response=await route.POST(new Request(`https://beacon.test/api/github/webhooks/${projectId}`,{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':sig,'x-github-event':event,'x-github-delivery':id,'x-github-hook-id':headerHook},body:raw}),{params:Promise.resolve({projectId})});
 return{status:response.status,data:await response.json(),id};
}
const row=id=>prisma.issue.findUniqueOrThrow({where:{id}});
async function main(){
 for(const [id,githubId,role]of[['dev','101','MEMBER'],['qa','102','MEMBER'],['viewer','103','MEMBER'],['outside','104','MEMBER'],['admin','105','ADMIN']])await prisma.user.create({data:{id,name:id,email:`${id}@test.local`,githubId,passwordHash:'unused',role}});
 await prisma.project.create({data:{id:'p',key:'HOOK',name:'Hooks',createdById:'dev',members:{create:[{userId:'dev',roleInProject:'DEVELOPER'},{userId:'qa',roleInProject:'QA'},{userId:'viewer',roleInProject:'VIEWER'}]}}});
 await prisma.project.create({data:{id:'other',key:'OTHER',name:'Other',createdById:'outside'}});
 await prisma.gitHubConnection.create({data:{projectId:'p',owner:'acme',repo:'app',encryptedToken:api.encryptGitHubToken('fake-project-token')}});
 await test('known GitHub HMAC-SHA256 test vector is accepted',async()=>{assert.ok(service.verifyGitHubSignature(Buffer.from('Hello, World!'),'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17',"It's a Secret to Everybody"));});
 await test('webhook setup requires a project developer, lead, or administrator',async()=>{const before=calls;for(const id of['qa','viewer','outside',null]){session=id?{user:{id,role:'MEMBER'}}:null;assert.equal((await actions.enableGitHubUpdatesAction({projectId:'p'})).success,false);}assert.equal(calls,before);session={user:{id:'dev',role:'MEMBER'}};});
 await test('localhost setup fails safely without modifying GitHub',async()=>{process.env.NEXTAUTH_URL='http://localhost:3000';const before=calls;assert.equal((await actions.enableGitHubUpdatesAction({projectId:'p'})).success,false);assert.equal(calls,before);process.env.NEXTAUTH_URL='https://beacon.test';});
 await test('setup registers a repository-scoped signed webhook without returning its secret',async()=>{const result=await actions.enableGitHubUpdatesAction({projectId:'p'});assert.ok(result.success,JSON.stringify(result));assert.ok(secret.length>=64);assert.ok(!JSON.stringify(result).includes(secret));const c=await prisma.gitHubConnection.findUnique({where:{projectId:'p'}});assert.equal(c.githubRepositoryId,'123');assert.equal(c.inboundEnabled,true);assert.notEqual(c.encryptedWebhookSecret,secret);});
 await test('repeating setup reuses the webhook and signing secret',async()=>{const previous=secret;assert.ok((await actions.enableGitHubUpdatesAction({projectId:'p'})).success);assert.equal(hooks.length,1);assert.equal(secret,previous);});
 await test('missing webhook-management permissions return a clean setup error',async()=>{hookFailure=true;assert.equal((await actions.enableGitHubUpdatesAction({projectId:'p'})).success,false);hookFailure=false;});
 await test('missing, malformed, and incorrect signatures cannot change an issue',async()=>{const issue=await fixture();const data=payload(issue);for(const signature of['','sha256=abc','sha256='+'00'.repeat(32)])assert.equal((await deliver(data,{signature})).status,401);assert.equal((await row(issue.id)).status,'CLOSED');assert.equal(await prisma.issueHistory.count({where:{issueId:issue.id}}),0);});
 await test('signed ping is acknowledged without writing issue history',async()=>{assert.equal((await deliver({repository:{id:123}},{event:'ping'})).status,200);});
 await test('wrong repository, hook, and project cannot spoof a status update',async()=>{const issue=await fixture();const data=payload(issue);assert.equal((await deliver({...data,repository:{id:999}})).status,403);assert.equal((await deliver(data,{headerHook:'999'})).status,403);assert.equal((await deliver(data,{projectId:'other'})).status,401);assert.equal((await row(issue.id)).status,'CLOSED');});
 await test('invalid JSON, issue payloads, and delivery IDs are rejected',async()=>{const issue=await fixture();assert.equal((await deliver(null,{body:'{'})).status,400);assert.equal((await deliver({action:'reopened'})).status,400);assert.equal((await deliver(payload(issue),{id:'not-a-uuid'})).status,400);});
 await test('oversized payloads are rejected before parsing',async()=>{assert.equal((await deliver(null,{body:'x'.repeat(1024*1024+1)})).status,413);});
 await test('unrelated events, pull requests, and unlinked issue numbers are ignored',async()=>{const issue=await fixture();const data=payload(issue);assert.equal((await deliver(data,{event:'push'})).data.ignored,true);assert.equal((await deliver({...data,action:'edited'})).data.ignored,true);assert.equal((await deliver({...data,issue:{...data.issue,pull_request:{}}})).data.ignored,true);assert.equal((await deliver({...data,issue:{...data.issue,number:9999}})).data.reason,'unlinked_or_ambiguous');});
 await test('GitHub reopen changes CLOSED to IN_PROGRESS with the real sender in history',async()=>{const issue=await fixture();remote.get(issue.number).state='open';const before=writes;const r=await deliver(payload(issue));assert.equal(r.data.status,'applied');assert.equal((await row(issue.id)).status,'IN_PROGRESS');const history=await prisma.issueHistory.findMany({where:{issueId:issue.id,fieldChanged:'status'}});assert.equal(history.length,1);assert.equal(history[0].userId,'dev');assert.equal(history[0].oldValue,'CLOSED');assert.equal(history[0].newValue,'IN_PROGRESS');assert.equal(writes,before,'incoming events must not echo a PATCH to GitHub');});
 await test('duplicate and concurrent delivery requests do not duplicate history',async()=>{const issue=await fixture();remote.get(issue.number).state='open';const data=payload(issue),id=randomUUID();await Promise.all([deliver(data,{id}),deliver(data,{id})]);await deliver(data,{id});assert.equal(await prisma.issueHistory.count({where:{issueId:issue.id,fieldChanged:'status'}}),1);assert.equal(await prisma.comment.count({where:{issueId:issue.id}}),1);});
 await test('reusing a delivery ID with a different payload is rejected',async()=>{const issue=await fixture();remote.get(issue.number).state='open';const data=payload(issue),id=randomUUID();await deliver(data,{id});assert.equal((await deliver({...data,sender:{id:102,login:'tester'}},{id})).status,409);});
 await test('a QA member with issue-update permission can reopen a linked issue',async()=>{const issue=await fixture();remote.get(issue.number).state='open';assert.equal((await deliver(payload(issue,'reopened',102))).data.status,'applied');assert.equal((await prisma.issueHistory.findFirst({where:{issueId:issue.id}})).userId,'qa');});
 await test('viewers, outsiders, and unknown GitHub users cannot mutate Beacon',async()=>{for(const sender of[103,104,999]){const issue=await fixture();remote.get(issue.number).state='open';const r=await deliver(payload(issue,'reopened',sender));assert.equal(r.data.reason,'forbidden');assert.equal((await row(issue.id)).status,'CLOSED');assert.equal(await prisma.issueHistory.count({where:{issueId:issue.id}}),0);}});
 await test('paused sync ignores incoming changes',async()=>{const issue=await fixture();remote.get(issue.number).state='open';await prisma.gitHubConnection.update({where:{projectId:'p'},data:{enabled:false}});assert.equal((await deliver(payload(issue))).data.reason,'paused');assert.equal((await row(issue.id)).status,'CLOSED');await prisma.gitHubConnection.update({where:{projectId:'p'},data:{enabled:true}});});
 await test('out-of-order events cannot overwrite the current GitHub state',async()=>{const issue=await fixture();const r=await deliver(payload(issue));assert.equal(r.data.reason,'stale');assert.equal((await row(issue.id)).status,'CLOSED');});
 await test('GitHub close updates an eligible workflow state to CLOSED',async()=>{const issue=await fixture('DEV_IN_PROGRESS');remote.get(issue.number).state='closed';assert.equal((await deliver(payload(issue,'closed'))).data.status,'applied');assert.equal((await row(issue.id)).status,'CLOSED');});
 await test('workflow rules are not bypassed for invalid close transitions',async()=>{const issue=await fixture('IN_PROGRESS');remote.get(issue.number).state='closed';const r=await deliver(payload(issue,'closed'));assert.equal(r.data.reason,'workflow');assert.equal((await row(issue.id)).status,'IN_PROGRESS');assert.equal(await prisma.issueHistory.count({where:{issueId:issue.id}}),0);});
 await test('reopen echoes do not downgrade an active pipeline state',async()=>{const issue=await fixture('DEV_REVIEW');const r=await deliver(payload(issue));assert.equal(r.data.reason,'echo');assert.equal((await row(issue.id)).status,'DEV_REVIEW');assert.equal(await prisma.issueHistory.count({where:{issueId:issue.id}}),0);});
 await test('remote issue ID mismatch cannot reuse a saved issue number',async()=>{const issue=await fixture();remote.get(issue.number).state='open';const data=payload(issue);data.issue.id+=100;assert.equal((await deliver(data)).data.reason,'stale');assert.equal((await row(issue.id)).status,'CLOSED');});
 await test('busy sync deliveries persist and apply after the lease is released',async()=>{const issue=await fixture();remote.get(issue.number).state='open';await prisma.gitHubIssueSync.update({where:{issueId:issue.id},data:{lockedUntil:new Date(Date.now()+60000)}});const r=await deliver(payload(issue));assert.equal(r.status,202);assert.equal((await row(issue.id)).status,'CLOSED');assert.equal((await prisma.gitHubWebhookDelivery.findUnique({where:{projectId_deliveryId:{projectId:'p',deliveryId:r.id}}})).processedAt,null);await prisma.gitHubIssueSync.update({where:{issueId:issue.id},data:{lockedUntil:null}});await service.drainGitHubDeliveries(issue.id);assert.equal((await row(issue.id)).status,'IN_PROGRESS');});
 await test('permissions are rechecked when a queued delivery is retried',async()=>{const issue=await fixture();remote.get(issue.number).state='open';await prisma.gitHubIssueSync.update({where:{issueId:issue.id},data:{lockedUntil:new Date(Date.now()+60000)}});await deliver(payload(issue,'reopened',102));await prisma.projectMember.delete({where:{projectId_userId:{projectId:'p',userId:'qa'}}});await prisma.gitHubIssueSync.update({where:{issueId:issue.id},data:{lockedUntil:null}});await service.drainGitHubDeliveries(issue.id);assert.equal((await row(issue.id)).status,'CLOSED');await prisma.projectMember.create({data:{projectId:'p',userId:'qa',roleInProject:'QA'}});});
 await test('network failures leave a durable update that can be retried',async()=>{const issue=await fixture();remote.get(issue.number).state='open';networkFailure=true;const r=await deliver(payload(issue));networkFailure=false;assert.equal(r.status,503);assert.equal((await row(issue.id)).status,'CLOSED');await service.drainGitHubDeliveries(issue.id);assert.equal((await row(issue.id)).status,'IN_PROGRESS');});
 await test('pending newer Beacon status intent is not overwritten by an incoming event',async()=>{const issue=await fixture();remote.get(issue.number).state='open';await prisma.gitHubIssueSync.update({where:{issueId:issue.id},data:{lastConfirmedStatus:'IN_PROGRESS'}});assert.equal((await deliver(payload(issue))).data.reason,'pending_beacon_status');assert.equal((await row(issue.id)).status,'CLOSED');});
 await test('outgoing sync drains queued events without causing a reopen loop',async()=>{const issue=await fixture();remote.get(issue.number).state='open';await prisma.gitHubIssueSync.update({where:{issueId:issue.id},data:{lockedUntil:new Date(Date.now()+60000)}});await deliver(payload(issue));await prisma.gitHubIssueSync.update({where:{issueId:issue.id},data:{lockedUntil:null}});await syncIssueToGitHub(issue.id,'dev');assert.equal((await row(issue.id)).status,'CLOSED');assert.equal(remote.get(issue.number).state,'closed');assert.equal(await prisma.gitHubWebhookDelivery.count({where:{issueId:issue.id,processedAt:null}}),0);});
 await test('incoming retry controls reject unauthorized callers',async()=>{for(const id of['viewer','qa','outside']){session={user:{id,role:'MEMBER'}};assert.equal((await actions.retryGitHubUpdatesAction({projectId:'p'})).success,false);}session={user:{id:'dev',role:'MEMBER'}};});
 const passed=results.filter(r=>r.passed).length;console.log(`\n${passed}/${results.length} GitHub webhook cases passed. GitHub API responses were simulated.`);fs.writeFileSync('/private/tmp/beacon-github-webhook-results.json',JSON.stringify(results,null,2));if(passed!==results.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await prisma.$disconnect();fs.rmSync(directory,{recursive:true,force:true});});
