export type AiChatMessage={
 role:'user'|'assistant'
 content:string
}

export type AiContext={
 roleId:string
 role:string
 scope:string
 page:string
 metrics:string[]
 openAlerts:number
 openTasks:number
}

export type AiActionDraft={
 role:string
 title:string
 problem:string
 target:string
 owner:string
 dueAt:string
 successCriteria:string
 rationale:string
 collaborationRole:string
 verificationRole:string
}

export type AiSettings={
 provider:string
 configured:boolean
 model:string
 baseUrl:string
 timeoutMs:number
 source:'system'|'environment'|'none'
 maskedKey:string
 updatedAt:string
 updatedBy:string
}

type AiChatResponse={
 message:AiChatMessage
 provider:string
 model:string
 usage?:{prompt_tokens?:number;completion_tokens?:number;total_tokens?:number}|null
}

async function request<T>(path:string,options?:RequestInit):Promise<T>{
 const response=await fetch(path,{
  headers:{'content-type':'application/json','cache-control':'no-cache'},
  cache:'no-store',
  credentials:'include',
  ...options,
 })
 const payload=await response.json().catch(()=>({}))
 if(!response.ok){
  const error=new Error(payload.error||'AI服务请求失败') as Error&{code?:string;status?:number}
  error.code=payload.code
  error.status=response.status
  throw error
 }
 return payload as T
}

export const aiApi={
 status:()=>request<AiSettings>('/api/ai/status'),
 settings:()=>request<AiSettings>('/api/ai/settings'),
 history:(role:string)=>request<{messages:AiChatMessage[]}>(`/api/ai/history?role=${encodeURIComponent(role)}`),
 clearHistory:(role:string)=>request<{ok:boolean}>(`/api/ai/history?role=${encodeURIComponent(role)}`,{method:'DELETE'}),
 saveSettings:(payload:{apiKey?:string;model:string;baseUrl:string;timeoutMs:number;clearApiKey?:boolean;actor:string})=>request<AiSettings>('/api/ai/settings',{
  method:'PUT',
  body:JSON.stringify(payload),
 }),
 test:()=>request<{ok:boolean;provider:string;model:string;latencyMs:number;message:string}>('/api/ai/test',{method:'POST',body:'{}'}),
 chat:(messages:AiChatMessage[],context:AiContext)=>request<AiChatResponse>('/api/ai/chat',{
  method:'POST',
  body:JSON.stringify({messages,context}),
 }),
 draftAction:(messages:AiChatMessage[],context:AiContext)=>request<{draft:AiActionDraft;provider:string;model:string}>('/api/ai/action-drafts',{
  method:'POST',
  body:JSON.stringify({messages,context}),
 }),
 executeActionDraft:(draft:AiActionDraft)=>request<import('./workflowApi').WorkflowState>('/api/ai/action-drafts/execute',{
  method:'POST',
  body:JSON.stringify({draft}),
 }),
}
