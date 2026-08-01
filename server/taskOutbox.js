import { randomUUID } from 'node:crypto'
import { databaseConfigured, databaseTransaction } from './database.js'
import { syncTaskDerivedWithConnection } from './taskActionPersistence.js'

const workerId=`task-outbox-${randomUUID()}`
let timer=null
let running=false

const claim=()=>databaseTransaction(async connection=>{
 const [rows]=await connection.query(`
  SELECT id,aggregate_id,event_type,state_revision,payload_json
  FROM platform_business_outbox
  WHERE (status IN ('pending','failed') AND available_at<=CURRENT_TIMESTAMP(3))
     OR (status='processing' AND locked_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 5 MINUTE))
  ORDER BY id
  LIMIT 1
  FOR UPDATE`)
 const event=rows[0]
 if(!event)return null
 await connection.query(`
  UPDATE platform_business_outbox
  SET status='processing',attempts=attempts+1,locked_at=CURRENT_TIMESTAMP(3),locked_by=?,last_error=NULL
  WHERE id=?`,[workerId,event.id])
 return event
})

const complete=event=>databaseTransaction(async connection=>{
 const [revisionRows]=await connection.query(
  'SELECT state_revision FROM platform_pdca_projection_revision WHERE task_id=? FOR UPDATE',
  [event.aggregate_id],
 )
 const projectedRevision=Number(revisionRows[0]?.state_revision||0)
 if(projectedRevision<Number(event.state_revision)){
  const payload=typeof event.payload_json==='string'?JSON.parse(event.payload_json):event.payload_json
  if(!payload?.task)throw new Error('任务异步事件缺少task载荷')
  await syncTaskDerivedWithConnection(connection,payload.task)
  await connection.query(`
   INSERT INTO platform_pdca_projection_revision(task_id,state_revision)
   VALUES (?,?)
   ON DUPLICATE KEY UPDATE state_revision=VALUES(state_revision)`,[
   event.aggregate_id,Number(event.state_revision),
  ])
 }
 await connection.query(`
  UPDATE platform_business_outbox
  SET status='completed',processed_at=CURRENT_TIMESTAMP(3),locked_at=NULL,locked_by=NULL
  WHERE id=?`,[event.id])
})

const fail=async(event,error)=>{
 const delaySeconds=Math.min(300,Math.max(2,2**Math.min(Number(event.attempts||1),8)))
 await databaseTransaction(connection=>connection.query(`
  UPDATE platform_business_outbox
  SET status='failed',available_at=DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL ? SECOND),
      locked_at=NULL,locked_by=NULL,last_error=?
  WHERE id=?`,[delaySeconds,String(error?.code||error?.message||'异步投影失败').slice(0,2000),event.id]))
}

export const drainTaskOutbox=async(limit=20)=>{
 if(!databaseConfigured()||running)return 0
 running=true
 let processed=0
 try{
  while(processed<limit){
   const event=await claim()
   if(!event)break
   try{await complete(event);processed+=1}
   catch(error){await fail(event,error);console.error(`任务异步投影失败 #${event.id}: ${error.code||error.message}`);break}
  }
 }finally{running=false}
 return processed
}

export const nudgeTaskOutbox=()=>{if(databaseConfigured())setImmediate(()=>void drainTaskOutbox())}

export const startTaskOutboxWorker=()=>{
 if(!databaseConfigured()||timer)return
 timer=setInterval(()=>void drainTaskOutbox(),2_000)
 timer.unref()
 nudgeTaskOutbox()
}

export const stopTaskOutboxWorker=()=>{
 if(timer)clearInterval(timer)
 timer=null
}
