import type { SystemRole, SystemUser } from '../types'

export interface AuthSession {
 authenticated:true
 user:SystemUser
 role:SystemRole
 requiresPasswordChange:boolean
 expiresAt:string
}

export class AuthHttpError extends Error {
 status:number
 code:string
 constructor(status:number,message:string,code='AUTH_ERROR'){super(message);this.status=status;this.code=code}
}

const call=async(path:string,options:RequestInit={}):Promise<AuthSession>=>{
 const response=await fetch(path,{headers:{'content-type':'application/json','cache-control':'no-cache'},cache:'no-store',credentials:'include',...options})
 const data=await response.json().catch(()=>({}))
 if(!response.ok)throw new AuthHttpError(response.status,data.error||`认证服务请求失败（HTTP ${response.status}）`,data.code)
 return data
}

export const authApi={
 session:()=>call('/api/auth/session'),
 login:(jobNo:string,password:string)=>call('/api/auth/login',{method:'POST',body:JSON.stringify({jobNo,password})}),
 changePassword:(currentPassword:string,newPassword:string)=>call('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})}),
 logout:async()=>{
  const response=await fetch('/api/auth/logout',{method:'POST',headers:{'content-type':'application/json'},credentials:'include'})
  if(!response.ok)throw new AuthHttpError(response.status,'退出登录失败')
 },
}
