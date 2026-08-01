import { useMemo, useState } from 'react'
import type { OrganizationDirectory } from '../types'
import { BriefcaseBusiness, Building2, Search, ShieldCheck, Users } from './Icons'
import '../organization-directory.css'

const PAGE_SIZE=80

export default function OrganizationDirectoryPanel({organization}:{organization:OrganizationDirectory}){
 const [keyword,setKeyword]=useState('')
 const [project,setProject]=useState('全部项目')
 const [role,setRole]=useState('全部角色')
 const members=useMemo(()=>organization.members.filter(member=>{
  const matchedProject=project==='全部项目'||member.project===project
  const matchedRole=role==='全部角色'||member.roleId===role
  const query=keyword.trim().toLowerCase()
  const matchedKeyword=!query||[member.name,member.jobNo,member.jobTitle,member.department,member.orgPath].some(value=>value.toLowerCase().includes(query))
  return matchedProject&&matchedRole&&matchedKeyword
 }),[organization.members,keyword,project,role])
 const visible=members.slice(0,PAGE_SIZE)
 return <section className="panel organization-directory">
  <header className="organization-directory-head"><div><span>组织主数据 · {organization.source.scope}</span><h2>项目、组织与岗位名录</h2><p>来源：{organization.source.fileName} · 同步日期 {organization.source.importedAt} · 联系方式未导入组织名录</p></div><div className="organization-source"><ShieldCheck size={18}/><span>已校验<strong>{organization.source.totalMembers} 人</strong></span></div></header>
  <div className="organization-projects">{organization.projects.map(item=><button key={item.id} className={project===item.name?'active':''} onClick={()=>setProject(project===item.name?'全部项目':item.name)}><Building2 size={17}/><span>{item.name}<strong>{item.count}</strong></span></button>)}</div>
  <div className="organization-role-stats">{organization.roleStats.map(item=><button key={item.id} className={role===item.id?'active':''} onClick={()=>setRole(role===item.id?'全部角色':item.id)}><BriefcaseBusiness size={15}/><span>{item.name}</span><strong>{item.count}</strong></button>)}</div>
  <div className="organization-toolbar"><label><Search size={16}/><input value={keyword} onChange={event=>setKeyword(event.target.value)} placeholder="搜索姓名、工号、岗位或组织路径"/></label><div><span>{project}</span><span>{role==='全部角色'?'全部角色':organization.roleStats.find(item=>item.id===role)?.name}</span><strong>{members.length} 人</strong></div></div>
  <div className="organization-list"><div className="organization-list-head"><span>人员</span><span>项目 / 组织</span><span>岗位</span><span>系统角色映射</span></div>{visible.map(member=><article key={member.jobNo}><div className="organization-person"><i>{member.name.slice(0,1)}</i><span><strong>{member.name}</strong><small>{member.jobNo}</small></span></div><div><strong>{member.project}</strong><small title={member.orgPath}>{member.department}</small></div><div><strong>{member.jobTitle}</strong><small>{member.functionCategory.replace(/^[A-Z]\d+-/,'')}</small></div><div><span className={`directory-role ${member.roleId}`}>{member.roleName}</span><small>{member.jobLevel||'未配置级别'}</small></div></article>)}</div>
  {members.length>PAGE_SIZE&&<footer className="organization-limit"><Users size={15}/>当前展示前 {PAGE_SIZE} 人，请使用项目、角色或关键词继续筛选；匹配总数 {members.length} 人。</footer>}
 </section>
}
