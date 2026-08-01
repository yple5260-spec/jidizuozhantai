import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer as createNetServer } from 'node:net'
import { createServer as createHttpServer } from 'node:http'
import { spawn } from 'node:child_process'

const projectRoot=path.resolve(import.meta.dirname,'..')

const getFreePort=()=>new Promise((resolve,reject)=>{
 const server=createNetServer()
 server.once('error',reject)
 server.listen(0,'127.0.0.1',()=>{
  const address=server.address()
  const port=typeof address==='object'&&address?address.port:0
  server.close(error=>error?reject(error):resolve(port))
 })
})

async function startServer(extraEnv={},autoAuth=true){
 const dataDir=await mkdtemp(path.join(tmpdir(),'hebei-workflow-'))
 const port=await getFreePort()
 const child=spawn(process.execPath,['server/server.js'],{
  cwd:projectRoot,
  env:{...process.env,NODE_ENV:'test',DATABASE_URL:'',API_PORT:String(port),DATA_DIR:dataDir,SESSION_SECRET:'test-session-secret-32-characters-minimum',...extraEnv},
  stdio:['ignore','pipe','pipe'],
 })
 let output=''
 child.stdout.on('data',chunk=>output+=chunk)
 child.stderr.on('data',chunk=>output+=chunk)
 const listeningPort=await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error(`服务启动超时：${output}`)),5000)
  child.stdout.on('data',chunk=>{
   const match=String(chunk).match(/localhost:(\d+)/)
   if(match){clearTimeout(timeout);resolve(Number(match[1]))}
  })
  child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`服务提前退出 ${code}：${output}`))})
 })
 const base=`http://127.0.0.1:${listeningPort}`
 const rawRequest=async(method,pathname,payload,headers={})=>{
  const response=await fetch(`${base}${pathname}`,{method,headers:{'content-type':'application/json',...headers},body:payload===undefined?undefined:JSON.stringify(payload)})
  const data=await response.json()
  return {status:response.status,data,headers:response.headers}
 }
 let defaultCookie=''
 if(autoAuth){
  const login=await rawRequest('POST','/api/auth/login',{jobNo:'JZ053684',password:'000000'})
  defaultCookie=login.headers.get('set-cookie').split(';')[0]
  const changed=await rawRequest('POST','/api/auth/change-password',{currentPassword:'000000',newPassword:'Admin2026!'},{cookie:defaultCookie})
  if(changed.status!==200)throw new Error(`测试管理员会话初始化失败：${JSON.stringify(changed.data)}`)
  defaultCookie=changed.headers.get('set-cookie').split(';')[0]
 }
 const request=(method,pathname,payload,headers={})=>rawRequest(method,pathname,payload,{...(defaultCookie?{cookie:defaultCookie}:{}),...headers})
 return {dataDir,child,request,rawRequest,defaultCookie,close:async()=>{child.kill('SIGTERM');await rm(dataDir,{recursive:true,force:true})}}
}

async function startFakeDeepSeek(){
 let received=null
 const server=createHttpServer(async(req,res)=>{
  let raw=''
  for await(const chunk of req)raw+=chunk
  received={url:req.url,authorization:req.headers.authorization,body:JSON.parse(raw||'{}')}
  const draftRequest=String(received.body?.messages?.[0]?.content||'').includes('PDCA行动草案')
  const content=draftRequest?JSON.stringify({
   title:'压降重复来电率专项行动',
   problem:'当前重复来电率4.7%，高于目标上限4.0%，差距0.7个百分点。',
   target:'今日重复来电率降至4.0%以内',
   owner:'张伟（客服班长）',
   dueAt:new Date(Date.now()+24*60*60*1000).toISOString(),
   successCriteria:'完成3名重点员工辅导并抽检6通录音，日终重复来电率不高于4.0%。',
   rationale:'重复来电率直接影响客户感知和班组产能，应优先改善。',
   collaborationRole:'质检专员',
  }):'结论：优先处理重复来电率和小休占比，并建立今日PDCA行动。'
  res.writeHead(200,{'content-type':'application/json'})
  res.end(JSON.stringify({model:'deepseek-v4-flash',choices:[{message:{role:'assistant',content}}],usage:{total_tokens:128}}))
 })
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',error=>error?reject(error):resolve()))
 const address=server.address()
 const port=typeof address==='object'&&address?address.port:0
 return {baseUrl:`http://127.0.0.1:${port}`,received:()=>received,close:()=>new Promise(resolve=>server.close(resolve))}
}

test('审批白名单和完整 PDCA 闭环',async()=>{
 const app=await startServer()
 try{
  const baseline=(await app.request('GET','/api/state')).data
  assert.equal(baseline.events.length,4)
  assert.equal(baseline.tasks.length,0)

  const invalid=await app.request('POST','/api/events/EV-001/review',{role:'supervisor',action:'banana'})
  assert.equal(invalid.status,400)
  const afterInvalid=(await app.request('GET','/api/state')).data
  assert.equal(afterInvalid.events[0].status,'pending_supervisor_review')
  assert.equal(afterInvalid.tasks.length,0)
  assert.equal(afterInvalid.audit.length,baseline.audit.length)

  const approved=await app.request('POST','/api/events/EV-001/review',{role:'supervisor',actor:'测试主管',action:'approve'})
  assert.equal(approved.status,200)
  assert.equal(approved.data.tasks.length,1)
  const taskId=approved.data.tasks[0].id

  const duplicate=await app.request('POST','/api/events/EV-001/review',{role:'supervisor',action:'approve'})
  assert.equal(duplicate.status,409)
  assert.equal((await app.request('GET','/api/state')).data.tasks.length,1)

  assert.equal((await app.request('POST',`/api/tasks/${taskId}/action`,{role:'supervisor',action:'verify_success'})).status,409)
  assert.equal((await app.request('POST',`/api/tasks/${taskId}/action`,{role:'leader',action:'start'})).status,200)
  assert.equal((await app.request('POST',`/api/tasks/${taskId}/action`,{role:'leader',action:'submit',evidence:'完成面谈和跟岗安排'})).status,200)
  const closed=await app.request('POST',`/api/tasks/${taskId}/action`,{role:'supervisor',action:'verify_success',comment:'指标恢复'})
  assert.equal(closed.status,200)
  assert.equal(closed.data.tasks[0].status,'closed')
  assert.equal(closed.data.events.find(event=>event.id==='EV-001').status,'closed')
 }finally{await app.close()}
})

test('固化先进遵循量化门槛、AI匹配与质检录音权限',async()=>{
 const app=await startServer()
 try{
  const state=(await app.request('GET','/api/state')).data
  assert.equal(state.excellence.evaluation.topPercent,20)
  assert.equal(state.excellence.employeeAchievements.length,10)
  assert.ok(state.excellence.experiences.every(item=>item.sourceTaskId&&item.evidence.length))
  const access=(await app.request('GET','/api/access')).data
  assert.ok(access.roles.find(item=>item.id==='customer-agent').menus.includes('excellence'))
  assert.ok(access.roles.find(item=>item.id==='quality-specialist').menus.includes('excellence'))

  const matched=await app.request('GET','/api/excellence/matches?query=续约承诺期重复来电')
  assert.equal(matched.status,200)
  assert.equal(matched.data.matches[0].id,'EXP-202607-001')
  assert.ok(matched.data.matches[0].matchScore>=76)

  const published=await app.request('POST','/api/excellence/experiences/EXP-202607-003/action',{role:'quality',action:'publish_ai'})
  assert.equal(published.status,200)
  assert.equal(published.data.excellence.experiences.find(item=>item.id==='EXP-202607-003').aiPublished,true)
  const forbidden=await app.request('POST','/api/excellence/recordings',{role:'employee',title:'测试录音',callId:'CALL-X',employeeName:'员工',team:'8班',business:'续约',durationSeconds:120,qualityScore:98,targetScore:95,notes:'这是一段完整且有效的亮点说明'})
  assert.equal(forbidden.status,403)
  const belowTarget=await app.request('POST','/api/excellence/recordings',{role:'quality',title:'未达标录音',callId:'CALL-Y',employeeName:'员工',team:'8班',business:'续约',durationSeconds:120,qualityScore:90,targetScore:95,notes:'这是一段完整且有效的亮点说明'})
  assert.equal(belowTarget.status,409)
  const created=await app.request('POST','/api/excellence/recordings',{role:'quality',title:'办理结果复述示范',callId:'CALL-Z',employeeJobNo:'JR10001',employeeName:'测试员工',team:'普通客服一区·8班',business:'续约业务',durationSeconds:180,qualityScore:99,targetScore:95,notes:'先确认客户诉求，再用时间线解释生效节点，最后让客户复述确认。',phrase:'我和您再对一遍办理结果与生效时间。',aiPublished:true})
  assert.equal(created.status,201)
  assert.equal(created.data.excellence.recordings[0].qualityScore,99)
  assert.equal(created.data.excellence.phrases[0].sourceRecordingId,created.data.excellence.recordings[0].id)
 }finally{await app.close()}
})

test('经理与总监经营数据严格采用河北10015全年预算和1至6月达成附件',async()=>{
 const app=await startServer()
 try{
  const state=(await app.request('GET','/api/state')).data
  assert.equal(state.financialPerformance.sources.budget.fileName,'河北基地-10015-项目预算.xls')
  assert.equal(state.financialPerformance.sources.actual.fileName,'北一各月指标查询(2026-08-01).xls')
  assert.deepEqual(state.financialPerformance.months,['202601','202602','202603','202604','202605','202606'])
  assert.deepEqual(state.financialPerformance.budgetMonths,['202601','202602','202603','202604','202605','202606','202607','202608','202609','202610','202611','202612'])
  const revenue=state.financialPerformance.metrics.find(item=>item.code==='01')
  assert.equal(revenue.budget.slice(0,6).reduce((sum,value)=>sum+value,0),13569466)
  assert.equal(revenue.budget.reduce((sum,value)=>sum+value,0),28232558)
  assert.equal(revenue.actual.reduce((sum,value)=>sum+value,0),12995076)
  assert.equal(state.governance.budgets[0].id,'BG-2026H1-10015')
  assert.equal(state.governance.budgets[0].revenueTarget,1356.95)
  assert.equal(state.governance.budgets[0].forecastRevenue,1299.51)
 }finally{await app.close()}
})

test('班前会按监督、排期、召开录音、员工浏览和专业建议形成跨岗位闭环',async()=>{
 const app=await startServer()
 try{
  const baseline=(await app.request('GET','/api/state')).data
  assert.equal(baseline.morningBriefings.teams.length,5)
  assert.equal(baseline.morningBriefings.schedules.length,7)
  assert.equal(baseline.morningBriefings.todayBulletin.points.length,3)
  const access=(await app.request('GET','/api/access')).data
  for(const roleId of ['operation-director','customer-manager','customer-supervisor','team-leader','customer-agent','quality-specialist','training-manager'])assert.ok(access.roles.find(item=>item.id===roleId).menus.includes('meeting'))

  const suggested=await app.request('POST','/api/morning-briefings/suggestions',{role:'quality',title:'重复来电专项复盘',content:'建议未来一周统一复盘续约争议录音，并完成班后抽测和结果回填。',targetTeam:'普通客服一区·4班',proposedDate:baseline.morningBriefings.schedules[1].date})
  assert.equal(suggested.status,201)
  const suggestion=suggested.data.morningBriefings.suggestions[0]
  const adopted=await app.request('POST',`/api/morning-briefings/suggestions/${suggestion.id}/action`,{role:'supervisor',action:'adopt',comment:'纳入对应日期重点'})
  assert.equal(adopted.status,200)
  assert.equal(adopted.data.morningBriefings.suggestions.find(item=>item.id===suggestion.id).status,'adopted')

  const draft=adopted.data.morningBriefings.schedules.find(item=>item.status==='draft')
  const issued=await app.request('POST',`/api/morning-briefings/schedules/${draft.id}/action`,{role:'supervisor',action:'issue',team:'普通客服一区·5班',leader:'陈敏',time:'08:25',title:'质量与产能协同复盘',focus:['昨日指标Gap','质检TOP问题','会后抽测']})
  assert.equal(issued.status,200)
  assert.equal(issued.data.morningBriefings.schedules.find(item=>item.id===draft.id).status,'issued')

  const leaderSchedule=issued.data.morningBriefings.schedules.find(item=>item.status==='issued')
  const completed=await app.request('POST',`/api/morning-briefings/schedules/${leaderSchedule.id}/action`,{role:'leader',action:'complete',fileName:'班前会录音.webm',mimeType:'audio/webm',contentBase64:Buffer.from('morning-briefing-audio').toString('base64'),durationSeconds:900})
  assert.equal(completed.status,200)
  const completedSchedule=completed.data.morningBriefings.schedules.find(item=>item.id===leaderSchedule.id)
  assert.equal(completedSchedule.status,'completed')
  assert.ok(completedSchedule.qualityScore>=80)
  assert.equal(completedSchedule.recording.fileSize,22)
  assert.equal(String(await readFile(path.join(app.dataDir,'morning-recordings',completedSchedule.recording.storageKey))), 'morning-briefing-audio')

  const helped=await app.request('POST','/api/morning-briefings/help-task',{role:'manager',team:'普通客服一区·4班'})
  assert.equal(helped.status,201)
  assert.ok(helped.data.tasks.some(item=>item.sourceLabel==='班前会质量监督'&&item.team==='普通客服一区·4班'))
 }finally{await app.close()}
})

test('复位同步恢复主文件与备份',async()=>{
 const app=await startServer()
 try{
  await app.request('POST','/api/events/EV-001/review',{role:'supervisor',action:'approve'})
  const reset=await app.request('POST','/api/reset')
  assert.equal(reset.status,200)
  assert.equal(reset.data.meta.batchNo,41)
  assert.equal(reset.data.tasks.length,0)
  assert.ok(reset.data.events.every(event=>event.status==='pending_supervisor_review'))
  const main=JSON.parse(await readFile(path.join(app.dataDir,'state.json'),'utf8'))
  const backup=JSON.parse(await readFile(path.join(app.dataDir,'state.backup.json'),'utf8'))
  assert.deepEqual(backup,main)
 }finally{await app.close()}
})

test('晨会报表创建任务单并进入PDCA流程',async()=>{
 const app=await startServer()
 try{
  const payload={source:'team-morning-brief',role:'leader',actor:'测试班长',reportDate:'2026-07-19',employee:{category:'辅导关注',position:'效率辅导',sourceRow:34,name:'冉倩',jobNo:'JZ063991',team:'李慧',reason:'应答量、ATT/AHT和CPH需结合个人目标复盘。'}}
  const created=await app.request('POST','/api/tasks',payload)
  assert.equal(created.status,201)
  assert.equal(created.data.tasks.length,1)
  const task=created.data.tasks[0]
  assert.equal(task.status,'todo')
  assert.equal(task.ownerRole,'leader')
  assert.equal(task.sourceLabel,'RPA班组晨报')
  assert.equal(task.sourceKey,'team-morning-brief:2026-07-19:JZ063991')
  assert.ok(created.data.notifications.some(item=>item.role==='leader'&&item.target==='tasks'))

  const duplicate=await app.request('POST','/api/tasks',payload)
  assert.equal(duplicate.status,409)
  assert.equal((await app.request('GET','/api/state')).data.tasks.length,1)

  const started=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',actor:'测试班长',action:'start'})
  assert.equal(started.status,200)
  assert.equal(started.data.tasks[0].status,'doing')
  const submitted=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',actor:'测试班长',action:'submit',evidence:'已完成指标复盘和跟岗辅导'})
  assert.equal(submitted.status,200)
  assert.equal(submitted.data.tasks[0].status,'pending_verification')
  const closed=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'supervisor',actor:'测试主管',action:'verify_success',comment:'改善有效'})
  assert.equal(closed.status,200)
  assert.equal(closed.data.tasks[0].status,'closed')
 }finally{await app.close()}
})

test('质检协同单进入班长PDCA并回到质检复检闭环',async()=>{
 const app=await startServer()
 try{
  const payload={
   role:'quality',actor:'测试质检',requirement:'请班长完成2通问题录音复盘和1V1辅导，并回传新录音。',
   dueAt:'2026-07-24T11:30:00+08:00',reinspectAt:'2026-07-24T14:00:00+08:00',
   successCriteria:'提交2通新录音，复检连续2通无同类问题。',
   employee:{id:'JR10913',name:'王芳',team:'普通客服一区·8班',leader:'张伟',problem:'续约规范 + 服务态度',evidence:'近7日命中4次规范问题。'},
  }
  const created=await app.request('POST','/api/quality/collaborations',payload)
  assert.equal(created.status,201)
  const task=created.data.tasks[0]
  assert.match(task.id,/^QC-\d{4}-\d{3}$/)
  assert.equal(task.ownerRole,'leader')
  assert.equal(task.status,'todo')
  assert.equal(task.sourceLabel,'质检协同单')
  assert.equal(task.verificationRole,'quality')
  assert.ok(created.data.notifications.some(item=>item.role==='leader'&&item.target==='tasks'&&item.title.includes('王芳')))

  const duplicate=await app.request('POST','/api/quality/collaborations',payload)
  assert.equal(duplicate.status,409)

  const started=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',actor:'张伟',action:'start'})
  assert.equal(started.status,200)
  assert.equal(started.data.tasks[0].status,'doing')
  const submitted=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',actor:'张伟',action:'submit',evidence:'已完成1V1辅导并提交2通新录音'})
  assert.equal(submitted.status,200)
  assert.equal(submitted.data.tasks[0].status,'pending_verification')
  assert.equal(submitted.data.tasks[0].ownerRole,'quality')
  assert.ok(submitted.data.notifications.some(item=>item.role==='quality'&&item.title.includes('待质检复检')))

  const returned=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'quality',actor:'测试质检',action:'quality_verify_fail',comment:'第2通仍存在承诺期解释缺项'})
  assert.equal(returned.status,200)
  assert.equal(returned.data.tasks[0].status,'returned_to_leader')
  assert.equal(returned.data.tasks[0].ownerRole,'leader')
  const resubmitted=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',actor:'张伟',action:'submit',evidence:'已补充承诺期专项辅导并重新提交2通录音'})
  assert.equal(resubmitted.status,200)
  assert.equal(resubmitted.data.tasks[0].ownerRole,'quality')
  const closed=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'quality',actor:'测试质检',action:'quality_verify_success',comment:'连续2通无同类问题'})
  assert.equal(closed.status,200)
  assert.equal(closed.data.tasks[0].status,'closed')
  assert.equal(closed.data.tasks[0].progress,100)
  assert.ok(closed.data.notifications.some(item=>item.role==='leader'&&item.title.includes('已闭环')))
 }finally{await app.close()}
})

test('精益任务支持AI目标建议、跨岗位指派、数据辅助验收和标准化闭环',async()=>{
 const app=await startServer()
 try{
  const suggestion=await app.request('POST','/api/tasks/target-suggestion',{
   role:'manager',issueCategory:'服务质量',issueLocation:'普通客服一区·8班 / 李倩 JR10776',
   problem:'员工人工服务满意率连续两日低于个人目标，需要定位服务动作差距。',metricCode:'satisfaction',baselineValue:93.2,
  })
  assert.equal(suggestion.status,200)
  assert.equal(suggestion.data.provider,'system')
  assert.equal(suggestion.data.suggestion.metricCode,'satisfaction')
  assert.equal(suggestion.data.suggestion.targetValue,97.2)

  const plannedStartAt=new Date(Date.now()+60*60*1000).toISOString()
  const submitDueAt=new Date(Date.now()+24*60*60*1000).toISOString()
  const verificationDueAt=new Date(Date.now()+48*60*60*1000).toISOString()
  const payload={
   source:'management-directive',role:'manager',targetRole:'quality',owner:'质检专员',
   title:'人工满意率两日改善专项',issueCategory:'服务质量',
   issueLocation:'普通客服一区·8班 / 李倩 JR10776 / 低满意录音',
   problem:'人工服务满意率连续两日低于个人目标，需定位服务动作和业务解决过程中的具体差距。',
   target:'人工服务满意率提升至不低于97.2%',
   successCriteria:'验证时读取近两日系统数据，满意率达到97.2%，并提交录音复盘和辅导记录。',
   actionPlan:'复盘近3通低满意录音，完成服务四动作校准，并每日抽检2通新录音。',
   metricCode:'satisfaction',metricLabel:'人工服务满意率',metricUnit:'%',metricDirection:'higher',
   baselineValue:93.2,targetValue:97.2,employeeCode:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',
   plannedStartAt,submitDueAt,verificationDueAt,
  }
  const created=await app.request('POST','/api/tasks',payload)
  assert.equal(created.status,201)
  const task=created.data.tasks[0]
  assert.match(task.id,/^LP-\d{8}-\d{3}$/)
  assert.equal(task.workflowKind,'lean_directive')
  assert.equal(task.initiatorRole,'manager')
  assert.equal(task.executionOwnerRole,'quality')
  assert.equal(task.verificationRole,'manager')
  assert.equal(task.phase,'P')
  assert.equal(task.nodes.length,5)
  assert.equal(task.nodes[0].status,'completed')
  assert.equal(task.metricSnapshots[0].actual,93.2)

  const forbidden=await app.request('POST','/api/tasks',{...payload,role:'supervisor'})
  assert.equal(forbidden.status,403)
  const supervisorCreated=await app.request('POST','/api/tasks',{
   ...payload,role:'supervisor',targetRole:'leader',owner:'张伟（班长）',title:'主管下发班组满意率改善任务',
  })
  assert.equal(supervisorCreated.status,201)
  assert.equal(supervisorCreated.data.tasks[0].initiatorRole,'supervisor')
  assert.equal(supervisorCreated.data.tasks[0].executionOwnerRole,'leader')
  assert.equal(supervisorCreated.data.tasks[0].verificationRole,'supervisor')
  const supervisorTask=supervisorCreated.data.tasks[0]
  const commented=await app.request('POST',`/api/tasks/${supervisorTask.id}/action`,{
   role:'director',actor:'测试总监',action:'task_comment',nodeCode:'D',
   comment:'请重点核对改善动作是否覆盖低满意录音中的服务差距，并在提交前补充量化结果。',
  })
  assert.equal(commented.status,200)
  const commentedTask=commented.data.tasks.find(item=>item.id===supervisorTask.id)
  assert.equal(commentedTask.managementRecords[0].type,'comment')
  assert.equal(commentedTask.managementRecords[0].before.nodeCode,'D')
  assert.match(commentedTask.managementRecords[0].note,/D·执行改善评论/)
  assert.match(commentedTask.history.at(-1).action,/D·执行改善评论/)
  const directorCreated=await app.request('POST','/api/tasks',{
   ...payload,role:'director',targetRole:'manager',owner:'吴欣欣（客服经理）',title:'总监下发业务线满意率改善任务',
  })
  assert.equal(directorCreated.status,201)
  assert.equal(directorCreated.data.tasks[0].initiatorRole,'director')
  assert.equal(directorCreated.data.tasks[0].executionOwnerRole,'manager')
  assert.equal(directorCreated.data.tasks[0].verificationRole,'director')
  const managerTask=directorCreated.data.tasks[0]
  const managerStarted=await app.request('POST',`/api/tasks/${managerTask.id}/action`,{role:'manager',actor:'测试经理',action:'lean_start'})
  assert.equal(managerStarted.status,200)
  assert.equal(managerStarted.data.tasks.find(item=>item.id===managerTask.id).status,'doing')
  const managerSubmitted=await app.request('POST',`/api/tasks/${managerTask.id}/action`,{
   role:'manager',actor:'测试经理',action:'lean_submit',
   evidence:'已完成三通低满意录音复盘，并完成服务四动作校准和两通新录音抽检。',
  })
  assert.equal(managerSubmitted.status,200)
  assert.equal(managerSubmitted.data.tasks.find(item=>item.id===managerTask.id).status,'pending_verification')
  assert.equal(managerSubmitted.data.tasks.find(item=>item.id===managerTask.id).ownerRole,'director')

  const followed=await app.request('POST',`/api/tasks/${task.id}/action`,{
   role:'quality',actor:'测试质检',action:'lean_follow_up',
   comment:'已完成低满意录音调取，等待班组补充当日服务记录。',
   nextFollowUpAt:new Date(Date.now()+3*60*60*1000).toISOString(),
  })
  assert.equal(followed.status,200)
  const followedTask=followed.data.tasks.find(item=>item.id===task.id)
  assert.ok(followedTask.lastFollowUpAt)
  assert.equal(followedTask.managementRecords[0].type,'follow_up')

  const intervened=await app.request('POST',`/api/tasks/${task.id}/action`,{
   role:'manager',actor:'测试经理',action:'lean_intervene',
   comment:'需在今日完成录音复盘并同步具体差错点，阻塞超过两小时立即升级。',
   nextFollowUpAt:new Date(Date.now()+4*60*60*1000).toISOString(),
  })
  assert.equal(intervened.status,200)
  const intervenedTask=intervened.data.tasks.find(item=>item.id===task.id)
  assert.equal(intervenedTask.interventionCount,1)
  assert.match(intervenedTask.interventionRequirement,/阻塞超过两小时/)
  assert.equal(intervenedTask.managementRecords[0].type,'intervention')

  const changedSubmitDueAt=new Date(Date.now()+30*60*60*1000).toISOString()
  const changedVerificationDueAt=new Date(Date.now()+54*60*60*1000).toISOString()
  const deadlineChanged=await app.request('POST',`/api/tasks/${task.id}/action`,{
   role:'manager',actor:'测试经理',action:'lean_change_deadline',
   comment:'因录音调取窗口延后，统一顺延执行与验证时间。',
   submitDueAt:changedSubmitDueAt,verificationDueAt:changedVerificationDueAt,
  })
  assert.equal(deadlineChanged.status,200)
  const deadlineTask=deadlineChanged.data.tasks.find(item=>item.id===task.id)
  assert.equal(deadlineTask.submitDueAt,changedSubmitDueAt)
  assert.equal(deadlineTask.verificationDueAt,changedVerificationDueAt)
  assert.equal(deadlineTask.nodes.find(node=>node.code==='submit').plannedAt,changedSubmitDueAt)
  assert.equal(deadlineTask.managementRecords[0].type,'deadline_change')

  const reassigned=await app.request('POST',`/api/tasks/${task.id}/action`,{
   role:'manager',actor:'测试经理',action:'lean_reassign',targetRole:'quality',owner:'王磊（质检专员）',
  })
  assert.equal(reassigned.status,200)
  const reassignedTask=reassigned.data.tasks.find(item=>item.id===task.id)
  assert.equal(reassignedTask.executionOwner,'王磊（质检专员）')
  assert.equal(reassignedTask.nodes.find(node=>node.code==='execute').owner,'王磊（质检专员）')
  assert.equal(reassignedTask.managementRecords[0].type,'reassign')

  const forbiddenIntervention=await app.request('POST',`/api/tasks/${task.id}/action`,{
   role:'employee',actor:'测试员工',action:'lean_intervene',comment:'员工岗位不能介入上级管理任务。',
  })
  assert.equal(forbiddenIntervention.status,403)
  const earlyArchive=await app.request('POST',`/api/tasks/${task.id}/action`,{
   role:'manager',actor:'测试经理',action:'lean_archive',comment:'尚未关闭不能归档',
  })
  assert.equal(earlyArchive.status,409)

  const started=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'quality',actor:'测试质检',action:'lean_start'})
  assert.equal(started.status,200)
  const startedTask=started.data.tasks.find(item=>item.id===task.id)
  assert.equal(startedTask.status,'doing')
  assert.equal(startedTask.phase,'D')

  const submitted=await app.request('POST',`/api/tasks/${task.id}/action`,{
   role:'quality',actor:'测试质检',action:'lean_submit',actualValue:97.5,
   evidence:'已复盘3通低满意录音，完成服务四动作校准，并抽检4通新录音。',
  })
  assert.equal(submitted.status,200)
  const submittedTask=submitted.data.tasks.find(item=>item.id===task.id)
  assert.equal(submittedTask.status,'pending_verification')
  assert.equal(submittedTask.ownerRole,'manager')
  assert.equal(submittedTask.metricSnapshots.at(-1).actual,97.5)

  const improvement=await app.request('GET',`/api/tasks/${task.id}/improvement?role=manager`)
  assert.equal(improvement.status,200)
  assert.equal(improvement.data.baseline,93.2)
  assert.equal(improvement.data.latest,97.5)
  assert.equal(improvement.data.targetMet,true)
  assert.match(improvement.data.conclusion,/已达到目标/)

  const closed=await app.request('POST',`/api/tasks/${task.id}/action`,{
   role:'manager',actor:'测试经理',action:'lean_verify_success',
   comment:'近两日满意率已提升至97.5%，录音抽检与辅导记录完整，确认改善有效。',
   standardizedAction:'将服务四动作校准纳入班组每日两通录音抽检，并连续跟踪七日。',
  })
  assert.equal(closed.status,200)
  const closedTask=closed.data.tasks.find(item=>item.id===task.id)
  assert.equal(closedTask.status,'closed')
  assert.equal(closedTask.phase,'A')
  assert.equal(closedTask.progress,100)
  assert.equal(closedTask.nodes.every(node=>node.status==='completed'),true)
  assert.match(closedTask.standardizedAction,/连续跟踪七日/)

  const archived=await app.request('POST',`/api/tasks/${task.id}/action`,{
   role:'manager',actor:'测试经理',action:'lean_archive',
   comment:'改善目标稳定达成，录音与辅导证据完整，转入标准化案例档案。',
  })
  assert.equal(archived.status,200)
  const archivedTask=archived.data.tasks.find(item=>item.id===task.id)
  assert.ok(archivedTask.archivedAt)
  assert.ok(archivedTask.archivedBy)
  assert.equal(archivedTask.managementRecords[0].type,'archive')

  const reopened=await app.request('POST',`/api/tasks/${task.id}/action`,{
   role:'manager',actor:'测试经理',action:'lean_reopen',
   comment:'后续抽检再次发现同类服务动作缺失，需重新进入改善并连续验证三日。',
  })
  assert.equal(reopened.status,200)
  const reopenedTask=reopened.data.tasks.find(item=>item.id===task.id)
  assert.equal(reopenedTask.status,'returned_to_origin')
  assert.equal(reopenedTask.ownerRole,'quality')
  assert.equal(reopenedTask.archivedAt,'')
  assert.equal(reopenedTask.reopenCount,1)
  assert.equal(reopenedTask.nodes.find(node=>node.code==='execute').status,'active')
  assert.equal(reopenedTask.managementRecords[0].type,'reopen')

  const requestCreated=await app.request('POST','/api/tasks',{
   ...payload,source:'role-request',role:'employee',targetRole:'training',owner:'刘颖（培训主管）',
   title:'申请续约业务口径专项培训',issueCategory:'业务能力',
   issueLocation:'客服专员李倩 JR10776 / 续约业务受理场景',
   problem:'续约业务最新口径掌握不完整，已影响一次解决，需要培训岗位提供案例讲解和通关验证。',
   target:'完成续约业务专项培训并达到通关标准',
   successCriteria:'员工完成培训、案例演练得分不低于90分，并由员工本人确认培训需求已解决。',
   actionPlan:'培训岗位安排口径讲解、案例演练和一次通关测试，并反馈培训结果。',
  })
  assert.equal(requestCreated.status,201)
  const requestTask=requestCreated.data.tasks[0]
  assert.equal(requestTask.type,'岗位需求')
  assert.equal(requestTask.sourceLabel,'岗位任务需求')
  assert.equal(requestTask.initiatorRole,'employee')
  assert.equal(requestTask.executionOwnerRole,'training')
  assert.equal(requestTask.verificationRole,'employee')
  assert.ok(requestCreated.data.notifications.some(item=>item.role==='training'&&item.title.includes('任务需求待响应')))

  const requestForbidden=await app.request('POST','/api/tasks',{
   ...payload,source:'role-request',role:'employee',targetRole:'director',owner:'运营总监',
  })
  assert.equal(requestForbidden.status,403)
  const managerRequestCreated=await app.request('POST','/api/tasks',{
   ...payload,source:'role-request',role:'manager',targetRole:'supervisor',owner:'前台客服主管',
   title:'经理发起班组满意率改善需求',
  })
  assert.equal(managerRequestCreated.status,201)
  assert.equal(managerRequestCreated.data.tasks[0].type,'岗位需求')
  assert.equal(managerRequestCreated.data.tasks[0].initiatorRole,'manager')
  assert.equal(managerRequestCreated.data.tasks[0].executionOwnerRole,'supervisor')
  assert.equal(managerRequestCreated.data.tasks[0].verificationRole,'manager')
  assert.equal((await app.request('POST',`/api/tasks/${requestTask.id}/action`,{role:'training',action:'lean_start'})).status,200)
  const requestSubmitted=await app.request('POST',`/api/tasks/${requestTask.id}/action`,{
   role:'training',action:'lean_submit',actualValue:92,
   evidence:'已完成续约口径讲解、三类案例演练和通关测试，员工测试得分92分。',
  })
  assert.equal(requestSubmitted.status,200)
  assert.equal(requestSubmitted.data.tasks.find(item=>item.id===requestTask.id).ownerRole,'employee')
  const requesterClosed=await app.request('POST',`/api/tasks/${requestTask.id}/action`,{
   role:'employee',action:'lean_verify_success',
   comment:'已完成专项学习和通关测试，续约业务疑问已解决，可以独立受理。',
   standardizedAction:'后续遇到口径变化先查阅知识库，再通过任务需求申请专项支持。',
  })
  assert.equal(requesterClosed.status,200)
  assert.equal(requesterClosed.data.tasks.find(item=>item.id===requestTask.id).status,'closed')
 }finally{await app.close()}
})

test('班组看数按工时、利用率和通话均长拆解产能Gap并支持AI降级',async()=>{
 const app=await startServer()
 try{
  const member={
   jobNo:'JR-ATTR-001',name:'归因测试员工',team:'普通客服一区·8班',
   responses:{actual:86,target:136},cph:{actual:12.29,target:17},
   workHours:{actual:7,target:8},utilization:{actual:75,target:85},
   handleTime:{actual:210,target:180},busyRest:{actual:13.5,target:7},
   sourceImpacts:{workHours:-17,utilization:-14,talkTime:-10,afterCall:-5,busyRest:-6},
  }
  const result=await app.request('POST','/api/ai/team-attribution',{role:'leader',member})
  assert.equal(result.status,200)
  assert.equal(result.data.provider,'system')
  assert.equal(result.data.calculation.responseGap,-50)
  assert.equal(result.data.calculation.formulaTarget,136)
  assert.equal(result.data.calculation.formulaActual,90)
  assert.equal(result.data.drivers.find(item=>item.code==='work_hours').status,'risk')
  assert.equal(result.data.drivers.find(item=>item.code==='utilization').status,'risk')
  assert.equal(result.data.drivers.find(item=>item.code==='handle_time').status,'risk')
  assert.match(result.data.conclusion,/首要负向因素为签入工时/)
  assert.match(result.data.utilizationFormula,/通话总时长/)
  const forbidden=await app.request('POST','/api/ai/team-attribution',{role:'employee',member})
  assert.equal(forbidden.status,403)
 }finally{await app.close()}
})

test('质检计划、抽检、申诉、校准与案例库形成生产闭环',async()=>{
 const app=await startServer()
 try{
  const baseline=(await app.request('GET','/api/state')).data
  const plan=baseline.quality.plans[0]
  assert.equal(plan.completedSamples,148)
  assert.equal(baseline.quality.records.length,4)
  assert.equal(baseline.quality.appeals.length,2)
  assert.equal((await app.request('POST',`/api/quality/plans/${plan.id}/action`,{role:'quality',action:'close'})).status,409)

  const recordCreated=await app.request('POST','/api/quality/records',{
   role:'quality',planId:plan.id,callId:'CALL-TEST-QUALITY-001',employeeId:'JR11005',employeeName:'孙雷',team:'普通客服一区·8班',
   business:'套餐办理',score:74,result:'failed',severity:'major',problem:'套餐办理结果未复述，客户未确认生效时间。',
   standard:'一次解决质检标准 V2.8',evidence:'测试录音 04:10—04:42',
  })
  assert.equal(recordCreated.status,201)
  const record=recordCreated.data.quality.records.find(item=>item.callId==='CALL-TEST-QUALITY-001')
  assert.ok(record)
  assert.equal(recordCreated.data.quality.plans[0].completedSamples,149)
  assert.ok(recordCreated.data.notifications.some(item=>item.role==='leader'&&item.title.includes('质检问题待确认')))
  assert.equal((await app.request('POST','/api/quality/records',{
   role:'quality',planId:plan.id,callId:'CALL-TEST-QUALITY-001',employeeId:'JR11005',employeeName:'孙雷',team:'普通客服一区·8班',score:90,result:'passed',severity:'none',
  })).status,409)

  const appealCreated=await app.request('POST','/api/quality/appeals',{role:'leader',recordId:record.id,reason:'完整录音显示办理结果已在前段复述，申请结合上下文重新核对问题等级。'})
  assert.equal(appealCreated.status,201)
  const appeal=appealCreated.data.quality.appeals.find(item=>item.recordId===record.id)
  assert.equal(appeal.status,'pending_quality_review')
  const started=await app.request('POST',`/api/quality/appeals/${appeal.id}/action`,{role:'quality',action:'start',comment:'已调取完整录音和标准条款'})
  assert.equal(started.status,200)
  assert.equal(started.data.quality.appeals.find(item=>item.id===appeal.id).status,'reviewing')
  const overturned=await app.request('POST',`/api/quality/appeals/${appeal.id}/action`,{role:'quality',action:'overturn',comment:'完整录音前段已完成结果复述，原截取片段上下文不完整，本次改判。'})
  assert.equal(overturned.status,200)
  assert.equal(overturned.data.quality.records.find(item=>item.id===record.id).result,'adjusted')
  assert.ok(overturned.data.notifications.some(item=>item.role==='manager'&&item.title.includes('质检申诉改判')))

  const calibration=baseline.quality.calibrations[0]
  const calibrationDone=await app.request('POST',`/api/quality/calibrations/${calibration.id}/action`,{role:'quality',action:'complete',actualConsistency:91.8,conclusion:'同题盲评显示客户打断和承诺期解释判定仍存在分歧，需要统一口径并复校。'})
  assert.equal(calibrationDone.status,200)
  assert.equal(calibrationDone.data.quality.calibrations[0].status,'action_required')
  assert.ok(calibrationDone.data.training.programs.some(item=>item.source===`质检校准${calibration.id}`))
  assert.ok(calibrationDone.data.notifications.some(item=>item.role==='training'&&item.title.includes('质检口径纠偏')))

  const draft=baseline.quality.cases.find(item=>item.status==='draft')
  const published=await app.request('POST',`/api/quality/cases/${draft.id}/action`,{role:'quality',action:'publish'})
  assert.equal(published.status,200)
  assert.equal(published.data.quality.cases.find(item=>item.id===draft.id).status,'published')
  assert.ok(published.data.notifications.some(item=>item.role==='leader'&&item.title.includes('新质量案例')))

  const updated=await app.request('POST',`/api/quality/plans/${plan.id}/action`,{role:'quality',action:'update',completedSamples:150,actualEmployeeCoverage:30.5,actualTimelyRate:96})
  assert.equal(updated.status,200)
  const closed=await app.request('POST',`/api/quality/plans/${plan.id}/action`,{role:'quality',action:'close'})
  assert.equal(closed.status,200)
  assert.equal(closed.data.quality.plans[0].status,'closed')
  assert.ok(closed.data.notifications.some(item=>item.role==='manager'&&item.title.includes('质检计划已关闭')))
  assert.equal((await app.request('POST','/api/quality/records',{
   role:'quality',planId:plan.id,callId:'CALL-TEST-QUALITY-002',employeeId:'JR11005',employeeName:'孙雷',team:'普通客服一区·8班',score:95,result:'passed',severity:'none',
  })).status,409)
 }finally{await app.close()}
})

test('HRBP编制招聘、培训入列、组织异动、劳动关系、成本与访谈形成生产闭环',async()=>{
 const app=await startServer()
 try{
  const baseline=(await app.request('GET','/api/state')).data
  assert.equal(baseline.people.version,1)
  assert.equal(baseline.people.staffingPlans[0].gap,16)
  assert.equal(baseline.people.lifecycle.find(item=>item.source==='COH-202607-01').status,'training_pending')

  const staffingId=baseline.people.staffingPlans[0].id
  const pipeline=await app.request('POST',`/api/hrbp/staffing/${staffingId}/action`,{role:'hrbp',action:'update_pipeline',interviewed:43,offersAccepted:23,onboarded:19})
  assert.equal(pipeline.status,200)
  assert.equal(pipeline.data.people.staffingPlans[0].onboarded,19)
  const staffingSubmitted=await app.request('POST',`/api/hrbp/staffing/${staffingId}/action`,{role:'hrbp',action:'submit_gap_plan'})
  assert.equal(staffingSubmitted.status,200)
  assert.equal(staffingSubmitted.data.people.staffingPlans[0].status,'manager_pending')
  assert.ok(staffingSubmitted.data.notifications.some(item=>item.role==='manager'&&item.title.includes('补员方案待审批')))
  const staffingApproved=await app.request('POST',`/api/hrbp/staffing/${staffingId}/action`,{role:'manager',action:'manager_approve',comment:'同意按渠道计划推进'})
  assert.equal(staffingApproved.status,200)
  assert.equal(staffingApproved.data.people.staffingPlans[0].status,'active')

  for(const id of ['TRN-001','TRN-003']){
   const assessment=await app.request('PUT',`/api/training/trainees/${id}/assessment`,{
    role:'training',attendance:98,theoryScore:90,practiceScore:82,scenarioScore:82,profileComplete:92,
    ability:{business:82,system:82,communication:82},supportPlan:'达到通关线，入列后由班长继续跟踪新人期目标。',
   })
   assert.equal(assessment.status,200)
  }
  const clearance=await app.request('POST','/api/training/cohorts/COH-202607-01/stages/clearance/action',{role:'training',progress:100,evidence:'6名样本学员理论、实操与场景考试均达到通关标准。'})
  assert.equal(clearance.status,200)
  const onboarding=clearance.data.people.lifecycle.find(item=>item.source==='COH-202607-01')
  assert.equal(onboarding.status,'hrbp_preparing')
  assert.equal(onboarding.personCount,6)
  assert.ok(clearance.data.notifications.some(item=>item.role==='hrbp'&&item.title.includes('新工合格名单待入列')))

  const transferId=baseline.people.lifecycle.find(item=>item.type==='transfer').id
  const prepared=await app.request('POST',`/api/hrbp/lifecycle/${transferId}/action`,{role:'hrbp',action:'prepare',contract:true,medical:true,account:true,shift:true,team:true})
  assert.equal(prepared.status,200)
  const transferSubmitted=await app.request('POST',`/api/hrbp/lifecycle/${transferId}/action`,{role:'hrbp',action:'submit_manager'})
  assert.equal(transferSubmitted.status,200)
  assert.equal(transferSubmitted.data.people.lifecycle.find(item=>item.id===transferId).status,'manager_pending')
  const transferApproved=await app.request('POST',`/api/hrbp/lifecycle/${transferId}/action`,{role:'manager',action:'manager_approve',comment:'同意调动'})
  assert.equal(transferApproved.status,200)
  const transferCompleted=await app.request('POST',`/api/hrbp/lifecycle/${transferId}/action`,{role:'hrbp',action:'complete'})
  assert.equal(transferCompleted.status,200)
  assert.equal(transferCompleted.data.workforce.employees.find(item=>item.id==='EMP-10913').team,'普通客服一区·6班')
  assert.equal(transferCompleted.data.people.lifecycle.find(item=>item.id===transferId).status,'closed')

  const laborId='LR-20260725-001'
  assert.equal((await app.request('POST',`/api/hrbp/labor/${laborId}/action`,{role:'hrbp',action:'start'})).status,200)
  const laborEscalated=await app.request('POST',`/api/hrbp/labor/${laborId}/action`,{role:'hrbp',action:'escalate_manager',result:'员工愿意续签，需经理确认岗位编制与续签意见。'})
  assert.equal(laborEscalated.status,200)
  assert.equal(laborEscalated.data.people.laborCases.find(item=>item.id===laborId).status,'manager_pending')
  assert.equal((await app.request('POST',`/api/hrbp/labor/${laborId}/action`,{role:'manager',action:'manager_start'})).status,200)
  const laborClosed=await app.request('POST',`/api/hrbp/labor/${laborId}/action`,{role:'manager',action:'close',result:'同意续签，HRBP按标准合同期限办理并归档。'})
  assert.equal(laborClosed.status,200)
  assert.equal(laborClosed.data.people.laborCases.find(item=>item.id===laborId).status,'closed')

  const costId=baseline.people.costs[0].id
  const costUpdated=await app.request('POST',`/api/hrbp/costs/${costId}/action`,{role:'hrbp',action:'update_forecast',actual:3500000,forecast:4400000})
  assert.equal(costUpdated.status,200)
  assert.equal(costUpdated.data.people.costs[0].gap,140000)
  assert.ok(costUpdated.data.notifications.some(item=>item.role==='manager'&&item.title.includes('人员成本预计超预算')))

  const interviewId=baseline.people.interviews.find(item=>item.status==='planned').id
  const interviewDone=await app.request('POST',`/api/hrbp/interviews/${interviewId}/action`,{role:'hrbp',action:'complete',conclusion:'员工适应基本稳定，明确新人期质量与产能目标。',commitments:['班长连续一周目标辅导','HRBP一周后回访']})
  assert.equal(interviewDone.status,200)
  assert.equal(interviewDone.data.people.interviews.find(item=>item.id===interviewId).status,'followup_due')
  const interviewClosed=await app.request('POST',`/api/hrbp/interviews/${interviewId}/action`,{role:'hrbp',action:'close',conclusion:'承诺动作已完成，员工状态稳定。'})
  assert.equal(interviewClosed.status,200)
  assert.equal(interviewClosed.data.people.interviews.find(item=>item.id===interviewId).status,'closed')
 }finally{await app.close()}
})

test('题库场次、员工考试、班长验效、员工建议与成长评估形成学习闭环',async()=>{
 const app=await startServer()
 try{
  const baseline=(await app.request('GET','/api/state')).data
  assert.equal(baseline.learning.version,2)
  assert.equal(baseline.learning.questionBanks.length,2)
  assert.equal(baseline.learning.assignments.find(item=>item.id==='LA-20260725-001').status,'assigned')

  const bankId='QB-10015-RENEW-V4'
  const publishBlocked=await app.request('POST',`/api/learning/banks/${bankId}/action`,{role:'training',action:'publish'})
  assert.equal(publishBlocked.status,409)
  const bankUpdated=await app.request('POST',`/api/learning/banks/${bankId}/action`,{role:'training',action:'update',questionCount:40,passingScore:85})
  assert.equal(bankUpdated.status,200)
  const bankPublished=await app.request('POST',`/api/learning/banks/${bankId}/action`,{role:'training',action:'publish'})
  assert.equal(bankPublished.status,200)
  assert.equal(bankPublished.data.learning.questionBanks.find(item=>item.id===bankId).status,'published')

  const sessionId='LS-20260725-001'
  const sessionStarted=await app.request('POST',`/api/learning/sessions/${sessionId}/action`,{role:'training',action:'start'})
  assert.equal(sessionStarted.status,200)
  assert.equal((await app.request('POST',`/api/learning/sessions/${sessionId}/action`,{role:'training',action:'complete',attendanceRate:97})).status,409)
  const sessionClosed=await app.request('POST',`/api/learning/sessions/${sessionId}/action`,{role:'training',action:'complete',attendanceRate:99})
  assert.equal(sessionClosed.status,200)
  assert.equal(sessionClosed.data.learning.sessions.find(item=>item.id===sessionId).status,'completed')

  const assignmentId='LA-20260725-001'
  const learningStarted=await app.request('POST',`/api/learning/assignments/${assignmentId}/action`,{role:'employee',action:'start'})
  assert.equal(learningStarted.status,200)
  const examSubmitted=await app.request('POST',`/api/learning/assignments/${assignmentId}/action`,{role:'employee',action:'submit',score:88,reflection:'我会先确认客户需求，再解释续约规则和办理结果，结束前复述确认。'})
  assert.equal(examSubmitted.status,200)
  assert.equal(examSubmitted.data.learning.assignments.find(item=>item.id===assignmentId).status,'leader_verification')
  assert.ok(examSubmitted.data.notifications.some(item=>item.role==='leader'&&item.title.includes('学习效果待验证')))
  const learningClosed=await app.request('POST',`/api/learning/assignments/${assignmentId}/action`,{role:'leader',action:'leader_verify',comment:'已抽查2通最新录音，四步确认执行完整，重复来电进入7日观察。'})
  assert.equal(learningClosed.status,200)
  assert.equal(learningClosed.data.learning.assignments.find(item=>item.id===assignmentId).status,'closed')
  assert.ok(learningClosed.data.notifications.some(item=>item.role==='training'&&item.title.includes('学习效果验证通过')))

  const failedId='LA-20260725-002'
  const failedExam=await app.request('POST',`/api/learning/assignments/${failedId}/action`,{role:'employee',action:'submit',score:70,reflection:'本次对承诺期和办理失败场景掌握不足，需要重新学习错题和录音。'})
  assert.equal(failedExam.status,200)
  assert.equal(failedExam.data.learning.assignments.find(item=>item.id===failedId).status,'failed')
  const reassigned=await app.request('POST',`/api/learning/assignments/${failedId}/action`,{role:'training',action:'reassign',dueAt:new Date(Date.now()+24*60*60*1000).toISOString()})
  assert.equal(reassigned.status,200)
  assert.equal(reassigned.data.learning.assignments.find(item=>item.id===failedId).status,'assigned')

  const suggestionCreated=await app.request('POST','/api/learning/suggestions',{role:'employee',employeeId:'JR10776',category:'learning',title:'增加系统失败边界练习',detail:'建议增加系统办理失败、客户打断和承诺期争议的脱敏录音练习。'})
  assert.equal(suggestionCreated.status,201)
  const suggestion=suggestionCreated.data.learning.suggestions.find(item=>item.title==='增加系统失败边界练习')
  assert.equal((await app.request('POST',`/api/learning/suggestions/${suggestion.id}/action`,{role:'training',action:'start',response:'已受理'})).status,200)
  const accepted=await app.request('POST',`/api/learning/suggestions/${suggestion.id}/action`,{role:'training',action:'accept',response:'建议具有一线价值，纳入下个题库版本和场景演练。'})
  assert.equal(accepted.status,200)
  assert.equal(accepted.data.learning.suggestions.find(item=>item.id===suggestion.id).status,'accepted')
  const suggestionClosed=await app.request('POST',`/api/learning/suggestions/${suggestion.id}/action`,{role:'training',action:'close',response:'三类边界录音和练习题已经发布。'})
  assert.equal(suggestionClosed.status,200)
  assert.equal(suggestionClosed.data.learning.suggestions.find(item=>item.id===suggestion.id).status,'closed')

  const reviewId='GR-20260725-030'
  const reviewSubmitted=await app.request('POST',`/api/learning/growth-reviews/${reviewId}/action`,{role:'training',action:'training_submit',comment:'30日评估显示一次解决和业务能力低于目标，建议连续7日跟踪录音。'})
  assert.equal(reviewSubmitted.status,200)
  assert.equal(reviewSubmitted.data.learning.growthReviews.find(item=>item.id===reviewId).status,'leader_pending')
  const reviewClosed=await app.request('POST',`/api/learning/growth-reviews/${reviewId}/action`,{role:'leader',action:'leader_close',comment:'确认下一阶段一次解决率达到88%，每周复盘2通录音。'})
  assert.equal(reviewClosed.status,200)
  assert.equal(reviewClosed.data.learning.growthReviews.find(item=>item.id===reviewId).status,'closed')
  assert.ok(reviewClosed.data.notifications.some(item=>item.role==='employee'&&item.title.includes('30日成长评估已完成')))
 }finally{await app.close()}
})

test('培训面谈仅由质检培训班长发起，员工执行并支持管理岗位分节点评论',async()=>{
 const app=await startServer()
 try{
  const plannedAt=new Date(Date.now()+60*60*1000).toISOString()
  const dueAt=new Date(Date.now()+24*60*60*1000).toISOString()
  const verificationDueAt=new Date(Date.now()+48*60*60*1000).toISOString()
  const payload={
   type:'training',title:'测试业务规范专项训练',employeeId:'JR10776',responderRole:'employee',plannedAt,dueAt,verificationDueAt,
   reason:'质检发现业务规则解释存在重复差错，需要面向员工完成针对性训练。',
   goal:'员工能够独立准确完成业务解释，避免同类差错再次发生。',
   actionPlan:'员工完成课程、两个案例演练和两通本人录音复盘，并反馈学习结果。',
   successCriteria:'通关测试不低于90分，后续抽查两通录音均无同类问题。',
  }
  const trainingCreated=await app.request('POST','/api/development/cases',{
   role:'training',...payload,
  })
  assert.equal(trainingCreated.status,201)
  const trainingCase=trainingCreated.data.learning.developmentCases.find(item=>item.title==='测试业务规范专项训练')
  assert.equal(trainingCase.status,'pending_acceptance')
  assert.equal(trainingCase.ownerRole,'employee')
  assert.equal(trainingCase.verificationRole,'training')
  assert.equal(trainingCase.actionPlan,payload.actionPlan)
  assert.equal(trainingCase.successCriteria,payload.successCriteria)
  assert.equal(trainingCase.verificationDueAt,verificationDueAt)

  const employeeForbidden=await app.request('POST','/api/development/cases',{role:'employee',...payload,title:'员工不允许发起'})
  assert.equal(employeeForbidden.status,403)
  const supervisorForbidden=await app.request('POST','/api/development/cases',{role:'supervisor',...payload,title:'主管不允许发起'})
  assert.equal(supervisorForbidden.status,403)
  const qualityCreated=await app.request('POST','/api/development/cases',{role:'quality',...payload,type:'interview',title:'质检规范问题面谈'})
  assert.equal(qualityCreated.status,201)
  const leaderCreated=await app.request('POST','/api/development/cases',{role:'leader',...payload,type:'interview',title:'班长目标改善面谈'})
  assert.equal(leaderCreated.status,201)

  const planComment=await app.request('POST',`/api/development/cases/${trainingCase.id}/comments`,{role:'supervisor',nodeCode:'plan',comment:'目标清晰，建议同步记录员工当前基线，便于验收时判断真实改善。'})
  assert.equal(planComment.status,201)
  assert.equal(planComment.data.learning.developmentCases.find(item=>item.id===trainingCase.id).comments[0].nodeCode,'plan')

  const accepted=await app.request('POST',`/api/development/cases/${trainingCase.id}/action`,{role:'employee',action:'accept',comment:'已接收任务并确认今日完成'})
  assert.equal(accepted.status,200)
  assert.equal(accepted.data.learning.developmentCases.find(item=>item.id===trainingCase.id).status,'in_progress')
  const executeComment=await app.request('POST',`/api/development/cases/${trainingCase.id}/comments`,{role:'manager',nodeCode:'execute',comment:'执行时请使用本人真实录音，确保培训动作与现场问题直接对应。'})
  assert.equal(executeComment.status,201)
  const submitted=await app.request('POST',`/api/development/cases/${trainingCase.id}/action`,{role:'employee',action:'submit',comment:'已完成课程学习和两通录音复盘，关键业务步骤可以独立执行。'})
  assert.equal(submitted.status,200)
  assert.equal(submitted.data.learning.developmentCases.find(item=>item.id===trainingCase.id).ownerRole,'training')
  const verifyComment=await app.request('POST',`/api/development/cases/${trainingCase.id}/comments`,{role:'director',nodeCode:'verify',comment:'验收要同时核对通关成绩和新录音表现，不能只以完成学习作为关闭依据。'})
  assert.equal(verifyComment.status,201)
  assert.equal((await app.request('POST',`/api/development/cases/${trainingCase.id}/action`,{role:'quality',action:'verify_success',comment:'质检岗位尝试越权验收'})).status,409)
  const verified=await app.request('POST',`/api/development/cases/${trainingCase.id}/action`,{role:'training',action:'verify_success',comment:'结果和证据符合训练目标，验收关闭。'})
  assert.equal(verified.status,200)
  assert.equal(verified.data.learning.developmentCases.find(item=>item.id===trainingCase.id).status,'closed')
  const closeComment=await app.request('POST',`/api/development/cases/${trainingCase.id}/comments`,{role:'manager',nodeCode:'close',comment:'将本次有效训练动作纳入班组同类问题标准课程和复检清单。'})
  assert.equal(closeComment.status,201)
  const closedCase=closeComment.data.learning.developmentCases.find(item=>item.id===trainingCase.id)
  assert.equal(closedCase.comments.length,4)
  assert.ok(closedCase.history.some(item=>item.action.includes('闭环固化')))
 }finally{await app.close()}
})

test('员工支持请求进入班长PDCA并由员工确认闭环',async()=>{
 const app=await startServer()
 try{
  const payload={
   role:'employee',actor:'李倩',supportType:'指标提升辅导',
   detail:'一次解决率还差0.9个百分点，希望班长帮我复盘2通续约场景录音。',
   dueAt:new Date(Date.now()+30*60*1000).toISOString(),
   successCriteria:'班长30分钟内响应并给出动作，员工确认解决后关闭。',
   requester:{id:'JR10776',name:'李倩',team:'普通客服一区·8班',leader:'张伟'},
  }
  const created=await app.request('POST','/api/employee/support-requests',payload)
  assert.equal(created.status,201)
  const task=created.data.tasks[0]
  assert.match(task.id,/^SUP-\d{4}-\d{3}$/)
  assert.equal(task.ownerRole,'leader')
  assert.equal(task.status,'todo')
  assert.equal(task.sourceLabel,'员工支持请求')
  assert.equal(task.verificationRole,'employee')
  assert.ok(created.data.notifications.some(item=>item.role==='leader'&&item.target==='tasks'&&item.title.includes('李倩')))

  const duplicate=await app.request('POST','/api/employee/support-requests',payload)
  assert.equal(duplicate.status,409)
  const started=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',actor:'张伟',action:'start'})
  assert.equal(started.status,200)
  assert.equal(started.data.tasks[0].status,'doing')
  const submitted=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',actor:'张伟',action:'submit',evidence:'已复盘2通录音，明确续约四步确认法，今日16:00回看指标'})
  assert.equal(submitted.status,200)
  assert.equal(submitted.data.tasks[0].status,'pending_verification')
  assert.equal(submitted.data.tasks[0].ownerRole,'employee')
  assert.ok(submitted.data.notifications.some(item=>item.role==='employee'&&item.title.includes('待员工确认')))
  const improvement=await app.request('GET',`/api/tasks/${task.id}/improvement?role=employee`)
  assert.equal(improvement.status,200)
  assert.equal(improvement.data.metric.code,'fcr')
  assert.equal(typeof improvement.data.metric.unit,'string')
  assert.match(improvement.data.conclusion,/指标数据|目标|改善/)

  const returned=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'employee',actor:'李倩',action:'employee_reopen_support',comment:'还需要一份四步确认话术模板'})
  assert.equal(returned.status,200)
  assert.equal(returned.data.tasks[0].status,'returned_to_leader')
  assert.equal(returned.data.tasks[0].ownerRole,'leader')
  const resubmitted=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',actor:'张伟',action:'submit',evidence:'已补充四步确认话术模板并完成现场演练'})
  assert.equal(resubmitted.status,200)
  assert.equal(resubmitted.data.tasks[0].ownerRole,'employee')
  const closed=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'employee',actor:'李倩',action:'employee_confirm_support',comment:'话术模板已收到，现场演练后可以独立处理'})
  assert.equal(closed.status,200)
  assert.equal(closed.data.tasks[0].status,'closed')
  assert.equal(closed.data.tasks[0].progress,100)
  assert.ok(closed.data.notifications.some(item=>item.role==='leader'&&item.title.includes('已确认解决')))
 }finally{await app.close()}
})

test('培训日报持久化发送、经理查阅并回执培训岗位',async()=>{
 const app=await startServer()
 try{
  const payload={
   role:'training',actor:'测试培训主管',reportDate:'2026-07-24',
   summary:'岗前班整体进度正常，3名高风险学员需要在通关前完成专项复测。',
   metrics:{prejobTrainees:22,passForecast:88.5,onjobPrograms:3,onTimeRate:91},
   risks:['3名高风险学员实操稳定性不足','投诉场景新规需全员补训'],
   tomorrowPlan:['完成高风险学员专项复测','发布投诉场景新规微课'],
  }
  const created=await app.request('POST','/api/training/reports',payload)
  assert.equal(created.status,201)
  const report=created.data.trainingReports[0]
  assert.equal(report.id,'TR-20260724-001')
  assert.equal(report.status,'pending_manager_review')
  assert.equal(report.metrics.prejobTrainees,22)
  const managerNotice=created.data.notifications.find(item=>item.role==='manager'&&item.desc.includes(report.id))
  assert.ok(managerNotice)
  assert.equal(managerNotice.read,false)

  const duplicate=await app.request('POST','/api/training/reports',payload)
  assert.equal(duplicate.status,409)
  assert.equal(duplicate.data.reportId,report.id)
  const forbidden=await app.request('POST','/api/training/reports',{...payload,role:'leader'})
  assert.equal(forbidden.status,403)

  const reviewed=await app.request('POST',`/api/training/reports/${report.id}/review`,{role:'manager',actor:'测试客服经理',comment:'已阅，请持续跟踪3名高风险学员的复测结果。'})
  assert.equal(reviewed.status,200)
  assert.equal(reviewed.data.trainingReports[0].status,'reviewed')
  assert.equal(reviewed.data.trainingReports[0].reviewedBy,'李燕鹏')
  assert.equal(reviewed.data.notifications.find(item=>item.id===managerNotice.id).read,true)
  assert.ok(reviewed.data.notifications.some(item=>item.role==='training'&&item.title.includes(report.id)))

  const persisted=(await app.request('GET','/api/state')).data
  assert.equal(persisted.trainingReports[0].status,'reviewed')
  assert.equal(persisted.trainingReports[0].reviewComment,'已阅，请持续跟踪3名高风险学员的复测结果。')
  assert.equal((await app.request('POST',`/api/training/reports/${report.id}/review`,{role:'manager'})).status,200)
 }finally{await app.close()}
})

test('培训任务持久化、学员评估门槛与质检验效形成闭环',async()=>{
 const app=await startServer()
 try{
  const baseline=(await app.request('GET','/api/state')).data
  const cohort=baseline.training.cohorts[0]
  assert.equal(cohort.stages.find(item=>item.id==='training').progress,64)
  assert.equal(baseline.training.trainees.length,6)
  assert.equal(baseline.training.programs.length,3)

  const advanced=await app.request('POST',`/api/training/cohorts/${cohort.id}/stages/training/action`,{role:'training',progress:74,evidence:'完成第7天课程与晨测，课程记录已归档。'})
  assert.equal(advanced.status,200)
  assert.equal(advanced.data.training.cohorts[0].stages.find(item=>item.id==='training').progress,74)
  assert.equal((await app.request('POST',`/api/training/cohorts/${cohort.id}/stages/training/action`,{role:'training',progress:60})).status,409)
  const blockedProfile=await app.request('POST',`/api/training/cohorts/${cohort.id}/stages/profile/action`,{role:'training',progress:100,evidence:'尝试关闭'})
  assert.equal(blockedProfile.status,409)
  assert.match(blockedProfile.data.error,/档案完整度/)

  const trainee=baseline.training.trainees[0]
  const assessed=await app.request('PUT',`/api/training/trainees/${trainee.id}/assessment`,{
   role:'training',attendance:98.5,theoryScore:93,practiceScore:82,scenarioScore:84,profileComplete:95,
   ability:{business:82,system:86,communication:81},supportPlan:'完成复测后进入标准通关，首周由班长跟踪业务口径。',
  })
  assert.equal(assessed.status,200)
  assert.equal(assessed.data.training.trainees.find(item=>item.id===trainee.id).riskLevel,'normal')
  assert.equal((await app.request('PUT',`/api/training/trainees/${trainee.id}/assessment`,{role:'training',practiceScore:101,supportPlan:'无'})).status,400)

  const created=await app.request('POST','/api/training/programs',{
   role:'training',title:'营销规范专项补训',source:'营销质检TOP问题',audience:'普通客服一区重点员工',audienceCount:18,
   targetCoverage:100,targetPassRate:95,dueAt:'2026-07-25T17:00:00+08:00',baseline:'营销推荐规范率89.6%',
  })
  assert.equal(created.status,201)
  const program=created.data.training.programs[0]
  const targetBlocked=await app.request('POST',`/api/training/programs/${program.id}/action`,{role:'training',action:'update',progress:100,actualCoverage:90,actualPassRate:92,result:'尚未完成全员覆盖'})
  assert.equal(targetBlocked.status,409)
  const submitted=await app.request('POST',`/api/training/programs/${program.id}/action`,{role:'training',action:'update',progress:100,actualCoverage:100,actualPassRate:96.2,result:'18人全部完成培训与测试'})
  assert.equal(submitted.status,200)
  assert.equal(submitted.data.training.programs.find(item=>item.id===program.id).status,'quality_pending')
  assert.ok(submitted.data.notifications.some(item=>item.role==='quality'&&item.title.includes('培训效果待验证')))

  const returned=await app.request('POST',`/api/training/programs/${program.id}/action`,{role:'quality',action:'quality_verify',verified:false,comment:'抽检仍有2通未完整完成需求确认，退回补训。'})
  assert.equal(returned.status,200)
  assert.equal(returned.data.training.programs.find(item=>item.id===program.id).status,'returned_to_training')
  const resubmitted=await app.request('POST',`/api/training/programs/${program.id}/action`,{role:'training',action:'update',progress:100,actualCoverage:100,actualPassRate:98,result:'完成2人补训并通过复测'})
  assert.equal(resubmitted.status,200)
  const verified=await app.request('POST',`/api/training/programs/${program.id}/action`,{role:'quality',action:'quality_verify',verified:true,comment:'复检10通录音全部符合营销推荐规范，指标回到目标线内。'})
  assert.equal(verified.status,200)
  const closed=verified.data.training.programs.find(item=>item.id===program.id)
  assert.equal(closed.status,'closed')
  assert.equal(closed.effectStatus,'verified')
  assert.ok(verified.data.notifications.some(item=>item.role==='manager'&&item.title.includes('培训专项闭环')))
 }finally{await app.close()}
})

test('HRBP高风险沟通升级经理PDCA并回传备案',async()=>{
 const app=await startServer()
 try{
  const baseline=(await app.request('GET','/api/state')).data
  assert.equal(baseline.hrbpCases.length,2)
  const payload={
   role:'hrbp',actor:'测试HRBP',plan:'确认真实离职意向、排班诉求和可干预事项，形成留任方案或升级经理。',
   due:'今日 16:00',
   employee:{id:'JR10913',name:'王芳',team:'普通客服一区·8班',batch:'2026年5月批次',cycle:'实习期',riskScore:94,reasons:['连续3周绩效下降','近14日请假3次','小休占比22.6%']},
  }
  const created=await app.request('POST','/api/hrbp/cases',payload)
  assert.equal(created.status,201)
  const record=created.data.hrbpCases[0]
  assert.match(record.id,/^HR-\d{6}-\d{3}$/)
  assert.equal(record.status,'hrbp_todo')
  assert.equal(record.owner,'HRBP经理')
  assert.ok(created.data.notifications.some(item=>item.role==='hrbp'&&item.desc.includes(record.id)))

  const duplicate=await app.request('POST','/api/hrbp/cases',payload)
  assert.equal(duplicate.status,409)
  assert.equal(duplicate.data.caseId,record.id)
  assert.equal((await app.request('POST','/api/hrbp/cases',{...payload,role:'leader'})).status,403)

  const started=await app.request('POST',`/api/hrbp/cases/${record.id}/action`,{role:'hrbp',actor:'测试HRBP',action:'hrbp_start'})
  assert.equal(started.status,200)
  assert.equal(started.data.hrbpCases[0].status,'hrbp_contacting')
  const escalated=await app.request('POST',`/api/hrbp/cases/${record.id}/action`,{role:'hrbp',actor:'测试HRBP',action:'escalate_manager',note:'员工提出调整排班和岗位诉求，超出HRBP授权范围，请经理协调。'})
  assert.equal(escalated.status,200)
  assert.equal(escalated.data.hrbpCases[0].status,'manager_pending')
  const managerNotice=escalated.data.notifications.find(item=>item.role==='manager'&&item.desc.includes(record.id))
  assert.ok(managerNotice)
  assert.equal(managerNotice.read,false)

  assert.equal((await app.request('POST',`/api/hrbp/cases/${record.id}/action`,{role:'hrbp',action:'manager_start'})).status,403)
  const managerStarted=await app.request('POST',`/api/hrbp/cases/${record.id}/action`,{role:'manager',actor:'测试运营经理',action:'manager_start'})
  assert.equal(managerStarted.status,200)
  assert.equal(managerStarted.data.hrbpCases[0].status,'manager_contacting')
  assert.equal(managerStarted.data.notifications.find(item=>item.id===managerNotice.id).read,true)

  const closed=await app.request('POST',`/api/hrbp/cases/${record.id}/action`,{role:'manager',actor:'测试运营经理',action:'manager_close',note:'协调未来两周固定白班并安排班长每周目标辅导，员工确认愿意留任。'})
  assert.equal(closed.status,200)
  assert.equal(closed.data.hrbpCases[0].status,'closed')
  assert.equal(closed.data.hrbpCases[0].filedAt,'')
  const filingNotice=closed.data.notifications.find(item=>item.role==='hrbp'&&item.title.includes('待备案')&&item.desc.includes(record.id))
  assert.ok(filingNotice)
  assert.equal(filingNotice.read,false)

  const persisted=(await app.request('GET','/api/state')).data.hrbpCases.find(item=>item.id===record.id)
  assert.equal(persisted.managerNote,'协调未来两周固定白班并安排班长每周目标辅导，员工确认愿意留任。')
  const filed=await app.request('POST',`/api/hrbp/cases/${record.id}/action`,{role:'hrbp',actor:'测试HRBP',action:'hrbp_file'})
  const filedRecord=filed.data.hrbpCases.find(item=>item.id===record.id)
  assert.equal(filed.status,200)
  assert.ok(filedRecord.filedAt)
  assert.equal(filedRecord.filedBy,'李燕鹏')
  assert.equal(filed.data.notifications.find(item=>item.id===filingNotice.id).read,true)
  assert.equal((await app.request('POST',`/api/hrbp/cases/${record.id}/action`,{role:'hrbp',action:'hrbp_file'})).status,200)
 }finally{await app.close()}
})

test('排班考勤从员工申请流转至HRBP备案，跨班调度由经理审批生效',async()=>{
 const app=await startServer()
 try{
  const baseline=(await app.request('GET','/api/state')).data
  assert.equal(baseline.workforce.employees.length,8)
  assert.equal(baseline.workforce.coverage.length,5)
  const targetShift=baseline.workforce.shifts.find(item=>item.employeeId==='EMP-10913'&&item.id.endsWith('-1'))
  assert.ok(targetShift)

  const created=await app.request('POST','/api/workforce/requests',{
   role:'employee',kind:'leave',employeeId:'EMP-10913',date:targetShift.date,
   detail:'因家庭就医申请请假，已完成工作交接并告知班长。',
  })
  assert.equal(created.status,201)
  const request=created.data.workforce.requests[0]
  assert.match(request.id,/^WF-\d{6}-\d{3}$/)
  assert.equal(request.status,'leader_pending')
  assert.equal(request.ownerRole,'leader')
  assert.ok(created.data.notifications.some(item=>item.role==='leader'&&item.target==='workforce'))

  assert.equal((await app.request('POST',`/api/workforce/requests/${request.id}/action`,{role:'employee',action:'leader_approve'})).status,403)
  const leaderApproved=await app.request('POST',`/api/workforce/requests/${request.id}/action`,{role:'leader',action:'leader_approve',comment:'交接完成，班组覆盖可承接。'})
  assert.equal(leaderApproved.status,200)
  assert.equal(leaderApproved.data.workforce.requests.find(item=>item.id===request.id).status,'supervisor_pending')
  const supervisorApproved=await app.request('POST',`/api/workforce/requests/${request.id}/action`,{role:'supervisor',action:'supervisor_approve',comment:'高峰覆盖仍满足要求，同意送HRBP备案。'})
  assert.equal(supervisorApproved.status,200)
  assert.equal(supervisorApproved.data.workforce.requests.find(item=>item.id===request.id).status,'hrbp_pending')
  const filed=await app.request('POST',`/api/workforce/requests/${request.id}/action`,{role:'hrbp',action:'hrbp_file',comment:'已同步考勤与排班档案。'})
  const filedRequest=filed.data.workforce.requests.find(item=>item.id===request.id)
  assert.equal(filed.status,200)
  assert.equal(filedRequest.status,'closed')
  assert.ok(filedRequest.hrbpFiledAt)
  assert.equal(filed.data.workforce.shifts.find(item=>item.id===targetShift.id).status,'leave')

  const beforeFrom=baseline.workforce.coverage.find(item=>item.team==='普通客服一区·6班').onDuty
  const beforeTo=baseline.workforce.coverage.find(item=>item.team==='普通客服一区·5班').onDuty
  const dispatchCreated=await app.request('POST','/api/workforce/requests',{
   role:'supervisor',kind:'cross_team_dispatch',fromTeam:'普通客服一区·6班',toTeam:'普通客服一区·5班',date:targetShift.date,
   detail:'高峰时段从6班调入1名10015技能员工支援5班，调出班组覆盖仍高于目标。',
  })
  assert.equal(dispatchCreated.status,201)
  const dispatch=dispatchCreated.data.workforce.requests[0]
  assert.equal(dispatch.status,'manager_pending')
  assert.equal(dispatch.ownerRole,'manager')
  const dispatchClosed=await app.request('POST',`/api/workforce/requests/${dispatch.id}/action`,{role:'manager',action:'manager_approve',comment:'批准执行并监控高峰服务水平。'})
  assert.equal(dispatchClosed.status,200)
  assert.equal(dispatchClosed.data.workforce.requests.find(item=>item.id===dispatch.id).status,'closed')
  assert.equal(dispatchClosed.data.workforce.coverage.find(item=>item.team==='普通客服一区·6班').onDuty,beforeFrom-1)
  assert.equal(dispatchClosed.data.workforce.coverage.find(item=>item.team==='普通客服一区·5班').onDuty,beforeTo+1)
  assert.ok(dispatchClosed.data.audit.some(item=>item.action.includes(dispatch.id)))

  const unsafeCreated=await app.request('POST','/api/workforce/requests',{
   role:'supervisor',kind:'cross_team_dispatch',fromTeam:'普通客服一区·5班',toTeam:'普通客服一区·4班',date:'2026-07-27',
   detail:'从当前已存在缺口的5班继续调出1人。',
  })
  assert.equal(unsafeCreated.status,201)
  const unsafe=unsafeCreated.data.workforce.requests[0]
  assert.equal(unsafe.aiWarning.acknowledged,false)
  assert.match(unsafe.aiWarning.message,/低于95%目标线/)
  const blocked=await app.request('POST',`/api/workforce/requests/${unsafe.id}/action`,{role:'manager',action:'manager_approve'})
  assert.equal(blocked.status,409)
  assert.equal(blocked.data.code,'AI_WARNING_ACK_REQUIRED')
  assert.match(blocked.data.error,/先知悉AI目标偏差提醒/)
  const acknowledged=await app.request('POST',`/api/workforce/requests/${unsafe.id}/action`,{role:'manager',action:'manager_acknowledge_warning'})
  const acknowledgedRequest=acknowledged.data.workforce.requests.find(item=>item.id===unsafe.id)
  assert.equal(acknowledged.status,200)
  assert.equal(acknowledgedRequest.status,'manager_pending')
  assert.equal(acknowledgedRequest.aiWarning.acknowledged,true)
  assert.ok(acknowledgedRequest.aiWarning.acknowledgedAt)
  const approvedDespiteWarning=await app.request('POST',`/api/workforce/requests/${unsafe.id}/action`,{role:'manager',action:'manager_approve',comment:'已知悉目标偏差，因突发高峰批准临时支援，并要求15分钟后回调。'})
  const approvedUnsafe=approvedDespiteWarning.data.workforce.requests.find(item=>item.id===unsafe.id)
  assert.equal(approvedDespiteWarning.status,200)
  assert.equal(approvedUnsafe.status,'closed')
  assert.match(approvedUnsafe.history.at(-2).action,/已知悉AI目标偏差提醒/)
 }finally{await app.close()}
})

test('主管生产调度与总监经营治理形成跨角色闭环',async()=>{
 const app=await startServer()
 try{
  const baseline=(await app.request('GET','/api/state')).data
  assert.equal(baseline.governance.version,1)
  const shift=baseline.governance.shiftPlans[0]
  const route=baseline.governance.skillRoutes[0]
  assert.equal(shift.status,'manager_pending')
  assert.equal(route.status,'manager_pending')
  assert.equal((await app.request('POST',`/api/governance/shift-plans/${shift.id}/action`,{role:'supervisor',action:'manager_approve',comment:'越权审批'})).status,409)
  assert.equal((await app.request('POST',`/api/governance/shift-plans/${shift.id}/action`,{role:'manager',action:'manager_approve'})).status,400)
  const shiftApproved=await app.request('POST',`/api/governance/shift-plans/${shift.id}/action`,{role:'manager',action:'manager_approve',comment:'缺口由6班支援1人、灵活班补位4人，发布后按半小时接通率验效。'})
  assert.equal(shiftApproved.status,200)
  assert.equal(shiftApproved.data.governance.shiftPlans[0].status,'published')
  assert.ok(shiftApproved.data.notifications.some(item=>item.role==='leader'&&item.title.includes('排班计划已发布')))

  const routeApproved=await app.request('POST',`/api/governance/skill-routes/${route.id}/action`,{role:'manager',action:'manager_approve',comment:'调出侧高于安全线，批准执行。'})
  assert.equal(routeApproved.status,200)
  assert.equal(routeApproved.data.governance.skillRoutes[0].status,'executing')
  const routeFailed=await app.request('POST',`/api/governance/skill-routes/${route.id}/action`,{role:'supervisor',action:'submit_effect',actualAnswerRate:87.6})
  assert.equal(routeFailed.status,200)
  assert.equal(routeFailed.data.governance.skillRoutes[0].status,'returned')
  assert.match(routeFailed.data.governance.skillRoutes[0].result,/低于目标/)
  assert.equal((await app.request('POST',`/api/governance/skill-routes/${route.id}/action`,{role:'supervisor',action:'submit',comment:'增加1名全技能员工并缩短切换时延。'})).status,200)
  assert.equal((await app.request('POST',`/api/governance/skill-routes/${route.id}/action`,{role:'manager',action:'manager_approve',comment:'批准改进后重新执行。'})).status,200)
  const routeClosed=await app.request('POST',`/api/governance/skill-routes/${route.id}/action`,{role:'supervisor',action:'submit_effect',actualAnswerRate:90.2})
  assert.equal(routeClosed.status,200)
  assert.equal(routeClosed.data.governance.skillRoutes[0].status,'closed')
  assert.ok(routeClosed.data.notifications.some(item=>item.role==='manager'&&item.title.includes('验效通过')))

  const budget=baseline.governance.budgets[0],contracts=baseline.governance.contracts
  assert.equal(contracts.length,3)
  assert.deepEqual(contracts.map(item=>({project:item.project,amount:item.amount,billingMode:item.billingMode,startDate:item.startDate,endDate:item.endDate,status:item.status})),[
   {project:'10015',amount:7500,billingMode:'固定合同额',startDate:'2025-09-01',endDate:'2027-08-31',status:'active'},
   {project:'10010',amount:6000,billingMode:'固定合同额',startDate:'2025-09-01',endDate:'2027-08-31',status:'active'},
   {project:'河北营销',amount:null,billingMode:'按佣金结费',startDate:'2025-09-01',endDate:'2027-08-31',status:'active'},
  ])
  assert.equal((await app.request('POST',`/api/governance/budgets/${budget.id}/action`,{role:'quality',action:'director_approve',comment:'越权'})).status,403)
  const budgetApproved=await app.request('POST',`/api/governance/budgets/${budget.id}/action`,{role:'director',action:'director_approve',comment:'同意滚动预测，经理每日回传回款、成本和毛利恢复进展。'})
  assert.equal(budgetApproved.status,200)
  assert.equal(budgetApproved.data.governance.budgets[0].status,'active')
  const contractDenied=await app.request('POST',`/api/governance/contracts/${contracts[0].id}/action`,{role:'director',action:'director_approve',comment:'尝试审批合同。'})
  assert.equal(contractDenied.status,403)
  assert.match(contractDenied.data.error,/只读信息.*仅可查阅.*到期提醒/)
  assert.equal((await app.request('POST',`/api/governance/contracts/${contracts[0].id}/action`,{role:'manager',action:'manager_submit',comment:'尝试重提合同。'})).status,403)

  const meeting=baseline.governance.meetings[0]
  const published=await app.request('POST',`/api/governance/meetings/${meeting.id}/action`,{role:'director',action:'publish',summary:'本次会议完成经营预测、现场覆盖和人员稳定复盘，明确结费差异清单与技能调度验效两项行动。'})
  assert.equal(published.status,200)
  assert.equal(published.data.governance.meetings[0].status,'published')
  const meetingTasks=published.data.tasks.filter(item=>item.workflowKind==='meeting_action')
  assert.equal(meetingTasks.length,2)
  const managerTask=meetingTasks.find(item=>item.ownerRole==='manager')
  assert.ok(managerTask)
  assert.equal((await app.request('POST',`/api/tasks/${managerTask.id}/action`,{role:'manager',action:'meeting_start'})).status,200)
  const meetingSubmitted=await app.request('POST',`/api/tasks/${managerTask.id}/action`,{role:'manager',action:'meeting_submit',evidence:'21.1万元差异清单已逐项明确口径、责任人和甲方确认时间，材料归档至经营台账。'})
  assert.equal(meetingSubmitted.status,200)
  assert.equal(meetingSubmitted.data.tasks.find(item=>item.id===managerTask.id).ownerRole,'director')
  const meetingClosed=await app.request('POST',`/api/tasks/${managerTask.id}/action`,{role:'director',action:'meeting_verify_success',comment:'清单覆盖全部差异并明确确认节点，验收通过。'})
  assert.equal(meetingClosed.status,200)
  assert.equal(meetingClosed.data.tasks.find(item=>item.id===managerTask.id).status,'closed')

  const initialCross=baseline.governance.crossDepartmentItems[0]
  const crossSubmitted=await app.request('POST',`/api/governance/cross-department/${initialCross.id}/action`,{role:'manager',action:'submit_result',result:'21.1万元差异已完成逐项核对，全部明确费用口径、责任人和甲方确认时间，清单已归档。'})
  assert.equal(crossSubmitted.status,200)
  assert.equal(crossSubmitted.data.governance.crossDepartmentItems[0].status,'director_verification')
  const crossClosed=await app.request('POST',`/api/governance/cross-department/${initialCross.id}/action`,{role:'director',action:'director_verify',result:'执行证据完整，经营差异已进入每日跟踪，验收关闭。'})
  assert.equal(crossClosed.status,200)
  assert.equal(crossClosed.data.governance.crossDepartmentItems[0].status,'closed')

  const crossCreated=await app.request('POST','/api/governance/cross-department',{
   role:'director',title:'新工入列后30日稳定与产能联合复盘',targetRole:'hrbp',targetDepartment:'HAC支持部 · 人力资源',
   detail:'请HRBP联合培训和业务经理核对新工稳定、产能成长和辅导动作，形成批次级问题清单。',
   target:'22名新工档案、稳定风险和产能成长状态100%明确，形成责任人和7日计划',
   dueAt:new Date(Date.now()+24*60*60*1000).toISOString(),
  })
  assert.equal(crossCreated.status,201)
  const newCross=crossCreated.data.governance.crossDepartmentItems[0]
  assert.equal(newCross.ownerRole,'hrbp')
  assert.ok(crossCreated.data.notifications.some(item=>item.role==='hrbp'&&item.title.includes('总监跨部门协同')))
  assert.equal((await app.request('POST',`/api/governance/cross-department/${newCross.id}/action`,{role:'hrbp',action:'start'})).status,200)
  assert.equal((await app.request('POST',`/api/governance/cross-department/${newCross.id}/action`,{role:'hrbp',action:'submit_result',result:'已完成22人档案、风险与产能成长核对，形成3类问题、责任人及7日改善计划。'})).status,200)
  const newCrossClosed=await app.request('POST',`/api/governance/cross-department/${newCross.id}/action`,{role:'director',action:'director_verify',result:'清单和责任计划完整，纳入下周经营会复盘。'})
  assert.equal(newCrossClosed.status,200)
  assert.equal(newCrossClosed.data.governance.crossDepartmentItems.find(item=>item.id===newCross.id).status,'closed')
 }finally{await app.close()}
})

test('用户角色权限服务持久化、哈希密码并执行服务端RBAC',async()=>{
 const app=await startServer({},false)
 try{
  assert.equal((await app.request('GET','/api/access')).status,401)
  assert.equal((await app.request('POST','/api/auth/login',{jobNo:'JZ053684',password:'wrong-password'})).status,401)
  const adminLogin=await app.request('POST','/api/auth/login',{jobNo:'JZ053684',password:'000000'})
  assert.equal(adminLogin.status,200)
  assert.equal(adminLogin.data.requiresPasswordChange,true)
  const initialAdminCookie=adminLogin.headers.get('set-cookie').split(';')[0]
  assert.match(adminLogin.headers.get('set-cookie'),/HttpOnly/)
  assert.match(adminLogin.headers.get('set-cookie'),/SameSite=Lax/)
  assert.equal((await app.request('GET','/api/access',undefined,{cookie:initialAdminCookie})).status,403)
  const changed=await app.request('POST','/api/auth/change-password',{currentPassword:'000000',newPassword:'Admin2026!'}, {cookie:initialAdminCookie})
  assert.equal(changed.status,200)
  assert.equal(changed.data.requiresPasswordChange,false)
  const adminCookie=changed.headers.get('set-cookie').split(';')[0]
  const authenticatedSession=await app.request('GET','/api/auth/session',undefined,{cookie:adminCookie})
  assert.equal(authenticatedSession.status,200)
  assert.equal(authenticatedSession.data.user.id,'U001')
  const baseline=await app.request('GET','/api/access',undefined,{cookie:adminCookie})
  assert.equal(baseline.status,200)
  assert.equal(baseline.data.users.length,2)
  assert.equal(baseline.data.roles.some(role=>role.id==='system-admin'),true)
  assert.equal(baseline.data.organization.source.totalMembers,575)
  assert.equal(baseline.data.organization.projects.find(project=>project.id==='10015升投').count,283)
  assert.equal(baseline.data.organization.projects.find(project=>project.id==='联通河北').count,264)
  assert.equal(baseline.data.organization.members.some(member=>member.jobNo==='JZ053684'&&member.jobTitle==='运营管理总监'),true)
  assert.equal(baseline.data.organization.members.some(member=>'phone' in member),false)
  assert.equal(JSON.stringify(baseline.data).includes('passwordHash'),false)
  assert.equal(baseline.data.users[0].password,'')

  const rolePayload={id:'new-role',name:'现场支撑专员',code:'FIELD_SUPPORT',level:'自定义',description:'处理现场支撑任务',memberCount:0,menus:['command','tasks'],builtIn:false,status:'active'}
  const managerLogin=await app.request('POST','/api/auth/login',{jobNo:'JZ001218',password:'000000'})
  const initialManagerCookie=managerLogin.headers.get('set-cookie').split(';')[0]
  const managerChanged=await app.request('POST','/api/auth/change-password',{currentPassword:'000000',newPassword:'Manager2026!'},{cookie:initialManagerCookie})
  assert.equal(managerChanged.status,200)
  const managerCookie=managerChanged.headers.get('set-cookie').split(';')[0]
  const forbidden=await app.request('PUT','/api/access/roles',{role:rolePayload},{cookie:managerCookie})
  assert.equal(forbidden.status,403)
  const roleSaved=await app.request('PUT','/api/access/roles',{role:rolePayload},{cookie:adminCookie})
  assert.equal(roleSaved.status,200)
  const customRole=roleSaved.data.roles.find(role=>role.code==='FIELD_SUPPORT')
  assert.ok(customRole)
  assert.match(customRole.id,/^custom-field-support/)

  const user={id:'U003',name:'测试用户',jobNo:'JZ009999',roleId:customRole.id,jobTitle:'现场支撑专员',department:'河北基地 · 运营支持',phone:'13800000000',email:'test@example.com',status:'active',password:'secure123',forceChangePassword:true,moduleOverrides:['reports','not-a-menu'],createdAt:'2026-07-24'}
  const created=await app.request('PUT','/api/access/users',{user},{cookie:adminCookie})
  assert.equal(created.status,200)
  const publicUser=created.data.users.find(item=>item.jobNo==='JZ009999')
  assert.ok(publicUser)
  assert.equal(publicUser.password,'')
  assert.deepEqual(publicUser.moduleOverrides,['reports'])
  assert.equal(JSON.stringify(created.data).includes('secure123'),false)

  const rawAccess=await readFile(path.join(app.dataDir,'access-control.json'),'utf8')
  assert.equal(rawAccess.includes('secure123'),false)
  const stored=JSON.parse(rawAccess)
  const storedUser=stored.users.find(item=>item.jobNo==='JZ009999')
  assert.match(storedUser.passwordHash,/^scrypt\$/)
  const originalHash=storedUser.passwordHash
  const edited=await app.request('PUT','/api/access/users',{user:{...publicUser,name:'测试用户已更新',password:''}},{cookie:adminCookie})
  assert.equal(edited.status,200)
  assert.equal(JSON.parse(await readFile(path.join(app.dataDir,'access-control.json'),'utf8')).users.find(item=>item.id===publicUser.id).passwordHash,originalHash)

  const duplicate=await app.request('PUT','/api/access/users',{user:{...user,id:'U004',name:'重复工号'}},{cookie:adminCookie})
  assert.equal(duplicate.status,409)
  assert.equal((await app.request('DELETE',`/api/access/roles/${customRole.id}`,undefined,{cookie:adminCookie})).status,409)
  assert.equal((await app.request('POST','/api/access/users/U001/action',{action:'toggle_status'},{cookie:adminCookie})).status,409)
  assert.equal((await app.request('POST',`/api/access/users/${publicUser.id}/action`,{action:'reset_password',temporaryPassword:'Reset2026!'},{cookie:adminCookie})).status,200)

  const reassigned=await app.request('PUT','/api/access/users',{user:{...edited.data.users.find(item=>item.id===publicUser.id),roleId:'customer-agent',password:''}},{cookie:adminCookie})
  assert.equal(reassigned.status,200)
  const deleted=await app.request('DELETE',`/api/access/roles/${customRole.id}`,undefined,{cookie:adminCookie})
  assert.equal(deleted.status,200)
  assert.equal(deleted.data.roles.some(role=>role.id===customRole.id),false)

  await app.request('POST','/api/reset',{}, {cookie:adminCookie})
  const afterBusinessReset=(await app.request('GET','/api/access',undefined,{cookie:adminCookie})).data
  assert.equal(afterBusinessReset.users.length,3)
  assert.equal(afterBusinessReset.roles.some(role=>role.code==='FIELD_SUPPORT'),false)
  assert.equal((await app.request('POST','/api/auth/logout',{}, {cookie:adminCookie})).status,200)
  assert.equal((await app.request('GET','/api/auth/session',undefined,{cookie:adminCookie})).status,401)
 }finally{await app.close()}
})

test('业务状态按岗位最小可见且普通账号不能伪造角色执行跨岗动作',async()=>{
 const app=await startServer({},false)
 try{
  assert.equal((await app.request('GET','/api/state')).status,401)
  assert.equal((await app.request('GET','/api/reports/catalog')).status,401)

  const adminLogin=await app.request('POST','/api/auth/login',{jobNo:'JZ053684',password:'000000'})
  const initialAdminCookie=adminLogin.headers.get('set-cookie').split(';')[0]
  const adminChanged=await app.request('POST','/api/auth/change-password',{currentPassword:'000000',newPassword:'Admin2026!'},{cookie:initialAdminCookie})
  assert.equal(adminChanged.status,200)
  const adminCookie=adminChanged.headers.get('set-cookie').split(';')[0]
  const createUser=async user=>{
   const response=await app.request('PUT','/api/access/users',{user},{cookie:adminCookie})
   assert.equal(response.status,200)
  }
  await createUser({name:'周主管',jobNo:'QA-SUP-001',roleId:'customer-supervisor',jobTitle:'客服主管',department:'前台普通客服一区',status:'active',password:'Temp123!',moduleOverrides:[]})
  await createUser({name:'陈专员',jobNo:'QA-EMP-001',roleId:'customer-agent',jobTitle:'客服专员',department:'普通客服一区·8班',status:'active',password:'Temp123!',moduleOverrides:[]})
  await createUser({name:'刘培训',jobNo:'QA-TRN-001',roleId:'training-manager',jobTitle:'培训主管',department:'业务驱动部 · 质培管理',status:'active',password:'Temp123!',moduleOverrides:[]})
  await createUser({name:'钱质检',jobNo:'QA-QUA-001',roleId:'quality-specialist',jobTitle:'质检专员',department:'业务驱动部 · 质培管理',status:'active',password:'Temp123!',moduleOverrides:[]})

  const loginReady=async(jobNo,newPassword)=>{
   const login=await app.request('POST','/api/auth/login',{jobNo,password:'Temp123!'})
   const initialCookie=login.headers.get('set-cookie').split(';')[0]
   const changed=await app.request('POST','/api/auth/change-password',{currentPassword:'Temp123!',newPassword},{cookie:initialCookie})
   assert.equal(changed.status,200)
   return changed.headers.get('set-cookie').split(';')[0]
  }
  const supervisorCookie=await loginReady('QA-SUP-001','Supervisor2026!')
  const employeeCookie=await loginReady('QA-EMP-001','Employee2026!')
  const trainingCookie=await loginReady('QA-TRN-001','Training2026!')
  const qualityCookie=await loginReady('QA-QUA-001','Quality2026!')

  const supervisorState=await app.request('GET','/api/state',undefined,{cookie:supervisorCookie})
  assert.equal(supervisorState.status,200)
  assert.equal(supervisorState.data.hrbpCases.length,0)
  assert.equal(supervisorState.data.trainingReports.length,0)
  assert.equal(supervisorState.data.audit.length,0)
  assert.equal(supervisorState.data.reportRuns.length,0)
  assert.equal(supervisorState.data.quality.plans.length,1)
  assert.equal(supervisorState.data.quality.calibrations.length,0)
  assert.equal(supervisorState.data.governance.shiftPlans.length,1)
  assert.equal(supervisorState.data.governance.skillRoutes.length,1)
  assert.equal(supervisorState.data.governance.budgets.length,0)
  assert.equal(supervisorState.data.governance.contracts.length,0)
  assert.ok(supervisorState.data.notifications.every(item=>item.role==='supervisor'))
  assert.equal((await app.request('GET','/api/reports/catalog',undefined,{cookie:supervisorCookie})).status,200)

  const spoofQuality=await app.request('POST','/api/quality/collaborations',{
   role:'quality',actor:'伪造质检',requirement:'伪造协同要求',
   employee:{id:'JR10913',name:'王芳',team:'普通客服一区·8班',leader:'张伟',problem:'伪造问题'},
  },{cookie:supervisorCookie})
  assert.equal(spoofQuality.status,403)
  assert.equal(spoofQuality.data.code,'ROLE_CONTEXT_FORBIDDEN')
  const spoofDirector=await app.request('POST','/api/governance/budgets/BG-2026H1-10015/action',{role:'director',action:'director_approve',comment:'伪造总监审批'},{cookie:supervisorCookie})
  assert.equal(spoofDirector.status,403)
  assert.equal(spoofDirector.data.code,'ROLE_CONTEXT_FORBIDDEN')

  const approved=await app.request('POST','/api/events/EV-001/review',{role:'supervisor',actor:'伪造操作人',action:'approve'},{cookie:supervisorCookie})
  assert.equal(approved.status,200)
  assert.equal(approved.data.events.find(item=>item.id==='EV-001').history.at(-1).actor,'周主管')
  assert.equal((await app.request('POST','/api/reset',{}, {cookie:supervisorCookie})).status,403)

  const employeeState=await app.request('GET','/api/state',undefined,{cookie:employeeCookie})
  assert.equal(employeeState.status,200)
  assert.equal(employeeState.data.events.length,0)
  assert.equal(employeeState.data.hrbpCases.length,0)
  assert.equal(employeeState.data.trainingReports.length,0)
  assert.equal(employeeState.data.quality.records.length,0)
  assert.equal(employeeState.data.quality.cases.length,1)
  assert.equal(employeeState.data.learning.assignments.length,0)
  assert.equal(employeeState.data.learning.suggestions.length,0)
  assert.equal(employeeState.data.governance.shiftPlans.length,0)
  assert.equal(employeeState.data.governance.budgets.length,0)
  assert.equal(employeeState.data.governance.crossDepartmentItems.length,0)
  assert.equal(employeeState.data.financialPerformance.metrics.length,0)
  assert.equal(employeeState.data.audit.length,0)
  assert.ok(employeeState.data.notifications.every(item=>item.role==='employee'))
  assert.equal((await app.request('GET','/api/reports/catalog',undefined,{cookie:employeeCookie})).status,403)
  assert.equal((await app.request('POST','/api/events/EV-002/review',{role:'supervisor',action:'approve'},{cookie:employeeCookie})).status,403)
  assert.equal((await app.request('POST','/api/workforce/requests',{role:'supervisor',kind:'cross_team_dispatch',fromTeam:'普通客服一区·6班',toTeam:'普通客服一区·4班',date:'2026-07-25',detail:'伪造调度'},{cookie:employeeCookie})).status,403)
  assert.equal((await app.request('POST','/api/workforce/requests',{role:'employee',kind:'leave',employeeId:'EMP-10913',date:'2026-07-25',detail:'为其他员工伪造请假'},{cookie:employeeCookie})).status,403)
  assert.equal((await app.request('POST','/api/learning/banks/QB-10015-RENEW-V4/action',{role:'training',action:'publish'},{cookie:employeeCookie})).status,403)
  assert.equal((await app.request('POST','/api/development/cases',{role:'quality',type:'training',title:'伪造质检培训',employeeId:'JR10776',responderRole:'employee',dueAt:new Date(Date.now()+24*60*60*1000).toISOString(),reason:'伪造跨岗位培训发起，试图绕过岗位权限限制。',goal:'伪造目标用于验证权限拦截是否有效。'},{cookie:employeeCookie})).status,403)

  const trainingState=await app.request('GET','/api/state',undefined,{cookie:trainingCookie})
  assert.equal(trainingState.data.training.cohorts.length,1)
  assert.equal(trainingState.data.training.trainees.length,6)
  assert.equal(trainingState.data.training.programs.length,3)
  assert.equal(trainingState.data.quality.records.length,0)
  assert.equal(trainingState.data.quality.cases.length,1)
  assert.equal(trainingState.data.hrbpCases.length,0)
  assert.equal(trainingState.data.learning.questionBanks.length,2)
  assert.equal(trainingState.data.learning.assignments.length,3)
  assert.equal(trainingState.data.governance.budgets.length,0)
  assert.equal(trainingState.data.governance.shiftPlans.length,0)
  assert.equal((await app.request('POST','/api/learning/assignments/LA-20260725-001/action',{role:'employee',action:'start'},{cookie:trainingCookie})).status,403)
  const qualityState=await app.request('GET','/api/state',undefined,{cookie:qualityCookie})
  assert.equal(qualityState.data.training.cohorts.length,0)
  assert.equal(qualityState.data.training.trainees.length,0)
  assert.equal(qualityState.data.training.programs.length,3)
  assert.equal(qualityState.data.quality.plans.length,1)
  assert.equal(qualityState.data.quality.records.length,4)
  assert.equal(qualityState.data.quality.appeals.length,2)
  assert.equal(qualityState.data.quality.calibrations.length,1)
  assert.equal((await app.request('PUT','/api/training/trainees/TRN-001/assessment',{role:'training',practiceScore:90,supportPlan:'伪造评估'},{cookie:qualityCookie})).status,403)
  assert.equal((await app.request('POST','/api/training/programs/TP-20260724-003/action',{role:'quality',action:'quality_verify',verified:true,comment:'伪造验效'},{cookie:trainingCookie})).status,403)
  assert.equal((await app.request('POST','/api/quality/records',{role:'quality',planId:'QPL-20260725-001',callId:'FORGED',employeeId:'JR10913',employeeName:'王芳',team:'普通客服一区·8班',score:95,result:'passed',severity:'none'},{cookie:trainingCookie})).status,403)
 }finally{await app.close()}
})

test('AI配置受RBAC保护，行动草案经人工确认进入跨岗位PDCA闭环',async()=>{
 const deepseek=await startFakeDeepSeek()
 const app=await startServer({},false)
 try{
  const before=await app.request('GET','/api/ai/status')
  assert.equal(before.status,401)
  const adminLogin=await app.request('POST','/api/auth/login',{jobNo:'JZ053684',password:'000000'})
  const initialAdminCookie=adminLogin.headers.get('set-cookie').split(';')[0]
  const adminChanged=await app.request('POST','/api/auth/change-password',{currentPassword:'000000',newPassword:'Admin2026!'},{cookie:initialAdminCookie})
  assert.equal(adminChanged.status,200)
  const adminCookie=adminChanged.headers.get('set-cookie').split(';')[0]
  const managerLogin=await app.request('POST','/api/auth/login',{jobNo:'JZ001218',password:'000000'})
  const initialManagerCookie=managerLogin.headers.get('set-cookie').split(';')[0]
  const managerChanged=await app.request('POST','/api/auth/change-password',{currentPassword:'000000',newPassword:'Manager2026!'},{cookie:initialManagerCookie})
  assert.equal(managerChanged.status,200)
  const managerCookie=managerChanged.headers.get('set-cookie').split(';')[0]
  const initialStatus=await app.request('GET','/api/ai/status',undefined,{cookie:adminCookie})
  assert.equal(initialStatus.status,200)
  assert.equal(initialStatus.data.configured,false)
  assert.equal((await app.request('GET','/api/ai/settings',undefined,{cookie:managerCookie})).status,403)

  const saved=await app.request('PUT','/api/ai/settings',{apiKey:'test-secret',baseUrl:deepseek.baseUrl,model:'deepseek-v4-flash',timeoutMs:30000},{cookie:adminCookie})
  assert.equal(saved.status,200)
  assert.equal(saved.data.configured,true)
  assert.equal(saved.data.source,'system')
  assert.equal(saved.data.maskedKey,'tes••••••••cret')
  assert.equal(JSON.stringify(saved.data).includes('test-secret'),false)

  const status=await app.request('GET','/api/ai/status',undefined,{cookie:adminCookie})
  assert.equal(status.status,200)
  assert.equal(status.data.configured,true)
  assert.equal(status.data.model,'deepseek-v4-flash')

  assert.equal((await app.request('POST','/api/ai/test',{}, {cookie:managerCookie})).status,403)
  const tested=await app.request('POST','/api/ai/test',{}, {cookie:adminCookie})
  assert.equal(tested.status,200)
  assert.equal(tested.data.ok,true)
  assert.equal(tested.data.model,'deepseek-v4-flash')

  const context={roleId:'leader',role:'客服班长',scope:'普通客服一区·8班',page:'今日作战',metrics:['重复来电率4.7%，目标≤4.0%'],openAlerts:4,openTasks:2}
  assert.equal((await app.request('POST','/api/ai/chat',{messages:[{role:'user',content:'分析当前指标差距'}],context})).status,401)
  assert.equal((await app.request('POST','/api/ai/chat',{messages:[{role:'user',content:'分析当前指标差距'}],context},{cookie:managerCookie})).status,403)
  const chat=await app.request('POST','/api/ai/chat',{
   messages:[{role:'user',content:'分析当前指标差距'}],
   context,
  },{cookie:adminCookie})
  assert.equal(chat.status,200)
  assert.match(chat.data.message.content,/优先处理重复来电率/)
  const upstream=deepseek.received()
  assert.equal(upstream.url,'/chat/completions')
  assert.equal(upstream.authorization,'Bearer test-secret')
  assert.equal(upstream.body.model,'deepseek-v4-flash')
  assert.match(upstream.body.messages[0].content,/客服班长/)
  assert.deepEqual(upstream.body.messages.at(-1),{role:'user',content:'分析当前指标差距'})

  const tasksBefore=(await app.request('GET','/api/state',undefined,{cookie:adminCookie})).data.tasks.length
  const drafted=await app.request('POST','/api/ai/action-drafts',{
   messages:[{role:'user',content:'分析当前指标差距'},{role:'assistant',content:chat.data.message.content}],
   context,
  },{cookie:adminCookie})
  assert.equal(drafted.status,200)
  assert.equal(drafted.data.draft.role,'leader')
  assert.equal(drafted.data.draft.verificationRole,'supervisor')
  assert.equal(drafted.data.draft.title,'压降重复来电率专项行动')
  assert.equal((await app.request('GET','/api/state',undefined,{cookie:adminCookie})).data.tasks.length,tasksBefore)
  assert.match(deepseek.received().body.messages[0].content,/只输出一个合法JSON对象/)

  const created=await app.request('POST','/api/ai/action-drafts/execute',{draft:drafted.data.draft},{cookie:adminCookie})
  assert.equal(created.status,201)
  const task=created.data.tasks[0]
  assert.match(task.id,/^AI-\d{4}-\d{3}$/)
  assert.equal(task.workflowKind,'ai_action')
  assert.equal(task.ownerRole,'leader')
  assert.equal(task.originRole,'leader')
  assert.equal(task.verificationRole,'supervisor')
  assert.equal(task.status,'todo')
  assert.equal(task.target,'今日重复来电率降至4.0%以内')
  assert.equal((await app.request('POST','/api/ai/action-drafts/execute',{draft:drafted.data.draft},{cookie:adminCookie})).status,409)

  assert.equal((await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',action:'ai_start'})).status,401)
  assert.equal((await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',action:'ai_start'},{cookie:managerCookie})).status,403)
  const started=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',action:'ai_start'},{cookie:adminCookie})
  assert.equal(started.status,200)
  assert.equal(started.data.tasks[0].status,'doing')
  const submitted=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',action:'ai_submit',evidence:'已完成3名重点员工辅导并抽检6通录音，重复来电率降至4.1%。'},{cookie:adminCookie})
  assert.equal(submitted.status,200)
  assert.equal(submitted.data.tasks[0].status,'pending_verification')
  assert.equal(submitted.data.tasks[0].ownerRole,'supervisor')
  const returned=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'supervisor',action:'ai_verify_fail',comment:'当前4.1%仍未达到4.0%目标，请补充晚班跟踪。'},{cookie:adminCookie})
  assert.equal(returned.status,200)
  assert.equal(returned.data.tasks[0].status,'returned_to_origin')
  assert.equal(returned.data.tasks[0].ownerRole,'leader')
  const resubmitted=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'leader',action:'ai_submit',evidence:'补充晚班2小时跟踪，日终重复来电率为3.9%。'},{cookie:adminCookie})
  assert.equal(resubmitted.status,200)
  const closed=await app.request('POST',`/api/tasks/${task.id}/action`,{role:'supervisor',action:'ai_verify_success',comment:'日终3.9%，抽检证据完整，验收通过。'},{cookie:adminCookie})
  assert.equal(closed.status,200)
  assert.equal(closed.data.tasks[0].status,'closed')
  assert.equal(closed.data.tasks[0].progress,100)
  assert.match(closed.data.tasks[0].verification,/验收通过/)

  await app.request('POST','/api/reset',{}, {cookie:adminCookie})
  assert.equal((await app.request('GET','/api/ai/status',undefined,{cookie:adminCookie})).data.configured,true)
 }finally{await app.close();await deepseek.close()}
})
