import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Role } from '../types'
import { WorkflowMutationResult, WorkflowState, WorkflowTask, workflowApi } from '../data/workflowApi'
import { TaskImprovement, taskApi } from '../data/taskApi'
import { AlertTriangle, BarChart3, CalendarRange, CheckCircle2, ChevronRight, Clock3, Download, ListChecks, MessageSquareText, Paperclip, Plus, RefreshCw, Save, Search, ShieldCheck, Sparkles, Target, TrendingUp, UploadCloud, UserCog, X } from './Icons'

type Runner=(action:()=>Promise<WorkflowMutationResult>,success:string)=>boolean|void|Promise<boolean|void>
const roleLabels:Record<string,string>={director:'运营总监',manager:'客服经理',supervisor:'客服主管',leader:'客服班长',employee:'客服专员',quality:'质检专员',training:'培训主管',hrbp:'HRBP经理'}
const targetRoles:Record<string,string[]>={
 director:['manager','supervisor','leader','employee','quality','training','hrbp'],
 manager:['supervisor','leader','employee','quality','training','hrbp'],
 supervisor:['leader','employee'],
}
const requestRoles:Record<string,string[]>={
 employee:['leader','quality','training','hrbp'],leader:['employee','supervisor','quality','training','hrbp'],
 supervisor:['manager','leader','employee','quality','training','hrbp'],quality:['leader','supervisor','manager','training'],
 training:['leader','supervisor','manager','quality'],hrbp:['leader','supervisor','manager'],
 manager:['director','supervisor','leader','employee','quality','training','hrbp'],
 director:['manager','supervisor','leader','employee','quality','training','hrbp'],
}
const ownerDefaults:Record<string,string>={
 manager:'吴欣欣（客服经理）',supervisor:'前台客服主管',leader:'张伟（班长）',employee:'李倩（客服专员）',
 quality:'质检专员',training:'刘颖（培训主管）',hrbp:'王丽伟（HRBP经理）',
}
const localDateTime=(offsetHours:number)=>{
 const date=new Date(Date.now()+offsetHours*60*60*1000)
 const shifted=new Date(date.getTime()-date.getTimezoneOffset()*60*1000)
 return shifted.toISOString().slice(0,16)
}
const fmt=(value?:string)=>value?new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'待定'
const statusGroup=(status:string)=>status==='todo'?'published':status==='closed'?'closed':status==='pending_verification'?'verify':'doing'

export const workflowTaskVisibleForRole=(task:WorkflowTask,role:Role)=>{
 if(role==='director')return true
 if(task.workflowKind==='lean_directive')return task.initiatorRole===role||task.executionOwnerRole===role||task.ownerRole===role||task.verificationRole===role
 if(task.workflowKind==='ai_action')return task.originRole===role||task.ownerRole===role||task.verificationRole===role
 if(task.workflowKind==='meeting_action')return task.originRole===role||task.ownerRole===role||task.verificationRole===role
 if(role==='quality')return task.verificationRole==='quality'
 if(role==='employee')return task.verificationRole==='employee'
 if(role==='leader')return task.ownerRole==='leader'||task.sourceLabel==='质检协同单'
 return task.ownerRole===role||task.verificationRole===role
}

export function LeanPdcaDashboard({role,state,busy,run,notify,onOpenTask}:{role:Role;state:WorkflowState;busy:boolean;run:Runner;notify:(text:string)=>void;onOpenTask:(taskId:string)=>void}){
 const [days,setDays]=useState('30')
 const [lifecycle,setLifecycle]=useState<'active'|'archived'|'all'>('active')
 const [open,setOpen]=useState(false)
 const [catalogFiltersOpen,setCatalogFiltersOpen]=useState(false)
 const [catalogOwner,setCatalogOwner]=useState('all')
 const [catalogStatus,setCatalogStatus]=useState('all')
 const [catalogKeyword,setCatalogKeyword]=useState('')
 const [catalogStartDate,setCatalogStartDate]=useState('')
 const [catalogEndDate,setCatalogEndDate]=useState('')
 const canRequest=Boolean(requestRoles[role]?.length)
 useEffect(()=>{
  setOpen(false);setCatalogFiltersOpen(false);setCatalogOwner('all');setCatalogStatus('all')
  setCatalogKeyword('');setCatalogStartDate('');setCatalogEndDate('')
 },[role])
 const filtered=useMemo(()=>{
  const duration=days==='all'?Infinity:Number(days)*24*60*60*1000
  const roleScoped=state.tasks.filter(task=>workflowTaskVisibleForRole(task,role))
  return roleScoped.filter(task=>{
   const lifecycleMatch=lifecycle==='all'||(lifecycle==='archived'?Boolean(task.archivedAt):!task.archivedAt)
   const timeMatch=duration===Infinity||!task.createdAt||Date.now()-Date.parse(task.createdAt)<=duration
   return lifecycleMatch&&timeMatch
  })
 },[state.tasks,days,role,lifecycle])
 const catalogOwners=useMemo(()=>Array.from(new Set(filtered.map(task=>task.executionOwner||task.owner).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'zh-CN')),[filtered])
 const catalogTasks=useMemo(()=>filtered.filter(task=>{
  const owner=task.executionOwner||task.owner
  const executionTime=task.startedAt||task.plannedStartAt||task.createdAt
  const executionTimestamp=Date.parse(executionTime||'')
  const from=catalogStartDate?Date.parse(`${catalogStartDate}T00:00:00`):-Infinity
  const to=catalogEndDate?Date.parse(`${catalogEndDate}T23:59:59.999`):Infinity
  const keyword=catalogKeyword.trim().toLocaleLowerCase('zh-CN')
  const searchable=[task.title,task.id,task.type,task.sourceLabel,task.problem,task.issueLocation,task.person,task.team,owner].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN')
  return (catalogOwner==='all'||owner===catalogOwner)
   &&(catalogStatus==='all'||statusGroup(task.status)===catalogStatus)
   &&(!Number.isFinite(executionTimestamp)||(executionTimestamp>=from&&executionTimestamp<=to))
   &&(!keyword||searchable.includes(keyword))
 }),[filtered,catalogOwner,catalogStatus,catalogKeyword,catalogStartDate,catalogEndDate])
 const hasCatalogFilters=catalogOwner!=='all'||catalogStatus!=='all'||Boolean(catalogKeyword.trim()||catalogStartDate||catalogEndDate)
 const clearCatalogFilters=()=>{setCatalogOwner('all');setCatalogStatus('all');setCatalogKeyword('');setCatalogStartDate('');setCatalogEndDate('')}
 const counts={
  published:filtered.filter(task=>statusGroup(task.status)==='published').length,
  doing:filtered.filter(task=>statusGroup(task.status)==='doing').length,
  verify:filtered.filter(task=>statusGroup(task.status)==='verify').length,
  closed:filtered.filter(task=>statusGroup(task.status)==='closed').length,
 }
 const slaCounts={
  overdue:filtered.filter(task=>['overdue_execution','overdue_verification'].includes(task.slaStatus||'')).length,
  followUp:filtered.filter(task=>task.slaStatus==='follow_up_due').length,
  dueSoon:filtered.filter(task=>task.slaStatus==='due_soon').length,
 }
 const workload=Object.values(filtered.reduce<Record<string,{name:string;role:string;total:number;closed:number}>>((result,task)=>{
  const name=task.executionOwner||task.owner||roleLabels[task.executionOwnerRole||task.ownerRole]||'未分配'
  const key=`${task.executionOwnerRole||task.ownerRole}:${name}`
  const record=result[key]||{name,role:roleLabels[task.executionOwnerRole||task.ownerRole]||task.executionOwnerRole||task.ownerRole,total:0,closed:0}
  record.total+=1;if(task.status==='closed')record.closed+=1;result[key]=record;return result
 },{})).sort((a,b)=>b.total-a.total)
 const max=Math.max(1,...workload.map(item=>item.total))
  return <section className="lean-dashboard">
  <header><div><span>精益任务驾驶舱</span><h2>从任务结构看到执行力与改善结果</h2><p>第一层聚焦任务统计与风险，点击任务后进入第二层执行详情。</p></div><div className="lean-dashboard-actions"><label><select aria-label="任务档案范围" value={lifecycle} onChange={event=>setLifecycle(event.target.value as 'active'|'archived'|'all')}><option value="active">在管任务</option><option value="archived">已归档</option><option value="all">全部档案</option></select></label><label><CalendarRange size={15}/><select value={days} onChange={event=>setDays(event.target.value)}><option value="7">近7天</option><option value="30">近30天</option><option value="90">近90天</option><option value="all">全部周期</option></select></label>{canRequest&&<button onClick={()=>setOpen(true)}><Plus size={15}/>发起任务需求</button>}</div></header>
  <div className="lean-sla-strip"><span className={slaCounts.overdue?'risk':''}><AlertTriangle size={14}/>逾期任务 <b>{slaCounts.overdue}</b></span><span className={slaCounts.followUp?'warning':''}><MessageSquareText size={14}/>跟进到期 <b>{slaCounts.followUp}</b></span><span><Clock3 size={14}/>4小时内到期 <b>{slaCounts.dueSoon}</b></span><small>按当前执行/验收节点自动计算，管理者无需逐单翻查截止时间。</small></div>
  <div className="lean-stat-grid">
   {[['published','刚发布',counts.published,'#1f6feb'],['doing','执行中',counts.doing,'#df8b16'],['verify','待验证',counts.verify,'#7c3aed'],['closed','已完成',counts.closed,'#168565']].map(item=><article key={String(item[0])} style={{'--lean-color':item[3]} as CSSProperties}><span>{item[1]}</span><strong>{item[2]}</strong><small>{filtered.length?`${Math.round(Number(item[2])/filtered.length*100)}%`:'0%'}</small></article>)}
  </div>
  <div className="lean-dashboard-grid"><div><header><BarChart3 size={17}/><strong>任务处理量分布</strong><small>识别负荷不均与管理覆盖盲区</small></header>{workload.length?<div className="lean-workload-list">{workload.slice(0,8).map((item,index)=><div key={`${item.role}-${item.name}`}><span>{index+1}</span><p><strong>{item.name}</strong><small>{item.role} · 已闭环{item.closed}项</small></p><i><b style={{width:`${item.total/max*100}%`}}></b></i><em>{item.total}项</em></div>)}</div>:<p className="lean-empty">当前周期暂无任务</p>}</div><div><header><Clock3 size={17}/><strong>近期任务清单</strong><small>{filtered.length}项</small></header><div className="lean-recent-list">{filtered.slice(0,6).map(task=><button type="button" onClick={()=>onOpenTask(task.id)} key={task.id}><span className={statusGroup(task.status)}></span><div><strong>{task.title}</strong><small>{task.executionOwner||task.owner} · 提交{fmt(task.submitDueAt||task.dueAt)}</small></div><em>{task.metric?.label||task.type}</em><ChevronRight size={15}/></button>)}</div></div></div>
  <section className="lean-task-catalog"><header><div><ListChecks size={17}/><strong>任务单清单</strong><small>点击任务单查看详情并执行</small></div><div className="lean-catalog-tools"><span>{catalogTasks.length}{hasCatalogFilters?` / ${filtered.length}`:''}项</span><button type="button" className={catalogFiltersOpen||hasCatalogFilters?'active':''} onClick={()=>setCatalogFiltersOpen(value=>!value)}><Search size={14}/>筛选{hasCatalogFilters&&<b></b>}</button></div></header>
   {catalogFiltersOpen&&<div className="lean-catalog-filters"><label><span>执行人</span><select aria-label="按执行人筛选" value={catalogOwner} onChange={event=>setCatalogOwner(event.target.value)}><option value="all">全部执行人</option>{catalogOwners.map(owner=><option value={owner} key={owner}>{owner}</option>)}</select></label><label className="lean-catalog-date"><span>执行时间</span><div><input aria-label="执行开始日期" type="date" value={catalogStartDate} max={catalogEndDate||undefined} onInput={event=>setCatalogStartDate(event.currentTarget.value)}/><i>至</i><input aria-label="执行结束日期" type="date" value={catalogEndDate} min={catalogStartDate||undefined} onInput={event=>setCatalogEndDate(event.currentTarget.value)}/></div></label><label><span>任务状态</span><select aria-label="按任务状态筛选" value={catalogStatus} onChange={event=>setCatalogStatus(event.target.value)}><option value="all">全部状态</option><option value="published">刚发布</option><option value="doing">执行中</option><option value="verify">待验证</option><option value="closed">已完成</option></select></label><label className="lean-catalog-keyword"><span>关键词</span><div><Search size={14}/><input aria-label="按关键词筛选" value={catalogKeyword} onChange={event=>setCatalogKeyword(event.target.value)} placeholder="任务标题、编号、人员、问题"/></div></label><button type="button" className="lean-filter-clear" disabled={!hasCatalogFilters} onClick={clearCatalogFilters}><X size={14}/>清空</button></div>}
   {catalogTasks.length?<div>{catalogTasks.map(task=><button type="button" onClick={()=>onOpenTask(task.id)} key={task.id}><span className={`lean-catalog-status ${statusGroup(task.status)}`}></span><div><strong>{task.title}</strong><small>{task.id} · {task.sourceLabel||task.type} · {task.executionOwner||task.owner}</small></div><em>{task.archivedAt?'已归档':task.status==='closed'?'已完成':task.status==='pending_verification'?'待验证':task.status==='todo'?'刚发布':'执行中'}</em><time>{fmt(task.slaDeadline||task.submitDueAt||task.dueAt)}</time><ChevronRight size={16}/></button>)}</div>:<p className="lean-empty">{hasCatalogFilters?'没有符合当前筛选条件的任务单':'当前筛选范围暂无任务单'}</p>}</section>
  {open&&<TaskRequestDialog role={role} busy={busy} run={run} notify={notify} close={()=>setOpen(false)}/>}
 </section>
}

export type TaskRequestPrefill=Partial<{
 title:string;issueCategory:string;issueLocation:string;problem:string;target:string;successCriteria:string;actionPlan:string
 metricCode:string;metricLabel:string;metricUnit:string;metricDirection:'higher'|'lower';baselineValue:number;targetValue:number
 plannedStartAt:string;submitDueAt:string;verificationDueAt:string;aiRationale:string;employeeCode:string;employeeName:string;team:string
 targetRole:string;owner:string
}>

export function TaskRequestDialog({role,busy,run,notify,close,initial}:{role:Role;busy:boolean;run:Runner;notify:(text:string)=>void;close:()=>void;initial?:TaskRequestPrefill}){
 const allowedTargets=requestRoles[role]||[]
 const firstTarget=initial?.targetRole&&allowedTargets.includes(initial.targetRole)?initial.targetRole:allowedTargets[0]||'leader'
 const [targetRole,setTargetRole]=useState(firstTarget)
 const [owner,setOwner]=useState(initial?.owner||ownerDefaults[firstTarget])
 const [form,setForm]=useState(()=>({
  title:'人工满意度两日提升专项',issueCategory:'服务质量',issueLocation:'普通客服一区·8班 / 李倩 JR10776',
  problem:'员工人工服务满意率连续低于个人目标，需定位服务动作和业务解决过程中的具体差距。',
  target:'人工服务满意率提升至不低于97.2%',successCriteria:'验证时读取近两日系统数据，满意率达到97.2%，并提交录音复盘和辅导记录。',
  actionPlan:'复盘近3通低满意录音，完成服务四动作校准并每日抽检2通新录音。',
  metricCode:'satisfaction',metricLabel:'人工服务满意率',metricUnit:'%',metricDirection:'higher' as 'higher'|'lower',
  baselineValue:93.2,targetValue:97.2,plannedStartAt:localDateTime(1),submitDueAt:localDateTime(24),verificationDueAt:localDateTime(48),
  aiRationale:'',employeeCode:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',
  ...initial,
 }))
 const [suggesting,setSuggesting]=useState(false)
 const [submitting,setSubmitting]=useState(false)
 const [formError,setFormError]=useState('')
 const set=(field:string,value:string|number)=>setForm(current=>({...current,[field]:value}))
 const suggest=async()=>{
  setSuggesting(true)
  try{
   const result=await taskApi.targetSuggestion({role,problem:form.problem,issueCategory:form.issueCategory,issueLocation:form.issueLocation,baselineValue:form.baselineValue,metricCode:form.metricCode})
   const suggestion=result.suggestion
   setForm(current=>({...current,...suggestion,actionPlan:suggestion.actionSuggestion,aiRationale:suggestion.rationale}))
   notify(`${result.provider==='DeepSeek'?'AI':'系统规则'}已生成可量化目标建议`)
  }catch(error){notify(error instanceof Error?error.message:'目标建议生成失败')}finally{setSuggesting(false)}
 }
 const submit=async()=>{
  const validationError=!form.title.trim()?'请填写任务标题'
   :!targetRole?'请选择指派岗位'
   :!owner.trim()?'请填写具体责任人'
   :!form.issueCategory.trim()?'请填写问题分类'
   :!form.issueLocation.trim()?'请定位到班组、员工或业务场景'
   :form.problem.trim().length<10?'具体问题至少填写10个字'
   :!form.metricLabel.trim()?'请填写指标名称'
   :!Number.isFinite(Number(form.baselineValue))||!Number.isFinite(Number(form.targetValue))?'基线和目标值必须是有效数字'
   :!form.target.trim()?'请填写目标描述'
   :form.actionPlan.trim().length<10?'改善动作至少填写10个字'
   :form.successCriteria.trim().length<10?'验收标准至少填写10个字'
   :!form.plannedStartAt||!form.submitDueAt||!form.verificationDueAt?'请完整设置计划开始、提交和验证时间'
   :Date.parse(form.plannedStartAt)>Date.parse(form.submitDueAt)||Date.parse(form.submitDueAt)>Date.parse(form.verificationDueAt)?'计划开始、执行提交和上级验证时间必须依次递增'
   :''
  if(validationError){setFormError(validationError);notify(validationError);return}
  setFormError('');setSubmitting(true)
  try{
   const result=await Promise.resolve(run(()=>workflowApi.createTaskRequest({...form,role,targetRole,owner}),`任务需求已发送给${owner}，进入精益PDCA`))
   if(result===false){setFormError('任务下发失败，请根据系统提示修正后重试');return}
   close()
  }finally{setSubmitting(false)}
 }
 return <div className="lean-dialog-shade" onMouseDown={close}><section className="lean-dialog" role="dialog" aria-modal="true" aria-labelledby="lean-request-title" onMouseDown={event=>event.stopPropagation()}><header><div><span>统一任务入口 · 谁发起谁验收</span><h2 id="lean-request-title">发起任务需求</h2><p>支持向上协同、同级协同和向下指派；责任岗位提交结果后，由发起岗位最终验收。</p></div><button type="button" aria-label="关闭任务模板" onClick={close}><X size={19}/></button></header><div className="lean-dialog-body">
  <div className="lean-form-row three"><label>任务标题<input value={form.title} onChange={event=>set('title',event.target.value)}/></label><label>责任岗位<select value={targetRole} onChange={event=>{setTargetRole(event.target.value);setOwner(ownerDefaults[event.target.value])}}>{allowedTargets.map(item=><option value={item} key={item}>{roleLabels[item]}</option>)}</select></label><label>具体责任人<input value={owner} onChange={event=>setOwner(event.target.value)}/></label></div>
  <div className="lean-form-row"><label>问题分类<input value={form.issueCategory} onChange={event=>set('issueCategory',event.target.value)}/></label><label>具体定位<input value={form.issueLocation} onChange={event=>set('issueLocation',event.target.value)} placeholder="班组 / 员工 / 工号 / 业务场景"/></label></div>
  <label>具体问题<textarea value={form.problem} onChange={event=>set('problem',event.target.value)}/></label>
  <div className="lean-ai-suggest"><div><Sparkles size={17}/><span><strong>目标建议助手</strong><small>结合问题类型、基线和呼叫中心管理规则生成目标与验收标准</small></span></div><button disabled={suggesting||!form.problem.trim()} onClick={suggest}>{suggesting?<RefreshCw className="spin" size={15}/>:<Sparkles size={15}/>}AI建议目标</button></div>
  <div className="lean-form-row three"><label>指标名称<input value={form.metricLabel} onChange={event=>set('metricLabel',event.target.value)}/></label><label>当前基线<input type="number" step="0.01" value={form.baselineValue} onChange={event=>set('baselineValue',Number(event.target.value))}/></label><label>目标值<input type="number" step="0.01" value={form.targetValue} onChange={event=>set('targetValue',Number(event.target.value))}/></label></div>
  <label>目标描述<input value={form.target} onChange={event=>set('target',event.target.value)}/></label>
  <label>改善动作<textarea value={form.actionPlan} onChange={event=>set('actionPlan',event.target.value)}/></label>
  <label>验收标准<textarea value={form.successCriteria} onChange={event=>set('successCriteria',event.target.value)}/></label>
  <div className="lean-form-row three"><label>计划开始<input type="datetime-local" value={form.plannedStartAt} onChange={event=>set('plannedStartAt',event.target.value)}/></label><label>执行提交时限<input type="datetime-local" value={form.submitDueAt} onChange={event=>set('submitDueAt',event.target.value)}/></label><label>上级验证时限<input type="datetime-local" value={form.verificationDueAt} onChange={event=>set('verificationDueAt',event.target.value)}/></label></div>
 </div><footer>{formError&&<span className="lean-form-error"><AlertTriangle size={15}/>{formError}</span>}<button type="button" className="secondary" disabled={submitting} onClick={close}>取消</button><button type="button" className="primary" disabled={submitting} onClick={submit}>{submitting?<RefreshCw className="spin" size={15}/>:<Target size={15}/>} {submitting?'正在创建任务并通知责任岗位…':'确认目标并发起需求'}</button></footer></section></div>
}

export function LeanTaskBrief({task}:{task:WorkflowTask}){
 if(!task.problem)return null
 return <div className="lean-task-brief"><div><span>具体问题</span><strong>{task.problem}</strong><small>{task.issueCategory} · {task.issueLocation}</small></div><div><span>量化目标</span><strong>{task.target}</strong><small>基线 {task.metric?.baseline??'—'}{task.metric?.unit} → 目标 {task.metric?.target??'—'}{task.metric?.unit}</small></div><div><span>改善动作</span><strong>{task.actionPlan}</strong><small>验收标准：{task.successCriteria}</small></div></div>
}

export function LeanTaskNodes({task}:{task:WorkflowTask}){
 if(!task.nodes?.length)return null
 return <div className="lean-node-strip">{[...task.nodes].sort((a,b)=>a.sequence-b.sequence).map((node,index)=><div className={node.status} key={node.id}><span>{node.status==='completed'?<CheckCircle2 size={15}/>:index+1}</span><p><strong>{node.name}</strong><small>{node.status==='completed'?`完成 ${fmt(node.completedAt)}`:`计划 ${fmt(node.plannedAt)}`}</small></p></div>)}</div>
}

export function LeanTaskActions({task,role,busy,run}:{task:WorkflowTask;role:Role;busy:boolean;run:Runner}){
 const [evidence,setEvidence]=useState('')
 const [actualValue,setActualValue]=useState('')
 const [comment,setComment]=useState('')
 const [standardizedAction,setStandardizedAction]=useState('')
 const [actionError,setActionError]=useState('')
 useEffect(()=>{setEvidence('');setActualValue('');setComment('');setStandardizedAction('');setActionError('')},[task.id,task.status])
 if(task.workflowKind!=='lean_directive')return null
 const execute=task.executionOwnerRole===role&&task.ownerRole===role
 const verify=task.verificationRole===role&&task.ownerRole===role
 const act=(action:string,payload:Record<string,string>={},message:string)=>run(()=>workflowApi.taskAction(task.id,role,action,payload),message)
 const submitResult=()=>{
  if(evidence.trim().length<10){setActionError('请先填写至少10字的执行结果和证据说明，再提交上级验证。');return}
  setActionError('')
  act('lean_submit',{evidence,actualValue},`结果已提交${roleLabels[task.verificationRole||'']}验证`)
 }
 if(task.status==='todo')return <div className="lean-action-box"><h3>接收任务并确认执行窗口</h3><p>{task.actionPlan}</p><div className="lean-deadlines"><span>开始 {fmt(task.plannedStartAt)}</span><span>提交 {fmt(task.submitDueAt)}</span><span>验证 {fmt(task.verificationDueAt)}</span></div><button className="primary" disabled={!execute||busy} onClick={()=>act('lean_start',{},'任务已接收，执行节点开始计时')}>接收并开始执行</button></div>
 if(['doing','returned_to_origin'].includes(task.status))return <div className="lean-action-box">{task.status==='returned_to_origin'&&<div className="lean-return-note"><AlertTriangle size={16}/><div><strong>上级退回要求</strong><p>{task.supervisorGuidance}</p></div></div>}<h3>提交结果数据与执行证据</h3><textarea value={evidence} onChange={event=>{setEvidence(event.target.value);if(actionError)setActionError('')}} placeholder="说明完成的动作、具体结果、录音/工单定位和遗留问题（至少10字）"/><div className="lean-submit-guidance"><span>执行结果为必填，至少10字</span><em className={evidence.trim().length>=10?'ready':''}>{evidence.trim().length}/10</em><span>实际值和附件可按现场情况补充</span></div><label className="lean-actual-value">提交时{task.metric?.label}实际值<div><input type="number" step="0.01" value={actualValue} onChange={event=>setActualValue(event.target.value)} placeholder="可由系统数据补充"/><span>{task.metric?.unit}</span></div></label>{actionError&&<div className="lean-action-error"><AlertTriangle size={15}/>{actionError}</div>}<button className="primary" disabled={!execute||busy} onClick={submitResult}>提交结果并进入验证</button></div>
 if(task.status==='pending_verification')return <div className="lean-action-box"><h3>上级验证与标准化</h3><textarea value={comment} onChange={event=>setComment(event.target.value)} placeholder="结合系统趋势、目标值和附件填写验收结论（至少10字）"/><textarea value={standardizedAction} onChange={event=>setStandardizedAction(event.target.value)} placeholder="验收通过后沉淀的标准动作、话术或检查机制"/><div className="lean-verify-actions"><button className="secondary" disabled={!verify||busy||comment.trim().length<10} onClick={()=>act('lean_verify_return',{comment},'任务未达标，已退回责任岗位整改')}>未达标，退回整改</button><button className="primary" disabled={!verify||busy||comment.trim().length<10} onClick={()=>act('lean_verify_success',{comment,standardizedAction},'任务验收通过，改善动作已固化')}>验收通过并关闭</button></div></div>
 return null
}

export function TaskAttachments({task,role,busy,run,notify}:{task:WorkflowTask;role:Role;busy:boolean;run:Runner;notify:(text:string)=>void}){
 const upload=async(file?:File)=>{
  if(!file)return
  if(file.size>5*1024*1024){notify('单个附件不能超过5MB');return}
  await Promise.resolve(run(()=>taskApi.uploadAttachment(task.id,role,task.status==='pending_verification'?'verify':'submit',file),`附件“${file.name}”已保存到MySQL`))
 }
 return <div className="lean-attachments"><header><div><Paperclip size={16}/><strong>节点附件</strong><small>录音说明、截图、工单或分析表将经业务服务保存到 MySQL</small></div><label className={busy?'disabled':''}><UploadCloud size={15}/>上传附件<input type="file" disabled={busy} accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.xlsx,.docx,.zip,audio/*" onChange={event=>{void upload(event.target.files?.[0]);event.target.value=''}}/></label></header>{task.attachments?.length?<div>{task.attachments.map(item=><a href={taskApi.attachmentUrl(task.id,item.id,role)} key={item.id}><span><Paperclip size={14}/></span><p><strong>{item.fileName}</strong><small>{Math.ceil(item.fileSize/1024)}KB · {item.uploadedBy} · {fmt(item.createdAt)}</small></p><Download size={15}/></a>)}</div>:<p className="lean-empty">暂未上传附件，可在执行、提交或验证节点补充材料。</p>}</div>
}

export function TaskImprovementPanel({task,role}:{task:WorkflowTask;role:Role}){
 const [data,setData]=useState<TaskImprovement|null>(null)
 const [loading,setLoading]=useState(false)
 const load=()=>{
  setLoading(true)
  taskApi.improvement(task.id,role).then(setData).catch(()=>setData(null)).finally(()=>setLoading(false))
 }
 useEffect(()=>{if(['pending_verification','closed'].includes(task.status))load()},[task.id,task.status])
 if(!['pending_verification','closed'].includes(task.status))return null
 const values=data?.points.map(item=>item.value)||[]
 const min=Math.min(...values,0),max=Math.max(...values,1)
 const metricUnit=data?.metric?.unit||''
 return <div className={`lean-improvement ${data?.targetMet?'met':data?.improved?'improving':'risk'}`}><header><div><TrendingUp size={17}/><span><strong>系统改善数据</strong><small>验证时自动匹配员工近两日及最近可用指标</small></span></div><button disabled={loading} onClick={load}><RefreshCw className={loading?'spin':''} size={14}/>刷新数据</button></header>{data?<><div className="lean-improvement-summary"><div><span>任务基线</span><strong>{data.baseline??'—'}{metricUnit}</strong></div><div><span>最新实际</span><strong>{data.latest??'—'}{metricUnit}</strong></div><div><span>约定目标</span><strong>{data.target??'—'}{metricUnit}</strong></div><div><span>系统判断</span><strong>{data.targetMet?'已达标':data.improved?'改善中':'未改善'}</strong></div></div><div className="lean-trend">{data.points.map(point=><div key={`${point.date}-${point.value}`}><i><b style={{height:`${20+(point.value-min)/(max-min||1)*70}%`}}></b></i><strong>{point.value}{metricUnit}</strong><small>{new Date(point.date).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})}</small></div>)}</div><p><Target size={14}/>{data.conclusion}</p></>:<p className="lean-empty">暂时无法取得该指标趋势，请结合任务附件和现场记录验证。</p>}</div>
}

const pdcaCommentNodes=[
 {code:'P',name:'目标设定',hint:'问题定位、目标和验收口径'},
 {code:'D',name:'执行改善',hint:'动作、资源和执行过程'},
 {code:'C',name:'验证结果',hint:'数据、证据和验收判断'},
 {code:'A',name:'闭环固化',hint:'标准沉淀和复发预防'},
] as const

export function TaskComments({task,role,busy,run}:{task:WorkflowTask;role:Role;busy:boolean;run:Runner}){
 const [open,setOpen]=useState(false)
 const [nodeCode,setNodeCode]=useState<'P'|'D'|'C'|'A'>(task.phase||'P')
 const [comment,setComment]=useState('')
 const [error,setError]=useState('')
 const comments=(task.managementRecords||[]).filter(record=>record.type==='comment')
 useEffect(()=>{setOpen(false);setNodeCode(task.phase||'P');setComment('');setError('')},[task.id])
 const submit=async()=>{
  if(comment.trim().length<5){setError('请填写至少5字的评论内容');return}
  setError('')
  const result=await Promise.resolve(run(()=>workflowApi.taskAction(task.id,role,'task_comment',{nodeCode,comment:comment.trim()}),`${nodeCode}节点评论已写入任务档案`))
  if(result!==false){setComment('');setOpen(false)}
 }
 return <section className={`pdca-comments ${open?'open':''}`}>
  <header><div><span className="pdca-comment-icon"><MessageSquareText size={18}/></span><div><strong>协同评论</strong><small>围绕P/D/C/A节点沟通，评论留痕但不改变任务责任人</small></div>{comments.length>0&&<em>{comments.length}条</em>}</div><button type="button" className={open?'active':''} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><MessageSquareText size={15}/>{open?'收起评论':'发表评论'}</button></header>
  {!open&&comments.length>0&&<div className="pdca-comment-preview">{comments.slice(0,2).map(record=><article key={record.id}><b>{record.before?.nodeCode||'P'}</b><div><strong>{record.actor}</strong><p>{record.note.replace(/^[PDCA]·[^：]+评论：/,'')}</p></div><time>{fmt(record.createdAt)}</time></article>)}</div>}
  {open&&<div className="pdca-comment-editor"><div className="pdca-comment-nodes">{pdcaCommentNodes.map(node=><button type="button" className={nodeCode===node.code?'active':''} onClick={()=>setNodeCode(node.code)} key={node.code}><b>{node.code}</b><span><strong>{node.name}</strong><small>{node.hint}</small></span></button>)}</div><label><span>在“{pdcaCommentNodes.find(node=>node.code===nodeCode)?.name}”节点发表评论</span><textarea value={comment} onChange={event=>{setComment(event.target.value);if(error)setError('')}} placeholder="写明事实依据、判断、建议或需要协同的事项（至少5字）"/></label><footer>{error&&<span><AlertTriangle size={14}/>{error}</span>}<small>评论将同步进入任务时间线与审计记录</small><button type="button" className="primary" disabled={busy||comment.trim().length<5} onClick={submit}>{busy?<RefreshCw className="spin" size={14}/>:<MessageSquareText size={14}/>}提交评论</button></footer></div>}
 </section>
}

const inputDateTime=(value?:string)=>{
 if(!value)return ''
 const date=new Date(value)
 if(Number.isNaN(date.getTime()))return ''
 return new Date(date.getTime()-date.getTimezoneOffset()*60*1000).toISOString().slice(0,16)
}

export function LeanTaskManagementPanel({task,role,busy,run}:{task:WorkflowTask;role:Role;busy:boolean;run:Runner}){
 const [note,setNote]=useState('')
 const [nextFollowUpAt,setNextFollowUpAt]=useState(inputDateTime(task.nextFollowUpAt))
 const [targetRole,setTargetRole]=useState(targetRoles[role]?.[0]||'')
 const [targetOwner,setTargetOwner]=useState(ownerDefaults[targetRoles[role]?.[0]||'']||'')
 const [submitDueAt,setSubmitDueAt]=useState(inputDateTime(task.submitDueAt||task.dueAt))
 const [verificationDueAt,setVerificationDueAt]=useState(inputDateTime(task.verificationDueAt))
 const [error,setError]=useState('')
 useEffect(()=>{
  setNote('');setError('');setNextFollowUpAt(inputDateTime(task.nextFollowUpAt))
  setTargetRole(targetRoles[role]?.[0]||'');setTargetOwner(ownerDefaults[targetRoles[role]?.[0]||'']||'')
  setSubmitDueAt(inputDateTime(task.submitDueAt||task.dueAt));setVerificationDueAt(inputDateTime(task.verificationDueAt))
 },[task.id,role,task.nextFollowUpAt,task.submitDueAt,task.dueAt,task.verificationDueAt])
 if(task.workflowKind!=='lean_directive')return null
 const active=task.status!=='closed'&&!task.archivedAt
 const canIntervene=active&&(role==='director'||role==='manager'||(role==='supervisor'&&['leader','employee'].includes(task.executionOwnerRole||'')))
 const canReassign=active&&Boolean(targetRoles[role]?.length)&&(role===task.initiatorRole||role===task.executionOwnerRole||role==='manager'||role==='director')
 const canChangeDeadline=active&&(role===task.initiatorRole||role===task.verificationRole||role==='manager'||role==='director')
 const canArchive=task.status==='closed'&&!task.archivedAt&&(role===task.initiatorRole||role===task.verificationRole||role==='manager'||role==='director')
 const canReopen=task.status==='closed'&&(role===task.initiatorRole||role===task.verificationRole||role==='manager'||role==='director')
 const act=(action:string,payload:Record<string,string>,message:string)=>run(()=>workflowApi.taskAction(task.id,role,action,payload),message)
 const requireNote=(min:number,action:()=>void)=>{
  if(note.trim().length<min){setError(`请填写至少${min}字的事实、原因和管理要求`);return}
  setError('');action()
 }
 return <section className="lean-management">
  <header><div><MessageSquareText size={18}/><span><strong>任务跟进与管理介入</strong><small>跟进、介入、改派、时限调整、归档和重开全部进入任务档案</small></span></div><div>{task.interventionCount?`已介入${task.interventionCount}次`:''}{task.reopenCount?` · 重开${task.reopenCount}次`:''}</div></header>
  {task.interventionRequirement&&active&&<div className="lean-intervention-banner"><AlertTriangle size={16}/><span><strong>当前上级介入要求</strong><p>{task.interventionRequirement}</p></span></div>}
  <div className="lean-management-grid">
   <div className="lean-management-main"><label>跟进事实 / 介入要求 / 变更原因<textarea value={note} onChange={event=>{setNote(event.target.value);setError('')}} placeholder="记录当前进展、阻塞事项、需要协调的资源和下一次检查要求"/></label><label>下次跟进时间<input type="datetime-local" value={nextFollowUpAt} onChange={event=>setNextFollowUpAt(event.target.value)}/></label>{error&&<p className="lean-action-error"><AlertTriangle size={14}/>{error}</p>}<div className="lean-management-actions"><button className="secondary" disabled={busy||Boolean(task.archivedAt)} onClick={()=>requireNote(5,()=>act('lean_follow_up',{comment:note,nextFollowUpAt},'跟进记录已写入任务档案'))}><MessageSquareText size={14}/>记录跟进</button>{canIntervene&&<button className="primary" disabled={busy} onClick={()=>requireNote(10,()=>act('lean_intervene',{comment:note,nextFollowUpAt},'上级介入要求已通知责任岗位'))}><ShieldCheck size={14}/>上级介入</button>}{canArchive&&<button className="primary archive" disabled={busy} onClick={()=>requireNote(5,()=>act('lean_archive',{comment:note},'任务已归档并保留完整档案'))}><Save size={14}/>归档任务</button>}{canReopen&&<button className="secondary reopen" disabled={busy} onClick={()=>requireNote(10,()=>act('lean_reopen',{comment:note},'任务已重新开启并回到执行岗位'))}><RefreshCw size={14}/>问题复发，重新开启</button>}</div></div>
   {active&&<aside>
    {canReassign&&<div><strong>责任改派</strong><select value={targetRole} onChange={event=>{setTargetRole(event.target.value);setTargetOwner(ownerDefaults[event.target.value]||'')}}>{(targetRoles[role]||[]).map(item=><option value={item} key={item}>{roleLabels[item]}</option>)}</select><input value={targetOwner} onChange={event=>setTargetOwner(event.target.value)} placeholder="新责任人"/><button className="secondary" disabled={busy||!targetOwner.trim()} onClick={()=>act('lean_reassign',{targetRole,owner:targetOwner},'任务责任人已改派并通知新岗位')}><UserCog size={14}/>确认改派</button></div>}
    {canChangeDeadline&&<div><strong>任务时限调整</strong><label>执行提交<input type="datetime-local" value={submitDueAt} onChange={event=>setSubmitDueAt(event.target.value)}/></label><label>上级验证<input type="datetime-local" value={verificationDueAt} onChange={event=>setVerificationDueAt(event.target.value)}/></label><button className="secondary" disabled={busy||!submitDueAt||!verificationDueAt} onClick={()=>requireNote(5,()=>act('lean_change_deadline',{comment:note,submitDueAt,verificationDueAt},'任务时限已调整并通知责任岗位'))}><Clock3 size={14}/>更新时间要求</button></div>}
   </aside>}
  </div>
  {task.archivedAt&&<div className="lean-archive-result"><CheckCircle2 size={18}/><span><strong>已归档 · {task.archivedBy}</strong><p>{task.archiveNote} · {fmt(task.archivedAt)}</p></span></div>}
  {!!task.managementRecords?.filter(record=>record.type!=='comment').length&&<div className="lean-management-records">{task.managementRecords.filter(record=>record.type!=='comment').slice(0,8).map(record=><article key={record.id}><span className={record.type}></span><div><strong>{({follow_up:'跟进',intervention:'上级介入',reassign:'责任改派',deadline_change:'时限调整',archive:'归档',reopen:'重新开启'} as Record<string,string>)[record.type]||record.type} · {record.actor}</strong><p>{record.note}</p><small>{fmt(record.createdAt)}{record.nextFollowUpAt?` · 下次跟进 ${fmt(record.nextFollowUpAt)}`:''}</small></div></article>)}</div>}
 </section>
}
