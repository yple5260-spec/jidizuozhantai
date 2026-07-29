import type { SystemRole, SystemUser } from '../types'

export interface AccessState {
 users:SystemUser[]
 roles:SystemRole[]
 audit:{at:string;actor:string;action:string}[]
}

class AccessHttpError extends Error {
 status:number
 constructor(status:number,message:string){super(message);this.status=status}
}

const call=async(path:string,options:RequestInit={}):Promise<AccessState>=>{
 const response=await fetch(path,{headers:{'content-type':'application/json','cache-control':'no-cache'},cache:'no-store',credentials:'include',...options})
 const data=await response.json().catch(()=>({}))
 if(!response.ok)throw new AccessHttpError(response.status,data.error||`权限服务请求失败（HTTP ${response.status}）`)
 return data
}

export const accessApi={
 get:()=>call('/api/access'),
 saveUser:(user:SystemUser)=>call('/api/access/users',{method:'PUT',body:JSON.stringify({user})}),
 userAction:(id:string,action:'toggle_status'|'reset_password',temporaryPassword='')=>call(`/api/access/users/${id}/action`,{method:'POST',body:JSON.stringify({action,temporaryPassword})}),
 saveRole:(role:SystemRole)=>call('/api/access/roles',{method:'PUT',body:JSON.stringify({role})}),
 deleteRole:(id:string)=>call(`/api/access/roles/${id}`,{method:'DELETE'}),
}
