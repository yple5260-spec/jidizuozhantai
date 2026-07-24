import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { load,save,reset,now,dataDir } from './store.js'
import { artifactPath,buildPreview,catalog,createRun,filterRuns,recordDownload } from './reportService.js'
import { getAiConfig,publicAiConfig,saveAiConfig } from './aiConfig.js'
import { authenticate, changePassword, deleteRole, loadAccess, publicAccess, requirePermission, saveRole, saveUser, userAction } from './accessStore.js'
import { createSession, destroySession, publicSession, requireReadySession, requireSession, sessionPayload } from './auth.js'

const PORT=process.env.API_PORT||process.env.PORT||4174
const CORS_ORIGIN=String(process.env.CORS_ORIGIN||'').trim()
const API_VERSION='2026.07.25-governance-operations-v8'
const here=path.dirname(fileURLToPath(import.meta.url))
const distDir=path.resolve(here,'../dist')
const envFile=path.resolve(here,'../.env')
if(fs.existsSync(envFile)){
 for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)){
  const match=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
  if(!match||match[1] in process.env)continue
  process.env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2')
 }
}
const roles={leader:'客服班长',supervisor:'客服主管',manager:'客服经理',director:'运营总监',quality:'质检专员',employee:'客服专员',training:'培训主管',hrbp:'HRBP经理'}
const runtimeRoleByAccessRole={'system-admin':'director','operation-director':'director','customer-manager':'manager','customer-supervisor':'supervisor','team-leader':'leader','customer-agent':'employee','quality-specialist':'quality','training-manager':'training','hrbp-manager':'hrbp'}
const aiVerificationRole={employee:'leader',leader:'supervisor',supervisor:'manager',manager:'director',director:'director',quality:'manager',training:'manager',hrbp:'manager'}
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8',...(CORS_ORIGIN?{'access-control-allow-origin':CORS_ORIGIN,'access-control-allow-credentials':'true','vary':'origin'}:{}),'access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'});res.end(JSON.stringify(data))}
const body=async req=>{let b='';for await(const c of req)b+=c;return b?JSON.parse(b):{}}
const addNotice=(s,role,title,desc,target='alerts',priority='medium')=>s.notifications.unshift({id:`NT-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,role,title,desc,target,priority,createdAt:now(),read:false})
const audit=(s,actor,action)=>s.audit.unshift({at:now(),actor,action})
const actionTime=()=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())
const authorizeRuntimeRole=(current,requestedRole)=>{
 const role=String(requestedRole||'')
 if(!roles[role])throw Object.assign(new Error('岗位参数无效'),{status:400,code:'INVALID_RUNTIME_ROLE'})
 if(current.user.roleId!=='system-admin'&&runtimeRoleByAccessRole[current.user.roleId]!==role)throw Object.assign(new Error('当前账号不能以其他岗位调用AI或执行任务'),{status:403,code:'ROLE_CONTEXT_FORBIDDEN'})
 return role
}
const requireRuntimeRole=(req,requestedRole,allowedRoles=Object.keys(roles))=>{
 const current=requireReadySession(req)
 const role=authorizeRuntimeRole(current,requestedRole)
 if(!allowedRoles.includes(role))throw Object.assign(new Error('当前岗位无权执行此操作'),{status:403,code:'ROLE_ACTION_FORBIDDEN'})
 return {current,role,actor:current.user.name}
}
const taskVisibleToRole=(task,role)=>{
 if(role==='director')return true
 if(role==='manager')return task.ownerRole==='manager'||task.originRole==='manager'||task.verificationRole==='manager'||task.ownerRole==='director'
 if(role==='supervisor')return task.ownerRole==='supervisor'||task.ownerRole==='leader'||task.originRole==='supervisor'||task.verificationRole==='supervisor'
 if(role==='leader')return task.ownerRole==='leader'||task.originRole==='leader'||task.verificationRole==='leader'
 if(role==='employee')return task.ownerRole==='employee'||task.originRole==='employee'||task.verificationRole==='employee'
 if(role==='quality')return task.ownerRole==='quality'||task.originRole==='quality'||task.verificationRole==='quality'
 if(role==='training')return task.ownerRole==='training'||task.originRole==='training'||task.verificationRole==='training'
 if(role==='hrbp')return task.ownerRole==='hrbp'||task.originRole==='hrbp'||task.verificationRole==='hrbp'
 return false
}
const compactOrgText=value=>String(value||'').replace(/\s+/g,'')
const visibleWorkforce=(workforce,current,role)=>{
 const source=structuredClone(workforce||{employees:[],coverage:[],shifts:[],requests:[]})
 if(['director','manager','supervisor','hrbp'].includes(role))return source
 if(!['leader','employee'].includes(role))return {employees:[],coverage:[],shifts:[],requests:[]}
 if(role==='employee'){
  const ownEmployees=source.employees.filter(employee=>employee.jobNo===current.user.jobNo||employee.name===current.user.name)
  const ids=new Set(ownEmployees.map(employee=>employee.id))
  return {
   employees:ownEmployees,coverage:[],
   shifts:source.shifts.filter(shift=>ids.has(shift.employeeId)||shift.jobNo===current.user.jobNo),
   requests:source.requests.filter(request=>ids.has(request.employeeId)||request.requester===current.user.name||request.employeeName===current.user.name),
  }
 }
 const department=compactOrgText(current.user.department)
 const teams=new Set(source.employees.filter(employee=>employee.leader===current.user.name||department.includes(compactOrgText(employee.team))).map(employee=>employee.team))
 const employees=source.employees.filter(employee=>teams.has(employee.team)||employee.name===current.user.name)
 const ids=new Set(employees.map(employee=>employee.id))
 return {
  employees,
  coverage:source.coverage.filter(item=>teams.has(item.team)),
  shifts:source.shifts.filter(shift=>ids.has(shift.employeeId)),
  requests:source.requests.filter(request=>request.ownerRole==='leader'||ids.has(request.employeeId)||teams.has(request.fromTeam)||teams.has(request.toTeam)),
 }
}
const visibleQuality=(quality,current,role)=>{
 const source=structuredClone(quality||{version:2,plans:[],records:[],appeals:[],calibrations:[],cases:[]})
 if(['director','manager','quality'].includes(role))return source
 const publishedCases=source.cases.filter(item=>item.status==='published')
 if(role==='training')return {version:2,plans:[],records:[],appeals:[],calibrations:source.calibrations.filter(item=>item.status==='action_required'),cases:publishedCases}
 if(role==='supervisor'){
  const department=compactOrgText(current.user.department)
  const records=source.records.filter(item=>department.includes(compactOrgText(item.team))||compactOrgText(item.team).includes('普通客服一区'))
  const ids=new Set(records.map(item=>item.id))
  return {version:2,plans:source.plans,records,appeals:source.appeals.filter(item=>ids.has(item.recordId)),calibrations:[],cases:publishedCases}
 }
 if(role==='leader'){
  const team=compactOrgText(current.user.department),records=source.records.filter(item=>team.includes(compactOrgText(item.team)))
  const ids=new Set(records.map(item=>item.id))
  return {version:2,plans:[],records,appeals:source.appeals.filter(item=>ids.has(item.recordId)||item.applicant===current.user.name),calibrations:[],cases:publishedCases}
 }
 if(role==='employee'){
  const records=source.records.filter(item=>item.employeeId===current.user.jobNo||item.employeeName===current.user.name)
  const ids=new Set(records.map(item=>item.id))
  return {version:2,plans:[],records,appeals:source.appeals.filter(item=>ids.has(item.recordId)||item.employeeName===current.user.name),calibrations:[],cases:publishedCases}
 }
 return {version:2,plans:[],records:[],appeals:[],calibrations:[],cases:publishedCases}
}
const visiblePeople=(people,current,role)=>{
 const empty={version:1,staffingPlans:[],lifecycle:[],laborCases:[],costs:[],interviews:[]}
 const source=structuredClone(people||empty)
 if(['director','manager','hrbp'].includes(role))return source
 if(role==='training')return {...empty,lifecycle:source.lifecycle.filter(item=>item.type==='onboarding_batch')}
 if(role==='leader'){
  const department=compactOrgText(current.user.department)
  return {...empty,lifecycle:source.lifecycle.filter(item=>department.includes(compactOrgText(item.fromOrg))||department.includes(compactOrgText(item.toOrg)))}
 }
 if(role==='employee'){
  return {...empty,lifecycle:source.lifecycle.filter(item=>item.employeeId===current.user.jobNo||item.employeeName===current.user.name),interviews:source.interviews.filter(item=>item.employeeId===current.user.jobNo||item.employeeName===current.user.name)}
 }
 return empty
}
const visibleLearning=(learning,current,role)=>{
 const empty={version:1,questionBanks:[],sessions:[],assignments:[],suggestions:[],growthReviews:[]}
 const source=structuredClone(learning||empty)
 if(['director','manager','training'].includes(role))return source
 if(role==='leader'){
  const department=compactOrgText(current.user.department)
  const inScope=item=>item.leader===current.user.name||department.includes(compactOrgText(item.team))
  return {...source,assignments:source.assignments.filter(inScope),suggestions:source.suggestions.filter(item=>department.includes(compactOrgText(item.team))),growthReviews:source.growthReviews.filter(inScope)}
 }
 if(role==='employee'){
  const own=item=>item.employeeId===current.user.jobNo||item.employeeName===current.user.name
  const assignments=source.assignments.filter(own),bankIds=new Set(assignments.map(item=>item.bankId))
  return {...empty,questionBanks:source.questionBanks.filter(item=>item.status==='published'||bankIds.has(item.id)),sessions:source.sessions.filter(item=>bankIds.has(item.bankId)),assignments,suggestions:source.suggestions.filter(own),growthReviews:source.growthReviews.filter(own)}
 }
 if(role==='quality')return {...empty,questionBanks:source.questionBanks.filter(item=>item.status==='published'),sessions:source.sessions.filter(item=>item.status==='completed')}
 return empty
}
const visibleGovernance=(governance,current,role)=>{
 const empty={version:1,shiftPlans:[],skillRoutes:[],budgets:[],contracts:[],meetings:[],crossDepartmentItems:[]}
 const source=structuredClone(governance||empty)
 if(role==='director')return source
 const publishedMeetings=source.meetings.filter(item=>item.status==='published')
 if(role==='manager')return {...source,meetings:publishedMeetings,crossDepartmentItems:source.crossDepartmentItems.filter(item=>item.targetRole==='manager'||item.originRole==='manager')}
 if(role==='supervisor')return {...empty,shiftPlans:source.shiftPlans,skillRoutes:source.skillRoutes,meetings:publishedMeetings,crossDepartmentItems:source.crossDepartmentItems.filter(item=>item.targetRole==='supervisor')}
 if(['hrbp','quality','training'].includes(role))return {...empty,meetings:publishedMeetings,crossDepartmentItems:source.crossDepartmentItems.filter(item=>item.targetRole===role)}
 return {...empty,meetings:publishedMeetings}
}
const visibleBusinessState=(state,current)=>{
 if(current.user.roleId==='system-admin')return state
 const role=runtimeRoleByAccessRole[current.user.roleId]
 const visible=structuredClone(state)
 visible.tasks=visible.tasks.filter(task=>taskVisibleToRole(task,role))
 visible.notifications=visible.notifications.filter(notice=>notice.role===role)
 visible.events=['director','manager','supervisor'].includes(role)
  ?visible.events
  :role==='leader'?visible.events.filter(event=>['approved','closed'].includes(event.status)):[]
 visible.trainingReports=['director','manager','training'].includes(role)?visible.trainingReports:[]
 if(!['director','manager','training','quality'].includes(role))visible.training={cohorts:[],trainees:[],programs:[]}
 else if(role==='quality')visible.training={cohorts:[],trainees:[],programs:visible.training.programs}
 visible.hrbpCases=['director','manager','hrbp'].includes(role)?visible.hrbpCases:[]
 visible.quality=visibleQuality(visible.quality,current,role)
 visible.people=visiblePeople(visible.people,current,role)
 visible.learning=visibleLearning(visible.learning,current,role)
 visible.governance=visibleGovernance(visible.governance,current,role)
 visible.reportRuns=[]
 visible.reportDownloads=[]
 visible.audit=[]
 visible.workforce=visibleWorkforce(visible.workforce,current,role)
 return visible
}
const stateJson=(res,status,state,current)=>json(res,status,visibleBusinessState(state,current))
const safeText=(value,max=500)=>String(value||'').trim().slice(0,max)
const cleanChatMessages=messages=>{
 if(!Array.isArray(messages))return []
 return messages.slice(-16).map(message=>({
  role:message?.role==='assistant'?'assistant':'user',
  content:String(message?.content||'').trim().slice(0,4000),
 })).filter(message=>message.content)
}
const buildActionDraftSystemPrompt=(context,role)=>`${buildAssistantSystemPrompt(context)}
你现在要把对话中的建议整理为一张可由${roles[role]}本人确认的PDCA行动草案。
只输出一个合法JSON对象，不要使用Markdown代码块，不要附加解释。字段必须完整：
{"title":"不超过30字","problem":"要解决的问题及当前差距","target":"可量化的目标值或明确目标状态","owner":"具体责任人或岗位","dueAt":"ISO 8601日期时间","successCriteria":"可被上级验证的达成标准","rationale":"为什么优先做这件事","collaborationRole":"需要协同的岗位，无则填无"}
要求：不得虚构上下文没有的业务结果；缺少精确数据时用“待补充”标明；截止时间应晚于当前时间；动作必须属于${roles[role]}职责且可以被执行和验收。`
const parseJsonObject=content=>{
 const text=String(content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')
 const start=text.indexOf('{'),end=text.lastIndexOf('}')
 if(start<0||end<=start)throw Object.assign(new Error('AI未生成有效的行动草案，请重新生成'),{status:502,code:'AI_DRAFT_INVALID'})
 try{return JSON.parse(text.slice(start,end+1))}catch{throw Object.assign(new Error('AI行动草案格式无效，请重新生成'),{status:502,code:'AI_DRAFT_INVALID'})}
}
const normalizeDueAt=value=>{
 const parsed=Date.parse(String(value||''))
 return Number.isFinite(parsed)&&parsed>Date.now()-5*60*1000?new Date(parsed).toISOString():new Date(Date.now()+24*60*60*1000).toISOString()
}
const normalizeAiDraft=(input,role)=>({
 role,
 title:safeText(input?.title||`${roles[role]}重点行动`,60),
 problem:safeText(input?.problem||'待补充当前问题和目标差距',1200),
 target:safeText(input?.target||'待补充量化目标',500),
 owner:safeText(input?.owner||roles[role],80),
 dueAt:normalizeDueAt(input?.dueAt),
 successCriteria:safeText(input?.successCriteria||'责任岗位提交执行证据，由上级岗位验证目标是否达成。',1000),
 rationale:safeText(input?.rationale||'根据当前作战数据和对话建议形成。',800),
 collaborationRole:safeText(input?.collaborationRole||'无',80),
 verificationRole:aiVerificationRole[role],
})
const buildAssistantSystemPrompt=context=>{
 const safeContext={
  role:String(context?.role||'未知岗位').slice(0,50),
  scope:String(context?.scope||'河北基地').slice(0,80),
  page:String(context?.page||'今日作战').slice(0,50),
  metrics:Array.isArray(context?.metrics)?context.metrics.slice(0,12).map(item=>String(item).slice(0,120)):[],
  openAlerts:Number(context?.openAlerts)||0,
  openTasks:Number(context?.openTasks)||0,
 }
 return `你是河北呼叫中心运营管理平台的“AI作战助手”，服务对象包括运营经理、班组长、客服专员、质检、培训和HRBP。
你的职责是基于用户提供的平台上下文，帮助分析指标差距、人员风险、班前会重点和PDCA动作。
回答要求：
1. 使用简洁、专业、可执行的中文，先给结论，再给依据和动作。
2. 只使用上下文和用户明确提供的信息；缺少数据时要说明，不得虚构业务事实。
3. 不替代管理者进行人事、薪酬、处罚或客户承诺等最终决策。
4. 建议形成任务时，尽量明确责任人、截止时间和验证标准。
当前平台上下文：${JSON.stringify(safeContext)}`
}
const requestDeepSeek=async({config,messages,context,maxTokens=1000,systemPrompt=''})=>{
 if(!config.apiKey)throw Object.assign(new Error('DeepSeek API Key 尚未配置，请由系统管理员在“系统管理 → AI模型配置”中完成配置。'),{status:503,code:'AI_NOT_CONFIGURED'})
 const controller=new AbortController()
 const timeout=setTimeout(()=>controller.abort(),config.timeoutMs)
 try{
  const upstream=await fetch(`${config.baseUrl}/chat/completions`,{
   method:'POST',
   headers:{'content-type':'application/json','authorization':`Bearer ${config.apiKey}`},
   body:JSON.stringify({
    model:config.model,
    messages:[{role:'system',content:systemPrompt||buildAssistantSystemPrompt(context)},...messages],
    thinking:{type:'disabled'},
    max_tokens:maxTokens,
    stream:false,
   }),
   signal:controller.signal,
  })
  const payload=await upstream.json().catch(()=>({}))
  if(!upstream.ok){
   const upstreamMessage=payload?.error?.message||payload?.message
   const status=upstream.status===429?429:502
   throw Object.assign(new Error(status===429?'DeepSeek 请求繁忙或额度受限，请稍后再试':`DeepSeek 服务调用失败${upstreamMessage?`：${String(upstreamMessage).slice(0,180)}`:''}`),{status,code:'AI_UPSTREAM_ERROR'})
  }
  const content=payload?.choices?.[0]?.message?.content
  if(typeof content!=='string'||!content.trim())throw Object.assign(new Error('DeepSeek 未返回有效回答'),{status:502,code:'AI_EMPTY_RESPONSE'})
  return {content:content.trim(),model:payload.model||config.model,usage:payload.usage||null}
 }catch(error){
  if(error?.name==='AbortError')throw Object.assign(new Error('DeepSeek 响应超时，请稍后重试'),{status:504,code:'AI_TIMEOUT'})
  throw error
 }finally{clearTimeout(timeout)}
}

const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS') return json(res,204,{})
 const url=new URL(req.url,`http://${req.headers.host}`)
 try{
  if(req.method==='GET'&&url.pathname==='/api/health') return json(res,200,{ok:true,time:now(),service:'hebei-operations-api',version:API_VERSION})
  if(req.method==='GET'&&url.pathname==='/api/ai/status'){requireReadySession(req);return json(res,200,publicAiConfig())}
  if(req.method==='GET'&&url.pathname==='/api/ai/settings'){
   const current=requireReadySession(req);requirePermission(current.access,current.user.id,'ai-settings')
   return json(res,200,publicAiConfig())
  }
  if(req.method==='PUT'&&url.pathname==='/api/ai/settings'){
   const p=await body(req),current=requireReadySession(req);requirePermission(current.access,current.user.id,'ai-settings')
   const settings=saveAiConfig(p)
   const s=load();audit(s,current.user.name,`更新AI模型配置：${settings.model} / ${settings.baseUrl}`);save(s)
   return json(res,200,settings)
  }
  if(req.method==='POST'&&url.pathname==='/api/ai/test'){
   const current=requireReadySession(req);requirePermission(current.access,current.user.id,'ai-settings')
   const startedAt=Date.now()
   const config=getAiConfig()
   const result=await requestDeepSeek({config,messages:[{role:'user',content:'请只回复“连接成功”'}],context:{role:'系统管理员',scope:'河北基地',page:'AI模型配置'},maxTokens:30})
   return json(res,200,{ok:true,provider:'DeepSeek',model:result.model,latencyMs:Date.now()-startedAt,message:result.content})
  }
  if(req.method==='POST'&&url.pathname==='/api/ai/chat'){
   const current=requireReadySession(req)
   const config=getAiConfig()
   const p=await body(req)
   authorizeRuntimeRole(current,p.context?.roleId)
   const messages=cleanChatMessages(p.messages)
   if(!messages.length||messages[messages.length-1].role!=='user')return json(res,400,{error:'请提供有效的用户消息',code:'INVALID_AI_MESSAGES'})
   if(messages.reduce((sum,message)=>sum+message.content.length,0)>16000)return json(res,413,{error:'对话内容过长，请新建对话后重试',code:'AI_CONTEXT_TOO_LARGE'})
   const result=await requestDeepSeek({config,messages,context:p.context})
   return json(res,200,{message:{role:'assistant',content:result.content},provider:'DeepSeek',model:result.model,usage:result.usage})
  }
  if(req.method==='POST'&&url.pathname==='/api/ai/action-drafts'){
   const current=requireReadySession(req),config=getAiConfig(),p=await body(req)
   const role=authorizeRuntimeRole(current,p.context?.roleId)
   const messages=cleanChatMessages(p.messages)
   if(!messages.some(message=>message.role==='user'))return json(res,400,{error:'请先与AI讨论需要解决的问题',code:'AI_DRAFT_REQUIRES_CONVERSATION'})
   if(messages.reduce((sum,message)=>sum+message.content.length,0)>16000)return json(res,413,{error:'对话内容过长，请新建对话后重试',code:'AI_CONTEXT_TOO_LARGE'})
   const result=await requestDeepSeek({config,messages,context:p.context,maxTokens:900,systemPrompt:buildActionDraftSystemPrompt(p.context,role)})
   const draft=normalizeAiDraft(parseJsonObject(result.content),role)
   return json(res,200,{draft,provider:'DeepSeek',model:result.model})
  }
  if(req.method==='POST'&&url.pathname==='/api/ai/action-drafts/execute'){
   const current=requireReadySession(req),p=await body(req)
   const role=authorizeRuntimeRole(current,p.draft?.role)
   const draft=normalizeAiDraft(p.draft,role)
   if(!draft.title||!draft.problem||!draft.target||!draft.successCriteria)return json(res,400,{error:'行动草案信息不完整',code:'AI_DRAFT_INCOMPLETE'})
   const s=load()
   const sourceKey=`ai-action:${role}:${draft.title.toLowerCase().replace(/\s+/g,'')}`
   const duplicate=s.tasks.find(task=>task.sourceKey===sourceKey&&task.status!=='closed')
   if(duplicate)return json(res,409,{error:'该AI行动已有未关闭任务，请先处理现有任务',taskId:duplicate.id})
   const today=new Date(),day=`${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
   const sequence=String(s.tasks.filter(task=>task.workflowKind==='ai_action'&&task.id.startsWith(`AI-${day}-`)).length+1).padStart(3,'0')
   const task={
    id:`AI-${day}-${sequence}`,eventId:`AI-ACTION-${role}-${Date.now()}`,title:draft.title,type:'AI行动',
    ownerRole:role,originRole:role,owner:draft.owner,supervisor:roles[draft.verificationRole],
    verificationRole:draft.verificationRole,status:'todo',phase:'D',progress:0,dueAt:draft.dueAt,evidence:'',verification:'',
    createdAt:now(),updatedAt:now(),sourceKey,sourceLabel:'AI行动草案',workflowKind:'ai_action',
    requirement:draft.problem,target:draft.target,successCriteria:draft.successCriteria,aiRationale:draft.rationale,collaborationRole:draft.collaborationRole,
    history:[{at:now(),actor:current.user.name,action:`人工确认AI行动草案并进入PDCA：目标${draft.target}`}],
   }
   s.tasks.unshift(task)
   addNotice(s,role,`AI行动待执行：${task.title}`,`${task.owner}负责，截止${new Date(task.dueAt).toLocaleString('zh-CN',{hour12:false})}。`,'tasks','high')
   audit(s,current.user.name,`确认AI行动草案并创建${task.id}`)
   save(s)
   return stateJson(res,201,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/login'){
   const p=await body(req),user=authenticate(p.jobNo,p.password),session=createSession(req,res,user.id)
   return json(res,200,sessionPayload(user.id,session.expiresAt))
  }
  if(req.method==='GET'&&url.pathname==='/api/auth/session')return json(res,200,publicSession(req))
  if(req.method==='POST'&&url.pathname==='/api/auth/change-password'){
   const p=await body(req),current=requireSession(req)
   changePassword(current.user.id,p.currentPassword,p.newPassword)
   return json(res,200,sessionPayload(current.user.id,current.session.expiresAt))
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/logout'){destroySession(req,res);return json(res,200,{ok:true})}
  if(req.method==='GET'&&url.pathname==='/api/access'){
   const current=requireReadySession(req);requirePermission(current.access,current.user.id,'user-management')
   return json(res,200,publicAccess(current.access))
  }
  if(req.method==='PUT'&&url.pathname==='/api/access/users'){
   const p=await body(req),current=requireReadySession(req)
   return json(res,200,saveUser(p.user||{},current.user.id))
  }
  let accessMatch=url.pathname.match(/^\/api\/access\/users\/([^/]+)\/action$/)
  if(req.method==='POST'&&accessMatch){
   const p=await body(req),current=requireReadySession(req)
   return json(res,200,userAction(accessMatch[1],p.action,current.user.id))
  }
  if(req.method==='PUT'&&url.pathname==='/api/access/roles'){
   const p=await body(req),current=requireReadySession(req)
   return json(res,200,saveRole(p.role||{},current.user.id))
  }
  accessMatch=url.pathname.match(/^\/api\/access\/roles\/([^/]+)$/)
  if(req.method==='DELETE'&&accessMatch){
   const current=requireReadySession(req)
   return json(res,200,deleteRole(accessMatch[1],current.user.id))
  }
  if(req.method==='GET'&&url.pathname==='/api/state'){
   const current=requireReadySession(req)
   return stateJson(res,200,load(),current)
  }
  if(req.method==='POST'&&url.pathname==='/api/reset'){
   const current=requireReadySession(req)
   if(current.user.roleId!=='system-admin')return json(res,403,{error:'仅系统管理员可复位业务演示数据',code:'RESET_FORBIDDEN'})
   const state=reset();scheduleRefresh();return stateJson(res,200,state,current)
  }
  if(req.method==='GET'&&url.pathname==='/api/reports/catalog'){
   const current=requireReadySession(req);requirePermission(current.access,current.user.id,'reports')
   return json(res,200,catalog())
  }
  if(req.method==='GET'&&url.pathname==='/api/reports/preview'){
   const current=requireReadySession(req);requirePermission(current.access,current.user.id,'reports')
   return json(res,200,buildPreview(url.searchParams.get('projectId'),url.searchParams.get('reportType')))
  }
  if(req.method==='GET'&&url.pathname==='/api/reports/runs'){
   const current=requireReadySession(req);requirePermission(current.access,current.user.id,'reports')
   const s=load()
   return json(res,200,{runs:filterRuns(s,{projectId:url.searchParams.get('projectId'),reportType:url.searchParams.get('reportType'),limit:url.searchParams.get('limit')}),downloads:s.reportDownloads.slice(0,100)})
  }
  if(req.method==='POST'&&url.pathname==='/api/reports/runs'){
   const p=await body(req),current=requireReadySession(req);requirePermission(current.access,current.user.id,'reports')
   const requestedRole=authorizeRuntimeRole(current,p.requestedRole)
   const s=load()
   const run=createRun({dataDir,state:s,projectId:p.projectId,reportType:p.reportType,requestedBy:current.user.name,requestedRole,now})
   save(s)
   return json(res,201,run)
  }
  let reportMatch=url.pathname.match(/^\/api\/reports\/runs\/([^/]+)$/)
  if(req.method==='GET'&&reportMatch){
   const current=requireReadySession(req);requirePermission(current.access,current.user.id,'reports')
   const run=load().reportRuns.find(item=>item.id===reportMatch[1])
   return run?json(res,200,run):json(res,404,{error:'报表运行记录不存在'})
  }
  reportMatch=url.pathname.match(/^\/api\/reports\/runs\/([^/]+)\/download$/)
  if(req.method==='GET'&&reportMatch){
   const current=requireReadySession(req);requirePermission(current.access,current.user.id,'reports')
   const s=load(),run=s.reportRuns.find(item=>item.id===reportMatch[1])
   if(!run)return json(res,404,{error:'报表运行记录不存在'})
   const target=artifactPath(dataDir,run)
   if(!target||!fs.existsSync(target)||!fs.statSync(target).isFile())return json(res,404,{error:'报表文件不存在，请重新运行'})
   recordDownload({state:s,run,requestedBy:current.user.name,now});save(s)
   const asciiName=`report-${run.id}.csv`
   res.writeHead(200,{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(run.artifact.fileName)}`,'cache-control':'no-store','x-content-type-options':'nosniff','access-control-allow-origin':'*'})
   return fs.createReadStream(target).pipe(res)
  }
  if(req.method==='POST'&&url.pathname==='/api/refresh'){
   const {current,actor}=requireRuntimeRole(req,'director',['director'])
   const s=load();s.meta.batchNo+=1;s.meta.lastRefresh=now();s.meta.nextRefresh=new Date(Date.now()+30*60*1000).toISOString();
   addNotice(s,'director',`半小时批次 #${s.meta.batchNo} 刷新完成`,'四类预警规则已完成扫描，数据更新时间已推进。','reports','normal');audit(s,actor,`执行半小时刷新批次 #${s.meta.batchNo}`);save(s);return stateJson(res,200,s,current)
  }
  const learningBankMatch=url.pathname.match(/^\/api\/learning\/banks\/([^/]+)\/action$/)
  if(req.method==='POST'&&learningBankMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['training'])
   const s=load(),bank=s.learning.questionBanks.find(item=>item.id===learningBankMatch[1])
   if(!bank)return json(res,404,{error:'学习题库不存在'})
   const action=safeText(p.action,30)
   if(action==='update'){
    if(bank.status==='retired')return json(res,409,{error:'已停用题库不可更新'})
    const questionCount=Math.round(Number(p.questionCount)),passingScore=Math.round(Number(p.passingScore))
    if(!Number.isFinite(questionCount)||questionCount<0||questionCount>500||!Number.isFinite(passingScore)||passingScore<60||passingScore>100)return json(res,400,{error:'题量需为0—500，及格线需为60—100'})
    bank.questionCount=questionCount;bank.passingScore=passingScore;bank.status='draft';bank.updatedAt=now()
    bank.history.unshift({at:now(),actor,action:`更新题库：${questionCount}/${bank.targetQuestionCount}题，及格线${passingScore}分`})
   }else if(action==='publish'){
    if(bank.status!=='draft')return json(res,409,{error:'仅草稿题库可以发布'})
    if(bank.questionCount<bank.targetQuestionCount)return json(res,409,{error:`当前${bank.questionCount}题，少于发布目标${bank.targetQuestionCount}题`})
    bank.status='published';bank.updatedAt=now();bank.history.unshift({at:now(),actor,action:'题量、版本和及格线校验通过，发布题库'})
    addNotice(s,'employee',`新学习题库已发布：${bank.title}`,`${bank.version} · ${bank.questionCount}题 · 及格线${bank.passingScore}分。`,'growth','normal')
   }else if(action==='retire'){
    if(bank.status!=='published')return json(res,409,{error:'仅已发布题库可以停用'})
    if(s.learning.assignments.some(item=>item.bankId===bank.id&&!['closed'].includes(item.status)))return json(res,409,{error:'仍有未关闭学习任务使用该题库，不能停用'})
    bank.status='retired';bank.updatedAt=now();bank.history.unshift({at:now(),actor,action:'题库版本停用'})
   }else return json(res,400,{error:'不支持的题库动作'})
   audit(s,actor,`${bank.id}：${bank.history[0].action}`);save(s);return stateJson(res,200,s,current)
  }
  const learningSessionMatch=url.pathname.match(/^\/api\/learning\/sessions\/([^/]+)\/action$/)
  if(req.method==='POST'&&learningSessionMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['training'])
   const s=load(),session=s.learning.sessions.find(item=>item.id===learningSessionMatch[1])
   if(!session)return json(res,404,{error:'课程场次不存在'})
   const bank=s.learning.questionBanks.find(item=>item.id===session.bankId),action=safeText(p.action,30)
   if(action==='start'){
    if(session.status!=='planned')return json(res,409,{error:'仅计划中的课程可以开始'})
    if(!bank||bank.status!=='published')return json(res,409,{error:'关联题库尚未发布，不能开始课程'})
    if(session.enrolled>session.capacity)return json(res,409,{error:'报名人数超过场地容量，请先调整资源'})
    session.status='running';session.history.unshift({at:now(),actor,action:`课程开始：${session.trainer} · ${session.room} · ${session.enrolled}人`})
    addNotice(s,'employee',`课程已开始：${session.title}`,`${session.room} · 结束后完成${bank.title}考试。`,'growth','high')
   }else if(action==='complete'){
    if(session.status!=='running')return json(res,409,{error:'仅进行中的课程可以完成'})
    const attendanceRate=Math.round(Number(p.attendanceRate)*10)/10
    if(!Number.isFinite(attendanceRate)||attendanceRate<0||attendanceRate>100)return json(res,400,{error:'请填写0—100%的有效出勤率'})
    if(attendanceRate<session.targetAttendance)return json(res,409,{error:`实际出勤率${attendanceRate}%低于目标${session.targetAttendance}%，需先完成缺勤补课`})
    session.attendanceRate=attendanceRate;session.status='completed';session.history.unshift({at:now(),actor,action:`场次完成，出勤率${attendanceRate}%达到目标`})
    addNotice(s,'manager',`培训场次完成：${session.title}`,`${session.enrolled}人 · 出勤率${attendanceRate}% · 进入个人考试与效果验证。`,'command','normal')
   }else return json(res,400,{error:'不支持的课程场次动作'})
   audit(s,actor,`${session.id}：${session.history[0].action}`);save(s);return stateJson(res,200,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/learning/assignments'){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['training'])
   const s=load(),employee=s.workforce.employees.find(item=>item.id===p.employeeId||item.jobNo===p.employeeId)
   const bank=s.learning.questionBanks.find(item=>item.id===p.bankId)
   if(!employee||employee.role!=='employee'||employee.status!=='active')return json(res,404,{error:'有效员工主数据不存在'})
   if(!bank||bank.status!=='published')return json(res,409,{error:'只能使用已发布题库创建学习任务'})
   const title=safeText(p.title,100),source=safeText(p.source,300),improvementTarget=safeText(p.improvementTarget,500),targetScore=Math.round(Number(p.targetScore))
   if(!title||!source||!improvementTarget||!Number.isFinite(targetScore)||targetScore<bank.passingScore||targetScore>100)return json(res,400,{error:`任务信息不完整，目标分需不低于题库及格线${bank.passingScore}分`})
   if(s.learning.assignments.some(item=>item.employeeId===employee.jobNo&&item.bankId===bank.id&&item.status!=='closed'))return json(res,409,{error:'该员工已有同题库未关闭学习任务'})
   const day=new Date().toISOString().slice(0,10).replaceAll('-',''),sequence=String(s.learning.assignments.filter(item=>item.id.startsWith(`LA-${day}-`)).length+1).padStart(3,'0')
   const assignment={id:`LA-${day}-${sequence}`,employeeId:employee.jobNo,employeeName:employee.name,team:employee.team,leader:employee.leader,title,source,bankId:bank.id,targetScore,dueAt:normalizeDueAt(p.dueAt),status:'assigned',score:0,attempts:0,progress:0,reflection:'',improvementTarget,leaderComment:'',abilityDelta:{business:3,system:1,communication:2},history:[{at:now(),actor,action:'根据员工目标Gap创建个人学习与考试任务'}]}
   s.learning.assignments.unshift(assignment)
   addNotice(s,'employee',`新的学习任务：${title}`,`${assignment.id} · 截止${new Date(assignment.dueAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})} · 目标${targetScore}分。`,'growth','high')
   addNotice(s,'leader',`员工学习任务已下发：${employee.name}`,`${title}完成并达标后，将由${employee.leader}验证业务改善。`,'growth','normal')
   audit(s,actor,`创建个人学习任务${assignment.id}`);save(s);return stateJson(res,201,s,current)
  }
  const learningAssignmentMatch=url.pathname.match(/^\/api\/learning\/assignments\/([^/]+)\/action$/)
  if(req.method==='POST'&&learningAssignmentMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['employee','training','leader'])
   const s=load(),assignment=s.learning.assignments.find(item=>item.id===learningAssignmentMatch[1])
   if(!assignment)return json(res,404,{error:'个人学习任务不存在'})
   if(role==='employee'&&current.user.roleId!=='system-admin'&&assignment.employeeId!==current.user.jobNo&&assignment.employeeName!==current.user.name)return json(res,403,{error:'员工只能操作本人学习任务'})
   if(role==='leader'&&current.user.roleId!=='system-admin'){
    const department=compactOrgText(current.user.department)
    if(assignment.leader!==current.user.name&&!department.includes(compactOrgText(assignment.team)))return json(res,403,{error:'班长只能验证本人班组员工'})
   }
   const action=safeText(p.action,30)
   if(action==='start'){
    if(role!=='employee'||!['assigned','failed'].includes(assignment.status))return json(res,409,{error:'当前任务不能开始学习'})
    assignment.status='in_progress';assignment.progress=Math.max(10,assignment.progress);assignment.history.unshift({at:now(),actor,action:assignment.attempts?'开始补考学习':'开始课程学习'})
   }else if(action==='submit'){
    if(role!=='employee'||assignment.status!=='in_progress')return json(res,409,{error:'仅学习中的本人任务可以提交考试'})
    const score=Math.round(Number(p.score)),reflection=safeText(p.reflection,800)
    if(!Number.isFinite(score)||score<0||score>100||reflection.length<10)return json(res,400,{error:'请提交0—100分考试成绩，并填写至少10字学习复盘'})
    assignment.score=score;assignment.reflection=reflection;assignment.attempts+=1;assignment.progress=100
    if(score>=assignment.targetScore){
     assignment.status='leader_verification';assignment.history.unshift({at:now(),actor,action:`考试${score}分达到目标${assignment.targetScore}分，提交班长验证业务改善`})
     addNotice(s,'leader',`学习效果待验证：${assignment.employeeName}`,`${assignment.title}考试${score}分；请结合${assignment.improvementTarget}验证实际改善。`,'tasks','high')
    }else{
     assignment.status='failed';assignment.history.unshift({at:now(),actor,action:`考试${score}分，低于目标${assignment.targetScore}分，进入补学`})
     addNotice(s,'training',`员工考试未达标：${assignment.employeeName}`,`${assignment.title} · ${score}/${assignment.targetScore}分 · 请安排补学。`,'growth','high')
    }
   }else if(action==='reassign'){
    if(role!=='training'||assignment.status!=='failed')return json(res,409,{error:'仅培训岗位可重派未达标任务'})
    assignment.status='assigned';assignment.progress=0;assignment.dueAt=normalizeDueAt(p.dueAt);assignment.history.unshift({at:now(),actor,action:`安排补学与第二次考试，截止${assignment.dueAt}`})
    addNotice(s,'employee',`学习任务已安排补考：${assignment.title}`,`请根据上次${assignment.score}分结果补齐知识点后重新考试。`,'growth','high')
   }else if(action==='leader_verify'){
    if(role!=='leader'||assignment.status!=='leader_verification')return json(res,409,{error:'仅责任班长可验证待验收学习任务'})
    const comment=safeText(p.comment,800)
    if(comment.length<10)return json(res,400,{error:'班长需填写至少10字的录音、指标或现场验证结论'})
    assignment.status='closed';assignment.leaderComment=comment;assignment.history.unshift({at:now(),actor,action:`验证学习后业务改善并关闭：${comment}`})
    addNotice(s,'employee',`学习任务已闭环：${assignment.title}`,comment,'growth','normal')
    addNotice(s,'training',`学习效果验证通过：${assignment.employeeName}`,`${assignment.title} · ${comment}`,'growth','normal')
   }else return json(res,400,{error:'不支持的个人学习任务动作'})
   audit(s,actor,`${assignment.id}：${assignment.history[0].action}`);save(s);return stateJson(res,200,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/learning/suggestions'){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['employee'])
   const s=load(),employee=s.workforce.employees.find(item=>item.jobNo===p.employeeId||item.id===p.employeeId)
   if(!employee)return json(res,404,{error:'员工主数据不存在'})
   if(current.user.roleId!=='system-admin'&&employee.jobNo!==current.user.jobNo&&employee.name!==current.user.name)return json(res,403,{error:'员工只能以本人身份提交建议'})
   const category=safeText(p.category,30),title=safeText(p.title,100),detail=safeText(p.detail,1200)
   if(!['business','system','management','learning'].includes(category)||!title||detail.length<10)return json(res,400,{error:'建议类型、标题和至少10字的事实说明不能为空'})
   if(s.learning.suggestions.some(item=>item.employeeId===employee.jobNo&&item.title===title&&!['rejected','closed'].includes(item.status)))return json(res,409,{error:'已有相同标题的处理中建议'})
   const day=new Date().toISOString().slice(0,10).replaceAll('-',''),sequence=String(s.learning.suggestions.filter(item=>item.id.startsWith(`SG-${day}-`)).length+1).padStart(3,'0')
   const suggestion={id:`SG-${day}-${sequence}`,employeeId:employee.jobNo,employeeName:employee.name,team:employee.team,category,title,detail,status:'pending_training',owner:'培训主管 刘颖',response:'',createdAt:now(),history:[{at:now(),actor,action:'提交一线业务与学习改进建议'}]}
   s.learning.suggestions.unshift(suggestion);addNotice(s,'training',`一线员工新建议：${title}`,`${employee.name} · ${employee.team} · 请在1个工作日内受理。`,'growth','normal')
   audit(s,actor,`提交员工建议${suggestion.id}`);save(s);return stateJson(res,201,s,current)
  }
  const learningSuggestionMatch=url.pathname.match(/^\/api\/learning\/suggestions\/([^/]+)\/action$/)
  if(req.method==='POST'&&learningSuggestionMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['training'])
   const s=load(),suggestion=s.learning.suggestions.find(item=>item.id===learningSuggestionMatch[1])
   if(!suggestion)return json(res,404,{error:'员工建议不存在'})
   const action=safeText(p.action,30),response=safeText(p.response,1000)
   if(action==='start'){
    if(suggestion.status!=='pending_training')return json(res,409,{error:'仅待受理建议可以开始评估'})
    suggestion.status='reviewing';suggestion.owner=actor;suggestion.history.unshift({at:now(),actor,action:'受理建议并开始评估业务价值与落地方式'})
   }else if(action==='accept'||action==='reject'){
    if(suggestion.status!=='reviewing'||response.length<10)return json(res,409,{error:'评估中的建议填写至少10字答复后方可处理'})
    suggestion.status=action==='accept'?'accepted':'rejected';suggestion.response=response;suggestion.history.unshift({at:now(),actor,action:`${action==='accept'?'采纳':'不采纳'}建议：${response}`})
    addNotice(s,'employee',`员工建议${action==='accept'?'已采纳':'已答复'}：${suggestion.title}`,response,'growth',action==='accept'?'normal':'medium')
   }else if(action==='close'){
    if(suggestion.status!=='accepted'||response.length<10)return json(res,409,{error:'仅已采纳建议在填写落地结果后可以关闭'})
    suggestion.status='closed';suggestion.response=`${suggestion.response}；落地结果：${response}`;suggestion.history.unshift({at:now(),actor,action:`建议落地并关闭：${response}`})
    addNotice(s,'employee',`员工建议已落地：${suggestion.title}`,response,'growth','normal')
   }else return json(res,400,{error:'不支持的员工建议动作'})
   audit(s,actor,`${suggestion.id}：${suggestion.history[0].action}`);save(s);return stateJson(res,200,s,current)
  }
  const growthReviewMatch=url.pathname.match(/^\/api\/learning\/growth-reviews\/([^/]+)\/action$/)
  if(req.method==='POST'&&growthReviewMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['training','leader'])
   const s=load(),review=s.learning.growthReviews.find(item=>item.id===growthReviewMatch[1])
   if(!review)return json(res,404,{error:'成长里程碑评估不存在'})
   if(role==='leader'&&current.user.roleId!=='system-admin'){
    const department=compactOrgText(current.user.department)
    if(review.leader!==current.user.name&&!department.includes(compactOrgText(review.team)))return json(res,403,{error:'班长只能确认本人班组成长评估'})
   }
   const action=safeText(p.action,30),comment=safeText(p.comment,1000)
   if(comment.length<10)return json(res,400,{error:'评估意见至少需要10个字'})
   if(action==='training_submit'){
    if(role!=='training'||!['planned','training_review'].includes(review.status))return json(res,409,{error:'仅培训岗位可提交阶段能力评估'})
    review.status='leader_pending';review.trainingComment=comment;review.history.unshift({at:now(),actor,action:`完成${review.milestone}日能力差距评估，提交班长确认：${comment}`})
    addNotice(s,'leader',`${review.milestone}日成长评估待确认：${review.employeeName}`,comment,'tasks','high')
   }else if(action==='leader_close'){
    if(role!=='leader'||review.status!=='leader_pending')return json(res,409,{error:'仅责任班长可关闭待确认成长评估'})
    review.status='closed';review.leaderComment=comment;review.history.unshift({at:now(),actor,action:`确认阶段表现与下一阶段目标：${comment}`})
    addNotice(s,'employee',`${review.milestone}日成长评估已完成`,`${review.trainingComment}；班长：${comment}`,'growth','normal')
    addNotice(s,'training',`${review.employeeName}${review.milestone}日成长评估闭环`,comment,'growth','normal')
   }else return json(res,400,{error:'不支持的成长评估动作'})
   audit(s,actor,`${review.id}：${review.history[0].action}`);save(s);return stateJson(res,200,s,current)
  }
  const trainingStageMatch=url.pathname.match(/^\/api\/training\/cohorts\/([^/]+)\/stages\/([^/]+)\/action$/)
  if(req.method==='POST'&&trainingStageMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['training'])
   const s=load(),cohort=s.training.cohorts.find(item=>item.id===trainingStageMatch[1])
   if(!cohort)return json(res,404,{error:'培训班不存在'})
   const stage=cohort.stages.find(item=>item.id===trainingStageMatch[2])
   if(!stage)return json(res,404,{error:'培训阶段不存在'})
   const progress=Math.max(0,Math.min(100,Math.round(Number(p.progress))))
   if(!Number.isFinite(Number(p.progress)))return json(res,400,{error:'请填写有效的任务进度'})
   if(progress<stage.progress)return json(res,409,{error:'培训任务进度不可回退'})
   const trainees=s.training.trainees.filter(item=>item.cohortId===cohort.id)
   if(progress===100&&stage.id==='clearance'){
    const passed=trainees.filter(item=>item.theoryScore>=85&&item.practiceScore>=75&&item.scenarioScore>=75).length
    const passRate=trainees.length?Math.round(passed/trainees.length*1000)/10:0
    if(passRate<cohort.targetPassRate)return json(res,409,{error:`当前通关率${passRate}%，未达到目标${cohort.targetPassRate}%，不能关闭通关阶段`})
   }
   if(progress===100&&stage.id==='profile'){
    const incomplete=trainees.filter(item=>item.profileComplete<90)
    if(incomplete.length)return json(res,409,{error:`仍有${incomplete.length}名学员档案完整度低于90%，不能关闭档案初建`})
   }
   if(progress===100&&stage.id==='assessment'){
    const incomplete=trainees.filter(item=>item.assessmentStatus!=='assessed'||item.profileComplete<90)
    if(incomplete.length)return json(res,409,{error:`仍有${incomplete.length}名学员未完成有效能力评估，不能关闭评估阶段`})
   }
   const evidence=safeText(p.evidence,500)
   if(progress===100&&!evidence&&!stage.evidence)return json(res,400,{error:'完成培训阶段必须提交验收证据'})
   stage.progress=progress;stage.status=progress===100?'done':progress>0?'active':'pending'
   if(evidence)stage.evidence=evidence
   if(progress===100&&stage.id==='clearance'){
    const passedTrainees=trainees.filter(item=>item.theoryScore>=85&&item.practiceScore>=75&&item.scenarioScore>=75)
    let lifecycle=s.people.lifecycle.find(item=>item.type==='onboarding_batch'&&item.source===cohort.id&&item.status!=='closed')
    if(!lifecycle){
     const sequence=String(s.people.lifecycle.length+1).padStart(3,'0')
     lifecycle={id:`LC-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${sequence}`,type:'onboarding_batch',title:`${cohort.name}合格人员入列`,employeeId:'',employeeName:'',personCount:0,employeeIds:[],source:cohort.id,fromOrg:'培训班',toOrg:'普通客服一区',effectiveDate:cohort.plannedEndDate,status:'training_pending',ownerRole:'training',owner:'培训主管',detail:'培训通关名单自动转入HRBP入列准备。',managerComment:'',result:'',checklist:{contract:false,medical:false,account:false,shift:false,team:false},history:[]}
     s.people.lifecycle.unshift(lifecycle)
    }
    lifecycle.personCount=passedTrainees.length
    lifecycle.employeeIds=passedTrainees.map(item=>item.id)
    lifecycle.status='hrbp_preparing';lifecycle.ownerRole='hrbp';lifecycle.owner='HRBP经理 陈静'
    lifecycle.history.unshift({at:now(),actor,action:`培训通关率达标，推送${passedTrainees.length}名合格学员至HRBP入列准备`})
    addNotice(s,'hrbp',`新工合格名单待入列：${cohort.name}`,`${passedTrainees.length}名学员已通关，请完成合同、体检、账号、排班和班组核验。`,'command','high')
   }
   cohort.status=cohort.stages.every(item=>item.progress===100)?'completed':'training'
   cohort.history.unshift({at:now(),actor,action:`${stage.name}进度更新至${progress}%${evidence?`，证据：${evidence}`:''}`})
   audit(s,actor,`更新培训班${cohort.id}的${stage.name}至${progress}%`)
   save(s)
   return stateJson(res,200,s,current)
  }
  const trainingAssessmentMatch=url.pathname.match(/^\/api\/training\/trainees\/([^/]+)\/assessment$/)
  if(req.method==='PUT'&&trainingAssessmentMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['training'])
   const s=load(),trainee=s.training.trainees.find(item=>item.id===trainingAssessmentMatch[1])
   if(!trainee)return json(res,404,{error:'学员档案不存在'})
   const scoreFields=['attendance','theoryScore','practiceScore','scenarioScore','profileComplete']
   for(const field of scoreFields){
    if(p[field]===undefined)continue
    const value=Number(p[field])
    if(!Number.isFinite(value)||value<0||value>100)return json(res,400,{error:`${field}必须为0—100之间的数值`})
    trainee[field]=Math.round(value*10)/10
   }
   if(p.ability&&typeof p.ability==='object'){
    for(const field of ['business','system','communication']){
     if(p.ability[field]===undefined)continue
     const value=Number(p.ability[field])
     if(!Number.isFinite(value)||value<0||value>100)return json(res,400,{error:'能力评分必须为0—100之间的数值'})
     trainee.ability[field]=Math.round(value)
    }
   }
   const supportPlan=safeText(p.supportPlan,500)
   if(!supportPlan)return json(res,400,{error:'能力评估必须形成下一步帮扶计划'})
   trainee.supportPlan=supportPlan
   trainee.assessmentStatus='assessed'
   const weakest=Math.min(trainee.practiceScore,trainee.scenarioScore,trainee.ability.business,trainee.ability.system,trainee.ability.communication)
   trainee.riskLevel=trainee.attendance<95||weakest<70?'high':weakest<80||trainee.profileComplete<90?'attention':'normal'
   trainee.history.unshift({at:now(),actor,action:`更新能力评估：理论${trainee.theoryScore}、实操${trainee.practiceScore}、场景${trainee.scenarioScore}，形成帮扶计划`})
   audit(s,actor,`更新学员${trainee.name}能力评估`)
   save(s)
   return stateJson(res,200,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/training/programs'){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['training'])
   const s=load()
   const title=safeText(p.title,80),source=safeText(p.source,120),audience=safeText(p.audience,80)
   const audienceCount=Math.round(Number(p.audienceCount)),targetCoverage=Number(p.targetCoverage),targetPassRate=Number(p.targetPassRate)
   if(!title||!source||!audience||!Number.isFinite(audienceCount)||audienceCount<1)return json(res,400,{error:'专项名称、需求来源、培训对象和人数不能为空'})
   if(!Number.isFinite(targetCoverage)||!Number.isFinite(targetPassRate)||targetCoverage<=0||targetCoverage>100||targetPassRate<=0||targetPassRate>100)return json(res,400,{error:'覆盖率和通过率目标必须在0—100%之间'})
   const day=new Date().toISOString().slice(0,10).replaceAll('-','')
   const sequence=String(s.training.programs.filter(item=>item.id.startsWith(`TP-${day}-`)).length+1).padStart(3,'0')
   const dueAt=Date.parse(String(p.dueAt||''))
   if(!Number.isFinite(dueAt))return json(res,400,{error:'专项截止时间格式不正确'})
   const program={id:`TP-${day}-${sequence}`,title,source,audience,audienceCount,owner:actor,targetCoverage,targetPassRate,actualCoverage:0,actualPassRate:0,progress:0,dueAt:new Date(dueAt).toISOString(),status:'active',effectStatus:'not_submitted',baseline:safeText(p.baseline,160)||'待培训前采集',result:'专项已创建，等待组织实施。',history:[{at:now(),actor,action:'基于业务或质量问题创建岗中培训专项'}]}
   s.training.programs.unshift(program)
   addNotice(s,'training',`岗中专项已创建：${program.title}`,`${program.id} · ${program.audience}${program.audienceCount}人 · 覆盖目标${program.targetCoverage}%。`,'training','normal')
   audit(s,actor,`创建岗中培训专项${program.id}`)
   save(s)
   return stateJson(res,201,s,current)
  }
  const trainingProgramMatch=url.pathname.match(/^\/api\/training\/programs\/([^/]+)\/action$/)
  if(req.method==='POST'&&trainingProgramMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['training','quality'])
   const s=load(),program=s.training.programs.find(item=>item.id===trainingProgramMatch[1])
   if(!program)return json(res,404,{error:'岗中培训专项不存在'})
   const action=String(p.action||'')
   if(action==='update'){
    if(role!=='training')return json(res,403,{error:'仅培训岗位可更新专项实施结果'})
    const progress=Math.max(0,Math.min(100,Math.round(Number(p.progress))))
    const coverage=Math.round(Number(p.actualCoverage)*10)/10,passRate=Math.round(Number(p.actualPassRate)*10)/10
    if(!Number.isFinite(progress)||!Number.isFinite(coverage)||!Number.isFinite(passRate)||coverage<0||coverage>100||passRate<0||passRate>100)return json(res,400,{error:'进度、覆盖率和通过率必须为0—100之间的数值'})
    if(progress<program.progress)return json(res,409,{error:'专项进度不可回退'})
    if(progress===100&&(coverage<program.targetCoverage||passRate<program.targetPassRate))return json(res,409,{error:`实际覆盖${coverage}%/通过${passRate}%，未达到${program.targetCoverage}%/${program.targetPassRate}%目标，不能提交验效`})
    program.progress=progress;program.actualCoverage=coverage;program.actualPassRate=passRate
    program.result=safeText(p.result,500)||program.result
    if(progress===100){
     program.status='quality_pending';program.effectStatus='pending_quality_review'
     addNotice(s,'quality',`培训效果待验证：${program.title}`,`${program.id} · 覆盖${coverage}% · 通过${passRate}%，请结合质检指标验证改善效果。`,'training','high')
     addNotice(s,'manager',`岗中培训已提交验效`,`${program.title}已达培训目标，等待质检验证业务改善。`,'command','normal')
     program.history.unshift({at:now(),actor,action:'培训实施达标，提交质检效果验证'})
    }else{
     program.status='active'
     program.history.unshift({at:now(),actor,action:`专项进度更新至${progress}%，覆盖${coverage}%，测试通过${passRate}%`})
    }
   }else if(action==='quality_verify'){
    if(role!=='quality')return json(res,403,{error:'仅质检岗位可执行培训效果验证'})
    if(program.status!=='quality_pending')return json(res,409,{error:'当前专项不在质检验效阶段'})
    const verified=Boolean(p.verified),comment=safeText(p.comment,500)
    if(!comment)return json(res,400,{error:'质检验效必须填写指标结果或抽检证据'})
    program.effectResult=comment;program.verifiedAt=now();program.verifiedBy=actor
    if(verified){
     program.status='closed';program.effectStatus='verified'
     program.history.unshift({at:now(),actor,action:`质检验效通过：${comment}`})
     addNotice(s,'training',`培训效果已验证：${program.title}`,comment,'training','normal')
     addNotice(s,'manager',`培训专项闭环：${program.title}`,comment,'command','normal')
    }else{
     program.status='returned_to_training';program.effectStatus='failed';program.progress=90
     program.history.unshift({at:now(),actor,action:`质检验效未通过，退回补训：${comment}`})
     addNotice(s,'training',`培训效果未达标：${program.title}`,`${comment}；专项已退回补训。`,'training','high')
    }
   }else return json(res,400,{error:'培训专项动作不正确'})
   audit(s,actor,`${action==='quality_verify'?'验证':'更新'}岗中培训专项${program.id}`)
   save(s)
   return stateJson(res,200,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/training/reports'){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['training'])
   const s=load()
   const reportDate=String(p.reportDate||'').slice(0,10)
   if(!/^\d{4}-\d{2}-\d{2}$/.test(reportDate))return json(res,400,{error:'培训日报日期格式不正确'})
   const duplicate=s.trainingReports.find(report=>report.reportDate===reportDate)
   if(duplicate)return json(res,409,{error:`${reportDate}培训日报已提交`,reportId:duplicate.id})
   const day=reportDate.replaceAll('-','')
   const sequence=String(s.trainingReports.filter(report=>report.id.startsWith(`TR-${day}-`)).length+1).padStart(3,'0')
   const report={
    id:`TR-${day}-${sequence}`,reportDate,status:'pending_manager_review',trainer:actor,manager:'客服经理',
    generatedAt:now(),sentAt:now(),reviewedAt:'',reviewedBy:'',reviewComment:'',
    metrics:{
     prejobTrainees:Number(p.metrics?.prejobTrainees)||22,
     passForecast:Number(p.metrics?.passForecast)||88.5,
     onjobPrograms:Number(p.metrics?.onjobPrograms)||3,
     onTimeRate:Number(p.metrics?.onTimeRate)||91,
    },
    risks:Array.isArray(p.risks)?p.risks.slice(0,10).map(item=>String(item).slice(0,240)):[],
    tomorrowPlan:Array.isArray(p.tomorrowPlan)?p.tomorrowPlan.slice(0,10).map(item=>String(item).slice(0,240)):[],
    summary:String(p.summary||'新工班进度正常，但通关前需重点提升业务实操。').slice(0,500),
   }
   s.trainingReports.unshift(report)
   addNotice(s,'manager','今日培训日报待查阅',`${report.id} · 预计通关率${report.metrics.passForecast}% · ${report.risks.length}项风险需关注。`,'command','high')
   audit(s,actor,`提交培训日报${report.id}至客服经理`)
   save(s)
   return stateJson(res,201,s,current)
  }
  let trainingReportMatch=url.pathname.match(/^\/api\/training\/reports\/([^/]+)\/review$/)
  if(req.method==='POST'&&trainingReportMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['manager'])
   const s=load(),report=s.trainingReports.find(item=>item.id===trainingReportMatch[1])
   if(!report)return json(res,404,{error:'培训日报不存在'})
   if(report.status==='reviewed')return stateJson(res,200,s,current)
   if(report.status!=='pending_manager_review')return json(res,409,{error:'当前培训日报不可查阅确认'})
   report.status='reviewed';report.reviewedAt=now();report.reviewedBy=actor;report.reviewComment=String(p.comment||'已阅，请按明日计划推进并持续关注高风险学员。').slice(0,500)
   s.notifications.filter(notice=>notice.role==='manager'&&notice.desc.includes(report.id)).forEach(notice=>notice.read=true)
   addNotice(s,'training',`经理已阅：${report.id}`,`${actor}：${report.reviewComment}`,'command','normal')
   audit(s,actor,`查阅培训日报${report.id}并回传培训岗`)
   save(s)
   return stateJson(res,200,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/hrbp/cases'){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['hrbp'])
   const s=load(),employee=p.employee
   if(!employee||!employee.id||!employee.name||!employee.team||!employee.batch)return json(res,400,{error:'员工、班组和入职批次信息不能为空'})
   if(!['培训期','实操期','实习期','正式期'].includes(employee.cycle))return json(res,400,{error:'员工周期不正确'})
   const plan=String(p.plan||'').trim()
   if(!plan)return json(res,400,{error:'请填写首次沟通计划'})
   const reasons=Array.isArray(employee.reasons)?employee.reasons.map(item=>String(item).trim().slice(0,120)).filter(Boolean).slice(0,10):[]
   if(!reasons.length)return json(res,400,{error:'至少需要一项离职风险证据'})
   const employeeId=String(employee.id).trim()
   const duplicate=s.hrbpCases.find(item=>item.employeeId===employeeId&&item.status!=='closed')
   if(duplicate)return json(res,409,{error:`${employee.name}已有未关闭沟通任务`,caseId:duplicate.id})
   const today=new Date(),day=`${String(today.getFullYear()).slice(2)}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
   const sequence=String(s.hrbpCases.filter(item=>item.id.startsWith(`HR-${day}-`)).length+1).padStart(3,'0')
   const record={
    id:`HR-${day}-${sequence}`,employeeId,name:String(employee.name).slice(0,40),team:String(employee.team).slice(0,80),batch:String(employee.batch).slice(0,80),cycle:employee.cycle,
    riskScore:Math.max(0,Math.min(100,Number(employee.riskScore)||0)),reasons,status:'hrbp_todo',owner:'HRBP经理',createdAt:now(),due:String(p.due||'今日 16:00').slice(0,40),
    hrbpNote:plan,managerNote:'',result:'',filedAt:'',filedBy:'',history:[{time:actionTime(),actor,action:'基于流失风险识别生成重点员工沟通任务'}],
   }
   s.hrbpCases.unshift(record)
   addNotice(s,'hrbp',`沟通任务已创建：${record.name}`,`${record.id} · 风险${record.riskScore}分 · ${record.due}前完成首次沟通。`,'tasks','high')
   audit(s,actor,`创建人员稳定沟通任务${record.id}`)
   save(s)
   return stateJson(res,201,s,current)
  }
  const hrbpCaseMatch=url.pathname.match(/^\/api\/hrbp\/cases\/([^/]+)\/action$/)
  if(req.method==='POST'&&hrbpCaseMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['hrbp','manager'])
   const s=load(),record=s.hrbpCases.find(item=>item.id===hrbpCaseMatch[1])
   if(!record)return json(res,404,{error:'人员稳定沟通任务不存在'})
   const action=String(p.action||''),note=String(p.note||'').trim().slice(0,1000)
   const append=description=>record.history.push({time:actionTime(),actor,action:description})
   const reject=(message='当前状态不可执行此操作')=>json(res,409,{error:message})
   if(action==='hrbp_start'){
    if(role!=='hrbp')return json(res,403,{error:'仅HRBP岗位可开始首次沟通'})
    if(record.status!=='hrbp_todo')return reject()
    record.status='hrbp_contacting';record.owner='HRBP经理';append('开始重点员工沟通')
   }else if(action==='hrbp_close'){
    if(role!=='hrbp')return json(res,403,{error:'仅HRBP岗位可关闭自主解决的沟通任务'})
    if(record.status!=='hrbp_contacting')return reject()
    if(!note)return json(res,400,{error:'请填写沟通结论和留任方案'})
    record.status='closed';record.owner='已关闭';record.hrbpNote=note;record.result='HRBP已形成留任方案，任务关闭并进入回访。';record.filedAt=now();record.filedBy=actor;append('形成可执行留任方案，关闭任务并完成备案')
   }else if(action==='escalate_manager'){
    if(role!=='hrbp')return json(res,403,{error:'仅HRBP岗位可升级经理处理'})
    if(record.status!=='hrbp_contacting')return reject()
    if(!note)return json(res,400,{error:'请填写员工诉求和升级判断'})
    record.status='manager_pending';record.owner='运营经理';record.hrbpNote=note;record.due='今日 17:00';append('评估超出HRBP处理权限，升级运营经理PDCA')
    addNotice(s,'manager',`HRBP升级：${record.name}高流失风险`,`${record.id} · ${record.team} · 风险${record.riskScore}分 · ${record.due}前完成经理沟通。`,'tasks','high')
   }else if(action==='manager_start'){
    if(role!=='manager')return json(res,403,{error:'仅运营经理可接收升级任务'})
    if(record.status!=='manager_pending')return reject()
    record.status='manager_contacting';record.owner='运营经理';append('接收HRBP升级并开始经理级沟通')
    s.notifications.filter(item=>item.role==='manager'&&item.desc.includes(record.id)).forEach(item=>item.read=true)
    addNotice(s,'hrbp',`经理已接收：${record.name}`,`${record.id}已进入经理沟通阶段，处理结果将自动回传。`,'tasks','normal')
   }else if(action==='manager_close'){
    if(role!=='manager')return json(res,403,{error:'仅运营经理可关闭经理级沟通任务'})
    if(record.status!=='manager_contacting')return reject()
    if(!note)return json(res,400,{error:'请填写资源协调结果和员工最终意愿'})
    record.status='closed';record.owner='已关闭';record.managerNote=note;record.result=`经理沟通完成：${note}`;record.filedAt='';record.filedBy='';append('完成经理级沟通并关闭任务，结果回传HRBP')
    s.notifications.filter(item=>item.role==='manager'&&item.desc.includes(record.id)).forEach(item=>item.read=true)
    addNotice(s,'hrbp',`经理沟通结果待备案：${record.name}`,`${record.id} · ${note}`,'tasks','high')
   }else if(action==='hrbp_file'){
    if(role!=='hrbp')return json(res,403,{error:'仅HRBP岗位可完成人员稳定结果备案'})
    if(record.status!=='closed'||!record.managerNote)return reject('仅经理已关闭并回传结果的任务可以备案')
    if(record.filedAt)return stateJson(res,200,s,current)
    record.filedAt=now();record.filedBy=actor;append('确认经理沟通结果并完成HRBP备案')
    s.notifications.filter(item=>item.role==='hrbp'&&item.desc.includes(record.id)).forEach(item=>item.read=true)
   }else return json(res,400,{error:'不支持的人员稳定任务动作'})
   audit(s,actor,`${record.id}：${record.history.at(-1)?.action||action}`)
   save(s)
   return stateJson(res,200,s,current)
  }
  const staffingMatch=url.pathname.match(/^\/api\/hrbp\/staffing\/([^/]+)\/action$/)
  if(req.method==='POST'&&staffingMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['hrbp','manager'])
   const s=load(),plan=s.people.staffingPlans.find(item=>item.id===staffingMatch[1])
   if(!plan)return json(res,404,{error:'编制招聘计划不存在'})
   const action=safeText(p.action,40),reject=message=>json(res,409,{error:message})
   if(action==='update_pipeline'){
    if(role!=='hrbp'||!['active','returned_hrbp'].includes(plan.status))return reject('仅HRBP可更新执行中的招聘漏斗')
    const interviewed=Math.round(Number(p.interviewed)),offers=Math.round(Number(p.offersAccepted)),onboarded=Math.round(Number(p.onboarded))
    if(![interviewed,offers,onboarded].every(Number.isFinite)||interviewed<offers||offers<onboarded||onboarded<plan.onboarded)return json(res,400,{error:'招聘漏斗需满足面试≥接收Offer≥到岗，且到岗人数不可回退'})
    plan.interviewed=interviewed;plan.offersAccepted=offers;plan.onboarded=onboarded
    plan.history.unshift({at:now(),actor,action:`更新招聘漏斗：面试${interviewed}人、接收Offer ${offers}人、到岗${onboarded}人`})
   }else if(action==='submit_gap_plan'){
    if(role!=='hrbp'||!['active','returned_hrbp'].includes(plan.status))return reject('当前计划不可提交经理审批')
    plan.status='manager_pending';plan.owner='运营经理'
    plan.history.unshift({at:now(),actor,action:`提交补员方案，当前在岗缺口${plan.gap}人、月度到岗${plan.onboarded}/${plan.hiringTarget}人`})
    addNotice(s,'manager',`补员方案待审批：${plan.project}`,`${plan.id} · 编制缺口${plan.gap}人 · 到岗${plan.onboarded}/${plan.hiringTarget}人。`,'tasks','high')
   }else if(action==='manager_approve'){
    if(role!=='manager'||plan.status!=='manager_pending')return reject('仅经理可审批待审补员方案')
    plan.status='active';plan.owner='HRBP经理 陈静';plan.managerComment=safeText(p.comment,500)||'同意按招聘渠道计划推进，周度复盘到岗差距。'
    plan.history.unshift({at:now(),actor,action:`批准补员方案：${plan.managerComment}`})
    addNotice(s,'hrbp',`补员方案已批准：${plan.project}`,plan.managerComment,'command','normal')
   }else if(action==='manager_return'){
    if(role!=='manager'||plan.status!=='manager_pending')return reject('仅经理可退回待审补员方案')
    plan.status='returned_hrbp';plan.owner='HRBP经理 陈静';plan.managerComment=safeText(p.comment,500)||'请补充渠道产出、到岗时间和业务风险。'
    plan.history.unshift({at:now(),actor,action:`退回补充：${plan.managerComment}`})
    addNotice(s,'hrbp',`补员方案退回：${plan.project}`,plan.managerComment,'command','high')
   }else if(action==='close'){
    if(role!=='hrbp'||plan.status!=='active')return reject('仅HRBP可关闭执行中的编制计划')
    plan.actualOccupancy=Math.round(plan.activeHeadcount/plan.approvedHeadcount*1000)/10
    plan.gap=Math.max(0,plan.approvedHeadcount-plan.activeHeadcount)
    if(plan.actualOccupancy<plan.targetOccupancy||plan.gap>0)return reject(`当前在岗满足率${plan.actualOccupancy}%、缺口${plan.gap}人，未达到${plan.targetOccupancy}%目标，不能关闭`)
    plan.status='closed';plan.owner='已关闭';plan.history.unshift({at:now(),actor,action:'在岗满足率与编制目标均达标，计划关闭'})
   }else return json(res,400,{error:'不支持的编制招聘动作'})
   audit(s,actor,`${plan.id}：${plan.history[0].action}`);save(s);return stateJson(res,200,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/hrbp/lifecycle'){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['hrbp'])
   const s=load(),type=safeText(p.type,30)
   if(!['transfer','resignation'].includes(type))return json(res,400,{error:'仅支持创建调动或离职事项'})
   const employee=s.workforce.employees.find(item=>item.id===p.employeeId||item.jobNo===p.employeeId)
   if(!employee)return json(res,404,{error:'员工主数据不存在'})
   const effectiveDate=safeText(p.effectiveDate,10),detail=safeText(p.detail,1000)
   if(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)||!detail)return json(res,400,{error:'生效日期和事实说明不能为空'})
   if(s.people.lifecycle.some(item=>item.employeeId===employee.id&&item.status!=='closed'))return json(res,409,{error:'该员工已有未关闭的人事异动'})
   const sequence=String(s.people.lifecycle.length+1).padStart(3,'0')
   const record={id:`LC-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${sequence}`,type,title:`${employee.name}${type==='transfer'?'组织调动':'离职办理'}`,employeeId:employee.id,employeeName:employee.name,personCount:1,employeeIds:[employee.id],source:'HRBP发起',fromOrg:employee.team,toOrg:type==='transfer'?safeText(p.toOrg,80):'离职',effectiveDate,status:'hrbp_preparing',ownerRole:'hrbp',owner:'HRBP经理 陈静',detail,managerComment:'',result:'',checklist:{contract:type==='transfer',medical:true,account:false,shift:false,team:false},history:[{at:now(),actor,action:`创建${type==='transfer'?'员工调动':'离职办理'}事项`}]}
   if(type==='transfer'&&!record.toOrg)return json(res,400,{error:'员工调动必须选择目标组织'})
   s.people.lifecycle.unshift(record);audit(s,actor,`创建人事异动${record.id}`);save(s);return stateJson(res,201,s,current)
  }
  const lifecycleMatch=url.pathname.match(/^\/api\/hrbp\/lifecycle\/([^/]+)\/action$/)
  if(req.method==='POST'&&lifecycleMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['hrbp','manager'])
   const s=load(),record=s.people.lifecycle.find(item=>item.id===lifecycleMatch[1])
   if(!record)return json(res,404,{error:'入转调离事项不存在'})
   const action=safeText(p.action,40),reject=message=>json(res,409,{error:message})
   if(action==='prepare'){
    if(role!=='hrbp'||!['hrbp_preparing','returned_hrbp'].includes(record.status))return reject('仅HRBP可补全准备事项')
    for(const field of Object.keys(record.checklist))if(p[field]!==undefined)record.checklist[field]=Boolean(p[field])
    record.status='hrbp_preparing';record.ownerRole='hrbp';record.owner='HRBP经理 陈静'
    record.history.unshift({at:now(),actor,action:`更新办理清单：${Object.values(record.checklist).filter(Boolean).length}/5项完成`})
   }else if(action==='submit_manager'){
    if(role!=='hrbp'||record.status!=='hrbp_preparing')return reject('当前事项不可提交经理审批')
    const missing=Object.entries(record.checklist).filter(([,value])=>!value).map(([key])=>({contract:'合同/协议',medical:'体检/健康',account:'系统账号',shift:'排班',team:'班组承接'}[key]))
    if(missing.length)return reject(`仍有${missing.join('、')}未完成，不能提交`)
    record.status='manager_pending';record.ownerRole='manager';record.owner='运营经理'
    record.history.unshift({at:now(),actor,action:'办理资料与组织承接核验完成，提交运营经理审批'})
    addNotice(s,'manager',`人事事项待审批：${record.title}`,`${record.id} · ${record.fromOrg} → ${record.toOrg} · ${record.effectiveDate}生效。`,'tasks','high')
   }else if(action==='manager_approve'){
    if(role!=='manager'||record.status!=='manager_pending')return reject('仅经理可审批待审人事事项')
    record.status='hrbp_execute';record.ownerRole='hrbp';record.owner='HRBP经理 陈静';record.managerComment=safeText(p.comment,500)||'同意办理，请按生效日更新组织、账号和排班。'
    record.history.unshift({at:now(),actor,action:`审批通过：${record.managerComment}`})
    addNotice(s,'hrbp',`人事事项已批准：${record.title}`,record.managerComment,'command','high')
   }else if(action==='manager_return'){
    if(role!=='manager'||record.status!=='manager_pending')return reject('仅经理可退回待审人事事项')
    record.status='returned_hrbp';record.ownerRole='hrbp';record.owner='HRBP经理 陈静';record.managerComment=safeText(p.comment,500)||'请补充组织承接和员工确认记录。'
    record.history.unshift({at:now(),actor,action:`退回HRBP补充：${record.managerComment}`})
    addNotice(s,'hrbp',`人事事项被退回：${record.title}`,record.managerComment,'command','high')
   }else if(action==='complete'){
    if(role!=='hrbp'||record.status!=='hrbp_execute')return reject('仅HRBP可执行已批准的人事事项')
    if(record.type==='onboarding_batch'){
     const trainees=s.training.trainees.filter(item=>record.employeeIds.includes(item.id))
     for(const trainee of trainees){
      if(s.workforce.employees.some(item=>item.jobNo===trainee.jobNo))continue
      s.workforce.employees.push({id:`EMP-${trainee.jobNo.replace(/^JR/,'')}`,jobNo:trainee.jobNo,name:trainee.name,role:'employee',area:'前台普通客服一区',team:`${record.toOrg}·待分班`,leader:'待分配',stage:'新人期',skills:['10015前台'],status:'active',currentShift:'待排班'})
     }
     const plan=s.people.staffingPlans.find(item=>item.project.includes('10015')&&item.status!=='closed')
     if(plan){plan.activeHeadcount+=trainees.length;plan.onboarded+=trainees.length;plan.gap=Math.max(0,plan.approvedHeadcount-plan.activeHeadcount);plan.actualOccupancy=Math.round(plan.activeHeadcount/plan.approvedHeadcount*1000)/10}
     record.result=`${trainees.length}名合格新工已写入人员主数据，进入新人期并等待班组细分。`
     addNotice(s,'training',`新工已正式入列：${record.title}`,record.result,'command','normal')
    }else{
     const employee=s.workforce.employees.find(item=>item.id===record.employeeId)
     if(!employee)return reject('员工主数据不存在，不能执行')
     if(record.type==='transfer'){employee.team=record.toOrg;employee.leader=record.toOrg.includes('6班')?'刘洋':record.toOrg.includes('8班')?'张伟':'待分配';record.result=`已更新${employee.name}组织至${record.toOrg}，直属班长${employee.leader}。`}
     else {employee.status='inactive';record.result=`${employee.name}已完成离职和账号停用，人员主数据状态更新为离职。`;const plan=s.people.staffingPlans.find(item=>item.status!=='closed');if(plan){plan.activeHeadcount=Math.max(0,plan.activeHeadcount-1);plan.gap=Math.max(0,plan.approvedHeadcount-plan.activeHeadcount);plan.actualOccupancy=Math.round(plan.activeHeadcount/plan.approvedHeadcount*1000)/10}}
    }
    record.status='closed';record.ownerRole='closed';record.owner='已关闭';record.history.unshift({at:now(),actor,action:record.result})
    addNotice(s,'manager',`人事事项已生效：${record.title}`,record.result,'command','normal')
   }else return json(res,400,{error:'不支持的人事事项动作'})
   audit(s,actor,`${record.id}：${record.history[0].action}`);save(s);return stateJson(res,200,s,current)
  }
  const laborMatch=url.pathname.match(/^\/api\/hrbp\/labor\/([^/]+)\/action$/)
  if(req.method==='POST'&&laborMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['hrbp','manager'])
   const s=load(),record=s.people.laborCases.find(item=>item.id===laborMatch[1])
   if(!record)return json(res,404,{error:'劳动关系事项不存在'})
   const action=safeText(p.action,40),result=safeText(p.result,1200),reject=message=>json(res,409,{error:message})
   if(action==='start'){
    if(role!=='hrbp'||record.status!=='hrbp_todo')return reject('仅HRBP可开始待办劳动关系事项')
    record.status='hrbp_doing';record.ownerRole='hrbp';record.owner='HRBP经理 陈静';record.history.unshift({at:now(),actor,action:'开始事实调查、员工沟通和制度核对'})
   }else if(action==='escalate_manager'){
    if(role!=='hrbp'||record.status!=='hrbp_doing'||!result)return reject('HRBP处理中且填写调查结论后方可升级经理')
    record.status='manager_pending';record.ownerRole='manager';record.owner='运营经理';record.result=result;record.history.unshift({at:now(),actor,action:`调查完成，升级经理决策：${result}`})
    addNotice(s,'manager',`劳动关系事项待决策：${record.title}`,`${record.employeeName} · ${result}`,'tasks','high')
   }else if(action==='manager_start'){
    if(role!=='manager'||record.status!=='manager_pending')return reject('仅经理可接收待决策事项')
    record.status='manager_doing';record.owner='运营经理';record.history.unshift({at:now(),actor,action:'接收劳动关系事项并开始管理决策'})
   }else if(action==='close'){
    if(role==='hrbp'&&record.status!=='hrbp_doing')return reject('当前事项不能由HRBP关闭')
    if(role==='manager'&&record.status!=='manager_doing')return reject('当前事项不能由经理关闭')
    if(!result)return json(res,400,{error:'关闭劳动关系事项必须填写处理结论'})
    record.status='closed';record.ownerRole='closed';record.owner='已关闭';record.result=result;record.history.unshift({at:now(),actor,action:`形成处理结论并关闭：${result}`})
    addNotice(s,role==='manager'?'hrbp':'manager',`劳动关系事项已关闭：${record.title}`,result,'command','normal')
   }else return json(res,400,{error:'不支持的劳动关系动作'})
   audit(s,actor,`${record.id}：${record.history[0].action}`);save(s);return stateJson(res,200,s,current)
  }
  const costMatch=url.pathname.match(/^\/api\/hrbp\/costs\/([^/]+)\/action$/)
  if(req.method==='POST'&&costMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['hrbp'])
   const s=load(),record=s.people.costs.find(item=>item.id===costMatch[1])
   if(!record)return json(res,404,{error:'人员成本计划不存在'})
   if(p.action!=='update_forecast')return json(res,400,{error:'不支持的人员成本动作'})
   const forecast=Math.round(Number(p.forecast)),actual=Math.round(Number(p.actual))
   if(!Number.isFinite(forecast)||!Number.isFinite(actual)||forecast<actual||actual<0)return json(res,400,{error:'成本预测必须不低于当前实际成本'})
   record.forecast=forecast;record.actual=actual;record.gap=forecast-record.budget;record.updatedAt=now()
   record.history.unshift({at:now(),actor,action:`更新实际成本${actual}元、月末预测${forecast}元，预算差异${record.gap}元`})
   if(record.gap>0)addNotice(s,'manager',`人员成本预计超预算：${record.project}`,`${record.month}预测超预算${record.gap}元，请关注加班、招聘与到岗结构。`,'command','high')
   audit(s,actor,`更新人员成本预测${record.id}`);save(s);return stateJson(res,200,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/hrbp/interviews'){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['hrbp'])
   const s=load(),employee=s.workforce.employees.find(item=>item.id===p.employeeId||item.jobNo===p.employeeId)
   if(!employee)return json(res,404,{error:'员工主数据不存在'})
   if(!['probation','retention','exit'].includes(p.type))return json(res,400,{error:'访谈类型不正确'})
   const scheduledAt=normalizeDueAt(p.scheduledAt),followUpAt=normalizeDueAt(p.followUpAt)
   const sequence=String(s.people.interviews.length+1).padStart(3,'0')
   const record={id:`INT-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${sequence}`,type:p.type,employeeId:employee.jobNo,employeeName:employee.name,team:employee.team,interviewer:'HRBP经理 陈静',scheduledAt,followUpAt,status:'planned',conclusion:'',commitments:[],linkedCaseId:safeText(p.linkedCaseId,50),history:[{at:now(),actor,action:'创建结构化员工访谈计划'}]}
   s.people.interviews.unshift(record);addNotice(s,'hrbp',`员工访谈已安排：${employee.name}`,`${record.id} · ${new Date(scheduledAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}`,'command','normal')
   audit(s,actor,`创建员工访谈${record.id}`);save(s);return stateJson(res,201,s,current)
  }
  const interviewMatch=url.pathname.match(/^\/api\/hrbp\/interviews\/([^/]+)\/action$/)
  if(req.method==='POST'&&interviewMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['hrbp'])
   const s=load(),record=s.people.interviews.find(item=>item.id===interviewMatch[1])
   if(!record)return json(res,404,{error:'员工访谈不存在'})
   const conclusion=safeText(p.conclusion,1200)
   if(!conclusion)return json(res,400,{error:'请填写访谈结论或回访结果'})
   if(p.action==='complete'){
    if(record.status!=='planned')return json(res,409,{error:'仅计划中的访谈可以完成'})
    record.conclusion=conclusion;record.commitments=Array.isArray(p.commitments)?p.commitments.map(item=>safeText(item,200)).filter(Boolean).slice(0,8):[]
    if(!record.commitments.length)return json(res,400,{error:'访谈必须形成至少一项双方承诺或后续动作'})
    record.status='followup_due';record.history.unshift({at:now(),actor,action:`完成访谈：${conclusion}`})
   }else if(p.action==='close'){
    if(record.status!=='followup_due')return json(res,409,{error:'仅待回访访谈可以关闭'})
    record.status='closed';record.conclusion=`${record.conclusion}；回访：${conclusion}`;record.history.unshift({at:now(),actor,action:`完成承诺回访并关闭：${conclusion}`})
   }else return json(res,400,{error:'不支持的访谈动作'})
   audit(s,actor,`${record.id}：${record.history[0].action}`);save(s);return stateJson(res,200,s,current)
  }
  const shiftPlanMatch=url.pathname.match(/^\/api\/governance\/shift-plans\/([^/]+)\/action$/)
  if(req.method==='POST'&&shiftPlanMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['supervisor','manager'])
   const s=load(),record=s.governance.shiftPlans.find(item=>item.id===shiftPlanMatch[1])
   if(!record)return json(res,404,{error:'排班计划不存在'})
   const action=safeText(p.action,40),comment=safeText(p.comment,1200)
   if(action==='submit'){
    if(role!=='supervisor'||!['draft','returned'].includes(record.status))return json(res,409,{error:'仅主管可提交草稿或退回的排班计划'})
    if(record.scheduled<record.required&&record.teams.every(item=>item.gap<=0))return json(res,409,{error:'排班总人数与班组缺口不一致，请先校验计划'})
    record.status='manager_pending';record.ownerRole='manager';record.owner='客服经理';record.comment=comment||record.comment
    record.history.push({at:now(),actor,action:`提交经理审批：${record.comment}`});addNotice(s,'manager',`明日排班计划待审批：${record.area}`,`${record.id} · 总需求${record.required}人，已排${record.scheduled}人。`,'tasks','high')
   }else if(action==='manager_approve'){
    if(role!=='manager'||record.status!=='manager_pending')return json(res,409,{error:'仅经理可审批待审排班计划'})
    const unresolved=record.teams.filter(item=>item.gap>0).reduce((sum,item)=>sum+item.gap,0)
    if(unresolved>0&&!comment)return json(res,400,{error:`仍有${unresolved}个人力缺口，请填写跨班支援或招聘补位意见`})
    record.status='published';record.ownerRole='supervisor';record.owner='前台客服主管';record.result=comment||'排班计划已批准并发布至相关班组'
    record.history.push({at:now(),actor,action:`批准并发布：${record.result}`});addNotice(s,'supervisor',`排班计划已批准：${record.area}`,record.result,'workforce','normal');addNotice(s,'leader',`明日排班计划已发布：${record.area}`,`${record.date} · 请核对班组班次与缺口补位安排。`,'workforce','normal')
   }else if(action==='manager_return'){
    if(role!=='manager'||record.status!=='manager_pending'||!comment)return json(res,409,{error:'经理退回时必须填写调整意见'})
    record.status='returned';record.ownerRole='supervisor';record.owner='前台客服主管';record.result=comment
    record.history.push({at:now(),actor,action:`退回主管调整：${comment}`});addNotice(s,'supervisor',`排班计划被退回：${record.area}`,comment,'workforce','high')
   }else return json(res,400,{error:'不支持的排班计划动作'})
   audit(s,actor,`${record.id}：${record.history.at(-1).action}`);save(s);return stateJson(res,200,s,current)
  }
  const skillRouteMatch=url.pathname.match(/^\/api\/governance\/skill-routes\/([^/]+)\/action$/)
  if(req.method==='POST'&&skillRouteMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['supervisor','manager'])
   const s=load(),record=s.governance.skillRoutes.find(item=>item.id===skillRouteMatch[1])
   if(!record)return json(res,404,{error:'技能路由方案不存在'})
   const action=safeText(p.action,40),comment=safeText(p.comment,1200)
   if(action==='submit'){
    if(role!=='supervisor'||!['draft','returned'].includes(record.status))return json(res,409,{error:'仅主管可提交草稿或退回的路由方案'})
    if(record.sourceProtectionAfter<95)return json(res,409,{error:`调出技能组预计保护率${record.sourceProtectionAfter}%，低于95%安全线`})
    record.status='manager_pending';record.ownerRole='manager';record.owner='客服经理';record.history.push({at:now(),actor,action:`提交技能路由审批：${comment||'调出侧高于安全线'}`});addNotice(s,'manager',`技能路由待审批：${record.toSkill}`,`${record.people}人 · ${record.window} · 目标接通率${record.targetAnswerRate}%`,'tasks','high')
   }else if(action==='manager_approve'){
    if(role!=='manager'||record.status!=='manager_pending')return json(res,409,{error:'仅经理可批准待审路由方案'})
    if(record.sourceProtectionAfter<95)return json(res,409,{error:'调出侧低于95%保护线，不能批准'})
    record.status='executing';record.ownerRole='supervisor';record.owner='前台客服主管';record.result=comment||'方案已批准，进入执行和效果观察'
    record.history.push({at:now(),actor,action:`批准执行：${record.result}`});addNotice(s,'supervisor',`技能路由已批准：${record.toSkill}`,`请执行并在窗口结束后回填实际接通率。`,'workforce','normal')
   }else if(action==='manager_return'){
    if(role!=='manager'||record.status!=='manager_pending'||!comment)return json(res,409,{error:'经理退回时必须填写调整意见'})
    record.status='returned';record.ownerRole='supervisor';record.owner='前台客服主管';record.result=comment;record.history.push({at:now(),actor,action:`退回方案：${comment}`});addNotice(s,'supervisor',`技能路由被退回：${record.toSkill}`,comment,'workforce','high')
   }else if(action==='submit_effect'){
    if(role!=='supervisor'||!['executing','effect_pending'].includes(record.status))return json(res,409,{error:'仅执行中的路由方案可以回填效果'})
    const actual=Math.round(Number(p.actualAnswerRate)*10)/10
    if(!Number.isFinite(actual)||actual<0||actual>100)return json(res,400,{error:'实际接通率必须在0—100%之间'})
    record.actualAnswerRate=actual
    if(actual>=record.targetAnswerRate){
     record.status='closed';record.ownerRole='supervisor';record.owner='已关闭';record.result=`实际接通率${actual}%，达到${record.targetAnswerRate}%目标`
     record.history.push({at:now(),actor,action:`效果达标并关闭：${record.result}`});addNotice(s,'manager',`技能调度验效通过：${record.toSkill}`,record.result,'tasks','normal')
    }else{
     record.status='returned';record.ownerRole='supervisor';record.owner='前台客服主管';record.result=`实际接通率${actual}%，仍低于目标${(record.targetAnswerRate-actual).toFixed(1)}pp`
     record.history.push({at:now(),actor,action:`效果未达标，返回主管改进：${record.result}`});addNotice(s,'supervisor',`技能调度未达目标：${record.toSkill}`,record.result,'workforce','high')
    }
   }else return json(res,400,{error:'不支持的技能路由动作'})
   audit(s,actor,`${record.id}：${record.history.at(-1).action}`);save(s);return stateJson(res,200,s,current)
  }
  const budgetMatch=url.pathname.match(/^\/api\/governance\/budgets\/([^/]+)\/action$/)
  if(req.method==='POST'&&budgetMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['manager','director'])
   const s=load(),record=s.governance.budgets.find(item=>item.id===budgetMatch[1])
   if(!record)return json(res,404,{error:'经营预算不存在'})
   const action=safeText(p.action,40),comment=safeText(p.comment,1200)
   if(action==='manager_submit'){
    if(role!=='manager'||!['manager_draft','returned'].includes(record.status)||!comment)return json(res,409,{error:'经理必须补充偏差说明后提交'})
    record.managerComment=comment;record.status='director_pending';record.ownerRole='director';record.owner='运营总监';record.history.push({at:now(),actor,action:`重新提交经营预测：${comment}`});addNotice(s,'director',`经营预算待决策：${record.project}`,`${record.month} · 预测毛利率${record.forecastMargin}%`,'tasks','high')
   }else if(action==='director_approve'){
    if(role!=='director'||record.status!=='director_pending'||!comment)return json(res,409,{error:'总监审批必须填写经营动作和控制要求'})
    record.status='active';record.ownerRole='manager';record.owner='客服经理';record.directorComment=comment;record.history.push({at:now(),actor,action:`批准预算与经营动作：${comment}`});addNotice(s,'manager',`经营预算已批准：${record.project}`,comment,'tasks','normal')
   }else if(action==='director_return'){
    if(role!=='director'||record.status!=='director_pending'||!comment)return json(res,409,{error:'总监退回必须填写调整要求'})
    record.status='returned';record.ownerRole='manager';record.owner='客服经理';record.directorComment=comment;record.history.push({at:now(),actor,action:`退回经营预测：${comment}`});addNotice(s,'manager',`经营预算被退回：${record.project}`,comment,'tasks','high')
   }else return json(res,400,{error:'不支持的经营预算动作'})
   audit(s,actor,`${record.id}：${record.history.at(-1).action}`);save(s);return stateJson(res,200,s,current)
  }
  const contractMatch=url.pathname.match(/^\/api\/governance\/contracts\/([^/]+)\/action$/)
  if(req.method==='POST'&&contractMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['manager','director'])
   const s=load(),record=s.governance.contracts.find(item=>item.id===contractMatch[1])
   if(!record)return json(res,404,{error:'合同事项不存在'})
   const action=safeText(p.action,40),comment=safeText(p.comment,1200)
   if(action==='manager_submit'){
    if(role!=='manager'||!['manager_draft','returned'].includes(record.status)||!comment)return json(res,409,{error:'经理必须补充续约材料说明后提交'})
    record.managerComment=comment;record.status='director_pending';record.ownerRole='director';record.owner='运营总监';record.history.push({at:now(),actor,action:`重新提交合同决策：${comment}`});addNotice(s,'director',`合同续约待决策：${record.project}`,`${record.customer} · 合同额${record.amount}万元`,'tasks','high')
   }else if(action==='director_approve'){
    if(role!=='director'||record.status!=='director_pending'||!comment)return json(res,409,{error:'总监审批必须填写谈判边界与下一步'})
    record.status='approved';record.ownerRole='manager';record.owner='客服经理';record.directorComment=comment;record.milestones.forEach(item=>{if(item.status==='active')item.status='done';else if(item.status==='pending')item.status='active'})
    record.history.push({at:now(),actor,action:`批准续约决策：${comment}`});addNotice(s,'manager',`合同续约决策已批准：${record.project}`,comment,'tasks','normal')
   }else if(action==='director_return'){
    if(role!=='director'||record.status!=='director_pending'||!comment)return json(res,409,{error:'总监退回必须填写补充材料要求'})
    record.status='returned';record.ownerRole='manager';record.owner='客服经理';record.directorComment=comment;record.history.push({at:now(),actor,action:`退回续约材料：${comment}`});addNotice(s,'manager',`合同续约材料被退回：${record.project}`,comment,'tasks','high')
   }else return json(res,400,{error:'不支持的合同动作'})
   audit(s,actor,`${record.id}：${record.history.at(-1).action}`);save(s);return stateJson(res,200,s,current)
  }
  const meetingMatch=url.pathname.match(/^\/api\/governance\/meetings\/([^/]+)\/action$/)
  if(req.method==='POST'&&meetingMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['director'])
   const s=load(),record=s.governance.meetings.find(item=>item.id===meetingMatch[1])
   if(!record)return json(res,404,{error:'经营会议不存在'})
   if(p.action!=='publish'||record.status!=='draft')return json(res,409,{error:'仅草稿会议可以发布'})
   const summary=safeText(p.summary,1600)
   if(summary.length<20||!record.conclusions.length||!record.actions.length)return json(res,400,{error:'发布前必须形成会议总结、结论和至少一项行动'})
   record.summary=summary;record.status='published';record.publishedAt=now();record.actions.forEach(action=>{
    action.status='issued'
    if(s.tasks.some(task=>task.sourceKey===`meeting:${record.id}:${action.id}`))return
    s.tasks.unshift({id:`MT-${Date.now()}-${action.id}`,eventId:record.id,title:action.title,type:'经营例会行动',ownerRole:action.ownerRole,owner:action.owner,supervisor:'运营总监',status:'todo',phase:'D',progress:0,dueAt:action.dueAt,evidence:'',verification:'',createdAt:now(),updatedAt:now(),sourceKey:`meeting:${record.id}:${action.id}`,sourceLabel:'经营例会',verificationRole:'director',workflowKind:'meeting_action',target:action.target,history:[{at:now(),actor,action:`经营例会发布行动：${action.target}`}]})
    addNotice(s,action.ownerRole,`经营例会行动：${action.title}`,`${action.target} · 截止${new Date(action.dueAt).toLocaleString('zh-CN',{hour12:false})}`,'tasks','high')
   })
   record.history.push({at:now(),actor,action:`发布会议纪要并下发${record.actions.length}项行动`});audit(s,actor,`${record.id}发布经营会议行动`);save(s);return stateJson(res,200,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/governance/cross-department'){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['director'])
   const targetRole=safeText(p.targetRole,30),allowed=['manager','supervisor','hrbp','quality','training']
   if(!allowed.includes(targetRole))return json(res,400,{error:'目标岗位无效'})
   const title=safeText(p.title,100),detail=safeText(p.detail,1600),target=safeText(p.target,600),department=safeText(p.targetDepartment,100)
   if(!title||detail.length<10||!target||!department)return json(res,400,{error:'标题、目标部门、事实说明和验收目标不能为空'})
   const s=load(),sequence=String(s.governance.crossDepartmentItems.length+1).padStart(3,'0')
   const record={id:`CD-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${sequence}`,title,originRole:'director',targetRole,targetDepartment:department,detail,target,dueAt:normalizeDueAt(p.dueAt),status:'target_pending',ownerRole:targetRole,owner:roles[targetRole],result:'',history:[{at:now(),actor,action:`下发跨部门协同：${detail}`}]}
   s.governance.crossDepartmentItems.unshift(record);addNotice(s,targetRole,`总监跨部门协同：${title}`,`${target} · 请按时回传结果。`,'tasks','high');audit(s,actor,`创建${record.id}`);save(s);return stateJson(res,201,s,current)
  }
  const crossDepartmentMatch=url.pathname.match(/^\/api\/governance\/cross-department\/([^/]+)\/action$/)
  if(req.method==='POST'&&crossDepartmentMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['manager','supervisor','hrbp','quality','training','director'])
   const s=load(),record=s.governance.crossDepartmentItems.find(item=>item.id===crossDepartmentMatch[1])
   if(!record)return json(res,404,{error:'跨部门协同事项不存在'})
   const action=safeText(p.action,40),result=safeText(p.result,1600)
   if(action==='start'){
    if(role!==record.targetRole||record.status!=='target_pending')return json(res,409,{error:'仅目标岗位可接收该事项'})
    record.status='target_doing';record.ownerRole=role;record.owner=roles[role];record.history.push({at:now(),actor,action:'接收跨部门事项并开始处理'})
   }else if(action==='submit_result'){
    if(role!==record.targetRole||!['target_pending','target_doing','returned'].includes(record.status)||result.length<10)return json(res,409,{error:'目标岗位提交时必须填写至少10字的结果与证据'})
    record.status='director_verification';record.ownerRole='director';record.owner='运营总监';record.result=result;record.history.push({at:now(),actor,action:`提交总监验收：${result}`});addNotice(s,'director',`跨部门事项待验收：${record.title}`,result,'tasks','high')
   }else if(action==='director_verify'){
    if(role!=='director'||record.status!=='director_verification'||!result)return json(res,409,{error:'仅总监可验收待验证事项，且必须填写结论'})
    record.status='closed';record.ownerRole='director';record.owner='已关闭';record.result=`${record.result}；总监验收：${result}`;record.history.push({at:now(),actor,action:`验收通过并关闭：${result}`});addNotice(s,record.targetRole,`跨部门事项已验收：${record.title}`,result,'tasks','normal')
   }else if(action==='director_return'){
    if(role!=='director'||record.status!=='director_verification'||!result)return json(res,409,{error:'总监退回必须填写补充要求'})
    record.status='returned';record.ownerRole=record.targetRole;record.owner=roles[record.targetRole];record.history.push({at:now(),actor,action:`退回补充：${result}`});addNotice(s,record.targetRole,`跨部门事项需补充：${record.title}`,result,'tasks','high')
   }else return json(res,400,{error:'不支持的跨部门动作'})
   audit(s,actor,`${record.id}：${record.history.at(-1).action}`);save(s);return stateJson(res,200,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/workforce/requests'){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['employee','leader','supervisor'])
   const kind=safeText(p.kind,40)
   const allowedKinds={employee:['shift_change','leave'],leader:['attendance_exception'],supervisor:['cross_team_dispatch']}
   if(!allowedKinds[role].includes(kind))return json(res,403,{error:'当前岗位不能发起该类型的排班考勤事项',code:'WORKFORCE_KIND_FORBIDDEN'})
   const s=load(),employee=p.employeeId?s.workforce.employees.find(item=>item.id===p.employeeId):null
   if(kind!=='cross_team_dispatch'&&!employee)return json(res,400,{error:'请选择有效员工'})
   if(role==='employee'&&current.user.roleId!=='system-admin'&&employee.jobNo!==current.user.jobNo&&employee.name!==current.user.name)return json(res,403,{error:'员工只能为本人发起排班申请',code:'WORKFORCE_SCOPE_FORBIDDEN'})
   if(role==='leader'&&current.user.roleId!=='system-admin'){
    const visibleIds=new Set(visibleWorkforce(s.workforce,current,role).employees.map(item=>item.id))
    if(!visibleIds.has(employee.id))return json(res,403,{error:'班长只能处理本人班组员工',code:'WORKFORCE_SCOPE_FORBIDDEN'})
   }
   const detail=safeText(p.detail,1200),date=safeText(p.date,10)
   if(!detail||!/^\d{4}-\d{2}-\d{2}$/.test(date))return json(res,400,{error:'日期和事项说明不能为空'})
   const fromTeam=safeText(p.fromTeam||employee?.team,80),toTeam=safeText(p.toTeam,80)
   if(kind==='cross_team_dispatch'&&(!fromTeam||!toTeam||fromTeam===toTeam))return json(res,400,{error:'跨班调度必须选择不同的调出与调入班组'})
   const duplicate=s.workforce.requests.find(item=>item.kind===kind&&item.date===date&&!['closed','rejected'].includes(item.status)&&(kind==='cross_team_dispatch'?(item.fromTeam===fromTeam&&item.toTeam===toTeam):item.employeeId===employee.id))
   if(duplicate)return json(res,409,{error:'该日期已有同类型未关闭事项',requestId:duplicate.id})
   const today=new Date(),day=`${String(today.getFullYear()).slice(2)}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
   const sequence=String(s.workforce.requests.filter(item=>item.id.startsWith(`WF-${day}-`)).length+1).padStart(3,'0')
   const labels={shift_change:'调班申请',leave:'请假申请',attendance_exception:'考勤异常确认',cross_team_dispatch:'跨班组调度'}
   const next=role==='employee'?{status:'leader_pending',ownerRole:'leader',owner:`${employee.leader}（班长）`}:role==='leader'?{status:'supervisor_pending',ownerRole:'supervisor',owner:'前台客服主管'}:{status:'manager_pending',ownerRole:'manager',owner:'客服经理'}
   const request={
    id:`WF-${day}-${sequence}`,kind,title:safeText(p.title,80)||`${employee?.name||fromTeam} · ${labels[kind]}`,
    requesterRole:role,requester:actor,employeeId:employee?.id||'',employeeName:employee?.name||'',fromTeam,toTeam,date,detail,
    ...next,dueAt:normalizeDueAt(p.dueAt),createdAt:now(),updatedAt:now(),result:'',hrbpFiledAt:'',
    history:[{at:now(),actor,action:`发起${labels[kind]}：${detail}`}],
   }
   s.workforce.requests.unshift(request)
   addNotice(s,request.ownerRole,`${labels[kind]}待处理：${request.title}`,`${request.id} · ${date} · ${request.owner}`,'workforce','high')
   audit(s,actor,`创建${labels[kind]}${request.id}`)
   save(s)
   return stateJson(res,201,s,current)
  }
  const workforceRequestMatch=url.pathname.match(/^\/api\/workforce\/requests\/([^/]+)\/action$/)
  if(req.method==='POST'&&workforceRequestMatch){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['leader','supervisor','manager','hrbp'])
   const s=load(),request=s.workforce.requests.find(item=>item.id===workforceRequestMatch[1])
   if(!request)return json(res,404,{error:'排班考勤事项不存在'})
   const action=safeText(p.action,40),comment=safeText(p.comment,1200)
   const reject=message=>json(res,409,{error:message||'当前状态不可执行此操作'})
   const finishRejected=label=>{
    request.status='rejected';request.ownerRole=request.requesterRole;request.owner=request.requester;request.result=comment||`${label}未通过`
    request.history.push({at:now(),actor,action:`${label}未通过：${request.result}`})
    addNotice(s,request.requesterRole,`${label}未通过：${request.title}`,request.result,'workforce','high')
   }
   if(action==='leader_approve'){
    if(role!=='leader'||request.ownerRole!=='leader'||request.status!=='leader_pending')return reject('仅当前责任班长可初审')
    request.status='supervisor_pending';request.ownerRole='supervisor';request.owner='前台客服主管';request.history.push({at:now(),actor,action:`班长初审通过：${comment||'人员互换和当日出勤已核实'}`})
    addNotice(s,'supervisor',`排班事项待确认：${request.title}`,`${request.id} · 班长已完成初审。`,'workforce','high')
   }else if(action==='leader_reject'){
    if(role!=='leader'||request.ownerRole!=='leader'||request.status!=='leader_pending')return reject('仅当前责任班长可驳回')
    finishRejected('班长初审')
   }else if(action==='supervisor_approve'){
    if(role!=='supervisor'||request.ownerRole!=='supervisor'||request.status!=='supervisor_pending')return reject('仅当前责任主管可确认')
    request.status='hrbp_pending';request.ownerRole='hrbp';request.owner='HRBP经理';request.history.push({at:now(),actor,action:`主管确认通过：${comment||'排班覆盖和业务承接满足要求'}`})
    addNotice(s,'hrbp',`排班考勤待备案：${request.title}`,`${request.id} · 主管已确认，请完成HR备案。`,'workforce','normal')
   }else if(action==='supervisor_reject'){
    if(role!=='supervisor'||request.ownerRole!=='supervisor'||request.status!=='supervisor_pending')return reject('仅当前责任主管可驳回')
    finishRejected('主管确认')
   }else if(action==='manager_approve'){
   if(role!=='manager'||request.ownerRole!=='manager'||request.status!=='manager_pending')return reject('仅当前责任客服经理可审批')
    if(request.kind==='cross_team_dispatch'){
     const sourceCoverage=s.workforce.coverage.find(item=>item.team===request.fromTeam)
     if(!sourceCoverage)return json(res,409,{error:'调出班组不存在，不能批准调度',code:'WORKFORCE_COVERAGE_MISSING'})
     const afterRate=(sourceCoverage.onDuty-1)/sourceCoverage.required*100
     if(afterRate<sourceCoverage.targetCoverage)return json(res,409,{error:`调出后${request.fromTeam}覆盖率仅${afterRate.toFixed(1)}%，低于${sourceCoverage.targetCoverage}%保护线，请重新平衡方案`,code:'WORKFORCE_SOURCE_UNDER_TARGET'})
    }
    request.status='closed';request.ownerRole='manager';request.owner='已关闭';request.result=comment||'调度方案已批准并通知相关班组'
    request.history.push({at:now(),actor,action:`经理批准并关闭：${request.result}`})
    if(request.kind==='cross_team_dispatch'){
     const from=s.workforce.coverage.find(item=>item.team===request.fromTeam),to=s.workforce.coverage.find(item=>item.team===request.toTeam)
     if(from)from.onDuty=Math.max(0,from.onDuty-1)
     if(to)to.onDuty=Math.min(to.required,to.onDuty+1)
    }
    addNotice(s,'supervisor',`调度方案已批准：${request.title}`,request.result,'workforce','normal')
   }else if(action==='manager_reject'){
    if(role!=='manager'||request.ownerRole!=='manager'||request.status!=='manager_pending')return reject('仅当前责任客服经理可驳回')
    finishRejected('经理审批')
   }else if(action==='hrbp_file'){
    if(role!=='hrbp'||request.ownerRole!=='hrbp'||request.status!=='hrbp_pending')return reject('仅HRBP可完成排班考勤备案')
    request.status='closed';request.owner='已关闭';request.result=comment||'已同步排班与考勤档案';request.hrbpFiledAt=now()
    request.history.push({at:now(),actor,action:`HRBP完成备案：${request.result}`})
    const shift=s.workforce.shifts.find(item=>item.employeeId===request.employeeId&&item.date===request.date)
    if(shift&&request.kind==='leave')shift.status='leave'
    if(shift&&request.kind==='shift_change')shift.status='adjusted'
    addNotice(s,request.requesterRole,`排班事项已生效：${request.title}`,request.result,'workforce','normal')
   }else return json(res,400,{error:'不支持的排班考勤动作'})
   request.updatedAt=now();audit(s,actor,`${request.id}：${request.history.at(-1)?.action||action}`);save(s)
   return stateJson(res,200,s,current)
  }
  const qualityPlanMatch=url.pathname.match(/^\/api\/quality\/plans\/([^/]+)\/action$/)
  if(req.method==='POST'&&qualityPlanMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['quality'])
   const s=load(),plan=s.quality.plans.find(item=>item.id===qualityPlanMatch[1])
   if(!plan)return json(res,404,{error:'质检抽检计划不存在'})
   const action=safeText(p.action,30)
   if(plan.status==='closed')return action==='close'?stateJson(res,200,s,current):json(res,409,{error:'已关闭的抽检计划不可再更新'})
   if(action==='update'){
    const completed=Math.round(Number(p.completedSamples)),coverage=Math.round(Number(p.actualEmployeeCoverage)*10)/10,timely=Math.round(Number(p.actualTimelyRate)*10)/10
    if(!Number.isFinite(completed)||completed<plan.completedSamples)return json(res,409,{error:'抽检完成量不可回退'})
    if(!Number.isFinite(coverage)||coverage<0||coverage>100||!Number.isFinite(timely)||timely<0||timely>100)return json(res,400,{error:'员工覆盖率和及时率必须在0—100%之间'})
    plan.completedSamples=completed;plan.actualEmployeeCoverage=coverage;plan.actualTimelyRate=timely
    plan.history.unshift({at:now(),actor,action:`更新抽检进展：${completed}/${plan.targetSamples}通，员工覆盖${coverage}%，及时率${timely}%`})
   }else if(action==='close'){
    const gaps=[]
    if(plan.completedSamples<plan.targetSamples)gaps.push(`抽检量差${plan.targetSamples-plan.completedSamples}通`)
    if(plan.actualEmployeeCoverage<plan.targetEmployeeCoverage)gaps.push(`员工覆盖率差${(plan.targetEmployeeCoverage-plan.actualEmployeeCoverage).toFixed(1)}pp`)
    if(plan.actualTimelyRate<plan.targetTimelyRate)gaps.push(`及时率差${(plan.targetTimelyRate-plan.actualTimelyRate).toFixed(1)}pp`)
    if(gaps.length)return json(res,409,{error:`计划未达标，不能关闭：${gaps.join('；')}`})
    plan.status='closed';plan.closedAt=now();plan.closedBy=actor
    plan.history.unshift({at:now(),actor,action:'抽检量、员工覆盖率和及时率全部达标，计划关闭'})
    addNotice(s,'manager',`质检计划已关闭：${plan.name}`,`${plan.completedSamples}通 · 员工覆盖${plan.actualEmployeeCoverage}% · 及时率${plan.actualTimelyRate}%`,'command','normal')
   }else return json(res,400,{error:'质检计划动作不正确'})
   audit(s,actor,`${action==='close'?'关闭':'更新'}质检计划${plan.id}`);save(s)
   return stateJson(res,200,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/quality/records'){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['quality'])
   const s=load(),plan=s.quality.plans.find(item=>item.id===p.planId)
   if(!plan)return json(res,404,{error:'质检抽检计划不存在'})
   if(plan.status!=='active')return json(res,409,{error:'抽检计划已关闭，不能新增抽检记录'})
   const employeeId=safeText(p.employeeId,40),employeeName=safeText(p.employeeName,40),team=safeText(p.team,80),callId=safeText(p.callId,80)
   const score=Number(p.score),result=p.result==='passed'?'passed':'failed',severity=result==='passed'?'none':safeText(p.severity,20)
   if(!employeeId||!employeeName||!team||!callId||!Number.isFinite(score)||score<0||score>100)return json(res,400,{error:'录音、员工、班组和有效得分不能为空'})
   if(result==='failed'&&!['minor','major','critical'].includes(severity))return json(res,400,{error:'不通过记录必须标明问题等级'})
   if(s.quality.records.some(item=>item.callId===callId))return json(res,409,{error:'该录音已经完成抽检'})
   const day=new Date().toISOString().slice(0,10).replaceAll('-',''),sequence=String(s.quality.records.filter(item=>item.id.startsWith(`QR-${day}-`)).length+1).padStart(3,'0')
   const record={id:`QR-${day}-${sequence}`,planId:plan.id,callId,employeeId,employeeName,team,business:safeText(p.business,80)||'10015前台',score:Math.round(score*10)/10,result,severity,problem:result==='passed'?'无':safeText(p.problem,300),standard:safeText(p.standard,160),evidence:safeText(p.evidence,300),inspector:actor,inspectedAt:now(),appealStatus:'none',collaborationTaskId:'',history:[{at:now(),actor,action:result==='passed'?'抽检通过':`识别${severity==='critical'?'重大':severity==='major'?'重点':'一般'}规范问题`}]}
   if(result==='failed'&&(!record.problem||!record.standard||!record.evidence))return json(res,400,{error:'问题记录必须包含问题说明、标准条款和录音证据'})
   s.quality.records.unshift(record);plan.completedSamples+=1
   if(result==='failed'){
    const employee=s.workforce.employees.find(item=>item.jobNo===employeeId||item.name===employeeName)
    addNotice(s,'leader',`质检问题待确认：${employeeName}`,`${record.problem} · ${record.id} · 可发起申诉或进入协同改善。`,'tasks',severity==='critical'?'high':'normal')
    if(severity==='critical')addNotice(s,'manager',`重大质检问题：${employeeName}`,`${team} · ${record.problem}`,'command','high')
    if(employee?.leader)record.leader=employee.leader
   }
   audit(s,actor,`新增抽检记录${record.id}（${result}）`);save(s)
   return stateJson(res,201,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/quality/appeals'){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role,['leader','employee'])
   const s=load(),record=s.quality.records.find(item=>item.id===p.recordId)
   if(!record)return json(res,404,{error:'质检记录不存在'})
   if(record.result==='passed')return json(res,409,{error:'通过记录无需申诉'})
   if(s.quality.appeals.some(item=>item.recordId===record.id&&!['upheld','overturned'].includes(item.status)))return json(res,409,{error:'该质检记录已有未完成申诉'})
   const employee=s.workforce.employees.find(item=>item.jobNo===record.employeeId||item.name===record.employeeName)
   if(current.user.roleId!=='system-admin'&&role==='employee'&&current.user.jobNo!==record.employeeId&&current.user.name!==record.employeeName)return json(res,403,{error:'员工只能对本人质检记录发起申诉'})
   if(current.user.roleId!=='system-admin'&&role==='leader'&&employee?.leader!==current.user.name)return json(res,403,{error:'班长只能对本班员工质检记录发起申诉'})
   const reason=safeText(p.reason,800)
   if(reason.length<10)return json(res,400,{error:'请填写至少10个字的申诉事实与依据'})
   const day=new Date().toISOString().slice(0,10).replaceAll('-',''),sequence=String(s.quality.appeals.filter(item=>item.id.startsWith(`QA-${day}-`)).length+1).padStart(3,'0')
   const appeal={id:`QA-${day}-${sequence}`,recordId:record.id,applicantRole:role,applicant:actor,employeeName:record.employeeName,team:record.team,reason,status:'pending_quality_review',owner:'质检专员',dueAt:new Date(Date.now()+4*60*60*1000).toISOString(),reviewer:'',reviewResult:'',createdAt:now(),updatedAt:now(),history:[{at:now(),actor,action:'提交质量申诉'}]}
   s.quality.appeals.unshift(appeal);record.appealStatus='appealed'
   addNotice(s,'quality',`质量申诉待复核：${record.employeeName}`,`${appeal.id} · ${record.problem}`,'quality','high')
   audit(s,actor,`提交质量申诉${appeal.id}`);save(s)
   return stateJson(res,201,s,current)
  }
  const qualityAppealMatch=url.pathname.match(/^\/api\/quality\/appeals\/([^/]+)\/action$/)
  if(req.method==='POST'&&qualityAppealMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['quality'])
   const s=load(),appeal=s.quality.appeals.find(item=>item.id===qualityAppealMatch[1])
   if(!appeal)return json(res,404,{error:'质量申诉不存在'})
   const record=s.quality.records.find(item=>item.id===appeal.recordId),action=safeText(p.action,30),comment=safeText(p.comment,1000)
   if(action==='start'){
    if(appeal.status!=='pending_quality_review')return json(res,409,{error:'当前申诉不可受理'})
    appeal.status='reviewing';appeal.owner=actor;appeal.reviewer=actor;appeal.history.push({at:now(),actor,action:`受理申诉：${comment||'已调取完整录音和质检标准'}`})
   }else if(['uphold','overturn'].includes(action)){
    if(!['pending_quality_review','reviewing'].includes(appeal.status))return json(res,409,{error:'当前申诉不可裁决'})
    if(comment.length<10)return json(res,400,{error:'申诉裁决必须填写事实、标准和结论'})
    appeal.status=action==='uphold'?'upheld':'overturned';appeal.owner='已关闭';appeal.reviewer=actor;appeal.reviewResult=comment
    appeal.history.push({at:now(),actor,action:`申诉${action==='uphold'?'维持原判':'改判'}：${comment}`})
    if(record){record.appealStatus=appeal.status;if(action==='overturn'){record.result='adjusted';record.history.push({at:now(),actor,action:`申诉改判：${comment}`})}}
    addNotice(s,appeal.applicantRole,`质量申诉已${action==='uphold'?'维持':'改判'}：${appeal.employeeName}`,comment,'quality',action==='uphold'?'normal':'high')
    if(action==='overturn')addNotice(s,'manager',`质检申诉改判：${appeal.employeeName}`,`${appeal.id} · 请关注质检口径一致性。`,'command','normal')
   }else return json(res,400,{error:'申诉动作不正确'})
   appeal.updatedAt=now();audit(s,actor,`${action}质量申诉${appeal.id}`);save(s)
   return stateJson(res,200,s,current)
  }
  const qualityCalibrationMatch=url.pathname.match(/^\/api\/quality\/calibrations\/([^/]+)\/action$/)
  if(req.method==='POST'&&qualityCalibrationMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['quality'])
   const s=load(),calibration=s.quality.calibrations.find(item=>item.id===qualityCalibrationMatch[1])
   if(!calibration)return json(res,404,{error:'质检校准任务不存在'})
   const action=safeText(p.action,30)
   if(action==='start'){
    if(calibration.status!=='planned')return json(res,409,{error:'当前校准任务不可开始'})
    calibration.status='doing';calibration.history.push({at:now(),actor,action:'开始质检口径校准'})
   }else if(action==='complete'){
    if(!['planned','doing'].includes(calibration.status))return json(res,409,{error:'当前校准任务不可提交'})
    const consistency=Math.round(Number(p.actualConsistency)*10)/10,conclusion=safeText(p.conclusion,1000)
    if(!Number.isFinite(consistency)||consistency<0||consistency>100||conclusion.length<10)return json(res,400,{error:'请填写有效的一致率和至少10个字的校准结论'})
    calibration.actualConsistency=consistency;calibration.conclusion=conclusion
    if(consistency>=calibration.targetConsistency){
     calibration.status='closed';calibration.closedAt=now();calibration.history.push({at:now(),actor,action:`校准一致率${consistency}%达标，任务关闭`})
     addNotice(s,'manager',`质检校准已达标：${calibration.title}`,`一致率${consistency}% · ${conclusion}`,'command','normal')
    }else{
     calibration.status='action_required';calibration.history.push({at:now(),actor,action:`一致率${consistency}%低于${calibration.targetConsistency}%，转培训纠偏`})
     const day=new Date().toISOString().slice(0,10).replaceAll('-',''),sequence=String(s.training.programs.filter(item=>item.id.startsWith(`TP-${day}-`)).length+1).padStart(3,'0')
     const source=`质检校准${calibration.id}`
     if(!s.training.programs.some(item=>item.source===source&&item.status!=='closed'))s.training.programs.unshift({id:`TP-${day}-${sequence}`,title:`质检口径纠偏：${calibration.title}`,source,audience:'质检组 + 培训师',audienceCount:10,owner:'培训主管',targetCoverage:100,targetPassRate:95,actualCoverage:0,actualPassRate:0,progress:0,dueAt:new Date(Date.now()+24*60*60*1000).toISOString(),status:'active',effectStatus:'not_submitted',baseline:`校准一致率${consistency}%`,result:'等待培训岗组织规则解读、同题测试和复校。',history:[{at:now(),actor,action:'质检一致率未达标，自动转入培训纠偏'}]})
     addNotice(s,'training',`质检口径纠偏待办：${calibration.title}`,`当前一致率${consistency}%，目标${calibration.targetConsistency}%，已生成岗中专项。`,'training','high')
     addNotice(s,'manager',`质检校准未达标：${calibration.title}`,`一致率${consistency}%，已转培训岗纠偏。`,'command','high')
    }
   }else return json(res,400,{error:'校准动作不正确'})
   audit(s,actor,`${action}质检校准${calibration.id}`);save(s)
   return stateJson(res,200,s,current)
  }
  const qualityCaseMatch=url.pathname.match(/^\/api\/quality\/cases\/([^/]+)\/action$/)
  if(req.method==='POST'&&qualityCaseMatch){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['quality'])
   const s=load(),caseItem=s.quality.cases.find(item=>item.id===qualityCaseMatch[1])
   if(!caseItem)return json(res,404,{error:'质检案例不存在'})
   if(p.action!=='publish')return json(res,400,{error:'案例动作不正确'})
   if(caseItem.status==='published')return stateJson(res,200,s,current)
   if(!caseItem.problem||!caseItem.standard||!caseItem.example)return json(res,409,{error:'问题、标准和示例不完整，不能发布'})
   caseItem.status='published';caseItem.reviewedBy=actor;caseItem.publishedAt=now();caseItem.history.push({at:now(),actor,action:'审核并发布至质检案例库'})
   addNotice(s,'training',`新质检案例已发布：${caseItem.title}`,`${caseItem.category} · 可用于班前会或专项培训。`,'training','normal')
   addNotice(s,'leader',`新质量案例：${caseItem.title}`,caseItem.standard,'quality','normal')
   audit(s,actor,`发布质检案例${caseItem.id}`);save(s)
   return stateJson(res,200,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/quality/collaborations'){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['quality'])
   const s=load(),employee=p.employee
   if(!employee||!employee.id||!employee.name||!employee.team||!employee.leader||!employee.problem)return json(res,400,{error:'重点员工、班组、责任班长和问题类型不能为空'})
   const requirement=String(p.requirement||'').trim()
   if(!requirement)return json(res,400,{error:'请填写需要班长执行的协同要求'})
   const sourceKey=`quality-collaboration:${String(employee.id).trim()}:${String(employee.problem).trim()}`
   const duplicate=s.tasks.find(task=>task.sourceKey===sourceKey&&task.status!=='closed')
   if(duplicate)return json(res,409,{error:`${employee.name}已有未关闭的质检协同单`,taskId:duplicate.id})
   const today=new Date()
   const day=`${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
   const sequence=String(s.tasks.filter(task=>task.sourceLabel==='质检协同单'&&task.id.startsWith(`QC-${day}-`)).length+1).padStart(3,'0')
   const dueAt=p.dueAt&&Number.isFinite(Date.parse(p.dueAt))?new Date(p.dueAt).toISOString():new Date(Date.now()+2*60*60*1000).toISOString()
   const reinspectAt=p.reinspectAt&&Number.isFinite(Date.parse(p.reinspectAt))?new Date(p.reinspectAt).toISOString():new Date(Date.now()+4*60*60*1000).toISOString()
   const successCriteria=String(p.successCriteria||'完成1V1辅导并提交2通新录音；质检复检连续2通无同类问题后关闭。').trim()
   const t={
    id:`QC-${day}-${sequence}`,eventId:`QUALITY-${String(employee.id).trim()}-${Date.now()}`,
    title:`${employee.name} · ${employee.problem}协同改善`,type:'质检协同',ownerRole:'leader',owner:`${employee.leader}（班长）`,supervisor:roles.quality,
    status:'todo',phase:'D',progress:0,dueAt,reinspectAt,evidence:'',verification:'',createdAt:now(),updatedAt:now(),
    sourceKey,sourceLabel:'质检协同单',verificationRole:'quality',employeeId:String(employee.id),person:employee.name,team:employee.team,leader:employee.leader,
    qualityProblem:employee.problem,qualityEvidence:String(employee.evidence||''),requirement,successCriteria,
    history:[{at:now(),actor,action:`发起班长协同：${requirement}`}],
   }
   s.tasks.unshift(t)
   addNotice(s,'leader',`质检协同单：${employee.name}`,`${employee.problem} · 请于${new Date(dueAt).toLocaleString('zh-CN',{hour12:false})}前完成辅导并提交证据。`,'tasks','high')
   audit(s,actor,`创建质检协同单${t.id}（${employee.name}/${employee.id}）`)
   save(s)
   return stateJson(res,201,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/employee/support-requests'){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['employee'])
   const s=load()
   const requester=p.requester||{}
   const supportType=String(p.supportType||'').trim()
   const detail=String(p.detail||'').trim()
   if(!requester.id||!requester.name||!requester.team||!requester.leader||!supportType||!detail)return json(res,400,{error:'员工、班组、责任班长、支持类型和具体说明不能为空'})
   const sourceKey=`employee-support:${String(requester.id).trim()}:${supportType}`
   const duplicate=s.tasks.find(task=>task.sourceKey===sourceKey&&task.status!=='closed')
   if(duplicate)return json(res,409,{error:`${supportType}已有未关闭的支持请求`,taskId:duplicate.id})
   const today=new Date()
   const day=`${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
   const sequence=String(s.tasks.filter(task=>task.sourceLabel==='员工支持请求'&&task.id.startsWith(`SUP-${day}-`)).length+1).padStart(3,'0')
   const dueAt=p.dueAt&&Number.isFinite(Date.parse(p.dueAt))?new Date(p.dueAt).toISOString():new Date(Date.now()+30*60*1000).toISOString()
   const t={
    id:`SUP-${day}-${sequence}`,eventId:`SUPPORT-${String(requester.id).trim()}-${Date.now()}`,
    title:`${requester.name} · ${supportType}`,type:'员工支持',ownerRole:'leader',owner:`${requester.leader}（班长）`,supervisor:'员工本人',
    status:'todo',phase:'D',progress:0,dueAt,evidence:'',verification:'',createdAt:now(),updatedAt:now(),
    sourceKey,sourceLabel:'员工支持请求',verificationRole:'employee',workflowKind:'employee_support',
    employeeId:String(requester.id),person:requester.name,team:requester.team,leader:requester.leader,
    requestType:supportType,requestDetail:detail,requirement:detail,
    successCriteria:String(p.successCriteria||'班长在30分钟内响应，给出明确处理结论、下一步动作和完成时间；员工确认问题已解决后关闭。'),
    history:[{at:now(),actor,action:`向${requester.leader}班长发起${supportType}：${detail}`}],
   }
   s.tasks.unshift(t)
   addNotice(s,'leader',`员工请求支持：${requester.name}`,`${supportType} · ${detail}`,'tasks','high')
   audit(s,actor,`创建员工支持请求${t.id}（${requester.name}/${requester.id}）`)
   save(s)
   return stateJson(res,201,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/tasks'){
   const p=await body(req)
   if(p.source!=='team-morning-brief')return json(res,400,{error:'未知任务来源'})
   const {current,actor}=requireRuntimeRole(req,p.role,['leader','supervisor','manager','director','quality','training','hrbp'])
   const s=load()
   const employee=p.employee
   if(!employee||!employee.name||!employee.jobNo||!employee.team||!employee.reason||!p.reportDate)return json(res,400,{error:'员工、工号、班组、通报原因和报表日期不能为空'})
   const sourceKey=`team-morning-brief:${String(p.reportDate).slice(0,10)}:${String(employee.jobNo).trim()}`
   const duplicate=s.tasks.find(task=>task.sourceKey===sourceKey&&task.status!=='closed')
   if(duplicate)return json(res,409,{error:`${employee.name}已有未关闭的晨会PDCA任务`,taskId:duplicate.id})
   const category=employee.category==='重点员工'?'经验复盘':'辅导改善'
   const t={
    id:`TK-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,eventId:`RPA-${String(p.reportDate).replaceAll('-','')}-${String(employee.jobNo).trim()}`,
    title:`${employee.name} · ${employee.position||category}`,type:`晨会${category}`,ownerRole:'leader',owner:`${employee.team}（班长）`,supervisor:'前台客服主管',
    status:'todo',phase:'D',progress:0,dueAt:new Date(Date.now()+24*60*60*1000).toISOString(),evidence:'',verification:'',createdAt:now(),updatedAt:now(),
    sourceKey,sourceLabel:'RPA班组晨报',person:employee.name,team:employee.team,
    history:[{at:now(),actor,action:`根据${p.reportDate}班组晨报创建任务单：${employee.reason}`}],
   }
   s.tasks.unshift(t)
   addNotice(s,'leader',`晨会任务单：${employee.name}`,`${category} · ${employee.reason}`,'tasks',employee.category==='重点员工'?'normal':'high')
   audit(s,actor,`从班组晨报创建${t.id}（${employee.name}/${employee.jobNo}）`)
   save(s)
   return stateJson(res,201,s,current)
  }
  let m=url.pathname.match(/^\/api\/events\/([^/]+)\/review$/)
  if(req.method==='POST'&&m){
   const p=await body(req),{current,actor}=requireRuntimeRole(req,p.role,['supervisor'])
   const s=load(),e=s.events.find(x=>x.id===m[1]);if(!e)return json(res,404,{error:'事件不存在'});if(e.status!=='pending_supervisor_review')return json(res,409,{error:'当前状态不可审批'});if(!['approve','reject'].includes(p.action))return json(res,400,{error:'未知审批操作'});
   if(p.action==='reject'){e.status='rejected';e.currentRole='supervisor';e.history.push({at:now(),actor,action:`驳回预警：${p.comment||'数据不充分'}`});audit(s,actor,`驳回${e.id}`)}
   else if(p.action==='approve'){e.status='approved';e.currentRole='leader';e.history.push({at:now(),actor,action:`确认预警并生成任务：${p.comment||'同意建议动作'}`});const t={id:`TK-${Date.now()}`,eventId:e.id,title:e.title,type:e.type,ownerRole:'leader',owner:'张伟（班长）',supervisor:'前台客服主管',status:'todo',phase:'D',progress:0,dueAt:e.dueAt,evidence:'',verification:'',createdAt:now(),updatedAt:now(),history:[{at:now(),actor,action:'主管确认，任务已下发班长'}]};s.tasks.unshift(t);addNotice(s,'leader',`主管已确认：${e.title}`,'请在截止时间前执行并提交证据。','tasks','high');audit(s,actor,`确认${e.id}并创建${t.id}`)}save(s);return stateJson(res,200,s,current)
  }
  m=url.pathname.match(/^\/api\/tasks\/([^/]+)\/action$/)
  if(req.method==='POST'&&m){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role)
   const s=load(),t=s.tasks.find(x=>x.id===m[1]);if(!t)return json(res,404,{error:'任务不存在'});
   if(p.action==='meeting_start'){
    if(t.workflowKind!=='meeting_action'||role!==t.ownerRole||!['todo','returned_to_origin'].includes(t.status))return json(res,409,{error:'当前经营例会行动不可开始'})
    t.originRole=role;t.status='doing';t.phase='D';t.progress=25;t.history.push({at:now(),actor,action:'接收经营例会行动并开始执行'})
   }
   else if(p.action==='meeting_submit'){
    if(t.workflowKind!=='meeting_action'||role!==t.originRole||t.ownerRole!==role||!['doing','returned_to_origin'].includes(t.status))return json(res,409,{error:'当前岗位不能提交该经营例会行动'})
    const evidence=safeText(p.evidence,2000)
    if(evidence.length<10)return json(res,400,{error:'请填写至少10字的执行结果与证据'})
    t.status='pending_verification';t.ownerRole='director';t.phase='C';t.progress=80;t.evidence=evidence;t.history.push({at:now(),actor,action:`提交运营总监验收：${evidence}`});addNotice(s,'director',`经营例会行动待验收：${t.title}`,`${roles[role]}已提交执行结果，请对照目标验收。`,'tasks','high')
   }
   else if(p.action==='meeting_verify_success'){
    if(t.workflowKind!=='meeting_action'||role!=='director'||t.ownerRole!=='director'||t.status!=='pending_verification')return json(res,409,{error:'仅总监可验收该经营例会行动'})
    const comment=safeText(p.comment,1200)||'执行结果符合会议目标'
    t.status='closed';t.phase='A';t.progress=100;t.verification=comment;t.history.push({at:now(),actor,action:`总监验收通过并关闭：${comment}`});addNotice(s,t.originRole,`经营例会行动已验收：${t.title}`,comment,'tasks','normal')
   }
   else if(p.action==='meeting_verify_fail'){
    if(t.workflowKind!=='meeting_action'||role!=='director'||t.ownerRole!=='director'||t.status!=='pending_verification')return json(res,409,{error:'仅总监可退回该经营例会行动'})
    const comment=safeText(p.comment,1200)||'执行结果未完全达到会议目标，请补充'
    t.status='returned_to_origin';t.ownerRole=t.originRole;t.phase='D';t.progress=45;t.supervisorGuidance=comment;t.history.push({at:now(),actor,action:`总监验收未通过，退回${roles[t.originRole]}：${comment}`});addNotice(s,t.originRole,`经营例会行动退回：${t.title}`,comment,'tasks','high')
   }
   else if(p.action==='ai_start'){
    if(t.workflowKind!=='ai_action'||role!==t.originRole||t.ownerRole!==t.originRole||!['todo','returned_to_origin'].includes(t.status))return json(res,409,{error:'当前AI行动不可开始执行'})
    t.status='doing';t.phase='D';t.progress=25;t.history.push({at:now(),actor,action:'接收AI行动并开始执行'})
   }
   else if(p.action==='ai_submit'){
    if(t.workflowKind!=='ai_action'||role!==t.originRole||t.ownerRole!==t.originRole||!['doing','returned_to_origin'].includes(t.status))return json(res,409,{error:'当前AI行动不可提交验收'})
    const evidence=safeText(p.evidence,2000)
    if(!evidence)return json(res,400,{error:'请填写执行结果和达成证据'})
    t.status='pending_verification';t.ownerRole=t.verificationRole;t.phase='C';t.progress=80;t.evidence=evidence
    t.history.push({at:now(),actor,action:`提交${roles[t.verificationRole]}验收：${evidence}`})
    addNotice(s,t.verificationRole,`AI行动待验收：${t.title}`,`${roles[t.originRole]}已提交执行证据，请对照目标和达成标准验收。`,'tasks','high')
   }
   else if(p.action==='ai_verify_success'){
    if(t.workflowKind!=='ai_action'||role!==t.verificationRole||t.ownerRole!==t.verificationRole||t.status!=='pending_verification')return json(res,409,{error:'当前岗位不能验收此AI行动'})
    const comment=safeText(p.comment,1200)||'执行证据符合目标与达成标准'
    t.status='closed';t.phase='A';t.progress=100;t.verification=comment;t.history.push({at:now(),actor,action:`验收通过并关闭：${comment}`})
    addNotice(s,t.originRole,`AI行动已验收：${t.title}`,comment,'tasks','normal')
   }
   else if(p.action==='ai_verify_fail'){
    if(t.workflowKind!=='ai_action'||role!==t.verificationRole||t.ownerRole!==t.verificationRole||t.status!=='pending_verification')return json(res,409,{error:'当前岗位不能退回此AI行动'})
    const comment=safeText(p.comment,1200)||'当前证据未达到目标，请补充动作后重新提交'
    t.status='returned_to_origin';t.ownerRole=t.originRole;t.phase='D';t.progress=45;t.supervisorGuidance=comment;t.history.push({at:now(),actor,action:`验收未通过，退回${roles[t.originRole]}：${comment}`})
    addNotice(s,t.originRole,`AI行动退回：${t.title}`,comment,'tasks','high')
   }
   else if(p.action==='start'){if(p.role!=='leader'||t.ownerRole!=='leader'||!['todo','returned_to_leader'].includes(t.status))return json(res,409,{error:'当前任务不可开始执行'});t.status='doing';t.progress=25;t.history.push({at:now(),actor,action:'开始执行任务'})}
   else if(p.action==='submit'){if(p.role!=='leader'||t.ownerRole!=='leader'||!['doing','returned_to_leader'].includes(t.status))return json(res,409,{error:'当前任务不可提交'});const verifier=t.verificationRole==='quality'?'quality':t.verificationRole==='employee'?'employee':'supervisor';const verifierLabel=verifier==='quality'?'质检复检':verifier==='employee'?'员工确认':'主管验证';t.status='pending_verification';t.ownerRole=verifier;t.phase='C';t.progress=80;t.evidence=p.evidence||'已完成处置并提交现场记录';t.history.push({at:now(),actor,action:`提交${verifierLabel}：${t.evidence}`});addNotice(s,verifier,`待${verifierLabel}：${t.title}`,`${t.owner}已提交处理结果。`,'tasks','high')}
   else if(p.action==='employee_confirm_support'){if(p.role!=='employee'||t.verificationRole!=='employee'||t.ownerRole!=='employee'||t.status!=='pending_verification')return json(res,409,{error:'当前支持请求不可确认关闭'});t.status='closed';t.phase='A';t.progress=100;t.verification=p.comment||'班长支持已解决当前问题';t.history.push({at:now(),actor,action:`员工确认问题已解决：${t.verification}`});addNotice(s,'leader',`员工已确认解决：${t.title}`,t.verification,'tasks','normal')}
   else if(p.action==='employee_reopen_support'){if(p.role!=='employee'||t.verificationRole!=='employee'||t.ownerRole!=='employee'||t.status!=='pending_verification')return json(res,409,{error:'当前支持请求不可退回'});t.status='returned_to_leader';t.ownerRole='leader';t.phase='D';t.progress=40;t.supervisorGuidance=p.comment||'当前问题尚未解决，请班长补充支持';t.history.push({at:now(),actor,action:`员工反馈未解决，退回班长：${t.supervisorGuidance}`});addNotice(s,'leader',`员工支持请求退回：${t.title}`,t.supervisorGuidance,'tasks','high')}
   else if(p.action==='quality_verify_success'){if(p.role!=='quality'||t.verificationRole!=='quality'||t.ownerRole!=='quality'||t.status!=='pending_verification')return json(res,409,{error:'当前协同单不可由质检关闭'});t.status='closed';t.phase='A';t.progress=100;t.verification=p.comment||'连续2通复检未发现同类问题，改善有效';t.history.push({at:now(),actor,action:`质检复检通过并关闭：${t.verification}`});addNotice(s,'leader',`质检协同已闭环：${t.title}`,t.verification,'tasks','normal')}
   else if(p.action==='quality_verify_fail'){if(p.role!=='quality'||t.verificationRole!=='quality'||t.ownerRole!=='quality'||t.status!=='pending_verification')return json(res,409,{error:'当前协同单不可退回'});t.status='returned_to_leader';t.ownerRole='leader';t.phase='D';t.progress=40;t.supervisorGuidance=p.comment||'复检仍发现同类问题，请补充辅导并重新提交证据';t.history.push({at:now(),actor,action:`质检复检未通过，退回班长：${t.supervisorGuidance}`});addNotice(s,'leader',`质检复检退回：${t.title}`,t.supervisorGuidance,'tasks','high')}
   else if(p.action==='verify_success'){if(p.role!=='supervisor'||t.ownerRole!=='supervisor'||t.status!=='pending_verification')return json(res,409,{error:'当前任务不可验证'});t.status='closed';t.phase='A';t.progress=100;t.verification=p.comment||'指标已恢复，改善有效';t.history.push({at:now(),actor,action:`验证通过：${t.verification}`});const e=s.events.find(x=>x.id===t.eventId);if(e){e.status='closed';e.currentRole='supervisor';e.history.push({at:now(),actor,action:'改善有效，事件关闭'})}addNotice(s,'leader',`任务已关闭：${t.title}`,'主管验证改善有效。','tasks','normal')}
   else if(p.action==='verify_fail'){if(p.role!=='supervisor'||t.ownerRole!=='supervisor'||t.status!=='pending_verification')return json(res,409,{error:'当前任务不可验证'});t.status='escalated';t.ownerRole='manager';t.phase='A';t.progress=80;t.verification=p.comment||'指标未改善';t.history.push({at:now(),actor,action:`验证未通过，升级客服经理：${t.verification}`});addNotice(s,'manager',`升级事件：${t.title}`,'主管验证未改善，请客服经理介入，可闭环或指导退回主管。','tasks','high')}
   else if(p.action==='manager_escalate'){
    if(p.role!=='manager'||t.ownerRole!=='manager')return json(res,403,{error:'仅当前责任客服经理可升级'});t.status='escalated';t.ownerRole='director';t.phase='A';t.progress=85;t.history.push({at:now(),actor,action:`经理升级运营总监：${p.comment||'需要总监决策支持'}`});addNotice(s,'director',`经理升级：${t.title}`,p.comment||'请运营总监介入裁决。','tasks','high')
   }
   else if(p.action==='manager_close'){
    if(p.role!=='manager'||t.ownerRole!=='manager')return json(res,403,{error:'仅当前责任客服经理可闭环'});t.status='closed';t.phase='A';t.progress=100;t.verification=p.comment||'经理研判后确认管理措施有效，予以闭环';t.history.push({at:now(),actor,action:`经理裁决闭环：${t.verification}`});const e=s.events.find(x=>x.id===t.eventId);if(e){e.status='closed';e.currentRole='manager';e.history.push({at:now(),actor,action:'客服经理裁决闭环'})}addNotice(s,'supervisor',`经理已闭环：${t.title}`,t.verification,'tasks','normal');addNotice(s,'leader',`经理已闭环：${t.title}`,t.verification,'tasks','normal')
   }
   else if(p.action==='manager_return'){
    if(p.role!=='manager'||t.ownerRole!=='manager')return json(res,403,{error:'仅当前责任客服经理可指导退回'});t.status='returned_to_supervisor';t.ownerRole='supervisor';t.phase='A';t.progress=75;t.managerGuidance=p.comment||'请主管补充根因分析并重新组织改进动作';t.history.push({at:now(),actor,action:`经理指导退回主管：${t.managerGuidance}`});addNotice(s,'supervisor',`经理退回指导：${t.title}`,t.managerGuidance,'tasks','high')
   }
   else if(p.action==='supervisor_return_leader'){
    if(p.role!=='supervisor'||t.ownerRole!=='supervisor'||t.status!=='returned_to_supervisor')return json(res,403,{error:'仅当前责任主管可退回班长整改'});t.status='returned_to_leader';t.ownerRole='leader';t.phase='D';t.progress=40;t.supervisorGuidance=p.comment||t.managerGuidance||'按经理意见补充整改';t.history.push({at:now(),actor,action:`主管按经理指导退回班长整改：${t.supervisorGuidance}`});addNotice(s,'leader',`任务退回整改：${t.title}`,t.supervisorGuidance,'tasks','high')
   }
   else if(p.action==='supervisor_resubmit_manager'){
    if(p.role!=='supervisor'||t.ownerRole!=='supervisor'||t.status!=='returned_to_supervisor')return json(res,403,{error:'仅当前责任主管可重新上报'});t.status='escalated';t.ownerRole='manager';t.phase='A';t.progress=85;t.verification=p.comment||'已按指导补充根因和措施，请经理复核';t.history.push({at:now(),actor,action:`主管补充说明后重新上报经理：${t.verification}`});addNotice(s,'manager',`主管重新上报：${t.title}`,t.verification,'tasks','high')
   }
   else if(p.action==='director_escalate'){
    if(p.role!=='director'||t.ownerRole!=='director')return json(res,403,{error:'仅当前责任运营总监可升级'});t.status='executive_escalated';t.ownerRole='director';t.phase='A';t.progress=90;t.history.push({at:now(),actor,action:`总监升级公司级专项督办：${p.comment||'需跨部门协调或公司级决策'}`});addNotice(s,'director',`公司级专项督办：${t.title}`,'任务已升级为公司级专项，待最终决策。','tasks','high')
   }
   else if(p.action==='director_close'){
    if(p.role!=='director'||t.ownerRole!=='director'||!['escalated','executive_escalated'].includes(t.status))return json(res,403,{error:'仅当前责任运营总监可裁决闭环'});t.status='closed';t.phase='A';t.progress=100;t.verification=p.comment||'总监裁决闭环';t.history.push({at:now(),actor,action:`总监裁决闭环：${t.verification}`});const e=s.events.find(x=>x.id===t.eventId);if(e){e.status='closed';e.currentRole='director';e.history.push({at:now(),actor,action:'运营总监裁决闭环'})}addNotice(s,'manager',`总监已裁决：${t.title}`,t.verification,'tasks','normal')
   }
   else if(p.action==='director_return'){
    if(p.role!=='director'||t.ownerRole!=='director'||!['escalated','executive_escalated'].includes(t.status))return json(res,403,{error:'仅当前责任运营总监可退回'});t.status='escalated';t.ownerRole='manager';t.phase='A';t.progress=80;t.managerGuidance=p.comment||'请经理重新组织专项改善';t.history.push({at:now(),actor,action:`总监退回客服经理：${t.managerGuidance}`});addNotice(s,'manager',`总监退回指导：${t.title}`,t.managerGuidance,'tasks','high')
   }
   else if(p.action==='escalate'){
    const chain=['leader','supervisor','manager','director'];let i=chain.indexOf(t.ownerRole);if(i<chain.length-1)t.ownerRole=chain[i+1];t.status='escalated';t.history.push({at:now(),actor,action:`逾期升级至${roles[t.ownerRole]}`});addNotice(s,t.ownerRole,`逾期升级：${t.title}`,`任务已升级至${roles[t.ownerRole]}。`,'tasks','high')
   } else return json(res,400,{error:'未知操作'});t.updatedAt=now();audit(s,actor,`${p.action} ${t.id}`);save(s);return stateJson(res,200,s,current)
  }
  if(req.method==='POST'&&url.pathname==='/api/simulate-timeout'){
   const p=await body(req),{current,role,actor}=requireRuntimeRole(req,p.role)
   const s=load(),t=s.tasks.find(x=>x.status!=='closed'&&x.ownerRole===role);if(!t)return json(res,409,{error:'当前岗位暂无可升级任务'});const chain=['leader','supervisor','manager','director'];let i=chain.indexOf(t.ownerRole);if(i>=chain.length-1)return json(res,409,{error:'当前已是最高责任层级'});t.ownerRole=chain[i+1];t.status='escalated';t.history.push({at:now(),actor,action:`触发SLA逾期升级至${roles[t.ownerRole]}`});addNotice(s,t.ownerRole,`SLA逾期：${t.title}`,`任务已自动升级至${roles[t.ownerRole]}。`,'tasks','high');audit(s,actor,`触发SLA升级${t.id}`);save(s);return stateJson(res,200,s,current)
  }
  if(!url.pathname.startsWith('/api/')){
   const rel=url.pathname==='/'?'index.html':url.pathname.replace(/^\//,'')
   const requested=path.resolve(distDir,rel)
   const relative=path.relative(distDir,requested)
   const contained=!relative.startsWith('..')&&!path.isAbsolute(relative)
   const target=contained&&fs.existsSync(requested)&&fs.statSync(requested).isFile()?requested:path.join(distDir,'index.html')
   if(fs.existsSync(target)){
    const ext=path.extname(target);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'}
    res.writeHead(200,{'content-type':types[ext]||'application/octet-stream'});return fs.createReadStream(target).pipe(res)
   }
  }
  return json(res,404,{error:'接口不存在'})
 }catch(e){if(!e.status||e.status>=500)console.error(e);return json(res,e.status||500,{error:e.status?e.message:'服务处理失败',...(e.code?{code:e.code}:{})})}
})
server.listen(PORT,'0.0.0.0',()=>console.log(`河北基地平台: http://localhost:${PORT}`))

let refreshTimer
const runScheduledRefresh=()=>{
 const s=load();s.meta.batchNo+=1;s.meta.lastRefresh=now();s.meta.nextRefresh=new Date(Date.now()+30*60*1000).toISOString();
 addNotice(s,'data',`半小时批次 #${s.meta.batchNo} 自动刷新完成`,'四类预警规则已完成定时扫描。','reports','normal');audit(s,'定时调度器',`自动执行半小时刷新批次 #${s.meta.batchNo}`);save(s);scheduleRefresh()
}
const scheduleRefresh=()=>{
 if(refreshTimer)clearTimeout(refreshTimer)
 refreshTimer=setTimeout(runScheduledRefresh,30*60*1000)
 refreshTimer.unref()
}
scheduleRefresh()
