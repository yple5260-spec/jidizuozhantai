import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const envFile=path.resolve(here,'../.env')
if(fs.existsSync(envFile)){
 for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)){
  const match=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
  if(!match||match[1] in process.env)continue
  process.env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2')
 }
}
