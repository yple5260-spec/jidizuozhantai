import test from 'node:test'
import assert from 'node:assert/strict'
import { databaseTarget } from '../server/database.js'

test('数据库未注入时不生成默认连接目标',()=>{
 const previous=process.env.DATABASE_URL
 delete process.env.DATABASE_URL
 try{
  assert.equal(databaseTarget(),'未配置')
 }finally{
  if(previous===undefined)delete process.env.DATABASE_URL
  else process.env.DATABASE_URL=previous
 }
})
