import { useEffect, useMemo, useState } from 'react'
import {
 AlertTriangle, ArrowUpRight, BarChart3, CalendarDays, CheckCircle2, ClipboardCheck, Clock3,
 FileBarChart, GraduationCap, MessageSquareText, Plus, RefreshCw, Send, ShieldCheck, Target, Users, X,
} from './Icons'
import {
 DevelopmentCase, DevelopmentCommentNode, DevelopmentRole, DevelopmentStatus, WorkflowState, workflowApi,
} from '../data/workflowApi'
import type { Role } from '../types'

type Notify=(text:string)=>void
type Props={role:Role;state:WorkflowState|null;setState:(state:WorkflowState)=>void;notify:Notify;employeeId:string}
type FormState={
 type:'training'|'interview';employeeId:string;title:string;reason:string;goal:string;actionPlan:string;successCriteria:string
 plannedAt:string;dueAt:string;verificationDueAt:string
}
type ActionKind='accept'|'submit'|'verify_success'|'verify_return'

const roleLabel:Record<DevelopmentRole|string,string>={
 employee:'客服专员',leader:'客服班长',supervisor:'客服主管',quality:'质检岗位',training:'培训岗位',hrbp:'HRBP',
 manager:'客服经理',director:'运营总监',
}
const statusLabel:Record<DevelopmentStatus,string>={
 pending_acceptance:'待责任人回执',in_progress:'执行中',pending_verification:'待发起人验收',returned:'验收退回',closed:'已闭环',
}
const shortDate=(value:string)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value))
const futureLocal=(hours=24)=>{
 const date=new Date(Date.now()+hours*60*60*1000)
 date.setMinutes(date.getMinutes()-date.getTimezoneOffset())
 return date.toISOString().slice(0,16)
}
const defaultForm=(employeeId:string):FormState=>({
 type:'training',employeeId,title:'续约业务四步法专项训练',
 reason:'员工在续约边界场景中仍有判断偏差，需要结合本人真实录音开展针对性训练。',
 goal:'员工能够独立、准确完成续约场景四步确认，降低同类差错与重复来电。',
 actionPlan:'完成业务口径讲解、2个案例演练和2通本人录音复盘，员工提交学习结果与行动承诺。',
 successCriteria:'通关测试不低于90分，抽检2通新录音均无同类问题，并由发起岗位完成效果验收。',
 plannedAt:futureLocal(1),dueAt:futureLocal(24),verificationDueAt:futureLocal(48),
})
const fallbackEmployees=[
 {jobNo:'JR10776',name:'李倩',team:'普通客服一区·8班'},
 {jobNo:'JR10913',name:'王芳',team:'普通客服一区·8班'},
 {jobNo:'JR11005',name:'孙雷',team:'普通客服一区·8班'},
 {jobNo:'JR10381',name:'赵晨',team:'普通客服一区·8班'},
 {jobNo:'JR10822',name:'刘欣',team:'普通客服一区·8班'},
]

function DevelopmentHeader({role,counts,onCreate,notify}:{role:Role;counts:{active:number;verify:number;closed:number;training:number};onCreate?:()=>void;notify:Notify}){
 const employee=role==='employee',management=['supervisor','manager','director'].includes(role)
 return <>
  <section className={`development-head ${employee?'employee':management?'report':''}`}>
   <div><span>{employee?'客服专员 · 个人培训面谈任务':management?'组织学习健康度 · 管理评论台':`${roleLabel[role]} · 培训面谈发起与验收工作台`}</span>
    <h1>{employee?'我的培训和面谈，目标、时限和结果都清楚':management?'看全程、给评论，不替代责任岗位执行':'围绕员工问题发起，用目标和结果完成闭环'}</h1>
    <p>{employee?'仅查看并执行发给本人的培训或面谈任务，按目标提交结果，等待发起岗位验收。':management?'查看所属组织任务进度、目标和结果，可在每个PDCA节点发表评论并留下管理意见。':'仅质检、培训和班长可以发起；客服员工执行并反馈，发起岗位对照目标最终验收。'}</p>
   </div>
   <aside><ShieldCheck size={18}/><span><b>闭环原则</b>质检 / 培训 / 班长发起 → 员工执行 → 发起岗位验收 → 管理岗位全过程评论</span></aside>
   <footer>{onCreate&&<button className="primary" onClick={onCreate}><Plus size={15}/>新建培训或面谈</button>}{management&&<button className="primary" onClick={()=>notify(`${roleLabel[role]}月度培训与面谈分析报告已生成`)}><FileBarChart size={15}/>生成分析报告</button>}</footer>
  </section>
  <section className="development-kpis">
   <article><span>进行中</span><strong>{counts.active}</strong><em>责任岗位正在处理</em></article>
   <article><span>待发起人验收</span><strong>{counts.verify}</strong><em>谁发起谁验收</em></article>
   <article><span>本期已闭环</span><strong>{counts.closed}</strong><em>结果全过程留痕</em></article>
   <article><span>培训任务占比</span><strong>{counts.training}%</strong><em>其余为面谈任务</em></article>
  </section>
 </>
}

function Flow({status}:{status:DevelopmentStatus}){
 const current=status==='pending_acceptance'?0:status==='in_progress'||status==='returned'?1:status==='pending_verification'?2:3
 return <div className="development-flow">{['发起','执行反馈','发起人验收','关闭'].map((label,index)=><span className={index<=current?'active':''} key={label}><i>{index<current?<CheckCircle2 size={12}/>:index+1}</i><b>{label}</b></span>)}</div>
}

function CaseCard({item,role,onAction,onComment}:{item:DevelopmentCase;role:Role;onAction:(item:DevelopmentCase,action:ActionKind)=>void;onComment?:(item:DevelopmentCase)=>void}){
 const canOwn=item.ownerRole===role
 const canVerify=item.verificationRole===role&&item.status==='pending_verification'
 const comments=item.comments||[]
 return <article className={`development-case ${item.status}`}>
  <header><span className={item.type}>{item.type==='training'?<GraduationCap size={18}/>:<MessageSquareText size={18}/>}</span><div><small>{item.id} · {item.type==='training'?'培训任务':'面谈任务'}</small><h3>{item.title}</h3></div><em>{statusLabel[item.status]}</em></header>
  <div className="development-case-meta"><span><b>{item.employeeName}</b>{item.employeeId} · {item.team}</span><span><b>发起</b>{item.initiatorName}</span><span><b>计划开始</b>{shortDate(item.plannedAt||item.createdAt)}</span><span><b>员工提交</b>{shortDate(item.dueAt)}</span><span><b>验收截止</b>{shortDate(item.verificationDueAt||item.dueAt)}</span></div>
  <div className="development-case-body"><div><span>具体问题与事实</span><p>{item.reason}</p></div><div><span>改善目标</span><p>{item.goal}</p></div><div><span>员工行动计划</span><p>{item.actionPlan||'按发起岗位要求完成培训或面谈并提交结果。'}</p></div><div><span>验收标准</span><p>{item.successCriteria||item.goal}</p></div></div>
  <Flow status={item.status}/>
  {(item.acknowledgement||item.result||item.verificationComment)&&<div className="development-feedback">
   {item.acknowledgement&&<p><b>责任人回执</b>{item.acknowledgement}</p>}
   {item.result&&<p><b>执行结果</b>{item.result}</p>}
   {item.verificationComment&&<p><b>验收意见</b>{item.verificationComment}</p>}
  </div>}
  {!!comments.length&&<div className="development-comments-preview">{comments.slice(0,2).map(entry=><p key={entry.id}><b>{entry.nodeName} · {entry.actor}</b><span>{entry.content}</span><time>{shortDate(entry.createdAt)}</time></p>)}</div>}
  <footer><span><Clock3 size={13}/>更新 {shortDate(item.history[0]?.at||item.createdAt)} · 当前责任：{roleLabel[item.ownerRole]}</span><div>
   {onComment&&<button className="comment" onClick={()=>onComment(item)}><MessageSquareText size={13}/>节点评论{comments.length?` ${comments.length}`:''}</button>}
   {canOwn&&item.status==='pending_acceptance'&&<button className="primary" onClick={()=>onAction(item,'accept')}><ClipboardCheck size={13}/>接收并回执</button>}
   {canOwn&&['in_progress','returned'].includes(item.status)&&<button className="primary" onClick={()=>onAction(item,'submit')}><Send size={13}/>{item.status==='returned'?'补充后重新提交':'反馈执行结果'}</button>}
   {canVerify&&<><button className="secondary" onClick={()=>onAction(item,'verify_return')}><AlertTriangle size={13}/>退回补充</button><button className="primary" onClick={()=>onAction(item,'verify_success')}><CheckCircle2 size={13}/>验收并关闭</button></>}
   {!canOwn&&!canVerify&&item.status!=='closed'&&<em>等待{roleLabel[item.ownerRole]}处理</em>}
  </div></footer>
 </article>
}

function ReportView({role,cases,notify}:{role:Role;cases:DevelopmentCase[];notify:Notify}){
 const teams=useMemo(()=>{
  const counts=new Map<string,number>()
  cases.forEach(item=>counts.set(item.team,(counts.get(item.team)||0)+1))
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])
 },[cases])
 const maxTeam=Math.max(1,...teams.map(item=>item[1]))
 const closed=cases.filter(item=>item.status==='closed')
 const initiators=useMemo(()=>Object.entries(cases.reduce((all,item)=>({...all,[item.initiatorRole]:(all[item.initiatorRole]||0)+1}),{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]),[cases])
 return <>
  <div className="development-report-grid">
   <section className="panel development-report-panel"><header><div><span>组织覆盖分布</span><h2>培训与面谈主要发生在哪里</h2></div><em>按对应组织汇总</em></header>{teams.map(([team,count])=><div className="development-bar" key={team}><span>{team}</span><i><b style={{width:`${count/maxTeam*100}%`}}></b></i><strong>{count}项</strong></div>)}</section>
   <section className="panel development-report-panel"><header><div><span>发起岗位结构</span><h2>谁在主动推动员工成长</h2></div><em>{cases.length}项样本</em></header>{initiators.map(([itemRole,count])=><div className="development-role-stat" key={itemRole}><span>{roleLabel[itemRole]}</span><strong>{count}</strong><i style={{width:`${count/Math.max(1,cases.length)*100}%`}}></i></div>)}</section>
  </div>
  <section className="panel development-report-table"><header><div><span>管理报告</span><h2>闭环质量与组织判断</h2></div><button onClick={()=>notify(`${roleLabel[role]}培训与面谈健康简报已推送至消息中心`)}><FileBarChart size={14}/>生成健康简报</button></header>
   <div className="development-report-head"><span>组织</span><span>任务总量</span><span>培训 / 面谈</span><span>已闭环</span><span>待验收</span><span>管理判断</span></div>
   {teams.map(([team,total])=>{
    const scoped=cases.filter(item=>item.team===team),training=scoped.filter(item=>item.type==='training').length,done=scoped.filter(item=>item.status==='closed').length,verify=scoped.filter(item=>item.status==='pending_verification').length
    const health=verify>1?'验收积压':done/Math.max(1,total)>=.5?'闭环健康':'推进中'
    return <article key={team}><strong>{team}</strong><span>{total}项</span><span>{training} / {total-training}</span><span>{done}项</span><span>{verify}项</span><em className={health==='验收积压'?'risk':''}>{health}</em></article>
   })}
  </section>
  <section className="development-report-insight"><BarChart3 size={21}/><div><b>{roleLabel[role]}判断</b><p>培训任务占比高，说明当前改善以业务能力建设为主；建议重点盯住“执行结果已提交、发起人尚未验收”的任务，避免培训有动作无效果。</p></div><strong>{closed.length}/{cases.length}<small>闭环任务</small></strong></section>
 </>
}

export default function DevelopmentWorkHub({role,state,setState,notify,employeeId}:Props){
 const [tab,setTab]=useState<'all'|'mine'|'closed'>(()=>role==='training'?'mine':'all')
 const [createOpen,setCreateOpen]=useState(false)
 const [form,setForm]=useState<FormState>(()=>defaultForm(employeeId))
 const [selected,setSelected]=useState<DevelopmentCase|null>(null)
 const [action,setAction]=useState<ActionKind>('accept')
 const [comment,setComment]=useState('')
 const [commentCase,setCommentCase]=useState<DevelopmentCase|null>(null)
 const [commentNode,setCommentNode]=useState<DevelopmentCommentNode>('plan')
 const [managementComment,setManagementComment]=useState('')
 const [busy,setBusy]=useState(false)
 useEffect(()=>{if(role==='training')setTab('mine')},[role])
 const source=state?.learning.developmentCases||[]
 const employees=useMemo(()=>{
  const live=(state?.workforce.employees||[]).filter(item=>item.role==='employee').map(item=>({jobNo:item.jobNo,name:item.name,team:item.team}))
  const fromCases=source.map(item=>({jobNo:item.employeeId,name:item.employeeName,team:item.team}))
  return [...live,...fromCases,...fallbackEmployees].filter((item,index,all)=>all.findIndex(other=>other.jobNo===item.jobNo)===index)
 },[state?.workforce.employees,source])
 if(!state)return <div className="development-loading"><RefreshCw size={20}/>正在读取培训与面谈任务…</div>
 const employeeCases=role==='employee'?source.filter(item=>item.employeeId===employeeId):source
 const cases=employeeCases
 const active=cases.filter(item=>item.status!=='closed').length,verify=cases.filter(item=>item.status==='pending_verification').length,closed=cases.filter(item=>item.status==='closed').length
 const counts={active,verify,closed,training:Math.round(cases.filter(item=>item.type==='training').length/Math.max(1,cases.length)*100)}
 const management=['supervisor','manager','director'].includes(role)
 const canInitiate=['leader','quality','training'].includes(role)
 const attentionCases=cases.filter(item=>['returned','pending_verification'].includes(item.status)||Date.parse(item.dueAt)-Date.now()<24*60*60*1000)
 const displayed=cases.filter(item=>tab==='closed'?item.status==='closed':tab==='mine'?management?attentionCases.includes(item):(item.ownerRole===role||item.verificationRole===role)&&item.status!=='closed':item.status!=='closed').sort((left,right)=>{
  const priority=(item:DevelopmentCase)=>item.status==='pending_verification'&&item.ownerRole===role?0:item.ownerRole===role?1:2
  return priority(left)-priority(right)||Date.parse(left.verificationDueAt||left.dueAt)-Date.parse(right.verificationDueAt||right.dueAt)
 })
 const run=async(work:()=>Promise<WorkflowState>,success:string)=>{
  if(busy)return false
  setBusy(true)
  try{const next=await work();setState(next);notify(success);return true}catch(error){notify(error instanceof Error?error.message:'培训面谈流程处理失败');return false}finally{setBusy(false)}
 }
 const openCreate=()=>{
  const initial=defaultForm(employeeId)
  initial.employeeId=employees[0]?.jobNo||employeeId
  setForm(initial);setCreateOpen(true)
 }
 const create=async()=>{
  const timeInvalid=!form.plannedAt||!form.dueAt||!form.verificationDueAt||Date.parse(form.plannedAt)>Date.parse(form.dueAt)||Date.parse(form.dueAt)>Date.parse(form.verificationDueAt)
  if(timeInvalid){notify('计划开始、员工提交和发起人验收时间必须依次设置');return}
  const submitted=await run(()=>workflowApi.createDevelopmentCase({
   role:role as DevelopmentRole,...form,responderRole:'employee',
   plannedAt:new Date(form.plannedAt).toISOString(),dueAt:new Date(form.dueAt).toISOString(),verificationDueAt:new Date(form.verificationDueAt).toISOString(),
  }),`已向${employees.find(item=>item.jobNo===form.employeeId)?.name||'员工'}发起${form.type==='training'?'培训':'面谈'}任务`)
  if(submitted)setCreateOpen(false)
 }
 const openAction=(item:DevelopmentCase,nextAction:ActionKind)=>{
  setSelected(item);setAction(nextAction)
  setComment(nextAction==='accept'
   ?`已接收任务，确认在${shortDate(item.dueAt)}前完成，并按目标反馈结果。`
   :nextAction==='submit'
    ?item.type==='training'?'已完成学习、案例复盘和业务演练，关键步骤能够独立执行，请发起人验收。':'已完成结构化面谈，确认问题、行动承诺和回看时间，请发起人验收。'
    :nextAction==='verify_success'?'提交结果符合任务目标和验收标准，确认本次培训或面谈有效并关闭。':'当前结果证据不足，请补充具体行动、结果数据或员工确认后重新提交。')
 }
 const submitAction=()=>{
  if(!selected)return
  const success=action==='accept'?'任务已接收并向发起人回执':action==='submit'?'执行结果已反馈，等待发起人验收':action==='verify_success'?'发起人验收通过，任务已关闭':'验收未通过，已退回责任岗位补充'
  void run(()=>workflowApi.developmentCaseAction(selected.id,role as DevelopmentRole,action,comment),success)
  setSelected(null)
 }
 const openComment=(item:DevelopmentCase)=>{
  setCommentCase(item)
  setCommentNode(item.status==='pending_acceptance'?'plan':item.status==='in_progress'||item.status==='returned'?'execute':item.status==='pending_verification'?'verify':'close')
  setManagementComment('')
 }
 const submitComment=async()=>{
  if(!commentCase||!management)return
  const saved=await run(()=>workflowApi.developmentCaseComment(commentCase.id,role as 'supervisor'|'manager'|'director',commentNode,managementComment),`${roleLabel[role]}评论已写入任务节点`)
  if(saved){setCommentCase(null);setManagementComment('')}
 }
 return <div className="development-workbench">
  <DevelopmentHeader role={role} counts={counts} onCreate={canInitiate?openCreate:undefined} notify={notify}/>
  {management&&<ReportView role={role} cases={cases} notify={notify}/>}
  <section className="development-tabs"><button className={tab==='all'?'active':''} onClick={()=>setTab('all')}><Users size={15}/>{role==='employee'?'我的全部任务':'组织进行中'}<b>{active}</b></button><button className={tab==='mine'?'active':''} onClick={()=>setTab('mine')}><ArrowUpRight size={15}/>{management?'待管理关注':'待我处理'}<b>{management?attentionCases.length:cases.filter(item=>(item.ownerRole===role||item.verificationRole===role)&&item.status!=='closed').length}</b></button><button className={tab==='closed'?'active':''} onClick={()=>setTab('closed')}><CheckCircle2 size={15}/>已闭环<b>{closed}</b></button></section>
  {role==='employee'&&<section className="development-employee-rule"><Target size={18}/><div><b>员工执行边界</b><p>培训或面谈由质检、培训、班长发起；你负责确认计划、完成行动并提交结果，最终由发起岗位对照目标验收。</p></div></section>}
  {management&&<section className="development-employee-rule management"><MessageSquareText size={18}/><div><b>管理岗位评论规则</b><p>可以查看任务全过程，并在目标设定、员工执行、发起人验收、闭环固化四个节点评论；评论不代替员工执行和发起岗位验收。</p></div></section>}
  <section className="development-case-list">{displayed.length?displayed.map(item=><CaseCard key={item.id} item={item} role={role} onAction={openAction} onComment={management?openComment:undefined}/>):<div className="development-empty"><CheckCircle2 size={34}/><h3>当前筛选下没有任务</h3><p>所有培训与面谈都已完成对应岗位处理。</p></div>}</section>
  {createOpen&&<div className="development-modal-backdrop" onClick={()=>setCreateOpen(false)}><section className="development-modal development-create-modal" onClick={event=>event.stopPropagation()}><header><div><span>员工培训与面谈目标任务单</span><h2>明确员工、问题、目标、行动和验收时间</h2><p>质检、培训或班长发起，员工反馈结果，发起岗位完成最终验收。</p></div><button aria-label="关闭发起单" onClick={()=>setCreateOpen(false)}><X size={19}/></button></header><div className="development-form-grid">
   <label>任务类型<select value={form.type} onChange={event=>setForm({...form,type:event.target.value as FormState['type']})}><option value="training">培训任务</option><option value="interview">面谈任务</option></select></label>
   <label>客服员工<select value={form.employeeId} onChange={event=>setForm({...form,employeeId:event.target.value})}>{employees.map(item=><option value={item.jobNo} key={item.jobNo}>{item.name} · {item.team}</option>)}</select></label>
   <label className="full">任务标题<input value={form.title} onChange={event=>setForm({...form,title:event.target.value})}/></label>
   <label className="full">具体问题与事实依据<textarea value={form.reason} onChange={event=>setForm({...form,reason:event.target.value})}/></label>
   <label className="full">改善目标<textarea value={form.goal} onChange={event=>setForm({...form,goal:event.target.value})}/></label>
   <label className="full">员工行动计划<textarea value={form.actionPlan} onChange={event=>setForm({...form,actionPlan:event.target.value})}/></label>
   <label className="full">验收标准<textarea value={form.successCriteria} onChange={event=>setForm({...form,successCriteria:event.target.value})}/></label>
   <label>计划开始<input type="datetime-local" value={form.plannedAt} onChange={event=>setForm({...form,plannedAt:event.target.value})}/></label>
   <label>员工提交时限<input type="datetime-local" value={form.dueAt} onChange={event=>setForm({...form,dueAt:event.target.value})}/></label>
   <label>发起岗位验收时限<input type="datetime-local" value={form.verificationDueAt} onChange={event=>setForm({...form,verificationDueAt:event.target.value})}/></label>
  </div><aside><ShieldCheck size={16}/>发起岗位对目标与验收标准负责；员工对执行结果负责；经理、主管、总监的评论全过程留痕。</aside><footer><button className="secondary" onClick={()=>setCreateOpen(false)}>取消</button><button className="primary" disabled={busy||!form.title.trim()||form.reason.trim().length<10||form.goal.trim().length<5||form.actionPlan.trim().length<10||form.successCriteria.trim().length<10} onClick={()=>void create()}><Send size={14}/>发起员工任务</button></footer></section></div>}
  {selected&&<div className="development-modal-backdrop" onClick={()=>setSelected(null)}><section className="development-modal compact" onClick={event=>event.stopPropagation()}><header><div><span>{selected.id} · {statusLabel[selected.status]}</span><h2>{action==='accept'?'员工接收任务并确认计划':action==='submit'?'员工反馈培训或面谈结果':action==='verify_success'?'发起岗位完成最终验收':'退回员工补充结果'}</h2><p>{selected.title}</p></div><button aria-label="关闭处理窗口" onClick={()=>setSelected(null)}><X size={19}/></button></header><div className="development-action-summary"><b>改善目标</b><p>{selected.goal}</p><b>验收标准</b><p>{selected.successCriteria||selected.goal}</p><small>员工提交 {shortDate(selected.dueAt)} · 验收截止 {shortDate(selected.verificationDueAt||selected.dueAt)}</small></div><label className="development-action-comment">处理说明<textarea value={comment} onChange={event=>setComment(event.target.value)}/></label><footer><button className="secondary" onClick={()=>setSelected(null)}>取消</button><button className="primary" disabled={busy||comment.trim().length<5} onClick={submitAction}>{action.startsWith('verify')?<CheckCircle2 size={14}/>:<Send size={14}/>}确认提交</button></footer></section></div>}
  {commentCase&&<div className="development-modal-backdrop" onClick={()=>setCommentCase(null)}><section className="development-modal development-comment-modal" onClick={event=>event.stopPropagation()}><header><div><span>{commentCase.id} · 管理岗位节点评论</span><h2>{commentCase.title}</h2><p>{commentCase.employeeName} · {commentCase.team} · 当前{statusLabel[commentCase.status]}</p></div><button aria-label="关闭评论窗口" onClick={()=>setCommentCase(null)}><X size={19}/></button></header>
   <div className="development-comment-summary"><div><span>改善目标</span><strong>{commentCase.goal}</strong></div><div><span>验收标准</span><strong>{commentCase.successCriteria||commentCase.goal}</strong></div><div><span>时间要求</span><strong>员工提交 {shortDate(commentCase.dueAt)} · 验收 {shortDate(commentCase.verificationDueAt||commentCase.dueAt)}</strong></div></div>
   <div className="development-comment-nodes">{([['plan','P','目标设定'],['execute','D','员工执行'],['verify','C','发起人验收'],['close','A','闭环固化']] as [DevelopmentCommentNode,string,string][]).map(([code,phase,label])=><button className={commentNode===code?'active':''} onClick={()=>setCommentNode(code)} key={code}><b>{phase}</b><span>{label}</span><em>{(commentCase.comments||[]).filter(item=>item.nodeCode===code).length}条评论</em></button>)}</div>
   <div className="development-comment-history">{(commentCase.comments||[]).filter(item=>item.nodeCode===commentNode).length?(commentCase.comments||[]).filter(item=>item.nodeCode===commentNode).map(entry=><article key={entry.id}><span>{entry.actor[0]}</span><div><strong>{entry.actor} · {roleLabel[entry.role]}</strong><p>{entry.content}</p><time>{shortDate(entry.createdAt)}</time></div></article>):<p>当前节点暂无管理评论。</p>}</div>
   <label className="development-action-comment">在“{({plan:'目标设定',execute:'员工执行',verify:'发起人验收',close:'闭环固化'} as Record<DevelopmentCommentNode,string>)[commentNode]}”节点发表评论<textarea value={managementComment} onChange={event=>setManagementComment(event.target.value)} placeholder="写明判断依据、管理建议或需要关注的风险，评论不会改变任务当前责任人。"/></label>
   <footer><button className="secondary" onClick={()=>setCommentCase(null)}>取消</button><button className="primary" disabled={busy||managementComment.trim().length<5} onClick={()=>void submitComment()}><MessageSquareText size={14}/>提交节点评论</button></footer>
  </section></div>}
 </div>
}
