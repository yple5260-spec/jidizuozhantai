export type ReportProject={id:string;name:string;shortName:string;status:string;statusLabel:string;runnable:boolean;description:string}
export type ReportDefinition={id:string;name:string;schedule:string;description:string}
export type ReportSource={reportDate:string;workbooks:string[];sheets:string[];mode:string;modeLabel:string;warnings:string[]}
export type ReportSummary={label:string;value:string;detail:string;status:string}
export type MorningMetric={key:string;code:string;label:string;direction:'higher'|'lower';format:string;targetKey?:string}
export type MorningEmployee={category:string;position:string;sourceRow:number;name:string;jobNo:string;account:string;team:string;stage:string;role:string;reason:string;metrics:Record<string,number|string|null>;targets:Record<string,number|string|null>}
export type MorningBriefing={eligiblePopulation:number;formalPopulation:number;practicalPopulation:number;comparablePopulation:number;selectionRule:string;targetPolicy:string;directions:{higher:string[];lower:string[]};metrics:MorningMetric[]}
export type ReportPreview={project:ReportProject;report:ReportDefinition;available:boolean;source:ReportSource|null;summary:ReportSummary[];columns:string[];rows:string[][];briefing?:MorningBriefing;briefingRows?:MorningEmployee[];integrationMessage?:string}
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
 catalog:()=>jsonCall<{projects:ReportProject[];reports:ReportDefinition[]}>('/api/reports/catalog'),
 preview:(projectId:string,reportType:string)=>jsonCall<ReportPreview>(`/api/reports/preview?projectId=${encodeURIComponent(projectId)}&reportType=${encodeURIComponent(reportType)}`),
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
