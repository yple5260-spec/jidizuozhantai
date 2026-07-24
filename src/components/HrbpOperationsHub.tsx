import { useMemo, useState } from 'react'
import { BriefcaseBusiness, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardCheck, Clock3, FileBarChart, ListChecks, MessageSquareText, RefreshCw, ShieldCheck, UserPlus, Users } from './Icons'
import { LaborCase, PeopleInterview, PeopleLifecycle, StaffingPlan, WorkflowState, workflowApi } from '../data/workflowApi'

type Runner=(action:()=>Promise<WorkflowState>,success:string)=>void
type Tab='staffing'|'lifecycle'|'labor'|'cost'|'interviews'

const money=(value:number)=>`¥${(value/10000).toFixed(1)}万`
const shortDate=(value:string)=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'—'
const lifecycleStatus:Record<PeopleLifecycle['status'],string>={training_pending:'待培训通关',hrbp_preparing:'HRBP准备中',manager_pending:'待经理审批',hrbp_execute:'待HRBP执行',returned_hrbp:'退回补充',closed:'已生效'}
const laborStatus:Record<LaborCase['status'],string>={hrbp_todo:'待HRBP处理',hrbp_doing:'HRBP处理中',manager_pending:'待经理决策',manager_doing:'经理处理中',closed:'已关闭'}
const interviewStatus:Record<PeopleInterview['status'],string>={planned:'待访谈',completed:'已完成',followup_due:'待承诺回访',closed:'已归档'}

function StaffingPanel({plans,busy,run}:{plans:StaffingPlan[];busy:boolean;run:Runner}){
 const plan=plans[0]
 if(!plan)return <Empty text="当前数据范围没有编制招聘计划。"/>
 const [interviewed,setInterviewed]=useState(plan.interviewed)
 const [offers,setOffers]=useState(plan.offersAccepted)
 const [onboarded,setOnboarded]=useState(plan.onboarded)
 const funnel=[['招聘目标',plan.hiringTarget],['进入面试',plan.interviewed],['接收Offer',plan.offersAccepted],['实际到岗',plan.onboarded]]
 return <div className="people-staffing-grid">
  <section className="people-plan-card">
   <header><div><span>{plan.month} · {plan.project}</span><h3>编制与到岗目标</h3></div><em className={plan.status}>{plan.status==='manager_pending'?'待经理审批':plan.status==='returned_hrbp'?'退回补充':plan.status==='closed'?'已关闭':'执行中'}</em></header>
   <div className="people-kpis"><div><span>目标编制</span><strong>{plan.approvedHeadcount}</strong><small>在岗 {plan.activeHeadcount}</small></div><div><span>满足率</span><strong>{plan.actualOccupancy}%</strong><small>目标 ≥{plan.targetOccupancy}%</small></div><div><span>净缺口</span><strong>{plan.gap}</strong><small>人</small></div><div><span>到岗进度</span><strong>{plan.onboarded}/{plan.hiringTarget}</strong><small>{Math.round(plan.onboarded/plan.hiringTarget*100)}%</small></div></div>
   <div className="people-funnel">{funnel.map((item,index)=><div key={item[0]}><span>{item[0]}</span><i style={{width:`${Math.max(10,Number(item[1])/Math.max(plan.interviewed,plan.hiringTarget)*100)}%`}}></i><b>{item[1]}人</b>{index<funnel.length-1&&<ChevronRight size={14}/>}</div>)}</div>
   <div className="people-channels">{plan.channels.map(channel=><article key={channel.name}><strong>{channel.name}</strong><span>目标 {channel.target}</span><span>面试 {channel.interviewed}</span><b>Offer {channel.accepted}</b></article>)}</div>
  </section>
  <aside className="people-action-card">
   <header><span>招聘漏斗更新</span><h3>每次更新都对目标差距负责</h3></header>
   <label>进入面试<input type="number" min={offers} value={interviewed} onChange={event=>setInterviewed(Number(event.target.value))}/></label>
   <label>接收 Offer<input type="number" min={onboarded} max={interviewed} value={offers} onChange={event=>setOffers(Number(event.target.value))}/></label>
   <label>实际到岗<input type="number" min={plan.onboarded} max={offers} value={onboarded} onChange={event=>setOnboarded(Number(event.target.value))}/></label>
   {plan.managerComment&&<p className="people-manager-note"><MessageSquareText size={14}/>{plan.managerComment}</p>}
   <button className="secondary" disabled={busy||!['active','returned_hrbp'].includes(plan.status)} onClick={()=>run(()=>workflowApi.staffingAction(plan.id,'hrbp','update_pipeline',{interviewed,offersAccepted:offers,onboarded}),'招聘漏斗已更新')}><RefreshCw size={14}/>保存漏斗</button>
   <button className="primary" disabled={busy||!['active','returned_hrbp'].includes(plan.status)} onClick={()=>run(()=>workflowApi.staffingAction(plan.id,'hrbp','submit_gap_plan'),'补员方案已进入经理审批')}><ClipboardCheck size={14}/>提交经理审批</button>
   <small>关闭规则：在岗满足率达到 {plan.targetOccupancy}% 且编制缺口清零。</small>
  </aside>
 </div>
}

function LifecyclePanel({items,busy,run}:{items:PeopleLifecycle[];busy:boolean;run:Runner}){
 const [selectedId,setSelectedId]=useState(items.find(item=>item.status!=='closed')?.id||items[0]?.id||'')
 const selected=items.find(item=>item.id===selectedId)||items[0]
 if(!selected)return <Empty text="当前没有入转调离事项。"/>
 const completed=Object.values(selected.checklist).filter(Boolean).length
 const prepare=()=>run(()=>workflowApi.lifecycleAction(selected.id,'hrbp','prepare',{contract:true,medical:true,account:true,shift:true,team:true}),'办理清单已核验完成')
 return <div className="people-master-detail">
  <aside>{items.map(item=><button className={item.id===selected.id?'active':''} onClick={()=>setSelectedId(item.id)} key={item.id}><span className={`people-type ${item.type}`}>{item.type==='onboarding_batch'?'入':item.type==='transfer'?'调':'离'}</span><div><strong>{item.title}</strong><small>{item.id} · {item.type==='onboarding_batch'?(item.personCount?`${item.personCount}人`:'通关后确定'):`${item.personCount||1}人`}</small><em>{lifecycleStatus[item.status]}</em></div><ChevronRight size={15}/></button>)}</aside>
  <section>
   <header><div><span>{selected.id} · {selected.source}</span><h3>{selected.title}</h3><p>{selected.fromOrg} → {selected.toOrg} · {selected.effectiveDate}生效</p></div><em>{lifecycleStatus[selected.status]}</em></header>
   <div className="people-route"><span className={selected.status!=='training_pending'?'done':''}>培训/发起</span><i/><span className={completed===5?'done':''}>HRBP核验</span><i/><span className={['hrbp_execute','closed'].includes(selected.status)?'done':''}>经理审批</span><i/><span className={selected.status==='closed'?'done':''}>主数据生效</span></div>
   <p className="people-detail-text">{selected.detail}</p>
   <div className="people-checklist">{Object.entries(selected.checklist).map(([key,value])=><span className={value?'done':''} key={key}>{value?<CheckCircle2 size={14}/>:<Clock3 size={14}/>}{{contract:'合同/协议',medical:'体检/健康',account:'系统账号',shift:'排班',team:'班组承接'}[key]}</span>)}</div>
   {selected.result&&<div className="people-result"><CheckCircle2 size={18}/><p>{selected.result}</p></div>}
   {selected.managerComment&&<p className="people-manager-note"><MessageSquareText size={14}/>{selected.managerComment}</p>}
   <footer>
    {['hrbp_preparing','returned_hrbp'].includes(selected.status)&&<button className="secondary" disabled={busy} onClick={prepare}>一键完成资料核验</button>}
    {selected.status==='hrbp_preparing'&&<button className="primary" disabled={busy||completed<5} onClick={()=>run(()=>workflowApi.lifecycleAction(selected.id,'hrbp','submit_manager'),'人事事项已提交经理审批')}>提交经理审批</button>}
    {selected.status==='hrbp_execute'&&<button className="primary" disabled={busy} onClick={()=>run(()=>workflowApi.lifecycleAction(selected.id,'hrbp','complete'),'组织与人员主数据已更新')}>执行并生效</button>}
    {selected.status==='training_pending'&&<small>培训通关达标后，合格名单将自动转入HRBP准备环节。</small>}
   </footer>
  </section>
 </div>
}

function LaborPanel({items,busy,run}:{items:LaborCase[];busy:boolean;run:Runner}){
 const [selectedId,setSelectedId]=useState(items.find(item=>item.ownerRole==='hrbp'&&item.status!=='closed')?.id||items[0]?.id||'')
 const [result,setResult]=useState('已完成员工沟通、排班记录与制度条款核对，事实清晰并形成处理建议。')
 const selected=items.find(item=>item.id===selectedId)||items[0]
 if(!selected)return <Empty text="当前没有劳动关系事项。"/>
 return <div className="people-master-detail labor">
  <aside>{items.map(item=><button className={item.id===selected.id?'active':''} onClick={()=>setSelectedId(item.id)} key={item.id}><span className={`people-risk ${item.risk}`}>{item.risk==='high'?'高':item.risk==='medium'?'中':'低'}</span><div><strong>{item.title}</strong><small>{item.employeeName} · {item.team}</small><em>{laborStatus[item.status]}</em></div><ChevronRight size={15}/></button>)}</aside>
  <section><header><div><span>{selected.id} · {selected.employeeName}</span><h3>{selected.title}</h3><p>SLA {shortDate(selected.dueAt)} · 当前责任人 {selected.owner}</p></div><em>{laborStatus[selected.status]}</em></header><p className="people-detail-text">{selected.detail}</p>{selected.result&&<p className="people-manager-note"><MessageSquareText size={14}/>{selected.result}</p>}
   {selected.ownerRole==='hrbp'&&selected.status!=='closed'&&<div className="people-decision"><textarea value={result} onChange={event=>setResult(event.target.value)} placeholder="填写事实调查、制度依据和处理结论"/><div>{selected.status==='hrbp_todo'&&<button className="primary" disabled={busy} onClick={()=>run(()=>workflowApi.laborAction(selected.id,'hrbp','start'),'劳动关系事项已开始处理')}>开始处理</button>}{selected.status==='hrbp_doing'&&<><button className="secondary" disabled={busy||!result.trim()} onClick={()=>run(()=>workflowApi.laborAction(selected.id,'hrbp','close',result),'劳动关系事项已关闭')}>HRBP处理并关闭</button><button className="primary" disabled={busy||!result.trim()} onClick={()=>run(()=>workflowApi.laborAction(selected.id,'hrbp','escalate_manager',result),'事项已升级经理决策')}>升级经理决策</button></>}</div></div>}
   {selected.ownerRole==='manager'&&<div className="people-waiting"><Clock3 size={18}/><div><strong>等待运营经理处理</strong><p>经理将在PDCA的人事审批中接收并形成最终决策。</p></div></div>}
  </section>
 </div>
}

function CostPanel({state,busy,run}:{state:WorkflowState;busy:boolean;run:Runner}){
 const cost=state.people.costs[0]
 const [forecast,setForecast]=useState(cost?.forecast||0),[actual,setActual]=useState(cost?.actual||0)
 if(!cost)return <Empty text="当前没有人员成本计划。"/>
 const forecastRate=Math.round(cost.forecast/cost.budget*1000)/10
 return <div className="people-cost-grid">
  <section><header><span>{cost.month} · {cost.project}</span><h3>人员成本预算执行</h3></header><div className="cost-hero"><div><span>月末预测</span><strong>{money(cost.forecast)}</strong><em className={cost.gap>0?'risk':'good'}>{cost.gap>0?`预计超预算 ${money(cost.gap)}`:`预计节余 ${money(Math.abs(cost.gap))}`}</em></div><div className="cost-ring" style={{'--cost-rate':`${Math.min(forecastRate,100)}%`} as React.CSSProperties}><strong>{forecastRate}%</strong><span>预算使用</span></div></div><div className="people-kpis"><div><span>预算</span><strong>{money(cost.budget)}</strong></div><div><span>当前实际</span><strong>{money(cost.actual)}</strong></div><div><span>人均目标</span><strong>¥{cost.targetPerCapita}</strong></div><div><span>实际人均</span><strong>¥{cost.actualPerCapita}</strong></div></div><div className="cost-breakdown"><span>加班成本 <b>{money(cost.overtimeCost)}</b></span><span>招聘成本 <b>{money(cost.recruitmentCost)}</b></span></div></section>
  <aside className="people-action-card"><header><span>滚动预测</span><h3>发现超支，提前通知经理</h3></header><label>当前实际成本<input type="number" value={actual} onChange={event=>setActual(Number(event.target.value))}/></label><label>月末预测成本<input type="number" value={forecast} onChange={event=>setForecast(Number(event.target.value))}/></label><button className="primary" disabled={busy||forecast<actual} onClick={()=>run(()=>workflowApi.costAction(cost.id,forecast,actual),'人员成本预测已更新')}>更新预测并计算Gap</button><small>预测超过预算时，系统会自动向运营经理发送经营提醒。</small></aside>
 </div>
}

function InterviewsPanel({state,busy,run}:{state:WorkflowState;busy:boolean;run:Runner}){
 const items=state.people.interviews
 const [selectedId,setSelectedId]=useState(items.find(item=>item.status!=='closed')?.id||items[0]?.id||'')
 const [conclusion,setConclusion]=useState('员工当前工作状态稳定，核心诉求已确认；班长提供一周目标辅导，HRBP按计划回访。')
 const selected=items.find(item=>item.id===selectedId)||items[0]
 if(!selected)return <Empty text="当前没有员工访谈档案。"/>
 return <div className="people-master-detail interviews"><aside>{items.map(item=><button className={item.id===selected.id?'active':''} onClick={()=>setSelectedId(item.id)} key={item.id}><span className="people-type interview">访</span><div><strong>{item.employeeName} · {item.type==='probation'?'试用期':item.type==='retention'?'留任':'离职'}访谈</strong><small>{item.team}</small><em>{interviewStatus[item.status]}</em></div><ChevronRight size={15}/></button>)}</aside><section><header><div><span>{selected.id} · {selected.interviewer}</span><h3>{selected.employeeName}结构化访谈</h3><p>访谈 {shortDate(selected.scheduledAt)} · 回访 {shortDate(selected.followUpAt)}</p></div><em>{interviewStatus[selected.status]}</em></header>{selected.conclusion&&<p className="people-detail-text">{selected.conclusion}</p>}{selected.commitments.length>0&&<div className="people-commitments"><strong>双方承诺</strong>{selected.commitments.map(item=><span key={item}><CheckCircle2 size={14}/>{item}</span>)}</div>}{selected.status!=='closed'&&<div className="people-decision"><textarea value={conclusion} onChange={event=>setConclusion(event.target.value)}/><button className="primary" disabled={busy||!conclusion.trim()} onClick={()=>run(()=>workflowApi.interviewAction(selected.id,selected.status==='planned'?'complete':'close',conclusion,['班长连续一周提供目标辅导','HRBP按计划回访员工状态']),selected.status==='planned'?'访谈结论与承诺已归档':'承诺回访已完成')}>{selected.status==='planned'?'完成访谈并形成承诺':'完成回访并归档'}</button></div>}</section></div>
}

function Empty({text}:{text:string}){return <div className="people-empty"><Users size={28}/><p>{text}</p></div>}

export default function HrbpOperationsHub({state,busy,run}:{state:WorkflowState|null;busy:boolean;run:Runner}){
 const [tab,setTab]=useState<Tab>('staffing')
 if(!state)return <div className="people-loading"><RefreshCw size={18}/>正在读取人力运营状态…</div>
 const tabs=useMemo(()=>[
  {id:'staffing' as const,label:'编制招聘',icon:UserPlus,count:state.people.staffingPlans.filter(item=>item.status!=='closed').length},
  {id:'lifecycle' as const,label:'入转调离',icon:BriefcaseBusiness,count:state.people.lifecycle.filter(item=>item.status!=='closed').length},
  {id:'labor' as const,label:'劳动关系',icon:ShieldCheck,count:state.people.laborCases.filter(item=>item.status!=='closed').length},
  {id:'cost' as const,label:'人员成本',icon:CircleDollarSign,count:state.people.costs.filter(item=>item.gap>0).length},
  {id:'interviews' as const,label:'访谈档案',icon:FileBarChart,count:state.people.interviews.filter(item=>item.status!=='closed').length},
 ],[state.people])
 return <section className="panel people-operations-hub"><header><div><span>HRBP生产工作台 · 持久化流程</span><h2>组织供给、员工全周期与用工风险统一管理</h2><p>每项工作都有目标、Gap、当前责任人和跨岗位结果。</p></div><em>今日待办 {tabs.reduce((sum,item)=>sum+item.count,0)} 项</em></header><nav>{tabs.map(item=>{const Icon=item.icon;return <button className={tab===item.id?'active':''} onClick={()=>setTab(item.id)} key={item.id}><Icon size={16}/>{item.label}{item.count>0&&<b>{item.count}</b>}</button>})}</nav><div className="people-tab-body">{tab==='staffing'?<StaffingPanel plans={state.people.staffingPlans} busy={busy} run={run}/>:tab==='lifecycle'?<LifecyclePanel items={state.people.lifecycle} busy={busy} run={run}/>:tab==='labor'?<LaborPanel items={state.people.laborCases} busy={busy} run={run}/>:tab==='cost'?<CostPanel state={state} busy={busy} run={run}/>:<InterviewsPanel state={state} busy={busy} run={run}/>}</div></section>
}

export function ManagerPeopleApprovals({state,busy,run}:{state:WorkflowState;busy:boolean;run:Runner}){
 const staffing=state.people.staffingPlans.filter(item=>item.status==='manager_pending')
 const lifecycle=state.people.lifecycle.filter(item=>item.status==='manager_pending')
 const labor=state.people.laborCases.filter(item=>['manager_pending','manager_doing'].includes(item.status))
 const total=staffing.length+lifecycle.length+labor.length
 return <><div className="people-approval-head"><div><span>经理人事审批</span><h2>涉及编制、组织与劳动关系的事项，由经理做出明确决策</h2></div><em>{total}项待处理</em></div>{!total?<Empty text="当前没有待经理处理的人事事项。"/>:<div className="people-approval-list">
  {staffing.map(item=><article key={item.id}><span className="approval-icon"><UserPlus size={18}/></span><div><b>编制招聘</b><h3>{item.project}补员方案</h3><p>编制缺口{item.gap}人 · 招聘目标{item.hiringTarget}人 · 已到岗{item.onboarded}人</p></div><aside><button className="secondary" disabled={busy} onClick={()=>run(()=>workflowApi.staffingAction(item.id,'manager','manager_return',{comment:'请补充渠道周产出与到岗风险预案。'}),'补员方案已退回HRBP')}>退回</button><button className="primary" disabled={busy} onClick={()=>run(()=>workflowApi.staffingAction(item.id,'manager','manager_approve',{comment:'同意按渠道计划推进，每周复盘到岗与业务缺口。'}),'补员方案已批准')}>批准</button></aside></article>)}
  {lifecycle.map(item=><article key={item.id}><span className="approval-icon"><BriefcaseBusiness size={18}/></span><div><b>入转调离</b><h3>{item.title}</h3><p>{item.fromOrg} → {item.toOrg} · {item.effectiveDate}生效 · {item.type==='onboarding_batch'?(item.personCount?`${item.personCount}人`:'通关后确定人数'):`${item.personCount||1}人`}</p></div><aside><button className="secondary" disabled={busy} onClick={()=>run(()=>workflowApi.lifecycleAction(item.id,'manager','manager_return',{comment:'请补充员工确认与业务承接记录。'}),'人事事项已退回HRBP')}>退回</button><button className="primary" disabled={busy} onClick={()=>run(()=>workflowApi.lifecycleAction(item.id,'manager','manager_approve',{comment:'同意办理，请按生效日更新组织、账号和排班。'}),'人事事项已批准')}>批准</button></aside></article>)}
  {labor.map(item=><article key={item.id}><span className="approval-icon danger"><ShieldCheck size={18}/></span><div><b>劳动关系</b><h3>{item.title} · {item.employeeName}</h3><p>{item.detail}</p>{item.result&&<small>HRBP调查：{item.result}</small>}</div><aside>{item.status==='manager_pending'?<button className="primary" disabled={busy} onClick={()=>run(()=>workflowApi.laborAction(item.id,'manager','manager_start'),'经理已接收劳动关系事项')}>接收处理</button>:<button className="primary" disabled={busy} onClick={()=>run(()=>workflowApi.laborAction(item.id,'manager','close','已完成员工沟通与资源协调，按制度形成书面结论并回传HRBP备案。'),'劳动关系事项已关闭')}>形成结论并关闭</button>}</aside></article>)}
 </div>}</>
}
