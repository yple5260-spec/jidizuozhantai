import fs from 'node:fs'
import path from 'node:path'
import { dataDir } from './store.js'

const configFile=path.join(dataDir,'ai-config.json')
const tempFile=path.join(dataDir,'ai-config.tmp.json')
const defaultConfig={
 provider:'DeepSeek',
 model:'deepseek-v4-flash',
 baseUrl:'https://api.deepseek.com',
 timeoutMs:45000,
}

const readStored=()=>{
 try{
  if(!fs.existsSync(configFile))return {}
  const parsed=JSON.parse(fs.readFileSync(configFile,'utf8'))
  return parsed&&typeof parsed==='object'?parsed:{}
 }catch(error){
  console.warn(`AI配置文件读取失败：${error.message}`)
  return {}
 }
}

const cleanBaseUrl=value=>{
 const baseUrl=String(value||defaultConfig.baseUrl).trim().replace(/\/+$/,'')
 let url
 try{url=new URL(baseUrl)}catch{throw Object.assign(new Error('模型服务地址格式不正确'),{status:400,code:'INVALID_AI_BASE_URL'})}
 if(!['http:','https:'].includes(url.protocol))throw Object.assign(new Error('模型服务地址仅支持 HTTP 或 HTTPS'),{status:400,code:'INVALID_AI_BASE_URL'})
 return baseUrl
}

export function getAiConfig(){
 const stored=readStored()
 const hasStoredKey=Object.prototype.hasOwnProperty.call(stored,'apiKey')
 const environmentKey=String(process.env.DEEPSEEK_API_KEY||'').trim()
 const apiKey=environmentKey||(hasStoredKey?String(stored.apiKey||''):'')
 const timeoutMs=Math.max(5000,Math.min(Number(stored.timeoutMs??process.env.DEEPSEEK_TIMEOUT_MS)||defaultConfig.timeoutMs,120000))
 return {
  provider:'DeepSeek',
  apiKey,
  model:String(stored.model||process.env.DEEPSEEK_MODEL||defaultConfig.model).trim(),
  baseUrl:cleanBaseUrl(stored.baseUrl||process.env.DEEPSEEK_BASE_URL||defaultConfig.baseUrl),
  timeoutMs,
  source:environmentKey?'environment':hasStoredKey?'system':'none',
  updatedAt:stored.updatedAt||'',
  updatedBy:stored.updatedBy||'',
 }
}

export function publicAiConfig(){
 const config=getAiConfig()
 return {
  provider:config.provider,
  configured:Boolean(config.apiKey),
  model:config.model,
  baseUrl:config.baseUrl,
  timeoutMs:config.timeoutMs,
  source:config.source,
  maskedKey:config.apiKey?`${config.apiKey.slice(0,3)}••••••••${config.apiKey.slice(-4)}`:'',
  updatedAt:config.updatedAt,
  updatedBy:config.updatedBy,
 }
}

export function saveAiConfig(input={}){
 const stored=readStored()
 const environmentKey=String(process.env.DEEPSEEK_API_KEY||'').trim()
 const model=String(input.model||stored.model||process.env.DEEPSEEK_MODEL||defaultConfig.model).trim()
 if(!model||model.length>80)throw Object.assign(new Error('模型名称不能为空或过长'),{status:400,code:'INVALID_AI_MODEL'})
 const baseUrl=cleanBaseUrl(input.baseUrl||stored.baseUrl||process.env.DEEPSEEK_BASE_URL||defaultConfig.baseUrl)
 const timeoutMs=Math.max(5000,Math.min(Number(input.timeoutMs)||defaultConfig.timeoutMs,120000))
 const next={...stored,provider:'DeepSeek',model,baseUrl,timeoutMs,updatedAt:new Date().toISOString(),updatedBy:String(input.actor||'系统管理员').slice(0,50)}
 if(environmentKey)delete next.apiKey
 else if(input.clearApiKey===true)next.apiKey=''
 else if(typeof input.apiKey==='string'&&input.apiKey.trim())next.apiKey=input.apiKey.trim()
 fs.mkdirSync(dataDir,{recursive:true})
 fs.writeFileSync(tempFile,JSON.stringify(next,null,2),{encoding:'utf8',mode:0o600})
 fs.renameSync(tempFile,configFile)
 try{fs.chmodSync(configFile,0o600)}catch{}
 return publicAiConfig()
}

export {configFile}
