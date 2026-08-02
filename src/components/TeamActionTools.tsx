import { useEffect, useMemo, useState } from 'react'
import { TeamAttributionMember, TeamAttributionResult, aiApi } from '../data/aiApi'
import { WorkflowMutationResult } from '../data/workflowApi'
import { Role } from '../types'
import { AlertTriangle, Bot, CheckCircle2, RefreshCw, Sparkles, Target, TrendingDown, X } from './Icons'
import { TaskRequestDialog, TaskRequestPrefill } from './LeanPdcaFeatures'

export type TeamActionMember=TeamAttributionMember&{stage:string;dataDate:string}
type Runner=(action:()=>Promise<WorkflowMutationResult>,success:string)=>boolean|void|Promise<boolean|void>

const defaultOwners:Record<string,string>={manager:'吴欣欣（客服经理）',supervisor:'前台客服主管',leader:'张伟（班长）',employee:'客服专员'}
const targetRoleFor=(role:Role)=>role==='director'?'manager':role==='manager'?'supervisor':role==='supervisor'?'leader':'employee'
const numberText=(value:number|null,unit='')=>value==null?'待接入':`${value.toLocaleString('zh-CN',{maximumFractionDigits:2})}${unit}`
const metricGap=(member:TeamActionMember)=>{
 const actual=member.responses.actual,target=member.responses.target
 return actual==null||target==null?null:Number((actual-target).toFixed(2))
}
const riskScore=(member:TeamActionMember)=>{
 const gap=metricGap(member)
 return gap==null?0:gap
}

const taskPrefill=(member:TeamActionMember,role:Role,analysis?:TeamAttributionResult|null):TaskRequestPrefill=>{
 const gap=metricGap(member),targetRole=targetRoleFor(role)
 const gapText=gap==null?'当前产能与目标差值待确认':`人工应答量较个人目标少${Math.abs(gap)}通`
 const recommendations=analysis?.recommendations.join('；')||'核对出勤时长、通话可利用率、ATT和ACW，按小时追踪改善结果。'
 return {
  targetRole,owner:targetRole==='employee'?`${member.name}（客服专员）`:defaultOwners[targetRole],
  title:`${member.name}产能Gap改善任务`,issueCategory:'产能效率',
  issueLocation:`${member.team} / ${member.name} ${member.jobNo}`,
  problem:`${gapText}。需依据Shapley归因结果，从出勤时长、通话可利用率、ATT和ACW定位具体影响因素。`,
  target:`${member.name}人工应答量提升至不低于${member.responses.target??'个人目标'}通`,
  successCriteria:`系统验证人工应答量达到${member.responses.target??'个人目标'}通，并同步核对出勤时长、通话可利用率、ATT和ACW是否回到个人目标。`,
  actionPlan:recommendations,
  metricCode:'responses',metricLabel:'人工应答量',metricUnit:'通',metricDirection:'higher',
  baselineValue:member.responses.actual??0,targetValue:member.responses.target??0,
  aiRationale:analysis?.aiNarrative||'',employeeCode:member.jobNo,employeeName:member.name,team:member.team,
  metricSet:[
   {code:'responses',label:'人工应答量',unit:'通',direction:'higher',baseline:member.responses.actual,target:member.responses.target,required:true},
   {code:'work_hours',label:'出勤时长',unit:'h',direction:'higher',baseline:member.workHours.actual,target:member.workHours.target,required:true},
   {code:'utilization',label:'通话可利用率',unit:'%',direction:'higher',baseline:member.utilization.actual,target:member.utilization.target,required:true},
   {code:'att',label:'ATT',unit:'s',direction:'lower',baseline:member.talkTime?.actual??null,target:member.talkTime?.target??null,required:true},
   {code:'acw',label:'ACW',unit:'s',direction:'lower',baseline:member.afterCall?.actual??null,target:member.afterCall?.target??null,required:true},
  ],
 }
}

export default function TeamActionTools({members,role,busy,run,notify,request}:{members:TeamActionMember[];role:Role;busy:boolean;run:Runner;notify:(text:string)=>void;request?:{jobNo:string;mode:'analysis'|'task';version:number}|null}){
 const initialJobNo=useMemo(()=>[...members].sort((a,b)=>riskScore(a)-riskScore(b))[0]?.jobNo||'',[members])
 const [selectedJobNo,setSelectedJobNo]=useState(initialJobNo)
 const [analysisOpen,setAnalysisOpen]=useState(false)
 const [taskOpen,setTaskOpen]=useState(false)
 const [analysis,setAnalysis]=useState<TeamAttributionResult|null>(null)
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 const selected=members.find(member=>member.jobNo===selectedJobNo)||members[0]
 useEffect(()=>{if(!selectedJobNo&&initialJobNo)setSelectedJobNo(initialJobNo)},[initialJobNo,selectedJobNo])
 useEffect(()=>{
  if(!request||!members.some(member=>member.jobNo===request.jobNo))return
  setSelectedJobNo(request.jobNo);setAnalysis(null);setError('')
  if(request.mode==='analysis')setAnalysisOpen(true)
  else setTaskOpen(true)
 },[request?.version])
 const analyze=async()=>{
  if(!selected)return
  setLoading(true);setError('');setAnalysis(null)
  try{
   const result=await aiApi.teamAttribution(role,selected)
   setAnalysis(result)
  }catch(reason){setError(reason instanceof Error?reason.message:'归因分析失败，请稍后重试')}
  finally{setLoading(false)}
 }
 useEffect(()=>{if(analysisOpen)void analyze()},[analysisOpen,selectedJobNo])
 const createFromAnalysis=()=>{setAnalysisOpen(false);setTaskOpen(true)}
 if(!members.length)return null
 return <>
  <div className="team-action-buttons">
   <span>{selected?.name||'请选择员工'}</span>
   <button className="secondary" type="button" onClick={()=>setAnalysisOpen(true)}><Sparkles size={16}/>归因分析</button>
   <button className="primary" type="button" onClick={()=>setTaskOpen(true)}><Target size={16}/>创建任务单</button>
  </div>
  {taskOpen && selected && (
    <TaskRequestDialog role={role} busy={busy} run={run} notify={notify} initial={taskPrefill(selected,role,analysis)} close={()=>setTaskOpen(false)}/>
  )}
  {analysisOpen&&selected&&<div className="team-attribution-shade" onMouseDown={()=>setAnalysisOpen(false)}><section className="team-attribution-dialog" role="dialog" aria-modal="true" aria-labelledby="team-attribution-title" onMouseDown={event=>event.stopPropagation()}>
   <header><div><span><Bot size={16}/>AI · Shapley产能归因</span><h2 id="team-attribution-title">从接听量Gap拆到每个过程指标</h2><p>统一使用Shapley引擎计算出勤时长、通话可利用率、ATT和ACW对接听量的影响。</p></div><button aria-label="关闭归因分析" onClick={()=>setAnalysisOpen(false)}><X size={19}/></button></header>
   <div className="team-attribution-toolbar"><label>分析员工<select aria-label="选择归因分析员工" value={selected.jobNo} onChange={event=>setSelectedJobNo(event.target.value)}>{members.map(member=><option value={member.jobNo} key={member.jobNo}>{member.name} · {member.jobNo} · Gap {metricGap(member)??'待确认'}通</option>)}</select></label><div><small>数据日期</small><strong>{selected.dataDate||'待确认'}</strong></div><button disabled={loading} onClick={analyze}><RefreshCw className={loading?'spin':''} size={15}/>重新分析</button></div>
   {loading?<div className="team-attribution-loading"><Sparkles size={28}/><h3>正在运行Shapley归因</h3><p>计算全部指标组合，并汇总每个过程指标的平均边际贡献</p></div>:error?<div className="team-attribution-error"><AlertTriangle size={19}/><div><strong>归因分析未完成</strong><p>{error}</p></div></div>:analysis&&<div className="team-attribution-body">
    <section className="attribution-formula"><div><span>目标产能公式</span><strong>{analysis.formula}</strong><small>{analysis.utilizationFormula}</small></div><div className="attribution-kpis"><article><span>实际产能</span><strong>{numberText(analysis.calculation.responseActual,'通')}</strong></article><article><span>个人目标</span><strong>{numberText(analysis.calculation.responseTarget,'通')}</strong></article><article className={(analysis.calculation.responseGap??0)<0?'risk':'met'}><span>产能Gap</span><strong>{numberText(analysis.calculation.responseGap,'通')}</strong></article><article><span>公式复算</span><strong>{numberText(analysis.calculation.formulaActual,'通')}</strong></article></div></section>
    <section className="attribution-drivers"><header><div><span>Shapley影响分解</span><h3>各过程指标对接听量的影响</h3></div><small>各项影响之和 = 公式复算Gap；结果不受指标排列顺序影响</small></header><div>{analysis.drivers.map((driver,index)=><article className={driver.status} key={driver.code}><b>{String(index+1).padStart(2,'0')}</b><div><span>{driver.label}</span><strong>{numberText(driver.actual,driver.unit)}</strong><small>目标 {numberText(driver.target,driver.unit)} · Gap {numberText(driver.gap,driver.unit)} · 贡献度 {driver.contributionRate??'—'}%</small><p>{driver.evidence}</p></div><em>{driver.impactCalls==null?'待核算':`${driver.impactCalls>0?'+':''}${driver.impactCalls}通`}</em></article>)}</div></section>
    <section className="attribution-ai"><header><span><Sparkles size={17}/></span><div><strong>{analysis.provider==='DeepSeek'?'DeepSeek归因解读':'Shapley引擎归因结论'}</strong><small>{analysis.model}{analysis.warning?' · AI不可用时已自动降级':''}</small></div></header><p>{analysis.aiNarrative}</p><div>{analysis.recommendations.map(item=><span key={item}><CheckCircle2 size={14}/>{item}</span>)}</div></section>
   </div>}
   <footer><div><TrendingDown size={15}/><span>结果用于管理判断，创建任务前仍可调整目标、责任人和时限。</span></div><button className="secondary" onClick={()=>setAnalysisOpen(false)}>关闭</button><button className="primary" disabled={!analysis} onClick={createFromAnalysis}><Target size={15}/>基于归因创建任务单</button></footer>
  </section></div>}
 </>
}
