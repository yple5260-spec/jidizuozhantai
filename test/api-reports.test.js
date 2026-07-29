import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,readdir,readFile,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer as createNetServer } from 'node:net'
import { spawn } from 'node:child_process'

const projectRoot=path.resolve(import.meta.dirname,'..')
const getFreePort=()=>new Promise((resolve,reject)=>{const server=createNetServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();const port=typeof address==='object'&&address?address.port:0;server.close(error=>error?reject(error):resolve(port))})})

async function startServer(){
 const dataDir=await mkdtemp(path.join(tmpdir(),'hebei-reports-'))
 const port=await getFreePort()
 const child=spawn(process.execPath,['server/server.js'],{cwd:projectRoot,env:{...process.env,NODE_ENV:'test',DATABASE_URL:'',API_PORT:String(port),DATA_DIR:dataDir,SESSION_SECRET:'test-session-secret-32-characters-minimum'},stdio:['ignore','pipe','pipe']})
 let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk)
 const listeningPort=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error(`服务启动超时：${output}`)),5000);child.stdout.on('data',chunk=>{const match=String(chunk).match(/localhost:(\d+)/);if(match){clearTimeout(timeout);resolve(Number(match[1]))}});child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`服务提前退出 ${code}：${output}`))})})
 const base=`http://127.0.0.1:${listeningPort}`
 const rawRequest=async(method,pathname,payload,headers={})=>{const response=await fetch(`${base}${pathname}`,{method,headers:{'content-type':'application/json',...headers},body:payload===undefined?undefined:JSON.stringify(payload)});const text=await response.text();let data;try{data=JSON.parse(text)}catch{data=text}return {status:response.status,data,headers:response.headers,text}}
 const login=await rawRequest('POST','/api/auth/login',{jobNo:'JZ053684',password:'000000'})
 const loginCookie=login.headers.get('set-cookie').split(';')[0]
 const changed=await rawRequest('POST','/api/auth/change-password',{currentPassword:'000000',newPassword:'Admin2026!'},{cookie:loginCookie})
 if(changed.status!==200)throw new Error(`测试管理员会话初始化失败：${JSON.stringify(changed.data)}`)
 const cookie=changed.headers.get('set-cookie').split(';')[0]
 const request=(method,pathname,payload)=>rawRequest(method,pathname,payload,{cookie})
 return {base,dataDir,child,request,cookie,close:async()=>{child.kill('SIGTERM');await rm(dataDir,{recursive:true,force:true})}}
}

const runPayload={projectId:'north-center-10015',reportType:'operations-daily',requestedBy:'测试数据经理',requestedRole:'director'}

test('报表目录、10015预览与待接项目保护',async()=>{
 const app=await startServer()
 try{
  const catalog=await app.request('GET','/api/reports/catalog')
  assert.equal(catalog.status,200)
  assert.equal(catalog.data.projects.length,3)
  assert.equal(catalog.data.reports.length,4)
  assert.deepEqual(catalog.data.projects.filter(item=>item.runnable).map(item=>item.id),['north-center-10015'])

  const preview=await app.request('GET','/api/reports/preview?projectId=north-center-10015&reportType=operations-daily')
  assert.equal(preview.data.source.reportDate,'2026-07-20')
  assert.ok(preview.data.rows.some(row=>row.includes('2,603,926.50')))
  assert.ok(preview.data.source.warnings[0].includes('不打开或重算'))
  assert.equal(preview.data.columns[6],'诊断说明')
  assert.ok(preview.data.rows.some(row=>row[1]==='升投收入'&&row[6].includes('已达标')&&row[6].includes('Gap')))
  assert.ok(preview.data.rows.some(row=>row[1]==='人工满意率'&&row[6].includes('未配置对标目标')))
  assert.ok(preview.data.rows.every(row=>!row[6].includes('!')))

  const people=await app.request('GET','/api/reports/preview?projectId=north-center-10015&reportType=personal-weekly-performance')
  assert.equal(people.data.source.reportDate,'2026-07-19')
  assert.ok(people.data.rows.some(row=>row[0]==='曾雪'&&row[2]==='21'))
  assert.ok(people.data.rows.some(row=>row[0]==='郭玲雨'&&row[4]==='66.667%'))

  const baseline=(await app.request('GET','/api/state')).data
  const pending=await app.request('POST','/api/reports/runs',{...runPayload,projectId:'hebei-return-10010'})
  assert.equal(pending.status,409)
  assert.equal(pending.data.code,'REPORT_PROJECT_INTEGRATION_PENDING')
  const after=(await app.request('GET','/api/state')).data
  assert.equal(after.reportRuns.length,0)
  assert.equal(after.audit.length,baseline.audit.length)
 }finally{await app.close()}
})

test('生成CSV、下载留痕并通过复位清理',async()=>{
 const app=await startServer()
 try{
  const created=await app.request('POST','/api/reports/runs',runPayload)
  assert.equal(created.status,201)
  assert.equal(created.data.metrics.outputRows,9)
  assert.ok(created.data.metrics.artifactBytes>100)
  const generated=await readdir(path.join(app.dataDir,'generated'))
  assert.equal(generated.length,1)

  const downloadResponse=await fetch(`${app.base}/api/reports/runs/${created.data.id}/download?requestedBy=${encodeURIComponent('测试下载员')}`,{headers:{cookie:app.cookie}})
  const downloadBytes=new Uint8Array(await downloadResponse.arrayBuffer())
  const downloadText=new TextDecoder().decode(downloadBytes)
  assert.equal(downloadResponse.status,200)
  assert.match(downloadResponse.headers.get('content-type'),/^text\/csv/)
  assert.match(downloadResponse.headers.get('content-disposition'),/attachment/)
  assert.deepEqual(Array.from(downloadBytes.slice(0,3)),[0xef,0xbb,0xbf])
  assert.ok(downloadText.includes('\r\n'))
  assert.ok(downloadText.includes("'-6,000"))

  const state=(await app.request('GET','/api/state')).data
  assert.equal(state.reportRuns.length,1)
  assert.equal(state.reportRuns[0].downloadCount,1)
  assert.equal(state.reportDownloads.length,1)
  assert.ok(state.audit.some(item=>item.action.includes('下载报表')))

  const missing=await app.request('GET','/api/reports/runs/RP-missing/download')
  assert.equal(missing.status,404)
  assert.equal((await app.request('GET','/api/state')).data.reportDownloads.length,1)

  const reset=await app.request('POST','/api/reset')
  assert.equal(reset.status,200)
  assert.equal(reset.data.reportRuns.length,0)
  assert.equal(reset.data.reportDownloads.length,0)
  assert.equal(reset.data.meta.batchNo,41)
  assert.equal(reset.data.tasks.length,0)
  await assert.rejects(()=>readdir(path.join(app.dataDir,'generated')))
  const main=JSON.parse(await readFile(path.join(app.dataDir,'state.json'),'utf8'))
  const backup=JSON.parse(await readFile(path.join(app.dataDir,'state.backup.json'),'utf8'))
  assert.deepEqual(backup,main)
 }finally{await app.close()}
})
