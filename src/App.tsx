import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import companyLogo from './assets/company-logo.svg'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { roles, metrics, members, trendData, industryNews, settlements } from './data/mock'
import { applyWorkflowMutation, HrbpCaseRecord, HrbpCaseStatus, workflowApi, WorkflowMutationResult, WorkflowState } from './data/workflowApi'
import { openWorkflowTaskCount, pendingWorkflowEventCount, workflowAlerts, workflowTasks } from './data/workflowView'
import { MorningEmployee, reportApi } from './data/reportApi'
import { AiActionDraft, AiChatMessage, AiSettings, aiApi } from './data/aiApi'
import { AccessState, accessApi } from './data/accessApi'
import { AuthSession, authApi } from './data/authApi'
import { LiveMember, RealDataState, realDataApi } from './data/realDataApi'
import { runtimeApi } from './data/runtimeApi'
import ReportsPage from './components/ReportsPage'
import WorkforcePage from './components/WorkforcePage'
import HrbpOperationsHub, { ManagerPeopleApprovals } from './components/HrbpOperationsHub'
import { EmployeeLearningHub, LeaderLearningApprovals, TrainingLearningHub } from './components/LearningGrowthHub'
import DevelopmentWorkHub from './components/DevelopmentWorkHub'
import { DirectorGovernanceHub, ManagerGovernanceApprovals, RoleCrossDepartmentTasks, SupervisorOperationsHub } from './components/OperationsGovernanceHub'
import SalaryPerformanceHub from './components/SalaryPerformanceHub'
import { LeanPdcaDashboard, LeanTaskActions, LeanTaskBrief, LeanTaskManagementPanel, LeanTaskNodes, TaskAttachments, TaskComments, TaskImprovementPanel, workflowTaskVisibleForRole } from './components/LeanPdcaFeatures'
import TeamActionTools, { TeamActionMember } from './components/TeamActionTools'
import OrganizationDirectoryPanel from './components/OrganizationDirectoryPanel'
import ExcellenceHub from './components/ExcellenceHub'
import BudgetAchievementPanel from './components/BudgetAchievementPanel'
import MorningBriefingHub from './components/MorningBriefingHub'
import { Alert, OrganizationDirectory, Role, SystemRole, SystemUser, TaskItem } from './types'
import { Activity, AlertTriangle, BarChart3, Bell, BookOpenCheck, Bot, BriefcaseBusiness, Building2, CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, ClipboardCheck, Clock3, Command, Database, Edit3, Eye, EyeOff, FileBarChart, Gauge, GraduationCap, Headphones, KeyRound, LayoutDashboard, ListChecks, LockKeyhole, Mail, Menu, MessageSquareText, Newspaper, PanelLeftClose, Phone, Plus, RadioTower, ReceiptText, RefreshCw, Save, Search, Send, Settings, ShieldCheck, Sparkles, Target, Trash2, UserCog, UserPlus, Users, UserRoundSearch, WalletCards, X, Zap, CalendarDays, TrendingUp, TrendingDown, ArrowUpRight, Play, MoreHorizontal } from './components/Icons'
import { Award } from './components/Icons'

const nav = [
  {id:'command',label:'今日作战',icon:Command},
  {id:'industry-news',label:'客户行业动态',icon:Newspaper},
  {id:'settlement',label:'结算管理',icon:ReceiptText},
  {id:'alerts',label:'AI预警中心',icon:AlertTriangle},
  {id:'meeting',label:'班前会',icon:MessageSquareText},
  {id:'team',label:'班组看数',icon:Users},
  {id:'workforce',label:'组织与排班',icon:CalendarDays},
  {id:'tasks',label:'PDCA任务',icon:ListChecks},
  {id:'excellence',label:'固化先进',icon:Award},
  {id:'reports',label:'RPA报表',icon:FileBarChart},
  {id:'growth',label:'培训与面谈',icon:GraduationCap},
  {id:'salary',label:'绩效与薪资',icon:CircleDollarSign},
]

const systemUsersSeed: SystemUser[] = [
  {id:'U001',name:'李燕鹏',jobNo:'JZ053684',roleId:'system-admin',jobTitle:'运营管理总监',department:'河北基地 · 客户驱动部',phone:'',email:'',status:'active',password:'',forceChangePassword:true,moduleOverrides:[],createdAt:'2026-07-21'},
  {id:'U002',name:'吴欣欣',jobNo:'JZ001218',roleId:'customer-manager',jobTitle:'运营经理',department:'河北基地',phone:'',email:'',status:'active',password:'',forceChangePassword:true,moduleOverrides:[],createdAt:'2026-07-21'},
]

const systemRolesSeed: SystemRole[] = [
  {id:'system-admin',name:'系统管理员',code:'SYSTEM_ADMIN',level:'系统级',description:'拥有全部业务模块和系统管理权限；内置角色不可删除。',memberCount:0,menus:['command','industry-news','settlement','alerts','meeting','team','workforce','tasks','excellence','reports','growth','salary','user-management','role-management','ai-settings'],builtIn:true,status:'active'},
  {id:'operation-director',name:'运营总监',code:'OPERATION_DIRECTOR',level:'基地级',description:'关注基地经营、甲方动态、行业舆情、结费回款和组织效能。',memberCount:1,menus:['command','industry-news','settlement','alerts','workforce','tasks','excellence','reports','growth','salary'],builtIn:true,status:'active'},
  {id:'customer-manager',name:'客服经理',code:'CUSTOMER_MANAGER',level:'业务线级',description:'负责业务KPI、组织效能、主管及班组管理。',memberCount:1,menus:['command','alerts','team','workforce','tasks','excellence','reports','growth'],builtIn:true,status:'active'},
  {id:'customer-supervisor',name:'客服主管',code:'CUSTOMER_SUPERVISOR',level:'区域级',description:'负责现场调度、绩效改善、班长履职和质量风险。',memberCount:4,menus:['command','alerts','meeting','team','workforce','tasks','excellence','reports','growth'],builtIn:true,status:'active'},
  {id:'team-leader',name:'客服班长',code:'TEAM_LEADER',level:'班组级',description:'负责班前会、班组看数、面谈辅导及任务闭环。',memberCount:28,menus:['command','alerts','meeting','team','workforce','tasks','excellence','reports','growth','salary'],builtIn:true,status:'active'},
  {id:'customer-agent',name:'客服专员',code:'CUSTOMER_AGENT',level:'个人级',description:'查看个人绩效、培训任务、排班、先进经验和薪资信息。',memberCount:438,menus:['command','workforce','tasks','excellence','growth','salary'],builtIn:true,status:'active'},
  {id:'quality-specialist',name:'质检专员',code:'QUALITY_SPECIALIST',level:'专业岗',description:'AI辅助质检、质量分析、先进录音和整改闭环。',memberCount:8,menus:['command','alerts','tasks','excellence','reports','growth'],builtIn:true,status:'active'},
  {id:'training-manager',name:'培训主管',code:'TRAINING_MANAGER',level:'专业岗',description:'培训需求、课程计划、AI教官及培训效果评估。',memberCount:3,menus:['command','tasks','excellence','reports','growth'],builtIn:true,status:'active'},
  {id:'hrbp-manager',name:'HRBP经理',code:'HRBP_MANAGER',level:'专业岗',description:'人员档案、流失预警、招聘缺口和组织效能。',memberCount:2,menus:['command','alerts','workforce','tasks','reports','growth','salary'],builtIn:true,status:'active'},
  {id:'operations-support',name:'运营支持',code:'OPERATIONS_SUPPORT',level:'专业岗',description:'适用于调度、数据、知识、工号和专项管理岗位；默认采用最小权限，可按账号追加模块。',memberCount:23,menus:['command','tasks','reports'],builtIn:true,status:'active'},
]

const emptyOrganization:OrganizationDirectory={version:1,source:{fileName:'组织与架构.xlsx',importedAt:'',scope:'河北基地',totalMembers:0,containsContactDetails:false},projects:[],roleStats:[],members:[]}

const menuCatalog = [
 {id:'command',label:'今日作战'},{id:'industry-news',label:'客户行业动态'},{id:'settlement',label:'结算管理'},{id:'alerts',label:'AI预警中心'},{id:'meeting',label:'班前会'},{id:'team',label:'班组看数'},{id:'workforce',label:'组织与排班'},{id:'tasks',label:'PDCA任务'},{id:'excellence',label:'固化先进'},{id:'reports',label:'RPA报表'},{id:'growth',label:'培训与面谈'},{id:'salary',label:'绩效与薪资'},{id:'user-management',label:'用户管理'},{id:'role-management',label:'角色管理'},{id:'ai-settings',label:'AI模型配置'}
]

const roleRuntimeMap: Record<Role,string> = {
  director:'operation-director',manager:'customer-manager',supervisor:'customer-supervisor',leader:'team-leader',employee:'customer-agent',quality:'quality-specialist',training:'training-manager',hrbp:'hrbp-manager'
}

const representativeUserMap: Partial<Record<Role,string>> = {
  director:'U001',
  manager:'U002',
}
const authRoleMap:Record<string,Role>={
 'system-admin':'director','operation-director':'director','customer-manager':'manager','customer-supervisor':'supervisor','team-leader':'leader','customer-agent':'employee','quality-specialist':'quality','training-manager':'training','hrbp-manager':'hrbp','operations-support':'employee'
}
const lastLoginJobNoKey='hebei-operations-last-login-job-no'
const readLastLoginJobNo=()=>{
 try{return window.localStorage.getItem(lastLoginJobNoKey)?.trim()||''}catch{return ''}
}
const rememberLastLoginJobNo=(jobNo:string)=>{
 try{window.localStorage.setItem(lastLoginJobNoKey,jobNo.trim())}catch{}
}

const roleModeLabel: Record<Role,string> = {
 director:'运营总监作战模式',manager:'客服经理作战模式',supervisor:'客服主管作战模式',leader:'班组长作战模式',employee:'客服员工工作模式',quality:'质量管理作战模式',training:'培训管理作战模式',hrbp:'HRBP管理作战模式'
}

const statusMap = {online:'在线',busy:'通话中',rest:'小休',offline:'离线',training:'培训'}
const riskLabel = {critical:'紧急',warning:'关注',notice:'提示'}

type SearchResult={id:string;kind:string;title:string;desc:string;target:string;entityId?:string;keywords?:string}
type TrainingReportState={sent:boolean;read:boolean;generatedAt:string;reportNo:string}
type HrbpCase=HrbpCaseRecord
type HrbpAction=Parameters<typeof workflowApi.hrbpCaseAction>[2]
type HrbpActionRunner=(id:string,role:'hrbp'|'manager',action:HrbpAction,note?:string,success?:string)=>Promise<boolean>
type WorkflowRunner=(action:()=>Promise<WorkflowMutationResult>,success:string)=>void|boolean|Promise<void|boolean>
const assistantGreeting:AiChatMessage={role:'assistant',content:'你好，我是AI作战助手。可以和我讨论指标差距、重点员工、班前会内容或PDCA行动，我会结合当前岗位与页面数据给出建议。'}
const initialAssistantThreads=()=>Object.fromEntries(roles.map(item=>[item.id,[assistantGreeting]])) as Record<Role,AiChatMessage[]>

function App(){
  const [auth,setAuth]=useState<AuthSession|null>(null)
  const [authLoading,setAuthLoading]=useState(true)
  const [authError,setAuthError]=useState('')
  const [authBusy,setAuthBusy]=useState(false)
  const [role,setRole]=useState<Role>('leader')
  const [page,setPage]=useState('command')
  const [roleOpen,setRoleOpen]=useState(false)
  const [passwordDialogOpen,setPasswordDialogOpen]=useState(false)
  const [selectedAlertId,setSelectedAlertId]=useState('')
  const [toast,setToast]=useState('')
  const [assistantOpen,setAssistantOpen]=useState(false)
  const [query,setQuery]=useState('')
  const [assistantThreads,setAssistantThreads]=useState<Record<Role,AiChatMessage[]>>(initialAssistantThreads)
  const [assistantBusy,setAssistantBusy]=useState(false)
  const [assistantError,setAssistantError]=useState('')
  const [assistantConfigured,setAssistantConfigured]=useState<boolean|null>(null)
  const [assistantModel,setAssistantModel]=useState('deepseek-v4-flash')
  const [assistantDraft,setAssistantDraft]=useState<AiActionDraft|null>(null)
  const [assistantActionBusy,setAssistantActionBusy]=useState(false)
  const [systemOpen,setSystemOpen]=useState(true)
  const [systemUsers,setSystemUsers]=useState<SystemUser[]>(systemUsersSeed)
  const [systemRoles,setSystemRoles]=useState<SystemRole[]>(systemRolesSeed)
  const [organization,setOrganization]=useState<OrganizationDirectory>(emptyOrganization)
  const [accessBusy,setAccessBusy]=useState(false)
  const [accessError,setAccessError]=useState('')
  const [notificationOpen,setNotificationOpen]=useState(false)
  const [readNotifications,setReadNotifications]=useState<string[]>([])
  const [workflow,setWorkflow]=useState<WorkflowState|null>(null)
  const [workflowError,setWorkflowError]=useState('')
  const [workflowBusy,setWorkflowBusy]=useState(false)
  const [realData,setRealData]=useState<RealDataState|null>(null)
  const [realDataError,setRealDataError]=useState('')
  const [searchOpen,setSearchOpen]=useState(false)
  const [searchQuery,setSearchQuery]=useState('')
  const searchInputRef=useRef<HTMLInputElement>(null)
  const assistantEndRef=useRef<HTMLDivElement>(null)
  const assistantMessages=assistantThreads[role]
  const setAssistantMessages=(next:AiChatMessage[]|((current:AiChatMessage[])=>AiChatMessage[]))=>setAssistantThreads(threads=>({...threads,[role]:typeof next==='function'?next(threads[role]):next}))
  const currentRole=roles.find(r=>r.id===role)!
  const latestTrainingReport=workflow?.trainingReports?.[0]
  const hrbpCases=workflow?.hrbpCases||[]
  const trainingReport:TrainingReportState=latestTrainingReport?{sent:true,read:latestTrainingReport.status==='reviewed',generatedAt:new Date(latestTrainingReport.sentAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),reportNo:latestTrainingReport.id}:{sent:false,read:false,generatedAt:'',reportNo:''}
  const alerts=useMemo(()=>workflowAlerts(workflow),[workflow])
  const tasks=useMemo(()=>workflowTasks(workflow),[workflow])
  const selectedAlert=alerts.find(alert=>alert.id===selectedAlertId)||null
  const isSystemAdmin=auth?.role.id==='system-admin'
  const representativeUserId=representativeUserMap[role]
  const simulatedUser=representativeUserId?systemUsers.find(user=>user.id===representativeUserId):undefined
  const representativeUser=isSystemAdmin?(role==='director'?auth?.user:undefined):(auth?.user||simulatedUser)
  const runtimeRoleId=isSystemAdmin?(role==='director'?'system-admin':roleRuntimeMap[role]):auth?.user.roleId||representativeUser?.roleId||roleRuntimeMap[role]
  const runtimeRole=systemRoles.find(item=>item.id===runtimeRoleId)
  const accountActive=representativeUser?representativeUser.status==='active':true
  const roleActive=runtimeRole?.status==='active'
  const currentUser=representativeUser
  const allowedMenus=useMemo(()=>{
    if(!accountActive||!roleActive)return []
    const overrides=currentUser?.moduleOverrides.filter(menu=>menuCatalog.some(item=>item.id===menu))||[]
    return Array.from(new Set([...(runtimeRole?.menus||[]),...overrides]))
  },[runtimeRole,currentUser,accountActive,roleActive])
  const visibleNav=nav.filter(item=>allowedMenus.includes(item.id))
  const canManageSystem=allowedMenus.includes('user-management')||allowedMenus.includes('role-management')||allowedMenus.includes('ai-settings')
  const activeNav=nav.find(n=>n.id===page)
  const pageLabel=page==='user-management'?'用户管理':page==='role-management'?'角色管理':page==='ai-settings'?'AI模型配置':activeNav?.label
  const roleNotifications=useMemo(()=>buildRoleNotifications(role,workflow,trainingReport,hrbpCases),[role,workflow,trainingReport,hrbpCases])
  const unreadCount=roleNotifications.filter(n=>!readNotifications.includes(n.id)).length

  const searchResults=useMemo<SearchResult[]>(()=>{
    const keyword=searchQuery.trim().toLowerCase()
    if(!keyword)return []
    const pageResults:SearchResult[]=visibleNav.map(item=>({id:`page-${item.id}`,kind:'模块',title:item.label,desc:'进入业务模块',target:item.id}))
    const memberResults:SearchResult[]=allowedMenus.includes('team')?members.map(member=>({id:`member-${member.id}`,kind:'员工',title:member.name,desc:`${member.id} · ${member.stage}`,target:'team',keywords:`${member.name} ${member.id} ${member.stage}`})):[]
    const eventResults:SearchResult[]=allowedMenus.includes('alerts')?(workflow?.events||[]).map(event=>({id:`event-${event.id}`,kind:'预警',title:event.title,desc:`${event.type} · ${event.team}`,target:'alerts',entityId:event.id,keywords:`${event.title} ${event.type} ${event.team} ${event.person||''} ${event.evidence} ${event.source}`})):[]
    const metricResults:SearchResult[]=allowedMenus.includes('command')?metrics.map(metric=>({id:`metric-${metric.label}`,kind:'指标',title:metric.label,desc:`${metric.value} · ${metric.target}`,target:'command',keywords:`${metric.label} ${metric.target} ${metric.source} ${metric.field}`})):[]
    return [...pageResults,...memberResults,...eventResults,...metricResults].filter(item=>`${item.title} ${item.desc} ${item.keywords||''}`.toLowerCase().includes(keyword)).slice(0,12)
  },[searchQuery,visibleNav,allowedMenus,workflow])

  useEffect(()=>{
    const handleKey=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(true)}
      if(event.key==='Escape')setSearchOpen(false)
    }
    window.addEventListener('keydown',handleKey)
    return()=>window.removeEventListener('keydown',handleKey)
  },[])
  useEffect(()=>{if(searchOpen)window.setTimeout(()=>searchInputRef.current?.focus(),0)},[searchOpen])

  useEffect(()=>{
    authApi.session().then(session=>{rememberLastLoginJobNo(session.user.jobNo);setAuth(session);setRole(authRoleMap[session.role.id]||'employee');setAuthError('')}).catch(()=>setAuth(null)).finally(()=>setAuthLoading(false))
  },[])
  useEffect(()=>{
    if(!auth||auth.requiresPasswordChange){setWorkflow(null);return}
    workflowApi.get().then(next=>{setWorkflow(next);setWorkflowError('')}).catch(e=>setWorkflowError(e.message))
  },[auth?.user.id,auth?.requiresPasswordChange])
  useEffect(()=>{
    if(!auth||auth.requiresPasswordChange){setRealData(null);return}
    realDataApi.get(role).then(next=>{setRealData(next);setRealDataError('')}).catch(error=>{setRealData(null);setRealDataError(error instanceof Error?error.message:'真实数据加载失败')})
  },[auth?.user.id,auth?.requiresPasswordChange,role])
  useEffect(()=>{
    if(!auth||auth.requiresPasswordChange){setReadNotifications([]);return}
    runtimeApi.notificationReads().then(result=>setReadNotifications(result.ids)).catch(()=>setReadNotifications([]))
  },[auth?.user.id,auth?.requiresPasswordChange])
  useEffect(()=>{
    if(!auth||auth.requiresPasswordChange)return
    let active=true
    aiApi.history(role).then(result=>{
      if(active)setAssistantThreads(current=>({...current,[role]:[assistantGreeting,...result.messages]}))
    }).catch(()=>{})
    return()=>{active=false}
  },[auth?.user.id,auth?.requiresPasswordChange,role])
  useEffect(()=>{
    if(!auth||auth.requiresPasswordChange)return
    if(auth.role.menus.includes('user-management'))accessApi.get().then(access=>{setSystemUsers(access.users);setSystemRoles(access.roles);setOrganization(access.organization||emptyOrganization);setAccessError('')}).catch(error=>setAccessError(error instanceof Error?error.message:'权限配置加载失败'))
    else{setSystemUsers([auth.user]);setSystemRoles([auth.role]);setOrganization(emptyOrganization);setAccessError('')}
  },[auth])

  const runWorkflow=async(action:()=>Promise<WorkflowMutationResult>,success:string)=>{
    setWorkflowBusy(true)
    try{const next=await action();setWorkflow(current=>applyWorkflowMutation(current,next));setWorkflowError('');notify(success);return true}
    catch(e){notify(e instanceof Error?e.message:'操作失败');return false}
    finally{setWorkflowBusy(false)}
  }
  const publishTrainingReport=async()=>{
   setWorkflowBusy(true)
   try{
    const training=workflow?.training
    const cohort=training?.cohorts?.[0]
    const cohortTrainees=training?.trainees?.filter(item=>item.cohortId===cohort?.id)||[]
    const risks=cohortTrainees.filter(item=>item.riskLevel!=='normal')
    const passForecast=cohort?.forecastPassRate||0
    const activePrograms=training?.programs?.filter(item=>item.status!=='closed')||[]
    const duePrograms=activePrograms.filter(item=>Date.parse(item.dueAt)<=Date.now()+24*60*60*1000)
    const onTimeRate=activePrograms.length?Math.round((activePrograms.length-duePrograms.filter(item=>item.progress<90).length)/activePrograms.length*1000)/10:100
    const next=await workflowApi.publishTrainingReport({
     role:'training',actor:'培训主管 刘颖',reportDate:new Date().toISOString().slice(0,10),summary:`${cohort?.name||'新工班'}当前综合进度正常，${risks.length}名学员存在能力或档案差距，已纳入重点帮扶。`,
     metrics:{prejobTrainees:cohort?.arrivedCount||0,passForecast,onjobPrograms:activePrograms.length,onTimeRate},
     risks:risks.map(item=>`${item.name}：实操${item.practiceScore}分、场景${item.scenarioScore}分、档案${item.profileComplete}%，${item.supportPlan}`),
     tomorrowPlan:[...cohort?.stages.filter(item=>item.progress<100).slice(0,2).map(item=>`推进${item.name}至下一里程碑，目标：${item.goal}`)||[],...activePrograms.slice(0,2).map(item=>`${item.title}完成覆盖${item.targetCoverage}%、测试通过${item.targetPassRate}%，达标后提交质检验效。`)],
    })
    setWorkflow(next);setWorkflowError('');notify('培训日报已持久化发送，经理消息中心已提醒');return true
   }catch(error){notify(error instanceof Error?error.message:'培训日报发送失败');return false}finally{setWorkflowBusy(false)}
  }
  const reviewTrainingReport=async()=>{
   if(!latestTrainingReport||latestTrainingReport.status==='reviewed')return
   setWorkflowBusy(true)
   try{
    const next=await workflowApi.reviewTrainingReport(latestTrainingReport.id,'已阅，请按明日计划推进，并持续跟踪3名高风险学员的复测结果。')
    setWorkflow(next);setWorkflowError('');notify('培训日报已确认查阅，回执已返回培训岗')
   }catch(error){notify(error instanceof Error?error.message:'培训日报查阅确认失败')}finally{setWorkflowBusy(false)}
  }
  const createHrbpCase=async(payload:Parameters<typeof workflowApi.createHrbpCase>[0])=>{
   setWorkflowBusy(true)
   try{
    const next=await workflowApi.createHrbpCase(payload)
    setWorkflow(next);setWorkflowError('');notify(`${payload.employee.name}沟通任务已创建，进入HRBP PDCA`);return true
   }catch(error){notify(error instanceof Error?error.message:'沟通任务创建失败');return false}finally{setWorkflowBusy(false)}
  }
  const runHrbpCaseAction=async(id:string,role:'hrbp'|'manager',action:Parameters<typeof workflowApi.hrbpCaseAction>[2],note='',success='操作已完成')=>{
   setWorkflowBusy(true)
   try{
    const next=await workflowApi.hrbpCaseAction(id,role,action,note)
    setWorkflow(next);setWorkflowError('');notify(success);return true
   }catch(error){notify(error instanceof Error?error.message:'人员稳定任务操作失败');return false}finally{setWorkflowBusy(false)}
  }
  const applyAccess=(access:AccessState)=>{setSystemUsers(access.users);setSystemRoles(access.roles);setAccessError('')}
  const saveSystemUser=async(user:SystemUser)=>{
   setAccessBusy(true)
   try{applyAccess(await accessApi.saveUser(user));notify('用户信息已持久化保存');return true}
   catch(error){const message=error instanceof Error?error.message:'用户保存失败';setAccessError(message);notify(message);return false}
   finally{setAccessBusy(false)}
  }
  const runSystemUserAction=async(id:string,action:'toggle_status'|'reset_password')=>{
   const temporaryPassword=action==='reset_password'?window.prompt('请输入至少8位的一次性初始密码。该密码只用于首次登录，用户登录后必须立即修改。',''):null
   if(action==='reset_password'&&temporaryPassword===null)return false
   setAccessBusy(true)
   try{applyAccess(await accessApi.userAction(id,action,temporaryPassword||''));notify(action==='reset_password'?'一次性初始密码已重置，首次登录必须改密':'账号状态已持久化更新');return true}
   catch(error){const message=error instanceof Error?error.message:'用户操作失败';setAccessError(message);notify(message);return false}
   finally{setAccessBusy(false)}
  }
  const saveSystemRole=async(role:SystemRole)=>{
   setAccessBusy(true)
   try{applyAccess(await accessApi.saveRole(role));notify('角色及菜单权限已持久化保存');return true}
   catch(error){const message=error instanceof Error?error.message:'角色保存失败';setAccessError(message);notify(message);return false}
   finally{setAccessBusy(false)}
  }
  const deleteSystemRole=async(id:string)=>{
   setAccessBusy(true)
   try{applyAccess(await accessApi.deleteRole(id));notify('角色已删除');return true}
   catch(error){const message=error instanceof Error?error.message:'角色删除失败';setAccessError(message);notify(message);return false}
   finally{setAccessBusy(false)}
  }
  const login=async(jobNo:string,password:string)=>{
   setAuthBusy(true);setAuthError('')
   try{const session=await authApi.login(jobNo,password);rememberLastLoginJobNo(session.user.jobNo);setAuth(session);setRole(authRoleMap[session.role.id]||'employee');return true}
   catch(error){setAuthError(error instanceof Error?error.message:'登录失败');return false}
   finally{setAuthBusy(false);setAuthLoading(false)}
  }
  const changeLoginPassword=async(currentPassword:string,newPassword:string,successMessage='密码修改成功，已进入作战台')=>{
   setAuthBusy(true);setAuthError('')
   try{const session=await authApi.changePassword(currentPassword,newPassword);rememberLastLoginJobNo(session.user.jobNo);setAuth(session);setRole(authRoleMap[session.role.id]||'employee');notify(successMessage);return true}
   catch(error){setAuthError(error instanceof Error?error.message:'密码修改失败');return false}
   finally{setAuthBusy(false)}
  }
  const logout=async()=>{
   setAuthBusy(true)
   try{await authApi.logout()}catch{}
   setAuth(null);setRole('leader');setPage('command');setRoleOpen(false);setPasswordDialogOpen(false);setAssistantOpen(false);setAuthError('');setReadNotifications([]);setAssistantThreads(initialAssistantThreads());setAuthBusy(false)
  }

  useEffect(()=>{
    if(!allowedMenus.includes(page)){
      setPage(allowedMenus.includes('command')?'command':allowedMenus[0]||'command')
    }
  },[role,page,allowedMenus])

  useEffect(()=>{
    if(!assistantOpen)return
    aiApi.status().then(status=>{setAssistantConfigured(status.configured);setAssistantModel(status.model)}).catch(()=>setAssistantConfigured(false))
  },[assistantOpen])

  useEffect(()=>{
    if(assistantOpen)assistantEndRef.current?.scrollIntoView({behavior:'smooth'})
  },[assistantOpen,assistantMessages,assistantBusy,assistantDraft])
  useEffect(()=>{setAssistantDraft(null)},[role])

  const notify=(text:string)=>{setToast(text);setTimeout(()=>setToast(''),2600)}
  const markNotificationsRead=(ids:string[])=>{
    const next=Array.from(new Set([...readNotifications,...ids]))
    setReadNotifications(next)
    void runtimeApi.markNotificationsRead(ids).then(result=>setReadNotifications(result.ids)).catch(()=>notify('消息已读状态暂未同步，请稍后重试'))
  }
  const startNewAssistantThread=()=>{
    setAssistantMessages([assistantGreeting]);setAssistantDraft(null);setAssistantError('')
    void aiApi.clearHistory(role).catch(error=>notify(error instanceof Error?error.message:'新建对话失败'))
  }
  const handleAlert=(id:string)=>{
    setSelectedAlertId(id)
    setPage('alerts')
    notify(role==='supervisor'?'请确认预警后生成PDCA任务':'预警需由客服主管确认后下发任务')
  }
  const assistantContext=()=>{
    const coverage=workflow?.workforce?.coverage||[]
    const required=coverage.reduce((sum,item)=>sum+item.required,0),onDuty=coverage.reduce((sum,item)=>sum+item.onDuty,0)
    const workforceMetrics=page==='workforce'?[
      `今日人力应需${required}人、实到${onDuty}人、缺口${Math.max(0,required-onDuty)}人，覆盖率${required?(onDuty/required*100).toFixed(1):0}%（目标≥95%）`,
      ...coverage.filter(item=>item.onDuty<item.required).map(item=>`${item.team}缺口${item.required-item.onDuty}人，预测负荷${item.forecastLoad}%`),
      `当前排班考勤流转中${workflow?.workforce?.requests.filter(item=>!['closed','rejected'].includes(item.status)).length||0}项，本岗位待处理${workflow?.workforce?.requests.filter(item=>item.ownerRole===role&&!['closed','rejected'].includes(item.status)).length||0}项`,
    ]:[]
    const learningMetrics=workflow?(role==='training'?[
      `学习生产待办：草稿题库${workflow.learning.questionBanks.filter(item=>item.status==='draft').length}个、考试未达标${workflow.learning.assignments.filter(item=>item.status==='failed').length}人、待受理/落地建议${workflow.learning.suggestions.filter(item=>['pending_training','reviewing','accepted'].includes(item.status)).length}项`,
      `30/60/90成长评估待培训处理${workflow.learning.growthReviews.filter(item=>['planned','training_review'].includes(item.status)).length}项`,
    ]:role==='employee'?workflow.learning.assignments.filter(item=>item.employeeId==='JR10776'&&item.status!=='closed').map(item=>`个人学习任务“${item.title}”：${item.status}，考试目标${item.targetScore}分，改善目标${item.improvementTarget}`):role==='leader'?[
      `待班长验证学习效果${workflow.learning.assignments.filter(item=>item.status==='leader_verification').length}项，待确认成长目标${workflow.learning.growthReviews.filter(item=>item.status==='leader_pending').length}项`,
    ]:[]):[]
    const openLearning=workflow?(role==='training'?workflow.learning.assignments.filter(item=>item.status==='failed').length+workflow.learning.suggestions.filter(item=>['pending_training','reviewing','accepted'].includes(item.status)).length+workflow.learning.growthReviews.filter(item=>['planned','training_review'].includes(item.status)).length:role==='employee'?workflow.learning.assignments.filter(item=>item.employeeId==='JR10776'&&item.status!=='closed').length:role==='leader'?workflow.learning.assignments.filter(item=>item.status==='leader_verification').length+workflow.learning.growthReviews.filter(item=>item.status==='leader_pending').length:0):0
    const governanceMetrics=workflow?(role==='supervisor'?[
      ...workflow.governance.shiftPlans.map(item=>`排班计划${item.id}：需求${item.required}人、已排${item.scheduled}人、目标覆盖率${item.targetCoverage}%，状态${item.status}`),
      ...workflow.governance.skillRoutes.map(item=>`技能路由${item.id}：接通率${item.baselineAnswerRate}%→目标${item.targetAnswerRate}%、实际${item.actualAnswerRate||'待回填'}%，状态${item.status}`),
    ]:role==='director'?[
      ...workflow.governance.budgets.map(item=>`${item.project}H1预算达成：收入实际${item.forecastRevenue}万元/预算${item.revenueTarget}万元，毛利率实际${item.forecastMargin}%/预算${item.targetMargin}%，状态${item.status}`),
      `总监待决策与验收${workflow.governance.budgets.filter(item=>item.status==='director_pending').length+workflow.governance.crossDepartmentItems.filter(item=>item.status==='director_verification').length}项`,
    ]:role==='manager'?[
      `生产审批待办${workflow.governance.shiftPlans.filter(item=>item.status==='manager_pending').length+workflow.governance.skillRoutes.filter(item=>item.status==='manager_pending').length}项，跨部门协同待执行${workflow.governance.crossDepartmentItems.filter(item=>item.targetRole==='manager'&&!['closed','director_verification'].includes(item.status)).length}项`,
    ]:[]):[]
    const openGovernance=workflow?(role==='director'?workflow.governance.budgets.filter(item=>item.status==='director_pending').length+workflow.governance.crossDepartmentItems.filter(item=>item.status==='director_verification').length+workflow.governance.meetings.filter(item=>item.status==='draft').length:role==='manager'?workflow.governance.shiftPlans.filter(item=>item.status==='manager_pending').length+workflow.governance.skillRoutes.filter(item=>item.status==='manager_pending').length+workflow.governance.crossDepartmentItems.filter(item=>item.targetRole==='manager'&&!['closed','director_verification'].includes(item.status)).length:role==='supervisor'?workflow.governance.shiftPlans.filter(item=>['draft','returned'].includes(item.status)).length+workflow.governance.skillRoutes.filter(item=>['draft','returned','executing'].includes(item.status)).length:role==='hrbp'?workflow.governance.crossDepartmentItems.filter(item=>item.targetRole==='hrbp'&&!['closed','director_verification'].includes(item.status)).length:0):0
    return {
      roleId:role,role:currentRole.label,scope:currentRole.scope,page:pageLabel||'今日作战',
      metrics:[...governanceMetrics,...learningMetrics,...workforceMetrics,...metrics.map(item=>`${item.label}：实际${item.value}，${item.target}，偏差${item.delta>0?'+':''}${item.delta}个百分点`)].slice(0,12),
      openAlerts:alerts.filter(item=>item.status!=='closed').length,
      openTasks:tasks.filter(item=>item.status!=='done').length+hrbpCases.filter(item=>item.status!=='closed').length+(workflow?.workforce?.requests.filter(item=>item.ownerRole===role&&!['closed','rejected'].includes(item.status)).length||0)+openLearning+openGovernance,
    }
  }
  const runAssistant=async(preset?:string)=>{
    const text=(preset??query).trim()
    if(!text||assistantBusy)return
    const nextMessages=[...assistantMessages,{role:'user',content:text} as AiChatMessage]
    setAssistantMessages(nextMessages);setQuery('');setAssistantError('');setAssistantBusy(true)
    try{
      const response=await aiApi.chat(nextMessages,assistantContext())
      setAssistantMessages(messages=>[...messages,response.message])
      setAssistantDraft(null)
      setAssistantConfigured(true);setAssistantModel(response.model)
    }catch(error){
      setAssistantError(error instanceof Error?error.message:'AI服务暂时不可用，请稍后重试')
      if((error as Error&{code?:string}).code==='AI_NOT_CONFIGURED')setAssistantConfigured(false)
    }finally{setAssistantBusy(false)}
  }
  const generateAssistantDraft=async()=>{
    if(assistantActionBusy||!assistantMessages.some(message=>message.role==='user'))return
    setAssistantActionBusy(true);setAssistantError('')
    try{
      const response=await aiApi.draftAction(assistantMessages,assistantContext())
      setAssistantDraft(response.draft);setAssistantModel(response.model)
    }catch(error){setAssistantError(error instanceof Error?error.message:'AI行动草案生成失败，请稍后重试')}
    finally{setAssistantActionBusy(false)}
  }
  const updateAssistantDraft=(field:keyof AiActionDraft,value:string)=>setAssistantDraft(current=>current?{...current,[field]:value}:current)
  const executeAssistantDraft=async()=>{
    if(!assistantDraft||assistantActionBusy)return
    setAssistantActionBusy(true);setAssistantError('')
    try{
      const next=await aiApi.executeActionDraft(assistantDraft)
      setWorkflow(next);setWorkflowError('');setAssistantDraft(null);setAssistantOpen(false);setPage('tasks')
      notify('AI行动已由你确认并进入本岗位PDCA')
    }catch(error){setAssistantError(error instanceof Error?error.message:'AI行动创建失败，请稍后重试')}
    finally{setAssistantActionBusy(false)}
  }

  if(authLoading)return <div className="auth-loading"><img src={companyLogo} alt="伽睿智科公司Logo"/><span className="assistant-spinner"></span><p>正在验证安全会话…</p></div>
  if(!auth)return <LoginPage login={login} busy={authBusy} error={authError}/>
  if(auth.requiresPasswordChange)return <PasswordChangePage user={auth.user} changePassword={changeLoginPassword} logout={logout} busy={authBusy} error={authError}/>
  const sessionExpiresText=new Date(auth.expiresAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><img className="brand-logo" src={companyLogo} alt="伽睿智科公司Logo"/><div><strong>伽睿智科</strong><small>河北基地运营中枢</small></div></div>
      <div className="mode-sign"><div className="live-dot"></div><span>{roleModeLabel[role]}</span></div>
      <nav>{visibleNav.map(item=>{const Icon=item.icon;const hrbpPeopleTasks=role==='hrbp'?hrbpCases.filter(caseItem=>caseItem.status!=='closed'||(caseItem.managerNote&&!caseItem.filedAt)).length:role==='manager'?hrbpCases.filter(caseItem=>caseItem.status==='manager_pending'||caseItem.status==='manager_contacting').length:0;const managerPeopleTasks=role==='manager'&&workflow?workflow.people.staffingPlans.filter(plan=>plan.status==='manager_pending').length+workflow.people.lifecycle.filter(record=>record.status==='manager_pending').length+workflow.people.laborCases.filter(record=>['manager_pending','manager_doing'].includes(record.status)).length:0;const learningTasks=workflow?role==='training'?workflow.learning.assignments.filter(record=>record.status==='failed').length+workflow.learning.suggestions.filter(record=>['pending_training','reviewing','accepted'].includes(record.status)).length+workflow.learning.growthReviews.filter(record=>['planned','training_review'].includes(record.status)).length:role==='leader'?workflow.learning.assignments.filter(record=>record.status==='leader_verification').length+workflow.learning.growthReviews.filter(record=>record.status==='leader_pending').length:role==='employee'?workflow.learning.assignments.filter(record=>record.employeeId==='JR10776'&&record.status!=='closed').length:0:0;const governanceTasks=workflow?role==='director'?workflow.governance.budgets.filter(record=>record.status==='director_pending').length+workflow.governance.crossDepartmentItems.filter(record=>record.status==='director_verification').length+workflow.governance.meetings.filter(record=>record.status==='draft').length:role==='manager'?workflow.governance.shiftPlans.filter(record=>record.status==='manager_pending').length+workflow.governance.skillRoutes.filter(record=>record.status==='manager_pending').length+workflow.governance.crossDepartmentItems.filter(record=>record.targetRole==='manager'&&!['closed','director_verification'].includes(record.status)).length:role==='supervisor'?workflow.governance.shiftPlans.filter(record=>['draft','returned'].includes(record.status)).length+workflow.governance.skillRoutes.filter(record=>['draft','returned','executing'].includes(record.status)).length:role==='hrbp'?workflow.governance.crossDepartmentItems.filter(record=>record.targetRole==='hrbp'&&!['closed','director_verification'].includes(record.status)).length:0:0;const workforceTasks=workflow?.workforce?.requests.filter(request=>request.ownerRole===role&&!['closed','rejected'].includes(request.status)).length||0;const badge=item.id==='alerts'?pendingWorkflowEventCount(workflow):item.id==='tasks'?openWorkflowTaskCount(workflow,role)+hrbpPeopleTasks+managerPeopleTasks+learningTasks+governanceTasks:item.id==='workforce'?workforceTasks:0;return <button key={item.id} className={page===item.id?'active':''} onClick={()=>setPage(item.id)}><Icon size={18}/><span>{item.label}</span>{badge>0&&<em>{badge>99?'99+':badge}</em>}</button>})}</nav>
      {canManageSystem&&<div className="system-nav"><button className={`system-nav-head ${['user-management','role-management','ai-settings'].includes(page)?'active':''}`} onClick={()=>setSystemOpen(!systemOpen)}><Settings size={18}/><span>系统管理</span><ChevronDown size={15} className={systemOpen?'open':''}/></button>{systemOpen&&<div className="system-subnav">{allowedMenus.includes('user-management')&&<button className={page==='user-management'?'active':''} onClick={()=>setPage('user-management')}><Users size={15}/><span>用户管理</span></button>}{allowedMenus.includes('role-management')&&<button className={page==='role-management'?'active':''} onClick={()=>setPage('role-management')}><ShieldCheck size={15}/><span>角色管理</span></button>}{allowedMenus.includes('ai-settings')&&<button className={page==='ai-settings'?'active':''} onClick={()=>setPage('ai-settings')}><Bot size={15}/><span>AI模型配置</span></button>}</div>}</div>}
      <div className="sidebar-foot"><p>数据状态</p><div><Database size={15}/><span>{realData?'真实库适配层':'数据适配层'}</span><b>{realData?'已连接':'待连接'}</b></div><small>{realData?`${realData.meta.sourceSchema} · ${realData.meta.scopeLabel}`:realDataError||'正在连接真实库'}<br/>{realData?.meta.dates.productivity?`产能截至 ${realData.meta.dates.productivity}`:'等待数据时间'}</small></div>
    </aside>

    <main>
      <header className="topbar">
        <div className="crumb"><span>河北基地</span><ChevronRight size={14}/><strong>{pageLabel}</strong></div>
        <div className="top-actions">
          <button className="search-btn" onClick={()=>setSearchOpen(true)}><Search size={17}/><span>搜索员工 / 工单 / 指标</span><kbd>⌘ K</kbd></button>
          <button className={`icon-btn ${notificationOpen?'active':''}`} onClick={()=>setNotificationOpen(!notificationOpen)}><Bell size={18}/>{unreadCount>0&&<b>{unreadCount>9?'9+':unreadCount}</b>}</button>
          <div className="role-switcher">
            <button className="account-trigger" aria-label="账号与登录状态" aria-expanded={roleOpen} onClick={()=>setRoleOpen(!roleOpen)}><span className="avatar">{auth.user.name.slice(0,1)}</span><div><strong>{auth.user.name}</strong><small><i className="account-online-dot"></i>已登录 · {auth.user.jobNo}{isSystemAdmin&&role!=='director'?` · ${currentRole.label}视图`:''}</small></div><ChevronDown size={16} className={roleOpen?'open':''}/></button>
            {roleOpen&&<><button className="account-menu-shade" aria-label="关闭账号菜单" onClick={()=>setRoleOpen(false)}></button><section className="account-menu" aria-label="账号管理菜单"><header><span className="account-menu-avatar">{auth.user.name.slice(0,1)}</span><div><b>当前登录账号</b><strong>{auth.user.name}</strong><small>{auth.user.jobTitle} · {auth.role.name}</small></div><em><i></i>正常</em></header><div className="account-session-grid"><span>登录工号<strong>{auth.user.jobNo}</strong></span><span>所属组织<strong>{auth.user.department||'河北基地'}</strong></span><span>当前工作台<strong>{currentRole.label}</strong></span><span>会话有效至<strong>{sessionExpiresText}</strong></span></div><div className="account-menu-actions"><button onClick={()=>{setRoleOpen(false);setAuthError('');setPasswordDialogOpen(true)}}><KeyRound size={16}/><span><strong>修改登录密码</strong><small>验证当前密码后更新</small></span><ChevronRight size={15}/></button>{allowedMenus.includes('user-management')&&<button onClick={()=>{setPage('user-management');setRoleOpen(false)}}><UserCog size={16}/><span><strong>账号管理</strong><small>用户、角色与登录权限</small></span><ChevronRight size={15}/></button>}<button className="logout" disabled={authBusy} onClick={logout}><LockKeyhole size={16}/><span><strong>退出当前账号</strong><small>返回安全登录页面</small></span><ChevronRight size={15}/></button></div>{isSystemAdmin&&<div className="account-role-section"><header><span>管理员工作台切换</span><small>当前：{currentRole.label}</small></header><div>{roles.map(r=><button key={r.id} onClick={()=>{setRole(r.id);setPage('command');setRoleOpen(false);notify(`已进入${r.label}工作台`)}} className={r.id===role?'selected':''}><span>{r.initials}</span><div><strong>{r.label}</strong><small>{r.scope}</small></div>{r.id===role&&<CheckCircle2 size={16}/>}</button>)}</div></div>}</section></>}
          </div>
        </div>
      </header>

      <div className="workspace">
        {page==='command'&&(
          role==='director'?<DirectorPage notify={notify} workflow={workflow} busy={workflowBusy} run={runWorkflow}/>:
          role==='manager'?<ManagerPage notify={notify} trainingReport={trainingReport} readTrainingReport={reviewTrainingReport} hrbpCases={hrbpCases} setPage={setPage} workflow={workflow}/>:
          role==='supervisor'?<SupervisorPage alerts={alerts} notify={notify} handleAlert={handleAlert} workflow={workflow} busy={workflowBusy} run={runWorkflow}/>:
          role==='employee'?<EmployeePage notify={notify} workflow={workflow} setWorkflow={setWorkflow} setPage={setPage} realData={realData}/>:
          role==='quality'?<QualityPage notify={notify} workflow={workflow} setWorkflow={setWorkflow} setPage={setPage}/>:
          role==='training'?<TrainingPage notify={notify} trainingReport={trainingReport} publishTrainingReport={publishTrainingReport} busy={workflowBusy} workflow={workflow} setWorkflow={setWorkflow}/>:
          role==='hrbp'?<HrbpPage notify={notify} cases={hrbpCases} createCase={createHrbpCase} setPage={setPage} busy={workflowBusy} workflow={workflow} run={runWorkflow} realData={realData}/>:
          <CommandPage alerts={alerts} tasks={tasks} selectedAlert={selectedAlert} setSelectedAlert={alert=>setSelectedAlertId(alert?.id||'')} handleAlert={handleAlert} setPage={setPage}/>
        )}
        {page==='alerts'&&<WorkflowCenter role={role} state={workflow} error={workflowError} busy={workflowBusy} selectedId={selectedAlertId} setSelectedId={setSelectedAlertId} run={runWorkflow}/>}
        {page==='industry-news'&&<IndustryNewsPage notify={notify}/>}
        {page==='settlement'&&<SettlementPage notify={notify}/>}
        {page==='meeting'&&workflow&&(role==='leader'?<MeetingPage notify={notify} workflow={workflow} realData={realData} setWorkflow={setWorkflow}/>:<MorningBriefingHub role={role} state={workflow} setState={setWorkflow} notify={notify}/>)}
        {page==='team'&&<TeamPage role={role} notify={notify} realData={realData} busy={workflowBusy} run={runWorkflow}/>}
        {page==='workforce'&&<WorkforcePage role={role} state={workflow} error={workflowError} busy={workflowBusy} run={runWorkflow} realData={realData}/>}
        {page==='tasks'&&(role==='hrbp'?<HrbpPdcaHub state={workflow} error={workflowError} busy={workflowBusy} run={runWorkflow} cases={hrbpCases} act={runHrbpCaseAction} notify={notify}/>:role==='manager'?<ManagerPdcaHub state={workflow} error={workflowError} busy={workflowBusy} run={runWorkflow} cases={hrbpCases} act={runHrbpCaseAction} notify={notify}/>:role==='leader'?<LeaderPdcaHub state={workflow} setState={setWorkflow} error={workflowError} busy={workflowBusy} run={runWorkflow} notify={notify}/>:<WorkflowTasksPage key={role} role={role} state={workflow} error={workflowError} busy={workflowBusy} run={runWorkflow} notify={notify}/>)}
        {page==='excellence'&&<ExcellenceHub role={role} state={workflow} busy={workflowBusy} run={runWorkflow} notify={notify}/>}
        {page==='reports'&&<ReportsPage role={role} actor={currentUser?.name||currentRole.label} notify={notify} workflowTasks={workflow?.tasks||[]} workflowBusy={workflowBusy} createPdcaTask={async employee=>{await runWorkflow(()=>workflowApi.createReportTask({role,actor:currentUser?.name||currentRole.label,reportDate:'2026-07-19',employee}),`${employee.name}的任务单已创建，可在PDCA任务中继续处理`)}}/>}
        {page==='growth'&&<DevelopmentWorkHub role={role} state={workflow} setState={setWorkflow} notify={notify} employeeId="JR10776"/>}
        {page==='salary'&&<SalaryPerformanceHub role={role} notify={notify} realData={realData}/>}
        {page==='user-management'&&<UserManagementPage users={systemUsers} saveUser={saveSystemUser} userAction={runSystemUserAction} roles={systemRoles} organization={organization} notify={notify} busy={accessBusy} error={accessError}/>}
        {page==='role-management'&&<RoleManagementPage roles={systemRoles} saveRole={saveSystemRole} deleteRole={deleteSystemRole} users={systemUsers} organization={organization} notify={notify} busy={accessBusy} error={accessError}/>}
        {page==='ai-settings'&&<AiSettingsPage actor={currentUser?.name||currentRole.label} notify={notify}/>}
      </div>
    </main>

    {searchOpen&&<div className="global-search-shade" onMouseDown={()=>setSearchOpen(false)}><section className="global-search" onMouseDown={event=>event.stopPropagation()}><header><Search size={19}/><input ref={searchInputRef} value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} placeholder="搜索员工、预警、指标或模块"/><kbd>ESC</kbd></header><div className="global-search-results">{searchQuery.trim()===''?<div className="global-search-hint"><Command size={24}/><p>输入姓名、工号、预警内容或指标字段</p><span>可使用 ⌘ K / Ctrl K 随时打开</span></div>:searchResults.length?searchResults.map(result=><button key={result.id} onClick={()=>{if(result.entityId)setSelectedAlertId(result.entityId);setPage(result.target);setSearchOpen(false);setSearchQuery('')}}><span>{result.kind}</span><div><strong>{result.title}</strong><small>{result.desc}</small></div><ChevronRight size={16}/></button>):<div className="global-search-hint"><Search size={24}/><p>没有找到匹配结果</p><span>请尝试姓名、工号或指标名称</span></div>}</div></section></div>}
    {notificationOpen&&<NotificationCenter role={role} items={roleNotifications} readIds={readNotifications} markRead={(id)=>markNotificationsRead([id])} markAll={()=>markNotificationsRead(roleNotifications.map(n=>n.id))} close={()=>setNotificationOpen(false)} go={(target)=>{if(allowedMenus.includes(target)){setPage(target)};setNotificationOpen(false)}}/>}
    <button className={`ai-fab ${assistantOpen?'open':''}`} onClick={()=>setAssistantOpen(open=>!open)}><Sparkles size={20}/><span>问AI作战助手</span></button>
    {assistantOpen&&<section className="assistant-panel" aria-label="AI作战助手聊天窗口">
      <header className="assistant-head"><div><span><Bot size={19}/></span><div><strong>AI作战助手</strong><small>DeepSeek 基础模型 · 结合当前作战数据</small></div></div><div className={`assistant-model-state ${assistantConfigured===false?'offline':''}`}><i></i>{assistantConfigured===null?'连接检测中':assistantConfigured?assistantModel:'待配置'}</div><button aria-label="关闭AI作战助手" onClick={()=>setAssistantOpen(false)}><X size={18}/></button></header>
      <div className="assistant-context"><div><Sparkles size={14}/><span>当前上下文</span><b>{currentRole.label} · {pageLabel}</b></div><button disabled={assistantBusy||assistantActionBusy} onClick={startNewAssistantThread}>新建对话</button></div>
      <div className="assistant-body">
        {assistantMessages.map((message,index)=><article className={`assistant-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role==='assistant'?<Bot size={15}/>:currentRole.initials}</span><div><b>{message.role==='assistant'?'AI作战助手':'我'}</b><p>{message.content}</p></div></article>)}
        {assistantBusy&&<article className="assistant-message assistant loading"><span><Bot size={15}/></span><div><b>AI作战助手</b><p><i></i><i></i><i></i><em>正在结合当前作战数据思考</em></p></div></article>}
        {assistantError&&<div className="assistant-error"><AlertTriangle size={15}/><div><strong>暂时无法获得回答</strong><p>{assistantError}</p></div><button onClick={()=>runAssistant(assistantMessages.filter(message=>message.role==='user').slice(-1)[0]?.content)}>重试</button></div>}
        {assistantMessages.some(message=>message.role==='user')&&!assistantDraft&&<div className="assistant-action-entry"><div><ListChecks size={17}/><span><strong>把建议落实为任务</strong><small>AI先生成草案，你确认后才进入PDCA</small></span></div><button disabled={assistantActionBusy||assistantBusy} onClick={generateAssistantDraft}>{assistantActionBusy?<span className="assistant-spinner"></span>:<Sparkles size={14}/>}生成行动草案</button></div>}
        {assistantDraft&&<section className="assistant-action-draft"><header><span><Sparkles size={14}/>AI行动草案</span><b>待本人确认</b></header><label>行动标题<input value={assistantDraft.title} onChange={event=>updateAssistantDraft('title',event.target.value)}/></label><label>问题与差距<textarea value={assistantDraft.problem} onChange={event=>updateAssistantDraft('problem',event.target.value)}/></label><div><label>责任人<input value={assistantDraft.owner} onChange={event=>updateAssistantDraft('owner',event.target.value)}/></label><label>截止时间<input type="datetime-local" value={assistantDraft.dueAt.slice(0,16)} onChange={event=>{if(event.target.value)updateAssistantDraft('dueAt',new Date(event.target.value).toISOString())}}/></label></div><label>目标值<input value={assistantDraft.target} onChange={event=>updateAssistantDraft('target',event.target.value)}/></label><label>验收标准<textarea value={assistantDraft.successCriteria} onChange={event=>updateAssistantDraft('successCriteria',event.target.value)}/></label><aside><Target size={14}/><span>将由<strong>{({leader:'客服班长',supervisor:'客服主管',manager:'客服经理',director:'运营总监',quality:'质检专员',employee:'客服专员',training:'培训主管',hrbp:'HRBP经理'} as Record<string,string>)[assistantDraft.verificationRole]}</strong>验收，AI不会自动下发。</span></aside><footer><button className="secondary" disabled={assistantActionBusy} onClick={()=>setAssistantDraft(null)}>取消</button><button className="primary" disabled={assistantActionBusy||!assistantDraft.title.trim()||!assistantDraft.problem.trim()||!assistantDraft.target.trim()||!assistantDraft.successCriteria.trim()} onClick={executeAssistantDraft}>{assistantActionBusy?<span className="assistant-spinner"></span>:<CheckCircle2 size={14}/>}确认并进入PDCA</button></footer></section>}
        <div ref={assistantEndRef}></div>
      </div>
      {assistantMessages.length===1&&<div className="quick-asks"><button onClick={()=>runAssistant('结合当前数据，今天最需要先管谁？')}>今天先管谁？</button><button onClick={()=>runAssistant('帮我生成今天班前会的三项宣讲重点')}>生成班前会重点</button><button onClick={()=>runAssistant('分析当前核心指标差距，并给出行动建议')}>分析指标差距</button></div>}
      <div className="assistant-input"><textarea rows={1} value={query} disabled={assistantBusy||assistantActionBusy} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();runAssistant()}}} placeholder={assistantConfigured===false?'配置 DEEPSEEK_API_KEY 后即可对话':'输入问题，Enter 发送，Shift+Enter 换行'}/><button aria-label="发送消息" disabled={!query.trim()||assistantBusy||assistantActionBusy} onClick={()=>runAssistant()}>{assistantBusy?<span className="assistant-spinner"></span>:<Send size={17}/>}</button></div>
      <footer><span>AI草案须由本人确认后才会执行</span><b>由 DeepSeek 提供模型能力</b></footer>
    </section>}
    {passwordDialogOpen&&<AccountPasswordDialog
      user={auth.user}
      busy={authBusy}
      error={authError}
      close={()=>{setPasswordDialogOpen(false);setAuthError('')}}
      changePassword={(currentPassword,newPassword)=>changeLoginPassword(currentPassword,newPassword,'密码修改成功，当前登录会话已刷新')}
    />}
    {toast&&<div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
  </div>
}

function AccountPasswordDialog({user,busy,error,close,changePassword}:{user:SystemUser;busy:boolean;error:string;close:()=>void;changePassword:(currentPassword:string,newPassword:string)=>Promise<boolean>}){
 const [currentPassword,setCurrentPassword]=useState('')
 const [newPassword,setNewPassword]=useState('')
 const [confirmPassword,setConfirmPassword]=useState('')
 const localError=confirmPassword&&newPassword!==confirmPassword?'两次输入的新密码不一致':newPassword&&newPassword.length<8?'新密码至少需要8位':''
 const submit=async(event:FormEvent)=>{event.preventDefault();if(!localError&&currentPassword&&newPassword&&confirmPassword&&await changePassword(currentPassword,newPassword))close()}
 return <div className="modal-backdrop account-password-backdrop" onMouseDown={close}><form className="account-password-modal" onSubmit={submit} onMouseDown={event=>event.stopPropagation()}><header><div><span>账号安全</span><h2>修改登录密码</h2><p>{user.name} · {user.jobNo}</p></div><button type="button" aria-label="关闭修改密码" disabled={busy} onClick={close}><X size={19}/></button></header><div className="account-password-body">{(error||localError)&&<div className="auth-error"><AlertTriangle size={16}/>{localError||error}</div>}<label><span>当前密码</span><div><LockKeyhole size={16}/><input autoFocus type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} placeholder="请输入当前登录密码"/></div></label><label><span>新密码</span><div><KeyRound size={16}/><input type="password" autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} placeholder="至少8位，且不能与当前密码相同"/></div></label><label><span>确认新密码</span><div><ShieldCheck size={16}/><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} placeholder="再次输入新密码"/></div></label><aside><ShieldCheck size={15}/><span>密码仅提交至业务服务并使用随机盐加密保存，页面不会记录明文密码。</span></aside></div><footer><button type="button" className="secondary" disabled={busy} onClick={close}>取消</button><button className="primary" disabled={busy||!!localError||!currentPassword||!newPassword||!confirmPassword}>{busy?<span className="assistant-spinner"></span>:<KeyRound size={15}/>}确认修改</button></footer></form></div>
}

function LoginPage({login,busy,error}:{login:(jobNo:string,password:string)=>Promise<boolean>;busy:boolean;error:string}){
 const [rememberedJobNo]=useState(readLastLoginJobNo)
 const [usingRemembered,setUsingRemembered]=useState(Boolean(rememberedJobNo))
 const [jobNo,setJobNo]=useState(rememberedJobNo)
 const [password,setPassword]=useState('')
 const submit=async(event:FormEvent)=>{event.preventDefault();if(jobNo.trim()&&password)await login(jobNo,password)}
 const switchAccount=()=>{setUsingRemembered(false);setJobNo('');setPassword('')}
 return <main className="auth-page"><section className="auth-brand-panel"><div className="auth-brand"><img src={companyLogo} alt="伽睿智科公司Logo"/><div><strong>伽睿智科</strong><span>河北基地运营中枢</span></div></div><div className="auth-value"><span>全岗位协同 · 目标驱动 · PDCA闭环</span><h1>把每天应该做的事，落实到岗位、目标和责任人</h1><p>运营、客服、质检、培训与HRBP使用同一业务状态协同，关键动作全程留痕。</p></div><div className="auth-security"><ShieldCheck size={21}/><div><strong>安全会话保护</strong><p>账号密码仅发送至业务服务，登录态使用HttpOnly Cookie保存。</p></div></div></section><section className="auth-form-panel"><form onSubmit={submit}><header><span>安全登录</span><h2>进入河北基地作战台</h2><p>{usingRemembered?'已保留上次登录账号，请输入密码':'请使用工号和个人密码登录'}</p></header>{error&&<div className="auth-error"><AlertTriangle size={16}/>{error}</div>}<label><span className="auth-field-heading"><b>工号</b>{usingRemembered&&<button type="button" onClick={switchAccount}>切换账号</button>}</span><div className={usingRemembered?'remembered-account':''}><UserCog size={17}/><input autoFocus={!usingRemembered} readOnly={usingRemembered} autoComplete="username" aria-label="工号" value={jobNo} onChange={event=>setJobNo(event.target.value)} placeholder="请输入工号"/>{usingRemembered&&<em>上次登录</em>}</div></label><label><span>密码</span><div><LockKeyhole size={17}/><input autoFocus={usingRemembered} type="password" autoComplete="current-password" aria-label="密码" value={password} onChange={event=>setPassword(event.target.value)} placeholder="请输入密码"/></div></label><button className="auth-submit" disabled={busy||!jobNo.trim()||!password}>{busy?<span className="assistant-spinner"></span>:<ShieldCheck size={17}/>}登录作战台</button><footer>{usingRemembered&&<small className="auth-remember-note"><ShieldCheck size={12}/>仅在本机保留账号，密码不会保存。</small>}<small>账号由系统管理员统一开通</small><small>一次性初始密码通过安全渠道交付，首次登录必须修改。</small></footer></form></section></main>
}

function PasswordChangePage({user,changePassword,logout,busy,error}:{user:SystemUser;changePassword:(currentPassword:string,newPassword:string)=>Promise<boolean>;logout:()=>void;busy:boolean;error:string}){
 const [currentPassword,setCurrentPassword]=useState('')
 const [newPassword,setNewPassword]=useState('')
 const [confirmPassword,setConfirmPassword]=useState('')
 const localError=confirmPassword&&newPassword!==confirmPassword?'两次输入的新密码不一致':newPassword&&newPassword.length<8?'新密码至少需要8位':''
 const submit=async(event:FormEvent)=>{event.preventDefault();if(!localError&&currentPassword&&newPassword)await changePassword(currentPassword,newPassword)}
 return <main className="auth-page password-change-page"><section className="auth-brand-panel"><div className="auth-brand"><img src={companyLogo} alt="伽睿智科公司Logo"/><div><strong>伽睿智科</strong><span>河北基地运营中枢</span></div></div><div className="auth-value"><span>首次登录安全校验</span><h1>先设置个人密码，再进入岗位作战台</h1><p>密码修改完成后，系统会根据账号角色加载对应菜单、目标和待办。</p></div><div className="auth-security"><KeyRound size={21}/><div><strong>密码不会回显</strong><p>服务端使用随机盐与scrypt哈希保存，不存储明文密码。</p></div></div></section><section className="auth-form-panel"><form onSubmit={submit}><header><span>账号激活</span><h2>{user.name}，请修改初始密码</h2><p>{user.jobNo} · {user.jobTitle}</p></header>{(error||localError)&&<div className="auth-error"><AlertTriangle size={16}/>{localError||error}</div>}<label><span>当前密码</span><div><LockKeyhole size={17}/><input autoFocus type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} placeholder="输入当前密码"/></div></label><label><span>新密码</span><div><KeyRound size={17}/><input type="password" autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} placeholder="至少8位，不能与当前密码相同"/></div></label><label><span>确认新密码</span><div><KeyRound size={17}/><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} placeholder="再次输入新密码"/></div></label><button className="auth-submit" disabled={busy||!!localError||!currentPassword||!newPassword||!confirmPassword}>{busy?<span className="assistant-spinner"></span>:<CheckCircle2 size={17}/>}保存密码并进入系统</button><button type="button" className="auth-logout" onClick={logout}>退出并使用其他账号</button></form></section></main>
}

type AppNotification={id:string;type:'task'|'alert'|'business'|'system';title:string;desc:string;time:string;target:string;priority:'high'|'medium'|'normal'}

function buildRoleNotifications(role:Role,workflow:WorkflowState|null,trainingReport:TrainingReportState,hrbpCases:HrbpCase[]):AppNotification[]{
 const persisted=(workflow?.notifications||[]).filter(n=>n.role===role&&!n.read).map(n=>({id:n.id,type:(n.target==='tasks'?'task':n.priority==='high'?'alert':'business') as AppNotification['type'],title:n.title,desc:n.desc,time:new Date(n.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),target:n.target,priority:n.priority as AppNotification['priority']}))
 const hasPersistedTrainingNotice=persisted.some(item=>item.title.includes('培训日报'))
 const workflowTasks=(workflow?.tasks||[]).filter(t=>t.status!=='closed'&&(t.ownerRole===role||(role==='supervisor'&&t.status==='pending_verification'))).map(t=>({id:`WF-${role}-${t.id}`,type:'task' as const,title:`PDCA进展 · ${t.title}`,desc:`${t.owner} · ${workflowTaskStatus(t.status,t.verificationRole)} · 当前${t.progress}%`,time:'动态更新',target:'tasks',priority:(t.status==='escalated'?'high':'medium') as AppNotification['priority']}))
 const pendingAlerts=(workflow?.events||[]).filter(event=>event.status==='pending_supervisor_review').length
 const common:AppNotification[]=pendingAlerts?[{id:`N-${role}-alert`,type:'alert',title:'AI预警待处理',desc:`当前有${pendingAlerts}条预警等待主管确认`,time:'动态更新',target:'alerts',priority:'high'}]:[]
 const byRole:Record<Role,AppNotification[]>={
  director:[{id:'N-D-NEWS',type:'business',title:'行业动态新增4条',desc:'工信部、中国联通、10015舆情和行业竞品完成本轮采集',time:'20分钟前',target:'industry-news',priority:'medium'},{id:'N-D-SET',type:'business',title:'结算差异需要介入',desc:'10015升投6月结费差异17.6万元，审核截止07-25',time:'35分钟前',target:'settlement',priority:'high'}],
  manager:[...hrbpCases.filter(item=>item.status==='manager_pending'&&!persisted.some(notice=>notice.desc.includes(item.id))).map(item=>({id:`N-M-HR-${item.id}`,type:'task' as const,title:`HRBP升级 · ${item.name}高流失风险`,desc:`${item.id} · ${item.team} · 风险分${item.riskScore} · 请在${item.due}前完成经理沟通`,time:'动态更新',target:'tasks',priority:'high' as const})),...(trainingReport.sent&&!trainingReport.read&&!hasPersistedTrainingNotice?[{id:'N-M-TRAINING-REPORT',type:'business' as const,title:'今日培训日报待查阅',desc:`培训岗已提交${trainingReport.reportNo}，包含岗前班进展、通关预测和岗中规范传达结果`,time:trainingReport.generatedAt||'刚刚',target:'command',priority:'high' as const}]:[]),{id:'N-M-KPI',type:'business',title:'普通客服一区进入红色改善区',desc:'满意率与重复来电率双偏差，等待主管提交改善计划',time:'15分钟前',target:'command',priority:'high'},{id:'N-M-LEADER',type:'business',title:'3名班长履职需辅导',desc:'预警闭环率或面谈及时率低于80%',time:'1小时前',target:'growth',priority:'medium'}],
  supervisor:[{id:'N-S-DISPATCH',type:'business',title:'4班、8班出现即时人力缺口',desc:'AI已生成跨班组调度建议，预计补充5人次',time:'3分钟前',target:'command',priority:'high'},{id:'N-S-COACH',type:'business',title:'今日有2项班长辅导',desc:'张伟15:30跟岗，赵敏明日09:30管理复盘',time:'25分钟前',target:'growth',priority:'medium'}],
  leader:[{id:'N-L-STAFF',type:'alert',title:'王芳需要关注面谈',desc:'小休超限叠加绩效连续下滑，截止14:30',time:'5分钟前',target:'team',priority:'high'},{id:'N-L-MEET',type:'business',title:'今日班前会材料已生成',desc:'包含2红3黄、今日目标和业务变更',time:'08:15',target:'meeting',priority:'normal'}],
  employee:[{id:'N-E-PERF',type:'business',title:'个人绩效周报已更新',desc:'本周排名上升2位，重复来电指标仍需改善',time:'08:00',target:'salary',priority:'normal'}],
  quality:[{id:'N-Q-REVIEW',type:'business',title:'AI质检待复核12条',desc:'其中合规高风险2条，请在今日16:00前完成',time:'12分钟前',target:'alerts',priority:'high'}],
  training:[{id:'N-T-COURSE',type:'business',title:'新增培训需求3项',desc:'续约争议、投诉首次联系和小休规范',time:'30分钟前',target:'growth',priority:'medium'}],
  hrbp:[...hrbpCases.filter(item=>item.status==='closed'&&item.managerNote&&!item.filedAt&&!persisted.some(notice=>notice.desc.includes(item.id))).map(item=>({id:`N-H-RESULT-${item.id}`,type:'business' as const,title:`经理沟通结果已回传 · ${item.name}`,desc:`${item.id} · ${item.result||'任务已关闭，请完成HRBP备案'}`,time:'动态更新',target:'tasks',priority:'high' as const})),{id:'N-H-RISK',type:'alert',title:'流失风险名单新增2人',desc:'请HRBP联合直属班长安排挽留沟通',time:'40分钟前',target:'command',priority:'high'}]
 }
 return [...persisted,...workflowTasks,...byRole[role],...common]
}

function NotificationCenter({role,items,readIds,markRead,markAll,close,go}:{role:Role;items:AppNotification[];readIds:string[];markRead:(id:string)=>void;markAll:()=>void;close:()=>void;go:(target:string)=>void}){
 const [tab,setTab]=useState('全部')
 const list=tab==='全部'?items:items.filter(i=>tab==='PDCA'?i.type==='task':i.type!=='task')
 return <><div className="notification-shade" onClick={close}></div><aside className="notification-center"><header><div><span>消息中心</span><h2>{roles.find(r=>r.id===role)?.label}通知</h2></div><button onClick={close}><X size={18}/></button></header><div className="notification-tools"><div>{['全部','PDCA','业务通知'].map(t=><button className={tab===t?'active':''} onClick={()=>setTab(t)} key={t}>{t}</button>)}</div><button onClick={markAll}>全部已读</button></div><div className="notification-list">{list.map(n=><article className={`${readIds.includes(n.id)?'read':''} ${n.priority}`} key={n.id} onClick={()=>markRead(n.id)}><span className={`notification-icon ${n.type}`}>{n.type==='task'?<ListChecks size={17}/>:n.type==='alert'?<AlertTriangle size={17}/>:n.type==='system'?<Settings size={17}/>:<Bell size={17}/>}</span><div><header><strong>{n.title}</strong><time>{n.time}</time></header><p>{n.desc}</p><footer><span>{n.type==='task'?'PDCA任务':n.type==='alert'?'风险提醒':n.type==='system'?'系统通知':'业务通知'}</span><button onClick={e=>{e.stopPropagation();markRead(n.id);go(n.target)}}>查看详情 <ChevronRight size={13}/></button></footer></div></article>)}</div><footer><span>共 {items.length} 条 · 未读 {items.filter(i=>!readIds.includes(i.id)).length} 条</span><button onClick={()=>go('tasks')}>进入PDCA任务中心</button></footer></aside></>
}

function PageHead({eyebrow,title,desc,actions}:{eyebrow:string,title:string,desc:string,actions?:React.ReactNode}){return <div className="page-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{actions&&<div className="page-actions">{actions}</div>}</div>}

function DirectorPage({notify,workflow,busy,run}:{notify:(s:string)=>void;workflow:WorkflowState|null;busy:boolean;run:WorkflowRunner}){
  const [newsFilter,setNewsFilter]=useState('全部')
  const [settlementTab,setSettlementTab]=useState('总览')
  const news=industryNews
  const shown=newsFilter==='全部'?news:news.filter(n=>n.source===newsFilter)
  const settlementRows=settlements
  const shownSettlements=settlementTab==='总览'?settlementRows:settlementTab==='逾期风险'?settlementRows.filter(item=>item.riskLevel==='high'):settlementRows.filter(item=>item.stage!=='待开票'||item.riskLevel!=='low')
  return <><PageHead eyebrow="运营总监 · 河北基地全域" title="先看客户，再看经营，最后盯回款" desc="把甲方变化、经营结果与现金回收放在同一张总监工作台上。" actions={<button className="primary" onClick={()=>notify('总监经营简报已生成')}><FileBarChart size={16}/>生成经营简报</button>}/>
    {workflow&&workflow.financialPerformance?.metrics?.length>0&&<BudgetAchievementPanel state={workflow.financialPerformance} role="director"/>}
    {workflow&&<DirectorGovernanceHub state={workflow} busy={busy} run={run}/>}
    <div className="director-grid">
      <section className="panel industry-panel"><div className="panel-head"><div><span>客户行业动态 · 定时采集</span><h2>哪些外部变化会影响河北基地</h2></div><div className="collector-status"><i></i><span>下次采集 12:00</span><button onClick={()=>notify('行业动态采集任务已触发；MVP当前展示模拟结果')}><RefreshCw size={14}/>立即采集</button></div></div><div className="news-filters">{['全部','工信部','中国联通','10015舆情','行业竞品'].map(f=><button className={newsFilter===f?'active':''} key={f} onClick={()=>setNewsFilter(f)}>{f}</button>)}</div><div className="news-list">{shown.map((n,i)=><article key={n.title}><div className={`news-icon n${i}`}><Newspaper size={18}/></div><div><header><span>{n.source}</span><em>{n.time}</em><b>{n.impact}</b></header><h3>{n.title}</h3><p>{n.summary}</p></div><button onClick={()=>notify(`已将“${n.title}”加入总监关注`)}><ArrowUpRight size={16}/></button></article>)}</div><footer className="source-note"><RadioTower size={15}/><span>计划数据源：工信部官网、中国联通官网及新闻、公开舆情信息源、通信行业媒体。后端采集服务待接入。</span></footer></section>
      <section className="panel settlement-panel"><div className="panel-head"><div><span>合同驱动 · 结费管理（流程台账，不作为预算达成口径）</span><h2>从计划到回款，全流程不掉单</h2></div><button onClick={()=>notify('新建结费申请功能待后端持久化')}><ReceiptText size={15}/>新建结费申请</button></div><div className="settlement-steps">{[['合同','3'],['计划','3'],['核算','2'],['审核','1'],['开票','1'],['回款','2']].map((x,i)=><div className={i<3?'done':i===3?'active':''} key={x[0]}><span>{i<3?<CheckCircle2 size={14}/>:i+1}</span><b>{x[0]}</b><small>{x[1]}项</small></div>)}</div><div className="settlement-tabs">{['总览','待处理','逾期风险'].map(t=><button className={settlementTab===t?'active':''} onClick={()=>setSettlementTab(t)} key={t}>{t}</button>)}</div><div className="settlement-list">{shownSettlements.length?shownSettlements.map(s=>{const progress=Math.round(s.actual/s.plan*100);return <article key={s.id}><header><div><strong>{s.name}</strong><small>{s.owner} · 截止 {s.due}</small></div><span className={s.riskLevel==='high'?'risk':''}>{s.statusLabel}</span></header><div className="settlement-values"><span>应结 <b>¥{s.plan.toFixed(1)}万</b></span><span>已确认 <b>¥{s.actual.toFixed(1)}万</b></span><em>{progress}%</em></div><div className="settlement-progress"><i style={{width:`${progress}%`}}></i></div></article>}):<div className="filter-empty">当前分类暂无结算项目</div>}</div><div className="settlement-alert"><AlertTriangle size={17}/><div><strong>本月有 1 个高风险节点</strong><p>10015结费差异17.6万元，原因集中在人员费用核减和考核扣款复核。</p></div><button onClick={()=>notify('已生成结费差异督办任务')}>发起督办</button></div></section>
    </div>
    <section className="panel executive-bottom"><div className="panel-head"><div><span>组织与业务</span><h2>总监需要介入的3个管理断点</h2></div></div>{[['10015前台','满意率与重复来电率双偏差','客服经理牵头，今日提交专项改善计划','红'],['普通客服一区','2个班组班长闭环完成率不足70%','主管本周完成班长辅导','黄'],['HAC支持部','预计下月净缺口16人','HRBP 7月25日前给出招聘补充方案','黄']].map(x=><div className="exec-issue" key={x[0]}><span className={x[3]==='红'?'critical':'warning'}></span><strong>{x[0]}</strong><p>{x[1]}</p><em>{x[2]}</em><button onClick={()=>notify(`已打开${x[0]}管理详情`)}>下钻</button></div>)}</section>
  </>
}

function IndustryNewsPage({notify}:{notify:(s:string)=>void}){
 const [filter,setFilter]=useState('全部');const [selectedId,setSelectedId]=useState(industryNews[0].id)
 const shown=filter==='全部'?industryNews:industryNews.filter(n=>n.source===filter)
 const selected=shown.find(item=>item.id===selectedId)||shown[0]
 return <><PageHead eyebrow="授权模块 · 定时采集" title="客户行业动态" desc="监测工信部、中国联通、10015舆情和行业竞品，识别对基地经营与交付的潜在影响。" actions={<button className="primary" onClick={()=>notify('行业动态采集任务已触发；MVP当前使用模拟结果')}><RefreshCw size={16}/>立即采集</button>}/><div className="industry-stats">{[['今日新增','4条'],['高相关','2条'],['待总监评估','1条'],['下次采集','12:00']].map(x=><div key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong></div>)}</div><div className="industry-workspace"><section className="panel industry-stream"><div className="news-filters">{['全部','工信部','中国联通','10015舆情','行业竞品'].map(f=><button className={filter===f?'active':''} onClick={()=>setFilter(f)} key={f}>{f}</button>)}</div>{shown.map(n=><article className={selected?.id===n.id?'selected':''} onClick={()=>setSelectedId(n.id)} key={n.id}><span className="news-source">{n.source.slice(0,1)}</span><div><header><b>{n.source}</b><time>{n.time}</time><em>{n.impact}</em></header><h3>{n.title}</h3><p>{n.summary}</p></div></article>)}</section><section className="panel news-analysis"><div className="panel-head"><div><span>AI影响研判</span><h2>对河北基地意味着什么</h2></div><Sparkles size={19}/></div><div className="analysis-focus"><span>{selected?.source}</span><h2>{selected?.title}</h2><p>{selected?.summary}</p></div><div className="impact-chain"><div><b>外部信号</b><span>{selected?.sentiment}变化</span></div><ChevronRight size={15}/><div><b>业务影响</b><span>质检/培训/投诉</span></div><ChevronRight size={15}/><div><b>建议动作</b><span>形成专项关注</span></div></div><div className="analysis-actions"><h3>建议总监动作</h3><label><input type="checkbox" defaultChecked/>加入本周经营例会</label><label><input type="checkbox"/>下发业务影响评估</label><label><input type="checkbox"/>启动10015舆情专项监控</label></div><button className="primary wide" onClick={()=>notify('已生成行业动态影响评估任务')}>生成影响评估任务</button></section></div></>
}

function SettlementPage({notify}:{notify:(s:string)=>void}){
 const [tab,setTab]=useState('全部')
 const rows=tab==='全部'?settlements:tab==='逾期风险'?settlements.filter(item=>item.riskLevel==='high'):settlements.filter(item=>item.stage===tab)
 return <><PageHead eyebrow="授权模块 · 合同驱动" title="结算管理" desc="从合同生成结算计划，贯通核算、审核、开票和回款，确保应结尽结、到期必跟。" actions={<button className="primary" onClick={()=>notify('新建结费申请功能待后端持久化')}><Plus size={16}/>新建结费申请</button>}/><div className="settlement-kpis">{[['本月应结费','¥527.0万','3个项目'],['已确认结费','¥505.9万','确认率96.0%'],['已开票','¥435.2万','开票率82.6%'],['已回款','¥398.6万','回款率75.6%'],['逾期风险','¥21.1万','1个高风险']].map((x,i)=><div className={i===4?'risk':''} key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong><p>{x[2]}</p></div>)}</div><section className="panel settlement-flow"><div className="panel-head"><div><span>全流程状态</span><h2>合同 → 计划 → 核算 → 审核 → 开票 → 回款</h2></div></div><div className="flow-stages">{[['合同生效','3','100%'],['计划生成','3','100%'],['费用核算','3','100%'],['甲方审核','2','67%'],['开票','1','33%'],['回款','1','25%']].map((x,i)=><div key={x[0]}><span className={i<3?'done':i===3?'active':''}>{i<3?<CheckCircle2 size={15}/>:i+1}</span><b>{x[0]}</b><strong>{x[1]}项</strong><em>{x[2]}</em></div>)}</div></section><section className="panel settlement-table"><div className="admin-toolbar"><div className="settlement-tabs">{['全部','待核算','审核中','待开票','待回款','逾期风险'].map(t=><button className={tab===t?'active':''} onClick={()=>setTab(t)} key={t}>{t}</button>)}</div><button className="secondary"><FileBarChart size={15}/>导出结算台账</button></div><div className="settlement-head"><span>结算项目</span><span>应结金额</span><span>确认金额</span><span>差异</span><span>进展</span><span>责任部门</span><span>截止日期</span><span>操作</span></div>{rows.length?rows.map(r=>{const progress=Math.round(r.actual/r.plan*100);return <div className="settlement-row" key={r.id}><strong>{r.name}</strong><span>¥{r.plan}万</span><span>¥{r.actual}万</span><span className={r.plan-r.actual>10?'bad-txt':''}>¥{(r.plan-r.actual).toFixed(1)}万</span><div><b>{r.statusLabel}</b><i><em style={{width:`${progress}%`}}></em></i></div><span>{r.owner}</span><span>{r.due}</span><button onClick={()=>notify(`已打开${r.name}结算详情`)}>详情</button></div>}):<div className="filter-empty">当前分类暂无结算项目</div>}</section><div className="settlement-bottom"><section className="panel"><div className="panel-head"><div><span>差异分析</span><h2>21.1万元差在哪里</h2></div></div>{[['人员费用核减','¥9.6万','45%'],['考核扣款复核','¥8.0万','38%'],['增减项材料缺失','¥3.5万','17%']].map(x=><div className="difference-row" key={x[0]}><strong>{x[0]}</strong><span>{x[1]}</span><i><em style={{width:x[2]}}></em></i><b>{x[2]}</b></div>)}</section><section className="panel"><div className="panel-head"><div><span>总监待办</span><h2>需要介入的结算节点</h2></div></div><div className="settlement-todo"><AlertTriangle size={19}/><div><strong>10015考核扣款存在口径分歧</strong><p>需与甲方确认重复投诉率扣款口径，截止07-23。</p></div><button onClick={()=>notify('已生成结算口径协调任务')}>发起协调</button></div><div className="settlement-todo"><Clock3 size={19}/><div><strong>400在线补充材料临近截止</strong><p>剩余1天，当前缺少人员费用明细附件。</p></div><button onClick={()=>notify('已向责任部门发送催办通知')}>催办</button></div></section></div></>
}

function ManagerPage({notify,trainingReport,readTrainingReport,hrbpCases,setPage,workflow}:{notify:(s:string)=>void;trainingReport:TrainingReportState;readTrainingReport:()=>void;hrbpCases:HrbpCase[];setPage:(page:string)=>void;workflow:WorkflowState|null}){
 const [trainingReportOpen,setTrainingReportOpen]=useState(false)
 const teams=[['前台普通一区','95.8','4.9%','68%','高'],['前台高星一区','98.1','3.2%','92%','低'],['预警专席区','97.4','3.8%','85%','中'],['工单督办区','96.9','4.1%','78%','中'],['末端闭环区','97.8','3.5%','89%','低']]
 const pendingHrbp=hrbpCases.filter(item=>item.status==='manager_pending'||item.status==='manager_contacting')
 return <><PageHead eyebrow="客服经理 · 10015升投" title="业务指标看结果，组织效能找原因" desc="经理不再逐班组看明细，先看哪位主管、哪个区域正在拖累业务目标。" actions={<button className="primary" onClick={()=>notify('已向主管下发本周重点')}><Target size={16}/>下发本周重点</button>}/>
  {workflow&&workflow.financialPerformance?.metrics?.length>0&&<BudgetAchievementPanel state={workflow.financialPerformance} role="manager"/>}
  {pendingHrbp.length>0&&<section className="manager-hrbp-notice"><span><UserRoundSearch size={19}/></span><div><b>HRBP升级 · 经理待处理</b><h3>{pendingHrbp.length}名高流失风险员工需要经理介入</h3><p>{pendingHrbp.map(item=>`${item.name}（${item.cycle}，风险${item.riskScore}分）`).join('；')}</p></div><time>最早截止 {pendingHrbp[0].due}</time><button onClick={()=>setPage('tasks')}>进入PDCA处理 <ChevronRight size={14}/></button></section>}
  {trainingReport.sent&&<section className={`manager-training-notice ${trainingReport.read?'read':'unread'}`}><span><GraduationCap size={19}/></span><div><b>{trainingReport.read?'已查阅':'新消息 · 待查阅'}</b><h3>培训岗已提交今日培训日报</h3><p>{trainingReport.reportNo} · 岗前培训2个班、岗中专项3项，预计新工通关率88.5%。</p></div><time>{trainingReport.generatedAt}</time><button onClick={()=>{setTrainingReportOpen(true);readTrainingReport()}}>查阅日报 <ChevronRight size={14}/></button></section>}
  <section className="manager-summary"><div><span>本周经理判断</span><h2>满意率偏差主要来自普通客服一区；班长履职差异正在放大结果差异</h2><p>5个区域中1个高风险、2个需关注。建议将普通客服一区列为本周唯一红色改善区。</p></div><div><strong>1</strong><span>红色改善区</span></div><div><strong>3</strong><span>需辅导班长</span></div><div><strong>12</strong><span>尾端员工</span></div></section>
  <div className="manager-kpis">{[['满意率','96.8%','-0.4pp','risk'],['一次解决率','89.6%','+1.6pp','good'],['重复来电率','4.7%','+0.7pp','bad'],['升级率','1.18%','+0.16pp','risk']].map(x=><div className={`metric-card ${x[3]}`} key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong><p>较目标 {x[2]}</p></div>)}</div>
  <div className="manager-grid"><section className="panel org-heat"><div className="panel-head"><div><span>组织效能矩阵</span><h2>结果差 × 管理弱，优先介入</h2></div><button><BarChart3 size={15}/>切换指标</button></div><div className="heat-head"><span>区域</span><span>满意率</span><span>重复来电</span><span>班长闭环率</span><span>风险</span></div>{teams.map(x=><div className="heat-row" key={x[0]}><strong>{x[0]}</strong><span>{x[1]}%</span><span>{x[2]}</span><span><i style={{width:x[3]}}></i><b>{x[3]}</b></span><em className={x[4]==='高'?'high':x[4]==='中'?'mid':'low'}>{x[4]}</em></div>)}</section><section className="panel manager-focus"><div className="panel-head"><div><span>本周经理动作</span><h2>只抓三件事</h2></div></div>{[['01','盯普通客服一区改善','负责人：前台客服主管','今日18:00前提交原因树'],['02','辅导3名低闭环班长','负责人：各区域主管','本周每人完成一次跟岗'],['03','关闭12名尾端员工计划','负责人：班长+质培','7天后自动验证改善效果']].map(x=><article key={x[0]}><b>{x[0]}</b><div><strong>{x[1]}</strong><p>{x[2]} · {x[3]}</p></div><button onClick={()=>notify(`${x[1]}已进入跟踪`)}>跟踪</button></article>)}</section></div>
  <section className="panel leader-performance"><div className="panel-head"><div><span>班长履职</span><h2>班长不是只对KPI负责，也对管理动作负责</h2></div></div><div className="leader-head"><span>班长</span><span>班前会完成</span><span>面谈及时率</span><span>预警闭环率</span><span>员工改善率</span><span>综合判断</span></div>{[['张伟','100%','88%','72%','67%','需辅导'],['刘洋','100%','96%','94%','85%','优秀'],['赵敏','92%','81%','69%','61%','需辅导'],['王强','100%','91%','88%','82%','稳定']].map(x=><div className="leader-row" key={x[0]}>{x.map((y,i)=>i===5?<em className={y==='需辅导'?'risk':''} key={i}>{y}</em>:<span key={i}>{y}</span>)}</div>)}</section>
  {trainingReportOpen&&<TrainingReportViewer reportNo={trainingReport.reportNo} close={()=>setTrainingReportOpen(false)} mode="manager"/>}
 </>
}

function SupervisorPage({alerts,notify,handleAlert,workflow,busy,run}:{alerts:Alert[];notify:(s:string)=>void;handleAlert:(id:string)=>void;workflow:WorkflowState|null;busy:boolean;run:WorkflowRunner}){
 const squads=[['2班','92.6%','11/15','86%','正常'],['4班','84.1%','9/15','68%','紧张'],['5班','89.7%','13/16','73%','关注'],['6班','91.8%','14/16','88%','正常'],['8班','83.4%','12/15','65%','紧张']]
  return <><PageHead eyebrow="客服主管 · 前台普通客服一区" title="先调度现场，再推动班长解决问题" desc="主管的价值是跨班组调度、抓班长履职、压质量风险，而不是替班长管员工。" actions={<button className="primary" onClick={()=>notify('现场巡检已完成，发现2个紧张班组')}><RefreshCw size={16}/>刷新现场</button>}/>
  <div className="supervisor-alertbar"><AlertTriangle size={19}/><div><strong>现场需要立即动作</strong><p>4班、8班未来30分钟人力缺口共5人；2件投诉工单临近超时；3名班长存在未关闭任务。</p></div><button onClick={()=>notify('已生成跨班组调度方案')}>生成调度方案</button></div>
  {workflow&&<SupervisorOperationsHub state={workflow} busy={busy} run={run}/>}
  <div className="supervisor-grid"><section className="panel dispatch-board"><div className="panel-head"><div><span>现场调度</span><h2>五个班组实时供需</h2></div><span className="live-label"><i></i>每分钟刷新</span></div><div className="dispatch-head"><span>班组</span><span>接通率</span><span>在岗/应到</span><span>负荷</span><span>状态</span><span></span></div>{squads.map(x=><div className="dispatch-row" key={x[0]}><strong>{x[0]}</strong><span className={parseFloat(x[1])<86?'bad-txt':''}>{x[1]}</span><span>{x[2]}</span><span><i style={{width:x[3]}}></i><b>{x[3]}</b></span><em className={x[4]==='紧张'?'high':x[4]==='关注'?'mid':'low'}>{x[4]}</em><button onClick={()=>notify(`已打开${x[0]}调度详情`)}>调度</button></div>)}</section><section className="panel supervisor-actions"><div className="panel-head"><div><span>AI调度建议</span><h2>现在这样调整</h2></div><Bot size={19}/></div><div className="dispatch-plan"><span>11:00—11:30</span><h3>从2班、6班各调入1人至8班</h3><p>预计8班接通率从83.4%提升至89.8%，2班和6班仍高于目标线。</p><button onClick={()=>notify('调度指令已发送至相关班长')}>一键下发</button></div><div className="dispatch-plan"><span>11:10—11:40</span><h3>延后4班2人培训30分钟</h3><p>可补齐4班即时缺口，培训计划将自动顺延并通知培训岗。</p><button onClick={()=>notify('培训调整已提交培训岗确认')}>申请调整</button></div></section></div>
  <div className="supervisor-lower"><section className="panel"><div className="panel-head"><div><span>班长管理</span><h2>主管今天要辅导谁</h2></div></div>{[['张伟·8班','3项任务逾期，预警闭环率72%','今天 15:30 跟岗辅导'],['赵敏·4班','面谈及时率81%，尾端员工改善弱','明天 09:30 管理复盘'],['刘洋·6班','各项履职领先，可复制班前会方法','本周五经验分享']].map((x,i)=><div className="coach-row" key={x[0]}><span>{i+1}</span><div><strong>{x[0]}</strong><p>{x[1]}</p></div><em>{x[2]}</em><button onClick={()=>notify(`${x[0]}辅导安排已确认`)}>安排</button></div>)}</section><section className="panel"><div className="panel-head"><div><span>质量风险</span><h2>需要主管介入的事件</h2></div></div>{alerts.filter(a=>a.type==='投诉升级'||a.type==='质量趋势').map(a=><div className="risk-event" key={a.id}><span className={`sev-dot ${a.severity}`}></span><div><strong>{a.title}</strong><p>{a.team} · 截止 {a.due}</p></div><button onClick={()=>handleAlert(a.id)}>督办</button></div>)}</section></div>
 </>
}

function CommandPage({alerts,tasks,selectedAlert,setSelectedAlert,handleAlert,setPage}:{alerts:Alert[];tasks:TaskItem[];selectedAlert:Alert|null;setSelectedAlert:(a:Alert|null)=>void;handleAlert:(id:string)=>void;setPage:(p:string)=>void}){
 const urgent=alerts.filter(a=>a.severity==='critical'&&a.status!=='closed')
 return <>
  <PageHead eyebrow="07月21日 · 周二 · 10:18" title="今天先管这 3 件事" desc="系统已完成晨间巡检。不是所有异常都要处理，先处理最影响目标的。" actions={<><button className="secondary"><RefreshCw size={16}/>重新巡检</button><button className="primary" onClick={()=>setPage('meeting')}><Play size={16}/>开始班前会</button></>}/>
  <section className="battle-strip">
    <div className="battle-title"><div><span>作战优先级</span><strong>系统按“影响目标 × 紧急度 × 可干预性”排序</strong></div><div className="health-ring"><b>72</b><span>班组健康度</span></div></div>
    <div className="priority-list">{alerts.slice(0,3).map((a,i)=><button key={a.id} className={`priority-card ${a.severity}`} onClick={()=>setSelectedAlert(a)}><div className="priority-no">0{i+1}</div><div className="priority-body"><div><span>{a.type}</span><em>{riskLabel[a.severity]}</em></div><h3>{a.title}</h3><p>{a.evidence}</p><footer><span><Clock3 size={14}/>截止 {a.due}</span><b>查看处置建议 <ArrowUpRight size={14}/></b></footer></div></button>)}</div>
  </section>

  <div className="grid metric-grid">{metrics.map((m,i)=><div className={`metric-card ${m.status}`} key={m.label}><div><span>{m.label}</span><button title={`${m.source}.${m.field}`}><MoreHorizontal size={17}/></button></div><strong>{m.value}</strong><p>{m.target}</p><footer className={m.delta>=0?'up':'down'}>{m.delta>=0?<TrendingUp size={15}/>:<TrendingDown size={15}/>}<span>{Math.abs(m.delta)} 个百分点偏差</span></footer></div>)}</div>

  <div className="two-col">
    <section className="panel trend-panel"><div className="panel-head"><div><span>实时态势</span><h2>人工接通率 · 半小时</h2></div><div className="legend"><i className="actual"></i>实际<i className="forecast"></i>预测<i className="target"></i>目标</div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData} margin={{top:10,right:12,left:-22,bottom:0}}><defs><linearGradient id="blueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#00b0f0" stopOpacity={.24}/><stop offset="1" stopColor="#00b0f0" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e7edf4" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize:12,fill:'#6c7b91'}}/><YAxis domain={[75,100]} axisLine={false} tickLine={false} tick={{fontSize:12,fill:'#6c7b91'}}/><Tooltip contentStyle={{borderRadius:8,border:'1px solid #dce6f1',fontSize:12}}/><Area type="monotone" dataKey="actual" stroke="#005bac" strokeWidth={3} fill="url(#blueFill)" connectNulls={false}/><Line type="monotone" dataKey="forecast" stroke="#00b0f0" strokeWidth={2} strokeDasharray="5 5" dot={false}/><Line type="monotone" dataKey="target" stroke="#e74c3c" strokeWidth={1.5} strokeDasharray="4 4" dot={false}/></AreaChart></ResponsiveContainer></div><div className="chart-note"><AlertTriangle size={16}/><span>AI预测：若不调度，11:00接通率可能降至 <b>82%</b>。建议从低负载技能组调入3人。</span><button onClick={()=>handleAlert('AL-250721-003')}>生成调度任务</button></div></section>
    <section className="panel action-panel"><div className="panel-head"><div><span>执行闭环</span><h2>今日行动进度</h2></div><button onClick={()=>setPage('tasks')}>查看全部 <ChevronRight size={15}/></button></div><div className="pdca-track"><div className="pdca P"><b>P</b><span>目标</span><em>5</em></div><i></i><div className="pdca D active"><b>D</b><span>执行</span><em>3</em></div><i></i><div className="pdca C"><b>C</b><span>检查</span><em>2</em></div><i></i><div className="pdca A"><b>A</b><span>改进</span><em>1</em></div></div><div className="task-mini">{tasks.slice(0,4).map(t=><div key={t.id}><span className={`phase ${t.phase}`}>{t.phase}</span><div><strong>{t.title}</strong><small>{t.owner} · {t.due}</small></div><div className="mini-progress"><i style={{width:`${t.progress}%`}}></i></div><em>{t.progress}%</em></div>)}</div></section>
  </div>
  {selectedAlert&&<AlertDrawer alert={selectedAlert} close={()=>setSelectedAlert(null)} handle={()=>handleAlert(selectedAlert.id)}/>}
 </>
}

function EmployeePage({notify,workflow,setWorkflow,setPage,realData}:{notify:(s:string)=>void;workflow:WorkflowState|null;setWorkflow:(state:WorkflowState)=>void;setPage:(page:string)=>void;realData:RealDataState|null}){
 const [supportOpen,setSupportOpen]=useState(false)
 const [supportType,setSupportType]=useState('指标提升辅导')
 const [supportDetail,setSupportDetail]=useState('')
 const [supportSubmitted,setSupportSubmitted]=useState(false)
 const [supportBusy,setSupportBusy]=useState(false)
 const [qualityAppealBusy,setQualityAppealBusy]=useState(false)
 const [supportRequestId,setSupportRequestId]=useState('')
 const employeeSupportTasks=(workflow?.tasks||[]).filter(task=>task.sourceLabel==='员工支持请求'&&task.employeeId==='JR10776')
 const activeSupport=employeeSupportTasks.find(task=>task.status!=='closed')
 const latestSupport=activeSupport||employeeSupportTasks[0]
 const ownQualityRecords=(workflow?.quality?.records||[]).filter(item=>item.employeeId==='JR10776')
 const ownQualityAppeals=workflow?.quality?.appeals||[]
 const liveProfile=realData?.employee?.profile
 const metricText=(value:number|null,unit:string)=>value==null?'—':`${value.toLocaleString('zh-CN')}${unit}`
 const metricGap=(gap:number|null,unit:string)=>gap==null?'暂无可比目标':`${gap>=0?'高目标':'距目标'} ${Math.abs(gap)}${unit}`
 const liveProductivity=liveProfile?[
  {label:'月度人工应答量',value:metricText(liveProfile.monthly.responses.actual,''),target:metricText(liveProfile.monthly.responses.target,''),progress:liveProfile.monthly.responses.actual!=null&&liveProfile.monthly.responses.target?liveProfile.monthly.responses.actual/liveProfile.monthly.responses.target*100:0,gap:metricGap(liveProfile.monthly.responses.gap,'通'),yesterday:metricText(liveProfile.metrics.responses.actual,'通'),yesterdayTarget:metricText(liveProfile.metrics.responses.target,'通'),yesterdayMet:liveProfile.metrics.responses.status==='met'},
  {label:'月度CPH',value:metricText(liveProfile.monthly.cph.actual,''),target:metricText(liveProfile.monthly.cph.target,''),progress:liveProfile.monthly.cph.actual!=null&&liveProfile.monthly.cph.target?liveProfile.monthly.cph.actual/liveProfile.monthly.cph.target*100:0,gap:metricGap(liveProfile.monthly.cph.gap,''),yesterday:metricText(liveProfile.metrics.cph.actual,''),yesterdayTarget:metricText(liveProfile.metrics.cph.target,''),yesterdayMet:liveProfile.metrics.cph.status==='met'},
 ]:null
 const productivity=liveProductivity||[
  {label:'月度人工应答量',value:'1,842',target:'2,100',progress:87.7,gap:'距目标 258通',yesterday:'91通',yesterdayTarget:'88通',yesterdayMet:true},
  {label:'月度CPH',value:'15.8',target:'15.0',progress:105.3,gap:'高目标 0.8',yesterday:'16.2',yesterdayTarget:'15.5',yesterdayMet:true},
  {label:'月度工时利用率',value:'81.6%',target:'83.0%',progress:98.3,gap:'距目标 1.4pp',yesterday:'84.1%',yesterdayTarget:'83.0%',yesterdayMet:true},
 ]
 const quality=liveProfile?[
  {label:'服务满意率',value:metricText(liveProfile.monthly.satisfaction.actual,'%'),target:metricText(liveProfile.monthly.satisfaction.target,'%'),gap:metricGap(liveProfile.monthly.satisfaction.gap,'pp'),tone:liveProfile.monthly.satisfaction.status==='met'?'good':'risk'},
  {label:'一次解决率',value:metricText(liveProfile.monthly.fcr.actual,'%'),target:metricText(liveProfile.monthly.fcr.target,'%'),gap:metricGap(liveProfile.monthly.fcr.gap,'pp'),tone:liveProfile.monthly.fcr.status==='met'?'good':'risk'},
  {label:'置忙小休占比',value:metricText(liveProfile.metrics.busyRest.actual,'%'),target:`≤${metricText(liveProfile.metrics.busyRest.target,'%')}`,gap:metricGap(liveProfile.metrics.busyRest.gap,'pp'),tone:liveProfile.metrics.busyRest.status==='met'?'good':'risk'},
 ]:[
  {label:'服务满意率',value:'97.6%',target:'97.2%',gap:'高目标 0.4pp',tone:'good'},
  {label:'一次解决率',value:'89.1%',target:'90.0%',gap:'距目标 0.9pp',tone:'risk'},
  {label:'重复来电率',value:'4.2%',target:'≤4.0%',gap:'高于上限 0.2pp',tone:'risk'},
 ]
 const monthlyTrend=[
  {day:'1日',actual:82,target:88},{day:'5日',actual:86,target:88},{day:'10日',actual:89,target:89},{day:'15日',actual:87,target:89},{day:'20日',actual:91,target:90},{day:'昨日',actual:91,target:90},
 ]
 const monthlyResponse=liveProfile?.monthly.responses
 const monthlyProgress=monthlyResponse?.actual!=null&&monthlyResponse.target?Math.max(0,monthlyResponse.actual/monthlyResponse.target*100):87.7
 const responseGap=monthlyResponse?.gap==null?258:Math.max(0,-monthlyResponse.gap)
 const submitSupport=async()=>{
  if(!supportDetail.trim()){notify('请补充希望班长提供的具体支持');return}
  setSupportBusy(true)
  try{
   const next=await workflowApi.createEmployeeSupport({
    role:'employee',actor:'李倩',supportType,detail:supportDetail.trim(),dueAt:new Date(Date.now()+30*60*1000).toISOString(),
    successCriteria:'班长在30分钟内响应，给出明确处理结论、下一步动作和完成时间；员工确认问题已解决后关闭。',
    requester:{id:'JR10776',name:'李倩',team:'普通客服一区·8班',leader:'张伟'},
   })
   setWorkflow(next)
   const created=next.tasks.find(task=>task.sourceLabel==='员工支持请求'&&task.employeeId==='JR10776'&&task.status!=='closed')
   setSupportRequestId(created?.id||'')
   setSupportSubmitted(true)
   notify('支持请求已进入张伟班长的PDCA任务，30分钟响应计时已开始')
  }catch(error){notify(error instanceof Error?error.message:'支持请求提交失败')}finally{setSupportBusy(false)}
 }
 const submitQualityAppeal=async(recordId:string)=>{
  setQualityAppealBusy(true)
  try{const next=await workflowApi.createQualityAppeal('employee',recordId,'申请结合完整录音上下文复核；需求确认已在前段完成，请核对当前问题判定和等级是否准确。');setWorkflow(next);notify('质量申诉已提交质检岗位，4小时内完成复核并回传结果')}catch(error){notify(error instanceof Error?error.message:'质量申诉提交失败')}finally{setQualityAppealBusy(false)}
 }
 return <><PageHead eyebrow="个人精益作战台 · 目标牵引每一个动作" title={`${liveProfile?.name||'李倩'}，今天先稳产能，再守住质量`} desc={`用月目标拆解每日动作：产能决定贡献，质量决定贡献能否持续。${liveProfile?` 真实数据截至 ${liveProfile.dataDate}。`:''}`} actions={activeSupport?<button className="primary" onClick={()=>setPage('tasks')}><ListChecks size={16}/>查看支持进度</button>:<button className="primary" onClick={()=>{setSupportOpen(true);setSupportSubmitted(false);setSupportRequestId('')}}><Headphones size={16}/>请求班长支持</button>}/>
  {realData&&<div className="live-data-scope"><Database size={16}/><div><strong>{realData.meta.scopeLabel}</strong><span>{realData.employee?.matched?'已匹配当前登录工号':'当前工号在源库无记录，暂展示真实库代表员工'} · {realData.meta.warning}</span></div></div>}
  {latestSupport&&<section className={`employee-support-status ${latestSupport.status}`}><span><Headphones size={18}/></span><div><b>{latestSupport.id} · {latestSupport.requestType}</b><h3>{workflowTaskStatus(latestSupport.status,latestSupport.verificationRole)}</h3><p>{latestSupport.status==='pending_verification'?`班长回复：${latestSupport.evidence}`:latestSupport.status==='closed'?`处理结果：${latestSupport.verification}`:`请求内容：${latestSupport.requestDetail}`}</p></div><strong>{latestSupport.progress}%</strong><button onClick={()=>setPage('tasks')}>查看详情 <ChevronRight size={14}/></button></section>}
  <section className="employee-focus-banner"><div className="employee-focus-title"><span>本月核心任务</span><h2>{responseGap>0?`人工应答量距个人月目标 ${responseGap.toLocaleString('zh-CN')} 通`:'人工应答量已达到个人月度目标'}</h2><p>{liveProfile?`上一日应答 ${metricText(liveProfile.metrics.responses.actual,'通')}，个人目标 ${metricText(liveProfile.metrics.responses.target,'通')}；${liveProfile.metrics.responses.status==='met'?'上一日达标。':'仍需按小时校准产能。'}质量指标需同步守住。`:'保持当前节奏可在月末达成，质量指标需同步守住。'}</p></div><div className="employee-focus-score"><div><strong>{monthlyProgress.toFixed(1)}%</strong><span>月度产能达成</span></div><i style={{'--employee-progress':`${Math.min(100,monthlyProgress)}%`} as React.CSSProperties}></i><small>{monthlyProgress>=100?'月目标已达成':'当前节奏：继续追赶'}</small></div><div className="employee-principle"><Target size={22}/><div><span>目标导向法则</span><strong>先看差值 → 拆到每天 → 每小时校准</strong><p>不与别人比绝对值，只与自己的目标和昨天比进步。</p></div></div></section>
  <div className="employee-main-grid">
   <section className="panel employee-productivity"><div className="panel-head"><div><span>第一优先级 · 产能</span><h2>月度达成与上一日表现</h2></div><em>截至 {liveProfile?.dataDate||'7月21日'}</em></div><div className="employee-product-list">{productivity.map(item=><article key={item.label}><header><span>{item.label}</span><b className={item.progress>=100?'good':'risk'}>{item.progress>=100?'已达成':'追赶中'}</b></header><div className="employee-value-line"><strong>{item.value}</strong><small>/ 目标 {item.target}</small><em>{item.gap}</em></div><div className="employee-progress"><i style={{width:`${Math.min(item.progress,100)}%`}}></i></div><footer><span>上一日实际 <b>{item.yesterday}</b></span><span>上一日目标 {item.yesterdayTarget}</span><em>{item.yesterdayMet?'上一日达标':'上一日未达标'}</em></footer></article>)}</div></section>
   <section className="panel employee-quality"><div className="panel-head"><div><span>第二优先级 · 质量</span><h2>质量是有效产能的底线</h2></div><em>产能 × 质量</em></div><div className="employee-quality-ring"><div><strong>2/3</strong><span>质量指标达标</span></div><p>满意率表现稳定；一次解决率和重复来电率仍存在小幅Gap。</p></div>{quality.map(item=><article key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong></div><div><small>个人目标 {item.target}</small><em className={item.tone}>{item.gap}</em></div></article>)}<div className="quality-action"><ShieldCheck size={18}/><p><b>今日质量动作：</b>套餐续约场景执行“四步确认法”，通话结束前复述办理结果，降低重复来电。</p></div></section>
  </div>
  {ownQualityRecords.length>0&&<section className="panel employee-quality-records"><div className="panel-head"><div><span>我的质检记录</span><h2>看清证据、标准和申诉进度</h2></div><em>质量权利与责任</em></div>{ownQualityRecords.map(record=>{const appeal=ownQualityAppeals.find(item=>item.recordId===record.id);return <article key={record.id}><div><strong>{record.business} · {record.score}分</strong><small>{record.id} · {new Date(record.inspectedAt).toLocaleString('zh-CN',{hour12:false})}</small></div><p><b>{record.problem}</b><span>{record.standard} · {record.evidence}</span></p><em className={record.result}>{record.result==='passed'?'抽检通过':record.result==='adjusted'?'已改判':'存在问题'}</em>{appeal?<span>{appeal.status==='reviewing'?'质检复核中':appeal.status==='upheld'?'申诉维持':appeal.status==='overturned'?'申诉改判':'等待质检受理'}</span>:record.result==='failed'?<button disabled={qualityAppealBusy} onClick={()=>submitQualityAppeal(record.id)}>申请质量复核</button>:<span>无需申诉</span>}</article>})}</section>}
  <div className="employee-lower-grid">
   <section className="panel employee-trend"><div className="panel-head"><div><span>精益校准</span><h2>近20日产能节奏</h2></div><em>日应答量</em></div><div><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyTrend} margin={{top:12,right:15,left:-20,bottom:0}}><defs><linearGradient id="employeeOutputFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1579b8" stopOpacity={.25}/><stop offset="1" stopColor="#1579b8" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e8eef4" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#6c7e92'}}/><YAxis domain={[75,95]} axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#8795a5'}}/><Tooltip contentStyle={{fontSize:10,borderRadius:7}}/><Area type="monotone" dataKey="actual" stroke="#1579b8" strokeWidth={3} fill="url(#employeeOutputFill)"/><Line type="monotone" dataKey="target" stroke="#e3942d" strokeWidth={2} strokeDasharray="5 4" dot={false}/></AreaChart></ResponsiveContainer></div><footer><span><i className="actual"></i>我的产能</span><span><i className="target"></i>阶段目标</span><b>近5日平均 89.4通，较上阶段 +4.8%</b></footer></section>
   <section className="panel employee-salary"><div className="panel-head"><div><span>本月预估薪资</span><h2>当前预计到手水平</h2></div><em>动态测算</em></div><div className="salary-estimate"><span>预计税前</span><strong>¥ 6,128</strong><small>按当前产能与质量达成测算</small></div><div className="salary-breakdown"><div><span>基础薪资</span><b>¥3,600</b></div><div><span>绩效收入</span><b>¥1,780</b></div><div><span>营销激励</span><b>¥520</b></div><div><span>全勤及其他</span><b>¥228</b></div></div><p className="salary-note">薪资为过程预估，最终以月度结算与公司薪酬制度为准。</p></section>
   <section className="panel employee-challenge"><div className="panel-head"><div><span>下一阶段挑战</span><h2>再完成这些，可多拿约 ¥480</h2></div><em>挑战档</em></div><div className="challenge-target"><strong>¥ 6,608</strong><span>挑战档预计薪资</span></div><div className="challenge-list"><div className="done"><CheckCircle2 size={16}/><span><b>满意率 ≥97.5%</b><small>当前 97.6%，继续守住</small></span></div><div><Target size={16}/><span><b>月应答量 ≥2,100通</b><small>还差 258通</small></span></div><div><Target size={16}/><span><b>一次解决率 ≥90.0%</b><small>还差 0.9pp</small></span></div><div><Target size={16}/><span><b>营销办理 ≥7单</b><small>当前 5单，还差 2单</small></span></div></div></section>
  </div>
  <section className="employee-daily-action"><div><span>今日精益行动卡</span><h2>把结果目标变成三个可执行动作</h2></div><article><b>01</b><div><strong>每小时完成 ≥11 通有效应答</strong><p>在整点查看节奏，连续两小时未达立即调整。</p></div></article><article><b>02</b><div><strong>续约场景100%执行四步确认</strong><p>守住一次解决与重复来电两条质量线。</p></div></article><article><b>03</b><div><strong>完成2次高意向营销推荐</strong><p>以客户需求为前提，自然完成产品匹配。</p></div></article></section>
  <EmployeeLearningHub state={workflow} setState={setWorkflow} notify={notify}/>
  {supportOpen&&<div className="employee-support-backdrop" onClick={()=>setSupportOpen(false)}><section className="employee-support-dialog" onClick={event=>event.stopPropagation()}><header><div><span><Headphones size={17}/>班长支持中心</span><h2>{supportSubmitted?'支持请求已提交':'告诉班长，你需要什么支持'}</h2><p>{supportSubmitted?'请求已同步至班长PDCA，并纳入30分钟响应计时。':'主动请求支持不是示弱，是用最短路径解决目标Gap。'}</p></div><button aria-label="关闭支持申请" onClick={()=>setSupportOpen(false)}><X size={20}/></button></header>{supportSubmitted?<div className="support-success"><CheckCircle2 size={52}/><h3>提交成功</h3><p>请求编号 {supportRequestId}</p><div><span>支持类型</span><strong>{supportType}</strong><span>预计响应</span><strong>30分钟内</strong><span>接收人</span><strong>张伟 · 客服班长</strong></div><button className="primary" onClick={()=>{setSupportOpen(false);setPage('tasks')}}>查看处理进度</button></div>:<div className="support-form"><label>支持类型<select value={supportType} onChange={event=>setSupportType(event.target.value)}><option>指标提升辅导</option><option>疑难业务协助</option><option>系统与工位问题</option><option>排班与状态沟通</option><option>情绪与压力支持</option></select></label><label>具体说明<textarea value={supportDetail} onChange={event=>setSupportDetail(event.target.value)} placeholder="例如：一次解决率还差0.9个百分点，希望班长帮我复盘2通续约场景录音。"/></label><div className="support-quick"><span>快速填写</span><button onClick={()=>setSupportDetail('一次解决率还差0.9个百分点，希望班长帮我复盘2通续约场景录音。')}>质量复盘</button><button onClick={()=>setSupportDetail('今天产能节奏连续两小时未达标，希望班长协助定位原因并给出调整建议。')}>产能辅导</button><button onClick={()=>setSupportDetail('遇到续约办理边界问题，希望班长协助确认最新业务口径。')}>业务协助</button></div><footer><button className="secondary" disabled={supportBusy} onClick={()=>setSupportOpen(false)}>取消</button><button className="primary" disabled={supportBusy} onClick={submitSupport}>{supportBusy?<RefreshCw size={15}/>:<Send size={15}/>}提交给班长并进入PDCA</button></footer></div>}</section></div>}
 </>
}

function QualityPage({notify,workflow,setWorkflow,setPage}:{notify:(s:string)=>void;workflow:WorkflowState|null;setWorkflow:(state:WorkflowState)=>void;setPage:(page:string)=>void}){
 type QualityEmployee={id:string;name:string;team:string;leader:string;level:'高风险'|'需关注'|'观察';problem:string;hits:number;evidence:string;status:'待协同'|'待班长反馈'|'已安排辅导'|'待复检'|'已闭环'}
 const qualityEmployeesSeed:QualityEmployee[]=[
  {id:'JR10913',name:'王芳',team:'普通客服一区·8班',leader:'张伟',level:'高风险',problem:'续约规范 + 服务态度',hits:4,evidence:'近7日命中4次，其中2次未完整解释承诺期，1次结束语不规范。',status:'待协同'},
  {id:'JR11005',name:'孙雷',team:'普通客服一区·8班',leader:'张伟',level:'高风险',problem:'一次解决 + 业务口径',hits:3,evidence:'套餐续约重复来电3次，关键办理路径解释缺失。',status:'待班长反馈'},
  {id:'JR10286',name:'冉倩',team:'普通客服二区·3班',leader:'赵敏',level:'需关注',problem:'工单建单合规',hits:2,evidence:'责任现象描述不完整，诉求字段与录音不一致。',status:'已安排辅导'},
  {id:'JR10776',name:'李倩',team:'普通客服一区·8班',leader:'张伟',level:'需关注',problem:'营销推荐规范',hits:2,evidence:'推荐前需求确认不足，存在直接介绍产品的情况。',status:'待复检'},
  {id:'JR11142',name:'陈雨',team:'普通客服一区·8班',leader:'张伟',level:'观察',problem:'结束语规范',hits:1,evidence:'新人阶段偶发结束语缺项，暂未造成客户不满。',status:'已闭环'},
 ]
 const [qualityEmployees,setQualityEmployees]=useState(qualityEmployeesSeed)
 const [collabOpen,setCollabOpen]=useState(false)
 const [activeQualityEmployee,setActiveQualityEmployee]=useState<QualityEmployee|null>(null)
 const [collabRequirement,setCollabRequirement]=useState('')
 const [collabDeadline,setCollabDeadline]=useState('今日 11:30')
 const [collabSubmitted,setCollabSubmitted]=useState(false)
 const [collabBusy,setCollabBusy]=useState(false)
 const [createdCollabId,setCreatedCollabId]=useState('')
 const qualityTasks=(workflow?.tasks||[]).filter(task=>task.sourceLabel==='质检协同单')
 const taskForEmployee=(employeeId:string)=>qualityTasks.find(task=>task.employeeId===employeeId)
 const taskStatus=(status:string):QualityEmployee['status']=>status==='closed'?'已闭环':status==='pending_verification'?'待复检':status==='doing'?'已安排辅导':'待班长反馈'
 const displayedQualityEmployees=qualityEmployees.map(employee=>{
  const task=taskForEmployee(employee.id)
  return task?{...employee,status:taskStatus(task.status)}:employee
 })
 const toDeadline=(label:string)=>{
  const date=new Date()
  if(label.startsWith('明日'))date.setDate(date.getDate()+1)
  const time=label.match(/(\d{2}):(\d{2})/)
  date.setHours(time?Number(time[1]):18,time?Number(time[2]):0,0,0)
  return date.toISOString()
 }
 const issueData=[
  {name:'业务口径',count:18,rate:12.2,tone:'critical',summary:'续约承诺期、办理路径解释不完整'},
  {name:'工单规范',count:12,rate:8.1,tone:'warning',summary:'责任现象、客户诉求字段填写不完整'},
  {name:'服务规范',count:9,rate:6.1,tone:'warning',summary:'结束语、安抚与二次确认缺项'},
  {name:'营销规范',count:7,rate:4.7,tone:'notice',summary:'需求确认不足、推荐衔接生硬'},
 ]
 const trend=[{day:'周一',issues:16,closed:8},{day:'周二',issues:14,closed:10},{day:'周三',issues:18,closed:12},{day:'周四',issues:12,closed:10},{day:'周五',issues:11,closed:9},{day:'昨日',issues:9,closed:8}]
 const collaboration=[
  {time:'09:18',employee:'孙雷',leader:'张伟',action:'质检发起：复盘2通续约重复来电录音',status:'待班长反馈',tone:'waiting'},
  {time:'09:05',employee:'冉倩',leader:'赵敏',action:'班长反馈：已安排11:30工单规范辅导',status:'已安排辅导',tone:'doing'},
  {time:'昨日 16:40',employee:'李倩',leader:'张伟',action:'辅导完成：提交营销推荐新录音待复检',status:'待质检复检',tone:'checking'},
  {time:'昨日 15:10',employee:'陈雨',leader:'张伟',action:'复检通过：结束语规范已连续5通达标',status:'已闭环',tone:'closed'},
 ]
 const openCollaboration=(employee:QualityEmployee)=>{
  setActiveQualityEmployee(employee)
  setCollabRequirement(`请班长于今日完成${employee.name}的${employee.problem}问题复盘，抽取2通典型录音进行1V1辅导，并在辅导后回传改进行动和复检时间。`)
  setCollabSubmitted(false)
  setCreatedCollabId('')
  setCollabOpen(true)
 }
 const submitCollaboration=async()=>{
  if(!activeQualityEmployee||!collabRequirement.trim()){notify('请填写需要班长执行的协同要求');return}
  setCollabBusy(true)
  try{
   const next=await workflowApi.createQualityCollaboration({
    role:'quality',actor:'质检专员',requirement:collabRequirement.trim(),dueAt:toDeadline(collabDeadline),reinspectAt:toDeadline('今日 14:00'),
    successCriteria:'完成1V1辅导并提交2通新录音；质检复检连续2通无同类问题后关闭。',
    employee:{id:activeQualityEmployee.id,name:activeQualityEmployee.name,team:activeQualityEmployee.team,leader:activeQualityEmployee.leader,problem:activeQualityEmployee.problem,evidence:activeQualityEmployee.evidence},
   })
   setWorkflow(next)
   const created=next.tasks.find(task=>task.sourceLabel==='质检协同单'&&task.employeeId===activeQualityEmployee.id&&task.status!=='closed')
   setCreatedCollabId(created?.id||'')
   setCollabSubmitted(true)
   notify(`协同单已进入${activeQualityEmployee.leader}班长的PDCA任务`)
  }catch(error){notify(error instanceof Error?error.message:'质检协同单发送失败')}finally{setCollabBusy(false)}
 }
 const closeQuality=async(employee:QualityEmployee)=>{
  const task=taskForEmployee(employee.id)
  if(!task){setQualityEmployees(current=>current.map(item=>item.id===employee.id?{...item,status:'已闭环'}:item));notify(`${employee.name}复检通过，问题已闭环`);return}
  setCollabBusy(true)
  try{const next=await workflowApi.taskAction(task.id,'quality','quality_verify_success',{comment:'复检2通新录音均未发现同类问题，改善有效'});setWorkflow(applyWorkflowMutation(workflow,next));notify(`${employee.name}复检通过，协同单已闭环并通知班长`)}catch(error){notify(error instanceof Error?error.message:'复检操作失败')}finally{setCollabBusy(false)}
 }
 const trainingVerifications=workflow?.training?.programs?.filter(program=>program.status==='quality_pending')||[]
 const verifyTrainingEffect=async(id:string,verified:boolean)=>{
  setCollabBusy(true)
  try{
   const next=await workflowApi.verifyTrainingProgram(id,verified,verified?'抽检10通培训后录音，同类规范问题降至目标线内，业务改善有效。':'抽检仍发现同类规范问题，当前改善未达到关闭标准，需补训后重新验效。')
   setWorkflow(next);notify(verified?'培训专项验效通过，结果已同步培训岗和经理':'专项已退回培训岗补训')
  }catch(error){notify(error instanceof Error?error.message:'培训效果验证失败')}finally{setCollabBusy(false)}
 }
 return <><PageHead eyebrow="质检主管作战台 · 发现问题不是终点" title="先识别规范性问题，再把改善动作落到班长和员工" desc="依据岗位职责形成“问题识别—重点员工—班长协同—辅导反馈—质检复检”的质量闭环。" actions={<button className="primary" onClick={()=>openCollaboration(displayedQualityEmployees[0])}><MessageSquareText size={16}/>发起班长协同</button>}/>
  <section className="quality-command-strip"><div><span>今日质量结论</span><h2>业务口径问题居首，5名重点员工需要分层跟进</h2><p>续约承诺期与办理路径解释不完整，占今日规范问题的39%。优先联动3个班组完成复盘。</p></div><article><span>今日抽检</span><strong>148<small>通</small></strong><em>计划 150通</em></article><article><span>规范问题</span><strong>46<small>项</small></strong><em className="risk">较昨日 +6</em></article><article><span>重点员工</span><strong>5<small>人</small></strong><em className="risk">高风险 2人</em></article><article><span>闭环及时率</span><strong>87.5<small>%</small></strong><em>目标 ≥95%</em></article><article><span>待班长反馈</span><strong>2<small>项</small></strong><em className="risk">最早截止 11:30</em></article></section>
  <div className="quality-top-grid">
   <section className="panel quality-issues"><div className="panel-head"><div><span>重点规范性问题</span><h2>今日问题结构与TOP原因</h2></div><em>按问题量排序</em></div><div className="quality-issue-list">{issueData.map((issue,index)=><article key={issue.name}><b>{String(index+1).padStart(2,'0')}</b><div><header><strong>{issue.name}</strong><span>{issue.count}项 · 占比 {issue.rate}%</span></header><p>{issue.summary}</p><div className="issue-bar"><i className={issue.tone} style={{width:`${Math.min(issue.count/20*100,100)}%`}}></i></div></div><em className={issue.tone}>{index===0?'重点攻坚':index<3?'需改进':'持续观察'}</em></article>)}</div><footer><AlertTriangle size={16}/><p><b>质检建议：</b>今日班前会统一续约“四步解释法”，班长在午前完成全员拨测，质检14:00复测。</p></footer></section>
   <section className="panel quality-trend"><div className="panel-head"><div><span>质量趋势</span><h2>问题发现与闭环节奏</h2></div><em>近6个工作日</em></div><div className="quality-trend-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{top:10,right:15,left:-20,bottom:0}}><defs><linearGradient id="qualityIssueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#df695f" stopOpacity={.22}/><stop offset="1" stopColor="#df695f" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e8eef4" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#6c7e92'}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#8795a5'}}/><Tooltip contentStyle={{fontSize:10,borderRadius:7}}/><Area type="monotone" dataKey="issues" stroke="#df695f" strokeWidth={2.5} fill="url(#qualityIssueFill)"/><Line type="monotone" dataKey="closed" stroke="#16805f" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div><div className="quality-trend-legend"><span><i className="issues"></i>发现问题</span><span><i className="closed"></i>当日闭环</span><b>昨日闭环 8/9项</b></div><div className="quality-duty-note"><ClipboardCheck size={17}/><div><strong>岗位职责提醒</strong><p>不达标指标需明确TOP原因、责任班组、达成标志、监控节点和负责人。</p></div></div></section>
  </div>
  <QualityProductionHub workflow={workflow} setWorkflow={setWorkflow} notify={notify}/>
  <section className="panel quality-employee-panel"><div className="quality-section-head"><div><span>重点员工识别</span><h2>从问题证据出发，分层安排班长动作</h2></div><div><b>高风险 2人</b><b>需关注 2人</b><b>观察 1人</b></div></div><div className="quality-employee-head"><span>员工 / 班组</span><span>风险等级</span><span>主要规范问题</span><span>命中次数</span><span>质检证据</span><span>责任班长</span><span>协同状态</span><span>操作</span></div>{displayedQualityEmployees.map(employee=>{const task=taskForEmployee(employee.id);return <div className={`quality-employee-row ${employee.level==='高风险'?'high':employee.level==='需关注'?'attention':'observe'}`} key={employee.id}><div className="person"><span>{employee.name.slice(0,1)}</span><div><strong>{employee.name}</strong><small>{employee.id} · {employee.team}</small></div></div><b className={`quality-level ${employee.level==='高风险'?'high':employee.level==='需关注'?'attention':'observe'}`}>{employee.level}</b><strong>{employee.problem}</strong><div className="quality-hit"><b>{employee.hits}</b><span>次/7日</span></div><p>{employee.evidence}</p><div className="quality-leader"><span>{employee.leader.slice(0,1)}</span><div><strong>{employee.leader}</strong><small>客服班长</small></div></div><em className={`quality-status ${employee.status==='已闭环'?'closed':employee.status==='待复检'?'checking':employee.status==='已安排辅导'?'doing':'waiting'}`}>{employee.status}</em><div className="quality-row-actions">{employee.status==='待复检'?<button disabled={collabBusy} onClick={()=>{if(task)setPage('tasks');else closeQuality(employee)}}><ClipboardCheck size={13}/>{task?'进入复检':'复检通过'}</button>:employee.status==='已闭环'?<button disabled><CheckCircle2 size={13}/>已完成</button>:task?<button onClick={()=>setPage('tasks')}><ListChecks size={13}/>查看PDCA</button>:<button onClick={()=>openCollaboration(employee)}><Send size={13}/>发给班长</button>}</div></div>})}</section>
  {trainingVerifications.length>0&&<section className="panel training-quality-verification"><div className="panel-head"><div><span>培训 × 质检效果闭环</span><h2>培训达标不等于业务改善，请完成独立验效</h2></div><em>{trainingVerifications.length}项待验证</em></div>{trainingVerifications.map(program=><article key={program.id}><div><strong>{program.title}</strong><small>{program.id} · {program.source}</small><p>培训覆盖 {program.actualCoverage}% / 目标 {program.targetCoverage}% · 测试通过 {program.actualPassRate}% / 目标 {program.targetPassRate}%</p></div><span><b>基线</b>{program.baseline}</span><div><button disabled={collabBusy} onClick={()=>verifyTrainingEffect(program.id,false)}>退回补训</button><button className="primary" disabled={collabBusy} onClick={()=>verifyTrainingEffect(program.id,true)}>验效通过</button></div></article>)}</section>}
  <div className="quality-bottom-grid">
   <section className="panel quality-collaboration"><div className="panel-head"><div><span>质检 × 班长协同</span><h2>今日协同动态</h2></div><em>双向留痕</em></div><div>{qualityTasks.slice(0,3).map(task=><article key={task.id}><time>{fmtTime(task.updatedAt)}</time><span className={`collab-dot ${task.status==='closed'?'closed':task.status==='pending_verification'?'checking':task.status==='doing'?'doing':'waiting'}`}></span><div><strong>{task.person} · {task.leader}班长</strong><p>{task.history[task.history.length-1]?.action||task.requirement}</p></div><em className={task.status==='closed'?'closed':task.status==='pending_verification'?'checking':task.status==='doing'?'doing':'waiting'}>{workflowTaskStatus(task.status,task.verificationRole)}</em></article>)}{collaboration.slice(qualityTasks.length?1:0).map(item=><article key={`${item.time}-${item.employee}`}><time>{item.time}</time><span className={`collab-dot ${item.tone}`}></span><div><strong>{item.employee} · {item.leader}班长</strong><p>{item.action}</p></div><em className={item.tone}>{item.status}</em></article>)}</div><footer><button onClick={()=>openCollaboration(displayedQualityEmployees[0])}><Plus size={14}/>新建协同</button><span>质检发起问题，班长反馈动作，质检负责复检关闭。</span></footer></section>
   <section className="panel quality-workbench"><div className="panel-head"><div><span>岗位职责工作台</span><h2>今天还要完成的质量动作</h2></div><em>按时交付</em></div><article><span><Clock3 size={16}/></span><div><strong>11:30前 · 收回业务拨测结果</strong><p>3个班组共抽测15人，当前已回收10人。</p><i><b style={{width:'67%'}}></b></i></div><em>67%</em></article><article><span><RefreshCw size={16}/></span><div><strong>14:00 · 续约规范二次抽测</strong><p>针对今日TOP问题验证班前会传达效果。</p></div><button onClick={()=>notify('二次抽测任务已创建')}>创建抽测</button></article><article><span><ClipboardCheck size={16}/></span><div><strong>下班前 · 行动项闭环复盘</strong><p>回收班长辅导结果，更新重点员工状态。</p></div><button onClick={()=>notify('已打开今日质量闭环清单')}>查看清单</button></article><article><span><MessageSquareText size={16}/></span><div><strong>复议处理 · 2件待回复</strong><p>内部复议2个工作日内上报，质检反馈不超过3个工作日。</p></div><button onClick={()=>notify('已进入质检复议队列')}>处理复议</button></article></section>
  </div>
  {collabOpen&&activeQualityEmployee&&<div className="quality-collab-backdrop" onClick={()=>setCollabOpen(false)}><section className="quality-collab-dialog" onClick={event=>event.stopPropagation()}><header><div><span><MessageSquareText size={17}/>质检与班长协同单</span><h2>{collabSubmitted?'协同已发送':'下发问题，约定改善与复检'}</h2><p>质量问题必须形成责任人、动作、截止时间和达成标志。</p></div><button aria-label="关闭协同单" onClick={()=>setCollabOpen(false)}><X size={20}/></button></header>{collabSubmitted?<div className="quality-collab-success"><CheckCircle2 size={50}/><h3>已发送给 {activeQualityEmployee.leader} 班长</h3><p>协同编号 {createdCollabId}</p><div><span>重点员工</span><strong>{activeQualityEmployee.name}</strong><span>问题类型</span><strong>{activeQualityEmployee.problem}</strong><span>班长反馈截止</span><strong>{collabDeadline}</strong><span>质检复检时间</span><strong>今日 14:00</strong></div><button className="primary" onClick={()=>{setCollabOpen(false);setPage('tasks')}}>查看PDCA流转</button></div>:<div className="quality-collab-form"><div className="quality-case-summary"><div className="person"><span>{activeQualityEmployee.name.slice(0,1)}</span><div><strong>{activeQualityEmployee.name}</strong><small>{activeQualityEmployee.id} · {activeQualityEmployee.team}</small></div></div><b>{activeQualityEmployee.level}</b><p>{activeQualityEmployee.evidence}</p></div><div className="quality-form-grid"><label>责任班长<input value={`${activeQualityEmployee.leader} · 客服班长`} readOnly/></label><label>反馈截止时间<select value={collabDeadline} onChange={event=>setCollabDeadline(event.target.value)}><option>今日 11:30</option><option>今日 14:00</option><option>今日下班前</option><option>明日 09:00</option></select></label></div><label>班长协同要求<textarea value={collabRequirement} onChange={event=>setCollabRequirement(event.target.value)}/></label><div className="quality-reinspect-rule"><Target size={17}/><div><strong>达成标志</strong><p>完成1V1辅导并提交2通新录音；质检复检连续2通无同类问题后关闭。</p></div></div><footer><button className="secondary" disabled={collabBusy} onClick={()=>setCollabOpen(false)}>取消</button><button className="primary" disabled={collabBusy} onClick={submitCollaboration}>{collabBusy?<RefreshCw size={15}/>:<Send size={15}/>}发送给班长并进入PDCA</button></footer></div>}</section></div>}
 </>
}

function QualityProductionHub({workflow,setWorkflow,notify}:{workflow:WorkflowState|null;setWorkflow:(state:WorkflowState)=>void;notify:(text:string)=>void}){
 const [tab,setTab]=useState<'plan'|'records'|'appeals'|'calibration'|'cases'>('plan')
 const [busy,setBusy]=useState(false)
 const quality=workflow?.quality
 const plan=quality?.plans?.[0]
 const records=quality?.records||[]
 const appeals=quality?.appeals||[]
 const calibrations=quality?.calibrations||[]
 const cases=quality?.cases||[]
 const failed=records.filter(item=>item.result==='failed')
 const act=async(action:()=>Promise<WorkflowMutationResult>,success:string)=>{
  setBusy(true)
  try{const next=await action();setWorkflow(applyWorkflowMutation(workflow,next));notify(success)}catch(error){notify(error instanceof Error?error.message:'质检生产操作失败')}finally{setBusy(false)}
 }
 const advancePlan=()=>{
  if(!plan)return
  void act(()=>workflowApi.qualityPlanAction(plan.id,'update',{completedSamples:Math.min(plan.targetSamples,plan.completedSamples+2),actualEmployeeCoverage:Math.min(100,Math.round((plan.actualEmployeeCoverage+1.5)*10)/10),actualTimelyRate:Math.min(100,Math.round((plan.actualTimelyRate+2.5)*10)/10)}),'抽检进度、员工覆盖率和及时率已更新')
 }
 const recordSpotCheck=()=>{
  if(!plan)return
  void act(()=>workflowApi.createQualityRecord({planId:plan.id,callId:`CALL-QA-${Date.now()}`,employeeId:'JR11142',employeeName:'陈雨',team:'普通客服一区·8班',business:'结束语规范',score:94,result:'passed',severity:'none',problem:'',standard:'服务规范 V3.6',evidence:'系统随机抽取录音，全程质检通过。'}),'新抽检记录已归档并计入计划完成量')
 }
 return <section className="panel quality-production-hub">
  <header><div><span>质检生产中心 · 全过程留痕</span><h2>计划、抽检、申诉、校准与案例在一个流程里完成</h2><p>以目标覆盖率和质检一致性为门槛，问题才能进入协同、培训或案例沉淀。</p></div><div><b>{plan?.completedSamples||0}/{plan?.targetSamples||0}</b><small>今日抽检进度</small></div></header>
  <nav>
   <button className={tab==='plan'?'active':''} onClick={()=>setTab('plan')}><Target size={15}/>抽检计划 <em>{quality?.plans.length||0}</em></button>
   <button className={tab==='records'?'active':''} onClick={()=>setTab('records')}><ClipboardCheck size={15}/>抽检记录 <em>{records.length}</em></button>
   <button className={tab==='appeals'?'active':''} onClick={()=>setTab('appeals')}><MessageSquareText size={15}/>申诉复核 <em>{appeals.filter(item=>!['upheld','overturned'].includes(item.status)).length}</em></button>
   <button className={tab==='calibration'?'active':''} onClick={()=>setTab('calibration')}><Gauge size={15}/>质检校准 <em>{calibrations.filter(item=>item.status!=='closed').length}</em></button>
   <button className={tab==='cases'?'active':''} onClick={()=>setTab('cases')}><BookOpenCheck size={15}/>案例库 <em>{cases.filter(item=>item.status==='published').length}</em></button>
  </nav>
  {tab==='plan'&&plan&&<div className="quality-plan-view"><div className="quality-plan-kpis"><article><span>抽检量</span><strong>{plan.completedSamples}<small>/{plan.targetSamples}通</small></strong><em className={plan.completedSamples>=plan.targetSamples?'met':'gap'}>{plan.completedSamples>=plan.targetSamples?'已达标':`Gap ${plan.targetSamples-plan.completedSamples}通`}</em></article><article><span>员工覆盖率</span><strong>{plan.actualEmployeeCoverage}<small>%</small></strong><em className={plan.actualEmployeeCoverage>=plan.targetEmployeeCoverage?'met':'gap'}>目标 {plan.targetEmployeeCoverage}%</em></article><article><span>按时完成率</span><strong>{plan.actualTimelyRate}<small>%</small></strong><em className={plan.actualTimelyRate>=plan.targetTimelyRate?'met':'gap'}>目标 {plan.targetTimelyRate}%</em></article><article><span>问题检出</span><strong>{failed.length}<small>项</small></strong><em className="gap">重大 {failed.filter(item=>item.severity==='critical').length}项</em></article></div><div className="quality-plan-table"><div className="head"><span>分层对象</span><span>抽检完成</span><span>员工覆盖</span><span>判断</span></div>{plan.strata.map(item=><div key={item.team}><strong>{item.team}</strong><span>{item.completed}/{item.target}通</span><span>{item.employeeCoverage}%</span><em className={item.completed>=item.target&&item.employeeCoverage>=plan.targetEmployeeCoverage?'met':'gap'}>{item.completed>=item.target&&item.employeeCoverage>=plan.targetEmployeeCoverage?'达标':'存在Gap'}</em></div>)}</div><footer><span><Clock3 size={14}/>截止 {new Date(plan.dueAt).toLocaleString('zh-CN',{hour12:false})} · 三项指标全部达标后才能关闭</span><div><button disabled={busy||plan.status==='closed'} onClick={recordSpotCheck}>记录随机抽检</button><button disabled={busy||plan.status==='closed'} onClick={advancePlan}>更新回收进度</button><button className="primary" disabled={busy||plan.status==='closed'} onClick={()=>void act(()=>workflowApi.qualityPlanAction(plan.id,'close'),'今日抽检计划已达标关闭并通知经理')}>{plan.status==='closed'?'已关闭':'关闭计划'}</button></div></footer></div>}
  {tab==='records'&&<div className="quality-record-view"><div className="quality-record-head"><span>录音 / 员工</span><span>业务</span><span>得分</span><span>问题等级</span><span>质检结论与证据</span><span>申诉状态</span></div>{records.map(record=><article key={record.id}><div><strong>{record.employeeName}</strong><small>{record.callId} · {record.team}</small></div><span>{record.business}</span><b className={record.score>=90?'met':'gap'}>{record.score}</b><em className={record.severity}>{record.severity==='critical'?'重大':record.severity==='major'?'重点':record.severity==='minor'?'一般':'通过'}</em><p><strong>{record.problem}</strong><small>{record.standard} · {record.evidence}</small></p><span>{record.appealStatus==='appealed'?'申诉中':record.appealStatus==='overturned'?'已改判':record.appealStatus==='upheld'?'已维持':'无申诉'}</span></article>)}</div>}
  {tab==='appeals'&&<div className="quality-appeal-view">{appeals.map(appeal=><article key={appeal.id}><header><div><span>{appeal.id}</span><h3>{appeal.employeeName} · {appeal.team}</h3></div><em className={appeal.status}>{appeal.status==='pending_quality_review'?'待受理':appeal.status==='reviewing'?'复核中':appeal.status==='upheld'?'维持原判':'申诉改判'}</em></header><p><b>申诉理由：</b>{appeal.reason}</p>{appeal.reviewResult&&<p><b>复核结论：</b>{appeal.reviewResult}</p>}<footer><span>{appeal.applicant}提交 · 截止{new Date(appeal.dueAt).toLocaleString('zh-CN',{hour12:false})}</span>{appeal.status==='pending_quality_review'?<button disabled={busy} onClick={()=>void act(()=>workflowApi.qualityAppealAction(appeal.id,'start','已调取完整录音、质检标准和上下文，进入交叉复核。'),'申诉已受理')}>开始复核</button>:appeal.status==='reviewing'?<div><button disabled={busy} onClick={()=>void act(()=>workflowApi.qualityAppealAction(appeal.id,'uphold','复核完整录音后确认原判依据充分，问题片段与标准条款一致。'),'申诉已维持原判并回传班长')}>维持原判</button><button className="primary" disabled={busy} onClick={()=>void act(()=>workflowApi.qualityAppealAction(appeal.id,'overturn','完整录音显示需求确认已在前段完成，原抽检截取上下文不完整，本次改判。'),'申诉已改判并触发口径关注')}>申诉改判</button></div>:<b>已完成</b>}</footer></article>)}</div>}
  {tab==='calibration'&&<div className="quality-calibration-view">{calibrations.map(item=><article key={item.id}><div className="calibration-score"><strong>{item.actualConsistency}%</strong><span>当前一致率</span><small>目标 ≥{item.targetConsistency}%</small></div><div><span>{item.id} · {item.scope}</span><h3>{item.title}</h3><p>样本 {item.sampleCount} 通 · 参与人 {item.participants.join('、')}</p><i><b style={{width:`${Math.min(100,item.actualConsistency)}%`}}></b></i>{item.conclusion&&<p><b>结论：</b>{item.conclusion}</p>}</div><footer>{item.status==='planned'?<button disabled={busy} onClick={()=>void act(()=>workflowApi.qualityCalibrationAction(item.id,'start'),'质检校准任务已开始')}>开始校准</button>:item.status==='doing'?<button className="primary" disabled={busy} onClick={()=>void act(()=>workflowApi.qualityCalibrationAction(item.id,'complete',96.2,'完成10通同题盲评，统一承诺期、客户打断和上下文完整性判定口径。'),'校准结果已提交')}>提交校准结果</button>:<em>{item.status==='closed'?'已达标关闭':'未达标，已转培训纠偏'}</em>}</footer></article>)}</div>}
  {tab==='cases'&&<div className="quality-case-library">{cases.map(item=><article key={item.id}><header><span>{item.category}</span><em className={item.status}>{item.status==='published'?'已发布':'草稿'}</em></header><h3>{item.title}</h3><p><b>问题：</b>{item.problem}</p><p><b>标准：</b>{item.standard}</p><div>{item.example}</div><footer><span>{item.createdBy} · 来源 {item.sourceRecordId}</span>{item.status==='draft'?<button className="primary" disabled={busy} onClick={()=>void act(()=>workflowApi.publishQualityCase(item.id),'案例已发布并同步培训岗与班长')}>审核发布</button>:<b>{item.reviewedBy}审核</b>}</footer></article>)}</div>}
 </section>
}

function TrainingPage({notify,trainingReport,publishTrainingReport,busy,workflow,setWorkflow}:{notify:(s:string)=>void;trainingReport:TrainingReportState;publishTrainingReport:()=>Promise<boolean>;busy:boolean;workflow:WorkflowState|null;setWorkflow:(state:WorkflowState)=>void}){
 const [trainingTab,setTrainingTab]=useState<'prejob'|'onjob'>('prejob')
 const [reportOpen,setReportOpen]=useState(false)
 const [reportGenerating,setReportGenerating]=useState(false)
 const [selectedTraineeId,setSelectedTraineeId]=useState('')
 const [actionBusy,setActionBusy]=useState(false)
 const cohort=workflow?.training?.cohorts?.[0]
 const trainees=workflow?.training?.trainees?.filter(item=>item.cohortId===cohort?.id)||[]
 const prejobStages=(cohort?.stages||[]).map(stage=>({...stage,due:stage.progress===100?'已完成':new Date(stage.dueAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}))
 const onjobPrograms=(workflow?.training?.programs||[]).map((program,index)=>({...program,due:new Date(program.dueAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}),goal:`覆盖率${program.targetCoverage}% · 测试通过率≥${program.targetPassRate}%`,tone:program.status==='returned_to_training'||index===0?'critical':index===1?'warning':'normal'}))
 const taskProgress=Object.fromEntries([...prejobStages.map(item=>[item.id,item.progress]),...onjobPrograms.map(item=>[item.id,item.progress])]) as Record<string,number>
 const selectedTrainee=trainees.find(item=>item.id===selectedTraineeId)
 const updateTask=async(id:string)=>{
  setActionBusy(true)
  try{
   const stage=prejobStages.find(item=>item.id===id)
   const next=stage&&cohort
    ?await workflowApi.trainingStageAction(cohort.id,stage.id,Math.min(100,stage.progress+10),stage.evidence)
    :await workflowApi.updateTrainingProgram(id,{progress:Math.min(100,(onjobPrograms.find(item=>item.id===id)?.progress||0)+10),actualCoverage:Math.min(100,(onjobPrograms.find(item=>item.id===id)?.actualCoverage||0)+10),actualPassRate:Math.min(100,(onjobPrograms.find(item=>item.id===id)?.actualPassRate||0)+2),result:'培训师已回收最新覆盖与测试结果。'})
   setWorkflow(next);notify(stage?'岗前阶段进度已持久化更新':'岗中专项结果已更新')
  }catch(error){notify(error instanceof Error?error.message:'培训任务更新失败')}finally{setActionBusy(false)}
 }
 const recordRetest=async()=>{
  if(!selectedTrainee)return
  setActionBusy(true)
  try{
   const next=await workflowApi.updateTrainingAssessment(selectedTrainee.id,{
    attendance:selectedTrainee.attendance,theoryScore:Math.min(100,selectedTrainee.theoryScore+1),
    practiceScore:Math.min(100,selectedTrainee.practiceScore+6),scenarioScore:Math.min(100,selectedTrainee.scenarioScore+6),
    profileComplete:Math.min(100,selectedTrainee.profileComplete+10),
    ability:{...selectedTrainee.ability,business:Math.min(100,selectedTrainee.ability.business+5),communication:Math.min(100,selectedTrainee.ability.communication+4)},
    supportPlan:`已完成专项复测；下一阶段继续围绕${selectedTrainee.ability.business<selectedTrainee.ability.communication?'业务口径':'沟通表达'}安排2轮场景练习，并由上岗班长跟踪首周表现。`,
   })
   setWorkflow(next);notify(`${selectedTrainee.name}复测成绩与能力档案已更新`)
  }catch(error){notify(error instanceof Error?error.message:'学员评估更新失败')}finally{setActionBusy(false)}
 }
 const createQualityProgram=async()=>{
  setActionBusy(true)
  try{
   const next=await workflowApi.createTrainingProgram({title:'质检TOP问题当日补训',source:'质检重点规范性问题自动转入',audience:'普通客服一区重点员工',audienceCount:18,targetCoverage:100,targetPassRate:95,dueAt:new Date(Date.now()+24*60*60*1000).toISOString(),baseline:'同类问题抽检规范率89.6%'})
   setWorkflow(next);setTrainingTab('onjob');notify('岗中补训专项已创建并进入实施计划')
  }catch(error){notify(error instanceof Error?error.message:'培训专项创建失败')}finally{setActionBusy(false)}
 }
 const generateDailyReport=()=>{
  setReportOpen(true)
  setReportGenerating(true)
  window.setTimeout(()=>{setReportGenerating(false);notify('今日培训日报已生成，请确认后发送运营经理')},650)
 }
 const sendReport=async()=>{
  const sent=await publishTrainingReport()
  if(sent)setReportOpen(false)
 }
 const prejobAverage=prejobStages.length?Math.round(prejobStages.reduce((sum,stage)=>sum+stage.progress,0)/prejobStages.length):0
 const onjobAverage=onjobPrograms.length?Math.round(onjobPrograms.reduce((sum,item)=>sum+item.progress,0)/onjobPrograms.length):0
 const avg=(values:number[])=>values.length?Math.round(values.reduce((sum,value)=>sum+value,0)/values.length*10)/10:0
 const expectedPass=cohort?Math.round(cohort.arrivedCount*cohort.forecastPassRate/100):0
 const highRiskTrainees=trainees.filter(item=>item.riskLevel!=='normal')
 return <><PageHead eyebrow="培训作战台 · 有目标、有计划、有交付" title="一条链路交付合格新工，一条链路解决在岗问题" desc="岗前培训对“合格上岗”负责，岗中培训对“规范落地与差错改善”负责，所有动作按任务进展管理。" actions={<button className="primary" disabled={trainingReport.sent||busy} onClick={generateDailyReport}><FileBarChart size={16}/>{trainingReport.sent?'今日日报已发送':'一键生成培训日报'}</button>}/>
  <section className="training-command-strip"><div><span>今日培训结论</span><h2>新工班进度正常，但通关前需重点提升业务实操</h2><p>22名学员进入第6天，理论均分91.2分；6人在场景演练中存在口径不完整，已安排晚间强化。</p></div><article><span>岗前在训</span><strong>22<small>人</small></strong><em>计划24人 · 到位率91.7%</em></article><article><span>预计通关</span><strong>88.5<small>%</small></strong><em>目标 ≥85%</em></article><article><span>岗中覆盖</span><strong>149<small>人</small></strong><em>今日3项专项</em></article><article><span>任务按期率</span><strong>91.0<small>%</small></strong><em className="risk">1项存在风险</em></article><article><span>日报状态</span><strong>{trainingReport.sent?'已报':'待报'}</strong><em>{trainingReport.sent?(trainingReport.read?'经理已阅':'经理未读'):'17:30前生成'}</em></article></section>
  <TrainingLearningHub state={workflow} setState={setWorkflow} notify={notify}/>
  <div className="training-flow-summary"><button className={trainingTab==='prejob'?'active':''} onClick={()=>setTrainingTab('prejob')}><span><GraduationCap size={21}/></span><div><small>岗前培训</small><strong>合格新工交付链</strong><p>招聘到位 → 开班 → 培训 → 通关 → 档案 → 能力评估</p></div><em>{prejobAverage}%</em></button><button className={trainingTab==='onjob'?'active':''} onClick={()=>setTrainingTab('onjob')}><span><BookOpenCheck size={21}/></span><div><small>岗中培训</small><strong>业务规范改善链</strong><p>需求识别 → 集中传达 → 测试验证 → 重点帮扶 → 效果回收</p></div><em>{onjobAverage}%</em></button><div className="training-plan-rule"><Target size={20}/><div><small>培训目标法则</small><strong>每项任务都有对象、目标、截止时间和验收结果</strong></div></div></div>
  {trainingTab==='prejob'?<div className="training-prejob-grid"><section className="panel training-pipeline"><div className="panel-head"><div><span>岗前培养任务链</span><h2>7月新工班 · 从到位到合格上岗</h2></div><em>第6/10天</em></div><div className="training-stage-track">{prejobStages.map((stage,index)=><div className={`${stage.status} ${taskProgress[stage.id]>=100?'done':''}`} key={stage.id}><div className="stage-icon">{taskProgress[stage.id]>=100?<CheckCircle2 size={16}/>:index+1}</div><i></i><strong>{stage.name}</strong><span>{taskProgress[stage.id]}%</span></div>)}</div><div className="training-stage-list">{prejobStages.map(stage=><article key={stage.id}><div><span className={taskProgress[stage.id]>=100?'done':stage.status}>{taskProgress[stage.id]>=100?<CheckCircle2 size={15}/>:<Clock3 size={15}/>}</span><div><strong>{stage.name}</strong><small>{stage.owner} · {stage.due}</small></div></div><p>{stage.goal}</p><div className="training-task-progress"><i style={{width:`${taskProgress[stage.id]}%`}}></i></div><b>{taskProgress[stage.id]}%</b><button disabled={taskProgress[stage.id]>=100} onClick={()=>updateTask(stage.id)}>{taskProgress[stage.id]>=100?'已完成':'推进任务'}</button></article>)}</div></section><aside><section className="panel training-cohort"><div className="panel-head"><div><span>班级目标</span><h2>新工班交付预测</h2></div></div><div className="cohort-score"><strong>19</strong><span>预计合格上岗</span><small>22人参训 · 目标≥18人</small></div><div className="cohort-metrics"><div><span>出勤率</span><b>98.6%</b><em>目标 98%</em></div><div><span>理论均分</span><b>91.2</b><em>目标 ≥85</em></div><div><span>实操通过</span><b>72.7%</b><em>阶段目标 75%</em></div><div><span>高风险学员</span><b>3人</b><em>已安排帮扶</em></div></div></section><section className="panel training-trainees"><div className="panel-head"><div><span>能力评估</span><h2>需要重点帮扶的学员</h2></div></div>{[['高翔','业务口径','实操68分','今晚18:30一对一'],['魏琳','系统操作','平均慢22秒','增加沙盘练习'],['宋佳','沟通表达','场景紧张','安排优秀录音跟读']].map((item,index)=><article key={item[0]}><span>{item[0].slice(0,1)}</span><div><strong>{item[0]}</strong><small>{item[1]} · {item[2]}</small><p>{item[3]}</p></div><em>{index===0?'高风险':'需关注'}</em></article>)}</section></aside></div>:<div className="training-onjob-grid"><section className="panel training-programs"><div className="panel-head"><div><span>岗中专项任务</span><h2>从业务规范和重点差错出发</h2></div><em>今日3项</em></div>{onjobPrograms.map(program=><article className={program.tone} key={program.id}><header><div><span>{program.source}</span><h3>{program.title}</h3></div><em>{program.due}</em></header><div className="program-meta"><span><Users size={14}/>{program.audience}</span><span><Target size={14}/>{program.goal}</span><span><UserCog size={14}/>{program.owner}</span></div><div className="program-progress"><i style={{width:`${taskProgress[program.id]}%`}}></i><b>{taskProgress[program.id]}%</b></div><footer><span>{taskProgress[program.id]>=90?'进入结果回收':'正在组织传达与测试'}</span><button onClick={()=>updateTask(program.id)}>更新进展</button></footer></article>)}</section><aside><section className="panel training-demand"><div className="panel-head"><div><span>培训需求来源</span><h2>问题驱动，不做无效培训</h2></div></div>{[['质检TOP问题','4项','续约口径、建单规范'],['班长提报','3项','新人业务与营销开口'],['业务变更','2项','套餐承诺期、办理路径'],['投诉复盘','1项','首次联系与安抚']].map(item=><div key={item[0]}><strong>{item[0]}</strong><b>{item[1]}</b><span>{item[2]}</span></div>)}</section><section className="panel training-effect"><div className="panel-head"><div><span>效果验证</span><h2>培训后必须看改善</h2></div></div><div className="effect-ring"><strong>83%</strong><span>近7日有效改善</span></div><p>续约规范培训后重复来电率下降0.5pp；工单建单合规率提升1.8pp。</p><button onClick={()=>notify('已打开培训效果验证明细')}>查看验证明细</button></section></aside></div>}
  <section className="panel training-assessment-board"><div className="panel-head"><div><span>学员档案与通关证据</span><h2>个人目标、差距、帮扶和复测记录</h2></div><button className="secondary" disabled={actionBusy} onClick={createQualityProgram}><Plus size={14}/>质检问题转补训</button></div><div className="training-assessment-head"><span>学员</span><span>出勤 / 目标</span><span>理论 / 目标</span><span>实操 / 目标</span><span>场景 / 目标</span><span>档案</span><span>系统判断</span><span>操作</span></div>{trainees.map(trainee=><article className={selectedTraineeId===trainee.id?'selected':''} key={trainee.id} onClick={()=>setSelectedTraineeId(trainee.id)}><div><strong>{trainee.name}</strong><small>{trainee.jobNo}</small></div><span className={trainee.attendance>=98?'met':'gap'}>{trainee.attendance}% / 98%</span><span className={trainee.theoryScore>=85?'met':'gap'}>{trainee.theoryScore} / 85</span><span className={trainee.practiceScore>=75?'met':'gap'}>{trainee.practiceScore} / 75</span><span className={trainee.scenarioScore>=75?'met':'gap'}>{trainee.scenarioScore} / 75</span><span className={trainee.profileComplete>=90?'met':'gap'}>{trainee.profileComplete}%</span><em className={trainee.riskLevel}>{trainee.riskLevel==='high'?'高风险':trainee.riskLevel==='attention'?'需关注':'可通关'}</em><button disabled={actionBusy} onClick={event=>{event.stopPropagation();setSelectedTraineeId(trainee.id)}}>查看评估</button>{selectedTraineeId===trainee.id&&<div className="training-assessment-detail"><div><b>能力画像</b><span>业务 {trainee.ability.business}</span><span>系统 {trainee.ability.system}</span><span>沟通 {trainee.ability.communication}</span></div><p><b>下一步：</b>{trainee.supportPlan}</p><button className="primary" disabled={actionBusy} onClick={event=>{event.stopPropagation();void recordRetest()}}><ClipboardCheck size={14}/>记录本轮复测</button></div>}</article>)}</section>
  <div className="training-bottom-grid"><section className="panel training-today"><div className="panel-head"><div><span>今日任务节奏</span><h2>培训师今天还要完成什么</h2></div><em>{prejobStages.filter(item=>item.progress<100).length+onjobPrograms.filter(item=>item.status!=='closed').length}项未闭环</em></div>{prejobStages.filter(item=>item.progress<100).slice(0,3).map(item=><article key={item.id}><time>{new Date(item.dueAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</time><span className={item.status==='active'?'doing':'todo'}></span><strong>{item.name} · {item.goal}</strong><em className={item.status==='active'?'doing':'todo'}>{item.progress}%</em></article>)}{onjobPrograms.filter(item=>item.status!=='closed').slice(0,2).map(item=><article key={item.id}><time>{new Date(item.dueAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</time><span className={item.status==='returned_to_training'?'risk':'doing'}></span><strong>{item.title}</strong><em className={item.status==='returned_to_training'?'risk':'doing'}>{item.status==='quality_pending'?'质检验效':`${item.progress}%`}</em></article>)}</section><section className="panel training-report-card"><div className="panel-head"><div><span>向运营经理汇报</span><h2>每日培训日报</h2></div><em>{trainingReport.sent?'已发送':'待生成'}</em></div><div className="report-card-body"><FileBarChart size={28}/><div><strong>{trainingReport.sent?trainingReport.reportNo:'今日培训日报尚未提交'}</strong><p>自动汇总{cohort?.arrivedCount||0}名在训学员、{expectedPass}名预计通关、{highRiskTrainees.length}名重点帮扶及{onjobPrograms.length}项岗中专项。</p></div></div>{trainingReport.sent?<div className={`manager-message-status ${trainingReport.read?'read':'unread'}`}><Bell size={17}/><div><strong>{trainingReport.read?'运营经理已查阅':'运营经理消息已提醒'}</strong><p>{trainingReport.read?'日报查阅回执已返回培训岗。':'消息中心已产生未读提醒，等待经理查阅。'}</p></div><em>{trainingReport.read?'已阅':'未读'}</em></div>:<button className="primary wide" onClick={generateDailyReport}><Sparkles size={15}/>一键生成今日培训日报</button>}</section></div>
  {reportOpen&&(reportGenerating?<div className="training-report-backdrop"><section className="training-report-loading"><div><Sparkles size={28}/></div><h2>正在生成今日培训日报</h2><p>汇总岗前任务 · 计算通关预测 · 整理岗中专项 · 识别风险与明日计划</p><i><b></b></i></section></div>:<TrainingReportViewer reportNo="TR-20260724-001" close={()=>setReportOpen(false)} mode="training" onSend={sendReport} busy={busy}/>)}
 </>
}

function TrainingReportViewer({reportNo,close,mode,onSend,busy=false}:{reportNo:string;close:()=>void;mode:'training'|'manager';onSend?:()=>void;busy?:boolean}){
 return <div className="training-report-backdrop" onClick={close}><section className="training-report-viewer" onClick={event=>event.stopPropagation()}><header><div><span><FileBarChart size={16}/>河北基地 · 每日培训日报</span><h2>培训交付与问题改善日报</h2><p>2026年7月24日 · {reportNo}</p></div><div><b>{mode==='manager'?'运营经理查阅版':'培训岗确认版'}</b><button aria-label="关闭培训日报" onClick={close}><X size={20}/></button></div></header><div className="training-report-body"><section className="report-summary-row"><article><span>岗前在训</span><strong>22人</strong><small>到位率91.7%</small></article><article><span>预计通关</span><strong>88.5%</strong><small>目标≥85%</small></article><article><span>岗中专项</span><strong>3项</strong><small>覆盖149人</small></article><article><span>任务按期率</span><strong>91.0%</strong><small>1项存在风险</small></article></section><section className="report-section"><header><b>01</b><div><span>岗前培训</span><h3>7月新工班进展</h3></div><em>整体正常</em></header><div className="report-table"><div><span>阶段</span><span>实际进展</span><span>目标</span><span>判断</span></div><div><strong>培训实施</strong><span>第6/10天 · 课程64%</span><span>按计划完成100%</span><em>正常</em></div><div><strong>理论学习</strong><span>平均91.2分</span><span>≥85分</span><em>达标</em></div><div><strong>场景实操</strong><span>通过率72.7%</span><span>阶段目标75%</span><em className="risk">差2.3pp</em></div><div><strong>通关预测</strong><span>19/22人</span><span>≥18人</span><em>可达成</em></div></div></section><section className="report-section"><header><b>02</b><div><span>岗中培训</span><h3>业务规范与重点差错</h3></div><em>3项推进中</em></header><ul><li><b>续约业务规范：</b>已覆盖67/86人，测试通过率93.1%，14:00完成剩余人员传达。</li><li><b>投诉首次联系：</b>已完成脚本校准，16:00组织28人场景演练。</li><li><b>工单建单合规：</b>课程与错例已发布，完成度92%，明日回收测试结果。</li></ul></section><section className="report-section report-risk-section"><header><b>03</b><div><span>风险与重点人员</span><h3>需要经理关注</h3></div><em>1项风险</em></header><div className="report-risk"><AlertTriangle size={18}/><div><strong>6名新工场景实操口径不完整</strong><p>其中3人为高风险，已安排18:30一对一强化。若明日复测仍未达标，将调整通关名单并延长实训。</p></div></div></section><section className="report-section"><header><b>04</b><div><span>明日计划</span><h3>目标与关键动作</h3></div><em>4项</em></header><ol><li>完成新工班第7天课程，课程累计进度达到76%。</li><li>完成6名薄弱学员复测，高风险人数压降至1人以内。</li><li>回收续约规范培训测试，覆盖率和通过率均达到95%以上。</li><li>联合质检验证工单建单合规改善结果。</li></ol></section></div><footer><span>汇报人：培训主管 刘颖 · 汇报对象：运营经理</span>{mode==='training'?<div><button className="secondary" disabled={busy} onClick={close}>返回修改</button><button className="primary" disabled={busy} onClick={onSend}>{busy?<RefreshCw size={15}/>:<Send size={15}/>}发送运营经理</button></div>:<button className="primary" onClick={close}><CheckCircle2 size={15}/>已阅并关闭</button>}</footer></section></div>
}

function HrbpPage({notify,cases,createCase,setPage,busy,workflow,run,realData}:{notify:(text:string)=>void;cases:HrbpCase[];createCase:(payload:Parameters<typeof workflowApi.createHrbpCase>[0])=>Promise<boolean>;setPage:(page:string)=>void;busy:boolean;workflow:WorkflowState|null;run:WorkflowRunner;realData:RealDataState|null}){
 const [dimension,setDimension]=useState<'班组'|'入职批次'|'员工周期'>('班组')
 const [riskFilter,setRiskFilter]=useState<'全部'|'高风险'|'中风险'>('全部')
 const [selectedEmployee,setSelectedEmployee]=useState<null|{id:string;name:string;team:string;batch:string;cycle:HrbpCase['cycle'];score:number;signals:string[];trend:string}>(null)
 const [communicationPlan,setCommunicationPlan]=useState('')
 const teamRisk=realData?.hrbp.teams.length?realData.hrbp.teams.slice(0,8).map(item=>({name:item.team,rate:item.turnoverRate,people:item.departed})):[{name:'普通一区·8班',rate:18.6,people:4},{name:'普通二区·3班',rate:16.2,people:3},{name:'预警专席·1班',rate:12.8,people:2},{name:'普通一区·6班',rate:9.4,people:1},{name:'高星一区·2班',rate:6.8,people:0}]
 const batchRisk=[{batch:'2026年6月批次',joined:28,left:6,rate:21.4,status:'高风险'},{batch:'2026年5月批次',joined:35,left:6,rate:17.1,status:'高风险'},{batch:'2026年4月批次',joined:42,left:5,rate:11.9,status:'关注'},{batch:'2026年3月批次',joined:39,left:3,rate:7.7,status:'稳定'}]
 const cycleRisk=realData?.hrbp.lifecycle.length?realData.hrbp.lifecycle.slice(0,8).map(item=>({cycle:item.stage,people:item.total,rate:item.turnoverRate,target:'≤10%',risk:item.departed,action:item.turnoverRate>10?'优先复盘离职原因并形成分层干预':'保持周期性回访与组织体验跟踪'})):[{cycle:'培训期',people:26,rate:15.4,target:'≤12%',risk:4,action:'强化入职预期与业务认知'},{cycle:'实操期',people:31,rate:19.3,target:'≤12%',risk:6,action:'增加带教与每日情绪反馈'},{cycle:'实习期',people:68,rate:16.2,target:'≤10%',risk:7,action:'关注绩效落差与班组融入'},{cycle:'正式期',people:361,rate:8.1,target:'≤8%',risk:5,action:'关注薪资、晋升与工作负荷'}]
 const fallbackRiskEmployees=[
  {id:'JR10913',name:'王芳',team:'普通客服一区·8班',batch:'2026年5月批次',cycle:'实习期' as const,score:94,level:'高风险',signals:['连续3周绩效下降','近14日请假3次','小休占比22.6%'],trend:'风险较上周 +12'},
  {id:'JR12068',name:'张璐',team:'普通客服二区·3班',batch:'2026年5月批次',cycle:'实习期' as const,score:91,level:'高风险',signals:['提出转岗诉求','班长反馈情绪波动','近期排班适应困难'],trend:'已升级经理'},
  {id:'JR12117',name:'高翔',team:'普通客服一区·8班',batch:'2026年7月批次',cycle:'培训期' as const,score:88,level:'高风险',signals:['实操连续2次未通过','培训出勤下降','表达岗位预期不符'],trend:'风险较昨日 +8'},
  {id:'JR11874',name:'魏琳',team:'预警专席区·1班',batch:'2026年6月批次',cycle:'实操期' as const,score:81,level:'中风险',signals:['夜班适应困难','近期主动沟通减少'],trend:'连续3日持平'},
  {id:'JR10776',name:'李倩',team:'普通客服一区·8班',batch:'2026年4月批次',cycle:'正式期' as const,score:76,level:'中风险',signals:['薪资预期存在差异','营销压力反馈'],trend:'风险较上周 -4'},
 ]
 const riskEmployees=realData?.hrbp.risks.length?realData.hrbp.risks.map(item=>({id:item.jobNo,name:item.name,team:item.team,batch:`真实库 ${realData.hrbp.dataMonth}`,cycle:(item.cycle.includes('培训')?'培训期':item.cycle.includes('实操')?'实操期':item.cycle.includes('实习')?'实习期':'正式期') as HrbpCase['cycle'],score:item.riskScore,level:item.riskScore>=85?'高风险':'中风险',signals:item.reasons,trend:`近30日考勤风险 ${item.absentCount+item.lateCount}项`})):fallbackRiskEmployees
 const visibleEmployees=riskEmployees.filter(employee=>riskFilter==='全部'||employee.level===riskFilter)
 const openCommunication=(employee:typeof riskEmployees[number])=>{
  setSelectedEmployee(employee)
  setCommunicationPlan(`围绕${employee.signals.slice(0,2).join('、')}开展结构化沟通，确认真实离职意向、可干预事项与员工诉求；沟通后形成留任方案或升级经理判断。`)
 }
 const createCommunicationTask=async()=>{
  if(!selectedEmployee||!communicationPlan.trim())return
  const existing=cases.find(item=>item.employeeId===selectedEmployee.id&&item.status!=='closed')
  if(existing){notify(`${selectedEmployee.name}已有未关闭沟通任务`);setSelectedEmployee(null);setPage('tasks');return}
  const created=await createCase({role:'hrbp',actor:'HRBP经理 · 王丽伟',plan:communicationPlan,due:'今日 16:00',employee:{id:selectedEmployee.id,name:selectedEmployee.name,team:selectedEmployee.team,batch:selectedEmployee.batch,cycle:selectedEmployee.cycle,riskScore:selectedEmployee.score,reasons:[...selectedEmployee.signals]}})
  if(created){setSelectedEmployee(null);setPage('tasks')}
 }
 const pendingManager=cases.filter(item=>item.status==='manager_pending'||item.status==='manager_contacting').length
 const returned=cases.filter(item=>item.status==='closed'&&item.managerNote&&!item.filedAt).length
 return <><PageHead eyebrow="呼叫中心 HRBP 作战台 · 稳定组织、提前干预" title="先看哪里在流失，再看谁可能离开，最后把干预做成闭环" desc={`从班组、入职批次和员工周期识别风险；重点员工进入沟通任务，必要时升级经理PDCA。${realData?` 人员主数据月份 ${realData.hrbp.dataMonth}。`:''}`} actions={<><button className="secondary" onClick={()=>setPage('tasks')}><ListChecks size={16}/>沟通任务 {cases.filter(item=>item.status!=='closed').length}</button><button className="primary" onClick={()=>riskEmployees[0]&&openCommunication(riskEmployees[0])}><UserRoundSearch size={16}/>新建重点沟通</button></>}/>
  {realData&&<div className="live-data-scope"><Database size={16}/><div><strong>HRBP分析已接入EHR与日考勤真实表</strong><span>{realData.meta.warning} 高风险名单仅由真实考勤信号形成，沟通任务仍由HRBP本人确认后创建。</span></div></div>}
  <section className="hrbp-command-strip"><div><span>今日人员稳定结论</span><h2>实操期与实习期是流失高发窗口，8班需要优先干预</h2><p>基地滚动30日流失率12.8%，高于目标2.8个百分点；当前识别22名风险员工，其中5名需在今日完成沟通。</p></div><article><span>30日流失率</span><strong>12.8<small>%</small></strong><em className="risk">目标 ≤10%</em></article><article><span>风险员工</span><strong>22<small>人</small></strong><em>高风险 8人</em></article><article><span>本月净缺口</span><strong>16<small>人</small></strong><em className="risk">招聘到位率78%</em></article><article><span>经理待处理</span><strong>{pendingManager}<small>项</small></strong><em>{pendingManager?'已进入经理PDCA':'暂无升级'}</em></article><article><span>结果待备案</span><strong>{returned}<small>项</small></strong><em>经理结果已回传</em></article></section>
  {returned>0&&<section className="hrbp-return-banner"><CheckCircle2 size={19}/><div><strong>经理沟通结果已返回HRBP</strong><p>{cases.filter(item=>item.status==='closed'&&item.managerNote&&!item.filedAt).map(item=>`${item.name}：${(item.result||'已完成经理沟通并关闭').replace(/[。；]+$/,'')}`).join('；')}。</p></div><button onClick={()=>setPage('tasks')}>查看并备案</button></section>}
  <HrbpOperationsHub state={workflow} busy={busy} run={run}/>
  <div className="hrbp-dimension-tabs">{(['班组','入职批次','员工周期'] as const).map(item=><button className={dimension===item?'active':''} onClick={()=>setDimension(item)} key={item}>{item==='班组'?<Users size={16}/>:item==='入职批次'?<CalendarDays size={16}/>:<Activity size={16}/>}<span>{item}维度</span></button>)}</div>
  <div className="hrbp-analysis-grid"><section className="panel hrbp-main-analysis"><div className="panel-head"><div><span>流失风险分析</span><h2>{dimension}维度 · 离职率与重点分布</h2></div><em>滚动30日</em></div>{dimension==='班组'?<div className="hrbp-team-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={teamRisk} layout="vertical" margin={{top:8,right:25,left:8,bottom:0}}><CartesianGrid stroke="#e7edf3" horizontal={false}/><XAxis type="number" domain={[0,22]} tickFormatter={value=>`${value}%`} axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#7a899a'}}/><YAxis type="category" dataKey="name" width={95} axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#5e7187'}}/><Tooltip formatter={(value)=>[`${value}%`,'流失率']} contentStyle={{fontSize:10,borderRadius:7}}/><ReferenceLine x={10} stroke="#df8e34" strokeDasharray="4 3"/><Bar dataKey="rate" radius={[0,4,4,0]}>{teamRisk.map(item=><Cell key={item.name} fill={item.rate>15?'#df6464':item.rate>10?'#e2a13e':'#41967a'}/>)}</Bar></BarChart></ResponsiveContainer></div>:dimension==='入职批次'?<div className="hrbp-batch-table"><div><span>入职批次</span><span>到岗人数</span><span>已离职</span><span>流失率</span><span>判断</span></div>{batchRisk.map(item=><article key={item.batch}><strong>{item.batch}</strong><span>{item.joined}人</span><span>{item.left}人</span><b>{item.rate}%</b><em className={item.status==='高风险'?'high':item.status==='关注'?'mid':'low'}>{item.status}</em></article>)}</div>:<div className="hrbp-cycle-grid">{cycleRisk.map(item=><article className={item.rate>15?'high':item.rate>10?'mid':'low'} key={item.cycle}><header><span>{item.cycle}</span><b>{item.people}人</b></header><strong>{item.rate}%</strong><small>目标 {item.target} · 风险员工 {item.risk}人</small><div><i style={{width:`${Math.min(item.rate/22*100,100)}%`}}></i></div><p>{item.action}</p></article>)}</div>}<footer className="hrbp-analysis-note"><Sparkles size={16}/><span>AI判断：流失率与“入职后30—90天、绩效首次落差、夜班适应和直属管理体验”相关性最高。</span></footer></section><aside><section className="panel hrbp-headcount"><div className="panel-head"><div><span>人员供需</span><h2>编制与招聘补充</h2></div></div><div className="headcount-ring"><strong>96.8%</strong><span>在岗满足率</span></div>{[['目标编制','502人'],['当前在岗','486人'],['本月预计离职','11人'],['招聘待到位','9人']].map(item=><div className="headcount-row" key={item[0]}><span>{item[0]}</span><b>{item[1]}</b></div>)}<button onClick={()=>notify('招聘缺口需求已同步招聘负责人')}>同步招聘缺口</button></section><section className="panel hrbp-responsibility"><div className="panel-head"><div><span>HRBP责任清单</span><h2>今日组织动作</h2></div></div>{[['重点员工沟通','5人','16:00前'],['新工入职跟踪','22人','第7天回访'],['班长管理反馈','3个班组','今日回收'],['离职原因复盘','本周9人','周五输出'],['人员档案完整','待补7份','今日完成']].map(item=><article key={item[0]}><CheckCircle2 size={14}/><div><strong>{item[0]}</strong><small>{item[1]}</small></div><em>{item[2]}</em></article>)}</section></aside></div>
  <section className="panel hrbp-risk-panel"><div className="hrbp-risk-head"><div><span>重点高离职隐患员工</span><h2>证据清晰、分层干预、过程留痕</h2></div><div>{(['全部','高风险','中风险'] as const).map(item=><button className={riskFilter===item?'active':''} onClick={()=>setRiskFilter(item)} key={item}>{item}</button>)}</div></div><div className="hrbp-risk-columns"><span>员工 / 周期</span><span>班组 / 批次</span><span>风险分</span><span>风险信号</span><span>变化趋势</span><span>任务状态</span><span>操作</span></div>{visibleEmployees.map(employee=>{const task=cases.find(item=>item.employeeId===employee.id);const activeTask=task&&task.status!=='closed';return <article className={employee.level==='高风险'?'high':'mid'} key={employee.id}><div className="person"><span>{employee.name.slice(0,1)}</span><div><strong>{employee.name}</strong><small>{employee.id} · {employee.cycle}</small></div></div><div><strong>{employee.team}</strong><small>{employee.batch}</small></div><div className="hrbp-risk-score"><strong>{employee.score}</strong><span>{employee.level}</span></div><div className="hrbp-signals">{employee.signals.map(signal=><span key={signal}>{signal}</span>)}</div><em className={employee.trend.includes('-')?'down':''}>{employee.trend}</em><b className={task?'tasked':''}>{task?hrbpCaseStatus(task.status):'未建任务'}</b><button disabled={!!activeTask} onClick={()=>openCommunication(employee)}>{activeTask?<><CheckCircle2 size={13}/>已进入任务</>:task?<><RefreshCw size={13}/>再次沟通</>:<><Plus size={13}/>生成沟通任务</>}</button></article>})}</section>
  {selectedEmployee&&<div className="hrbp-dialog-backdrop" onClick={()=>setSelectedEmployee(null)}><section className="hrbp-dialog" onClick={event=>event.stopPropagation()}><header><div><span><UserRoundSearch size={17}/>重点员工沟通任务</span><h2>为 {selectedEmployee.name} 制定首次沟通计划</h2><p>沟通目标不是完成面谈，而是识别真实诉求并形成可执行干预。</p></div><button aria-label="关闭沟通任务" disabled={busy} onClick={()=>setSelectedEmployee(null)}><X size={20}/></button></header><div className="hrbp-dialog-body"><div className="hrbp-employee-summary"><div className="person"><span>{selectedEmployee.name.slice(0,1)}</span><div><strong>{selectedEmployee.name}</strong><small>{selectedEmployee.id} · {selectedEmployee.team}</small></div></div><b>{selectedEmployee.score}分 · 高风险</b><div>{selectedEmployee.signals.map(signal=><span key={signal}>{signal}</span>)}</div></div><div className="hrbp-form-row"><label>沟通负责人<input value="HRBP经理 · 王丽伟" readOnly/></label><label>完成时限<select defaultValue="今日 16:00"><option>今日 16:00</option><option>今日下班前</option><option>明日 10:00</option></select></label></div><label>沟通计划<textarea value={communicationPlan} onChange={event=>setCommunicationPlan(event.target.value)}/></label><div className="hrbp-dialog-rule"><Target size={17}/><div><strong>任务判断规则</strong><p>HRBP可解决：形成干预方案并关闭；涉及调岗、排班资源、薪资政策或管理争议：升级运营经理处理。</p></div></div></div><footer><button className="secondary" disabled={busy} onClick={()=>setSelectedEmployee(null)}>取消</button><button className="primary" disabled={busy||!communicationPlan.trim()} onClick={createCommunicationTask}>{busy?<RefreshCw size={15}/>:<ListChecks size={15}/>}生成沟通任务</button></footer></section></div>}
 </>
}

function hrbpCaseStatus(status:HrbpCaseStatus){return ({hrbp_todo:'待HRBP沟通',hrbp_contacting:'HRBP沟通中',manager_pending:'待经理处理',manager_contacting:'经理沟通中',closed:'已关闭'} as Record<HrbpCaseStatus,string>)[status]}

function HrbpPdcaPage({role,cases,act,busy,notify}:{role:'hrbp'|'manager';cases:HrbpCase[];act:HrbpActionRunner;busy:boolean;notify:(text:string)=>void}){
 const relevant=role==='manager'?cases.filter(item=>['manager_pending','manager_contacting','closed'].includes(item.status)&&!!(item.managerNote||item.status!=='closed')):cases
 const [selectedId,setSelectedId]=useState(relevant.find(item=>item.status!=='closed')?.id||relevant[0]?.id||'')
 const [note,setNote]=useState('')
 const selected=relevant.find(item=>item.id===selectedId)||relevant[0]
 const perform=async(action:HrbpAction,message:string,actionNote=note)=>{
  const ok=await act(selected.id,role,action,actionNote,message)
  if(ok)setNote('')
 }
 if(!selected)return <div className="workflow-empty"><Users size={35}/><h2>暂无人员稳定任务</h2><p>HRBP识别高风险员工后，可生成沟通任务。</p></div>
 return <><PageHead eyebrow={`${role==='manager'?'经理':'HRBP'} PDCA · 人员稳定专项`} title={role==='manager'?'处理HRBP无法独立解决的高风险人员':'沟通不是记录，是降低流失风险的行动闭环'} desc="识别风险、完成沟通、评估可干预性；超出HRBP权限的事项升级经理，关闭结果返回HRBP备案。"/>
  <div className="hrbp-pdca-layout"><aside className="panel hrbp-case-list"><header><span>人员稳定任务</span><h2>{relevant.filter(item=>item.status!=='closed').length}项进行中</h2></header>{relevant.map(item=><button className={selected.id===item.id?'active':''} onClick={()=>{setSelectedId(item.id);setNote('')}} key={item.id}><span className={`case-risk r${item.riskScore}`}>{item.riskScore}</span><div><strong>{item.name} · {item.cycle}</strong><small>{item.team}</small><em className={item.status}>{hrbpCaseStatus(item.status)}</em></div><ChevronRight size={15}/></button>)}</aside><main className="panel hrbp-case-detail"><header><div><span>{selected.id}</span><h2>{selected.name}高流失风险沟通任务</h2><p>{selected.team} · {selected.batch} · {selected.cycle}</p></div><b className={selected.status}>{hrbpCaseStatus(selected.status)}</b></header><div className="hrbp-case-kpis"><div><span>风险评分</span><strong>{selected.riskScore}</strong></div><div><span>当前责任人</span><strong>{selected.owner}</strong></div><div><span>任务截止</span><strong>{selected.due}</strong></div><div><span>创建时间</span><strong>{selected.createdAt}</strong></div></div><section className="hrbp-case-evidence"><h3>风险证据</h3><div>{selected.reasons.map(reason=><span key={reason}><AlertTriangle size={13}/>{reason}</span>)}</div></section>{selected.hrbpNote&&<section className="hrbp-note"><h3>HRBP沟通与判断</h3><p>{selected.hrbpNote}</p></section>}
   {role==='hrbp'&&selected.status==='hrbp_todo'&&<div className="hrbp-case-action"><h3>开始首次沟通</h3><p>建议围绕工作适应、直属管理、薪资预期、排班负荷和个人发展进行结构化沟通。</p><button className="primary" disabled={busy} onClick={()=>perform('hrbp_start','沟通任务已开始','')}><Play size={15}/>开始沟通</button></div>}
   {role==='hrbp'&&selected.status==='hrbp_contacting'&&<div className="hrbp-case-action"><h3>记录沟通结论并评估</h3><textarea value={note} onChange={event=>setNote(event.target.value)} placeholder="记录员工真实诉求、留任意愿、可干预事项与HRBP判断"/><div><button className="secondary" disabled={busy||!note.trim()} onClick={()=>perform('hrbp_close','任务已由HRBP关闭并完成备案')}><CheckCircle2 size={15}/>HRBP解决并关闭</button><button className="primary" disabled={busy||!note.trim()} onClick={()=>perform('escalate_manager','任务已升级运营经理并发送提醒')}><ArrowUpRight size={15}/>无法独立处理，升级经理</button></div></div>}
   {role==='hrbp'&&['manager_pending','manager_contacting'].includes(selected.status)&&<div className="hrbp-waiting-manager"><Clock3 size={20}/><div><strong>等待运营经理处理</strong><p>涉及资源协调或管理决策，已进入经理PDCA；经理关闭后结果将自动回传HRBP。</p></div></div>}
   {role==='manager'&&selected.status==='manager_pending'&&<div className="hrbp-case-action manager"><h3>经理接收HRBP升级</h3><p>请查看HRBP判断，协调班长、主管或相关资源后与员工完成经理级沟通。</p><button className="primary" disabled={busy} onClick={()=>perform('manager_start','经理已开始处理人员稳定任务','')}><Play size={15}/>开始经理沟通</button></div>}
   {role==='manager'&&selected.status==='manager_contacting'&&<div className="hrbp-case-action manager"><h3>记录经理沟通结果</h3><textarea value={note} onChange={event=>setNote(event.target.value)} placeholder="填写资源协调结果、员工最终意愿、后续安排和回访要求"/><button className="primary" disabled={busy||!note.trim()} onClick={()=>perform('manager_close','任务已关闭，结果已回传HRBP备案')}><CheckCircle2 size={15}/>关闭任务并回传HRBP</button></div>}
   {selected.status==='closed'&&<div className="hrbp-case-closed"><CheckCircle2 size={24}/><div><strong>沟通任务已关闭</strong><p>{selected.result}</p>{selected.managerNote&&<small>经理结论：{selected.managerNote}</small>}{selected.managerNote&&(selected.filedAt?<small>HRBP备案：{selected.filedBy} · {selected.filedAt}</small>:role==='hrbp'?<button className="primary" disabled={busy} onClick={()=>perform('hrbp_file','经理沟通结果已完成HRBP备案','')}><ClipboardCheck size={15}/>确认结果并备案</button>:<small>等待HRBP确认备案</small>)}</div></div>}</main><aside className="panel hrbp-case-timeline"><header><span>全程留痕</span><h2>任务时间线</h2></header>{selected.history.map((item,index)=><article key={`${item.time}-${index}`}><span></span><div><time>{item.time}</time><strong>{item.actor}</strong><p>{item.action}</p></div></article>)}</aside></div>
 </>
}

function ManagerPdcaHub({state,error,busy,run,cases,act,notify}:{state:WorkflowState|null;error:string;busy:boolean;run:WorkflowRunner;cases:HrbpCase[];act:HrbpActionRunner;notify:(text:string)=>void}){
 const hrPending=cases.filter(item=>item.status==='manager_pending'||item.status==='manager_contacting').length
 const peoplePending=state?(state.people.staffingPlans.filter(item=>item.status==='manager_pending').length+state.people.lifecycle.filter(item=>item.status==='manager_pending').length+state.people.laborCases.filter(item=>['manager_pending','manager_doing'].includes(item.status)).length):0
 const governancePending=state?state.governance.shiftPlans.filter(item=>item.status==='manager_pending').length+state.governance.skillRoutes.filter(item=>item.status==='manager_pending').length+state.governance.crossDepartmentItems.filter(item=>item.targetRole==='manager'&&!['closed','director_verification'].includes(item.status)).length+state.governance.budgets.filter(item=>item.status==='returned').length:0
 const operationPending=state?state.tasks.filter(item=>item.status!=='closed'&&(item.initiatorRole==='manager'||item.executionOwnerRole==='manager'||item.ownerRole==='manager'||item.verificationRole==='manager')).length:0
 const [tab,setTab]=useState<'operation'|'hrbp'|'people'|'governance'>('operation')
 return <><div className="manager-pdca-tabs"><button className={tab==='operation'?'active':''} onClick={()=>setTab('operation')}><ListChecks size={16}/>精益任务管理{operationPending>0&&<b>{operationPending}</b>}</button><button className={tab==='hrbp'?'active':''} onClick={()=>setTab('hrbp')}><UserRoundSearch size={16}/>人员稳定任务{hrPending>0&&<b>{hrPending}</b>}</button><button className={tab==='people'?'active':''} onClick={()=>setTab('people')}><BriefcaseBusiness size={16}/>人事审批{peoplePending>0&&<b>{peoplePending}</b>}</button><button className={tab==='governance'?'active':''} onClick={()=>setTab('governance')}><Gauge size={16}/>生产与经营审批{governancePending>0&&<b>{governancePending}</b>}</button></div>{tab==='operation'?<WorkflowTasksPage key="manager-pdca" role="manager" state={state} error={error} busy={busy} run={run} notify={notify}/>:tab==='hrbp'?<HrbpPdcaPage role="manager" cases={cases} act={act} busy={busy} notify={notify}/>:tab==='people'?(state?<ManagerPeopleApprovals state={state} busy={busy} run={run}/>:<ServiceUnavailable error={error||'人事审批状态加载中'}/>):(state?<ManagerGovernanceApprovals state={state} busy={busy} run={run}/>:<ServiceUnavailable error={error||'生产审批状态加载中'}/>)}</>
}

function LeaderPdcaHub({state,setState,error,busy,run,notify}:{state:WorkflowState|null;setState:(state:WorkflowState)=>void;error:string;busy:boolean;run:WorkflowRunner;notify:(text:string)=>void}){
 const learningPending=state?(state.learning.assignments.filter(item=>item.status==='leader_verification').length+state.learning.growthReviews.filter(item=>item.status==='leader_pending').length):0
 const operationPending=(state?.tasks||[]).filter(item=>item.status!=='closed'&&item.ownerRole==='leader').length
 const [tab,setTab]=useState<'learning'|'operation'>(learningPending?'learning':'operation')
 return <><div className="manager-pdca-tabs"><button className={tab==='learning'?'active':''} onClick={()=>setTab('learning')}><GraduationCap size={16}/>学习与成长验收{learningPending>0&&<b>{learningPending}</b>}</button><button className={tab==='operation'?'active':''} onClick={()=>setTab('operation')}><ListChecks size={16}/>运营PDCA任务{operationPending>0&&<b>{operationPending}</b>}</button></div>{tab==='learning'?(state?<LeaderLearningApprovals state={state} setState={setState} notify={notify}/>:<ServiceUnavailable error={error||'学习验收状态加载中'}/>):<WorkflowTasksPage role="leader" state={state} error={error} busy={busy} run={run} notify={notify}/>}</>
}

function HrbpPdcaHub({state,error,busy,run,cases,act,notify}:{state:WorkflowState|null;error:string;busy:boolean;run:WorkflowRunner;cases:HrbpCase[];act:HrbpActionRunner;notify:(text:string)=>void}){
 const peoplePending=cases.filter(item=>item.status!=='closed'||(item.managerNote&&!item.filedAt)).length
 const aiPending=(state?.tasks||[]).filter(item=>item.workflowKind==='ai_action'&&item.status!=='closed'&&(item.originRole==='hrbp'||item.ownerRole==='hrbp'||item.verificationRole==='hrbp')).length
 const crossPending=state?.governance.crossDepartmentItems.filter(item=>item.targetRole==='hrbp'&&!['closed','director_verification'].includes(item.status)).length||0
 const [tab,setTab]=useState<'people'|'cross'|'ai'>(peoplePending?'people':crossPending?'cross':'ai')
 return <><div className="manager-pdca-tabs"><button className={tab==='people'?'active':''} onClick={()=>setTab('people')}><UserRoundSearch size={16}/>人员稳定任务{peoplePending>0&&<b>{peoplePending}</b>}</button><button className={tab==='cross'?'active':''} onClick={()=>setTab('cross')}><Users size={16}/>总监跨部门协同{crossPending>0&&<b>{crossPending}</b>}</button><button className={tab==='ai'?'active':''} onClick={()=>setTab('ai')}><Sparkles size={16}/>AI行动任务{aiPending>0&&<b>{aiPending}</b>}</button></div>{tab==='people'?<HrbpPdcaPage role="hrbp" cases={cases} act={act} busy={busy} notify={notify}/>:tab==='cross'?(state?<RoleCrossDepartmentTasks role="hrbp" state={state} busy={busy} run={run}/>:<ServiceUnavailable error={error||'跨部门协同状态加载中'}/>):<WorkflowTasksPage role="hrbp" state={state} error={error} busy={busy} run={run} notify={notify}/>}</>
}

function AlertDrawer({alert,close,handle}:{alert:Alert;close:()=>void;handle:()=>void}){return <div className="drawer-backdrop" onClick={close}><aside className="drawer" onClick={e=>e.stopPropagation()}><header><div><span className={`severity ${alert.severity}`}>{riskLabel[alert.severity]}</span><small>{alert.id}</small></div><button onClick={close}><X size={19}/></button></header><div className="drawer-body"><span className="eyebrow">{alert.type} · {alert.team}</span><h2>{alert.title}</h2><div className="confidence"><Sparkles size={16}/><span>AI判断置信度</span><strong>{alert.confidence}%</strong></div><section><h3>系统发现了什么</h3><p>{alert.evidence}</p><small>数据来源：{alert.source}</small></section><section className="suggest"><h3><Bot size={18}/>建议这样处理</h3><p>{alert.suggestion}</p></section><section><h3>处置截止</h3><p className="due"><Clock3 size={17}/>{alert.due}</p></section></div><footer><button className="secondary" onClick={close}>稍后处理</button><button className="primary" onClick={()=>{handle();close()}}><Zap size={16}/>采纳建议并生成任务</button></footer></aside></div>}

function AlertsPage({alerts,selectedAlert,setSelectedAlert,handleAlert}:{alerts:Alert[];selectedAlert:Alert|null;setSelectedAlert:(a:Alert)=>void;handleAlert:(id:string)=>void}){return <><PageHead eyebrow="AI巡检 · 每15分钟" title="预警不是消息，是必须关闭的管理事件" desc="规则给出信号，AI解释原因，管理者决定动作；所有动作进入PDCA跟踪。" actions={<button className="primary"><Bot size={16}/>配置预警规则</button>}/><div className="alert-workbench"><section className="alert-list panel"><div className="filter-row"><button className="active">全部 {alerts.length}</button><button>紧急 2</button><button>关注 2</button><button>处理中 1</button></div>{alerts.map(a=><button className={`alert-row ${selectedAlert?.id===a.id?'selected':''}`} key={a.id} onClick={()=>setSelectedAlert(a)}><span className={`sev-dot ${a.severity}`}></span><div><div><strong>{a.type}</strong><em>{a.status==='processing'?'处理中':'待处理'}</em></div><h3>{a.title}</h3><p>{a.team}{a.person?` · ${a.person}`:''}</p></div><time>{a.due}</time></button>)}</section><section className="panel alert-detail">{selectedAlert?<><div className="detail-top"><span className={`severity ${selectedAlert.severity}`}>{riskLabel[selectedAlert.severity]}</span><small>{selectedAlert.id}</small></div><h2>{selectedAlert.title}</h2><p className="evidence">{selectedAlert.evidence}</p><div className="ai-reason"><Bot size={20}/><div><strong>AI处置建议</strong><p>{selectedAlert.suggestion}</p></div></div><div className="evidence-grid"><div><span>所属组织</span><strong>{selectedAlert.team}</strong></div><div><span>置信度</span><strong>{selectedAlert.confidence}%</strong></div><div><span>截止时间</span><strong>{selectedAlert.due}</strong></div><div><span>数据来源</span><strong>{selectedAlert.source}</strong></div></div><button className="primary wide" onClick={()=>handleAlert(selectedAlert.id)}><Zap size={16}/>生成处置任务</button></>:<div className="empty">选择一条预警查看详情</div>}</section></div></>}

function MeetingPage({notify,workflow,realData,setWorkflow}:{notify:(s:string)=>void;workflow:WorkflowState|null;realData:RealDataState|null;setWorkflow:(state:WorkflowState)=>void}){
 const [startedAt,setStartedAt]=useState<number|null>(null)
 const [nowTick,setNowTick]=useState(Date.now())
 const [briefingEmployees,setBriefingEmployees]=useState<MorningEmployee[]>([])
 const [scriptOpen,setScriptOpen]=useState(false)
 const [scriptGenerating,setScriptGenerating]=useState(false)
 const [activeScriptIndex,setActiveScriptIndex]=useState(0)
 const [editableScript,setEditableScript]=useState<{label:string;text:string}[]>([])
 const [recording,setRecording]=useState(false)
 const [recordingBusy,setRecordingBusy]=useState(false)
 const recorderRef=useRef<MediaRecorder|null>(null)
 const recordingStreamRef=useRef<MediaStream|null>(null)
 const recordingStartedRef=useRef(0)
 const recordingChunksRef=useRef<Blob[]>([])
 const assignedSchedule=workflow?.morningBriefings.schedules.find(item=>item.status==='issued'&&item.team==='普通客服一区·8班')||workflow?.morningBriefings.schedules.find(item=>item.status==='issued')
 useEffect(()=>{if(startedAt===null)return;const timer=window.setInterval(()=>setNowTick(Date.now()),500);return()=>window.clearInterval(timer)},[startedAt])
 useEffect(()=>{reportApi.preview('north-center-10015','team-morning-brief').then(data=>setBriefingEmployees(data.briefingRows||[])).catch(()=>setBriefingEmployees([]))},[])
 const remaining=startedAt===null?15*60:Math.max(0,15*60-Math.floor((nowTick-startedAt)/1000))
 const clock=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`
 const running=startedAt!==null&&remaining>0
 const focusEmployees=briefingEmployees.filter(employee=>employee.category==='重点员工').slice(0,3)
 const coachingEmployees=briefingEmployees.filter(employee=>employee.category==='辅导关注').slice(0,2)
 const focusNames=focusEmployees.length?focusEmployees.map(employee=>employee.name).join('、'):'李凤云、曹寒、张东'
 const coachingText=coachingEmployees.length?coachingEmployees.map(employee=>`${employee.name}（${employee.position}）`).join('、'):'冉倩（效率辅导）、李承震（复核后辅导）'
 const qualityIssue=workflow?.events.find(event=>event.type==='质量趋势')?.evidence||'昨日抽检发现续约争议解释不完整，重复来电主要集中在办理路径与规则说明。'
 const liveReview=realData?.morning.metrics.map(item=>({
  label:item.label,
  value:item.actual==null?'—':`${item.actual.toLocaleString('zh-CN')}${item.unit}`,
  target:item.target==null?'未配置':`${item.direction==='lower'?'≤':''}${item.target.toLocaleString('zh-CN')}${item.unit}`,
  result:item.status==='met'?'已达标':item.status==='attention'?'未达标':'待确认',
  gap:item.gap==null?'暂无可比目标':`${item.gap>=0?'高':'低'}目标${Math.abs(item.gap)}${item.unit}`,
  tone:item.status==='met'?'good':item.status==='attention'?'risk':'normal',
 }))
 const yesterdayReview=liveReview?.length?liveReview:[
  {label:'人工应答量',value:'1,284',target:'1,360',result:'未达标',gap:'低目标76通',tone:'risk'},
  {label:'服务满意率',value:'96.8%',target:'97.2%',result:'未达标',gap:'低0.4个百分点',tone:'risk'},
  {label:'一次解决率',value:'89.6%',target:'88.0%',result:'已达标',gap:'高1.6个百分点',tone:'good'},
  {label:'重复来电率',value:'4.7%',target:'≤4.0%',result:'未达标',gap:'高于上限0.7个百分点',tone:'bad'},
  {label:'置忙小休',value:'13.4%',target:'≤12.0%',result:'未达标',gap:'高于上限1.4个百分点',tone:'bad'},
  {label:'签入率',value:'94.8%',target:'96.0%',result:'未达标',gap:'低1.2个百分点',tone:'risk'},
 ]
 const todayTargets=realData?.morning.metrics.filter(item=>item.target!=null).map(item=>`${item.label}${item.direction==='lower'?'≤':'≥'}${item.target}${item.unit}`)||['人工应答量≥1,360','满意率≥97.2%','一次解决率≥90.0%','重复来电率≤4.0%','置忙小休≤12.0%','签入率≥96.0%']
 const agenda=[
  {time:'1分钟',label:'问好环节',tag:'开场聚焦',text:'问候团队、确认到岗和精神状态，说明今天班前会的核心主题。'},
  {time:'4分钟',label:'指标宣讲环节',tag:'昨日复盘',text:'通报昨日6项核心指标，明确达标项、未达标项和Gap。'},
  {time:'3分钟',label:'目标宣讲环节',tag:'今日设定',text:'承接昨日Gap，发布今日六项硬目标和过程动作。'},
  {time:'3分钟',label:'业务传达环节',tag:'口径统一',text:'传达续约产品办理路径更新，统一争议场景解释口径。'},
  {time:'4分钟',label:'重点关注环节',tag:'表扬+辅导',text:`表扬${focusNames}；明确辅导关注人员、质检问题和班后动作。`},
 ]
 const meetingScript=[
  {label:'问好环节',text:'各位同事早上好。新的一天开始了，请大家快速确认工位、系统和业务状态。今天的班前会围绕“补齐昨日Gap、稳定客户感知”展开，我们用15分钟把成绩讲清、目标讲透、动作落到人。'},
  {label:'指标宣讲环节',text:'先复盘昨日结果：一次解决率89.6%，高于目标1.6个百分点，达标；人工应答量1,284通，低目标76通；满意率96.8%，低0.4个百分点；重复来电率4.7%，高于上限0.7个百分点；置忙小休13.4%，高于上限1.4个百分点；签入率94.8%，低1.2个百分点。今天重点补产量、重复来电、小休和签入四个Gap。'},
  {label:'目标宣讲环节',text:`今日目标统一为：${todayTargets.join('；')}。目标不是只看收班结果，请大家在每个小时关注应答节奏、一次解决和非通话时长，出现偏差及时举手。`},
  {label:'业务传达环节',text:'今天续约产品办理路径已经更新。涉及续约争议时，先确认客户当前套餐和承诺期，再解释变更规则与办理路径，最后复述确认，避免因解释不完整产生重复来电。知识卡片已经推送，遇到边界问题先查询、再答复。'},
  {label:'重点关注环节',text:`先表扬${focusNames}，昨日在产量、服务质量或效率上表现均衡，请继续保持并主动分享有效方法。今天重点辅导${coachingText}，班后完成针对性复盘。质检重点：${qualityIssue} 所有关注动作以帮助改善为目的，班长会跟进结果。`},
 ]
 const scriptText=editableScript.map((section,index)=>`${index+1}. ${section.label}\n${section.text}`).join('\n\n')
 const generateScript=()=>{setScriptOpen(true);setScriptGenerating(true);setActiveScriptIndex(0);window.setTimeout(()=>{setEditableScript(meetingScript);setScriptGenerating(false);notify('班前会宣讲内容已生成，可编辑后照稿宣讲')},650)}
 const updateScriptSection=(index:number,text:string)=>setEditableScript(current=>current.map((section,itemIndex)=>itemIndex===index?{...section,text}:section))
 const copyScript=async()=>{try{await navigator.clipboard.writeText(scriptText);notify('宣讲稿已复制')}catch{notify('复制失败，请手动选择宣讲内容')}}
 const toggleRecording=async()=>{
  if(recording){recorderRef.current?.stop();recordingStreamRef.current?.getTracks().forEach(track=>track.stop());setRecording(false);return}
  if(!assignedSchedule){notify('当前没有主管已下发的班前会排期');return}
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});const recorder=new MediaRecorder(stream)
   recordingStreamRef.current=stream;recorderRef.current=recorder;recordingStartedRef.current=Date.now()
   recordingChunksRef.current=[];recorder.ondataavailable=event=>{if(event.data.size)recordingChunksRef.current.push(event.data)}
   recorder.onstop=async()=>{setRecordingBusy(true);try{const durationSeconds=Math.max(1,Math.round((Date.now()-recordingStartedRef.current)/1000));const audio=new Blob(recordingChunksRef.current,{type:recorder.mimeType||'audio/webm'}),bytes=new Uint8Array(await audio.arrayBuffer());let binary='';for(let index=0;index<bytes.length;index+=0x8000)binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));const next=await workflowApi.morningScheduleAction(assignedSchedule.id,'leader','complete',{durationSeconds,fileName:`${assignedSchedule.team}_${assignedSchedule.date}_班前会.webm`,mimeType:audio.type||'audio/webm',contentBase64:btoa(binary)});setWorkflow(next);notify(`录音已保存，系统质量初评 ${next.morningBriefings.schedules.find(item=>item.id===assignedSchedule.id)?.qualityScore||'—'} 分`)}catch(error){notify(error instanceof Error?error.message:'录音提交失败')}finally{setRecordingBusy(false);recordingChunksRef.current=[]}}
   recorder.start();setRecording(true);if(startedAt===null){const start=Date.now();setStartedAt(start);setNowTick(start)}notify('录音已开始，将用于班前会质量评分')
  }catch{notify('无法启用麦克风，请检查浏览器录音权限')}
 }
 return <><PageHead eyebrow="班组管理基本功 · 昨日复盘 → 今日目标" title="今天的班前会，先讲结果，再把动作落到人" desc={`根据前一日指标达成、重点员工、质检问题和今日目标，形成班长可直接宣讲的内容。${realData?` 数据截至 ${realData.morning.date}。`:''}`} actions={<><button className={`secondary meeting-record ${recording?'active':''}`} disabled={recordingBusy} onClick={()=>void toggleRecording()}><RadioTower size={16}/>{recording?'停止并提交录音':recordingBusy?'正在评分':'开始录音'}</button><button className="secondary" disabled={startedAt!==null} onClick={()=>{const start=Date.now();setStartedAt(start);setNowTick(start);notify('班前会已开始，系统开始计时')}}><Play size={16}/>{running?'会议进行中':startedAt!==null?'会议已结束':'开始班前会'}</button><button className="primary" onClick={generateScript}><Sparkles size={16}/>一键生成宣讲稿</button></>}/>
  {assignedSchedule&&<section className="meeting-assignment"><CalendarDays size={18}/><div><span>主管已下发 · {assignedSchedule.date} {assignedSchedule.time}</span><strong>{assignedSchedule.team} · {assignedSchedule.title}</strong><p>{assignedSchedule.focus.join('　·　')}</p></div><em>{assignedSchedule.status==='completed'?`已召开 · ${assignedSchedule.qualityScore}分`:'待召开录音'}</em></section>}
  {realData&&<div className="live-data-scope"><Database size={16}/><div><strong>班前会已接入真实库</strong><span>{realData.meta.warning}</span></div></div>}
  <div className="meeting-overview"><section className="panel meeting-agenda"><div className="meeting-clock"><span>标准时长</span><strong>{clock}</strong><small>{running?'正在记录...':startedAt!==null?'会议已结束':'五个环节 · 15分钟'}</small></div>{agenda.map((item,index)=><article className="meeting-step" key={item.label}><time>{item.time}</time><b>{index+1}</b><div><header><h3>{item.label}</h3><em>{item.tag}</em></header><p>{item.text}</p></div></article>)}</section>
   <section className="panel meeting-review"><div className="panel-head"><div><span>前一日目标复盘</span><h2>1项达标 · 5项需追回</h2></div><em>数据截至昨日收班</em></div><div className="yesterday-kpis">{yesterdayReview.map(item=><article className={item.tone} key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>目标 {item.target}</small><footer><b>{item.result}</b><em>{item.gap}</em></footer></article>)}</div><div className="today-target-box"><header><Target size={19}/><div><span>目标导向</span><strong>今日六项硬目标</strong></div></header><div>{todayTargets.map(target=><b key={target}>{target}</b>)}</div></div></section>
  </div>
  <div className="meeting-focus-grid"><section className="panel praise-panel"><div className="panel-head"><div><span>正向激励</span><h2>昨日重点表扬</h2></div><em>来自晨会日报可比池</em></div><div>{focusEmployees.length?focusEmployees.map(employee=><article key={employee.jobNo}><span>{employee.name.slice(0,1)}</span><div><strong>{employee.name}</strong><small>{employee.team} · {employee.position}</small><p>{employee.reason}</p></div><em>会上表扬</em></article>):<div className="meeting-data-loading">正在读取重点员工...</div>}</div></section>
   <section className="panel meeting-attention"><div className="panel-head"><div><span>问题导向</span><h2>业务传达与重点关注</h2></div><em>班后动作需闭环</em></div><article><BookOpenCheck size={19}/><div><strong>续约产品办理路径更新</strong><p>统一“确认套餐—解释规则—指引办理—复述确认”四步口径，降低重复来电。</p></div><b>业务传达</b></article><article className="quality"><AlertTriangle size={19}/><div><strong>前一日质检问题</strong><p>{qualityIssue}</p></div><b>质检复盘</b></article><article><UserRoundSearch size={19}/><div><strong>辅导关注</strong><p>{coachingText}，会后安排复盘或跟岗，不在会上做负向评价。</p></div><b>重点关注</b></article></section>
  </div>
  {scriptOpen&&<div className="meeting-script-backdrop" onClick={()=>setScriptOpen(false)}><section className="meeting-script-workbench" onClick={event=>event.stopPropagation()}>
   <header className="script-workbench-head"><div><span><Sparkles size={15}/>班长智能宣讲助手</span><h2>今日班前会宣讲稿</h2><p>系统已结合昨日指标、今日目标、重点人员及质检问题生成</p></div><div className="script-head-status"><b><CheckCircle2 size={14}/>{scriptGenerating?'正在组织内容':'内容已生成'}</b><button aria-label="关闭宣讲稿" onClick={()=>setScriptOpen(false)}><X size={20}/></button></div></header>
   {scriptGenerating?<div className="script-generating"><div className="script-loader"><Sparkles size={26}/></div><h3>正在生成班前会宣讲内容</h3><p>汇总昨日达成 · 匹配今日目标 · 识别重点人员 · 整理业务提醒</p><div><i></i></div></div>:<div className="script-workbench-body">
    <aside className="script-section-nav"><div className="script-summary-card"><span>预计宣讲时长</span><strong>约 15 分钟</strong><small>5 个环节 · {editableScript.reduce((total,section)=>total+section.text.length,0)} 字</small></div><nav>{editableScript.map((section,index)=><button className={activeScriptIndex===index?'active':''} key={section.label} onClick={()=>setActiveScriptIndex(index)}><b>{String(index+1).padStart(2,'0')}</b><span><strong>{section.label}</strong><small>{agenda[index]?.tag}</small></span><ChevronRight size={15}/></button>)}</nav><div className="script-source-note"><Database size={16}/><div><strong>本次数据依据</strong><span>昨日运营日报、质检记录、人员表现及今日业务通知</span></div></div></aside>
    <main className="script-editor"><div className="script-editor-toolbar"><div><span>第 {activeScriptIndex+1} 环节</span><h3>{editableScript[activeScriptIndex]?.label}</h3></div><em><Edit3 size={13}/>内容可编辑</em></div><textarea aria-label={`${editableScript[activeScriptIndex]?.label}宣讲内容`} value={editableScript[activeScriptIndex]?.text||''} onChange={event=>updateScriptSection(activeScriptIndex,event.target.value)}/><div className="script-speaking-tip"><MessageSquareText size={17}/><div><strong>宣讲提示</strong><p>{activeScriptIndex===0?'语速放缓，先观察团队状态，再进入数据复盘。':activeScriptIndex===4?'表扬具体到行为；辅导事项只讲动作，不做公开负向评价。':'关键数字适当停顿，确保团队听清目标与要求。'}</p></div></div><div className="script-preview-strip"><span>班长视角预览</span><p>{editableScript[activeScriptIndex]?.text}</p></div></main>
   </div>}
   {!scriptGenerating&&<footer className="script-workbench-footer"><div><button className="secondary" onClick={generateScript}><RefreshCw size={15}/>重新生成</button><button className="secondary" onClick={copyScript}><ClipboardCheck size={15}/>复制全文</button></div><button className="primary" disabled={startedAt!==null} onClick={()=>{const start=Date.now();setStartedAt(start);setNowTick(start);notify('已进入照稿宣讲模式，会议开始计时')}}><Play size={15}/>{startedAt!==null?'会议已开始':'确认内容并开始会议'}</button></footer>}
  </section></div>}
 </>
}

function TeamPage({role,notify,realData,busy,run}:{role:Role;notify:(s:string)=>void;realData:RealDataState|null;busy:boolean;run:WorkflowRunner}){
 const [sort,setSort]=useState<'risk'|'achievement'>('risk')
 if(realData?.team.members.length)return <LiveTeamPage data={realData} role={role} sort={sort} setSort={setSort} busy={busy} run={run} notify={notify}/>
 const targetProfiles:Record<string,{response:number;cph:number;satisfaction:number;busyRest:number;sales:number;conversion:number;marketingAmount:number;talent:'重点员工'|'潜力员工'|'标杆员工'|'稳定员工';summary:string}> = {
  JR10381:{response:90,cph:15.5,satisfaction:97.5,busyRest:10,sales:7,conversion:18,marketingAmount:7200,talent:'稳定员工',summary:'服务与产能均达标，营销转化仍有提升空间；建议在高峰后补充二次营销触达。'},
  JR10822:{response:85,cph:15,satisfaction:97.2,busyRest:11,sales:6,conversion:16,marketingAmount:6100,talent:'稳定员工',summary:'整体表现稳定，满意率达标；小休略高于个人目标，注意非通话时长管理。'},
  JR10913:{response:82,cph:14,satisfaction:96.5,busyRest:13,sales:5,conversion:14,marketingAmount:4800,talent:'重点员工',summary:'产能、满意率及小休均未达个人目标，营销承接偏弱；今日优先跟岗并复盘客户异议处理。'},
  JR11005:{response:68,cph:11.5,satisfaction:96,busyRest:14,sales:3,conversion:10,marketingAmount:2800,talent:'重点员工',summary:'新人产能接近成长目标，满意率尚可；营销开口率不足，安排优秀录音学习和一对一带教。'},
  JR10776:{response:84,cph:14.5,satisfaction:97,busyRest:11,sales:6,conversion:15,marketingAmount:5600,talent:'潜力员工',summary:'服务质量接近目标且小休控制良好，产能存在小幅Gap；具备营销潜力，可增加高意向客群分配。'},
  JR10691:{response:95,cph:16,satisfaction:97.8,busyRest:9,sales:8,conversion:19,marketingAmount:7800,talent:'标杆员工',summary:'产能、服务和营销全面超目标，是班组均衡标杆；建议分享需求识别和自然营销话术。'},
  JR11142:{response:48,cph:9.5,satisfaction:96.5,busyRest:12,sales:2,conversion:8,marketingAmount:1800,talent:'潜力员工',summary:'新人满意率和小休控制达标，产能成长趋势积极；可逐步增加营销场景练习，重点保护服务体验。'},
  JR10554:{response:88,cph:15,satisfaction:97.5,busyRest:10,sales:7,conversion:17,marketingAmount:6600,talent:'稳定员工',summary:'各项服务指标稳定达标，营销完成度接近目标；建议强化高价值产品推荐，提高单均营销贡献。'},
 }
 const marketingActual:Record<string,{sales:number;conversion:number;amount:number}> = {
  JR10381:{sales:6,conversion:16.7,amount:6580},JR10822:{sales:6,conversion:17.1,amount:6320},JR10913:{sales:2,conversion:7.4,amount:2140},JR11005:{sales:2,conversion:8.7,amount:1960},
  JR10776:{sales:5,conversion:14.7,amount:5230},JR10691:{sales:10,conversion:22.2,amount:9340},JR11142:{sales:2,conversion:9.5,amount:1880},JR10554:{sales:7,conversion:18.4,amount:7180},
 }
 const people=members.map(member=>{
  const target=targetProfiles[member.id]
  const marketing=marketingActual[member.id]
  const checks=[member.response>=target.response,member.cph>=target.cph,member.satisfaction>=target.satisfaction,member.busyRest<=target.busyRest,marketing.sales>=target.sales,marketing.conversion>=target.conversion]
  return {...member,target,marketing,achievement:Math.round(checks.filter(Boolean).length/checks.length*100),metCount:checks.filter(Boolean).length}
 })
 const sorted=useMemo(()=>[...people].sort((a,b)=>sort==='risk'?((a.risk==='critical'?0:a.risk==='warning'?1:2)-(b.risk==='critical'?0:b.risk==='warning'?1:2)):b.achievement-a.achievement),[sort])
 const metricAchievement=[
  {name:'应答量',value:people.filter(item=>item.response>=item.target.response).length},
  {name:'CPH',value:people.filter(item=>item.cph>=item.target.cph).length},
  {name:'满意率',value:people.filter(item=>item.satisfaction>=item.target.satisfaction).length},
  {name:'小休',value:people.filter(item=>item.busyRest<=item.target.busyRest).length},
  {name:'营销单量',value:people.filter(item=>item.marketing.sales>=item.target.sales).length},
  {name:'营销转化',value:people.filter(item=>item.marketing.conversion>=item.target.conversion).length},
 ]
 const totalSales=people.reduce((sum,item)=>sum+item.marketing.sales,0)
 const salesTarget=people.reduce((sum,item)=>sum+item.target.sales,0)
 const totalAmount=people.reduce((sum,item)=>sum+item.marketing.amount,0)
 const averageConversion=people.reduce((sum,item)=>sum+item.marketing.conversion,0)/people.length
 const teamChart=people.map(item=>({name:item.name,value:item.achievement,talent:item.target.talent}))
 const actionMembers:TeamActionMember[]=people.map(item=>({
  jobNo:item.id,name:item.name,team:'普通客服一区·8班',stage:item.stage,dataDate:'演示数据',
  responses:{actual:item.response,target:item.target.response},cph:{actual:item.cph,target:item.target.cph},
  workHours:{actual:Number((item.response/item.cph).toFixed(2)),target:Number((item.target.response/item.target.cph).toFixed(2))},
  utilization:{actual:null,target:null},handleTime:{actual:null,target:null},busyRest:{actual:item.busyRest,target:item.target.busyRest},
  sourceImpacts:{workHours:null,utilization:null,talkTime:null,afterCall:null,busyRest:null},
 }))
 return <><PageHead eyebrow="目标管理 · 服务与营销双轮驱动" title={`${members.length}个人，每个人都有自己的目标刻度`} desc="河北回流10010服务指标与营销指标统一管理，用个人目标衡量达成、识别潜力与重点员工。" actions={<><TeamActionTools members={actionMembers} role={role} busy={busy} run={run} notify={notify}/><button className="secondary" onClick={()=>setSort(sort==='risk'?'achievement':'risk')}><BarChart3 size={16}/>按{sort==='risk'?'综合达成':'风险'}排序</button></>}/>
  <section className="team-marketing-strip">
   <div className="marketing-heading"><div><span>河北回流 10010 · 营销通报</span><h2>服务做好，更要抓住每一次营销机会</h2><p>统计口径：昨日有效营销办理及回流转化，当前为拟定演示数据。</p></div><b>重点指标</b></div>
   <article><span>营销办理量</span><strong>{totalSales}<small>单</small></strong><p>目标 {salesTarget}单</p><em className={totalSales>=salesTarget?'good':'risk'}>{Math.round(totalSales/salesTarget*100)}% 达成</em></article>
   <article><span>营销转化率</span><strong>{averageConversion.toFixed(1)}<small>%</small></strong><p>班组目标 16.0%</p><em className={averageConversion>=16?'good':'risk'}>{averageConversion>=16?'达标':'需提升'}</em></article>
   <article><span>营销贡献金额</span><strong>{(totalAmount/10000).toFixed(2)}<small>万</small></strong><p>目标 4.30万</p><em className={totalAmount>=43000?'good':'risk'}>{totalAmount>=43000?'超目标':'追赶中'}</em></article>
   <article><span>营销达标人数</span><strong>{people.filter(item=>item.marketing.sales>=item.target.sales).length}<small> / {people.length}人</small></strong><p>按个人营销目标计算</p><em className="risk">重点提升 3人</em></article>
  </section>
  <div className="team-chart-grid">
   <section className="panel team-achievement-chart"><div className="panel-head"><div><span>班组目标达成</span><h2>各指标达成人数</h2></div><em>共 {people.length} 人</em></div><div className="team-chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={metricAchievement} margin={{top:8,right:8,left:-25,bottom:0}}><CartesianGrid stroke="#e8eef4" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#687c91'}}/><YAxis domain={[0,8]} allowDecimals={false} axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#8795a5'}}/><Tooltip formatter={(value)=>[`${value}人`,'达成人数']} contentStyle={{fontSize:10,borderRadius:7}}/><Bar dataKey="value" radius={[4,4,0,0]} fill="#1677b8"/></BarChart></ResponsiveContainer></div></section>
   <section className="panel team-person-chart"><div className="panel-head"><div><span>人员综合达成</span><h2>个人六项指标达成率</h2></div><div className="talent-legend"><i className="potential"></i>潜力<i className="focus"></i>重点<i className="normal"></i>其他</div></div><div className="team-chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={teamChart} margin={{top:8,right:8,left:-18,bottom:0}}><CartesianGrid stroke="#e8eef4" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#687c91'}}/><YAxis domain={[0,100]} axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#8795a5'}}/><Tooltip formatter={(value)=>[`${value}%`,'综合达成率']} contentStyle={{fontSize:10,borderRadius:7}}/><ReferenceLine y={80} stroke="#e49a36" strokeDasharray="4 3"/><Bar dataKey="value" radius={[4,4,0,0]}>{teamChart.map(item=><Cell key={item.name} fill={item.talent==='重点员工'?'#e76464':item.talent==='潜力员工'?'#e9a23b':item.talent==='标杆员工'?'#15946f':'#58a3d1'}/>)}</Bar></BarChart></ResponsiveContainer></div></section>
  </div>
  <section className="panel team-target-panel"><div className="team-target-head"><div><span>员工目标管理明细</span><h2>实际值对比个人目标值</h2></div><div><b className="talent-tag potential">潜力员工 {people.filter(item=>item.target.talent==='潜力员工').length}</b><b className="talent-tag focus">重点员工 {people.filter(item=>item.target.talent==='重点员工').length}</b></div></div><div className="team-target-scroll"><div className="team-target-table team-target-columns"><span>员工 / 人才标记</span><span>状态</span><span>应答量 / 目标</span><span>CPH / 目标</span><span>满意率 / 目标</span><span>小休 / 上限</span><span>营销量 / 目标</span><span>转化率 / 目标</span><span>综合达成</span><span>文字诊断总结</span></div>{sorted.map(item=><div className={`team-target-row ${item.target.talent==='重点员工'?'focus-row':item.target.talent==='潜力员工'?'potential-row':''}`} key={item.id}><div className="person"><span>{item.name.slice(0,1)}</span><div><strong>{item.name}</strong><small>{item.id} · {item.stage}</small><b className={`talent-tag ${item.target.talent==='重点员工'?'focus':item.target.talent==='潜力员工'?'potential':item.target.talent==='标杆员工'?'benchmark':'steady'}`}>{item.target.talent}</b></div></div><span className={`staff-status ${item.status}`}>{statusMap[item.status]}</span><TargetValue actual={item.response} target={item.target.response}/><TargetValue actual={item.cph} target={item.target.cph}/><TargetValue actual={item.satisfaction} target={item.target.satisfaction} suffix="%"/><TargetValue actual={item.busyRest} target={item.target.busyRest} suffix="%" reverse/><TargetValue actual={item.marketing.sales} target={item.target.sales} suffix="单"/><TargetValue actual={item.marketing.conversion} target={item.target.conversion} suffix="%"/><div className={`person-achievement ${item.achievement>=80?'good':item.achievement>=50?'risk':'bad'}`}><strong>{item.achievement}%</strong><span>{item.metCount}/6项达成</span></div><p className="person-summary">{item.target.summary}</p></div>)}</div></section>
 </>
}

function LiveTeamPage({data,role,sort,setSort,busy,run,notify}:{data:RealDataState;role:Role;sort:'risk'|'achievement';setSort:(value:'risk'|'achievement')=>void;busy:boolean;run:WorkflowRunner;notify:(text:string)=>void}){
 const members=data.team.members
 const score=(member:(typeof members)[number])=>{
  const values=Object.values(member.metrics)
  const comparable=values.filter(item=>item.status!=='unknown')
  return comparable.length?Math.round(comparable.filter(item=>item.status==='met').length/comparable.length*100):0
 }
 const sorted=[...members].sort((a,b)=>sort==='risk'?Number(b.flags.focus)-Number(a.flags.focus)||score(a)-score(b):score(b)-score(a))
 const metricKeys=['responses','cph','satisfaction','fcr','busyRest','repeatCall'] as const
 const chart=metricKeys.map(key=>({name:members[0]?.metrics[key].label||key,value:members.filter(item=>item.metrics[key].status==='met').length}))
 const peopleChart=members.slice(0,16).map(item=>({name:item.name,value:score(item),talent:item.flags.focus?'重点员工':item.flags.potential?'潜力员工':'其他'}))
 const marketingTotal=data.team.marketing.broadband.result+data.team.marketing.package.result
 const value=(metric:LiveMember['metrics'][keyof LiveMember['metrics']])=>metric.actual==null?'—':`${metric.actual.toLocaleString('zh-CN')}${metric.unit}`
 const target=(metric:LiveMember['metrics'][keyof LiveMember['metrics']])=>metric.target==null?'未配置':`${metric.direction==='lower'?'≤':''}${metric.target.toLocaleString('zh-CN')}${metric.unit}`
 const actionMembers:TeamActionMember[]=members.map(member=>({
  jobNo:member.jobNo,name:member.name,team:member.team,stage:member.stage,dataDate:member.dataDate,
  responses:{actual:member.metrics.responses.actual,target:member.metrics.responses.target},
  cph:{actual:member.metrics.cph.actual,target:member.metrics.cph.target},
  workHours:{actual:member.productivityDrivers.workHours.actual,target:member.productivityDrivers.workHours.target},
  utilization:{actual:member.productivityDrivers.utilization.actual,target:member.productivityDrivers.utilization.target},
  handleTime:{actual:member.productivityDrivers.handleTime.actual,target:member.productivityDrivers.handleTime.target},
  busyRest:{actual:member.productivityDrivers.busyRest.actual,target:member.productivityDrivers.busyRest.target},
  sourceImpacts:member.productivityDrivers.sourceImpacts,
 }))
 return <><PageHead eyebrow="真实数据 · 员工个人目标管理" title={`${members.length}名员工，按每个人自己的目标看达成`} desc={`产能、质量和营销统一通报。数据截至 ${members[0]?.dataDate||'—'}；${data.meta.warning}`} actions={<><TeamActionTools members={actionMembers} role={role} busy={busy} run={run} notify={notify}/><button className="secondary" onClick={()=>setSort(sort==='risk'?'achievement':'risk')}><BarChart3 size={16}/>按{sort==='risk'?'综合达成':'风险'}排序</button></>}/>
  <div className="live-data-scope"><Database size={16}/><div><strong>{data.meta.scopeLabel}</strong><span>来源：{data.meta.sourceSchema}.bpo_dws_base_pord_sum · 每名员工保留独立目标值和Gap判断</span></div></div>
  <section className="team-marketing-strip"><div className="marketing-heading"><div><span>营销真实数据通报</span><h2>宽带与流量包结果已纳入班组看数</h2><p>来源：f_sh_yx_kd、f_sh_yx_llb；当前源库为上海测试数据范围。</p></div><b>真实库</b></div><article><span>宽带营销结果</span><strong>{data.team.marketing.broadband.result.toLocaleString('zh-CN')}</strong><p>账期 {data.team.marketing.broadband.period}</p><em className="good">{data.team.marketing.broadband.rowsCount}条事实</em></article><article><span>流量包营销结果</span><strong>{data.team.marketing.package.result.toLocaleString('zh-CN')}</strong><p>账期 {data.team.marketing.package.period}</p><em className="good">{data.team.marketing.package.rowsCount}条事实</em></article><article><span>营销结果合计</span><strong>{marketingTotal.toLocaleString('zh-CN')}</strong><p>宽带 + 流量包</p><em>按源表口径汇总</em></article><article><span>潜力 / 重点员工</span><strong>{members.filter(item=>item.flags.potential).length} / {members.filter(item=>item.flags.focus).length}</strong><p>按个人目标达成识别</p><em className="risk">需班长跟进</em></article></section>
  <div className="team-chart-grid"><section className="panel team-achievement-chart"><div className="panel-head"><div><span>班组目标达成</span><h2>各指标达成人数</h2></div><em>共 {members.length} 人</em></div><div className="team-chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{top:8,right:8,left:-25,bottom:0}}><CartesianGrid stroke="#e8eef4" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#687c91'}}/><YAxis allowDecimals={false} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="value" radius={[4,4,0,0]} fill="#1677b8"/></BarChart></ResponsiveContainer></div></section><section className="panel team-person-chart"><div className="panel-head"><div><span>人员综合达成</span><h2>个人指标达成率</h2></div></div><div className="team-chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={peopleChart}><CartesianGrid stroke="#e8eef4" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:9}}/><YAxis domain={[0,100]}/><Tooltip/><Bar dataKey="value" radius={[4,4,0,0]}>{peopleChart.map(item=><Cell key={item.name} fill={item.talent==='重点员工'?'#e76464':item.talent==='潜力员工'?'#e9a23b':'#58a3d1'}/>)}</Bar></BarChart></ResponsiveContainer></div></section></div>
  <section className="panel team-target-panel"><div className="team-target-head"><div><span>真实库员工目标明细</span><h2>实际值、个人目标、Gap与描述性总结</h2></div><div><b className="talent-tag potential">潜力员工 {members.filter(item=>item.flags.potential).length}</b><b className="talent-tag focus">重点员工 {members.filter(item=>item.flags.focus).length}</b></div></div><div className="team-target-scroll"><table className="live-team-table"><thead><tr><th>员工 / 标记</th>{metricKeys.map(key=><th key={key}>{members[0]?.metrics[key].label}</th>)}<th>营销</th><th>诊断说明</th></tr></thead><tbody>{sorted.map(item=><tr className={item.flags.focus?'focus-row':item.flags.potential?'potential-row':''} key={item.jobNo}><td><strong>{item.name}</strong><small>{item.jobNo} · {item.stage}<br/>{item.team}</small>{item.flags.focus&&<b className="talent-tag focus">重点员工</b>}{item.flags.potential&&<b className="talent-tag potential">潜力员工</b>}</td>{metricKeys.map(key=>{const itemMetric=item.metrics[key];return <td key={key}><strong>{value(itemMetric)}</strong><small>目标 {target(itemMetric)}</small><em className={itemMetric.status}>{itemMetric.status==='met'?'达标':itemMetric.status==='attention'?`Gap ${itemMetric.gap??'—'}`:'待确认'}</em></td>})}<td><strong>{item.marketing.volume}</strong><small>有效 {item.marketing.valid}</small></td><td><p>{item.summary}</p></td></tr>)}</tbody></table></div></section>
 </>
}

function TargetValue({actual,target,suffix='',reverse=false}:{actual:number;target:number;suffix?:string;reverse?:boolean}){
 const met=reverse?actual<=target:actual>=target
 return <div className={`target-value ${met?'met':'miss'}`}><strong>{actual}{suffix}</strong><small>{reverse?'上限':'目标'} {target}{suffix}</small><em>{met?'达标':'Gap'}</em></div>
}

function workflowTaskStatus(status:string,verificationRole?:string){return status==='pending_verification'&&verificationRole==='quality'?'待质检复检':status==='pending_verification'&&verificationRole==='employee'?'待员工确认':status==='returned_to_leader'&&verificationRole==='quality'?'质检退回班长整改':status==='returned_to_leader'&&verificationRole==='employee'?'员工反馈未解决':({todo:'待执行',doing:'执行中',pending_verification:'待上级验收',closed:'已关闭',escalated:'已升级',executive_escalated:'公司级专项督办',returned_to_supervisor:'经理指导退回主管',returned_to_leader:'主管退回班长整改',returned_to_origin:'验收退回整改'} as Record<string,string>)[status]||status}
function workflowEventStatus(status:string){return ({pending_supervisor_review:'待主管确认',approved:'已形成任务',rejected:'已驳回',closed:'已闭环'} as Record<string,string>)[status]||status}
const fmtTime=(v:string)=>new Date(v).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})

function WorkflowCenter({role,state,error,busy,selectedId,setSelectedId,run}:{role:Role;state:WorkflowState|null;error:string;busy:boolean;selectedId:string;setSelectedId:(id:string)=>void;run:WorkflowRunner}){
 const [eventFilter,setEventFilter]=useState('全部')
 const filteredEvents=state?.events.filter(event=>eventFilter==='全部'||event.type===eventFilter)||[]
 const current=filteredEvents.find(e=>e.id===(selectedId||filteredEvents[0]?.id))||filteredEvents[0]
 if(error)return <ServiceUnavailable error={error}/>
 if(!state)return <div className="workflow-loading"><RefreshCw size={21}/><span>正在连接本地业务服务...</span></div>
 const canReview=role==='supervisor'
 return <><PageHead eyebrow={`动态业务闭环 · 半小时批次 #${state.meta.batchNo}`} title="四类预警主管确认台" desc="规则生成预警后不会直接下发班长，必须由主管确认；确认后才生成PDCA任务。" actions={<><button className="secondary" disabled={busy} onClick={()=>run(workflowApi.reset,'演示数据已重置')}><RefreshCw size={15}/>重置演示</button><button className="primary" disabled={busy} onClick={()=>run(workflowApi.refresh,'半小时数据刷新完成')}><Database size={15}/>执行半小时刷新</button></>}/><div className="workflow-meta"><span><i></i>API已连接</span><span>最后刷新 {fmtTime(state.meta.lastRefresh)}</span><span>下次刷新 {fmtTime(state.meta.nextRefresh)}</span><span>规则：员工/话务/投诉/质量</span></div><div className="workflow-grid"><section className="panel workflow-event-list"><div className="workflow-filter">{['全部','员工异常','话务异常','投诉超时','质量趋势'].map(x=><button key={x} className={eventFilter===x?'active':''} onClick={()=>setEventFilter(x)}>{x}</button>)}</div>{filteredEvents.length?filteredEvents.map(e=><button key={e.id} className={current?.id===e.id?'selected':''} onClick={()=>setSelectedId(e.id)}><span className={`sev-dot ${e.severity}`}></span><div><header><strong>{e.type}</strong><em>{workflowEventStatus(e.status)}</em></header><h3>{e.title}</h3><p>{e.team} · 截止 {fmtTime(e.dueAt)}</p></div><ChevronRight size={15}/></button>):<div className="filter-empty">当前分类暂无预警</div>}</section><section className="panel workflow-event-detail">{current&&<><header><div><span className={`severity ${current.severity}`}>{current.severity==='critical'?'紧急':'关注'}</span><small>{current.id} · {current.rule}</small></div><b>{workflowEventStatus(current.status)}</b></header><h2>{current.title}</h2><p className="evidence">{current.evidence}</p><div className="workflow-evidence"><div><span>数据来源</span><strong>{current.source}</strong></div><div><span>责任组织</span><strong>{current.team}</strong></div><div><span>主管审批人</span><strong>{current.reviewer}</strong></div><div><span>SLA截止</span><strong>{fmtTime(current.dueAt)}</strong></div></div><div className="workflow-suggestion"><Bot size={20}/><div><strong>系统处置建议</strong><p>{current.suggestion}</p></div></div><div className="workflow-history"><h3>事件轨迹</h3>{current.history.map((h,i)=><div key={i}><span></span><time>{fmtTime(h.at)}</time><strong>{h.actor}</strong><p>{h.action}</p></div>)}</div>{current.status==='pending_supervisor_review'&&<footer>{canReview?<><button className="secondary" onClick={()=>run(()=>workflowApi.review(current.id,'reject','数据证据不足，退回规则复核'),'预警已驳回并记录审计')}><X size={15}/>驳回</button><button className="primary" onClick={()=>run(()=>workflowApi.review(current.id,'approve','确认异常，按建议动作下发'),'主管已确认，PDCA任务已生成')}><CheckCircle2 size={15}/>确认并下发任务</button></>:<div className="review-lock"><LockKeyhole size={16}/>当前岗位无审批权限，请切换“客服主管”完成确认</div>}</footer>}</>}</section></div></>
}

function WorkflowTasksPage({role,state,error,busy,run,notify}:{role:Role;state:WorkflowState|null;error:string;busy:boolean;run:WorkflowRunner;notify:(text:string)=>void}){
 const [evidence,setEvidence]=useState('已完成1V1问题复盘与规范辅导，并抽取2通新录音作为改善证据。')
 const [verificationComment,setVerificationComment]=useState('')
 const [selectedTaskId,setSelectedTaskId]=useState('')
 if(error)return <ServiceUnavailable error={error}/>
 if(!state)return <div className="workflow-loading"><RefreshCw size={21}/><span>正在加载持久化任务...</span></div>
 const roleTasks=state.tasks.filter(task=>workflowTaskVisibleForRole(task,role))
 const task=roleTasks.find(item=>item.id===selectedTaskId)
 const isQualityTask=task?.verificationRole==='quality'
 const isEmployeeSupport=task?.verificationRole==='employee'
 const isAiTask=task?.workflowKind==='ai_action'
 const isMeetingTask=task?.workflowKind==='meeting_action'
 const isLeanTask=task?.workflowKind==='lean_directive'
 const canEscalate=!!task&&!task.verificationRole&&task.status!=='closed'&&task.ownerRole===role&&['leader','supervisor','manager'].includes(role)
 const nextRole=task?({leader:'客服主管',supervisor:'客服经理',manager:'运营总监'} as Record<string,string>)[task.ownerRole]:''
 const act=(action:string,actionRole:string,message:string,payload:Record<string,string>={})=>task&&run(()=>workflowApi.taskAction(task.id,actionRole,action,payload),message)
 const roleLabels=({leader:'客服班长',supervisor:'客服主管',manager:'客服经理',director:'运营总监',quality:'质检专员',employee:'客服专员',training:'培训主管',hrbp:'HRBP经理'} as Record<string,string>)
 const responsibility=task?roleLabels[task.ownerRole]||task.ownerRole:''
 const verificationLabel=task?roleLabels[task.verificationRole||'supervisor']||task.verificationRole:''
 return <>
  <PageHead eyebrow="真实状态机 · 刷新不丢失" title={role==='quality'?'质检协同复检中心':role==='employee'?'我的支持请求':'PDCA动态任务中心'} desc={role==='quality'?'接收班长辅导证据，复检通过后闭环；未通过则退回班长继续整改。':role==='employee'?'查看班长处理结果，确认问题是否真正解决；未解决可带着补充说明退回。':'第一层查看任务统计与风险，点击任务单后在第二层完成执行、验证和闭环。'}/>
  <LeanPdcaDashboard role={role} state={state} busy={busy} run={run} notify={notify} onOpenTask={setSelectedTaskId}/>
  {task&&<div className="workflow-task-modal-shade" onMouseDown={()=>setSelectedTaskId('')}>
   <section className="workflow-task-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-task-modal-title" onMouseDown={event=>event.stopPropagation()}>
    <header className="workflow-task-modal-head"><div><span>{task.sourceLabel||task.type} · {task.id}</span><h2 id="workflow-task-modal-title">{task.title}</h2><p>任务单详情与执行操作 · 当前责任岗位：{responsibility}</p></div><div>{canEscalate&&<button className="workflow-task-timeout" disabled={busy} onClick={()=>run(()=>workflowApi.simulateTimeout(role),`已模拟SLA逾期，任务升级至${nextRole}`)}><Clock3 size={15}/>模拟逾期→{nextRole}</button>}<button type="button" aria-label="关闭任务详情" onClick={()=>setSelectedTaskId('')}><X size={20}/></button></div></header>
    <div className="workflow-task-modal-body">
     <div className="workflow-stagebar">{[['P',isLeanTask?'问题定位与目标':isAiTask?'AI建议确认':isMeetingTask?'会议下发':'问题触发'],['D',isLeanTask?`${roleLabels[task.executionOwnerRole||'']}执行`:isAiTask?`${roleLabels[task.originRole||role]}执行`:isMeetingTask?'责任岗位执行':'班长响应'],['C',isLeanTask?'系统数据辅助验证':isMeetingTask?'总监验收':isAiTask?`${verificationLabel}验收`:isQualityTask?'质检复检':isEmployeeSupport?'员工确认':'主管验证'],['A',isLeanTask?'固化标准与关闭':'关闭/升级']].map(step=><div className={task.phase===step[0]||step[0]==='P'?'active':''} key={step[0]}><b>{step[0]}</b><span>{step[1]}</span></div>)}</div>
     <TaskComments task={task} role={role} busy={busy} run={run}/>
     <div className="workflow-task-grid">
   <section className="panel task-case">
    <header><div><span>{task.sourceLabel||task.type} · {task.id}</span><h2>{task.title}</h2></div><em className={task.status}>{workflowTaskStatus(task.status,task.verificationRole)}</em></header>
    <div className="task-case-meta"><div><span>当前责任岗位</span><strong>{responsibility}</strong></div><div><span>执行责任人</span><strong>{task.owner}</strong></div><div><span>{isQualityTask?'班长反馈截止':'截止时间'}</span><strong>{fmtTime(task.dueAt)}</strong></div><div><span>任务进度</span><strong>{task.progress}%</strong></div></div>
    <div className="task-case-progress"><i style={{width:`${task.progress}%`}}></i></div>
    <LeanTaskBrief task={task}/>
    <LeanTaskNodes task={task}/>
    {task.requirement&&<div className={`quality-task-brief ${isEmployeeSupport?'employee-support-brief':''} ${isAiTask?'ai-task-brief':''}`}><MessageSquareText size={18}/><div><span>{isAiTask?'AI识别的问题与差距':isEmployeeSupport?'员工支持诉求':'质检协同要求'}</span><strong>{task.requirement}</strong>{isAiTask&&<p>目标值：{task.target}</p>}<p>完成标准：{task.successCriteria}</p>{isAiTask&&task.aiRationale&&<small>优先依据：{task.aiRationale}</small>}</div></div>}
    {isMeetingTask&&<div className="quality-task-brief ai-task-brief"><FileBarChart size={18}/><div><span>经营例会行动目标</span><strong>{task.target}</strong><p>由{task.owner}执行，运营总监对照目标验收。</p></div></div>}
    <div className="task-execution"><h3>执行与验证</h3>
     {isMeetingTask&&task.status==='todo'&&<><p className="task-step-copy">该行动来自已归档经营会议，请责任岗位确认目标和截止时间后开始执行。</p><button className="primary" disabled={role!==task.ownerRole||busy} onClick={()=>{setEvidence(`已围绕“${task.target}”完成执行，结果与证据如下：`);act('meeting_start',role,'经营例会行动已开始执行')}}><Play size={15}/>接收并开始执行</button></>}
     {isMeetingTask&&['doing','returned_to_origin'].includes(task.status)&&<div className="ai-task-execution">{task.status==='returned_to_origin'&&<div className="guidance-card"><strong>总监退回意见</strong><p>{task.supervisorGuidance}</p></div>}<textarea value={evidence} onChange={event=>setEvidence(event.target.value)} placeholder="填写执行动作、结果数据、证据位置和后续监控安排"/><button className="primary" disabled={role!==task.ownerRole||busy||evidence.trim().length<10} onClick={()=>act('meeting_submit',role,'经营例会行动已提交总监验收',{evidence})}>提交总监验收</button></div>}
    {isMeetingTask&&task.status==='pending_verification'&&<div className="verify-actions ai-verification"><div><strong>责任岗位执行结果</strong><p>{task.evidence}</p><small>会议目标：{task.target}</small></div><textarea value={verificationComment} onChange={event=>setVerificationComment(event.target.value)} placeholder="对照会议目标填写总监验收结论"/><button className="secondary" disabled={role!=='director'||busy} onClick={()=>act('meeting_verify_fail','director','经营例会行动未达标，已退回责任岗位',{comment:verificationComment||'结果数据尚不能证明会议目标达成，请补充动作和证据'})}>未达标，退回补充</button><button className="primary" disabled={role!=='director'||busy} onClick={()=>act('meeting_verify_success','director','经营例会行动已验收闭环',{comment:verificationComment||'执行结果符合会议目标，验收通过'})}>验收通过并关闭</button></div>}
     {isLeanTask&&<LeanTaskActions task={task} role={role} busy={busy} run={run}/>}
     {isAiTask&&task.status==='todo'&&<><p className="task-step-copy">该行动由你确认后进入PDCA。请核对目标、责任人和截止时间，再开始执行。</p><button className="primary" disabled={role!==task.originRole||busy} onClick={()=>{setEvidence(`已围绕“${task.target}”完成行动，执行结果如下：`);act('ai_start',role,'AI行动已开始执行')}}><Play size={15}/>开始执行AI行动</button></>}
     {isAiTask&&['doing','returned_to_origin'].includes(task.status)&&<div className="ai-task-execution">{task.status==='returned_to_origin'&&<div className="guidance-card"><strong>{verificationLabel}退回意见</strong><p>{task.supervisorGuidance}</p></div>}<textarea value={evidence} onChange={event=>setEvidence(event.target.value)} placeholder="填写完成动作、结果数据、证据位置和下一步监控安排"/><button className="primary" disabled={role!==task.originRole||busy||!evidence.trim()} onClick={()=>act('ai_submit',role,`执行证据已提交${verificationLabel}验收`,{evidence})}>提交{verificationLabel}验收</button></div>}
     {isAiTask&&task.status==='pending_verification'&&<div className="verify-actions ai-verification"><div><strong>{roleLabels[task.originRole||'']}提交的执行证据</strong><p>{task.evidence}</p><small>目标：{task.target} · 达成标准：{task.successCriteria}</small></div><textarea value={verificationComment} onChange={event=>setVerificationComment(event.target.value)} placeholder="对照目标和达成标准填写验收结论"/><button className="secondary" disabled={role!==task.verificationRole||busy} onClick={()=>act('ai_verify_fail',role,`验收未通过，已退回${roleLabels[task.originRole||'']}整改`,{comment:verificationComment||'当前证据不足以证明目标达成，请补充结果数据和验证材料'})}>未达标，退回整改</button><button className="primary" disabled={role!==task.verificationRole||busy} onClick={()=>act('ai_verify_success',role,'AI行动验收通过并闭环',{comment:verificationComment||'执行证据符合目标与达成标准，验收通过'})}>验收通过并关闭</button></div>}
     {!isLeanTask&&!isAiTask&&!isMeetingTask&&task.status==='todo'&&<><p className="task-step-copy">{isEmployeeSupport?'员工支持请求已进入班长PDCA，请在30分钟内响应。':'协同单已进入班长PDCA，请确认任务并开始执行。'}</p><button className="primary" disabled={role!=='leader'||busy} onClick={()=>{setEvidence(isEmployeeSupport?'已与员工完成问题沟通和录音复盘，明确改进方法、下一步动作及回看时间。':'已完成1V1问题复盘与规范辅导，并抽取2通新录音作为改善证据。');act('start','leader',isEmployeeSupport?'班长已接收员工支持请求':'班长已接收协同并开始执行')}}>接收并开始处理</button></>}
     {!isLeanTask&&!isAiTask&&!isMeetingTask&&task.status==='doing'&&<><textarea value={evidence} onChange={event=>setEvidence(event.target.value)} placeholder={isEmployeeSupport?'填写处理结论、给员工的建议、下一步动作和完成时间':'填写辅导动作、录音样本和改善证据'}/><button className="primary" disabled={role!=='leader'||busy||!evidence.trim()} onClick={()=>act('submit','leader',isQualityTask?'执行证据已提交质检复检':isEmployeeSupport?'处理结果已发送员工确认':'执行证据已提交主管验证',{evidence})}>{isQualityTask?'提交质检复检':isEmployeeSupport?'回复员工并待确认':'提交执行证据'}</button></>}
     {!isLeanTask&&!isAiTask&&!isMeetingTask&&task.status==='pending_verification'&&<div className="verify-actions"><div><strong>{isEmployeeSupport?'班长处理结果':'班长提交证据'}</strong><p>{task.evidence}</p>{isQualityTask&&task.reinspectAt&&<small>计划复检：{fmtTime(task.reinspectAt)}</small>}</div>{isQualityTask?<><textarea value={verificationComment} onChange={event=>setVerificationComment(event.target.value)} placeholder="填写复检结论或退回要求"/><button className="secondary" disabled={role!=='quality'||busy} onClick={()=>act('quality_verify_fail','quality','复检未通过，协同单已退回班长整改',{comment:verificationComment||'复检仍发现同类问题，请补充辅导并重新提交2通新录音'})}>复检未通过，退回班长</button><button className="primary" disabled={role!=='quality'||busy} onClick={()=>act('quality_verify_success','quality','质检复检通过，协同单已闭环',{comment:verificationComment||'复检2通新录音均未发现同类问题，改善有效'})}>复检通过并关闭</button></>:isEmployeeSupport?<><textarea value={verificationComment} onChange={event=>setVerificationComment(event.target.value)} placeholder="填写确认说明或尚未解决的具体问题"/><button className="secondary" disabled={role!=='employee'||busy} onClick={()=>act('employee_reopen_support','employee','问题尚未解决，已退回班长继续支持',{comment:verificationComment||'当前问题尚未解决，请班长补充支持'})}>尚未解决，退回班长</button><button className="primary" disabled={role!=='employee'||busy} onClick={()=>act('employee_confirm_support','employee','已确认班长支持有效，请求关闭',{comment:verificationComment||'班长支持已解决当前问题'})}>确认已解决并关闭</button></>:<><button className="secondary" disabled={role!=='supervisor'||busy} onClick={()=>act('verify_fail','supervisor','验证未通过，任务已升级经理',{comment:'观察窗口内指标未恢复，升级客服经理'})}>未改善，升级</button><button className="primary" disabled={role!=='supervisor'||busy} onClick={()=>act('verify_success','supervisor','主管验证通过，任务已闭环',{comment:'观察窗口指标恢复，改善有效'})}>改善有效，关闭</button></>}</div>}
     {!isLeanTask&&!isAiTask&&!isMeetingTask&&task.status==='returned_to_leader'&&<div className="management-decision"><h3>{isQualityTask?'质检退回，班长重新整改':isEmployeeSupport?'员工反馈未解决，班长继续支持':'班长按指导重新整改'}</h3><div className="guidance-card"><strong>{isQualityTask?'质检复检意见':isEmployeeSupport?'员工补充说明':'主管整改要求'}</strong><p>{task.supervisorGuidance}</p></div><textarea value={evidence} onChange={event=>setEvidence(event.target.value)} placeholder={isEmployeeSupport?'补充处理方案与新的完成时间':'填写重新整改动作与执行证据'}/><button className="primary" disabled={role!=='leader'||busy} onClick={()=>act('submit','leader',isQualityTask?'重新整改证据已提交质检复检':isEmployeeSupport?'补充处理结果已发送员工确认':'重新整改证据已提交主管验证',{evidence})}>重新提交验证</button></div>}
     {task.status==='escalated'&&<div className="escalated-box"><AlertTriangle size={20}/><div><strong>任务已升级至{responsibility}</strong><p>当前责任层级可直接裁决闭环，或给出指导意见退回下一级整改。</p></div></div>}
     {task.status==='escalated'&&task.ownerRole==='manager'&&<div className="management-decision"><h3>客服经理处置</h3><textarea value={evidence} onChange={event=>setEvidence(event.target.value)} placeholder="填写经理研判或指导意见"/><div className="three-actions"><button className="escalate-action" disabled={role!=='manager'||busy} onClick={()=>act('manager_escalate','manager','任务已升级运营总监',{comment:evidence})}>升级</button><button className="secondary" disabled={role!=='manager'||busy} onClick={()=>act('manager_return','manager','经理已指导退回主管',{comment:evidence})}>退回</button><button className="primary" disabled={role!=='manager'||busy} onClick={()=>act('manager_close','manager','经理已裁决闭环',{comment:evidence})}>闭环</button></div></div>}
     {task.status==='returned_to_supervisor'&&<div className="management-decision"><h3>主管接收经理指导</h3><div className="guidance-card"><strong>经理指导意见</strong><p>{task.managerGuidance}</p></div><textarea value={evidence} onChange={event=>setEvidence(event.target.value)} placeholder="填写主管补充说明或班长整改要求"/><div><button className="secondary" disabled={role!=='supervisor'||busy} onClick={()=>act('supervisor_return_leader','supervisor','主管已按指导退回班长整改',{comment:evidence})}>退回班长整改</button><button className="primary" disabled={role!=='supervisor'||busy} onClick={()=>act('supervisor_resubmit_manager','supervisor','主管已补充说明并重新上报经理',{comment:evidence})}>补充后重新上报</button></div></div>}
     {['escalated','executive_escalated'].includes(task.status)&&task.ownerRole==='director'&&<div className="management-decision"><h3>运营总监最终裁决</h3><textarea value={evidence} onChange={event=>setEvidence(event.target.value)} placeholder="填写总监裁决意见"/><div className="three-actions"><button className="escalate-action" disabled={role!=='director'||busy} onClick={()=>act('director_escalate','director','任务已升级公司级专项督办',{comment:evidence})}>升级</button><button className="secondary" disabled={role!=='director'||busy} onClick={()=>act('director_return','director','总监已退回客服经理',{comment:evidence})}>退回</button><button className="primary" disabled={role!=='director'||busy} onClick={()=>act('director_close','director','总监已完成最终裁决闭环',{comment:evidence})}>闭环</button></div></div>}
     {task.status==='closed'&&<div className="task-closed-result"><CheckCircle2 size={24}/><div><strong>任务已完成闭环</strong><p>{task.verification||'验证通过，改善动作已完成。'}</p></div></div>}
     {task.ownerRole!==role&&task.status!=='closed'&&<small className="permission-tip">当前步骤由{responsibility}处理，本岗位可查看全程进展。</small>}
    </div>
    <TaskAttachments task={task} role={role} busy={busy} run={run} notify={notify}/>
    <TaskImprovementPanel task={task} role={role}/>
    <LeanTaskManagementPanel task={task} role={role} busy={busy} run={run}/>
   </section>
   <section className="panel task-timeline"><div className="panel-head"><div><span>全程留痕</span><h2>任务操作时间线</h2></div></div>{task.history.map((history,index)=><div className="timeline-row" key={index}><span></span><div><time>{fmtTime(history.at)}</time><strong>{history.actor}</strong><p>{history.action}</p></div></div>)}</section>
     </div>
    </div>
   </section>
  </div>}
 </>
}

function WorkflowTasksPageLegacy({role,state,error,busy,run}:{role:Role;state:WorkflowState|null;error:string;busy:boolean;run:WorkflowRunner}){
 const [evidence,setEvidence]=useState('已完成员工面谈，确认近期工作负荷偏高；安排明日1小时跟岗辅导。')
 const [selectedTaskId,setSelectedTaskId]=useState('')
 if(error)return <ServiceUnavailable error={error}/>
 if(!state)return <div className="workflow-loading"><RefreshCw size={21}/><span>正在加载持久化任务...</span></div>
 const roleTasks=role==='quality'?state.tasks.filter(task=>task.verificationRole==='quality'):role==='leader'?state.tasks.filter(task=>task.ownerRole==='leader'||task.sourceLabel==='质检协同单'):state.tasks
 const task=roleTasks.find(item=>item.id===selectedTaskId)||roleTasks.find(item=>item.status!=='closed'&&item.ownerRole===role)||roleTasks.find(item=>item.status!=='closed')||roleTasks[0]
 const canEscalate=!!task&&task.verificationRole!=='quality'&&task.status!=='closed'&&task.ownerRole===role&&['leader','supervisor','manager'].includes(role)
 const nextRole=task?({leader:'客服主管',supervisor:'客服经理',manager:'运营总监'} as Record<string,string>)[task.ownerRole]:''
 return <><PageHead eyebrow="真实状态机 · 刷新不丢失" title="PDCA动态任务中心" desc="主管确认后产生任务；班长执行并提交证据；主管验证；经理可直接闭环或指导退回；逾期逐级升级。" actions={<button className="secondary" disabled={!canEscalate||busy} title={!canEscalate?'仅当前责任岗位可发起逾期升级':`将升级至${nextRole}`} onClick={()=>run(()=>workflowApi.simulateTimeout(role),`已模拟SLA逾期，任务升级至${nextRole}`)}><Clock3 size={15}/>{canEscalate?`模拟逾期→${nextRole}`:'非当前责任岗位'}</button>}/><div className="workflow-stagebar">{[['P','规则触发'],['D','执行动作'],['C','主管验证'],['A','关闭/升级']].map((x,i)=><div className={task&&(task.phase===x[0]||(x[0]==='P'))?'active':''} key={x[0]}><b>{x[0]}</b><span>{x[1]}</span></div>)}</div>{!task?<div className="workflow-empty"><ListChecks size={35}/><h2>暂无PDCA任务</h2><p>请切换客服主管，在AI预警中心确认一条预警。</p></div>:<div className="workflow-task-grid"><section className="panel task-case"><header><div><span>{task.type}</span><h2>{task.title}</h2></div><em className={task.status}>{workflowTaskStatus(task.status)}</em></header><div className="task-case-meta"><div><span>当前责任层级</span><strong>{({leader:'客服班长',supervisor:'客服主管',manager:'客服经理',director:'运营总监'} as Record<string,string>)[task.ownerRole]}</strong></div><div><span>执行人</span><strong>{task.owner}</strong></div><div><span>截止时间</span><strong>{fmtTime(task.dueAt)}</strong></div><div><span>任务进度</span><strong>{task.progress}%</strong></div></div><div className="task-case-progress"><i style={{width:`${task.progress}%`}}></i></div><div className="task-execution"><h3>执行与验证</h3>{task.status==='todo'&&<button className="primary" disabled={role!=='leader'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'leader','start'),'班长已开始执行任务')}>班长开始执行</button>}{task.status==='doing'&&<><textarea value={evidence} onChange={e=>setEvidence(e.target.value)}/><button className="primary" disabled={role!=='leader'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'leader','submit',{evidence}),'执行证据已提交主管验证')}>提交执行证据</button></>}{task.status==='pending_verification'&&<div className="verify-actions"><div><strong>班长提交证据</strong><p>{task.evidence}</p></div><button className="secondary" disabled={role!=='supervisor'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'supervisor','verify_fail',{comment:'观察窗口内指标未恢复，升级客服经理'}),'验证未通过，任务已升级经理')}>未改善，升级</button><button className="primary" disabled={role!=='supervisor'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'supervisor','verify_success',{comment:'观察窗口指标恢复，改善有效'}),'主管验证通过，任务已闭环')}>改善有效，关闭</button></div>}{task.status==='escalated'&&<div className="escalated-box"><AlertTriangle size={20}/><div><strong>任务已升级至{({manager:'客服经理',director:'运营总监',supervisor:'客服主管'} as Record<string,string>)[task.ownerRole]||task.ownerRole}</strong><p>当前责任层级可直接裁决闭环，或给出指导意见退回下一级整改。</p></div></div>}{task.status==='escalated'&&task.ownerRole==='manager'&&<div className="management-decision"><h3>客服经理处置</h3><p>经理需要选择最终闭环，或明确指导意见退回主管继续整改。</p><textarea value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="填写经理研判或指导意见"/><div className="three-actions"><button className="escalate-action" disabled={role!=='manager'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'manager','manager_escalate',{comment:evidence}),'任务已升级运营总监')}>升级</button><button className="secondary" disabled={role!=='manager'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'manager','manager_return',{comment:evidence}),'经理已指导退回主管')}>退回</button><button className="primary" disabled={role!=='manager'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'manager','manager_close',{comment:evidence}),'经理已裁决闭环')}>闭环</button></div>{role!=='manager'&&<small className="permission-tip">当前步骤需切换“客服经理”处置</small>}</div>}{task.status==='returned_to_supervisor'&&<div className="management-decision"><h3>主管接收经理指导</h3><div className="guidance-card"><strong>经理指导意见</strong><p>{task.managerGuidance}</p></div><textarea value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="填写主管补充说明或班长整改要求"/><div><button className="secondary" disabled={role!=='supervisor'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'supervisor','supervisor_return_leader',{comment:evidence}),'主管已按指导退回班长整改')}>退回班长整改</button><button className="primary" disabled={role!=='supervisor'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'supervisor','supervisor_resubmit_manager',{comment:evidence}),'主管已补充说明并重新上报经理')}>补充后重新上报经理</button></div>{role!=='supervisor'&&<small className="permission-tip">当前步骤需切换“客服主管”处置</small>}</div>}{task.status==='returned_to_leader'&&<div className="management-decision"><h3>班长按指导重新整改</h3><div className="guidance-card"><strong>主管整改要求</strong><p>{task.supervisorGuidance}</p></div><textarea value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="填写重新整改的执行证据"/><button className="primary" disabled={role!=='leader'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'leader','submit',{evidence}),'重新整改证据已提交主管验证')}>提交重新整改证据</button>{role!=='leader'&&<small className="permission-tip">当前步骤需切换“客服班长”执行</small>}</div>}{['escalated','executive_escalated'].includes(task.status)&&task.ownerRole==='director'&&<div className="management-decision"><h3>运营总监最终裁决</h3><textarea value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="填写总监裁决意见"/><div className="three-actions"><button className="escalate-action" disabled={role!=='director'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'director','director_escalate',{comment:evidence}),'任务已升级公司级专项督办')}>升级</button><button className="secondary" disabled={role!=='director'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'director','director_return',{comment:evidence}),'总监已退回客服经理重新组织改善')}>退回</button><button className="primary" disabled={role!=='director'||busy} onClick={()=>run(()=>workflowApi.taskAction(task.id,'director','director_close',{comment:evidence}),'总监已完成最终裁决闭环')}>闭环</button></div>{role!=='director'&&<small className="permission-tip">当前步骤需切换“运营总监”处置</small>}</div>}{role!=='leader'&&task.status==='doing'&&<small className="permission-tip">当前步骤需切换“客服班长”执行</small>}{role!=='supervisor'&&task.status==='pending_verification'&&<small className="permission-tip">当前步骤需切换“客服主管”验证</small>}</div></section><section className="panel task-timeline"><div className="panel-head"><div><span>全程留痕</span><h2>任务操作时间线</h2></div></div>{task.history.map((h,i)=><div className="timeline-row" key={i}><span></span><div><time>{fmtTime(h.at)}</time><strong>{h.actor}</strong><p>{h.action}</p></div></div>)}</section></div>}</>
}

function ServiceUnavailable({error}:{error:string}){return <div className="service-unavailable"><Database size={38}/><h2>本地业务服务未启动</h2><p>{error}</p><code>npm run api</code><span>请保持API终端运行，再刷新页面。</span></div>}

function TasksPage({tasks,setTasks,notify}:{tasks:TaskItem[];setTasks:(x:TaskItem[])=>void;notify:(s:string)=>void}){const advance=(id:string)=>{setTasks(tasks.map(t=>t.id===id?{...t,progress:Math.min(100,t.progress+25),status:t.progress+25>=100?'done':'doing'}:t));notify('任务进度已更新，效果验证将在完成后自动触发')};return <><PageHead eyebrow="P → D → C → A" title="任务不关闭，管理不算完成" desc="上级指令、AI预警、班前会行动和面谈承诺，统一在这里闭环。"/><div className="kanban">{(['P','D','C','A'] as const).map(phase=><section key={phase}><header><span className={`phase ${phase}`}>{phase}</span><div><strong>{phase==='P'?'计划目标':phase==='D'?'正在执行':phase==='C'?'检查验证':'固化改进'}</strong><small>{tasks.filter(t=>t.phase===phase).length} 项</small></div></header>{tasks.filter(t=>t.phase===phase).map(t=><article key={t.id}><span>{t.source}</span><h3>{t.title}</h3><p>{t.owner}</p><div className="task-progress"><i style={{width:`${t.progress}%`}}></i></div><footer><time>{t.due}</time><button onClick={()=>advance(t.id)}>{t.progress===100?'已完成':'推进 25%'}</button></footer></article>)}</section>)}</div></>}


function GrowthPage({notify}:{notify:(s:string)=>void}){return <><PageHead eyebrow="系统触发 · 班长执行 · 效果验证" title="面谈和培训，都从真实问题出发" desc="不靠班长想起来。数据触发行动，行动完成后再看指标有没有改善。"/><div className="two-col growth-grid"><section className="panel"><div className="panel-head"><div><span>今日面谈</span><h2>系统建议 2 人</h2></div></div>{members.filter(m=>m.risk!=='normal').slice(0,2).map(m=><div className="growth-row" key={m.id}><div className="person"><span>{m.name[0]}</span><div><strong>{m.name}</strong><small>{m.stage} · {m.id}</small></div></div><p>{m.risk==='critical'?'小休超限 + 绩效连续下滑':'新人一次解决率低于成长线'}</p><button onClick={()=>notify(`已为${m.name}生成结构化面谈提纲`)}>生成提纲</button></div>)}</section><section className="panel"><div className="panel-head"><div><span>培训建议</span><h2>从差错到课程</h2></div></div>{[['续约争议四步法','3人需学习','来自重复来电归因'],['高风险投诉首次联系','预警专席全员','来自升级工单复盘'],['小休与非工状态规范','王芳','来自员工异常预警']].map(x=><div className="course-row" key={x[0]}><BookOpenCheck size={20}/><div><strong>{x[0]}</strong><small>{x[1]} · {x[2]}</small></div><button onClick={()=>notify(`课程“${x[0]}”已推送`)}>推送</button></div>)}</section></div></>}

function AiSettingsPage({actor,notify}:{actor:string;notify:(text:string)=>void}){
 const [settings,setSettings]=useState<AiSettings|null>(null)
 const [model,setModel]=useState('deepseek-v4-flash')
 const [baseUrl,setBaseUrl]=useState('https://api.deepseek.com')
 const [timeoutMs,setTimeoutMs]=useState(45000)
 const [apiKey,setApiKey]=useState('')
 const [showKey,setShowKey]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [testResult,setTestResult]=useState<null|{ok:boolean;message:string;latencyMs?:number;model?:string}>(null)
 const syncSettings=(next:AiSettings)=>{setSettings(next);setModel(next.model);setBaseUrl(next.baseUrl);setTimeoutMs(next.timeoutMs)}
 useEffect(()=>{aiApi.settings().then(syncSettings).catch(reason=>setError(reason instanceof Error?reason.message:'AI配置读取失败'))},[])
 const save=async(runTest:boolean)=>{
  setBusy(true);setError('');setTestResult(null)
  try{
   const next=await aiApi.saveSettings({apiKey:apiKey.trim()||undefined,model,baseUrl,timeoutMs,actor})
   syncSettings(next);setApiKey('')
   if(runTest){
    const result=await aiApi.test()
    setTestResult({ok:true,message:result.message,latencyMs:result.latencyMs,model:result.model})
    notify(`DeepSeek连接成功，响应${result.latencyMs}ms`)
   }else notify('AI模型配置已保存，各岗位立即生效')
  }catch(reason){
   const message=reason instanceof Error?reason.message:'AI配置操作失败'
   setError(message);setTestResult({ok:false,message})
  }finally{setBusy(false)}
 }
 return <><PageHead eyebrow="系统管理 · AI能力中心" title="AI模型配置" desc="集中维护DeepSeek连接，各岗位的AI作战助手共用同一套服务端配置。"/>
  <section className={`ai-config-hero ${settings?.configured?'connected':'pending'}`}>
   <div className="ai-config-brand"><span><Bot size={24}/></span><div><b>DeepSeek</b><h2>{settings?.configured?'模型服务已配置':'等待配置API Key'}</h2><p>{settings?.configured?'配置变更无需重启，所有岗位的下一次对话立即使用新模型。':'填写并测试连接后，运营、班长、员工、质检、培训和HRBP均可正常使用。'}</p></div></div>
   <div className="ai-config-status"><i></i><span>{settings?.configured?'已配置':'未配置'}</span><strong>{settings?.model||model}</strong></div>
   <div className="ai-config-meta"><span>配置来源</span><b>{settings?.source==='system'?'系统管理':settings?.source==='environment'?'服务器环境变量':'暂无'}</b><small>{settings?.updatedAt?`${settings.updatedBy||'管理员'} · ${new Date(settings.updatedAt).toLocaleString('zh-CN',{hour12:false})}`:'保存后自动记录变更时间'}</small></div>
  </section>
  <div className="ai-config-layout"><section className="panel ai-config-form"><div className="panel-head"><div><span>连接参数</span><h2>DeepSeek Chat Completions</h2></div><em>仅系统管理员可见</em></div>
   <div className="ai-config-fields">
    <label className="api-key-field"><span>API Key <b>必填</b></span><div><KeyRound size={16}/><input type={showKey?'text':'password'} autoComplete="new-password" value={apiKey} onChange={event=>setApiKey(event.target.value)} placeholder={settings?.configured?`已保存 ${settings.maskedKey}，留空表示不修改`:'请输入 sk- 开头的 DeepSeek API Key'}/><button aria-label={showKey?'隐藏API Key':'显示API Key'} onClick={()=>setShowKey(value=>!value)}>{showKey?<EyeOff size={16}/>:<Eye size={16}/>}</button></div><small>密钥只提交到本机业务API，并以仅当前系统用户可读的文件权限保存；页面不会回显完整密钥。</small></label>
    <div className="ai-config-form-row"><label><span>基础模型</span><select value={model} onChange={event=>setModel(event.target.value)}><option value="deepseek-v4-flash">DeepSeek V4 Flash（推荐）</option><option value="deepseek-v4-pro">DeepSeek V4 Pro</option></select><small>Flash用于日常运营问答；Pro适合复杂分析。</small></label><label><span>响应超时</span><select value={timeoutMs} onChange={event=>setTimeoutMs(Number(event.target.value))}><option value={30000}>30秒</option><option value={45000}>45秒</option><option value={60000}>60秒</option><option value={90000}>90秒</option></select><small>超时后前端会提示重试，不会阻塞业务页面。</small></label></div>
    <label><span>API地址</span><div className="url-input"><Database size={16}/><input value={baseUrl} onChange={event=>setBaseUrl(event.target.value)} placeholder="https://api.deepseek.com"/></div><small>默认使用DeepSeek官方OpenAI兼容地址，系统会自动请求 /chat/completions。</small></label>
   </div>
   {error&&<div className="ai-config-error"><AlertTriangle size={16}/><span>{error}</span></div>}
   <footer><button className="secondary" disabled={busy} onClick={()=>save(false)}><Save size={15}/>保存配置</button><button className="primary" disabled={busy||(!settings?.configured&&!apiKey.trim())} onClick={()=>save(true)}>{busy?<span className="assistant-spinner"></span>:<Zap size={15}/>}保存并测试连接</button></footer>
  </section>
  <aside><section className="panel ai-test-panel"><div className="panel-head"><div><span>连通性验证</span><h2>模型服务测试</h2></div></div>{testResult?<div className={testResult.ok?'success':'failed'}>{testResult.ok?<CheckCircle2 size={30}/>:<AlertTriangle size={30}/>}<h3>{testResult.ok?'连接测试成功':'连接测试失败'}</h3><p>{testResult.message}</p>{testResult.ok&&<div><span>模型 <b>{testResult.model}</b></span><span>响应 <b>{testResult.latencyMs}ms</b></span></div>}</div>:<div className="idle"><RadioTower size={30}/><h3>尚未执行连接测试</h3><p>“保存并测试连接”会发起一次最小对话，验证Key、模型和网络是否可用。</p></div>}</section>
   <section className="panel ai-role-coverage"><div className="panel-head"><div><span>应用范围</span><h2>全岗位统一启用</h2></div></div><div>{roles.map(item=><span key={item.id}><CheckCircle2 size={13}/>{item.label}</span>)}</div><p>每次对话自动带入当前岗位、页面、核心指标和待办数量；不同岗位共享模型连接，但对话内容相互独立。</p></section>
   <section className="ai-security-note"><ShieldCheck size={18}/><div><strong>密钥安全说明</strong><p>API Key不会写入前端代码、浏览器缓存或业务状态文件。正式部署时仍应启用HTTPS、服务端认证和密钥托管。</p></div></section>
  </aside></div>
 </>
}

function UserManagementPage({users,saveUser,userAction,roles,organization,notify,busy,error}:{users:SystemUser[];saveUser:(user:SystemUser)=>Promise<boolean>;userAction:(id:string,action:'toggle_status'|'reset_password')=>Promise<boolean>;roles:SystemRole[];organization:OrganizationDirectory;notify:(s:string)=>void;busy:boolean;error:string}){
 const [keyword,setKeyword]=useState('')
 const [editing,setEditing]=useState<SystemUser|null>(null)
 const [showPassword,setShowPassword]=useState(false)
 const visible=users.filter(u=>!keyword||[u.name,u.jobNo,u.jobTitle,u.department].some(v=>v.includes(keyword)))
 const incompleteCount=users.filter(user=>!user.phone||!user.email).length
 const nextUserId=()=>{
  const maxId=users.reduce((max,user)=>{const match=user.id.match(/^U(\d+)$/);return match?Math.max(max,Number(match[1])):max},0)
  return `U${String(maxId+1).padStart(3,'0')}`
 }
 const save=async(user:SystemUser)=>{
  const exists=users.some(item=>item.id===user.id)
  const normalized={...user,name:user.name.trim(),jobNo:user.jobNo.trim(),jobTitle:user.jobTitle.trim(),department:user.department.trim(),password:(user.password||'').trim(),moduleOverrides:Array.from(new Set(user.moduleOverrides.filter(menu=>menuCatalog.some(item=>item.id===menu))))}
  if(!normalized.name||!normalized.jobNo||!normalized.jobTitle||!normalized.department||!normalized.roleId||(!exists&&!normalized.password)){notify('请完整填写姓名、工号、岗位、组织、角色和初始密码');return}
  if(users.some(item=>item.id!==normalized.id&&item.jobNo.toLowerCase()===normalized.jobNo.toLowerCase())){notify(`工号 ${normalized.jobNo} 已存在，请检查后再保存`);return}
  if(await saveUser(normalized))setEditing(null)
 }
 const resetPassword=(user:SystemUser)=>userAction(user.id,'reset_password')
 return <><PageHead eyebrow="系统管理 · 组织与账号" title="组织与用户管理" desc="组织名录来自人力架构文件，登录账号单独授权；同步组织不等于自动开通系统权限。" actions={<button className="primary" onClick={()=>setEditing({id:nextUserId(),name:'',jobNo:'',roleId:'customer-agent',jobTitle:'客服专员',department:'河北基地',phone:'',email:'',status:'active',password:'',forceChangePassword:true,moduleOverrides:[],createdAt:new Date().toISOString().slice(0,10)})}><UserPlus size={16}/>新增登录账号</button>}/>
  {error&&<div className="workflow-error"><AlertTriangle size={16}/>{error}</div>}
  <div className="admin-summary"><div><Users size={22}/><span>组织人数<strong>{organization.source.totalMembers}</strong></span></div><div><Building2 size={22}/><span>项目/职能单元<strong>{organization.projects.length}</strong></span></div><div><CheckCircle2 size={22}/><span>正常账号<strong>{users.filter(u=>u.status==='active').length}</strong></span></div><div><ShieldCheck size={22}/><span>权限角色<strong>{roles.length}</strong></span></div></div>
  {organization.members.length>0&&<OrganizationDirectoryPanel organization={organization}/>}
  <section className="panel user-admin"><div className="admin-toolbar"><div><strong>登录账号</strong><small>仅下列账号可以登录系统，组织名录人员不会自动获得权限。</small></div><div className="admin-search"><Search size={16}/><input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="搜索姓名、工号、岗位、部门"/></div></div><div className="user-head"><span>用户</span><span>账号 / 联系方式</span><span>岗位与组织</span><span>角色</span><span>模块例外</span><span>状态</span><span>操作</span></div>{visible.map(u=>{const role=roles.find(r=>r.id===u.roleId);return <div className="user-row" key={u.id}><div className="user-person"><span>{u.name.slice(0,1)||'新'}</span><div><strong>{u.name}</strong><small>{u.id}</small></div></div><div className="account-info"><strong>{u.jobNo}</strong><small><Phone size={11}/>{u.phone||'未填写'}</small><small><Mail size={11}/>{u.email||'未填写'}</small></div><div><strong>{u.jobTitle}</strong><small>{u.department}</small></div><div><span className="role-tag">{role?.name||'未分配'}</span></div><div><strong>{u.moduleOverrides.length} 项</strong><small>{u.moduleOverrides.length?u.moduleOverrides.map(m=>menuCatalog.find(x=>x.id===m)?.label).join('、'):'继承角色权限'}</small></div><div><span className={`account-status ${u.status}`}>{u.status==='active'?'正常':'已停用'}</span>{(!u.phone||!u.email)&&<small className="profile-flag">资料待完善</small>}{u.forceChangePassword&&<small className="password-flag">待改密</small>}</div><div className="row-actions"><button disabled={busy} title="编辑" onClick={()=>setEditing({...u,password:''})}><Edit3 size={15}/></button><button disabled={busy} title="重置密码" onClick={()=>resetPassword(u)}><KeyRound size={15}/></button><button disabled={busy} title="停用/启用" onClick={()=>userAction(u.id,'toggle_status')}><LockKeyhole size={15}/></button></div></div>})}</section>
  {editing&&<div className="modal-backdrop"><div className="admin-modal"><header><div><span>用户资料</span><h2>{users.some(u=>u.id===editing.id)?'编辑用户':'新增用户'}</h2></div><button disabled={busy} onClick={()=>setEditing(null)}><X size={19}/></button></header><div className="form-grid"><label><span>姓名 *</span><input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></label><label><span>工号 / 登录账号 *</span><input value={editing.jobNo} onChange={e=>setEditing({...editing,jobNo:e.target.value})}/></label><label><span>岗位 *</span><input value={editing.jobTitle} onChange={e=>setEditing({...editing,jobTitle:e.target.value})}/></label><label><span>所属组织 *</span><input value={editing.department} onChange={e=>setEditing({...editing,department:e.target.value})}/></label><label><span>手机号</span><input value={editing.phone} onChange={e=>setEditing({...editing,phone:e.target.value})}/></label><label><span>邮箱</span><input value={editing.email} onChange={e=>setEditing({...editing,email:e.target.value})}/></label><label><span>系统角色 *</span><select value={editing.roleId} onChange={e=>setEditing({...editing,roleId:e.target.value})}>{roles.filter(r=>r.status==='active').map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></label><label><span>账号状态</span><select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value as 'active'|'disabled'})}><option value="active">正常</option><option value="disabled">停用</option></select></label><label className="password-field"><span>{users.some(u=>u.id===editing.id)?'新密码（可留空）':'初始密码 *'}</span><div><input type={showPassword?'text':'password'} value={editing.password||''} placeholder={users.some(u=>u.id===editing.id)?'留空表示不修改密码':'至少8位'} onChange={e=>setEditing({...editing,password:e.target.value})}/><button onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={15}/>:<Eye size={15}/>}</button></div><small>密码仅提交服务端，并以 scrypt 加盐哈希保存，不会回显到浏览器。</small></label></div><div className="override-box"><div><strong>角色外模块配置</strong><small>这里的配置是对角色权限的额外补充，不会移除角色已有菜单。</small></div><div>{menuCatalog.map(m=><label key={m.id}><input type="checkbox" checked={editing.moduleOverrides.includes(m.id)} onChange={e=>setEditing({...editing,moduleOverrides:e.target.checked?[...editing.moduleOverrides,m.id]:editing.moduleOverrides.filter(x=>x!==m.id)})}/><span>{m.label}</span></label>)}</div></div><footer><button className="secondary" disabled={busy} onClick={()=>setEditing(null)}>取消</button><button className="primary" disabled={busy||!editing.name.trim()||!editing.jobNo.trim()||!editing.jobTitle.trim()||!editing.department.trim()||!editing.roleId||(!users.some(u=>u.id===editing.id)&&!(editing.password||'').trim())} onClick={()=>save(editing)}><Save size={15}/>{busy?'保存中…':'保存用户'}</button></footer></div></div>}
 </>
}

function RoleManagementPage({roles,saveRole,deleteRole,users,organization,notify,busy,error}:{roles:SystemRole[];saveRole:(role:SystemRole)=>Promise<boolean>;deleteRole:(id:string)=>Promise<boolean>;users:SystemUser[];organization:OrganizationDirectory;notify:(s:string)=>void;busy:boolean;error:string}){
 const [editing,setEditing]=useState<SystemRole|null>(null)
 const memberCount=(roleId:string)=>users.filter(user=>user.roleId===roleId).length
 const nextRoleId=(code:string)=>{
  const base=`custom-${code.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'role'}`
  let candidate=base
  let suffix=2
  while(roles.some(role=>role.id===candidate)){candidate=`${base}-${suffix}`;suffix+=1}
  return candidate
 }
 const save=async(role:SystemRole)=>{
  const normalized={...role,name:role.name.trim(),code:role.code.trim().toUpperCase(),menus:Array.from(new Set(role.menus.filter(menu=>menuCatalog.some(item=>item.id===menu))))}
  if(!normalized.name||!normalized.code){notify('请填写角色名称和角色编码');return}
  if(roles.some(item=>item.id!==normalized.id&&item.code.toLowerCase()===normalized.code.toLowerCase())){notify(`角色编码 ${normalized.code} 已存在`);return}
  if(!normalized.menus.length){notify('请至少选择一个左侧菜单权限');return}
  const prepared=roles.some(item=>item.id===normalized.id)?normalized:{...normalized,id:nextRoleId(normalized.code)}
  if(await saveRole(prepared))setEditing(null)
 }
 const remove=async(role:SystemRole)=>{
  const count=memberCount(role.id)
  if(role.builtIn)return
  if(count>0){notify(`该角色仍关联${count}名用户，请先重新分配账号`);return}
  if(!window.confirm(`确认删除自定义角色“${role.name}”？`))return
  await deleteRole(role.id)
 }
 return <><PageHead eyebrow="系统管理 · RBAC" title="角色管理" desc="角色绑定左侧导航和数据范围；用户继承角色权限后，还可单独增加模块配置。" actions={<button className="primary" onClick={()=>setEditing({id:'new-role',name:'',code:'',level:'自定义',description:'',memberCount:0,menus:['command'],builtIn:false,status:'active'})}><Plus size={16}/>新增角色</button>}/>
  {error&&<div className="workflow-error"><AlertTriangle size={16}/>{error}</div>}
  <div className="role-admin-grid">{roles.map(r=>{const assigned=memberCount(r.id);const directoryCount=organization.roleStats.find(item=>item.id===r.id)?.count||0;return <article className={`role-card ${r.status}`} key={r.id}><header><div className="role-emblem">{r.name.slice(0,1)}</div><div><span>{r.level}</span><h3>{r.name}</h3><small>{r.code}</small></div>{r.builtIn&&<em>内置</em>}</header><p>{r.description}</p><div className="role-stat"><span><Users size={14}/>{directoryCount} 名组织成员 · {assigned} 个登录账号</span><span><Menu size={14}/>{r.menus.length} 个菜单</span></div><div className="menu-chips">{r.menus.slice(0,5).map(m=><span key={m}>{menuCatalog.find(x=>x.id===m)?.label}</span>)}{r.menus.length>5&&<em>+{r.menus.length-5}</em>}</div><footer><button disabled={busy} onClick={()=>setEditing(r)}><Edit3 size={14}/>编辑权限</button><button className="danger" disabled={busy||r.builtIn} title={r.builtIn?'内置角色不可删除':assigned?'请先重新分配关联用户':'删除角色'} onClick={()=>remove(r)}><Trash2 size={14}/>删除</button></footer></article>})}</div>
  {editing&&<div className="modal-backdrop"><div className="admin-modal role-modal"><header><div><span>角色与权限</span><h2>{editing.builtIn?'编辑内置角色':'配置角色'}</h2></div><button disabled={busy} onClick={()=>setEditing(null)}><X size={19}/></button></header><div className="form-grid"><label><span>角色名称 *</span><input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></label><label><span>角色编码 *</span><input disabled={editing.builtIn} value={editing.code} onChange={e=>setEditing({...editing,code:e.target.value.toUpperCase()})}/></label><label><span>权限层级</span><select value={editing.level} onChange={e=>setEditing({...editing,level:e.target.value})}>{['系统级','基地级','业务线级','区域级','班组级','个人级','专业岗','自定义'].map(x=><option key={x}>{x}</option>)}</select></label><label><span>角色状态</span><select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value as 'active'|'disabled'})}><option value="active">启用</option><option value="disabled">停用</option></select></label><label className="full"><span>角色说明</span><textarea value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})}/></label></div><div className="permission-tree"><header><div><strong>左侧菜单权限</strong><small>勾选后，该角色登录时显示对应抽屉入口。</small></div><button disabled={busy} onClick={()=>setEditing({...editing,menus:editing.menus.length===menuCatalog.length?[]:menuCatalog.map(m=>m.id)})}>{editing.menus.length===menuCatalog.length?'取消全选':'全选'}</button></header><div>{menuCatalog.map(m=><label key={m.id} className={m.id.includes('management')?'system-permission':''}><input type="checkbox" checked={editing.menus.includes(m.id)} onChange={e=>setEditing({...editing,menus:e.target.checked?[...editing.menus,m.id]:editing.menus.filter(x=>x!==m.id)})}/><span>{m.label}</span>{m.id.includes('management')&&<em>系统管理</em>}</label>)}</div></div><footer><button className="secondary" disabled={busy} onClick={()=>setEditing(null)}>取消</button><button className="primary" disabled={busy||!editing.name.trim()||!editing.code.trim()||!editing.menus.length} onClick={()=>save(editing)}><Save size={15}/>{busy?'保存中…':'保存角色'}</button></footer></div></div>}
 </>
}

export default App
