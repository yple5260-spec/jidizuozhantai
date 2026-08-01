import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bot, CalendarDays, CheckCircle2, Clock3, MessageSquareText, Send, Sparkles, Target, Users } from './Icons'
import { MorningBriefingSchedule, WorkflowState, workflowApi } from '../data/workflowApi'
import { Role } from '../types'

type Props={role:Role;state:WorkflowState;setState:(state:WorkflowState)=>void;notify:(text:string)=>void}
const teamOptions=['普通客服一区·2班','普通客服一区·4班','普通客服一区·5班','普通客服一区·6班','普通客服一区·8班']
const leaderByTeam:Record<string,string>={'普通客服一区·2班':'魏琳','普通客服一区·4班':'赵敏','普通客服一区·5班':'陈敏','普通客服一区·6班':'刘洋','普通客服一区·8班':'张伟'}
const dayLabel=(date:string)=>new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',weekday:'short'}).format(new Date(`${date}T00:00:00+08:00`))

export default function MorningBriefingHub({role,state,setState,notify}:Props){
 const data=state.morningBriefings
 const [busy,setBusy]=useState(false)
 const run=async(action:()=>Promise<WorkflowState>,message:string)=>{setBusy(true);try{setState(await action());notify(message)}catch(error){notify(error instanceof Error?error.message:'操作失败')}finally{setBusy(false)}}
 if(['director','manager'].includes(role))return <OversightView role={role as 'director'|'manager'} state={state} busy={busy} run={run}/>
 if(role==='supervisor')return <SupervisorView state={state} busy={busy} run={run}/>
 if(role==='employee')return <EmployeeView data={data}/>
 if(['quality','training'].includes(role))return <SuggestionView role={role as 'quality'|'training'} state={state} busy={busy} run={run}/>
 return null
}

function OversightView({role,state,busy,run}:{role:'director'|'manager';state:WorkflowState;busy:boolean;run:(action:()=>Promise<WorkflowState>,message:string)=>Promise<void>}){
 const data=state.morningBriefings,totalPlanned=data.teams.reduce((sum,item)=>sum+item.planned,0),totalHeld=data.teams.reduce((sum,item)=>sum+item.held,0)
 const avg=Math.round(data.teams.reduce((sum,item)=>sum+item.averageScore,0)/Math.max(1,data.teams.length)),help=data.teams.filter(item=>item.needsHelp).length
 return <div className="mb-hub"><header className="mb-page-head"><div><span>{role==='director'?'总监':'经理'}监督视角 · 不承担会议召开</span><h1>看各班组是否按计划召开、是否讲出质量</h1><p>以组织架构班组为最小统计单元，监督召开率、录音质量与帮扶闭环。</p></div><em>近7日滚动统计</em></header>
  <section className="mb-kpis"><article><span>计划召开</span><strong>{totalPlanned}<small>场</small></strong><p>覆盖 {data.teams.length} 个班组</p></article><article><span>实际召开</span><strong>{totalHeld}<small>场</small></strong><p>召开率 {Math.round(totalHeld/totalPlanned*100)}%</p></article><article><span>平均质量评分</span><strong>{avg}<small>分</small></strong><p>系统初评，支持质检复核</p></article><article className={help?'risk':''}><span>需要管理帮扶</span><strong>{help}<small>个班组</small></strong><p>低于80分或缺开</p></article></section>
  <section className="mb-team-board"><header><div><span>组织维度召开总结</span><h2>各班组近7日召开与质量评估</h2></div><div className="mb-legend"><i className="excellent"/>优秀 ≥90<i className="pass"/>达标 80—89<i className="risk"/>需帮扶 &lt;80</div></header>
   <div className="mb-team-head"><span>班组 / 班长</span><span>召开情况</span><span>质量评分</span><span>AI评估</span><span>管理动作</span></div>
   {data.teams.map(team=>{const rate=Math.round(team.held/team.planned*100);return <article key={team.team}><div><b>{team.team}</b><small>{team.leader} · {team.supervisor}</small></div><div className="mb-rate"><strong>{team.held}/{team.planned}场</strong><i><b style={{width:`${rate}%`}}/></i><small>{rate}%</small></div><div className={`mb-score ${team.averageScore>=90?'excellent':team.averageScore>=80?'pass':'risk'}`}><strong>{team.averageScore}</strong><span>最新 {team.latestScore}分</span></div><p>{team.diagnosis}</p><div>{team.needsHelp?<button disabled={busy} onClick={()=>void run(()=>workflowApi.morningHelpTask(role,team.team),`${team.team}帮扶任务已下发主管`)}><Send size={14}/>下发帮扶任务</button>:<span className="mb-no-help"><CheckCircle2 size={14}/>暂不需要帮扶</span>}</div></article>})}
  </section>
 </div>
}

function SupervisorView({state,busy,run}:{state:WorkflowState;busy:boolean;run:(action:()=>Promise<WorkflowState>,message:string)=>Promise<void>}){
 const data=state.morningBriefings,[selectedId,setSelectedId]=useState(data.schedules[0]?.id||'')
 const selected=data.schedules.find(item=>item.id===selectedId)||data.schedules[0]
 const [draft,setDraft]=useState<MorningBriefingSchedule|undefined>(selected)
 useEffect(()=>setDraft(selected),[selectedId,state.persistenceRevision])
 const pending=data.suggestions.filter(item=>item.status==='pending')
 const save=(issue:boolean)=>draft&&run(()=>workflowApi.morningScheduleAction(draft.id,'supervisor',issue?'issue':'save',{team:draft.team,leader:draft.leader,time:draft.time,title:draft.title,focus:draft.focus}),issue?'排期及重点已下发班长':'排期草稿已保存')
 return <div className="mb-hub"><header className="mb-page-head"><div><span>主管排期与内容下达</span><h1>把AI运行诊断，变成未来7天班前会重点</h1><p>主管制定内容与排期并下发班长；默认班组可直接选择，也可调整班组与班长。</p></div><em>{pending.length}条专业岗建议待研判</em></header>
  <section className="mb-ai-diagnosis"><Bot size={22}/><div><span>AI项目运行诊断</span><h2>未来一周优先压降重复来电，同时保持高峰接通率</h2><p>建议班前会连续强化续约“四步确认”、小时级产能校准、重点员工会后辅导；周中复盘录音评分与抽测结果。</p></div><b>已生成7天内容骨架</b></section>
  <div className="mb-supervisor-grid"><section className="mb-week"><header><div><span>未来7天</span><h2>班前会排期</h2></div><CalendarDays size={19}/></header>{data.schedules.map(item=><button className={item.id===selectedId?'active':''} key={item.id} onClick={()=>setSelectedId(item.id)}><time>{dayLabel(item.date)}<small>{item.time}</small></time><div><strong>{item.team}</strong><span>{item.title}</span></div><em className={item.status}>{item.status==='draft'?'草稿':item.status==='issued'?'已下发':'已召开'}</em></button>)}</section>
   {draft&&<section className="mb-editor"><header><div><span>重点下达</span><h2>{dayLabel(draft.date)}班前会内容</h2></div><em>{draft.source}</em></header><div className="mb-form-row"><label>召开班组<select value={draft.team} onChange={event=>setDraft({...draft,team:event.target.value,leader:leaderByTeam[event.target.value]})}>{teamOptions.map(team=><option key={team}>{team}</option>)}</select></label><label>责任班长<input value={draft.leader} onChange={event=>setDraft({...draft,leader:event.target.value})}/></label><label>召开时间<input type="time" value={draft.time} onChange={event=>setDraft({...draft,time:event.target.value})}/></label></div><label>会议主题<input value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></label><label>重点内容（每行一项）<textarea value={draft.focus.join('\n')} onChange={event=>setDraft({...draft,focus:event.target.value.split('\n').filter(Boolean)})}/></label><div className="mb-draft-focus">{draft.focus.map((item,index)=><span key={`${item}-${index}`}><b>{index+1}</b>{item}</span>)}</div><footer><button className="secondary" disabled={busy} onClick={()=>void save(false)}>保存草稿</button><button className="primary" disabled={busy||draft.status==='completed'} onClick={()=>void save(true)}><Send size={14}/>下发对应班长</button></footer></section>}
  </div>
  <section className="mb-suggestions-review"><header><div><span>质检 / 培训建议</span><h2>由主管决定是否纳入未来一周</h2></div><em>{pending.length}条待处理</em></header>{data.suggestions.map(item=><article key={item.id}><span className={item.sourceRole}>{item.sourceRole==='quality'?'质检':'培训'}</span><div><strong>{item.title}</strong><p>{item.content}</p><small>{item.targetTeam} · 建议日期 {item.proposedDate}</small></div>{item.status==='pending'?<div><button disabled={busy} onClick={()=>void run(()=>workflowApi.morningSuggestionAction(item.id,'reject','本周已有同类重点，暂不纳入'),`${item.title}已标记不采纳`)}>不采纳</button><button className="primary" disabled={busy} onClick={()=>void run(()=>workflowApi.morningSuggestionAction(item.id,'adopt','已纳入对应日期班前会重点'),`${item.title}已纳入排期`)}>采纳至排期</button></div>:<em className={item.status}>{item.status==='adopted'?'已采纳':'未采纳'}</em>}</article>)}</section>
 </div>
}

function EmployeeView({data}:{data:WorkflowState['morningBriefings']}){
 const bulletin=data.todayBulletin
 return <div className="mb-hub employee"><header className="mb-page-head"><div><span>员工只读视角 · 今日要点</span><h1>{bulletin.title}</h1><p>这里仅展示今天需要知道和执行的内容，无需签到、确认或进行其他操作。</p></div><em>{bulletin.date}</em></header><div className="mb-employee-grid"><section><header><Target size={20}/><div><span>今日目标</span><h2>收班前共同守住4条线</h2></div></header>{bulletin.targets.map(item=><p key={item}><CheckCircle2 size={15}/>{item}</p>)}</section><section><header><MessageSquareText size={20}/><div><span>今日执行要点</span><h2>听完就能直接照做</h2></div></header>{bulletin.points.map((item,index)=><p key={item}><b>{String(index+1).padStart(2,'0')}</b>{item}</p>)}</section><section className="business"><header><Sparkles size={20}/><div><span>业务更新</span><h2>今天统一采用的服务口径</h2></div></header><p>{bulletin.businessUpdate}</p><small>如遇边界场景，请先查询知识库或向班长升级，不自行解释未确认口径。</small></section></div></div>
}

function SuggestionView({role,state,busy,run}:{role:'quality'|'training';state:WorkflowState;busy:boolean;run:(action:()=>Promise<WorkflowState>,message:string)=>Promise<void>}){
 const tomorrow=useMemo(()=>{const date=new Date();date.setDate(date.getDate()+1);return date.toISOString().slice(0,10)},[])
 const [title,setTitle]=useState(role==='quality'?'续约服务口径专项提醒':'新人建单正反例练习'),[content,setContent]=useState(role==='quality'?'建议班前会统一复盘近期质检TOP问题，明确正确话术并安排会后抽测。':'建议安排新人完成一组正反例辨析，并由班长在首单进行字段校验。'),[team,setTeam]=useState('全部班组'),[date,setDate]=useState(tomorrow)
 const submit=async()=>{await run(()=>workflowApi.morningSuggestionCreate({role,title,content,targetTeam:team,proposedDate:date}),'建议已提交主管研判');setTitle('');setContent('')}
 return <div className="mb-hub"><header className="mb-page-head"><div><span>{role==='quality'?'质检':'培训'}专业建议</span><h1>把专业发现转成班前会建议，由主管决定是否采纳</h1><p>专业岗不直接修改主管排期；建议内容、目标班组和日期均留痕。</p></div><em>建议闭环</em></header><div className="mb-suggest-grid"><section className="mb-suggest-form"><header><div><span>发起新建议</span><h2>建议进入未来一周班前会</h2></div><Send size={18}/></header><label>建议标题<input value={title} onChange={event=>setTitle(event.target.value)}/></label><label>具体建议<textarea value={content} onChange={event=>setContent(event.target.value)}/></label><div><label>目标班组<select value={team} onChange={event=>setTeam(event.target.value)}><option>全部班组</option>{teamOptions.map(item=><option key={item}>{item}</option>)}</select></label><label>建议日期<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label></div><button className="primary" disabled={busy||title.length<4||content.length<10} onClick={()=>void submit()}><Send size={14}/>提交主管研判</button></section><section className="mb-suggest-history"><header><div><span>建议记录</span><h2>采纳状态与主管反馈</h2></div><em>{state.morningBriefings.suggestions.length}条</em></header>{state.morningBriefings.suggestions.length?state.morningBriefings.suggestions.map(item=><article key={item.id}><div><strong>{item.title}</strong><span className={item.status}>{item.status==='pending'?'待主管研判':item.status==='adopted'?'已采纳':'未采纳'}</span></div><p>{item.content}</p><small>{item.targetTeam} · {item.proposedDate}</small>{item.supervisorComment&&<em>主管反馈：{item.supervisorComment}</em>}</article>):<div className="mb-empty"><Clock3 size={24}/><p>暂无本岗位建议记录</p></div>}</section></div></div>
}
