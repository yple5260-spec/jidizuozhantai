import { useMemo, useState } from 'react'
import {
 AlertTriangle, ArrowUpRight, BarChart3, CalendarDays, CheckCircle2, ClipboardCheck, Clock3,
 FileBarChart, GraduationCap, MessageSquareText, Plus, RefreshCw, Send, ShieldCheck, Target, Users, X,
} from './Icons'
import {
 DevelopmentCase, DevelopmentRole, DevelopmentStatus, WorkflowState, workflowApi,
} from '../data/workflowApi'
import type { Role } from '../types'

type Notify=(text:string)=>void
type Props={role:Role;state:WorkflowState|null;setState:(state:WorkflowState)=>void;notify:Notify;employeeId:string}
type FormState={type:'training'|'interview';employeeId:string;responderRole:DevelopmentRole;title:string;reason:string;goal:string;dueAt:string}
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
 type:'training',employeeId,responderRole:'training',title:'申请专项业务训练与答疑',
 reason:'近期在续约边界场景中仍有判断疑问，希望结合真实案例获得针对性支持。',
 goal:'完成一次专项辅导并形成明确操作口径，后续抽查2通业务录音均无同类问题。',
 dueAt:futureLocal(28),
})
const fallbackEmployees=[
 {jobNo:'JR10776',name:'李倩',team:'普通客服一区·8班'},
 {jobNo:'JR10913',name:'王芳',team:'普通客服一区·8班'},
 {jobNo:'JR11005',name:'孙雷',team:'普通客服一区·8班'},
 {jobNo:'JR10381',name:'赵晨',team:'普通客服一区·8班'},
 {jobNo:'JR10822',name:'刘欣',team:'普通客服一区·8班'},
]

function DevelopmentHeader({role,counts,onCreate,notify}:{role:Role;counts:{active:number;verify:number;closed:number;training:number};onCreate?:()=>void;notify:Notify}){
 const employee=role==='employee',report=['manager','director'].includes(role)
 return <>
  <section className={`development-head ${employee?'employee':report?'report':''}`}>
   <div><span>{employee?'客服专员 · 仅本人可见':report?'组织学习健康度 · 管理驾驶舱':`${roleLabel[role]} · 组织培训与面谈工作台`}</span>
    <h1>{employee?'我的培训和面谈，每一项都有回执':report?'从培训与面谈看组织能力是否健康':'任何岗位都能发起，任何结果都必须验收'}</h1>
    <p>{employee?'查看本人收到的任务和主动发起的需求；执行结果回传发起岗位，自己发起的需求由自己最终验收。':report?'只看组织分布、闭环效率与风险，不下钻替代责任岗位执行。':'覆盖对应组织内的培训与面谈；责任人反馈结果后，严格按“谁发起谁验收”关闭。'}</p>
   </div>
   <aside><ShieldCheck size={18}/><span><b>闭环原则</b>发起人负责目标，责任人负责结果，发起人负责最终验收</span></aside>
   <footer>{onCreate&&<button className="primary" onClick={onCreate}><Plus size={15}/>{employee?'发起我的需求':'新建培训或面谈'}</button>}{report&&<button className="primary" onClick={()=>notify(`${roleLabel[role]}月度培训与面谈分析报告已生成`)}><FileBarChart size={15}/>生成分析报告</button>}</footer>
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

function CaseCard({item,role,onAction}:{item:DevelopmentCase;role:Role;onAction:(item:DevelopmentCase,action:ActionKind)=>void}){
 const canOwn=item.ownerRole===role
 const canVerify=item.verificationRole===role&&item.status==='pending_verification'
 return <article className={`development-case ${item.status}`}>
  <header><span className={item.type}>{item.type==='training'?<GraduationCap size={18}/>:<MessageSquareText size={18}/>}</span><div><small>{item.id} · {item.type==='training'?'培训任务':'面谈任务'}</small><h3>{item.title}</h3></div><em>{statusLabel[item.status]}</em></header>
  <div className="development-case-meta"><span><b>{item.employeeName}</b>{item.employeeId} · {item.team}</span><span><b>发起</b>{item.initiatorName}</span><span><b>响应</b>{item.responderName}</span><span><b>截止</b>{shortDate(item.dueAt)}</span></div>
  <div className="development-case-body"><div><span>事实与原因</span><p>{item.reason}</p></div><div><span>目标与验收标准</span><p>{item.goal}</p></div></div>
  <Flow status={item.status}/>
  {(item.acknowledgement||item.result||item.verificationComment)&&<div className="development-feedback">
   {item.acknowledgement&&<p><b>责任人回执</b>{item.acknowledgement}</p>}
   {item.result&&<p><b>执行结果</b>{item.result}</p>}
   {item.verificationComment&&<p><b>验收意见</b>{item.verificationComment}</p>}
  </div>}
  <footer><span><Clock3 size={13}/>更新 {shortDate(item.history[0]?.at||item.createdAt)} · 当前责任：{roleLabel[item.ownerRole]}</span><div>
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
  <section className="development-report-insight"><BarChart3 size={21}/><div><b>{role==='director'?'总监判断':'经理判断'}</b><p>培训任务占比高，说明当前改善以业务能力建设为主；建议重点盯住“执行结果已提交、发起人尚未验收”的任务，避免培训有动作无效果。</p></div><strong>{closed.length}/{cases.length}<small>闭环任务</small></strong></section>
 </>
}

export default function DevelopmentWorkHub({role,state,setState,notify,employeeId}:Props){
 const [tab,setTab]=useState<'all'|'mine'|'closed'>('all')
 const [createOpen,setCreateOpen]=useState(false)
 const [form,setForm]=useState<FormState>(()=>defaultForm(employeeId))
 const [selected,setSelected]=useState<DevelopmentCase|null>(null)
 const [action,setAction]=useState<ActionKind>('accept')
 const [comment,setComment]=useState('')
 const [busy,setBusy]=useState(false)
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
 const report=['manager','director'].includes(role)
 const canInitiate=['employee','leader','supervisor','quality','training','hrbp'].includes(role)
 const displayed=cases.filter(item=>tab==='closed'?item.status==='closed':tab==='mine'?(item.ownerRole===role||item.verificationRole===role)&&item.status!=='closed':item.status!=='closed')
 const run=async(work:()=>Promise<WorkflowState>,success:string)=>{
  if(busy)return
  setBusy(true)
  try{const next=await work();setState(next);notify(success)}catch(error){notify(error instanceof Error?error.message:'培训面谈流程处理失败')}finally{setBusy(false)}
 }
 const openCreate=()=>{
  const initial=defaultForm(employeeId)
  if(role!=='employee')initial.employeeId=employees[0]?.jobNo||employeeId
  setForm(initial);setCreateOpen(true)
 }
 const create=()=>{
  const responderRole=role==='employee'?form.responderRole:'employee'
  void run(()=>workflowApi.createDevelopmentCase({role:role as DevelopmentRole,...form,responderRole,dueAt:new Date(form.dueAt).toISOString()}),`已发起${form.type==='training'?'培训':'面谈'}，等待${roleLabel[responderRole]}回执`)
  setCreateOpen(false)
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
 return <div className="development-workbench">
  <DevelopmentHeader role={role} counts={counts} onCreate={canInitiate?openCreate:undefined} notify={notify}/>
  {report?<ReportView role={role} cases={cases} notify={notify}/>:<>
   <section className="development-tabs"><button className={tab==='all'?'active':''} onClick={()=>setTab('all')}><Users size={15}/>{role==='employee'?'我的全部任务':'组织进行中'}<b>{active}</b></button><button className={tab==='mine'?'active':''} onClick={()=>setTab('mine')}><ArrowUpRight size={15}/>待我处理<b>{cases.filter(item=>(item.ownerRole===role||item.verificationRole===role)&&item.status!=='closed').length}</b></button><button className={tab==='closed'?'active':''} onClick={()=>setTab('closed')}><CheckCircle2 size={15}/>已闭环<b>{closed}</b></button></section>
   {role==='employee'&&<section className="development-employee-rule"><Target size={18}/><div><b>我的边界很清楚</b><p>别人发给我的任务，我负责反馈执行结果；我主动发起的需求，由责任岗位回执，最终必须由我验收。</p></div></section>}
   <section className="development-case-list">{displayed.length?displayed.map(item=><CaseCard key={item.id} item={item} role={role} onAction={openAction}/>):<div className="development-empty"><CheckCircle2 size={34}/><h3>当前筛选下没有任务</h3><p>所有培训与面谈都已完成对应岗位处理。</p></div>}</section>
  </>}
  {createOpen&&<div className="development-modal-backdrop" onClick={()=>setCreateOpen(false)}><section className="development-modal" onClick={event=>event.stopPropagation()}><header><div><span>{role==='employee'?'员工主动需求':'组织培训与面谈发起单'}</span><h2>{role==='employee'?'选择责任岗位，说明你需要什么支持':'明确对象、问题、目标和验收标准'}</h2><p>创建后由责任岗位回执并反馈结果，最终回到发起岗位验收。</p></div><button aria-label="关闭发起单" onClick={()=>setCreateOpen(false)}><X size={19}/></button></header><div className="development-form-grid">
   <label>任务类型<select value={form.type} onChange={event=>setForm({...form,type:event.target.value as FormState['type']})}><option value="training">培训任务</option><option value="interview">面谈任务</option></select></label>
   {role!=='employee'&&<label>客服专员<select value={form.employeeId} onChange={event=>setForm({...form,employeeId:event.target.value})}>{employees.map(item=><option value={item.jobNo} key={item.jobNo}>{item.name} · {item.team}</option>)}</select></label>}
   {role==='employee'&&<label>责任岗位<select value={form.responderRole} onChange={event=>setForm({...form,responderRole:event.target.value as DevelopmentRole})}><option value="leader">客服班长</option><option value="supervisor">客服主管</option><option value="training">培训岗位</option><option value="quality">质检岗位</option><option value="hrbp">HRBP</option></select></label>}
   <label>完成时限<input type="datetime-local" value={form.dueAt} onChange={event=>setForm({...form,dueAt:event.target.value})}/></label>
   <label className="full">任务标题<input value={form.title} onChange={event=>setForm({...form,title:event.target.value})}/></label>
   <label className="full">事实与发起原因<textarea value={form.reason} onChange={event=>setForm({...form,reason:event.target.value})}/></label>
   <label className="full">目标与验收标准<textarea value={form.goal} onChange={event=>setForm({...form,goal:event.target.value})}/></label>
  </div><aside><ShieldCheck size={16}/>发起人不能把验收责任转给别人，任务关闭动作只对发起岗位开放。</aside><footer><button className="secondary" onClick={()=>setCreateOpen(false)}>取消</button><button className="primary" disabled={busy||!form.title.trim()||form.reason.trim().length<10||form.goal.trim().length<10} onClick={create}><Send size={14}/>发起并等待回执</button></footer></section></div>}
  {selected&&<div className="development-modal-backdrop" onClick={()=>setSelected(null)}><section className="development-modal compact" onClick={event=>event.stopPropagation()}><header><div><span>{selected.id} · {statusLabel[selected.status]}</span><h2>{action==='accept'?'接收任务并给出回执':action==='submit'?'反馈培训或面谈结果':action==='verify_success'?'由发起人完成最终验收':'退回责任岗位补充结果'}</h2><p>{selected.title}</p></div><button aria-label="关闭处理窗口" onClick={()=>setSelected(null)}><X size={19}/></button></header><div className="development-action-summary"><b>验收目标</b><p>{selected.goal}</p></div><label className="development-action-comment">处理说明<textarea value={comment} onChange={event=>setComment(event.target.value)}/></label><footer><button className="secondary" onClick={()=>setSelected(null)}>取消</button><button className="primary" disabled={busy||comment.trim().length<5} onClick={submitAction}>{action.startsWith('verify')?<CheckCircle2 size={14}/>:<Send size={14}/>}确认提交</button></footer></section></div>}
 </div>
}
