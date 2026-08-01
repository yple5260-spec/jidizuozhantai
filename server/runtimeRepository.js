import { createHash, randomUUID } from 'node:crypto'
import { databaseConfigured, databaseQuery, databaseTransaction } from './database.js'

const threadId=(userId,role)=>createHash('sha256').update(`${userId}:${role}`).digest('hex')

export const notificationReadIds=async userId=>{
 if(!databaseConfigured())return []
 const rows=await databaseQuery('SELECT notification_id FROM platform_notification_receipt WHERE user_id=?',[userId])
 return rows.map(row=>row.notification_id)
}

export const markNotificationRead=async(userId,notificationIds)=>{
 if(!databaseConfigured())return
 for(const id of Array.from(new Set(notificationIds.filter(Boolean)))){
  await databaseQuery('INSERT IGNORE INTO platform_notification_receipt(notification_id,user_id) VALUES (?,?)',[String(id).slice(0,128),userId])
 }
}

export const applyRuntimeRetention=async()=>{
 if(!databaseConfigured())return
 await databaseTransaction(async connection=>{
  await connection.query("DELETE FROM platform_notification WHERE target_role='data'")
  await connection.query("DELETE FROM platform_notification WHERE created_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 90 DAY)")
  await connection.query("DELETE FROM platform_notification_receipt WHERE notification_id NOT IN (SELECT id FROM platform_notification)")
  await connection.query("DELETE FROM platform_audit_log WHERE actor_name='定时调度器' OR occurred_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 365 DAY)")
  await connection.query("DELETE FROM platform_business_audit WHERE created_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 365 DAY)")
  await connection.query("DELETE FROM platform_scheduler_execution WHERE completed_at IS NOT NULL AND completed_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 30 DAY)")
  await connection.query("DELETE FROM platform_business_outbox WHERE status='completed' AND processed_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 7 DAY)")
 })
}

export const aiHistory=async(userId,role,limit=40)=>{
 if(!databaseConfigured())return []
 const id=threadId(userId,role)
 const rows=await databaseQuery(`
  SELECT message_role AS role,content_text AS content,model_name AS model,created_at AS createdAt
  FROM platform_ai_message WHERE thread_id=? ORDER BY id DESC LIMIT ?`,[id,Math.min(Math.max(Number(limit)||40,1),100)])
 return rows.reverse().map(row=>({...row,createdAt:new Date(row.createdAt).toISOString()}))
}

export const appendAiExchange=async({userId,role,userMessage,assistantMessage,model,usage,context})=>{
 if(!databaseConfigured())return
 const id=threadId(userId,role)
 await databaseQuery(`
  INSERT INTO platform_ai_thread(id,user_id,runtime_role,title,status)
  VALUES (?,?,?,?,'active')
  ON DUPLICATE KEY UPDATE status='active',updated_at=CURRENT_TIMESTAMP(3)`,[
  id,userId,role,String(userMessage||'新对话').slice(0,80),
 ])
 await databaseQuery(`
  INSERT INTO platform_ai_message(thread_id,message_role,content_text,model_name,token_usage_json,context_json)
  VALUES (?,?,?,?,?,?),(?,?,?,?,?,?)`,[
  id,'user',String(userMessage||''),null,null,JSON.stringify(context||{}),
  id,'assistant',String(assistantMessage||''),model||null,JSON.stringify(usage||{}),JSON.stringify(context||{}),
 ])
}

export const clearAiHistory=async(userId,role)=>{
 if(!databaseConfigured())return
 const id=threadId(userId,role)
 await databaseQuery('DELETE FROM platform_ai_message WHERE thread_id=?',[id])
 await databaseQuery('DELETE FROM platform_ai_thread WHERE id=?',[id])
}

export const claimScheduledBatch=async(jobName,batchKey,ownerId)=>{
 if(!databaseConfigured())return true
 const result=await databaseQuery(`
  INSERT IGNORE INTO platform_scheduler_execution(job_name,batch_key,status,owner_id)
  VALUES (?,?,'running',?)`,[jobName,batchKey,ownerId])
 return result.affectedRows===1
}

export const finishScheduledBatch=async(jobName,batchKey,status,resultText)=>{
 if(!databaseConfigured())return
 await databaseQuery(`
  UPDATE platform_scheduler_execution SET status=?,completed_at=CURRENT_TIMESTAMP(3),result_text=?
  WHERE job_name=? AND batch_key=?`,[status,String(resultText||'').slice(0,2000),jobName,batchKey])
}

export const saveTaskAttachment=async({taskId,nodeCode,fileName,mimeType,content,uploadedBy,uploadedRole})=>{
 if(!databaseConfigured())throw Object.assign(new Error('附件必须保存到MySQL，请先配置DATABASE_URL'),{status:503,code:'ATTACHMENT_DATABASE_REQUIRED'})
 const id=`ATT-${randomUUID()}`
 await databaseQuery(`
  INSERT INTO platform_pdca_attachment
   (id,task_id,node_code,file_name,mime_type,file_size,content_blob,uploaded_by,uploaded_role)
  VALUES (?,?,?,?,?,?,?,?,?)`,[
  id,taskId,nodeCode,fileName,mimeType,content.length,content,uploadedBy,uploadedRole,
 ])
 return {id,taskId,nodeCode,fileName,mimeType,fileSize:content.length,uploadedBy,uploadedRole,createdAt:new Date().toISOString()}
}

export const deleteTaskAttachment=async id=>{
 if(databaseConfigured())await databaseQuery('DELETE FROM platform_pdca_attachment WHERE id=?',[id])
}

export const loadTaskAttachment=async(taskId,id)=>{
 if(!databaseConfigured())return null
 const rows=await databaseQuery(`
  SELECT id,task_id AS taskId,file_name AS fileName,mime_type AS mimeType,file_size AS fileSize,
   content_blob AS content,uploaded_by AS uploadedBy,created_at AS createdAt
  FROM platform_pdca_attachment WHERE id=? AND task_id=?`,[id,taskId])
 return rows[0]||null
}
