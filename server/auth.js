import { randomBytes } from 'node:crypto'
import { loadAccess, publicAccess } from './accessStore.js'

const sessions=new Map()
const cookieName='hebei_session'
const maxAgeSeconds=8*60*60
const fail=(status,message,code)=>{throw Object.assign(new Error(message),{status,code})}
const parseCookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(item=>item.trim()).filter(Boolean).map(item=>{const index=item.indexOf('=');return index<0?[item,'']:[item.slice(0,index),decodeURIComponent(item.slice(index+1))]}))
const cookieOptions=req=>{
 const secure=req.headers['x-forwarded-proto']==='https'
 return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure?'; Secure':''}`
}
const cleanup=()=>{
 const timestamp=Date.now()
 for(const [token,session] of sessions)if(session.expiresAt<=timestamp)sessions.delete(token)
}

export function createSession(req,res,userId){
 cleanup()
 const token=randomBytes(32).toString('base64url')
 const session={userId,createdAt:Date.now(),expiresAt:Date.now()+maxAgeSeconds*1000}
 sessions.set(token,session)
 res.setHeader('set-cookie',`${cookieName}=${token}; ${cookieOptions(req)}`)
 return {...session,token}
}

export function getSession(req){
 cleanup()
 const token=parseCookies(req)[cookieName],session=token?sessions.get(token):null
 if(!session)return null
 session.expiresAt=Date.now()+maxAgeSeconds*1000
 return {...session,token}
}

export function requireSession(req){
 const session=getSession(req)
 if(!session)fail(401,'登录已失效，请重新登录','AUTH_REQUIRED')
 const access=loadAccess(),user=access.users.find(item=>item.id===session.userId)
 if(!user||user.status!=='active'){sessions.delete(session.token);fail(401,'账号已停用或不存在，请重新登录','AUTH_REQUIRED')}
 return {session,user,access}
}

export function requireReadySession(req){
 const current=requireSession(req)
 if(current.user.forceChangePassword)fail(403,'请先完成首次登录密码修改','AUTH_PASSWORD_CHANGE_REQUIRED')
 return current
}

export function destroySession(req,res){
 const session=getSession(req)
 if(session)sessions.delete(session.token)
 res.setHeader('set-cookie',`${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

export function publicSession(req){
 const current=requireSession(req)
 return sessionPayload(current.user.id,current.session.expiresAt)
}

export function sessionPayload(userId,expiresAt){
 const publicState=publicAccess(loadAccess()),user=publicState.users.find(item=>item.id===userId)
 const role=publicState.roles.find(item=>item.id===user?.roleId)
 if(!user||!role)fail(401,'账号或角色不存在','AUTH_REQUIRED')
 return {authenticated:true,user,role,requiresPasswordChange:Boolean(user.forceChangePassword),expiresAt:new Date(expiresAt).toISOString()}
}

export { cookieName }
