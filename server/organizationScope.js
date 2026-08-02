import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const directory=JSON.parse(fs.readFileSync(path.join(here,'seeds/organization-directory.json'),'utf8'))
const members=Array.isArray(directory.members)?directory.members:[]
const roleIds={director:'operation-director',manager:'customer-manager',supervisor:'customer-supervisor',leader:'team-leader',employee:'customer-agent'}
const roleLabels={director:'总监全域',manager:'经理业务线',supervisor:'主管区域',leader:'班长班组',employee:'员工本人'}
const normalize=value=>String(value||'').replace(/[一二三四五六七八九十]/g,char=>({一:'1',二:'2',三:'3',四:'4',五:'5',六:'6',七:'7',八:'8',九:'9',十:'10'}[char])).replace(/\s+/g,'').toLowerCase()
const preferred=item=>/10015/.test(`${item.project} ${item.orgPath}`)&&/前台|普通客服一区/.test(item.orgPath)

const representativeFor=role=>{
 const candidates=members.filter(item=>item.roleId===roleIds[role])
 return candidates.find(item=>preferred(item))||candidates[0]||null
}

const directProfile=({jobNo,name,role})=>members.find(item=>item.jobNo===jobNo)||members.find(item=>item.name===name&&item.roleId===roleIds[role])||null

const mostCommon=(items,key)=>{
 const counts=new Map()
 for(const item of items){const value=String(item[key]||'').trim();if(value)counts.set(value,(counts.get(value)||0)+1)}
 return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||''
}

export const organizationDirectoryMeta=()=>({version:directory.version||1,source:directory.source?.fileName||'组织与架构.xlsx',importedAt:directory.source?.importedAt||'',memberCount:members.length})

export const applyOrganizationScope=(rows,{role,jobNo,name,isSystemAdmin=false}={})=>{
 const actor=directProfile({jobNo,name,role})||(isSystemAdmin?representativeFor(role):null)
 let scoped=[...rows],sourceRule='组织目录全域'
 if(role==='employee'){
  scoped=rows.filter(item=>item.jobNo===jobNo||item.name===name)
  sourceRule='员工工号'
 }else if(role==='leader'){
  const exactCode=actor?.jobNo&&rows.some(item=>item.leaderCode===actor.jobNo)
  const team=actor?.team&&rows.some(item=>normalize(item.team)===normalize(actor.team))
  if(exactCode){scoped=rows.filter(item=>item.leaderCode===actor.jobNo);sourceRule='班长工号'}
  else if(team){scoped=rows.filter(item=>normalize(item.team)===normalize(actor.team));sourceRule='组织目录班组'}
  else if(isSystemAdmin){const code=mostCommon(rows,'leaderCode');scoped=rows.filter(item=>item.leaderCode===code);sourceRule='演示岗位·源数据班长范围'}
  else scoped=[]
 }else if(role==='supervisor'){
  const supervisor=actor?.name&&rows.some(item=>normalize(item.supervisor)===normalize(actor.name))?actor.name:(isSystemAdmin?mostCommon(rows,'supervisor'):'')
  scoped=supervisor?rows.filter(item=>normalize(item.supervisor)===normalize(supervisor)):[]
  sourceRule=actor?.name===supervisor?'组织目录主管姓名':'演示岗位·源数据主管范围'
 }else if(role==='manager'&&actor&&actor.project&&actor.project!=='未分配'){
  const project=normalize(actor.project),matched=rows.filter(item=>normalize(`${item.team} ${item.project||''}`).includes(project))
  if(matched.length){scoped=matched;sourceRule='组织目录项目'}
 }
 const matchedRows=scoped.filter(row=>members.some(member=>member.jobNo===row.jobNo))
 const profile=actor?{jobNo:actor.jobNo,name:actor.name,roleName:actor.roleName,project:actor.project,department:actor.department,orgPath:actor.orgPath,team:actor.team}:null
 return {
  rows:scoped,
  scope:{role,roleLabel:roleLabels[role]||role,profile,sourceRule,directory:organizationDirectoryMeta(),totalRows:rows.length,visibleRows:scoped.length,directoryMatchedRows:matchedRows.length,unmatchedRows:scoped.length-matchedRows.length,strict:!isSystemAdmin},
 }
}

export const canAccessEmployee=(rows,context,employeeCode)=>applyOrganizationScope(rows,context).rows.some(item=>item.jobNo===employeeCode)
