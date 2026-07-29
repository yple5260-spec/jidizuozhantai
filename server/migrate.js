import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { databaseConnection } from './database.js'

const here=path.dirname(fileURLToPath(import.meta.url))
const migrationDir=path.join(here,'migrations')

const statements=sql=>sql
 .split(/;\s*(?:\r?\n|$)/)
 .map(item=>item.trim())
 .filter(Boolean)

export const migrateBusinessSchema=async()=>{
 const files=fs.readdirSync(migrationDir).filter(name=>name.endsWith('.sql')).sort()
 await databaseConnection(async connection=>{
  const [[lock]]=await connection.query("SELECT GET_LOCK('hebei_command_center_migrations',60) AS acquired")
  if(Number(lock?.acquired)!==1)throw new Error('获取数据库迁移锁超时')
  try{
   await connection.query(`CREATE TABLE IF NOT EXISTS platform_schema_migration (
     version VARCHAR(64) PRIMARY KEY,
     applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
   for(const file of files){
    const [applied]=await connection.query('SELECT version FROM platform_schema_migration WHERE version=?',[file])
    if(applied.length)continue
    const sql=fs.readFileSync(path.join(migrationDir,file),'utf8')
    for(const statement of statements(sql))await connection.query(statement)
    await connection.query('INSERT INTO platform_schema_migration(version) VALUES (?)',[file])
   }
  }finally{
   await connection.query("SELECT RELEASE_LOCK('hebei_command_center_migrations')")
  }
 })
 return files
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 migrateBusinessSchema()
  .then(files=>{console.log(`业务表迁移完成: ${files.join(', ')}`);process.exit(0)})
  .catch(error=>{console.error(`业务表迁移失败: ${error.code||error.message}`);process.exit(1)})
}
