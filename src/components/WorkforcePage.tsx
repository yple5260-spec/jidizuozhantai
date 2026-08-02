import { useMemo,useState } from 'react'
import { AlertTriangle,CalendarDays,CheckCircle2,ChevronRight,Clock3,Database,Plus,RefreshCw,ShieldCheck,Users,X } from './Icons'
import { WorkforceRequest,WorkforceRequestKind,WorkflowState,workflowApi } from '../data/workflowApi'
import { Role } from '../types'
import { RealDataState } from '../data/realDataApi'

const kindLabel:Record<WorkforceRequestKind,string>={
 shift_change:'调班申请',leave:'请假申请',attendance_exception:'考勤异常',cross_team_dispatch:'跨班调度',
}
const statusLabel:Record<string,string>={
 leader_pending:'待班长初审',supervisor_pending:'待主管确认',manager_pending:'待经理审批',hrbp_pending:'待HRBP备案',closed:'已生效',rejected:'未通过',
}
const shortDate=(value:string)=>new Date(`${value}T00:00:00`).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit',weekday:'short'})
const shortTime=(value:string)=>new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
const nextDate=()=>new Date(Date.now()+24*60*60*1000).toISOString().slice(0,10)
const employeeInsights:Record<string,{score:number;level:'标杆'|'稳定'|'潜力'|'重点关注';today:'在线'|'通话中'|'小休'|'培训';summary:string;action:string}>={
 JR10913:{score:76,level:'重点关注',today:'小休',summary:'产能连续下滑，小休占比偏高；服务态度稳定。',action:'今日完成一次目标面谈，午后复核小休与产能。'},
 JR11005:{score:82,level:'潜力',today:'在线',summary:'新人学习速度快，一次解决率仍低于成长线。',action:'安排2通争议案例复盘，班后确认掌握情况。'},
 JR10776:{score:93,level:'标杆',today:'通话中',summary:'产能、满意度均稳定达标，可承担同伴辅导。',action:'授权带教孙雷，班后反馈一次解决辅导结果。'},
 JR10381:{score:88,level:'稳定',today:'培训',summary:'整体达标，投诉协同能力突出，近期波动较小。',action:'完成今日规范培训，晚班关注高峰接通表现。'},
}

export default function WorkforcePage({role,state,error,busy,run,realData}:{role:Role;state:WorkflowState|null;error:string;busy:boolean;run:(action:()=>Promise<WorkflowState>,success:string)=>void;realData:RealDataState|null}){
 const [formOpen,setFormOpen]=useState(false)
 const [selectedId,setSelectedId]=useState('')
 const [comment,setComment]=useState('')
 const [kind,setKind]=useState<WorkforceRequestKind>(role==='employee'?'shift_change':role==='leader'?'attendance_exception':'cross_team_dispatch')
 const [employeeId,setEmployeeId]=useState('')
 const [date,setDate]=useState(nextDate())
 const [fromTeam,setFromTeam]=useState('普通客服一区·6班')
 const [toTeam,setToTeam]=useState('普通客服一区·4班')
 const [detail,setDetail]=useState('')
 const [leaderFilter,setLeaderFilter]=useState<'all'|'attention'>('all')
 const workforce=state?.workforce
 const employees=workforce?.employees||[]
 const requests=workforce?.requests||[]
 const coverage=workforce?.coverage||[]
 const leaderTeam=employees.find(item=>item.role==='leader'&&item.name==='张伟')?.team||employees.find(item=>item.role==='leader')?.team||employees.find(item=>item.role==='employee')?.team||'普通客服一区·8班'
 const teamEmployees=employees.filter(item=>item.role==='employee'&&item.team===leaderTeam)
 const teamEmployeeIds=new Set(teamEmployees.map(item=>item.id))
 const displayRequests=role==='leader'?requests.filter(item=>item.fromTeam===leaderTeam||teamEmployeeIds.has(item.employeeId)||item.ownerRole==='leader'):requests
 const visibleCoverage=role==='leader'?coverage.filter(item=>item.team===leaderTeam):coverage
 const canCreate=['employee','leader','supervisor'].includes(role)
 const currentKind:WorkforceRequestKind=role==='employee'?kind:role==='leader'?'attendance_exception':'cross_team_dispatch'
 const selected=displayRequests.find(item=>item.id===selectedId)||displayRequests.find(item=>item.ownerRole===role&&!['closed','rejected'].includes(item.status))||displayRequests[0]
 const teams=useMemo(()=>Array.from(new Set([...(coverage.map(item=>item.team)),...(employees.map(item=>item.team))])),[coverage,employees])
 const required=visibleCoverage.reduce((sum,item)=>sum+item.required,0)
 const onDuty=visibleCoverage.reduce((sum,item)=>sum+item.onDuty,0)
 const coverageRate=required?Math.round(onDuty/required*1000)/10:0
 const gap=Math.max(0,required-onDuty)
 const pending=displayRequests.filter(item=>!['closed','rejected'].includes(item.status)).length
 const rolePending=displayRequests.filter(item=>item.ownerRole===role&&!['closed','rejected'].includes(item.status)).length
 const shifts=workforce?.shifts||[]
 const attentionCount=teamEmployees.filter(item=>['重点关注','潜力'].includes(employeeInsights[item.jobNo]?.level)).length
 const roster=leaderFilter==='attention'?teamEmployees.filter(item=>['重点关注','潜力'].includes(employeeInsights[item.jobNo]?.level)):teamEmployees
 const copy:Record<Role,{eyebrow:string;title:string;desc:string}>={
  director:{eyebrow:'基地人力供需 · 经营视角',title:'人力是否匹配业务，是经营结果的前置指标',desc:'查看全域在岗覆盖、跨班调度和排班风险，重点事项由经理与HRBP闭环。'},
  manager:{eyebrow:'业务线人力治理',title:'先保证高峰有人，再平衡班组负荷',desc:'审批跨班组调度，跟踪覆盖缺口及主管排班动作，避免人力问题转化为服务指标问题。'},
  supervisor:{eyebrow:'现场供需调度',title:'哪个班缺人，现在就形成可审批的调度方案',desc:'按班组查看应需、排班和实到差距；跨班调度提交经理审批后同步相关班长。'},
  leader:{eyebrow:`${leaderTeam} · 今日人员雷达`,title:'人、班次和状态放在一张图里，班长先管好自己的班组',desc:'集中查看员工排班、入职周期、今日状态和平日表现，及时安排关注、辅导和考勤动作。'},
  employee:{eyebrow:'我的班次与申请',title:'排班看得见，调班请假有结果',desc:'查看个人班次，提交调班或请假申请；班长、主管和HRBP的处理进展全程可查。'},
  hrbp:{eyebrow:'人员合规与考勤档案',title:'业务确认完成后，HRBP把结果落到人员档案',desc:'统一接收已由班长和主管核实的排班考勤事项，完成备案并回传员工。'},
  quality:{eyebrow:'组织与排班',title:'当前岗位无排班管理职责',desc:'质检岗位可通过协同单与班长联动，无需处理人员排班数据。'},
  training:{eyebrow:'组织与排班',title:'当前岗位无排班管理职责',desc:'培训调整通过培训计划与主管调度协同，无需直接处理员工考勤。'},
 }
 if(error)return <div className="service-unavailable"><AlertTriangle size={34}/><h2>排班服务暂不可用</h2><p>{error}</p></div>
 if(!state||!workforce)return <div className="workflow-loading"><RefreshCw size={20}/><span>正在加载组织与排班数据...</span></div>

 const submit=()=>{
  const chosen=employeeId||employees.find(item=>item.role==='employee')?.id||''
  const defaults:Record<WorkforceRequestKind,string>={
   shift_change:'申请调整明日班次，已与同班组同事沟通互换，不影响高峰覆盖。',
   leave:'因个人事项申请请假，已提前告知班长并说明工作交接。',
   attendance_exception:'员工今日迟到，已核实到岗时间和原因，请主管确认考勤口径。',
   cross_team_dispatch:'高峰时段调入1名具备10015前台技能的员工，调出班组覆盖仍保持目标线以上。',
  }
  run(()=>workflowApi.createWorkforceRequest({role,kind:currentKind,employeeId:role==='supervisor'?'':chosen,fromTeam,toTeam,date,detail:detail.trim()||defaults[currentKind]}),`${kindLabel[currentKind]}已提交并进入跨岗位处理`)
  setFormOpen(false);setDetail('')
 }
 const act=(action:Parameters<typeof workflowApi.workforceRequestAction>[2],success:string,defaultComment:string)=>{
  if(!selected)return
  run(()=>workflowApi.workforceRequestAction(selected.id,role,action,comment.trim()||defaultComment),success)
  setComment('')
 }
 const actionPanel=(request:WorkforceRequest)=>{
  if(request.ownerRole!==role||['closed','rejected'].includes(request.status))return <small className="wf-view-tip">当前由 {request.owner} 处理，本岗位可查看进展。</small>
  if(role==='leader')return <><textarea value={comment} onChange={event=>setComment(event.target.value)} placeholder="填写人员互换、出勤影响和班组覆盖核实结论"/><div className="wf-action-buttons"><button className="secondary" disabled={busy} onClick={()=>act('leader_reject','申请已由班长驳回','人员或覆盖条件暂不满足')}>不通过</button><button className="primary" disabled={busy} onClick={()=>act('leader_approve','班长初审通过，已提交主管确认','人员和班组覆盖已核实，同意提交主管确认')}>初审通过</button></div></>
  if(role==='supervisor')return <><textarea value={comment} onChange={event=>setComment(event.target.value)} placeholder="填写业务覆盖、技能承接和考勤口径确认结论"/><div className="wf-action-buttons"><button className="secondary" disabled={busy} onClick={()=>act('supervisor_reject','事项已由主管驳回','业务覆盖或考勤依据不满足')}>退回</button><button className="primary" disabled={busy} onClick={()=>act('supervisor_approve','主管确认通过，已提交HRBP备案','业务承接不受影响，同意执行并提交HRBP备案')}>确认并送HRBP</button></div></>
  if(role==='manager')return <>{request.aiWarning&&<div className={`wf-ai-warning ${request.aiWarning.acknowledged?'acknowledged':''}`}><AlertTriangle size={19}/><div><strong>{request.aiWarning.acknowledged?'风险已知悉，审批权保留':'AI目标偏差提醒'}</strong><p>{request.aiWarning.message}</p><small>{request.aiWarning.impact}</small>{request.aiWarning.acknowledged&&<em>{request.aiWarning.acknowledgedBy} · {shortTime(request.aiWarning.acknowledgedAt)}</em>}</div>{!request.aiWarning.acknowledged&&<button className="secondary" disabled={busy} onClick={()=>act('manager_acknowledge_warning','风险提醒已知悉，可继续审批','已知悉AI目标偏差提醒')}>我已知悉</button>}</div>}<textarea value={comment} onChange={event=>setComment(event.target.value)} placeholder="填写跨班调度审批意见和执行要求"/><div className="wf-action-buttons"><button className="secondary" disabled={busy} onClick={()=>act('manager_reject','经理未批准调度方案','方案暂不执行，请主管重新平衡班组覆盖')}>不批准</button><button className="primary" disabled={busy||Boolean(request.aiWarning&&!request.aiWarning.acknowledged)} title={request.aiWarning&&!request.aiWarning.acknowledged?'知悉AI提醒后即可由经理审批':''} onClick={()=>act('manager_approve','经理已批准跨班调度','批准执行，主管负责通知两个班组并监控高峰指标')}>批准并执行</button></div></>
  if(role==='hrbp')return <><textarea value={comment} onChange={event=>setComment(event.target.value)} placeholder="填写排班系统、考勤档案和员工告知的备案结果"/><button className="primary" disabled={busy} onClick={()=>act('hrbp_file','HRBP已完成备案，排班事项正式生效','已同步排班与考勤档案，并向员工和班长回传结果')}>完成备案并生效</button></>
  return null
 }

 return <>
  <div className="page-head"><div><span>{copy[role].eyebrow}</span><h1>{copy[role].title}</h1><p>{copy[role].desc}</p></div>{canCreate&&<div className="page-actions"><button className="primary" onClick={()=>setFormOpen(true)}><Plus size={16}/>{role==='employee'?'发起调班/请假':role==='leader'?'登记考勤异常':'新建跨班调度'}</button></div>}</div>
  {realData&&<><div className="live-data-scope"><Database size={16}/><div><strong>排班与考勤已接入真实日考勤表</strong><span>数据截至 {realData.attendance.dataDate} · {realData.meta.warning}</span></div></div><section className="wf-summary live-attendance-summary"><article><span>真实员工记录</span><strong>{realData.attendance.summary.employeeCount}<small>人</small></strong><p>源表当日记录</p><em className="good">已连接</em></article><article><span>当日有排班</span><strong>{realData.attendance.summary.scheduled}<small>人</small></strong><p>按应出勤状态统计</p></article><article><span>全勤</span><strong>{realData.attendance.summary.fullWork}<small>人</small></strong><p>迟到 {realData.attendance.summary.late}人</p></article>{role==='employee'?<article><span>即时人力缺口</span><strong>{visibleCoverage.length?gap:'—'}{visibleCoverage.length?<small>人</small>:null}</strong><p>{required?`应需 ${required} · 实到 ${onDuty}`:'仅展示本人班次'}</p><em className={gap===0?'good':'risk'}>{gap?`${visibleCoverage.filter(item=>item.onDuty<item.required).length}个班组需动作`:'覆盖稳定'}</em></article>:<article><span>旷工信号</span><strong>{realData.attendance.summary.absent}<small>人</small></strong><p>只作管理提醒</p><em className={realData.attendance.summary.absent?'risk':'good'}>{realData.attendance.summary.absent?'需核实':'无异常'}</em></article>}</section></>}
  {role==='leader'?<section className="wf-summary wf-leader-summary">
   <article><span>本班组在岗覆盖</span><strong>{coverageRate||'—'}{coverageRate?<small>%</small>:null}</strong><p>应需 {required} · 实到 {onDuty}</p><em className={coverageRate>=95?'good':'risk'}>{coverageRate>=95?'目标达成':`缺口 ${gap}人`}</em></article>
   <article><span>本班组员工样本</span><strong>{teamEmployees.length}<small>人</small></strong><p>新人、适应期与成熟期</p><em className="good">只看 {leaderTeam.replace('普通客服一区·','')}</em></article>
   <article><span>潜力 / 重点员工</span><strong>{attentionCount}<small>人</small></strong><p>结合入职周期与平日表现</p><em className={attentionCount?'risk':'good'}>{attentionCount?'今日需动作':'状态稳定'}</em></article>
   <article><span>待班长处理</span><strong>{rolePending}<small>项</small></strong><p>调班、请假与考勤异常</p><em className={rolePending?'risk':'good'}>{rolePending?'按SLA处理':'已清零'}</em></article>
  </section>:role==='employee'?(realData?null:<section className="wf-summary"><article><span>真实员工记录</span><strong>—</strong><p>等待真实日考勤表</p></article><article><span>当日有排班</span><strong>—</strong><p>等待排班数据</p></article><article><span>全勤</span><strong>—</strong><p>等待考勤数据</p></article><article><span>即时人力缺口</span><strong>{visibleCoverage.length?gap:'—'}{visibleCoverage.length?<small>人</small>:null}</strong><p>{required?`应需 ${required} · 实到 ${onDuty}`:'仅展示本人班次'}</p><em className={gap===0?'good':'risk'}>{gap?`${visibleCoverage.filter(item=>item.onDuty<item.required).length}个班组需动作`:'覆盖稳定'}</em></article></section>):<section className="wf-summary">
   <article><span>今日在岗覆盖</span><strong>{coverageRate||'—'}{coverageRate?<small>%</small>:null}</strong><p>管理目标 ≥95%</p><em className={coverageRate>=95?'good':'risk'}>{coverageRate?`${coverageRate>=95?'达标':'Gap'} ${(coverageRate-95).toFixed(1)}pp`:'个人视图'}</em></article>
   <article><span>即时人力缺口</span><strong>{visibleCoverage.length?gap:'—'}{visibleCoverage.length?<small>人</small>:null}</strong><p>{required?`应需 ${required} · 实到 ${onDuty}`:'仅展示本人班次'}</p><em className={gap===0?'good':'risk'}>{gap?`${visibleCoverage.filter(item=>item.onDuty<item.required).length}个班组需动作`:'覆盖稳定'}</em></article>
   <article><span>流转中事项</span><strong>{pending}<small>项</small></strong><p>调班、请假、异常与调度</p><em className={pending?'risk':'good'}>{pending?'按SLA处理':'无积压'}</em></article>
   <article><span>待我处理</span><strong>{rolePending}<small>项</small></strong><p>以当前登录岗位为准</p><em className={rolePending?'risk':'good'}>{rolePending?'现在处理':'已清零'}</em></article>
  </section>}

  {role==='leader'&&<section className="panel wf-leader-roster"><header><div><span>本班组人员雷达 · {leaderTeam}</span><h2>今天谁在岗、怎么排、需要班长做什么</h2></div><div className="wf-roster-filters"><button className={leaderFilter==='all'?'active':''} onClick={()=>setLeaderFilter('all')}>全部员工 {teamEmployees.length}</button><button className={leaderFilter==='attention'?'active':''} onClick={()=>setLeaderFilter('attention')}>潜力 / 重点 {attentionCount}</button></div></header><div className="wf-roster-table"><div className="wf-roster-head"><span>员工 / 入职周期</span><span>今日状态</span><span>今日排班</span><span>平日表现综合评价</span><span>今日管理建议</span></div>{roster.map(employee=>{const insight=employeeInsights[employee.jobNo]||{score:85,level:'稳定' as const,today:'在线' as const,summary:'整体表现稳定，按目标持续跟进。',action:'保持日常目标复盘与现场关注。'};const shift=shifts.find(item=>item.employeeId===employee.id);return <article key={employee.id}><div className="wf-roster-person"><b>{employee.name.slice(0,1)}</b><span><strong>{employee.name}</strong><small>{employee.jobNo} · {employee.stage}</small></span></div><div><em className={`today ${insight.today}`}>{insight.today}</em><small>{employee.status==='active'?'出勤正常':'暂未到岗'}</small></div><div><strong>{shift?`${shift.shift} ${shift.start}—${shift.end}`:employee.currentShift}</strong><small>{shift?.status==='adjusted'?'班次已调整':shift?.status==='leave'?'已请假':'排班已确认'}</small></div><div className="wf-performance"><span><em className={insight.level}>{insight.level}</em><b>{insight.score}分</b></span><p>{insight.summary}</p></div><div className="wf-roster-action"><p>{insight.action}</p><button onClick={()=>{setEmployeeId(employee.id);setFormOpen(true)}}>登记异常</button></div></article>})}</div></section>}

  {role==='employee'&&<section className="panel wf-my-shifts"><header><div><span>个人排班</span><h2>未来班次与申请状态</h2></div><ShieldCheck size={20}/></header><div>{shifts.length?shifts.map(shift=><article key={shift.id}><CalendarDays size={19}/><div><strong>{shortDate(shift.date)} · {shift.shift}</strong><span>{shift.start}—{shift.end} · {shift.team}</span></div><em className={shift.status}>{shift.status==='confirmed'?'已确认':shift.status==='adjusted'?'已调整':'请假'}</em></article>):<p className="wf-empty-inline">当前账号尚未绑定人员主数据，请联系管理员补充工号映射。</p>}</div></section>}

  {visibleCoverage.length>0&&role!=='leader'&&<section className="panel wf-coverage"><header><div><span>目标导向 · 人力供需</span><h2>各班组应需、排班与实到差距</h2></div><em>{visibleCoverage.filter(item=>item.onDuty<item.required).length}个班组存在缺口</em></header><div className="wf-coverage-grid">{visibleCoverage.map(item=>{const rate=Math.round(item.onDuty/item.required*1000)/10;return <article className={rate>=item.targetCoverage?'good':'risk'} key={item.id}><header><strong>{item.team}</strong><span>负荷 {item.forecastLoad}%</span></header><div><b>{item.onDuty}/{item.required}</b><small>实到 / 应需</small></div><div className="wf-progress"><i style={{width:`${Math.min(100,rate)}%`}}/></div><footer><span>排班 {item.scheduled}人</span><em>{rate>=item.targetCoverage?'达标':`缺口 ${item.required-item.onDuty}人`}</em></footer></article>})}</div></section>}

  <div className="wf-main">
   <section className="panel wf-requests"><header><div><span>{role==='leader'?'本班组事项':'跨岗位流转'}</span><h2>排班考勤事项</h2></div><em>{displayRequests.length}项记录</em></header><div>{displayRequests.length?displayRequests.map(request=><button className={selected?.id===request.id?'selected':''} onClick={()=>setSelectedId(request.id)} key={request.id}><span className={`wf-kind ${request.kind}`}>{kindLabel[request.kind]}</span><div><strong>{request.title}</strong><small>{request.id} · {shortDate(request.date)} · {request.requester}</small></div><em className={request.status}>{statusLabel[request.status]}</em><ChevronRight size={15}/></button>):<div className="wf-empty-inline">当前数据范围没有排班考勤事项。</div>}</div></section>
   <section className="panel wf-detail">{selected?<><header><div><span>{kindLabel[selected.kind]} · {selected.id}</span><h2>{selected.title}</h2></div><em className={selected.status}>{statusLabel[selected.status]}</em></header><div className="wf-detail-meta"><div><span>当前责任岗位</span><strong>{selected.owner}</strong></div><div><span>事项日期</span><strong>{shortDate(selected.date)}</strong></div><div><span>涉及人员</span><strong>{selected.employeeName||'跨班组调度'}</strong></div><div><span>SLA截止</span><strong>{shortTime(selected.dueAt)}</strong></div></div>{selected.kind==='cross_team_dispatch'?<div className="wf-route wf-route-short"><span className="done">主管发起</span><i/><span className={selected.status==='closed'?'done':''}>经理审批</span><i/><span className={selected.status==='closed'?'done':''}>调度生效</span></div>:<div className="wf-route"><span className="done">员工/班长发起</span><i/><span className={['supervisor_pending','hrbp_pending','closed'].includes(selected.status)?'done':''}>班长/主管确认</span><i/><span className={['hrbp_pending','closed'].includes(selected.status)?'done':''}>HRBP备案</span><i/><span className={selected.status==='closed'?'done':''}>生效</span></div>}<div className="wf-description"><strong>事项说明</strong><p>{selected.detail}</p>{selected.toTeam&&<small>{selected.fromTeam} → {selected.toTeam}</small>}</div>{selected.result&&<div className={`wf-result ${selected.status}`}><CheckCircle2 size={18}/><div><strong>{selected.status==='rejected'?'未通过结论':'最终结果'}</strong><p>{selected.result}</p></div></div>}<div className="wf-actions">{actionPanel(selected)}</div><div className="wf-timeline"><strong>流转记录</strong>{selected.history.map((history,index)=><div key={index}><i/><span><time>{shortTime(history.at)}</time><b>{history.actor}</b><p>{history.action}</p></span></div>)}</div></>:<div className="wf-detail-empty"><Clock3 size={30}/><p>选择一项记录查看处理进展。</p></div>}</section>
  </div>

  {formOpen&&<div className="wf-modal-backdrop"><section className="wf-modal"><header><div><span>组织与排班</span><h2>{role==='employee'?'发起个人排班申请':role==='leader'?'登记班组考勤异常':'新建跨班组调度'}</h2></div><button onClick={()=>setFormOpen(false)}><X size={18}/></button></header><div className="wf-form">{role==='employee'&&<label>事项类型<select value={kind} onChange={event=>setKind(event.target.value as WorkforceRequestKind)}><option value="shift_change">调班申请</option><option value="leave">请假申请</option></select></label>}{role!=='supervisor'&&<label>员工<select value={employeeId} onChange={event=>setEmployeeId(event.target.value)}><option value="">请选择员工</option>{employees.filter(item=>item.role==='employee').map(employee=><option value={employee.id} key={employee.id}>{employee.name} · {employee.team}</option>)}</select></label>}{role==='supervisor'&&<div className="wf-form-row"><label>调出班组<select value={fromTeam} onChange={event=>setFromTeam(event.target.value)}>{teams.map(team=><option value={team} key={team}>{team}</option>)}</select></label><label>调入班组<select value={toTeam} onChange={event=>setToTeam(event.target.value)}>{teams.map(team=><option value={team} key={team}>{team}</option>)}</select></label></div>}<label>生效日期<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label>事实依据与安排<textarea value={detail} onChange={event=>setDetail(event.target.value)} placeholder={role==='supervisor'?'说明时段、调动人数、技能要求以及两个班组的覆盖变化':'说明原因、人员安排、工作交接及对业务覆盖的影响'}/></label><aside><ShieldCheck size={16}/><span>{role==='employee'?'将依次由班长初审、主管确认、HRBP备案后生效。':role==='leader'?'将由客服主管确认后进入HRBP考勤备案。':'将提交客服经理审批，批准后自动更新班组覆盖。'}</span></aside></div><footer><button className="secondary" onClick={()=>setFormOpen(false)}>取消</button><button className="primary" disabled={busy||!date||(role!=='supervisor'&&!employeeId)||(role==='supervisor'&&(!fromTeam||!toTeam||fromTeam===toTeam))} onClick={submit}>提交事项</button></footer></section></div>}
 </>
}
