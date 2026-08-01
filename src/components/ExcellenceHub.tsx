import { useMemo, useState } from 'react'
import { Award, Bot, CheckCircle2, Headphones, Library, Mic2, Search, Sparkles, Target, Trophy, Users, X } from './Icons'
import { ExcellenceExperience, WorkflowState, workflowApi } from '../data/workflowApi'
import { Role } from '../types'

type Props={role:Role;state:WorkflowState|null;busy:boolean;run:(action:()=>Promise<WorkflowState>,success:string)=>void|boolean|Promise<void|boolean>;notify:(message:string)=>void}
type Tab='employees'|'experiences'|'recordings'|'phrases'

const formatDuration=(seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`
const gap=(actual:number,target:number)=>actual-target

export default function ExcellenceHub({role,state,busy,run,notify}:Props){
 const [tab,setTab]=useState<Tab>('employees')
 const [query,setQuery]=useState('续约承诺期重复来电')
 const [matching,setMatching]=useState(false)
 const [matches,setMatches]=useState<(ExcellenceExperience&{matchScore:number;matchedKeywords:string[]})[]>([])
 const [showRecording,setShowRecording]=useState(false)
 const [form,setForm]=useState({title:'',callId:'',employeeJobNo:'',employeeName:'',team:'',business:'',durationSeconds:300,qualityScore:95,targetScore:95,notes:'',phrase:'',aiPublished:true})
 const excellence=state?.excellence
 const ranked=useMemo(()=>[...(excellence?.employeeAchievements||[])].map(item=>({...item,achievementRate:item.target?item.actual/item.target*100:0})).sort((a,b)=>b.achievementRate-a.achievementRate||b.qualityScore-a.qualityScore||b.effectiveTaskCount-a.effectiveTaskCount),[excellence])
 const topCount=Math.max(1,Math.ceil(ranked.length*(excellence?.evaluation.topPercent||20)/100))
 const topIds=new Set(ranked.slice(0,topCount).map(item=>item.id))
 const metExperiences=(excellence?.experiences||[]).filter(item=>item.direction==='lower'?item.actual<=item.target:item.actual>=item.target)
 const aiCount=(excellence?.experiences||[]).filter(item=>item.aiPublished).length
 const canPublish=['director','manager','supervisor','quality','training'].includes(role)
 const publish=async(item:ExcellenceExperience)=>{await run(()=>workflowApi.excellenceExperienceAction(item.id,role as 'director'|'manager'|'supervisor'|'quality'|'training',item.aiPublished?'withdraw_ai':'publish_ai'),item.aiPublished?'已从AI经验库撤回':'已发布给AI，后续同类任务可自动匹配')}
 const searchMatches=async()=>{
  if(!query.trim())return notify('请输入任务问题、目标或关键词')
  setMatching(true)
  try{const result=await workflowApi.excellenceMatches(query);setMatches(result.matches);if(!result.matches.length)notify('当前没有匹配的已发布经验')}
  catch(error){notify(error instanceof Error?error.message:'AI匹配失败')}
  finally{setMatching(false)}
 }
 const submitRecording=async()=>{
  const ok=await run(()=>workflowApi.createExcellenceRecording({...form,role:'quality'}),'先进录音已入库，AI亮点与优秀话术已同步提炼')
  if(ok!==false){setShowRecording(false);setForm({...form,title:'',callId:'',employeeJobNo:'',employeeName:'',team:'',business:'',notes:'',phrase:''})}
 }
 if(!excellence)return <section className="excellence-empty">固化先进数据加载中…</section>
 return <section className="excellence-page">
  <header className="excellence-hero">
   <div><span className="eyebrow"><Sparkles size={14}/> DATA-DRIVEN EXCELLENCE</span><h1>固化先进</h1><p>从有效任务单和优秀录音中沉淀可量化、可验证、可复用的方法，让先进经验持续驱动下一张任务单。</p></div>
   <div className="excellence-rule"><Target size={22}/><div><small>评选与入库原则</small><strong>目标达成是唯一前提</strong><span>{excellence.evaluation.rule}</span></div></div>
  </header>
  <div className="excellence-kpis">
   <article><span><Trophy size={19}/></span><div><strong>{topCount}<small>人</small></strong><p>优秀员工 · 前{excellence.evaluation.topPercent}%</p></div></article>
   <article><span><CheckCircle2 size={19}/></span><div><strong>{metExperiences.length}<small>项</small></strong><p>量化达标经验</p></div></article>
   <article><span><Bot size={19}/></span><div><strong>{aiCount}<small>项</small></strong><p>AI 可调用经验</p></div></article>
   <article><span><Headphones size={19}/></span><div><strong>{excellence.recordings.length}<small>通</small></strong><p>先进录音</p></div></article>
  </div>
  <nav className="excellence-tabs">
   <button className={tab==='employees'?'active':''} onClick={()=>setTab('employees')}><Users size={16}/>优秀员工</button>
   <button className={tab==='experiences'?'active':''} onClick={()=>setTab('experiences')}><Library size={16}/>优秀经验</button>
   <button className={tab==='recordings'?'active':''} onClick={()=>setTab('recordings')}><Headphones size={16}/>先进录音库</button>
   <button className={tab==='phrases'?'active':''} onClick={()=>setTab('phrases')}><Mic2 size={16}/>优秀话术库</button>
  </nav>
  {tab==='employees'&&<div className="excellence-section">
   <div className="section-title"><div><span>01 / PEOPLE</span><h2>优秀员工 · 目标达成前 20%</h2><p>{excellence.evaluation.period}共评估 {ranked.length} 人，按目标达成率排序；至少需要 {excellence.evaluation.minimumEvidenceTasks} 张有效任务单作为证据。</p></div><em>TOP {topCount}</em></div>
   <div className="achievement-table"><div className="achievement-head"><span>排名 / 员工</span><span>班组</span><span>量化指标</span><span>目标 → 实际</span><span>目标 GAP</span><span>达成率</span><span>有效任务</span></div>{ranked.map((item,index)=>{const valueGap=gap(item.actual,item.target);return <div className={`achievement-row ${topIds.has(item.id)?'top':''}`} key={item.id}><span><b>{String(index+1).padStart(2,'0')}</b><i>{item.name.slice(0,1)}</i><div><strong>{item.name}</strong><small>{item.jobNo}{topIds.has(item.id)?' · 优秀员工':''}</small></div></span><span>{item.team}</span><span>{item.metric}</span><span><b>{item.target}{item.unit}</b><i>→</i><strong>{item.actual}{item.unit}</strong></span><span className={valueGap>=0?'positive':'negative'}>{valueGap>=0?'+':''}{valueGap.toFixed(1)}{item.unit}</span><span><strong>{item.achievementRate.toFixed(1)}%</strong><i><b style={{width:`${Math.min(item.achievementRate,115)/1.15}%`}}/></i></span><span>{item.effectiveTaskCount} 张</span></div>})}</div>
  </div>}
  {tab==='experiences'&&<div className="excellence-section">
   <div className="section-title"><div><span>02 / EXPERIENCE</span><h2>优秀经验 · 有效任务单举措沉淀</h2><p>每条经验保留任务来源、基线、目标、实际结果和验证证据；发布后进入 AI 自动匹配范围。</p></div><em>{aiCount}/{excellence.experiences.length} 已发布</em></div>
   <div className="experience-grid">{excellence.experiences.map(item=>{const change=item.direction==='lower'?item.baseline-item.actual:item.actual-item.baseline;const targetMet=item.direction==='lower'?item.actual<=item.target:item.actual>=item.target;return <article className="experience-card" key={item.id}><header><div><span>{item.category}</span><h3>{item.title}</h3></div><label className={!canPublish?'disabled':''}><input type="checkbox" disabled={!canPublish||busy} checked={item.aiPublished} onChange={()=>publish(item)}/><i></i><b>{item.aiPublished?'AI 已启用':'发布给 AI'}</b></label></header><div className="metric-flight"><span><small>基线</small><strong>{item.baseline}{item.unit}</strong></span><i>→</i><span><small>目标</small><strong>{item.target}{item.unit}</strong></span><i>→</i><span className={targetMet?'reached':''}><small>实际</small><strong>{item.actual}{item.unit}</strong></span><em>{targetMet?'已达标':'未达标'} · 改善 {change.toFixed(1)}{item.unit}</em></div><p>{item.actionSummary}</p><ol>{item.steps.map(step=><li key={step}>{step}</li>)}</ol><div className="evidence-strip"><CheckCircle2 size={15}/><span>{item.evidence.join('；')}</span></div><footer><span>来源任务 <b>{item.sourceTaskId}</b> · {item.sourceTaskTitle}</span><span>{item.ownerName} · {item.team}</span><span>{item.verifiedBy}验证 · AI调用 {item.invocationCount} 次</span></footer></article>})}</div>
   <div className="ai-match-box"><div><span><Bot size={19}/></span><div><strong>AI 经验匹配验证</strong><small>输入新任务的问题、目标或场景，系统只检索已发布且量化达标的经验。</small></div></div><div className="match-input"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchMatches()} placeholder="例如：续约承诺期导致重复来电"/><button disabled={matching} onClick={searchMatches}>{matching?'匹配中…':'开始匹配'}</button></div>{matches.length>0&&<div className="match-results">{matches.map(item=><button key={item.id} onClick={()=>notify(`可调用：${item.title}`)}><b>{item.matchScore}%</b><span><strong>{item.title}</strong><small>命中：{item.matchedKeywords.join('、')} · 已调用 {item.invocationCount} 次</small></span></button>)}</div>}</div>
  </div>}
  {tab==='recordings'&&<div className="excellence-section">
   <div className="section-title"><div><span>03 / RECORDINGS</span><h2>先进录音库 · 质检提供，全员查阅</h2><p>质检目标分是入库门槛，AI负责总结亮点并绑定可复用话术；客服专员可直接查阅学习。</p></div>{role==='quality'&&<button className="add-recording" onClick={()=>setShowRecording(true)}><Mic2 size={15}/>提交先进录音</button>}</div>
   <div className="recording-grid">{excellence.recordings.map(item=><article className="recording-card" key={item.id}><header><button title="演示数据未绑定原始音频" onClick={()=>notify('该演示记录保留录音编号和质检证据，生产环境接入录音平台后可播放')}><Headphones size={21}/></button><div><span>{item.business} · {formatDuration(item.durationSeconds)}</span><h3>{item.title}</h3><small>{item.callId}</small></div><em>{item.qualityScore}<small>/ {item.targetScore}分</small></em></header><p><Sparkles size={15}/><span>{item.aiSummary}</span></p><ul>{item.highlights.map(highlight=><li key={highlight}>{highlight}</li>)}</ul><footer><span>{item.employeeName} · {item.team}</span><span>{item.submittedBy}提供</span><b>{item.aiPublished?'已进入AI学习范围':'内部查阅'}</b></footer></article>)}</div>
  </div>}
  {tab==='phrases'&&<div className="excellence-section">
   <div className="section-title"><div><span>04 / PHRASES</span><h2>优秀话术库 · 从先进录音提炼</h2><p>每句话术均保留录音来源、使用场景和质检得分，不脱离证据单独传播。</p></div><em>{excellence.phrases.length} 条</em></div>
   <div className="phrase-grid">{excellence.phrases.map((item,index)=><article key={item.id}><span>{String(index+1).padStart(2,'0')}</span><div><div><em>{item.scenario}</em>{item.tags.map(tag=><i key={tag}>{tag}</i>)}</div><blockquote>“{item.text}”</blockquote><footer>来源 {item.sourceRecordingId} · {item.employeeName} · 质检 {item.qualityScore} 分 <b>已调用 {item.useCount} 次</b></footer></div></article>)}</div>
  </div>}
  {showRecording&&<div className="modal-backdrop"><div className="excellence-modal"><header><div><span>QUALITY CURATION</span><h2>提交先进录音</h2></div><button onClick={()=>setShowRecording(false)}><X size={18}/></button></header><div className="recording-form"><label><span>录音标题 *</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label><span>录音编号 *</span><input value={form.callId} onChange={e=>setForm({...form,callId:e.target.value})}/></label><label><span>员工姓名 *</span><input value={form.employeeName} onChange={e=>setForm({...form,employeeName:e.target.value})}/></label><label><span>员工工号</span><input value={form.employeeJobNo} onChange={e=>setForm({...form,employeeJobNo:e.target.value})}/></label><label><span>班组 *</span><input value={form.team} onChange={e=>setForm({...form,team:e.target.value})}/></label><label><span>业务场景 *</span><input value={form.business} onChange={e=>setForm({...form,business:e.target.value})}/></label><label><span>录音时长（秒）</span><input type="number" min="30" value={form.durationSeconds} onChange={e=>setForm({...form,durationSeconds:Number(e.target.value)})}/></label><label><span>质检分 / 目标分</span><div className="score-pair"><input type="number" value={form.qualityScore} onChange={e=>setForm({...form,qualityScore:Number(e.target.value)})}/><input type="number" value={form.targetScore} onChange={e=>setForm({...form,targetScore:Number(e.target.value)})}/></div></label><label className="full"><span>质检亮点说明 *（AI总结依据）</span><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><label className="full"><span>优秀话术（选填）</span><textarea value={form.phrase} onChange={e=>setForm({...form,phrase:e.target.value})}/></label></div><footer><label><input type="checkbox" checked={form.aiPublished} onChange={e=>setForm({...form,aiPublished:e.target.checked})}/>入库后发布给 AI</label><div><button className="secondary" onClick={()=>setShowRecording(false)}>取消</button><button className="primary" disabled={busy} onClick={submitRecording}>提交并提炼</button></div></footer></div></div>}
 </section>
}
