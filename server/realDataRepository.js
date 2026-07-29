import { databaseQuery } from './database.js'

const SOURCE_SCHEMA=String(process.env.DATA_SOURCE_SCHEMA||'ai_hack_s2').trim()
if(!/^[A-Za-z0-9_]+$/.test(SOURCE_SCHEMA))throw new Error('DATA_SOURCE_SCHEMA仅允许字母、数字和下划线')
const CACHE_MS=Math.max(5_000,Number(process.env.REAL_DATA_CACHE_MS)||60_000)
let cache={expiresAt:0,value:null}

const number=value=>value==null||value===''?null:Number(value)
const round=(value,digits=2)=>value==null?null:Number(Number(value).toFixed(digits))
const isoDate=value=>value?new Date(value).toISOString().slice(0,10):''
const percentValue=value=>{
 const parsed=number(value)
 if(parsed==null)return null
 return parsed>0&&parsed<=1?parsed*100:parsed
}
const targetStatus=(actual,target,direction='higher')=>{
 if(actual==null||target==null||target===0)return 'unknown'
 return direction==='lower'?(actual<=target?'met':'attention'):(actual>=target?'met':'attention')
}
const metric=(label,actual,target,unit,direction='higher')=>{
 const gap=actual==null||target==null?null:round(actual-target,2)
 return {label,actual:round(actual),target:round(target),unit,direction,gap,status:targetStatus(actual,target,direction)}
}
const dataScope=dates=>({
 mode:'real',
 sourceSchema:SOURCE_SCHEMA,
 scopeLabel:String(process.env.DATA_SCOPE_LABEL||'真实库试运行（上海/云南样本）'),
 warning:String(process.env.DATA_SCOPE_WARNING||'当前源库未发现河北基地记录，页面展示真实测试库数据，不代表河北生产经营结果。'),
 refreshedAt:new Date().toISOString(),
 dates,
})

const latestTeamRows=async()=>{
 const rows=await databaseQuery(`
  SELECT jzgh AS jobNo,xm AS name,COALESCE(NULLIF(org_name,''),NULLIF(bz,''),'未分组') AS team,
   COALESCE(NULLIF(BZ_jrgh,''),'') AS leaderCode,COALESCE(NULLIF(zg,''),'') AS supervisor,
   COALESCE(NULLIF(ryjd,''),'未知') AS stage,
   YDL_rdc AS responses,YDL_rmb AS responseTarget,CPH_rdc AS cph,CPH_rmb AS cphTarget,
   YDL_yjzdc AS monthlyResponses,YDL_yjzmb AS monthlyResponseTarget,
   CPH_yjzdc AS monthlyCph,CPH_yjzmb AS monthlyCphTarget,
   RGFWMYL_RDC AS satisfaction,RGFWMYL_rmb AS satisfactionTarget,
   RGFWMYL_yjzdc AS monthlySatisfaction,RGFWMYL_yjzmb AS monthlySatisfactionTarget,
   QTYCXJJL_RDC AS fcr,QTYCXJJL_rmb AS fcrTarget,
   QTYCXJJL_yjzdc AS monthlyFcr,QTYCXJJL_yjzmb AS monthlyFcrTarget,
   ZMXXZB_rdc AS busyRest,ZMXXZB_rmb AS busyRestTarget,
   twoxscfldl_rdc AS repeatCall,twoxscfldl_rmb AS repeatCallTarget,
   valid_conv_vol_ach_mtd AS validMarketing,opened_vol_ach_mtd AS broadbandMarketing,
   conv_vol_ach_mtd AS marketingVolume,sjjzrq AS dataDate
  FROM ${SOURCE_SCHEMA}.bpo_dws_base_pord_sum
  WHERE sjjzrq=(SELECT MAX(sjjzrq) FROM ${SOURCE_SCHEMA}.bpo_dws_base_pord_sum)
   AND jzgh IS NOT NULL AND xm IS NOT NULL AND COALESCE(jzgh,'')<>COALESCE(BZ_jrgh,'')
  ORDER BY COALESCE(YDL_rdc,0) DESC
  LIMIT 80`)
 return rows.map(row=>{
  const responses=number(row.responses),responseTarget=number(row.responseTarget)
  const cph=number(row.cph),cphTarget=number(row.cphTarget)
  const satisfaction=percentValue(row.satisfaction),satisfactionTarget=percentValue(row.satisfactionTarget)
  const fcr=percentValue(row.fcr),fcrTarget=percentValue(row.fcrTarget)
  const busyRest=percentValue(row.busyRest),busyRestTarget=percentValue(row.busyRestTarget)
  const repeatCall=percentValue(row.repeatCall),repeatCallTarget=percentValue(row.repeatCallTarget)
  const attention=[
   targetStatus(responses,responseTarget),
   targetStatus(cph,cphTarget),
   targetStatus(satisfaction,satisfactionTarget),
   targetStatus(fcr,fcrTarget),
   targetStatus(busyRest,busyRestTarget,'lower'),
   targetStatus(repeatCall,repeatCallTarget,'lower'),
  ].filter(item=>item==='attention').length
  const potential=attention<=1&&responses!=null&&responses>0
  const focus=attention>=3
  return {
   jobNo:row.jobNo,name:row.name,team:row.team,leaderCode:row.leaderCode,supervisor:row.supervisor,stage:row.stage,
   metrics:{
    responses:metric('人工应答量',responses,responseTarget,'通'),
    cph:metric('CPH',cph,cphTarget,''),
    satisfaction:metric('人工服务满意率',satisfaction,satisfactionTarget,'%'),
    fcr:metric('一次解决率',fcr,fcrTarget,'%'),
    busyRest:metric('置忙小休占比',busyRest,busyRestTarget,'%','lower'),
    repeatCall:metric('2小时重复来电率',repeatCall,repeatCallTarget,'%','lower'),
   },
   monthly:{
    responses:metric('月度人工应答量',number(row.monthlyResponses),number(row.monthlyResponseTarget),'通'),
    cph:metric('月度CPH',number(row.monthlyCph),number(row.monthlyCphTarget),''),
    satisfaction:metric('月度人工服务满意率',percentValue(row.monthlySatisfaction),percentValue(row.monthlySatisfactionTarget),'%'),
    fcr:metric('月度一次解决率',percentValue(row.monthlyFcr),percentValue(row.monthlyFcrTarget),'%'),
   },
   marketing:{
    valid:round(number(row.validMarketing),0)||0,
    broadband:round(number(row.broadbandMarketing),0)||0,
    volume:round(number(row.marketingVolume),0)||0,
   },
   flags:{potential,focus},
   summary:focus
    ?`有${attention}项指标偏离个人目标，优先复盘产能、满意度与过程时长，形成可验收的班后辅导动作。`
    :potential
     ?'产能和质量总体贴近个人目标，可作为潜力员工持续培养并复用达标方法。'
     :'部分指标存在目标差值，建议按“差值—日目标—当班动作”持续校准。',
   dataDate:isoDate(row.dataDate),
  }
 })
}

const attendanceData=async()=>{
 const [summary]=await databaseQuery(`
  SELECT MAX(biz_date) AS dataDate,COUNT(*) AS employeeCount,
   SUM(CASE WHEN origin_schedule_status='有排班' THEN 1 ELSE 0 END) AS scheduled,
   SUM(CASE WHEN attend_status='正常' THEN 1 ELSE 0 END) AS fullWork,
   SUM(CASE WHEN is_sign_late='是' THEN 1 ELSE 0 END) AS late,
   SUM(CASE WHEN is_no_work='是' THEN 1 ELSE 0 END) AS absent
  FROM ${SOURCE_SCHEMA}.bpo_user_attendance_day
  WHERE biz_date=(SELECT MAX(biz_date) FROM ${SOURCE_SCHEMA}.bpo_user_attendance_day)`)
 const people=await databaseQuery(`
  SELECT emp_code AS jobNo,emp_name AS name,COALESCE(NULLIF(org_group_dep_name,''),'未分组') AS team,
   COALESCE(NULLIF(org_group_name,''),'未配置') AS leader,COALESCE(NULLIF(job_stage,''),'未知') AS stage,
   COALESCE(NULLIF(origin_schedule_range,''),'休息/未排班') AS schedule,
   attend_status AS attendanceStatus,is_full_work AS fullWork,is_sign_late AS late,is_no_work AS absent,
   ROUND(COALESCE(sign_time,0)/60,1) AS signHours,biz_date AS dataDate
  FROM ${SOURCE_SCHEMA}.bpo_user_attendance_day
  WHERE biz_date=(SELECT MAX(biz_date) FROM ${SOURCE_SCHEMA}.bpo_user_attendance_day)
  ORDER BY CASE WHEN attend_status='有排班' THEN 0 ELSE 1 END,org_group_dep_name,emp_name
  LIMIT 120`)
 return {
  dataDate:isoDate(summary?.dataDate),
  summary:{
   employeeCount:Number(summary?.employeeCount||0),scheduled:Number(summary?.scheduled||0),
   fullWork:Number(summary?.fullWork||0),late:Number(summary?.late||0),absent:Number(summary?.absent||0),
  },
  people:people.map(row=>({...row,signHours:number(row.signHours),dataDate:isoDate(row.dataDate)})),
 }
}

const ehrData=async()=>{
 const lifecycle=await databaseQuery(`
  SELECT COALESCE(NULLIF(RYJD,''),'未标记') AS stage,COUNT(*) AS total,
   SUM(CASE WHEN LZSJ IS NOT NULL THEN 1 ELSE 0 END) AS departed
  FROM ${SOURCE_SCHEMA}.f_ehr_personnel_master_data
  WHERE fsny=(SELECT MAX(fsny) FROM ${SOURCE_SCHEMA}.f_ehr_personnel_master_data)
  GROUP BY COALESCE(NULLIF(RYJD,''),'未标记')
  ORDER BY total DESC`)
 const teams=await databaseQuery(`
  SELECT COALESCE(NULLIF(SIJBM,''),NULLIF(SJBM,''),'未分组') AS team,COUNT(*) AS total,
   SUM(CASE WHEN LZSJ IS NOT NULL THEN 1 ELSE 0 END) AS departed
  FROM ${SOURCE_SCHEMA}.f_ehr_personnel_master_data
  WHERE fsny=(SELECT MAX(fsny) FROM ${SOURCE_SCHEMA}.f_ehr_personnel_master_data)
  GROUP BY COALESCE(NULLIF(SIJBM,''),NULLIF(SJBM,''),'未分组')
  HAVING COUNT(*)>=3
  ORDER BY SUM(CASE WHEN LZSJ IS NOT NULL THEN 1 ELSE 0 END)/COUNT(*) DESC,COUNT(*) DESC
  LIMIT 12`)
 const risks=await databaseQuery(`
  SELECT e.JRGH AS jobNo,e.XM AS name,COALESCE(NULLIF(e.SIJBM,''),NULLIF(e.SJBM,''),'未分组') AS team,
   COALESCE(NULLIF(e.RYJD,''),'未知') AS cycle,DATEDIFF((SELECT MAX(biz_date) FROM ${SOURCE_SCHEMA}.bpo_user_attendance_day),e.RZSJ) AS tenureDays,
   SUM(CASE WHEN a.is_sign_late='是' THEN 1 ELSE 0 END) AS lateCount,
   SUM(CASE WHEN a.is_no_work='是' THEN 1 ELSE 0 END) AS absentCount
  FROM ${SOURCE_SCHEMA}.f_ehr_personnel_master_data e
  LEFT JOIN ${SOURCE_SCHEMA}.bpo_user_attendance_day a ON a.emp_code=e.JRGH
   AND a.biz_date>=DATE_SUB((SELECT MAX(biz_date) FROM ${SOURCE_SCHEMA}.bpo_user_attendance_day),INTERVAL 30 DAY)
  WHERE e.fsny=(SELECT MAX(fsny) FROM ${SOURCE_SCHEMA}.f_ehr_personnel_master_data) AND e.LZSJ IS NULL
  GROUP BY e.JRGH,e.XM,e.SIJBM,e.SJBM,e.RYJD,e.RZSJ
  HAVING lateCount>0 OR absentCount>0
  ORDER BY absentCount DESC,lateCount DESC,tenureDays ASC
  LIMIT 10`)
 const normalize=item=>{
  const total=Number(item.total||0),departed=Number(item.departed||0)
  return {...item,total,departed,turnoverRate:total?round(departed/total*100,1):0}
 }
 return {
  dataMonth:(await databaseQuery(`SELECT MAX(fsny) AS value FROM ${SOURCE_SCHEMA}.f_ehr_personnel_master_data`))[0]?.value||'',
  lifecycle:lifecycle.map(normalize),teams:teams.map(normalize),
  risks:risks.map(row=>{
   const lateCount=Number(row.lateCount||0),absentCount=Number(row.absentCount||0),tenureDays=Number(row.tenureDays||0)
   const riskScore=Math.min(98,45+absentCount*20+lateCount*8+(tenureDays<90?10:0))
   return {...row,lateCount,absentCount,tenureDays,riskScore,reasons:[absentCount?`近30日旷工${absentCount}次`:'',lateCount?`近30日迟到${lateCount}次`:'',tenureDays<90?'入职不足90天':''].filter(Boolean)}
  }),
 }
}

const salaryData=async()=>{
 const period=(await databaseQuery(`
  SELECT CONCAT(REPLACE(FSNF,'年',''),LPAD(REPLACE(FSYF,'月',''),2,'0')) AS value
  FROM ${SOURCE_SCHEMA}.f_jyfx_rgcb
  ORDER BY value DESC LIMIT 1`))[0]?.value||''
 const wherePeriod=`CONCAT(REPLACE(FSNF,'年',''),LPAD(REPLACE(FSYF,'月',''),2,'0'))=?`
 const people=await databaseQuery(`
  SELECT JRGH AS jobNo,XM AS name,COALESCE(NULLIF(WJBM,''),NULLIF(SIJBM,''),'未分组') AS team,
   COALESCE(NULLIF(GW,''),'未知') AS position,HTGZ AS contractSalary,JXGZ AS performanceSalary,
   YWJC AS businessReward,BTXJ AS subsidies,JCXJ AS rewards,YFGZ AS grossSalary,SFGZ AS netSalary,RGCB AS laborCost
  FROM ${SOURCE_SCHEMA}.f_jyfx_rgcb
  WHERE ${wherePeriod} AND GW='客服专员' AND JRGH IS NOT NULL
  ORDER BY YFGZ DESC
  LIMIT 120`,[period])
 const distribution=await databaseQuery(`
  SELECT CASE WHEN YFGZ<3000 THEN '＜3千' WHEN YFGZ<4000 THEN '3—4千' WHEN YFGZ<5000 THEN '4—5千'
   WHEN YFGZ<6000 THEN '5—6千' WHEN YFGZ<7000 THEN '6—7千' ELSE '≥7千' END AS salaryRange,
   COUNT(*) AS count
  FROM ${SOURCE_SCHEMA}.f_jyfx_rgcb
  WHERE ${wherePeriod} AND GW='客服专员'
  GROUP BY salaryRange
  ORDER BY MIN(YFGZ)`,[period])
 const projects=await databaseQuery(`
  SELECT COALESCE(NULLIF(EJBM,''),NULLIF(YJBM,''),'未分组') AS project,COUNT(*) AS headcount,
   ROUND(AVG(YFGZ),2) AS averageSalary,ROUND(AVG(JXGZ),2) AS averagePerformance,
   ROUND(AVG(CASE WHEN YFGZ<4000 THEN 1 ELSE 0 END)*100,1) AS lowSalaryRate,
   ROUND(AVG(CASE WHEN RGCB>0 THEN YFGZ/RGCB ELSE NULL END)*100,1) AS salaryCostRate
  FROM ${SOURCE_SCHEMA}.f_jyfx_rgcb
  WHERE ${wherePeriod} AND GW='客服专员'
  GROUP BY COALESCE(NULLIF(EJBM,''),NULLIF(YJBM,''),'未分组')
  ORDER BY headcount DESC`,[period])
 const total=distribution.reduce((sum,item)=>sum+Number(item.count||0),0)
 return {
  period,
  people:people.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,['contractSalary','performanceSalary','businessReward','subsidies','rewards','grossSalary','netSalary','laborCost'].includes(key)?round(number(value)):value]))),
  distribution:distribution.map(item=>({range:item.salaryRange,count:Number(item.count),rate:total?round(Number(item.count)/total*100,1):0})),
  projects:projects.map(row=>({...row,headcount:Number(row.headcount),averageSalary:round(number(row.averageSalary)),averagePerformance:round(number(row.averagePerformance)),lowSalaryRate:round(number(row.lowSalaryRate)),salaryCostRate:round(number(row.salaryCostRate))})),
 }
}

const marketingData=async()=>{
 const [broadband,packages]=await Promise.all([
  databaseQuery(`SELECT MAX(ZQ) AS period,ROUND(SUM(JSJG),2) AS result,COUNT(*) AS rowsCount FROM ${SOURCE_SCHEMA}.f_sh_yx_kd`),
  databaseQuery(`SELECT MAX(ZQ) AS period,ROUND(SUM(JSJG),2) AS result,COUNT(*) AS rowsCount FROM ${SOURCE_SCHEMA}.f_sh_yx_llb`),
 ])
 return {
  broadband:{period:broadband[0]?.period||'',result:number(broadband[0]?.result)||0,rowsCount:Number(broadband[0]?.rowsCount||0)},
  package:{period:packages[0]?.period||'',result:number(packages[0]?.result)||0,rowsCount:Number(packages[0]?.rowsCount||0)},
 }
}

const loadShared=async()=>{
 if(cache.value&&cache.expiresAt>Date.now())return cache.value
 const [team,attendance,hrbp,salary,marketing]=await Promise.all([latestTeamRows(),attendanceData(),ehrData(),salaryData(),marketingData()])
 const value={team,attendance,hrbp,salary,marketing}
 cache={value,expiresAt:Date.now()+CACHE_MS}
 return value
}

export const getRealData=async({role,jobNo,name})=>{
 const shared=await loadShared()
 const matchedTeam=shared.team.find(item=>item.jobNo===jobNo||item.name===name)
 const representative=matchedTeam||shared.team.find(item=>item.metrics.responses.actual>0)||shared.team[0]||null
 const matchedSalary=shared.salary.people.find(item=>item.jobNo===jobNo||item.name===name)
 const representativeSalary=matchedSalary||shared.salary.people[0]||null
 const teamGroups=Object.values(shared.team.reduce((groups,item)=>{
  const group=groups[item.team]||{team:item.team,total:0,met:0,attention:0,potential:0,focus:0}
  group.total+=1
  const attention=Object.values(item.metrics).filter(value=>value.status==='attention').length
  if(attention===0)group.met+=1
  if(attention>0)group.attention+=1
  if(item.flags.potential)group.potential+=1
  if(item.flags.focus)group.focus+=1
  groups[item.team]=group
  return groups
 },{}))
 const dates={productivity:representative?.dataDate||'',attendance:shared.attendance.dataDate,ehr:shared.hrbp.dataMonth,salary:shared.salary.period}
 return {
  meta:dataScope(dates),
  team:{members:shared.team.slice(0,30),groups:teamGroups.slice(0,12),marketing:shared.marketing},
  employee:representative?{matched:Boolean(matchedTeam),profile:representative,salary:representativeSalary,requestedJobNo:jobNo}:null,
  morning:{
   date:representative?.dataDate||'',
   praise:shared.team.filter(item=>item.flags.potential).slice(0,5),
   focus:shared.team.filter(item=>item.flags.focus).slice(0,5),
   metrics:representative?Object.values(representative.metrics):[],
   marketing:shared.marketing,
  },
  attendance:shared.attendance,
  hrbp:shared.hrbp,
  salary:role==='employee'
   ?{period:shared.salary.period,personal:representativeSalary,matched:Boolean(matchedSalary),distribution:[],projects:[],team:[]}
   :role==='leader'
    ?{period:shared.salary.period,personal:null,matched:false,distribution:[],projects:[],team:shared.salary.people.slice(0,20)}
    :['hrbp','director'].includes(role)
     ?{period:shared.salary.period,personal:null,matched:false,distribution:shared.salary.distribution,projects:shared.salary.projects,team:[]}
     :{period:shared.salary.period,personal:null,matched:false,distribution:[],projects:[],team:[]},
 }
}

const taskMetricColumns={
 satisfaction:'RGFWMYL_RDC',
 fcr:'QTYCXJJL_RDC',
 repeat_call:'twoxscfldl_rdc',
 cph:'CPH_rdc',
 responses:'YDL_rdc',
 busy_rest:'ZMXXZB_rdc',
 marketing:'conv_vol_ach_mtd',
}

export const getTaskMetricTrend=async({employeeCode,metricCode})=>{
 const column=taskMetricColumns[metricCode]
 if(!column||!employeeCode)return []
 try{
  const rows=await databaseQuery(`
   SELECT sjjzrq AS observedAt,${column} AS actual
   FROM ${SOURCE_SCHEMA}.bpo_dws_base_pord_sum
   WHERE jzgh=? AND ${column} IS NOT NULL
   ORDER BY sjjzrq DESC LIMIT 7`,[employeeCode])
  return rows.reverse().map(row=>{
   let value=number(row.actual)
   if(['satisfaction','fcr','repeat_call','busy_rest'].includes(metricCode))value=percentValue(value)
   return {date:new Date(row.observedAt).toISOString(),value:round(value),source:`${SOURCE_SCHEMA}.bpo_dws_base_pord_sum`,type:'system'}
  })
 }catch(error){
  console.warn(`PDCA指标趋势读取失败：${error.code||error.message}`)
  return []
 }
}

export const buildLiveReportPreview=async basePreview=>{
 if(!basePreview.available)return basePreview
 const shared=await loadShared()
 const reportType=basePreview.report.id
 const source={
  reportDate:shared.team[0]?.dataDate||shared.attendance.dataDate,
  workbooks:['MySQL · ai_hack_s2'],
  sheets:['bpo_dws_base_pord_sum','bpo_user_attendance_day','f_ehr_personnel_master_data','f_jyfx_rgcb','f_sh_yx_kd','f_sh_yx_llb'],
  mode:'live_database',modeLabel:'真实库直连',
  warnings:['当前源库仅含上海/云南测试数据，未检出河北基地记录；更新时间以各事实表为准。'],
 }
 if(reportType==='team-morning-brief'){
  const rows=shared.team.slice(0,10).map((item,index)=>({
   category:item.flags.potential?'重点员工':'辅导关注',position:item.flags.potential?'目标达成标杆':'目标差值辅导',
   sourceRow:index+1,name:item.name,jobNo:item.jobNo,account:'',team:item.team,stage:item.stage,role:'客服专员',reason:item.summary,
   metrics:{
    responses:item.metrics.responses.actual,selfClosure:null,satisfaction:item.metrics.satisfaction.actual==null?null:item.metrics.satisfaction.actual/100,
    appealInterception:null,evaluationRate:null,serviceCoverage:null,signinHours:null,signinRate:null,att:null,acw:null,aht:null,
    utilization:null,busyRest:item.metrics.busyRest.actual==null?null:item.metrics.busyRest.actual/100,wrapRate:null,cph:item.metrics.cph.actual,
   },
   targets:{
    responseTarget:item.metrics.responses.target,satisfactionTarget:item.metrics.satisfaction.target==null?null:item.metrics.satisfaction.target/100,
    busyRestTarget:item.metrics.busyRest.target==null?null:item.metrics.busyRest.target/100,cphTarget:item.metrics.cph.target,
   },
  }))
  return {
   ...basePreview,source,
   summary:[
    {label:'真实员工记录',value:`${shared.team.length}人`,detail:`数据截至${source.reportDate}`,status:'normal'},
    {label:'重点员工',value:`${rows.filter(item=>item.category==='重点员工').length}人`,detail:'按个人目标综合判断',status:'good'},
    {label:'辅导关注',value:`${rows.filter(item=>item.category==='辅导关注').length}人`,detail:'按目标差值识别',status:'risk'},
    {label:'营销结果',value:String(shared.marketing.package.result+shared.marketing.broadband.result),detail:'宽带+流量包汇总',status:'normal'},
   ],
   briefing:{...basePreview.briefing,eligiblePopulation:shared.team.length,formalPopulation:shared.team.filter(item=>item.stage.includes('正式')).length,practicalPopulation:shared.team.filter(item=>item.stage.includes('实操')).length,comparablePopulation:shared.team.filter(item=>item.metrics.responses.actual>0).length},
   briefingRows:rows,
   rows:rows.map(item=>[item.category,item.position,item.reason,String(item.sourceRow),item.name,item.jobNo,item.account,item.team,item.stage,item.role]),
  }
 }
 const memberCount=shared.team.length
 const avg=key=>{
  const values=shared.team.map(item=>item.metrics[key]?.actual).filter(value=>value!=null)
  return values.length?round(values.reduce((sum,value)=>sum+value,0)/values.length):null
 }
 const operationsRows=[
  ['产能','人工应答量','个人目标','班组均值',String(avg('responses')??'-'),'通','按员工独立目标管理；详见班组看数。','真实库'],
  ['效率','CPH','个人目标','班组均值',String(avg('cph')??'-'),'','按员工独立目标管理；详见班组看数。','真实库'],
  ['质量','人工服务满意率','个人目标','班组均值',`${avg('satisfaction')??'-'}%`,'%','结合个人目标判断达成与Gap。','真实库'],
  ['质量','一次解决率','个人目标','班组均值',`${avg('fcr')??'-'}%`,'%','结合个人目标判断达成与Gap。','真实库'],
  ['营销','宽带营销结果','—',String(shared.marketing.broadband.result),'—','','来自上海营销宽带事实表。','真实库'],
  ['营销','流量包营销结果','—',String(shared.marketing.package.result),'—','','来自上海营销流量包事实表。','真实库'],
 ]
 return {
  ...basePreview,source,
  summary:[
   {label:'员工记录',value:`${memberCount}人`,detail:`数据截至${source.reportDate}`,status:'normal'},
   {label:'平均应答量',value:String(avg('responses')??'-'),detail:'真实库员工日达成均值',status:'normal'},
   {label:'平均满意率',value:`${avg('satisfaction')??'-'}%`,detail:'真实库员工日达成均值',status:'normal'},
   {label:'历史薪资月份',value:shared.salary.period,detail:'人工成本事实表',status:'normal'},
  ],
  columns:['指标分类','指标','目标口径','统计口径','实际值','单位','诊断说明','数据状态'],
  rows:operationsRows,
 }
}
