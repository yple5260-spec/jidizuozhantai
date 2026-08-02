import { databaseConfigured, databaseQuery, databaseTransaction } from './database.js'
import { syncBusinessStateWithConnection } from './businessPersistence.js'
import { load as loadLocal, normalizeState, reset as resetLocal, save as saveLocal } from './store.js'
import { normalizeLeanState } from './leanPdca.js'
import { persistTaskActionCoreWithConnection } from './taskActionPersistence.js'
import { nudgeTaskOutbox } from './taskOutbox.js'

const snapshotKey='primary'
let databaseMode=false
let runtimeState=null
let runtimeRevision=0

const clone=value=>structuredClone(value)
const withRevision=(state,revision)=>{
 const next=clone(state)
 next.persistenceRevision=revision
 return next
}
const cleanForStorage=state=>{
 const next=clone(state)
 delete next.persistenceRevision
 return next
}
const cleanForSnapshot=state=>{
 const next=cleanForStorage(state)
 delete next.notifications
 delete next.audit
 return next
}
const capRuntimeRecords=state=>({
 ...state,
 notifications:(state.notifications||[]).filter(item=>item.role!=='data').slice(0,500),
 audit:(state.audit||[]).filter(item=>item.actor!=='定时调度器').slice(0,500),
})
const loadPersistedNotifications=async()=>{
 const rows=await databaseQuery(`
  SELECT id,target_role AS role,title,description_text AS description,target_module AS target,priority,created_at AS createdAt
  FROM platform_notification
  WHERE target_role<>'data' AND created_at>=DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 90 DAY)
  ORDER BY created_at DESC
  LIMIT 500`)
 return rows.map(item=>({
  id:item.id,role:item.role,title:item.title,desc:item.description||'',target:item.target||'command',
  priority:item.priority||'normal',createdAt:new Date(item.createdAt).toISOString(),read:false,
 }))
}
const reloadRuntimeSnapshot=async()=>{
 if(!databaseMode)return
 const rows=await databaseQuery('SELECT payload_json,revision FROM platform_state_snapshot WHERE snapshot_key=?',[snapshotKey])
 if(!rows.length)return
 const payload=typeof rows[0].payload_json==='string'?JSON.parse(rows[0].payload_json):rows[0].payload_json
 const normalized=capRuntimeRecords(normalizeLeanState(normalizeState({...payload,notifications:await loadPersistedNotifications(),audit:[]})))
 runtimeRevision=Number(rows[0].revision||1);runtimeState=withRevision(normalized,runtimeRevision)
}
const revisionConflict=async message=>{
 await reloadRuntimeSnapshot()
 return Object.assign(new Error(message),{status:409,code:'STATE_REVISION_CONFLICT',retryable:true})
}

export const initializeStatePersistence=async()=>{
 if(!databaseConfigured()){
  databaseMode=false
  runtimeState=capRuntimeRecords(normalizeLeanState(loadLocal()))
  runtimeRevision=Number(runtimeState.persistenceRevision||0)
  return {mode:'local',revision:runtimeRevision,imported:false}
 }
 const rows=await databaseQuery('SELECT payload_json,revision FROM platform_state_snapshot WHERE snapshot_key=?',[snapshotKey])
 if(rows.length){
  const payload=typeof rows[0].payload_json==='string'?JSON.parse(rows[0].payload_json):rows[0].payload_json
  const normalized=capRuntimeRecords(normalizeLeanState(normalizeState({...payload,notifications:await loadPersistedNotifications(),audit:[]})))
  runtimeRevision=Number(rows[0].revision||1)
  const snapshot=cleanForSnapshot(normalized)
  if(JSON.stringify(snapshot)!==JSON.stringify(payload)){
   await databaseTransaction(async connection=>{
    await connection.query(
     'UPDATE platform_state_snapshot SET payload_json=? WHERE snapshot_key=? AND revision=?',
     [JSON.stringify(snapshot),snapshotKey,runtimeRevision],
    )
    await syncBusinessStateWithConnection(connection,normalized)
   })
  }
  runtimeState=withRevision(normalized,runtimeRevision)
  databaseMode=true
  return {mode:'mysql',revision:runtimeRevision,imported:false}
 }
 const seed=capRuntimeRecords(cleanForStorage(normalizeLeanState(loadLocal())))
 await databaseTransaction(async connection=>{
  await connection.query('INSERT INTO platform_state_snapshot(snapshot_key,payload_json,revision) VALUES (?,?,1)',[snapshotKey,JSON.stringify(cleanForSnapshot(seed))])
  await syncBusinessStateWithConnection(connection,seed)
 })
 runtimeRevision=1
 runtimeState=withRevision(seed,runtimeRevision)
 databaseMode=true
 return {mode:'mysql',revision:runtimeRevision,imported:true}
}

export const loadState=()=>{
 if(!runtimeState)runtimeState=loadLocal()
 return clone(runtimeState)
}

export const saveState=async state=>{
 const clean=capRuntimeRecords(cleanForStorage(normalizeLeanState(normalizeState(state))))
 if(!databaseMode){
  saveLocal(clean)
  runtimeState=withRevision(clean,runtimeRevision)
  return loadState()
 }
 const expected=Number(state.persistenceRevision||runtimeRevision)
 if(expected!==runtimeRevision)throw await revisionConflict('业务状态已被其他操作更新，服务已自动同步，请重试')
 const nextRevision=runtimeRevision+1
 await databaseTransaction(async connection=>{
  const [result]=await connection.query(
   'UPDATE platform_state_snapshot SET payload_json=?,revision=? WHERE snapshot_key=? AND revision=?',
   [JSON.stringify(cleanForSnapshot(clean)),nextRevision,snapshotKey,runtimeRevision],
  )
  if(result.affectedRows!==1)throw Object.assign(new Error('业务状态版本冲突'),{status:409,code:'STATE_REVISION_CONFLICT'})
  await syncBusinessStateWithConnection(connection,clean)
 }).catch(async error=>{if(error.code==='STATE_REVISION_CONFLICT')throw await revisionConflict('业务状态版本冲突，服务已自动同步，请重试');throw error})
 runtimeRevision=nextRevision
 runtimeState=withRevision(clean,runtimeRevision)
 return loadState()
}

export const saveTaskActionState=async(state,actionContext)=>{
 const clean=capRuntimeRecords(cleanForStorage(normalizeLeanState(normalizeState(state))))
 if(!databaseMode){
  saveLocal(clean)
  runtimeState=withRevision(clean,runtimeRevision)
  return loadState()
 }
 const expected=Number(state.persistenceRevision||runtimeRevision)
 if(expected!==runtimeRevision)throw await revisionConflict('业务状态已被其他操作更新，服务已自动同步，请重试')
 const nextRevision=runtimeRevision+1
 const task=clean.tasks?.find(item=>item.id===actionContext.taskId)
 if(!task)throw Object.assign(new Error('待保存任务不存在'),{status:404,code:'TASK_NOT_FOUND'})
 await databaseTransaction(async connection=>{
  const [result]=await connection.query(
   'UPDATE platform_state_snapshot SET payload_json=?,revision=? WHERE snapshot_key=? AND revision=?',
   [JSON.stringify(cleanForSnapshot(clean)),nextRevision,snapshotKey,runtimeRevision],
  )
  if(result.affectedRows!==1)throw Object.assign(new Error('业务状态版本冲突'),{status:409,code:'STATE_REVISION_CONFLICT'})
  await persistTaskActionCoreWithConnection(connection,{
   task,
   beforeTask:actionContext.beforeTask,
   history:actionContext.history,
   notifications:actionContext.notifications,
   audit:actionContext.audit,
   actorRole:actionContext.actorRole,
   action:actionContext.action,
   stateRevision:nextRevision,
  })
 }).catch(async error=>{if(error.code==='STATE_REVISION_CONFLICT')throw await revisionConflict('业务状态版本冲突，服务已自动同步，请重试');throw error})
 runtimeRevision=nextRevision
 runtimeState=withRevision(clean,runtimeRevision)
 nudgeTaskOutbox()
 return loadState()
}

export const saveSnapshotOnlyState=async state=>{
 const clean=capRuntimeRecords(cleanForStorage(normalizeLeanState(normalizeState(state))))
 if(!databaseMode){
  saveLocal(clean)
  runtimeState=withRevision(clean,runtimeRevision)
  return loadState()
 }
 const expected=Number(state.persistenceRevision||runtimeRevision)
 if(expected!==runtimeRevision)throw await revisionConflict('业务状态已被其他操作更新，服务已自动同步，请重试')
 const nextRevision=runtimeRevision+1
 await databaseTransaction(async connection=>{
  const [result]=await connection.query(
   'UPDATE platform_state_snapshot SET payload_json=?,revision=? WHERE snapshot_key=? AND revision=?',
   [JSON.stringify(cleanForSnapshot(clean)),nextRevision,snapshotKey,runtimeRevision],
  )
  if(result.affectedRows!==1)throw Object.assign(new Error('业务状态版本冲突'),{status:409,code:'STATE_REVISION_CONFLICT'})
 }).catch(async error=>{if(error.code==='STATE_REVISION_CONFLICT')throw await revisionConflict('业务状态版本冲突，服务已自动同步，请重试');throw error})
 runtimeRevision=nextRevision
 runtimeState=withRevision(clean,runtimeRevision)
 return loadState()
}

export const resetState=async()=>{
 const seed=normalizeLeanState(resetLocal())
 seed.persistenceRevision=runtimeRevision
 return saveState(seed)
}

export const statePersistenceMode=()=>databaseMode?'mysql':'local'
