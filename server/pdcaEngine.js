const roleName={employee:'客服专员',leader:'客服班长',supervisor:'客服主管',manager:'客服经理',director:'运营总监',quality:'质检专员',training:'培训主管',hrbp:'HRBP经理'}
const chain=['employee','leader','supervisor','manager','director']

export const workflowActions={
 lean_directive:new Set(['task_comment','lean_follow_up','lean_intervene','lean_reassign','lean_change_deadline','lean_archive','lean_reopen','lean_start','lean_submit','lean_verify_success','lean_verify_return','lean_exception_request','lean_exception_approve']),
 meeting_action:new Set(['task_comment','meeting_start','meeting_submit','meeting_verify_success','meeting_verify_fail']),
 ai_action:new Set(['task_comment','ai_start','ai_submit','ai_verify_success','ai_verify_fail']),
 employee_support:new Set(['task_comment','start','submit','employee_reopen_support','employee_confirm_support']),
 quality_collaboration:new Set(['task_comment','start','submit','quality_verify_success','quality_verify_fail']),
 legacy_alert:new Set(['task_comment','start','submit','verify_success','verify_fail','manager_escalate','manager_close','manager_return','supervisor_return_leader','supervisor_resubmit_manager','director_escalate','director_close','director_return','escalate']),
}

export const inferWorkflowKind=task=>task.workflowKind
 ||(task.sourceLabel==='质检协同单'?'quality_collaboration'
  :task.sourceLabel==='员工支持请求'?'employee_support'
  :task.sourceLabel==='经营例会'?'meeting_action'
  :task.sourceLabel==='AI行动草案'?'ai_action'
  :'legacy_alert')

export const actionAllowed=(task,action)=>action==='task_void'||Boolean(workflowActions[inferWorkflowKind(task)]?.has(action))

export const verificationGate=task=>{
 const metric=task.metric||{}
 const snapshots=(task.metricSnapshots||[]).filter(item=>item.actual!==null&&item.actual!==undefined&&['submission','system','verification'].includes(item.type))
 const latest=snapshots.at(-1)
 const target=Number(metric.target)
 const actual=Number(latest?.actual)
 const hasActual=Number.isFinite(actual)&&Number.isFinite(target)
 const metricSet=(Array.isArray(task.metricSet)&&task.metricSet.length?task.metricSet:[metric]).filter(item=>item.required!==false)
 const metricResults=metricSet.map(item=>{
  const itemSnapshots=snapshots.filter(snapshot=>snapshot.metricCode===item.code),itemLatest=itemSnapshots.at(-1)
  const itemActual=Number(itemLatest?.actual),itemTarget=Number(item.target)
  const itemHasActual=Number.isFinite(itemActual)&&Number.isFinite(itemTarget)
  return {code:item.code,label:item.label,actual:itemHasActual?itemActual:null,target:Number.isFinite(itemTarget)?itemTarget:null,unit:item.unit,direction:item.direction,hasActual:itemHasActual,targetMet:itemHasActual&&(item.direction==='lower'?itemActual<=itemTarget:itemActual>=itemTarget)}
 })
 const targetMet=metricResults.length?metricResults.every(item=>item.targetMet):hasActual&&(metric.direction==='lower'?actual<=target:actual>=target)
 const requiredAttachments=Number(task.evidencePolicy?.requiredAttachments||0)
 const attachmentCount=(task.attachments||[]).length
 const evidenceComplete=String(task.evidence||'').trim().length>=10&&attachmentCount>=requiredAttachments
 const result={hasActual:metricResults.length?metricResults.every(item=>item.hasActual):hasActual,targetMet,evidenceComplete,actual:hasActual?actual:null,target:Number.isFinite(target)?target:null,requiredAttachments,attachmentCount}
 if(Array.isArray(task.metricSet)&&task.metricSet.length>1)result.metricResults=metricResults
 return result
}

export const experienceCandidateFromTask=(task,actor)=>{
 const gate=verificationGate(task),metric=task.metric||{}
 if(!gate.targetMet||!gate.evidenceComplete||task.exceptionClosure)return null
 const steps=Array.from(new Set([task.standardizedAction,task.actionPlan,task.evidence].flatMap(value=>String(value||'').split(/[；;。\n]/)).map(value=>value.trim()).filter(Boolean))).slice(0,6)
 return {
  id:`EXP-CAND-${task.id}`,status:'candidate',title:`${task.title} · 标准经验候选`,category:task.issueCategory||task.type||'运营改善',
  sourceTaskId:task.id,sourceTaskTitle:task.title,ownerJobNo:task.employeeId||'',ownerName:task.executionOwner||task.owner||'',team:task.team||'',
  metric:metric.label||'任务目标达成率',unit:metric.unit||'%',direction:metric.direction||'higher',baseline:Number(metric.baseline||0),target:Number(metric.target||0),actual:Number(gate.actual||0),
  actionSummary:task.standardizedAction||task.actionPlan||task.evidence,steps,
  evidence:[task.evidence,...(task.attachments||[]).map(item=>item.fileName)].filter(Boolean),verifiedBy:actor,verifiedAt:new Date().toISOString(),
  aiPublished:false,publishedAt:'',keywords:Array.from(new Set([task.issueCategory,metric.label,task.type,task.team].filter(Boolean))).slice(0,8),invocationCount:0,
 }
}

const addSlaNotice=(state,task,key,role,title,description,at)=>{
 task.slaEvents=Array.isArray(task.slaEvents)?task.slaEvents:[]
 if(task.slaEvents.some(item=>item.key===key))return false
 task.slaEvents.push({key,at})
 state.notifications.unshift({id:`NT-SLA-${task.id}-${key}`,role,title,desc:description,target:'tasks',priority:key==='overdue'?'high':'normal',createdAt:at,read:false})
 task.history.push({at,actor:'SLA调度器',action:description})
 return true
}

export const applyTaskSlaSweep=(state,currentTime=Date.now())=>{
 let changed=0
 const at=new Date(currentTime).toISOString()
 for(const task of state.tasks||[]){
  if(task.status==='closed'||task.archivedAt||task.voidedAt||task.slaPolicy?.enabled===false)continue
  const deadlineText=task.status==='pending_verification'?task.verificationDueAt:(task.submitDueAt||task.dueAt)
  const deadline=Date.parse(String(deadlineText||''))
  if(!Number.isFinite(deadline))continue
  const diff=deadline-currentTime,node=task.status==='pending_verification'?'verification':'execution'
  if(diff<=4*60*60*1000&&diff>60*60*1000)changed+=Number(addSlaNotice(state,task,`${node}:t4:${deadline}`,task.ownerRole,`任务4小时内到期：${task.title}`,`${roleName[task.ownerRole]||task.ownerRole}需在${new Date(deadline).toLocaleString('zh-CN',{hour12:false})}前完成当前节点。`,at))
  if(diff<=60*60*1000&&diff>0)changed+=Number(addSlaNotice(state,task,`${node}:t1:${deadline}`,task.ownerRole,`任务1小时内到期：${task.title}`,`当前节点临近截止，请立即处理；截止${new Date(deadline).toLocaleString('zh-CN',{hour12:false})}。`,at))
  if(diff<=0)changed+=Number(addSlaNotice(state,task,`${node}:due:${deadline}`,task.ownerRole,`任务已逾期：${task.title}`,`${node==='verification'?'验收':'执行'}节点已超过截止时间。`,at))
  if(diff<=-5*60*1000&&!task.slaEscalatedAt){
   const currentIndex=chain.indexOf(task.ownerRole),nextRole=currentIndex>=0&&currentIndex<chain.length-1?chain[currentIndex+1]:(task.ownerRole==='quality'||task.ownerRole==='training'||task.ownerRole==='hrbp'?'manager':'director')
   task.slaEscalatedAt=at;task.slaEscalationRole=nextRole;task.escalationStatus='escalated';task.updatedAt=at
   changed+=Number(addSlaNotice(state,task,`${node}:overdue:${deadline}`,nextRole,`SLA自动升级：${task.title}`,`${node==='verification'?'验收':'执行'}逾期超过5分钟，已自动升级至${roleName[nextRole]}。`,at))
  }
 }
 return changed
}

export const pdcaBusinessMetrics=tasks=>{
 const list=(tasks||[]).filter(task=>!task.voidedAt),closed=list.filter(task=>task.status==='closed'),exceptions=closed.filter(task=>task.exceptionClosure),reopened=list.filter(task=>Number(task.reopenCount)>0)
 const gated=closed.map(task=>verificationGate(task)),targetMet=gated.filter(item=>item.targetMet).length
 const candidates=closed.filter(task=>task.experienceCandidateId).length
 const onTime=list.filter(task=>task.submittedAt&&Date.parse(task.submittedAt)<=Date.parse(task.submitDueAt||task.dueAt)).length
 return {total:list.length,closed:closed.length,targetMet,exceptionClosed:exceptions.length,reopened:reopened.length,experienceCandidates:candidates,onTime,
  closeRate:list.length?Math.round(closed.length/list.length*1000)/10:0,targetAttainmentRate:closed.length?Math.round(targetMet/closed.length*1000)/10:0,
  exceptionRate:closed.length?Math.round(exceptions.length/closed.length*1000)/10:0,reopenRate:closed.length?Math.round(reopened.length/closed.length*1000)/10:0,
  experienceConversionRate:closed.length?Math.round(candidates/closed.length*1000)/10:0,onTimeRate:list.length?Math.round(onTime/list.length*1000)/10:0}
}
