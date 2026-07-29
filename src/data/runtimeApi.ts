async function request<T>(path:string,options?:RequestInit):Promise<T>{
 const response=await fetch(path,{
  headers:{'content-type':'application/json','cache-control':'no-cache'},
  cache:'no-store',
  credentials:'include',
  ...options,
 })
 const payload=await response.json().catch(()=>({}))
 if(!response.ok)throw new Error(payload.error||'运行状态同步失败')
 return payload as T
}

export const runtimeApi={
 notificationReads:()=>request<{ids:string[]}>('/api/notifications/read'),
 markNotificationsRead:(ids:string[])=>request<{ids:string[]}>('/api/notifications/read',{
  method:'POST',
  body:JSON.stringify({ids}),
 }),
}
