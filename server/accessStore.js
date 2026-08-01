import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dataDir } from './store.js'
import { databaseConfigured, databaseQuery, databaseTransaction } from './database.js'

const accessFile=path.join(dataDir,'access-control.json')
const tempFile=path.join(dataDir,'access-control.tmp.json')
const organizationSeedFile=path.join(path.dirname(fileURLToPath(import.meta.url)),'seeds','organization-directory.json')
const allowedMenus=['command','industry-news','settlement','alerts','meeting','team','workforce','tasks','excellence','reports','growth','salary','user-management','role-management','ai-settings']
const now=()=>new Date().toISOString()
let accessCache=null
let databaseMode=false
const organizationDirectory=JSON.parse(fs.readFileSync(organizationSeedFile,'utf8'))
const organizationMemberByJobNo=new Map(organizationDirectory.members.map(member=>[member.jobNo.toLowerCase(),member]))
const fail=(status,message,code='ACCESS_VALIDATION_ERROR')=>{throw Object.assign(new Error(message),{status,code})}
const uniqueMenus=menus=>Array.from(new Set((Array.isArray(menus)?menus:[]).filter(menu=>allowedMenus.includes(menu))))
const hashPassword=password=>{
 const salt=randomBytes(16).toString('hex')
 return `scrypt$${salt}$${scryptSync(String(password),salt,64).toString('hex')}`
}
const verifyPassword=(password,encoded)=>{
 const [algorithm,salt,digest]=String(encoded||'').split('$')
 if(algorithm!=='scrypt'||!salt||!digest)return false
 const expected=Buffer.from(digest,'hex'),actual=scryptSync(String(password),salt,expected.length)
 return expected.length===actual.length&&timingSafeEqual(expected,actual)
}

const roleSeeds=()=>[
 {id:'system-admin',name:'系统管理员',code:'SYSTEM_ADMIN',level:'系统级',description:'拥有全部业务模块和系统管理权限；内置角色不可删除。',memberCount:0,menus:[...allowedMenus],builtIn:true,status:'active'},
 {id:'operation-director',name:'运营总监',code:'OPERATION_DIRECTOR',level:'基地级',description:'关注基地经营、甲方动态、行业舆情、结费回款和组织效能。',memberCount:0,menus:['command','industry-news','settlement','alerts','meeting','workforce','tasks','excellence','reports','growth','salary'],builtIn:true,status:'active'},
 {id:'customer-manager',name:'客服经理',code:'CUSTOMER_MANAGER',level:'业务线级',description:'负责业务KPI、组织效能、主管及班组管理。',memberCount:0,menus:['command','alerts','meeting','team','workforce','tasks','excellence','reports','growth'],builtIn:true,status:'active'},
 {id:'customer-supervisor',name:'客服主管',code:'CUSTOMER_SUPERVISOR',level:'区域级',description:'负责现场调度、绩效改善、班长履职和质量风险。',memberCount:0,menus:['command','alerts','meeting','team','workforce','tasks','excellence','reports','growth'],builtIn:true,status:'active'},
 {id:'team-leader',name:'客服班长',code:'TEAM_LEADER',level:'班组级',description:'负责班前会、班组看数、面谈辅导及任务闭环。',memberCount:0,menus:['command','alerts','meeting','team','workforce','tasks','excellence','reports','growth','salary'],builtIn:true,status:'active'},
 {id:'customer-agent',name:'客服专员',code:'CUSTOMER_AGENT',level:'个人级',description:'查看个人绩效、培训任务、排班、先进经验和薪资信息。',memberCount:0,menus:['command','meeting','workforce','tasks','excellence','growth','salary'],builtIn:true,status:'active'},
 {id:'quality-specialist',name:'质检专员',code:'QUALITY_SPECIALIST',level:'专业岗',description:'AI辅助质检、质量分析、先进录音和整改闭环。',memberCount:0,menus:['command','alerts','meeting','tasks','excellence','reports','growth'],builtIn:true,status:'active'},
 {id:'training-manager',name:'培训主管',code:'TRAINING_MANAGER',level:'专业岗',description:'培训需求、课程计划、AI教官及培训效果评估。',memberCount:0,menus:['command','meeting','tasks','excellence','reports','growth'],builtIn:true,status:'active'},
 {id:'hrbp-manager',name:'HRBP经理',code:'HRBP_MANAGER',level:'专业岗',description:'人员档案、流失预警、招聘缺口和组织效能。',memberCount:0,menus:['command','alerts','workforce','tasks','reports','growth','salary'],builtIn:true,status:'active'},
 {id:'operations-support',name:'运营支持',code:'OPERATIONS_SUPPORT',level:'专业岗',description:'适用于调度、数据、知识、工号和专项管理岗位；默认采用最小权限，可按账号追加模块。',memberCount:0,menus:['command','tasks','reports'],builtIn:true,status:'active'},
]

const synchronizeBuiltInRoles=state=>{
 let changed=false
 for(const seed of roleSeeds()){
  const existing=state.roles.find(role=>role.id===seed.id)
  if(!existing){state.roles.push(seed);changed=true;continue}
  if(seed.builtIn&&JSON.stringify(existing.menus)!==JSON.stringify(seed.menus)){existing.menus=[...seed.menus];changed=true}
 }
 return changed
}
const synchronizeExcellenceMenus=state=>{
 const action='开放固化先进模块，并按岗位配置经验与录音查阅权限'
 if(state.audit?.some(item=>item.action===action))return false
 for(const id of ['system-admin','operation-director','customer-manager','customer-supervisor','team-leader','customer-agent','quality-specialist','training-manager']){
  const role=state.roles.find(item=>item.id===id)
  if(role)role.menus=uniqueMenus([...(role.menus||[]),'excellence'])
 }
 state.audit.unshift({at:now(),actor:'系统',action})
 return true
}

const synchronizeProfilesWithOrganization=state=>{
 let changed=false
 state.users=state.users.map(user=>{
  const member=organizationMemberByJobNo.get(String(user.jobNo||'').toLowerCase())
  if(!member)return user
  const next={...user,name:member.name,jobTitle:member.jobTitle,department:member.department,updatedAt:now()}
  if(user.name===next.name&&user.jobTitle===next.jobTitle&&user.department===next.department)return user
  changed=true
  return next
 })
 return changed
}

const bootstrapPassword=()=>{
 const value=String(process.env.BOOTSTRAP_ADMIN_PASSWORD||'').trim()
 if(value.length>=8)return value
 if(process.env.NODE_ENV==='test')return '000000'
 throw Object.assign(new Error('首次部署必须通过 BOOTSTRAP_ADMIN_PASSWORD 提供至少8位的管理员初始密码'),{code:'BOOTSTRAP_PASSWORD_REQUIRED'})
}
const initialState=()=>({
 version:7,
 users:[
  {id:'U001',name:String(process.env.BOOTSTRAP_ADMIN_NAME||(process.env.NODE_ENV==='test'?'李燕鹏':'系统管理员')).slice(0,40),jobNo:String(process.env.BOOTSTRAP_ADMIN_JOB_NO||(process.env.NODE_ENV==='test'?'JZ053684':'admin')).slice(0,40),roleId:'system-admin',jobTitle:process.env.NODE_ENV==='test'?'运营管理总监':'系统管理员',department:process.env.NODE_ENV==='test'?'河北基地 · 客户驱动部':'河北基地',phone:'',email:'',status:'active',passwordHash:hashPassword(bootstrapPassword()),forceChangePassword:true,passwordChangedAt:'',failedLoginCount:0,lockedUntil:'',lastLoginAt:'',lastLoginIp:'',sessionVersion:1,moduleOverrides:[],createdAt:now(),updatedAt:now()},
  ...(process.env.NODE_ENV==='test'?[{id:'U002',name:'吴欣欣',jobNo:'JZ001218',roleId:'customer-manager',jobTitle:'运营经理',department:'河北基地',phone:'',email:'',status:'active',passwordHash:hashPassword('000000'),forceChangePassword:true,passwordChangedAt:'',failedLoginCount:0,lockedUntil:'',lastLoginAt:'',lastLoginIp:'',sessionVersion:1,moduleOverrides:[],createdAt:now(),updatedAt:now()}]:[]),
 ],
 roles:roleSeeds(),
 audit:[{at:now(),actor:'系统',action:'初始化用户与角色权限配置'}],
})

const writeLocal=state=>{
 fs.mkdirSync(dataDir,{recursive:true})
 fs.writeFileSync(tempFile,JSON.stringify(state,null,2),{encoding:'utf8',mode:0o600})
 fs.renameSync(tempFile,accessFile)
 try{fs.chmodSync(accessFile,0o600)}catch{}
 return state
}

const loadLocalAccess=()=>{
 if(!fs.existsSync(accessFile))return writeLocal(initialState())
 try{
  const parsed=JSON.parse(fs.readFileSync(accessFile,'utf8'))
  if(!Array.isArray(parsed.users)||!Array.isArray(parsed.roles)||!Array.isArray(parsed.audit))throw new Error('权限文件结构不完整')
  if(Number(parsed.version||1)<2){
   const workforceRoles=new Set(['system-admin','operation-director','customer-manager','customer-supervisor','team-leader','customer-agent','hrbp-manager'])
   parsed.roles.forEach(role=>{if(workforceRoles.has(role.id))role.menus=uniqueMenus([...(role.menus||[]),'workforce'])})
   parsed.version=2
   parsed.audit.unshift({at:now(),actor:'系统',action:'升级组织与排班模块岗位权限'})
  }
  if(Number(parsed.version||1)<3){
   const leaderRole=parsed.roles.find(role=>role.id==='team-leader')
   if(leaderRole)leaderRole.menus=uniqueMenus([...(leaderRole.menus||[]),'salary'])
   parsed.version=3
   parsed.audit.unshift({at:now(),actor:'系统',action:'升级班长绩效与薪资目标管理权限'})
  }
  if(Number(parsed.version||1)<4){
   for(const id of ['operation-director','hrbp-manager']){
    const role=parsed.roles.find(item=>item.id===id)
    if(role)role.menus=uniqueMenus([...(role.menus||[]),'growth'])
   }
   parsed.version=4
   parsed.audit.unshift({at:now(),actor:'系统',action:'开放总监与HRBP培训面谈模块权限'})
  }
  if(Number(parsed.version||1)<5){
   synchronizeProfilesWithOrganization(parsed)
   parsed.version=5
   parsed.audit.unshift({at:now(),actor:'系统',action:`同步《${organizationDirectory.source.fileName}》组织、项目与岗位信息（${organizationDirectory.source.totalMembers}人）`})
  }
  if(Number(parsed.version||1)<6){
   synchronizeBuiltInRoles(parsed)
   parsed.version=6
   parsed.audit.unshift({at:now(),actor:'系统',action:'新增运营支持最小权限角色并完成组织岗位映射'})
  }
  if(Number(parsed.version||1)<7){
   for(const id of ['system-admin','operation-director','customer-manager','customer-supervisor','team-leader','customer-agent','quality-specialist','training-manager']){
    const role=parsed.roles.find(item=>item.id===id)
    if(role)role.menus=uniqueMenus([...(role.menus||[]),'excellence'])
   }
   parsed.version=7
   parsed.audit.unshift({at:now(),actor:'系统',action:'开放固化先进模块，并按岗位配置经验与录音查阅权限'})
  }
  parsed.users=parsed.users.map(user=>({...user,passwordChangedAt:user.passwordChangedAt||'',failedLoginCount:Number(user.failedLoginCount||0),lockedUntil:user.lockedUntil||'',lastLoginAt:user.lastLoginAt||'',lastLoginIp:user.lastLoginIp||'',sessionVersion:Number(user.sessionVersion||1)}))
  return parsed
 }catch(error){
  console.warn(`权限配置读取失败，自动恢复：${error.message}`)
  return writeLocal(initialState())
 }
}

const parseJson=value=>{
 if(Array.isArray(value))return value
 if(value&&typeof value==='object')return value
 try{return JSON.parse(value||'[]')}catch{return []}
}
const iso=value=>value?new Date(value).toISOString():''
const accessFromDatabase=async()=>{
 const [roles,users,audit]=await Promise.all([
  databaseQuery('SELECT * FROM platform_system_role ORDER BY built_in DESC,id'),
  databaseQuery('SELECT * FROM platform_system_user ORDER BY id'),
  databaseQuery('SELECT actor_name AS actor,action_note AS action,created_at AS at FROM platform_access_audit ORDER BY created_at DESC LIMIT 500'),
 ])
 return {
  version:5,
  roles:roles.map(role=>({id:role.id,name:role.name,code:role.code,level:role.level_name,description:role.description_text||'',memberCount:0,menus:parseJson(role.menus_json),builtIn:Boolean(role.built_in),status:role.status})),
  users:users.map(user=>({id:user.id,name:user.name,jobNo:user.job_no,roleId:user.role_id,jobTitle:user.job_title,department:user.department,phone:user.phone||'',email:user.email||'',status:user.status,passwordHash:user.password_hash,forceChangePassword:Boolean(user.force_change_password),passwordChangedAt:iso(user.password_changed_at),failedLoginCount:Number(user.failed_login_count||0),lockedUntil:iso(user.locked_until),lastLoginAt:iso(user.last_login_at),lastLoginIp:user.last_login_ip||'',sessionVersion:Number(user.session_version||1),moduleOverrides:parseJson(user.module_overrides_json),createdAt:iso(user.created_at),updatedAt:iso(user.updated_at)})),
  audit:audit.map(item=>({at:iso(item.at),actor:item.actor,action:item.action})),
 }
}
const persistAccess=state=>databaseTransaction(async connection=>{
 for(const role of state.roles){
  await connection.query(`
   INSERT INTO platform_system_role
    (id,name,code,level_name,description_text,menus_json,built_in,status)
   VALUES (?,?,?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE name=VALUES(name),level_name=VALUES(level_name),description_text=VALUES(description_text),
    menus_json=VALUES(menus_json),built_in=VALUES(built_in),status=VALUES(status)`,[
   role.id,role.name,role.code,role.level,role.description||'',JSON.stringify(role.menus||[]),role.builtIn?1:0,role.status,
  ])
 }
 for(const user of state.users){
  await connection.query(`
   INSERT INTO platform_system_user
    (id,name,job_no,role_id,job_title,department,phone,email,status,password_hash,force_change_password,
     password_changed_at,failed_login_count,locked_until,last_login_at,last_login_ip,session_version,module_overrides_json,created_at,updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE name=VALUES(name),job_no=VALUES(job_no),role_id=VALUES(role_id),job_title=VALUES(job_title),
    department=VALUES(department),phone=VALUES(phone),email=VALUES(email),status=VALUES(status),password_hash=VALUES(password_hash),
    force_change_password=VALUES(force_change_password),password_changed_at=VALUES(password_changed_at),
    failed_login_count=VALUES(failed_login_count),locked_until=VALUES(locked_until),last_login_at=VALUES(last_login_at),
    last_login_ip=VALUES(last_login_ip),session_version=VALUES(session_version),module_overrides_json=VALUES(module_overrides_json),
    updated_at=VALUES(updated_at)`,[
   user.id,user.name,user.jobNo,user.roleId,user.jobTitle,user.department,user.phone||null,user.email||null,user.status,user.passwordHash,
   user.forceChangePassword?1:0,user.passwordChangedAt?new Date(user.passwordChangedAt):null,Number(user.failedLoginCount||0),
   user.lockedUntil?new Date(user.lockedUntil):null,user.lastLoginAt?new Date(user.lastLoginAt):null,user.lastLoginIp||null,
   Number(user.sessionVersion||1),JSON.stringify(user.moduleOverrides||[]),user.createdAt?new Date(user.createdAt):new Date(),user.updatedAt?new Date(user.updatedAt):new Date(),
  ])
 }
 const dbUsers=await connection.query('SELECT id FROM platform_system_user')
 for(const row of dbUsers[0])if(!state.users.some(item=>item.id===row.id))await connection.query('DELETE FROM platform_system_user WHERE id=?',[row.id])
 const dbRoles=await connection.query('SELECT id FROM platform_system_role')
 for(const row of dbRoles[0])if(!state.roles.some(item=>item.id===row.id))await connection.query('DELETE FROM platform_system_role WHERE id=?',[row.id])
 for(const entry of state.audit||[]){
  const fingerprint=createHash('sha256').update(`${entry.at}|${entry.actor}|${entry.action}`).digest('hex')
  await connection.query('INSERT IGNORE INTO platform_access_audit(fingerprint,actor_name,action_code,action_note,created_at) VALUES (?,?,?,?,?)',[
   fingerprint,entry.actor||'系统','access_change',entry.action||'未记录动作',entry.at?new Date(entry.at):new Date(),
  ])
 }
})

const commitAccess=async state=>{
 if(databaseMode)await persistAccess(state)
 else writeLocal(state)
 accessCache=structuredClone(state)
 return accessCache
}

export const initializeAccessPersistence=async()=>{
 if(!databaseConfigured()){
  databaseMode=false
  accessCache=loadLocalAccess()
  return {mode:'local',imported:false,users:accessCache.users.length}
 }
 const count=Number((await databaseQuery('SELECT COUNT(*) AS count FROM platform_system_role'))[0]?.count||0)
 if(!count){
  const seed=fs.existsSync(accessFile)?loadLocalAccess():initialState()
  await persistAccess(seed)
 }
 accessCache=await accessFromDatabase()
 const profilesChanged=synchronizeProfilesWithOrganization(accessCache)
 const rolesChanged=synchronizeBuiltInRoles(accessCache)
 const excellenceChanged=synchronizeExcellenceMenus(accessCache)
 if(profilesChanged||rolesChanged||excellenceChanged)await persistAccess(accessCache)
 databaseMode=true
 return {mode:'mysql',imported:!count,users:accessCache.users.length}
}

export function loadAccess(){
 if(!accessCache)accessCache=loadLocalAccess()
 return structuredClone(accessCache)
}

const publicUser=user=>{
 const {passwordHash,...safe}=user
 return {...safe,password:''}
}
export const publicAccess=state=>{
 const memberCounts=new Map(state.roles.map(role=>[role.id,state.users.filter(user=>user.roleId===role.id).length]))
 return {users:state.users.map(publicUser),roles:state.roles.map(role=>({...role,memberCount:memberCounts.get(role.id)||0})),organization:organizationDirectory,audit:state.audit.slice(0,100)}
}

export function requirePermission(state,actorUserId,permission){
 const actor=state.users.find(user=>user.id===actorUserId)
 if(!actor||actor.status!=='active')fail(403,'当前操作账号不存在或已停用','ACCESS_FORBIDDEN')
 const role=state.roles.find(item=>item.id===actor.roleId)
 if(!role||role.status!=='active'||(!role.menus.includes(permission)&&!actor.moduleOverrides.includes(permission)))fail(403,'当前账号没有此系统管理权限','ACCESS_FORBIDDEN')
 return actor
}

export async function authenticate(jobNo,password,clientIp=''){
 const state=loadAccess(),normalized=String(jobNo||'').trim().toLowerCase()
 const user=state.users.find(item=>item.jobNo.toLowerCase()===normalized)
 if(!user)fail(401,'账号或密码不正确','AUTH_INVALID_CREDENTIALS')
 if(user.lockedUntil&&Date.parse(user.lockedUntil)>Date.now())fail(423,'账号因连续登录失败暂时锁定，请稍后重试','AUTH_ACCOUNT_LOCKED')
 if(!verifyPassword(password,user.passwordHash)){
  user.failedLoginCount=Number(user.failedLoginCount||0)+1
  if(user.failedLoginCount>=5)user.lockedUntil=new Date(Date.now()+15*60*1000).toISOString()
  state.audit.unshift({at:now(),actor:user.name,action:`登录失败${user.failedLoginCount}次${user.lockedUntil?'，账号暂时锁定':''}`})
  await commitAccess(state)
  fail(401,'账号或密码不正确','AUTH_INVALID_CREDENTIALS')
 }
 if(user.status!=='active')fail(403,'账号已停用，请联系系统管理员','AUTH_ACCOUNT_DISABLED')
 const role=state.roles.find(item=>item.id===user.roleId)
 if(!role||role.status!=='active')fail(403,'账号角色已停用，请联系系统管理员','AUTH_ROLE_DISABLED')
 user.failedLoginCount=0;user.lockedUntil='';user.lastLoginAt=now();user.lastLoginIp=String(clientIp||'').slice(0,64);user.updatedAt=now()
 state.audit.unshift({at:now(),actor:user.name,action:'登录河北基地运营管理平台'})
 await commitAccess(state)
 return publicUser(user)
}

export async function changePassword(userId,currentPassword,newPassword){
 const state=loadAccess(),user=state.users.find(item=>item.id===userId)
 if(!user)fail(404,'用户不存在')
 if(!verifyPassword(currentPassword,user.passwordHash))fail(400,'当前密码不正确','AUTH_CURRENT_PASSWORD_INVALID')
 const next=String(newPassword||'')
 if(next.length<8)fail(400,'新密码至少需要8位')
 if(verifyPassword(next,user.passwordHash))fail(400,'新密码不能与当前密码相同')
 const firstLogin=user.forceChangePassword
 user.passwordHash=hashPassword(next);user.forceChangePassword=false;user.passwordChangedAt=now();user.sessionVersion=Number(user.sessionVersion||1)+1;user.updatedAt=now()
 state.audit.unshift({at:now(),actor:user.name,action:firstLogin?'完成首次登录密码修改':'修改登录密码'})
 await commitAccess(state)
 return publicUser(user)
}

export async function revokeSessions(userId){
 const state=loadAccess(),user=state.users.find(item=>item.id===userId)
 if(!user)return
 user.sessionVersion=Number(user.sessionVersion||1)+1
 user.updatedAt=now()
 await commitAccess(state)
}

export async function saveUser(input,actorUserId){
 const state=loadAccess(),actor=requirePermission(state,actorUserId,'user-management')
 const id=String(input.id||'').trim(),existing=state.users.find(user=>user.id===id)
 const required=['name','jobNo','jobTitle','department','roleId']
 if(required.some(field=>!String(input[field]||'').trim()))fail(400,'请完整填写姓名、工号、岗位、组织和角色')
 const role=state.roles.find(item=>item.id===input.roleId)
 if(!role||role.status!=='active')fail(400,'所选角色不存在或已停用')
 const jobNo=String(input.jobNo).trim()
 if(state.users.some(user=>user.id!==id&&user.jobNo.toLowerCase()===jobNo.toLowerCase()))fail(409,`工号 ${jobNo} 已存在`)
 const password=String(input.password||'')
 if(!existing&&!password)fail(400,'新增用户必须设置初始密码')
 if(password&&password.length<8)fail(400,'初始密码至少需要8位')
 const record={
  id:existing?.id||nextUserId(state.users),name:String(input.name).trim().slice(0,40),jobNo:jobNo.slice(0,40),roleId:role.id,
  jobTitle:String(input.jobTitle).trim().slice(0,80),department:String(input.department).trim().slice(0,120),
  phone:String(input.phone||'').trim().slice(0,30),email:String(input.email||'').trim().slice(0,120),
  status:input.status==='disabled'?'disabled':'active',passwordHash:password?hashPassword(password):existing.passwordHash,
  forceChangePassword:password?true:Boolean(existing?.forceChangePassword),passwordChangedAt:password?'':existing?.passwordChangedAt||'',
  failedLoginCount:0,lockedUntil:'',lastLoginAt:existing?.lastLoginAt||'',lastLoginIp:existing?.lastLoginIp||'',
  sessionVersion:Number(existing?.sessionVersion||1)+(password?1:0),moduleOverrides:uniqueMenus(input.moduleOverrides),
  createdAt:existing?.createdAt||now().slice(0,10),updatedAt:now(),
 }
 if(existing)state.users=state.users.map(user=>user.id===existing.id?record:user)
 else state.users.push(record)
 state.audit.unshift({at:now(),actor:actor.name,action:`${existing?'更新':'创建'}用户${record.name}（${record.jobNo}）`})
 return publicAccess(await commitAccess(state))
}

export async function userAction(id,action,actorUserId,options={}){
 const state=loadAccess(),actor=requirePermission(state,actorUserId,'user-management')
 const user=state.users.find(item=>item.id===id)
 if(!user)fail(404,'用户不存在')
 if(action==='toggle_status'){
  if(user.id===actor.id&&user.status==='active')fail(409,'不能停用当前操作账号')
  if(user.roleId==='system-admin'&&user.status==='active'&&state.users.filter(item=>item.roleId==='system-admin'&&item.status==='active').length<=1)fail(409,'至少需要保留一个启用的系统管理员')
  user.status=user.status==='active'?'disabled':'active';user.sessionVersion=Number(user.sessionVersion||1)+1;user.updatedAt=now()
  state.audit.unshift({at:now(),actor:actor.name,action:`${user.status==='active'?'启用':'停用'}用户${user.name}（${user.jobNo}）`})
 }else if(action==='reset_password'){
  const temporaryPassword=String(options.temporaryPassword||'')
  if(temporaryPassword.length<8)fail(400,'请设置至少8位的一次性初始密码')
  user.passwordHash=hashPassword(temporaryPassword);user.forceChangePassword=true;user.passwordChangedAt='';user.failedLoginCount=0;user.lockedUntil='';user.sessionVersion=Number(user.sessionVersion||1)+1;user.updatedAt=now()
  state.audit.unshift({at:now(),actor:actor.name,action:`重置用户${user.name}密码并要求首次登录改密`})
 }else fail(400,'不支持的用户操作')
 return publicAccess(await commitAccess(state))
}

export async function saveRole(input,actorUserId){
 const state=loadAccess(),actor=requirePermission(state,actorUserId,'role-management')
 const existing=state.roles.find(role=>role.id===input.id)
 const name=String(input.name||'').trim(),code=String(input.code||'').trim().toUpperCase(),menus=uniqueMenus(input.menus)
 if(!name||!code)fail(400,'请填写角色名称和角色编码')
 if(!menus.length)fail(400,'请至少选择一个菜单权限')
 if(state.roles.some(role=>role.id!==existing?.id&&role.code.toLowerCase()===code.toLowerCase()))fail(409,`角色编码 ${code} 已存在`)
 const status=input.status==='disabled'?'disabled':'active'
 if(existing?.id==='system-admin'&&status==='disabled')fail(409,'系统管理员角色不可停用')
 if(existing&&status==='disabled'&&state.users.some(user=>user.roleId===existing.id&&user.status==='active'))fail(409,'该角色仍有关联的启用账号，不能停用')
 const record={
  id:existing?.id||nextRoleId(state.roles,code),name:name.slice(0,40),code:existing?.builtIn?existing.code:code.slice(0,80),
  level:String(input.level||'自定义').slice(0,40),description:String(input.description||'').trim().slice(0,300),
  memberCount:0,menus,builtIn:Boolean(existing?.builtIn),status,
 }
 if(existing)state.roles=state.roles.map(role=>role.id===existing.id?record:role)
 else state.roles.push(record)
 state.audit.unshift({at:now(),actor:actor.name,action:`${existing?'更新':'创建'}角色${record.name}（${record.code}）`})
 return publicAccess(await commitAccess(state))
}

export async function deleteRole(id,actorUserId){
 const state=loadAccess(),actor=requirePermission(state,actorUserId,'role-management')
 const role=state.roles.find(item=>item.id===id)
 if(!role)fail(404,'角色不存在')
 if(role.builtIn)fail(409,'内置角色不可删除')
 const count=state.users.filter(user=>user.roleId===role.id).length
 if(count)fail(409,`该角色仍关联${count}名用户，请先重新分配账号`)
 state.roles=state.roles.filter(item=>item.id!==id)
 state.audit.unshift({at:now(),actor:actor.name,action:`删除角色${role.name}（${role.code}）`})
 return publicAccess(await commitAccess(state))
}

const nextUserId=users=>{
 const max=users.reduce((value,user)=>{const match=user.id.match(/^U(\d+)$/);return match?Math.max(value,Number(match[1])):value},0)
 return `U${String(max+1).padStart(3,'0')}`
}
const nextRoleId=(roles,code)=>{
 const base=`custom-${code.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'role'}`
 let id=base,index=2
 while(roles.some(role=>role.id===id)){id=`${base}-${index++}`}
 return id
}

export async function resetAccess(){return publicAccess(await commitAccess(initialState()))}
export { accessFile, allowedMenus }
