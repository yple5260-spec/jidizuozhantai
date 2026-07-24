import fs from 'node:fs'
import path from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { dataDir } from './store.js'

const accessFile=path.join(dataDir,'access-control.json')
const tempFile=path.join(dataDir,'access-control.tmp.json')
const allowedMenus=['command','industry-news','settlement','alerts','meeting','team','workforce','tasks','reports','growth','salary','user-management','role-management','ai-settings']
const now=()=>new Date().toISOString()
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
 {id:'operation-director',name:'运营总监',code:'OPERATION_DIRECTOR',level:'基地级',description:'关注基地经营、甲方动态、行业舆情、结费回款和组织效能。',memberCount:0,menus:['command','industry-news','settlement','alerts','workforce','tasks','reports','salary'],builtIn:true,status:'active'},
 {id:'customer-manager',name:'客服经理',code:'CUSTOMER_MANAGER',level:'业务线级',description:'负责业务KPI、组织效能、主管及班组管理。',memberCount:0,menus:['command','alerts','team','workforce','tasks','reports','growth'],builtIn:true,status:'active'},
 {id:'customer-supervisor',name:'客服主管',code:'CUSTOMER_SUPERVISOR',level:'区域级',description:'负责现场调度、绩效改善、班长履职和质量风险。',memberCount:0,menus:['command','alerts','meeting','team','workforce','tasks','reports','growth'],builtIn:true,status:'active'},
 {id:'team-leader',name:'客服班长',code:'TEAM_LEADER',level:'班组级',description:'负责班前会、班组看数、面谈辅导及任务闭环。',memberCount:0,menus:['command','alerts','meeting','team','workforce','tasks','reports','growth'],builtIn:true,status:'active'},
 {id:'customer-agent',name:'客服专员',code:'CUSTOMER_AGENT',level:'个人级',description:'查看个人绩效、培训任务、排班和薪资信息。',memberCount:0,menus:['command','workforce','tasks','growth','salary'],builtIn:true,status:'active'},
 {id:'quality-specialist',name:'质检专员',code:'QUALITY_SPECIALIST',level:'专业岗',description:'AI辅助质检、质量分析、合规事件和整改闭环。',memberCount:0,menus:['command','alerts','tasks','reports','growth'],builtIn:true,status:'active'},
 {id:'training-manager',name:'培训主管',code:'TRAINING_MANAGER',level:'专业岗',description:'培训需求、课程计划、AI教官及培训效果评估。',memberCount:0,menus:['command','tasks','reports','growth'],builtIn:true,status:'active'},
 {id:'hrbp-manager',name:'HRBP经理',code:'HRBP_MANAGER',level:'专业岗',description:'人员档案、流失预警、招聘缺口和组织效能。',memberCount:0,menus:['command','alerts','workforce','tasks','reports','salary'],builtIn:true,status:'active'},
]

const initialState=()=>({
 version:2,
 users:[
  {id:'U001',name:'李燕鹏',jobNo:'JZ053684',roleId:'system-admin',jobTitle:'运营总监',department:'河北基地 · 客户驱动部',phone:'',email:'',status:'active',passwordHash:hashPassword('000000'),forceChangePassword:true,moduleOverrides:[],createdAt:'2026-07-21',updatedAt:now()},
  {id:'U002',name:'吴欣欣',jobNo:'JZ001218',roleId:'customer-manager',jobTitle:'客服经理',department:'河北基地 · 10015升投',phone:'',email:'',status:'active',passwordHash:hashPassword('000000'),forceChangePassword:true,moduleOverrides:[],createdAt:'2026-07-21',updatedAt:now()},
 ],
 roles:roleSeeds(),
 audit:[{at:now(),actor:'系统',action:'初始化用户与角色权限配置'}],
})

const write=state=>{
 fs.mkdirSync(dataDir,{recursive:true})
 fs.writeFileSync(tempFile,JSON.stringify(state,null,2),{encoding:'utf8',mode:0o600})
 fs.renameSync(tempFile,accessFile)
 try{fs.chmodSync(accessFile,0o600)}catch{}
 return state
}

export function loadAccess(){
 if(!fs.existsSync(accessFile))return write(initialState())
 try{
  const parsed=JSON.parse(fs.readFileSync(accessFile,'utf8'))
  if(!Array.isArray(parsed.users)||!Array.isArray(parsed.roles)||!Array.isArray(parsed.audit))throw new Error('权限文件结构不完整')
  if(Number(parsed.version||1)<2){
   const workforceRoles=new Set(['system-admin','operation-director','customer-manager','customer-supervisor','team-leader','customer-agent','hrbp-manager'])
   parsed.roles.forEach(role=>{if(workforceRoles.has(role.id))role.menus=uniqueMenus([...(role.menus||[]),'workforce'])})
   parsed.version=2
   parsed.audit.unshift({at:now(),actor:'系统',action:'升级组织与排班模块岗位权限'})
   return write(parsed)
  }
  return parsed
 }catch(error){
  console.warn(`权限配置读取失败，自动恢复：${error.message}`)
  return write(initialState())
 }
}

const publicUser=user=>{
 const {passwordHash,...safe}=user
 return {...safe,password:''}
}
export const publicAccess=state=>{
 const memberCounts=new Map(state.roles.map(role=>[role.id,state.users.filter(user=>user.roleId===role.id).length]))
 return {users:state.users.map(publicUser),roles:state.roles.map(role=>({...role,memberCount:memberCounts.get(role.id)||0})),audit:state.audit.slice(0,100)}
}

export function requirePermission(state,actorUserId,permission){
 const actor=state.users.find(user=>user.id===actorUserId)
 if(!actor||actor.status!=='active')fail(403,'当前操作账号不存在或已停用','ACCESS_FORBIDDEN')
 const role=state.roles.find(item=>item.id===actor.roleId)
 if(!role||role.status!=='active'||(!role.menus.includes(permission)&&!actor.moduleOverrides.includes(permission)))fail(403,'当前账号没有此系统管理权限','ACCESS_FORBIDDEN')
 return actor
}

export function authenticate(jobNo,password){
 const state=loadAccess(),normalized=String(jobNo||'').trim().toLowerCase()
 const user=state.users.find(item=>item.jobNo.toLowerCase()===normalized)
 if(!user||!verifyPassword(password,user.passwordHash))fail(401,'账号或密码不正确','AUTH_INVALID_CREDENTIALS')
 if(user.status!=='active')fail(403,'账号已停用，请联系系统管理员','AUTH_ACCOUNT_DISABLED')
 const role=state.roles.find(item=>item.id===user.roleId)
 if(!role||role.status!=='active')fail(403,'账号角色已停用，请联系系统管理员','AUTH_ROLE_DISABLED')
 state.audit.unshift({at:now(),actor:user.name,action:'登录河北基地运营管理平台'})
 write(state)
 return publicUser(user)
}

export function changePassword(userId,currentPassword,newPassword){
 const state=loadAccess(),user=state.users.find(item=>item.id===userId)
 if(!user)fail(404,'用户不存在')
 if(!verifyPassword(currentPassword,user.passwordHash))fail(400,'当前密码不正确','AUTH_CURRENT_PASSWORD_INVALID')
 const next=String(newPassword||'')
 if(next.length<8)fail(400,'新密码至少需要8位')
 if(verifyPassword(next,user.passwordHash))fail(400,'新密码不能与当前密码相同')
 const firstLogin=user.forceChangePassword
 user.passwordHash=hashPassword(next);user.forceChangePassword=false;user.updatedAt=now()
 state.audit.unshift({at:now(),actor:user.name,action:firstLogin?'完成首次登录密码修改':'修改登录密码'})
 write(state)
 return publicUser(user)
}

export function saveUser(input,actorUserId){
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
 if(password&&password.length<6)fail(400,'初始密码至少需要6位')
 const record={
  id:existing?.id||nextUserId(state.users),name:String(input.name).trim().slice(0,40),jobNo:jobNo.slice(0,40),roleId:role.id,
  jobTitle:String(input.jobTitle).trim().slice(0,80),department:String(input.department).trim().slice(0,120),
  phone:String(input.phone||'').trim().slice(0,30),email:String(input.email||'').trim().slice(0,120),
  status:input.status==='disabled'?'disabled':'active',passwordHash:password?hashPassword(password):existing.passwordHash,
  forceChangePassword:password?true:Boolean(existing?.forceChangePassword),moduleOverrides:uniqueMenus(input.moduleOverrides),
  createdAt:existing?.createdAt||now().slice(0,10),updatedAt:now(),
 }
 if(existing)state.users=state.users.map(user=>user.id===existing.id?record:user)
 else state.users.push(record)
 state.audit.unshift({at:now(),actor:actor.name,action:`${existing?'更新':'创建'}用户${record.name}（${record.jobNo}）`})
 return publicAccess(write(state))
}

export function userAction(id,action,actorUserId){
 const state=loadAccess(),actor=requirePermission(state,actorUserId,'user-management')
 const user=state.users.find(item=>item.id===id)
 if(!user)fail(404,'用户不存在')
 if(action==='toggle_status'){
  if(user.id===actor.id&&user.status==='active')fail(409,'不能停用当前操作账号')
  if(user.roleId==='system-admin'&&user.status==='active'&&state.users.filter(item=>item.roleId==='system-admin'&&item.status==='active').length<=1)fail(409,'至少需要保留一个启用的系统管理员')
  user.status=user.status==='active'?'disabled':'active';user.updatedAt=now()
  state.audit.unshift({at:now(),actor:actor.name,action:`${user.status==='active'?'启用':'停用'}用户${user.name}（${user.jobNo}）`})
 }else if(action==='reset_password'){
  user.passwordHash=hashPassword('000000');user.forceChangePassword=true;user.updatedAt=now()
  state.audit.unshift({at:now(),actor:actor.name,action:`重置用户${user.name}密码并要求首次登录改密`})
 }else fail(400,'不支持的用户操作')
 return publicAccess(write(state))
}

export function saveRole(input,actorUserId){
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
 return publicAccess(write(state))
}

export function deleteRole(id,actorUserId){
 const state=loadAccess(),actor=requirePermission(state,actorUserId,'role-management')
 const role=state.roles.find(item=>item.id===id)
 if(!role)fail(404,'角色不存在')
 if(role.builtIn)fail(409,'内置角色不可删除')
 const count=state.users.filter(user=>user.roleId===role.id).length
 if(count)fail(409,`该角色仍关联${count}名用户，请先重新分配账号`)
 state.roles=state.roles.filter(item=>item.id!==id)
 state.audit.unshift({at:now(),actor:actor.name,action:`删除角色${role.name}（${role.code}）`})
 return publicAccess(write(state))
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

export function resetAccess(){return publicAccess(write(initialState()))}
export { accessFile, allowedMenus }
