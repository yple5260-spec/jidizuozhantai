const finite=value=>{
 const parsed=Number(value)
 return Number.isFinite(parsed)?parsed:null
}
const iso=(value,fallback)=>{
 const parsed=Date.parse(String(value||''))
 return Number.isFinite(parsed)?new Date(parsed).toISOString():fallback
}

export const metricCatalog={
 satisfaction:{code:'satisfaction',label:'人工服务满意率',unit:'%',direction:'higher',baseline:93.2,target:97.2,action:'复盘近3通低满意录音，统一确认、解释、解决与结束语四个服务动作'},
 fcr:{code:'fcr',label:'一次解决率',unit:'%',direction:'higher',baseline:88,target:92,action:'按问题类型复盘业务口径与工单路径，减少转派和重复来电'},
 repeat_call:{code:'repeat_call',label:'2小时重复来电率',unit:'%',direction:'lower',baseline:4.7,target:4,action:'定位重复来电原因，校准首通解决步骤并复检后续来电'},
 cph:{code:'cph',label:'CPH',unit:'',direction:'higher',baseline:12.8,target:15,action:'拆解通话、后处理和非生产时长，跟岗纠正关键耗时动作'},
 responses:{code:'responses',label:'人工应答量',unit:'通',direction:'higher',baseline:73,target:85,action:'结合排班时段设置小时产能目标，减少非必要离席与后处理等待'},
 busy_rest:{code:'busy_rest',label:'置忙小休占比',unit:'%',direction:'lower',baseline:15.3,target:12,action:'复盘高峰时段状态使用，明确小休窗口与异常离席报备规则'},
 quality:{code:'quality',label:'质检得分',unit:'分',direction:'higher',baseline:88,target:95,action:'针对规范扣分项完成录音复盘、话术演练和连续2通复检'},
 marketing:{code:'marketing',label:'营销转化量',unit:'笔',direction:'higher',baseline:2,target:4,action:'复盘营销开口、需求识别和异议处理，安排优秀录音跟学'},
 general:{code:'general',label:'任务目标达成率',unit:'%',direction:'higher',baseline:0,target:100,action:'将问题拆解为可执行动作、责任人、提交证据和验收标准'},
}

export const inferMetric=input=>{
 const text=String(input||'').toLowerCase()
 if(/满意/.test(text))return metricCatalog.satisfaction
 if(/一次解决|首解|fcr/.test(text))return metricCatalog.fcr
 if(/重复来电|重复呼入/.test(text))return metricCatalog.repeat_call
 if(/cph|小时产能/.test(text))return metricCatalog.cph
 if(/应答量|产能|接听量/.test(text))return metricCatalog.responses
 if(/小休|置忙|非工/.test(text))return metricCatalog.busy_rest
 if(/质检|规范|差错|合规/.test(text))return metricCatalog.quality
 if(/营销|转化|宽带|流量包/.test(text))return metricCatalog.marketing
 return metricCatalog.general
}

export const systemTargetSuggestion=input=>{
 const metric=metricCatalog[input.metricCode]||inferMetric(`${input.issueCategory||''} ${input.problem||''}`)
 const baseline=finite(input.baselineValue)??metric.baseline
 const target=finite(input.targetValue)??metric.target
 const direction=input.metricDirection==='lower'?'lower':input.metricDirection==='higher'?'higher':metric.direction
 const targetText=`${metric.label}${direction==='lower'?'降至不高于':'提升至不低于'}${target}${metric.unit}`
 return {
  problem:String(input.problem||`${metric.label}未达到岗位目标，需要定位个人行为与管理过程差距。`).slice(0,800),
  metricCode:metric.code,metricLabel:metric.label,metricUnit:metric.unit,metricDirection:direction,
  baselineValue:baseline,targetValue:target,target:targetText,
  successCriteria:`在验证时点取得系统指标数据；${metric.label}${direction==='lower'?'≤':'≥'}${target}${metric.unit}，并提交执行记录及至少1项佐证材料。`,
  actionSuggestion:metric.action,
  rationale:`建议基于呼叫中心“结果指标+过程动作”双验证：当前基线${baseline}${metric.unit}，目标${target}${metric.unit}，用系统趋势判断改善、用执行证据判断动作真实性。`,
 }
}

const defaultNodes=task=>{
 const createdAt=task.createdAt||new Date().toISOString()
 const executionDone=['doing','pending_verification','closed','escalated'].includes(task.status)
 const submitted=['pending_verification','closed','escalated'].includes(task.status)
 const verified=task.status==='closed'
 return [
  {id:`${task.id}:plan`,code:'plan',name:'问题定位与目标设定',target:task.target||task.successCriteria||'',ownerRole:task.initiatorRole||task.originRole||'supervisor',owner:task.initiatorName||task.supervisor||'',plannedAt:createdAt,completedAt:createdAt,status:'completed',sequence:1,result:task.problem||task.requirement||task.title},
  {id:`${task.id}:execute`,code:'execute',name:'接收并执行改善动作',target:task.actionPlan||task.requirement||'',ownerRole:task.executionOwnerRole||task.ownerRole,owner:task.executionOwner||task.owner,plannedAt:task.plannedStartAt,completedAt:executionDone?(task.startedAt||task.updatedAt):'',status:executionDone?'completed':task.status==='todo'?'pending':'active',sequence:2,result:task.executionResult||''},
  {id:`${task.id}:submit`,code:'submit',name:'提交结果与附件',target:task.successCriteria||'',ownerRole:task.executionOwnerRole||task.originRole||task.ownerRole,owner:task.executionOwner||task.owner,plannedAt:task.submitDueAt||task.dueAt,completedAt:submitted?(task.submittedAt||task.updatedAt):'',status:submitted?'completed':task.status==='doing'?'active':'pending',sequence:3,result:task.evidence||''},
  {id:`${task.id}:verify`,code:'verify',name:'系统数据辅助验证',target:task.target||task.successCriteria||'',ownerRole:task.verificationRole||'supervisor',owner:task.verificationOwner||task.supervisor||'',plannedAt:task.verificationDueAt||task.reinspectAt||task.dueAt,completedAt:verified?(task.verifiedAt||task.updatedAt):'',status:verified?'completed':task.status==='pending_verification'?'active':'pending',sequence:4,result:task.verification||''},
  {id:`${task.id}:act`,code:'act',name:'关闭或固化标准',target:'形成可复用动作并关闭任务',ownerRole:task.verificationRole||'supervisor',owner:task.verificationOwner||task.supervisor||'',plannedAt:task.verificationDueAt||task.dueAt,completedAt:verified?(task.verifiedAt||task.updatedAt):'',status:verified?'completed':'pending',sequence:5,result:verified?(task.standardizedAction||task.verification||'任务闭环'):''},
 ]
}

export const normalizeLeanTask=source=>{
 const task={...source}
 const createdAt=iso(task.createdAt,new Date().toISOString())
 const dueAt=iso(task.dueAt,new Date(Date.parse(createdAt)+24*60*60*1000).toISOString())
 const metricSuggestion=systemTargetSuggestion({
  problem:task.problem||task.requirement||task.qualityProblem||task.title,
  metricCode:task.metric?.code||task.metricCode,
  baselineValue:task.metric?.baseline??task.baselineValue,
  targetValue:task.metric?.target??task.targetValue,
  metricDirection:task.metric?.direction||task.metricDirection,
 })
 task.initiatorRole=task.initiatorRole||task.originRole||'supervisor'
 task.initiatorName=task.initiatorName||task.createdBy||task.supervisor||'系统触发'
 task.executionOwnerRole=task.executionOwnerRole||task.originRole||((task.ownerRole==='leader'||task.workflowKind==='lean_directive')?task.ownerRole:'leader')
 task.executionOwner=task.executionOwner||task.owner
 task.problem=task.problem||task.requirement||task.qualityProblem||task.title
 task.issueCategory=task.issueCategory||task.type||'运营改善'
 task.issueLocation=task.issueLocation||[task.team,task.person||task.employeeName||task.employeeId].filter(Boolean).join(' · ')||'待补充具体班组/员工/业务场景'
 task.target=task.target||task.successCriteria||metricSuggestion.target
 task.successCriteria=task.successCriteria||metricSuggestion.successCriteria
 task.actionPlan=task.actionPlan||task.requirement||metricSuggestion.actionSuggestion
 task.metric={
  code:task.metric?.code||metricSuggestion.metricCode,label:task.metric?.label||metricSuggestion.metricLabel,
  baseline:finite(task.metric?.baseline??task.baselineValue)??metricSuggestion.baselineValue,
  target:finite(task.metric?.target??task.targetValue)??metricSuggestion.targetValue,
  unit:task.metric?.unit??metricSuggestion.metricUnit,direction:task.metric?.direction||metricSuggestion.metricDirection,
 }
 task.plannedStartAt=iso(task.plannedStartAt,createdAt)
 task.submitDueAt=iso(task.submitDueAt,dueAt)
 task.verificationDueAt=iso(task.verificationDueAt||task.reinspectAt,new Date(Date.parse(dueAt)+24*60*60*1000).toISOString())
 task.attachments=Array.isArray(task.attachments)?task.attachments:[]
 task.metricSnapshots=Array.isArray(task.metricSnapshots)?task.metricSnapshots:[]
 task.managementRecords=Array.isArray(task.managementRecords)?task.managementRecords:[]
 task.archivedAt=task.archivedAt||''
 task.archivedBy=task.archivedBy||''
 task.archiveNote=task.archiveNote||''
 task.nextFollowUpAt=task.nextFollowUpAt||''
 task.lastFollowUpAt=task.lastFollowUpAt||''
 task.interventionCount=Number(task.interventionCount||0)
 task.reopenCount=Number(task.reopenCount||0)
 if(!task.metricSnapshots.length&&task.metric.baseline!=null)task.metricSnapshots.push({
  id:`${task.id}:baseline`,metricCode:task.metric.code,metricLabel:task.metric.label,actual:task.metric.baseline,
  target:task.metric.target,unit:task.metric.unit,direction:task.metric.direction,type:'baseline',source:'任务创建基线',observedAt:createdAt,note:'创建任务时记录的指标基线',
 })
 task.nodes=Array.isArray(task.nodes)&&task.nodes.length?task.nodes:defaultNodes(task)
 return task
}

export const normalizeLeanState=state=>({...state,tasks:(state.tasks||[]).map(normalizeLeanTask)})

export const completeTaskNode=(task,code,{actor,role,result=''})=>{
 task.nodes=Array.isArray(task.nodes)?task.nodes:defaultNodes(task)
 const node=task.nodes.find(item=>item.code===code)
 if(node){
  node.status='completed';node.completedAt=new Date().toISOString();node.result=result||node.result
  node.completedBy=actor;node.completedByRole=role
 }
 const next=task.nodes.find(item=>item.status==='pending')
 if(next)next.status='active'
}

export const improvementSummary=(task,livePoints=[])=>{
 const metric=task.metric||inferMetric(`${task.issueCategory||task.type||''} ${task.problem||task.requirement||task.title||''}`)
 const stored=(task.metricSnapshots||[]).map(item=>({date:item.observedAt,value:finite(item.actual),source:item.source||'任务记录',type:item.type||'observation'}))
 const merged=[...stored,...livePoints].filter(item=>item.value!=null).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))
 const unique=merged.filter((item,index,array)=>index===array.findIndex(candidate=>candidate.date===item.date&&candidate.value===item.value))
 const baseline=finite(metric.baseline)??unique[0]?.value??null
 const latest=unique.at(-1)?.value??baseline
 const target=finite(metric.target)
 const direction=metric.direction||'higher'
 const delta=baseline==null||latest==null?null:Number((latest-baseline).toFixed(2))
 const targetMet=latest!=null&&target!=null?(direction==='lower'?latest<=target:latest>=target):false
 const improved=delta==null?false:(direction==='lower'?delta<0:delta>0)
 return {
  metric,baseline,latest,target,delta,targetMet,improved,
  points:unique.slice(-7),
  conclusion:latest==null?'暂无可用于验证的指标数据，请结合附件和现场记录判断。':targetMet
   ?`${metric.label}已达到目标，较基线${delta>=0?'提升':'下降'}${Math.abs(delta)}${metric.unit}。`
   :improved
    ?`${metric.label}较基线已有改善，但尚未达到${target}${metric.unit}目标。`
    :`${metric.label}尚未出现有效改善，建议退回补充动作或升级支持。`,
 }
}
