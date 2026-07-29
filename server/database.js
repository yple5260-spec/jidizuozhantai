import mysql from 'mysql2/promise'

let pool

const databaseUrl=()=>String(process.env.DATABASE_URL||'').trim()
export const databaseConfigured=()=>Boolean(databaseUrl())

export const databaseTarget=()=>{
 const value=databaseUrl()
 if(!value)return '未配置'
 try{
  const parsed=new URL(value)
  return `${parsed.hostname}:${parsed.port||'3306'}`
 }catch{
  return 'DATABASE_URL格式无效'
 }
}

const getPool=()=>{
 const value=databaseUrl()
 if(!value)throw Object.assign(new Error('DATABASE_URL未配置'),{code:'DATABASE_URL_MISSING'})
 if(!pool)pool=mysql.createPool(value)
 return pool
}

export const databaseQuery=async(sql,params=[])=>{
 const [rows]=await getPool().query(sql,params)
 return rows
}

export const databaseConnection=async work=>{
 const connection=await getPool().getConnection()
 try{return await work(connection)}
 finally{connection.release()}
}

export const databaseTransaction=async work=>{
 const connection=await getPool().getConnection()
 try{
  await connection.beginTransaction()
  const result=await work(connection)
  await connection.commit()
  return result
 }catch(error){
  await connection.rollback()
  throw error
 }finally{
  connection.release()
 }
}

export const databaseHealth=async()=>{
 const target=databaseTarget()
 try{
  await getPool().query('SELECT 1')
  return {configured:true,connected:true,target}
 }catch(error){
  return {
   configured:Boolean(databaseUrl()),
   connected:false,
   target,
   error:error?.code||'DATABASE_CONNECTION_FAILED',
  }
 }
}

export const databaseClose=async()=>{
 if(!pool)return
 const current=pool
 pool=undefined
 await current.end()
}
