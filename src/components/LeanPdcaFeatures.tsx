import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Role } from '../types'
import { WorkflowState, WorkflowTask, workflowApi } from '../data/workflowApi'
import { TaskImprovement, taskApi } from '../data/taskApi'
import { AlertTriangle, BarChart3, CalendarRange, CheckCircle2, Clock3, Download, Paperclip, Plus, RefreshCw, Sparkles, Target, TrendingUp, UploadCloud, X } from './Icons'

type Runner=(action:()=>Promise<WorkflowState>,success:string)=>void|Promise<void>
const roleLabels:Record<string,string>={director:'运营总监',manager:'客服经理',supervisor:'客服主管',leader:'客服班长',employee:'客服专员',quality:'质检专员',training:'培训主管',hrbp:'HRBP经理'}
const targetRoles:Record<string,string[]>={
 director:['manager','supervisor','leader','employee','quality','training','hrbp'],
 manager:['supervisor','leader','employee','quality','training','hrbp'],
 supervisor:['leader','employee'],
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

export function LeanPdcaDashboard({role,state,busy,run,notify}:{role:Role;state:WorkflowState;busy:boolean;run:Runner;notify:(text:string)=>void}){
 const [days,setDays]=useState('30')
 const [open,setOpen]=useState(false)
 const canCreate=['supervisor','manager','director'].includes(role)
 const filtered=useMemo(()=>{
  const duration=days==='all'?Infinity:Number(days)*24*60*60*1000
  return state.tasks.filter(task=>duration===Infinity||Date.now()-Date.parse(task.createdAt)<=duration)
 },[state.tasks,days])
 const counts={
  published:filtered.filter(task=>statusGroup(task.status)==='published').length,
  doing:filtered.filter(task=>statusGroup(task.status)==='doing').length,
  verify:filtered.filter(task=>statusGroup(task.status)==='verify').length,
  closed:filtered.filter(task=>statusGroup(task.status)==='closed').length,
 }
 const workload=Object.values(filtered.reduce<Record<string,{name:string;role:string;total:number;closed:number}>>((result,task)=>{
  const name=task.executionOwner||task.owner||roleLabels[task.executionOwnerRole||task.ownerRole]||'未分配'
  const key=`${task.executionOwnerRole||task.ownerRole}:${name}`
  const record=result[key]||{name,role:roleLabels[task.executionOwnerRole||task.ownerRole]||task.executionOwnerRole||task.ownerRole,total:0,closed:0}
  record.total+=1;if(task.status==='closed')record.closed+=1;result[key]=record;return result
 },{})).sort((a,b)=>b.total-a.total)
 const max=Math.max(1,...workload.map(item=>item.total))
 return <section className="lean-dashboard">
  <header><div><span>精益任务驾驶舱</span><h2>从下发量看到执行力与改善结果</h2><p>按任务创建时间汇总所属团队，闭环数量不等于改善有效，验收时仍需对照目标和系统趋势。</p></div><div className="lean-dashboard-actions"><label><CalendarRange size={15}/><select value={days} onChange={event=>setDays(event.target.value)}><option value="7">近7天</option><option value="30">近30天</option><option value="90">近90天</option><option value="all">全部周期</option></select></label>{canCreate&&<button onClick={()=>setOpen(true)}><Plus size={15}/>下发精益任务</button>}</div></header>
  <div className="lean-stat-grid">
   {[['published','刚发布',counts.published,'#1f6feb'],['doing','执行中',counts.doing,'#df8b16'],['verify','待验证',counts.verify,'#7c3aed'],['closed','已完成',counts.closed,'#168565']].map(item=><article key={String(item[0])} style={{'--lean-color':item[3]} as CSSProperties}><span>{item[1]}</span><strong>{item[2]}</strong><small>{filtered.length?`${Math.round(Number(item[2])/filtered.length*100)}%`:'0%'}</small></article>)}
  </div>
  <div className="lean-dashboard-grid"><div><header><BarChart3 size={17}/><strong>任务处理量分布</strong><small>识别负荷不均与管理覆盖盲区</small></header>{workload.length?<div className="lean-workload-list">{workload.slice(0,8).map((item,index)=><div key={`${item.role}-${item.name}`}><span>{index+1}</span><p><strong>{item.name}</strong><small>{item.role} · 已闭环{item.closed}项</small></p><i><b style={{width:`${item.total/max*100}%`}}></b></i><em>{item.total}项</em></div>)}</div>:<p className="lean-empty">当前周期暂无任务</p>}</div><div><header><Clock3 size={17}/><strong>近期任务清单</strong><small>{filtered.length}项</small></header><div className="lean-recent-list">{filtered.slice(0,6).map(task=><article key={task.id}><span className={statusGroup(task.status)}></span><div><strong>{task.title}</strong><small>{task.executionOwner||task.owner} · 提交{fmt(task.submitDueAt||task.dueAt)}</small></div><em>{task.metric?.label||task.type}</em></article>)}</div></div></div>
  {open&&<DirectiveTaskDialog role={role} busy={busy} run={run} notify={notify} close={()=>setOpen(false)}/>}
 </section>
}

function DirectiveTaskDialog({role,busy,run,notify,close}:{role:Role;busy:boolean;run:Runner;notify:(text:string)=>void;close:()=>void}){
 const firstTarget=targetRoles[role]?.[0]||'leader'
 const [targetRole,setTargetRole]=useState(firstTarget)
 const [owner,setOwner]=useState(ownerDefaults[firstTarget])
 const [form,setForm]=useState({
  title:'人工满意度两日提升专项',issueCategory:'服务质量',issueLocation:'普通客服一区·8班 / 李倩 JR10776',
  problem:'员工人工服务满意率连续低于个人目标，需定位服务动作和业务解决过程中的具体差距。',
  target:'人工服务满意率提升至不低于97.2%',successCriteria:'验证时读取近两日系统数据，满意率达到97.2%，并提交录音复盘和辅导记录。',
  actionPlan:'复盘近3通低满意录音，完成服务四动作校准并每日抽检2通新录音。',
  metricCode:'satisfaction',metricLabel:'人工服务满意率',metricUnit:'%',metricDirection:'higher' as 'higher'|'lower',
  baselineValue:93.2,targetValue:97.2,plannedStartAt:localDateTime(1),submitDueAt:localDateTime(24),verificationDueAt:localDateTime(48),
  aiRationale:'',employeeCode:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',
 })
 const [suggesting,setSuggesting]=useState(false)
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
  await Promise.resolve(run(()=>workflowApi.createDirectiveTask({...form,role,targetRole,owner}),`任务已指派给${owner}，进入精益PDCA`))
  close()
 }
 const valid=Boolean(form.title.trim()&&form.problem.trim().length>=10&&form.issueLocation.trim()&&form.target.trim()&&form.successCriteria.trim().length>=10&&form.actionPlan.trim().length>=10&&owner.trim())
 return <div className="lean-dialog-shade" onMouseDown={close}><section className="lean-dialog" onMouseDown={event=>event.stopPropagation()}><header><div><span>自上而下 · 支持越级指派</span><h2>创建精益改善任务</h2><p>问题必须定位到指标、人员/班组和业务场景；目标必须能在验证时间取得结果数据。</p></div><button onClick={close}><X size={19}/></button></header><div className="lean-dialog-body">
  <div className="lean-form-row three"><label>任务标题<input value={form.title} onChange={event=>set('title',event.target.value)}/></label><label>指派岗位<select value={targetRole} onChange={event=>{setTargetRole(event.target.value);setOwner(ownerDefaults[event.target.value])}}>{targetRoles[role].map(item=><option value={item} key={item}>{roleLabels[item]}</option>)}</select></label><label>具体责任人<input value={owner} onChange={event=>setOwner(event.target.value)}/></label></div>
  <div className="lean-form-row"><label>问题分类<input value={form.issueCategory} onChange={event=>set('issueCategory',event.target.value)}/></label><label>具体定位<input value={form.issueLocation} onChange={event=>set('issueLocation',event.target.value)} placeholder="班组 / 员工 / 工号 / 业务场景"/></label></div>
  <label>具体问题<textarea value={form.problem} onChange={event=>set('problem',event.target.value)}/></label>
  <div className="lean-ai-suggest"><div><Sparkles size={17}/><span><strong>目标建议助手</strong><small>结合问题类型、基线和呼叫中心管理规则生成目标与验收标准</small></span></div><button disabled={suggesting||!form.problem.trim()} onClick={suggest}>{suggesting?<RefreshCw className="spin" size={15}/>:<Sparkles size={15}/>}AI建议目标</button></div>
  <div className="lean-form-row three"><label>指标名称<input value={form.metricLabel} onChange={event=>set('metricLabel',event.target.value)}/></label><label>当前基线<input type="number" step="0.01" value={form.baselineValue} onChange={event=>set('baselineValue',Number(event.target.value))}/></label><label>目标值<input type="number" step="0.01" value={form.targetValue} onChange={event=>set('targetValue',Number(event.target.value))}/></label></div>
  <label>目标描述<input value={form.target} onChange={event=>set('target',event.target.value)}/></label>
  <label>改善动作<textarea value={form.actionPlan} onChange={event=>set('actionPlan',event.target.value)}/></label>
  <label>验收标准<textarea value={form.successCriteria} onChange={event=>set('successCriteria',event.target.value)}/></label>
  <div className="lean-form-row three"><label>计划开始<input type="datetime-local" value={form.plannedStartAt} onChange={event=>set('plannedStartAt',event.target.value)}/></label><label>执行提交时限<input type="datetime-local" value={form.submitDueAt} onChange={event=>set('submitDueAt',event.target.value)}/></label><label>上级验证时限<input type="datetime-local" value={form.verificationDueAt} onChange={event=>set('verificationDueAt',event.target.value)}/></label></div>
 </div><footer><button className="secondary" onClick={close}>取消</button><button className="primary" disabled={busy||!valid} onClick={submit}><Target size={15}/>确认目标并下发</button></footer></section></div>
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
 if(task.workflowKind!=='lean_directive')return null
 const execute=task.executionOwnerRole===role&&task.ownerRole===role
 const verify=task.verificationRole===role&&task.ownerRole===role
 const act=(action:string,payload:Record<string,string>={},message:string)=>run(()=>workflowApi.taskAction(task.id,role,action,payload),message)
 if(task.status==='todo')return <div className="lean-action-box"><h3>接收任务并确认执行窗口</h3><p>{task.actionPlan}</p><div className="lean-deadlines"><span>开始 {fmt(task.plannedStartAt)}</span><span>提交 {fmt(task.submitDueAt)}</span><span>验证 {fmt(task.verificationDueAt)}</span></div><button className="primary" disabled={!execute||busy} onClick={()=>act('lean_start',{},'任务已接收，执行节点开始计时')}>接收并开始执行</button></div>
 if(['doing','returned_to_origin'].includes(task.status))return <div className="lean-action-box">{task.status==='returned_to_origin'&&<div className="lean-return-note"><AlertTriangle size={16}/><div><strong>上级退回要求</strong><p>{task.supervisorGuidance}</p></div></div>}<h3>提交结果数据与执行证据</h3><textarea value={evidence} onChange={event=>setEvidence(event.target.value)} placeholder="说明完成的动作、具体结果、录音/工单定位和遗留问题（至少10字）"/><label className="lean-actual-value">提交时{task.metric?.label}实际值<div><input type="number" step="0.01" value={actualValue} onChange={event=>setActualValue(event.target.value)} placeholder="可由系统数据补充"/><span>{task.metric?.unit}</span></div></label><button className="primary" disabled={!execute||busy||evidence.trim().length<10} onClick={()=>act('lean_submit',{evidence,actualValue},`结果已提交${roleLabels[task.verificationRole||'']}验证`)}>提交结果并进入验证</button></div>
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
 return <div className={`lean-improvement ${data?.targetMet?'met':data?.improved?'improving':'risk'}`}><header><div><TrendingUp size={17}/><span><strong>系统改善数据</strong><small>验证时自动匹配员工近两日及最近可用指标</small></span></div><button disabled={loading} onClick={load}><RefreshCw className={loading?'spin':''} size={14}/>刷新数据</button></header>{data?<><div className="lean-improvement-summary"><div><span>任务基线</span><strong>{data.baseline??'—'}{data.metric.unit}</strong></div><div><span>最新实际</span><strong>{data.latest??'—'}{data.metric.unit}</strong></div><div><span>约定目标</span><strong>{data.target??'—'}{data.metric.unit}</strong></div><div><span>系统判断</span><strong>{data.targetMet?'已达标':data.improved?'改善中':'未改善'}</strong></div></div><div className="lean-trend">{data.points.map(point=><div key={`${point.date}-${point.value}`}><i><b style={{height:`${20+(point.value-min)/(max-min||1)*70}%`}}></b></i><strong>{point.value}{data.metric.unit}</strong><small>{new Date(point.date).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})}</small></div>)}</div><p><Target size={14}/>{data.conclusion}</p></>:<p className="lean-empty">暂时无法取得该指标趋势，请结合任务附件和现场记录验证。</p>}</div>
}
