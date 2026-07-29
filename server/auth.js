import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { loadAccess, publicAccess } from './accessStore.js'

const cookieName='hebei_session'
const maxAgeSeconds=Math.max(15*60,Math.min(Number(process.env.SESSION_MAX_AGE_SECONDS)||8*60*60,7*24*60*60))
const configuredSecret=String(process.env.SESSION_SECRET||'').trim()
if(process.env.NODE_ENV==='production'&&configuredSecret.length<32)throw new Error('生产环境必须配置至少32位的 SESSION_SECRET')
const sessionSecret=configuredSecret.length>=32?configuredSecret:randomBytes(48).toString('base64url')
if(!configuredSecret&&process.env.NODE_ENV!=='test')console.warn('SESSION_SECRET未配置，本次启动使用临时签名密钥；服务重启后现有登录态将失效。')

const fail=(status,message,code)=>{throw Object.assign(new Error(message),{status,code})}
const parseCookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(item=>item.trim()).filter(Boolean).map(item=>{const index=item.indexOf('=');return index<0?[item,'']:[item.slice(0,index),decodeURIComponent(item.slice(index+1))]}))
const cookieOptions=req=>{
 const secure=req.headers['x-forwarded-proto']==='https'
 return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure?'; Secure':''}`
}
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
const sign=value=>createHmac('sha256',sessionSecret).update(value).digest('base64url')
const tokenFor=payload=>{
 const encoded=encode(payload)
 return `${encoded}.${sign(encoded)}`
}
const verifyToken=token=>{
 const [encoded,signature]=String(token||'').split('.')
 if(!encoded||!signature)return null
 const expected=Buffer.from(sign(encoded)),received=Buffer.from(signature)
 if(expected.length!==received.length||!timingSafeEqual(expected,received))return null
 try{
  const payload=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'))
  if(!payload?.u||!Number.isFinite(payload.exp)||payload.exp<=Date.now())return null
  return payload
 }catch{return null}
}

export function createSession(req,res,userId){
 const access=loadAccess(),user=access.users.find(item=>item.id===userId)
 if(!user)fail(401,'账号不存在','AUTH_REQUIRED')
 const session={userId,createdAt:Date.now(),expiresAt:Date.now()+maxAgeSeconds*1000,sessionVersion:Number(user.sessionVersion||1)}
 const token=tokenFor({u:userId,iat:session.createdAt,exp:session.expiresAt,v:session.sessionVersion,n:randomBytes(12).toString('base64url')})
 res.setHeader('set-cookie',`${cookieName}=${token}; ${cookieOptions(req)}`)
 return {...session,token}
}

export function getSession(req){
 const payload=verifyToken(parseCookies(req)[cookieName])
 if(!payload)return null
 return {userId:payload.u,createdAt:Number(payload.iat||0),expiresAt:Number(payload.exp),sessionVersion:Number(payload.v||1),token:parseCookies(req)[cookieName]}
}

export function requireSession(req){
 const session=getSession(req)
 if(!session)fail(401,'登录已失效，请重新登录','AUTH_REQUIRED')
 const access=loadAccess(),user=access.users.find(item=>item.id===session.userId)
 if(!user||user.status!=='active'||Number(user.sessionVersion||1)!==session.sessionVersion)fail(401,'账号状态或密码已变化，请重新登录','AUTH_REQUIRED')
 return {session,user,access}
}

export function requireReadySession(req){
 const current=requireSession(req)
 if(current.user.forceChangePassword)fail(403,'请先完成首次登录密码修改','AUTH_PASSWORD_CHANGE_REQUIRED')
 return current
}

export function destroySession(req,res){
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
