export type ReportProject={id:string;name:string;shortName:string;status:string;statusLabel:string;runnable:boolean;description:string}
export type ReportDefinition={id:string;name:string;schedule:string;description:string}
export type ReportSource={reportDate:string;workbooks:string[];sheets:string[];mode:string;modeLabel:string;warnings:string[]}
export type ReportSummary={label:string;value:string;detail:string;status:string}
export type MorningMetric={key:string;code:string;label:string;direction:'higher'|'lower';format:string;targetKey?:string}
export type MorningEmployee={category:string;position:string;sourceRow:number;name:string;jobNo:string;account:string;team:string;stage:string;role:string;reason:string;metrics:Record<string,number|string|null>;targets:Record<string,number|string|null>}
export type MorningBriefing={eligiblePopulation:number;formalPopulation:number;practicalPopulation:number;comparablePopulation:number;selectionRule:string;targetPolicy:string;directions:{higher:string[];lower:string[]};metrics:MorningMetric[]}
export type ReportTaskPrefill={title:string;targetRole:string;owner:string;issueCategory:string;issueLocation:string;problem:string;target:string;successCriteria:string;actionPlan:string;metricCode:string;metricLabel:string;metricUnit:string;metricDirection:'higher'|'lower';baselineValue:number;targetValue:number;employeeCode?:string;employeeName?:string;team?:string;aiRationale?:string}
export type RpaPeopleRow={jobNo:string;account:string;stage:string;leader:string;team:string;name:string;status:string;dailyTarget:number;dailyActual:number;monthlyTarget:number;monthlyActual:number;attainment:number;att:number;utilization:number;busyRest:number;signinHours:number;productionGap:number;signinImpact:number;attImpact:number;busyImpact:number;remainingHours:number;recoveryDaily:number;recoveryActual:number;recoveryAttainment:number;selfClosureTarget:number;selfClosureActual:number;selfClosureGap:number;satisfactionTarget:number;satisfactionActual:number;satisfactionGap:number;evaluationRate:number;task:ReportTaskPrefill}
export type RpaQualityRow={sourceRow:number;jobNo:string;queue:string;team:string;name:string;scene:string;source:string;project:string;ticketNo:string;responsibility:string;deduction:number;listenDate:string|number;province:string;contactId:string;comment:string;problemType:string;task:ReportTaskPrefill}
export type RpaAttritionRow={sourceRow:number;jobNo:string;name:string;department:string;team:string;hireDate:string;leaveDate:string;position:string;channel:string;channelName:string;stage:string;reason:string;reporter:string;supervisor:string;manager:string;task:ReportTaskPrefill}
export type ReportRoleView={kind:'people'|'quality'|'attrition';scopeLabel:string;scopePolicy:string;peopleRows?:RpaPeopleRow[];qualityRows?:RpaQualityRow[];attritionRows?:RpaAttritionRow[]}
export type ReportPreview={project:ReportProject;report:ReportDefinition;available:boolean;source:ReportSource|null;summary:ReportSummary[];columns:string[];rows:string[][];briefing?:MorningBriefing;briefingRows?:MorningEmployee[];roleView?:ReportRoleView;integrationMessage?:string}
export type ReportRun={id:string;projectId:string;reportType:string;projectName:string;reportName:string;requestedBy:string;requestedRole:string;status:string;createdAt:string;completedAt:string;sourceSnapshot:ReportSource;metrics:{sourceSheetsReferenced:number;outputRows:number;durationMs:number;artifactBytes:number};preview:{summary:ReportSummary[];columns:string[];rows:string[][]};artifact?:{format:'csv';fileName:string};warningCount:number;downloadCount:number}
export type ReportDownload={id:string;runId:string;projectId:string;reportType:string;requestedBy:string;downloadedAt:string;format:string}

class ReportHttpError extends Error{status:number;code?:string;constructor(status:number,message:string,code?:string){super(message);this.status=status;this.code=code}}
const jsonCall=async<T>(path:string,options:RequestInit={}):Promise<T>=>{
 const response=await fetch(path,{headers:{'content-type':'application/json','cache-control':'no-cache'},cache:'no-store',credentials:'include',...options})
 const text=await response.text()
 let data:any={}
 try{data=text?JSON.parse(text):{}}catch{throw new ReportHttpError(response.status,`报表服务响应格式异常（HTTP ${response.status}）`)}
 if(!response.ok)throw new ReportHttpError(response.status,data.error||`报表请求失败（HTTP ${response.status}）`,data.code)
 return data
}

export const reportApi={
 catalog:(role?:string)=>jsonCall<{projects:ReportProject[];reports:ReportDefinition[]}>(`/api/reports/catalog${role?`?role=${encodeURIComponent(role)}`:''}`),
 preview:(projectId:string,reportType:string,role?:string)=>jsonCall<ReportPreview>(`/api/reports/preview?projectId=${encodeURIComponent(projectId)}&reportType=${encodeURIComponent(reportType)}${role?`&role=${encodeURIComponent(role)}`:''}`),
 history:(projectId:string,reportType:string)=>jsonCall<{runs:ReportRun[];downloads:ReportDownload[]}>(`/api/reports/runs?projectId=${encodeURIComponent(projectId)}&reportType=${encodeURIComponent(reportType)}`),
 run:(projectId:string,reportType:string,requestedBy:string,requestedRole:string)=>jsonCall<ReportRun>('/api/reports/runs',{method:'POST',body:JSON.stringify({projectId,reportType,requestedBy,requestedRole})}),
 download:async(run:ReportRun,requestedBy:string)=>{
  const response=await fetch(`/api/reports/runs/${encodeURIComponent(run.id)}/download?requestedBy=${encodeURIComponent(requestedBy)}`,{cache:'no-store',credentials:'include'})
  if(!response.ok){let message=`下载失败（HTTP ${response.status}）`;try{message=(await response.json()).error||message}catch{}throw new ReportHttpError(response.status,message)}
  const blob=await response.blob()
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a');link.href=url;link.download=run.artifact?.fileName||`${run.reportName}.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url)
 },
}
