export interface TaskTargetSuggestion {
 problem:string;target:string;metricCode:string;metricLabel:string;metricUnit:string;metricDirection:'higher'|'lower'
 baselineValue:number;targetValue:number;successCriteria:string;actionSuggestion:string;rationale:string
}
export interface TaskImprovement {
 metric:{code:string;label:string;baseline:number|null;target:number|null;unit:string;direction:'higher'|'lower'}
 baseline:number|null;latest:number|null;target:number|null;delta:number|null;targetMet:boolean;improved:boolean;conclusion:string
 points:{date:string;value:number;source:string;type:string}[]
}

async function request<T>(path:string,options?:RequestInit):Promise<T>{
 const response=await fetch(path,{
  headers:{'content-type':'application/json','cache-control':'no-cache'},cache:'no-store',credentials:'include',...options,
 })
 const payload=await response.json().catch(()=>({}))
 if(!response.ok)throw new Error(payload.error||'任务服务请求失败')
 return payload as T
}

const fileBase64=(file:File)=>new Promise<string>((resolve,reject)=>{
 const reader=new FileReader()
 reader.onerror=()=>reject(new Error('附件读取失败'))
 reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'')
 reader.readAsDataURL(file)
})

export const taskApi={
 targetSuggestion:(payload:Record<string,string|number>)=>request<{suggestion:TaskTargetSuggestion;provider:string;model:string;warning?:string}>('/api/tasks/target-suggestion',{method:'POST',body:JSON.stringify(payload)}),
 improvement:(taskId:string,role:string)=>request<TaskImprovement>(`/api/tasks/${encodeURIComponent(taskId)}/improvement?role=${encodeURIComponent(role)}`),
 uploadAttachment:async(taskId:string,role:string,nodeCode:string,file:File)=>request<import('./workflowApi').WorkflowState>(`/api/tasks/${encodeURIComponent(taskId)}/attachments`,{
  method:'POST',
  body:JSON.stringify({role,nodeCode,fileName:file.name,mimeType:file.type||'application/octet-stream',contentBase64:await fileBase64(file)}),
 }),
 attachmentUrl:(taskId:string,attachmentId:string,role:string)=>`/api/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}?role=${encodeURIComponent(role)}`,
}
