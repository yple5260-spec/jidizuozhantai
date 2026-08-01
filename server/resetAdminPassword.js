import './env.js'
import { createHash, randomBytes, scryptSync } from 'node:crypto'
import { databaseClose, databaseConfigured, databaseTransaction } from './database.js'

const jobNo=String(process.env.RESET_ADMIN_JOB_NO||'JZ053684').trim()
const password=String(process.env.RESET_ADMIN_PASSWORD||'')

if(!databaseConfigured())throw new Error('DATABASE_URL未配置，不能执行数据库管理员密码恢复')
if(!jobNo)throw new Error('RESET_ADMIN_JOB_NO不能为空')
if(password.length<8)throw new Error('RESET_ADMIN_PASSWORD必须至少8位')

const hashPassword=value=>{
 const salt=randomBytes(16).toString('hex')
 return `scrypt$${salt}$${scryptSync(value,salt,64).toString('hex')}`
}

try{
 await databaseTransaction(async connection=>{
  const [result]=await connection.query(`
   UPDATE platform_system_user
   SET password_hash=?,force_change_password=1,password_changed_at=NULL,failed_login_count=0,locked_until=NULL,
       status='active',session_version=session_version+1,updated_at=CURRENT_TIMESTAMP(3)
   WHERE job_no=? AND role_id='system-admin'`,[hashPassword(password),jobNo])
  if(result.affectedRows!==1)throw new Error(`未找到系统管理员账号：${jobNo}`)
  const createdAt=new Date()
  const action=`管理员密码通过本地恢复命令重置：${jobNo}`
  const fingerprint=createHash('sha256').update(`${createdAt.toISOString()}|系统恢复工具|${action}`).digest('hex')
  await connection.query(
   'INSERT INTO platform_access_audit(fingerprint,actor_name,action_code,action_note,created_at) VALUES (?,?,?,?,?)',
   [fingerprint,'系统恢复工具','admin_password_reset',action,createdAt],
  )
 })
 console.log(`管理员账号已恢复：${jobNo}；已清除锁定并要求首次登录修改密码。`)
}finally{
 await databaseClose()
}
