import { useCallback,useEffect,useMemo,useState } from 'react'
import { AlertTriangle,CheckCircle2,ChevronRight,Clock3,Database,Download,FileBarChart,ListChecks,Play,RefreshCw,ShieldCheck,Table2 } from './Icons'
import { reportApi,MorningEmployee,ReportDefinition,ReportDownload,ReportPreview,ReportProject,ReportRun } from '../data/reportApi'
import { WorkflowTask } from '../data/workflowApi'

const formatBytes=(value:number)=>value<1024?`${value} B`:`${(value/1024).toFixed(1)} KB`
const formatTime=(value:string)=>new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})

export default function ReportsPage({role,actor,notify,workflowTasks,workflowBusy,createPdcaTask}:{role:string;actor:string;notify:(text:string)=>void;workflowTasks:WorkflowTask[];workflowBusy:boolean;createPdcaTask:(employee:MorningEmployee)=>Promise<void>}){
 const [projects,setProjects]=useState<ReportProject[]>([])
 const [reports,setReports]=useState<ReportDefinition[]>([])
 const [projectId,setProjectId]=useState('north-center-10015')
 const [reportType,setReportType]=useState('operations-daily')
 const [preview,setPreview]=useState<ReportPreview|null>(null)
 const [runs,setRuns]=useState<ReportRun[]>([])
 const [downloads,setDownloads]=useState<ReportDownload[]>([])
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [morningFilter,setMorningFilter]=useState('全部')
 const selectedProject=projects.find(item=>item.id===projectId)
 const selectedReport=reports.find(item=>item.id===reportType)
 const latestRun=runs[0]
 const morningRows=preview?.briefingRows?.filter(item=>morningFilter==='全部'||item.category===morningFilter)||[]
 const formatMorningMetric=(value:number|string|null|undefined,format:string)=>{if(value==null||value==='-')return '-';const number=Number(value);if(format==='percent')return `${(number*100).toFixed(2)}%`;if(format==='hours')return `${number.toFixed(1)}h`;if(format==='seconds')return `${number.toFixed(1)}s`;if(format==='decimal')return number.toFixed(2);return number.toLocaleString('zh-CN')}
 const morningStatus=(value:number|string|null|undefined,target:number|string|null|undefined,direction:'higher'|'lower')=>{if(value==null||target==null||value==='-'||target==='-')return null;const passed=direction==='higher'?Number(value)>=Number(target):Number(value)<=Number(target);return passed?'达成':'需关注'}

 const refreshHistory=useCallback(async()=>{
  const next=await reportApi.history(projectId,reportType);setRuns(next.runs);setDownloads(next.downloads.filter(item=>next.runs.some(run=>run.id===item.runId)))
 },[projectId,reportType])

 useEffect(()=>{reportApi.catalog().then(data=>{setProjects(data.projects);setReports(data.reports)}).catch(e=>setError(e.message))},[])
 useEffect(()=>{
  setBusy(true);setError('')
  Promise.all([reportApi.preview(projectId,reportType),reportApi.history(projectId,reportType)]).then(([nextPreview,nextHistory])=>{setPreview(nextPreview);setRuns(nextHistory.runs);setDownloads(nextHistory.downloads.filter(item=>nextHistory.runs.some(run=>run.id===item.runId)))}).catch(e=>setError(e.message)).finally(()=>setBusy(false))
 },[projectId,reportType])

 const run=async()=>{setBusy(true);try{await reportApi.run(projectId,reportType,actor,role);await refreshHistory();notify(`${selectedReport?.name}已生成并归档`)}catch(e){notify(e instanceof Error?e.message:'报表运行失败')}finally{setBusy(false)}}
 const download=async(item:ReportRun)=>{try{await reportApi.download(item,actor);window.setTimeout(()=>refreshHistory().catch(()=>{}),200);notify('报表已下载，下载留痕已保存')}catch(e){notify(e instanceof Error?e.message:'下载失败')}}
 const filteredDownloads=useMemo(()=>downloads.slice(0,8),[downloads])

 return <>
  <div className="page-head"><div><span>RPA数字员工 · 报表员</span><h1>从离线样本，到可追溯的报表生产线</h1><p>选择项目和报表，核对来源口径，生成真实CSV文件并保存运行与下载留痕。</p></div><div className="page-actions"><button className="primary" disabled={busy||!preview?.available} title={!preview?.available?'当前项目待配置数据适配器':'生成当前报表'} onClick={run}>{busy?<RefreshCw size={16}/>:<Play size={16}/>}运行当前报表</button></div></div>

  {error&&<div className="rpa-error"><AlertTriangle size={18}/><span>{error}</span><button onClick={()=>window.location.reload()}>重新加载</button></div>}

  <section className="rpa-projects">{projects.map(project=><button key={project.id} className={project.id===projectId?'active':''} onClick={()=>setProjectId(project.id)}><span>{project.shortName}</span><div><strong>{project.name}</strong><small>{project.description}</small></div><em className={project.runnable?'connected':'pending'}>{project.statusLabel}</em>{project.id===projectId&&<CheckCircle2 size={17}/>}</button>)}</section>

  <section className="rpa-reports">{reports.map(report=><button key={report.id} className={report.id===reportType?'active':''} onClick={()=>setReportType(report.id)}><FileBarChart size={20}/><div><strong>{report.name}</strong><small>{report.description}</small><time><Clock3 size={12}/>{report.schedule}</time></div></button>)}</section>

  {preview&&<>
   <section className={`rpa-source ${preview.available?'ready':'waiting'}`}><div className="rpa-source-icon">{preview.available?<Database size={23}/>:<ShieldCheck size={23}/>}</div><div><span>{preview.available?'来源快照与新鲜度':'项目适配状态'}</span><h2>{preview.available?`${selectedProject?.name} · 数据截至 ${preview.source?.reportDate}`:`${selectedProject?.name} · 待接数据`}</h2><p>{preview.available?`${preview.source?.workbooks.join('、')} · ${preview.source?.modeLabel} · 运行时不打开或重算原工作簿`:preview.integrationMessage}</p>{preview.available&&<div>{preview.source?.sheets.map(sheet=><b key={sheet}>{sheet}</b>)}</div>}</div>{preview.available&&preview.source?.warnings.length?<aside><AlertTriangle size={17}/><span>{preview.source.warnings[0]}</span></aside>:null}</section>

   {preview.available?<>
    <div className="rpa-summary">{preview.summary.map(item=><article className={item.status} key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></article>)}</div>
    {reportType==='team-morning-brief'&&preview.briefing&&preview.briefingRows?<MorningBriefingTable preview={preview} rows={morningRows} filter={morningFilter} setFilter={setMorningFilter} formatMetric={formatMorningMetric} metricStatus={morningStatus} workflowTasks={workflowTasks} workflowBusy={workflowBusy} createPdcaTask={createPdcaTask}/>:<div className="rpa-main-grid"><section className="panel rpa-preview"><header><div><span>字段级预览</span><h2>{selectedReport?.name}</h2></div><em>{preview.rows.length} 行样本</em></header><div className="rpa-table-scroll"><table><thead><tr>{preview.columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>{preview.rows.map((row,index)=><tr key={index}>{row.map((cell,cellIndex)=>{const isMode=['离线缓存','样本提取','模拟推演'].includes(cell);return <td key={cellIndex}>{isMode?<span className={`data-mode ${cell==='模拟推演'?'simulated':cell==='样本提取'?'sample':'cached'}`}>{cell}</span>:cell}</td>})}</tr>)}</tbody></table></div></section>
     <section className="panel rpa-production"><header><div><span>报表生产线</span><h2>{latestRun?'最近一次运行':'等待首次运行'}</h2></div>{latestRun&&<em><CheckCircle2 size={14}/>已归档</em>}</header><div className="production-steps">{['来源快照','口径校验','表格生成','留痕归档'].map((step,index)=><div className={latestRun?'done':index===0?'ready':''} key={step}><b>{index+1}</b><span>{step}</span>{index<3&&<i/>}</div>)}</div>{latestRun?<div className="run-metrics"><div><span>输出行数</span><strong>{latestRun.metrics.outputRows}</strong></div><div><span>引用工作表</span><strong>{latestRun.metrics.sourceSheetsReferenced}</strong></div><div><span>生成耗时</span><strong>{latestRun.metrics.durationMs}ms</strong></div><div><span>文件大小</span><strong>{formatBytes(latestRun.metrics.artifactBytes)}</strong></div><div><span>质量提示</span><strong>{latestRun.warningCount}</strong></div><div><span>下载次数</span><strong>{latestRun.downloadCount}</strong></div></div>:<div className="production-empty"><Table2 size={30}/><p>核对左侧来源和指标后，运行当前报表。</p></div>}</section></div>}
   </>:<div className="rpa-template-empty"><ShieldCheck size={34}/><h2>报表模板已经准备好</h2><p>{preview.columns.join(' · ')}</p><span>配置项目数据适配器后即可复用10015相同的预览、生成、下载和审计链路。</span></div>}
  </>}

  <section className="panel rpa-history"><header><div><span>持久化记录</span><h2>运行与下载留痕</h2></div><button onClick={()=>refreshHistory()}><RefreshCw size={14}/>刷新记录</button></header>{runs.length?<><div className="rpa-run-head"><span>报表</span><span>运行时间</span><span>发起人</span><span>输出</span><span>下载</span><span>操作</span></div>{runs.slice(0,8).map(item=><div className="rpa-run-row" key={item.id}><div><strong>{item.reportName}</strong><small>{item.id}</small></div><span>{formatTime(item.completedAt)}</span><span>{item.requestedBy}</span><span>{item.metrics.outputRows}行 · {formatBytes(item.metrics.artifactBytes)}</span><span>{item.downloadCount}次</span><button onClick={()=>download(item)}><Download size={14}/>下载 CSV</button></div>)}</>:<div className="rpa-history-empty">当前项目与报表还没有运行记录。</div>}
   {filteredDownloads.length>0&&<div className="download-trace"><strong>最近下载留痕</strong>{filteredDownloads.map(item=><span key={item.id}><Download size={12}/>{formatTime(item.downloadedAt)} · {item.requestedBy} · {item.runId.slice(0,15)}…</span>)}</div>}
  </section>
 </>
}

function MorningBriefingTable({preview,rows,filter,setFilter,formatMetric,metricStatus,workflowTasks,workflowBusy,createPdcaTask}:{preview:ReportPreview;rows:NonNullable<ReportPreview['briefingRows']>;filter:string;setFilter:(value:string)=>void;formatMetric:(value:number|string|null|undefined,format:string)=>string;metricStatus:(value:number|string|null|undefined,target:number|string|null|undefined,direction:'higher'|'lower')=>string|null;workflowTasks:WorkflowTask[];workflowBusy:boolean;createPdcaTask:(employee:MorningEmployee)=>Promise<void>}){
 const briefing=preview.briefing!
 const all=preview.briefingRows!
 const taskKey=(employee:MorningEmployee)=>`team-morning-brief:${preview.source?.reportDate}:${employee.jobNo}`
 return <section className="morning-briefing">
  <div className="morning-brief-note"><div><span>班前会使用说明</span><h2>先表扬可复制的方法，再明确班后辅导动作</h2><p>{briefing.selectionRule}</p></div><aside><strong>目标口径</strong><p>{briefing.targetPolicy}</p><small>辅导关注用于改进支持，不作为惩罚、淘汰或自动绩效定级。</small></aside></div>
  <div className="morning-filters">{['全部','重点员工','辅导关注'].map(item=>{const count=item==='全部'?all.length:all.filter(row=>row.category===item).length;return <button className={filter===item?'active':''} onClick={()=>setFilter(item)} key={item}>{item}<b>{count}</b></button>})}<span>指标方向：↑ 越高越好 · ↓ 越低越好</span></div>
  <div className="panel morning-metric-panel"><header><div><span>员工达成通报</span><h2>重点员工与辅导关注 · 15项指标</h2></div><em>{rows.length} 人 · 来源第6行字段</em></header><div className="morning-table-scroll"><table><thead><tr><th className="sticky-col category-col" rowSpan={2}>分类</th><th className="sticky-col name-col" rowSpan={2}>员工</th><th className="sticky-col team-col" rowSpan={2}>班组 / 工号</th><th className="sticky-col reason-col" rowSpan={2}>晨会通报重点</th><th className="task-action-col" rowSpan={2}>PDCA任务</th><th colSpan={6}>业务与质量</th><th colSpan={9}>签入与效率</th></tr><tr>{briefing.metrics.map(metric=><th key={metric.code}><span>{metric.label}</span><small>{metric.code} · {metric.direction==='higher'?'↑':'↓'}</small></th>)}</tr></thead><tbody>{rows.map(employee=>{const hasTask=workflowTasks.some(task=>task.sourceKey===taskKey(employee)&&task.status!=='closed');return <tr className={employee.category==='重点员工'?'morning-focus-row':'morning-coach-row'} key={`${employee.sourceRow}-${employee.name}`}><td className="sticky-col category-col"><span className={`employee-category ${employee.category==='重点员工'?'focus':'coach'}`}>{employee.category}</span><small>{employee.position}</small></td><td className="sticky-col name-col"><strong>{employee.name}</strong><small>{employee.stage} · {employee.role}</small></td><td className="sticky-col team-col"><strong>{employee.team}</strong><small>{employee.jobNo}</small></td><td className="sticky-col reason-col"><p>{employee.reason}</p><small>源：前台晨会日报第{employee.sourceRow}行</small></td><td className="task-action-cell"><button disabled={hasTask||workflowBusy} onClick={()=>createPdcaTask(employee)}>{hasTask?<><CheckCircle2 size={13}/>已创建</>:<><ListChecks size={13}/>创建任务单</>}</button></td>{briefing.metrics.map(metric=>{const value=employee.metrics[metric.key];const target=metric.targetKey?employee.targets[metric.targetKey]:null;const status=metricStatus(value,target,metric.direction);return <td key={metric.code}><strong>{formatMetric(value,metric.format)}</strong>{target!=null&&<small>目标 {formatMetric(target,metric.format)}</small>}{status&&<em className={status==='达成'?'met':'attention'}>{status}</em>}</td>})}</tr>})}</tbody></table></div></div>
 </section>
}
