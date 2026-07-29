import { databaseConfigured, databaseQuery, databaseTransaction } from './database.js'
import { syncBusinessStateWithConnection } from './businessPersistence.js'
import { load as loadLocal, reset as resetLocal, save as saveLocal } from './store.js'
import { normalizeLeanState } from './leanPdca.js'

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

export const initializeStatePersistence=async()=>{
 if(!databaseConfigured()){
  databaseMode=false
  runtimeState=normalizeLeanState(loadLocal())
  runtimeRevision=Number(runtimeState.persistenceRevision||0)
  return {mode:'local',revision:runtimeRevision,imported:false}
 }
 const rows=await databaseQuery('SELECT payload_json,revision FROM platform_state_snapshot WHERE snapshot_key=?',[snapshotKey])
 if(rows.length){
  const payload=typeof rows[0].payload_json==='string'?JSON.parse(rows[0].payload_json):rows[0].payload_json
  const normalized=normalizeLeanState(payload)
  runtimeRevision=Number(rows[0].revision||1)
  if(JSON.stringify(normalized)!==JSON.stringify(payload)){
   await databaseTransaction(async connection=>{
    await connection.query(
     'UPDATE platform_state_snapshot SET payload_json=? WHERE snapshot_key=? AND revision=?',
     [JSON.stringify(cleanForStorage(normalized)),snapshotKey,runtimeRevision],
    )
    await syncBusinessStateWithConnection(connection,normalized)
   })
  }
  runtimeState=withRevision(normalized,runtimeRevision)
  databaseMode=true
  return {mode:'mysql',revision:runtimeRevision,imported:false}
 }
 const seed=cleanForStorage(normalizeLeanState(loadLocal()))
 await databaseTransaction(async connection=>{
  await connection.query('INSERT INTO platform_state_snapshot(snapshot_key,payload_json,revision) VALUES (?,?,1)',[snapshotKey,JSON.stringify(seed)])
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
 const clean=cleanForStorage(state)
 if(!databaseMode){
  saveLocal(clean)
  runtimeState=withRevision(clean,runtimeRevision)
  return loadState()
 }
 const expected=Number(state.persistenceRevision||runtimeRevision)
 if(expected!==runtimeRevision)throw Object.assign(new Error('业务状态已被其他操作更新，请刷新后重试'),{status:409,code:'STATE_REVISION_CONFLICT'})
 const nextRevision=runtimeRevision+1
 await databaseTransaction(async connection=>{
  const [result]=await connection.query(
   'UPDATE platform_state_snapshot SET payload_json=?,revision=? WHERE snapshot_key=? AND revision=?',
   [JSON.stringify(clean),nextRevision,snapshotKey,runtimeRevision],
  )
  if(result.affectedRows!==1)throw Object.assign(new Error('业务状态版本冲突，请刷新后重试'),{status:409,code:'STATE_REVISION_CONFLICT'})
  await syncBusinessStateWithConnection(connection,clean)
 })
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
