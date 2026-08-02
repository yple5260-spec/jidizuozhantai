import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const rpaSeed=JSON.parse(fs.readFileSync(new URL('./seeds/10015-rpa-report-data.json',import.meta.url),'utf8'))

export const projects=[
 {id:'hebei-return-10010',name:'河北回流10010',shortName:'10010',status:'template_ready',statusLabel:'模板就绪 · 待接数据',runnable:false,description:'已预置报表字段和运行接口，等待配置10010数据适配器。'},
 {id:'north-center-10015',name:'北方中心10015',shortName:'10015升投',status:'attachment_snapshot',statusLabel:'附件数据已接入',runnable:true,description:'使用《15升投运营日报-0720.xlsx》核验快照，覆盖人员运营、质量和人员流失。'},
 {id:'unicom-online-400',name:'联通在线400',shortName:'400',status:'template_ready',statusLabel:'模板就绪 · 待接数据',runnable:false,description:'已预置报表字段和运行接口，等待配置400项目数据适配器。'},
]

export const reportDefinitions=[
 {id:'team-morning-brief',name:'班组晨报',schedule:'每日 08:15',description:'前台、二线、督办、效能、申诉与账号治理的晨会输入。'},
 {id:'operations-daily',name:'基地运营日报',schedule:'每日 08:30',description:'营收、业务量、服务质量和月度预测的经营快照。'},
 {id:'personal-weekly-performance',name:'个人绩效周报',schedule:'每周一 08:00',description:'个人产量、参评、满意、申诉拦截和KPI绩效。'},
 {id:'monthly-operations-analysis',name:'月度经营分析',schedule:'每月1日 10:00',description:'目标、达成、预测、差异和经营管理建议。'},
]

const specialistReportDefinitions={
 quality:{id:'quality-daily',name:'质检日报',schedule:'每日 09:00',description:'责任认定、质量扣款、问题录音和整改任务的质量快照。'},
 training:{id:'attrition-training-daily',name:'人员流失培训日报',schedule:'每日 09:10',description:'按人员阶段和流失原因识别培训、带教与适岗改善需求。'},
 hrbp:{id:'attrition-hrbp-daily',name:'人员流失与保留日报',schedule:'每日 09:10',description:'按项目、团队、人员阶段和原因跟踪流失及组织保留动作。'},
}

const scopedManagementReports=reportDefinitions.map(item=>item.id==='team-morning-brief'?{
 ...item,name:'人员运营日报',description:'员工产能、效率、质量、差距和追回计划；按当前岗位自动控制人员范围。'
}:item)

const operationWarning='源工作簿含大量现代公式及既有缓存错误；平台只使用已核验缓存快照，运行时不打开或重算284MB工作簿。'
const sourceProfiles={
 operations:{reportDate:'2026-07-20',workbooks:['15升投运营日报-0720.xlsx'],sheets:['10015升投','业务量','考核指标'],mode:'offline_cached',modeLabel:'离线缓存',warnings:[operationWarning]},
 morning:{reportDate:'2026-07-19',workbooks:['10015队列晨会日报_20260719.xlsx'],sheets:['话务透视','归档透视','效能','申诉拦截','人员信息','工号串用处理'],mode:'sample_extract',modeLabel:'样本提取',warnings:['主日报与KPI结果来自线下文件缓存；话务、归档和效能优先采用静态事实表口径。']},
}

const morningMetrics=[
 {key:'responses',code:'AU',label:'个人应答量',direction:'higher',format:'count',targetKey:'responseTarget'},
 {key:'selfClosure',code:'BB',label:'整体自闭环占比',direction:'higher',format:'percent',targetKey:'selfClosureTarget'},
 {key:'satisfaction',code:'BJ',label:'人工服务满意率',direction:'higher',format:'percent',targetKey:'satisfactionTarget'},
 {key:'appealInterception',code:'BM',label:'申诉拦截率',direction:'higher',format:'percent'},
 {key:'evaluationRate',code:'BP',label:'人工服务参评率',direction:'higher',format:'percent',targetKey:'evaluationTarget'},
 {key:'serviceCoverage',code:'BS',label:'服请覆盖率',direction:'higher',format:'percent'},
 {key:'signinHours',code:'CA',label:'签入时长',direction:'higher',format:'hours',targetKey:'signinTarget'},
 {key:'signinRate',code:'CB',label:'签入率',direction:'higher',format:'percent'},
 {key:'att',code:'CC',label:'ATT',direction:'lower',format:'seconds',targetKey:'attTarget'},
 {key:'acw',code:'CD',label:'ACW',direction:'lower',format:'seconds'},
 {key:'aht',code:'CE',label:'AHT',direction:'lower',format:'seconds'},
 {key:'utilization',code:'CF',label:'通话利用率',direction:'higher',format:'percent',targetKey:'utilizationTarget'},
 {key:'busyRest',code:'CG',label:'置忙小休',direction:'lower',format:'percent',targetKey:'busyRestTarget'},
 {key:'wrapRate',code:'CH',label:'整理占比',direction:'lower',format:'percent'},
 {key:'cph',code:'CI',label:'CPH',direction:'higher',format:'decimal',targetKey:'cphTarget'},
]
const fmtMetric=(value,format)=>{
 if(value==null||value==='-')return '-'
 if(format==='percent')return `${(Number(value)*100).toFixed(2)}%`
 if(format==='hours')return `${Number(value).toFixed(1)}h`
 if(format==='seconds')return `${Number(value).toFixed(1)}s`
 if(format==='decimal')return Number(value).toFixed(2)
 return Number(value).toLocaleString('zh-CN')
}
const morningBriefing={
 eligiblePopulation:148,formalPopulation:117,practicalPopulation:31,comparablePopulation:106,
 selectionRule:'前台服务专员中，使用正式且个人应答量≥1000的可比池；选取均衡标杆与需要辅导支持的代表员工，不代表全员实时自动排名。',
 targetPolicy:'优先使用员工所在行J:AT缓存目标；无个人目标的指标只展示实际值，不作统一达标判定。',
 directions:{higher:morningMetrics.filter(metric=>metric.direction==='higher').map(metric=>metric.code),lower:morningMetrics.filter(metric=>metric.direction==='lower').map(metric=>metric.code)},
 metrics:morningMetrics,
}

const morningEmployees=[
 {category:'重点员工',position:'均衡标杆',sourceRow:76,name:'李凤云',jobNo:'JZ001098',account:'STTR5326',team:'杨艳坤',stage:'正式',role:'服务专员',reason:'产量、服务质量与效率表现均衡，可分享客户沟通和节奏管理做法。',metrics:{responses:2458,selfClosure:.605456,satisfaction:.934240,appealInterception:.933261,evaluationRate:.538242,serviceCoverage:1,signinHours:383.120277,signinRate:2.082175,att:408.783971,acw:12.781530,aht:421.565500,utilization:.728514,busyRest:.075459,wrapRate:.022779,cph:6.415740},targets:{responseTarget:3318.8426,selfClosureTarget:.70,satisfactionTarget:.90,evaluationTarget:.45,signinTarget:184,cphTarget:18.0372,attTarget:150,utilizationTarget:.71742,busyRestTarget:.12}},
 {category:'重点员工',position:'均衡标杆',sourceRow:35,name:'曹寒',jobNo:'JZ063591',account:'STTR00056',team:'李慧',stage:'正式',role:'服务专员',reason:'满意、参评、利用率和置忙控制较稳，可分享过程管理方法。',metrics:{responses:2442,selfClosure:.641626,satisfaction:.928135,appealInterception:.929371,evaluationRate:.535627,serviceCoverage:1,signinHours:288.622499,signinRate:1.568600,att:268.707617,acw:5.499590,aht:274.207208,utilization:.631528,busyRest:.057674,wrapRate:.012925,cph:8.460879},targets:{responseTarget:3966.9140,selfClosureTarget:.69,satisfactionTarget:.90,evaluationTarget:.45,signinTarget:184,cphTarget:21.5593,attTarget:118.7209,utilizationTarget:.68577,busyRestTarget:.12}},
 {category:'重点员工',position:'均衡标杆',sourceRow:38,name:'张东',jobNo:'JZ005372',account:'STTR4569',team:'李慧',stage:'正式',role:'服务专员',reason:'应答量较高、置忙小休低，适合分享高负荷下的通话节奏。',metrics:{responses:3198,selfClosure:.610589,satisfaction:.893531,appealInterception:.926829,evaluationRate:.464040,serviceCoverage:1,signinHours:320.577779,signinRate:1.742271,att:260.724828,acw:7.256098,aht:267.980926,utilization:.722479,busyRest:.039072,wrapRate:.020107,cph:9.975739},targets:{responseTarget:5323.4334,selfClosureTarget:.70,satisfactionTarget:.90,evaluationTarget:.45,signinTarget:184,cphTarget:28.9317,attTarget:95.2742,utilizationTarget:.71744,busyRestTarget:.12}},
 {category:'重点员工',position:'均衡标杆',sourceRow:63,name:'冯华星',jobNo:'JZ058459',account:'',team:'王璐璐',stage:'正式',role:'服务专员',reason:'样本中应答量最高且ATT、ACW、AHT控制较好，可分享高效处置方法。',metrics:{responses:3523,selfClosure:.611949,satisfaction:.929909,appealInterception:.911661,evaluationRate:.530514,serviceCoverage:1,signinHours:313.635556,signinRate:1.704541,att:195.762986,acw:5.521714,aht:201.284700,utilization:.610823,busyRest:.018650,wrapRate:.017229,cph:11.232782},targets:{responseTarget:5178.5256,selfClosureTarget:.70,satisfactionTarget:.90,evaluationTarget:.45,signinTarget:184,cphTarget:28.1442,attTarget:90.9380,utilizationTarget:.68573,busyRestTarget:.12}},
 {category:'重点员工',position:'均衡标杆',sourceRow:41,name:'王辉卿',jobNo:'JZ001198',account:'',team:'李慧',stage:'正式',role:'服务专员',reason:'闭环、满意、参评和利用率较均衡，可作为稳定服务示范。',metrics:{responses:2328,selfClosure:.632846,satisfaction:.924825,appealInterception:.922286,evaluationRate:.491409,serviceCoverage:1,signinHours:323.053334,signinRate:1.755725,att:386.293814,acw:10.885309,aht:397.179124,utilization:.773257,busyRest:.045951,wrapRate:.021789,cph:7.206240},targets:{responseTarget:3468.7845,selfClosureTarget:.70,satisfactionTarget:.90,evaluationTarget:.45,signinTarget:184,cphTarget:18.8521,attTarget:146.2200,utilizationTarget:.71735,busyRestTarget:.12}},
 {category:'辅导关注',position:'复核后辅导',sourceRow:111,name:'李承震',jobNo:'JZ007853',account:'',team:'李成雨',stage:'正式',role:'服务专员',reason:'自闭环较高，但满意与参评偏低、ACW和整理占比较高；需结合排班和业务结构复核后辅导。',metrics:{responses:1224,selfClosure:.781967,satisfaction:.739414,appealInterception:.924731,evaluationRate:.250817,serviceCoverage:1,signinHours:283.141112,signinRate:1.538810,att:525.758170,acw:48.928104,aht:574.686275,utilization:.631338,busyRest:.196117,wrapRate:.058754,cph:4.322933},targets:{responseTarget:431.7119,selfClosureTarget:.75,satisfactionTarget:.86,evaluationTarget:.30,signinTarget:184,cphTarget:2.3463,attTarget:208.139,utilizationTarget:.68621,busyRestTarget:.12}},
 {category:'辅导关注',position:'效率辅导',sourceRow:34,name:'冉倩',jobNo:'JZ063991',account:'',team:'李慧',stage:'正式',role:'服务专员',reason:'应答量、ATT/AHT和CPH需结合个人目标复盘，制定效率改善动作。',metrics:{responses:1025,selfClosure:.595703,satisfaction:.882488,appealInterception:.930108,evaluationRate:.423415,serviceCoverage:1,signinHours:299.249447,signinRate:1.626356,att:566.523902,acw:23.714146,aht:590.238049,utilization:.539022,busyRest:.156287,wrapRate:.022563,cph:3.425236},targets:{}},
 {category:'辅导关注',position:'过程辅导',sourceRow:118,name:'吴萧',jobNo:'JZ009648',account:'',team:'李成雨',stage:'正式',role:'服务专员',reason:'ATT/AHT偏长、置忙小休较高，班后抽听并复盘处置过程。',metrics:{responses:1092,selfClosure:.579044,satisfaction:.855914,appealInterception:.915081,evaluationRate:.425824,serviceCoverage:1,signinHours:266.469447,signinRate:1.448204,att:569.457875,acw:11.040293,aht:580.498168,utilization:.648238,busyRest:.205289,wrapRate:.012568,cph:4.098031},targets:{responseTarget:1884.8367,selfClosureTarget:.69,satisfactionTarget:.86,evaluationTarget:.45,signinTarget:184,cphTarget:10.2437,attTarget:239.8847,utilizationTarget:.68579,busyRestTarget:.12}},
 {category:'辅导关注',position:'产能辅导',sourceRow:125,name:'刘鹏程',jobNo:'JZ058612',account:'',team:'曾雪',stage:'正式',role:'服务专员',reason:'自闭环、利用率与CPH存在改善空间，需明确当班产能动作。',metrics:{responses:1107,selfClosure:.516712,satisfaction:.884381,appealInterception:.934094,evaluationRate:.445348,serviceCoverage:1,signinHours:277.061388,signinRate:1.505768,att:455.177055,acw:12.481481,aht:467.658536,utilization:.505184,busyRest:.113483,wrapRate:.013853,cph:3.995504},targets:{responseTarget:588.6976,selfClosureTarget:.69,satisfactionTarget:.90,evaluationTarget:.45,signinTarget:184,cphTarget:3.1994,attTarget:150,utilizationTarget:.68577,busyRestTarget:.12}},
 {category:'辅导关注',position:'时长辅导',sourceRow:64,name:'杜景飒',jobNo:'JZ065075',account:'',team:'王璐璐',stage:'正式',role:'服务专员',reason:'ATT/AHT较长、置忙小休偏高，需复盘长通话和非通话时长。',metrics:{responses:1037,selfClosure:.632850,satisfaction:.910145,appealInterception:.929385,evaluationRate:.332690,serviceCoverage:.999036,signinHours:297.221390,signinRate:1.615334,att:769.564127,acw:13.617165,aht:783.181293,utilization:.745832,busyRest:.138969,wrapRate:.013197,cph:3.488982},targets:{responseTarget:321.0172,selfClosureTarget:.69,satisfactionTarget:.89613,evaluationTarget:.3490,signinTarget:184,cphTarget:1.74466,attTarget:305.8198,utilizationTarget:.71702,busyRestTarget:.12}},
]
const morningColumns=['分类','晨会定位','通报/辅导原因','源行号','姓名','伽睿工号','受理账号','班组','阶段','岗位',...morningMetrics.map(metric=>`${metric.label}（${metric.code}）`),...morningMetrics.filter(metric=>metric.targetKey).map(metric=>`${metric.label}目标`),'目标说明','数据来源','数据状态']
const morningRow=employee=>[
 employee.category,employee.position,employee.reason,String(employee.sourceRow),employee.name,employee.jobNo,employee.account,employee.team,employee.stage,employee.role,
 ...morningMetrics.map(metric=>fmtMetric(employee.metrics[metric.key],metric.format)),
 ...morningMetrics.filter(metric=>metric.targetKey).map(metric=>fmtMetric(employee.targets[metric.targetKey],metric.format)),
 '优先使用员工行J:AT缓存目标；空白表示该指标无可用个人目标。',`前台晨会日报!第${employee.sourceRow}行`,'样本提取',
]

const previews={
 'operations-daily':{
  source:sourceProfiles.operations,
  summary:[
   {label:'截止营收',value:'260.39万',detail:'目标239.14万',status:'good'},
   {label:'营收达成',value:'108.89%',detail:'GAP +21.26万',status:'good'},
   {label:'月度预测',value:'344.76万',detail:'月目标314.33万',status:'good'},
   {label:'质量扣款',value:'-0.60万',detail:'每日根据日报更新',status:'risk'},
  ],
  columns:['指标分类','指标','目标值','实际值','达成或预测','单位','诊断说明','数据状态'],
  rows:[
   ['经营','升投收入','2,391,354.40','2,603,926.50','108.89%','元','已达标；实际高于目标212,572.10元，Gap为+8.89%，当前收入进度领先。','离线缓存'],
   ['经营','月度收入','3,143,333.23','3,447,627.69','109.68%','元','预测达标；月度预测高于目标304,294.46元，预测Gap为+9.68%。','离线缓存'],
   ['质量','质量扣款','','-6,000','','元','发生质量扣款6,000元；暂无目标值，需复核扣款责任项并跟踪整改闭环。','离线缓存'],
   ['业务量','月截止话务量','','221,750','','通','月累计业务量221,750通；当前未配置对标目标，仅作业务规模与资源负荷监测。','离线缓存'],
   ['服务质量','人工满意率','','89.355%','','%','当前满意率89.355%；日报未配置对标目标，需结合客户考核线判断达标状态。','离线缓存'],
   ['服务质量','人工参评率','','46.372%','','%','当前参评率46.372%；日报未配置对标目标，建议持续关注样本覆盖是否充分。','离线缓存'],
   ['闭环','自闭环解决占比','','59.786%','','%','当前自闭环占比59.786%；日报未配置对标目标，建议结合历史均值观察改善趋势。','离线缓存'],
   ['服务水平','人工诉求接通率','95.00%','99.723%','+4.723pp','%','已达标；高于目标4.723个百分点，服务接通能力保持稳定。','离线缓存'],
   ['服务水平','15秒人工接通率','85.00%','95.277%','+10.277pp','%','已达标；高于目标10.277个百分点，快速接通表现明显领先。','离线缓存'],
  ],
 },
 'team-morning-brief':{
  source:{...sourceProfiles.morning,sheets:['前台晨会日报','前台目标-质量','前台目标-产能'],warnings:['指标取自“前台晨会日报”第6行定义及员工行缓存；运行时不打开或重算原工作簿。','不同岗位、阶段和员工目标存在差异；辅导关注用于管理支持，不作纪律或绩效定级。']},
  summary:[
   {label:'有效前台专员',value:'148人',detail:'正式117 · 实操31',status:'normal'},
   {label:'可比正式员工',value:'106人',detail:'正式且应答量≥1000',status:'good'},
   {label:'重点员工',value:'5人',detail:'均衡标杆 · 正向分享',status:'good'},
   {label:'辅导关注',value:'5人',detail:'改进支持 · 不作惩罚',status:'risk'},
  ],
  briefing:morningBriefing,
  briefingRows:morningEmployees,
  columns:morningColumns,
  rows:morningEmployees.map(morningRow),
 },
 'personal-weekly-performance':{
  source:sourceProfiles.morning,
  summary:[
   {label:'样本员工',value:'2人',detail:'附件缓存结果',status:'normal'},
   {label:'曾雪参评',value:'52.381%',detail:'满意81.818%',status:'risk'},
   {label:'郭玲雨参评',value:'66.667%',detail:'满意66.667%',status:'risk'},
   {label:'数据口径',value:'样本',detail:'不代表完整周排名',status:'normal'},
  ],
  columns:['员工','统计周期','普星话务量','参评率','满意率','申诉拦截率','KPI绩效','来源工作表','数据状态','说明'],
  rows:[
   ['曾雪','截至2026-07-19','21','52.381%','81.818%','100%','-12.6','KPI!C31:BF31','样本提取','管理岗样本，不自动判定异常'],
   ['郭玲雨','截至2026-07-19','18','66.667%','66.667%','100%','-10.8','KPI!C32:BF32','样本提取','管理岗样本，不自动判定异常'],
   ['AI辅导建议','本周推演','','','','','','平台规则','模拟推演','复核满意率差距并抽听典型通话'],
  ],
 },
 'monthly-operations-analysis':{
  source:sourceProfiles.operations,
  summary:[
   {label:'本月目标',value:'314.33万',detail:'升投收入',status:'normal'},
   {label:'月度预测',value:'344.76万',detail:'预测达成109.68%',status:'good'},
   {label:'当前业务量',value:'22.18万',detail:'月截止话务量',status:'normal'},
   {label:'质量扣款',value:'-0.60万',detail:'经营风险项',status:'risk'},
  ],
  columns:['统计月份','经营维度','指标','目标或预算','当前或预测','差异','单位','来源','数据状态','说明'],
  rows:[
   ['2026-07','收入','升投收入','2,391,354.40','2,603,926.50','+212,572.11','元','10015升投!G14:J14','离线缓存','截止07-20'],
   ['2026-07','预测','月度收入','3,143,333.23','3,447,627.69','+304,294.46','元','10015升投!K14:N14','离线缓存','预测值来自工作簿缓存'],
   ['2026-07','质量','质量扣款','','-6,000','','元','10015升投!W4','离线缓存','每日根据日报更新'],
   ['2026-07','服务','人工满意率','','89.355%','','%','业务量!H3:H5','离线缓存','高星91.173%，普星89.119%'],
   ['2026-07','管理建议','质量改善','','','','','平台规则','模拟推演','优先复核满意率与质量扣款来源'],
  ],
 },
}

const templateColumns={
 'team-morning-brief':['业务区域','晨会主题','指标或对象','当前值','管理提示','来源工作表','数据状态'],
 'operations-daily':['指标分类','指标','目标值','实际值','达成或预测','单位','来源工作表','数据状态'],
 'personal-weekly-performance':['员工','统计周期','业务量','参评率','满意率','KPI绩效','来源工作表','数据状态'],
 'monthly-operations-analysis':['统计月份','经营维度','指标','目标或预算','当前或预测','差异','单位','来源','数据状态'],
 'quality-daily':['听音日期','责任等级','员工','工号','班组','队列','省分','扣款','接触记录','质检点评'],
 'attrition-training-daily':['离职日期','员工','工号','部门','班组','人员阶段','入职日期','流失原因','主管','经理'],
 'attrition-hrbp-daily':['离职日期','员工','工号','部门','班组','人员阶段','入职日期','流失原因','主管','经理'],
}

const roleReportDefinitions=role=>{
 if(role==='quality')return [specialistReportDefinitions.quality]
 if(role==='training')return [specialistReportDefinitions.training]
 if(role==='hrbp')return [specialistReportDefinitions.hrbp]
 if(['leader','supervisor','manager','director'].includes(role))return scopedManagementReports
 return reportDefinitions
}
const reportByRole=(id,role)=>roleReportDefinitions(role).find(item=>item.id===id)||reportDefinitions.find(item=>item.id===id)
const pct=value=>value==null||!Number.isFinite(Number(value))?'—':`${(Number(value)*100).toFixed(1)}%`
const numberText=value=>value==null||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('zh-CN',{maximumFractionDigits:1})
const excelDateText=value=>{
 if(typeof value!=='number'||!Number.isFinite(value))return String(value||'—')
 return new Date(Math.round((value-25569)*86400)*1000).toISOString().slice(0,10)
}
const average=(rows,key)=>rows.length?rows.reduce((sum,item)=>sum+Number(item[key]||0),0)/rows.length:0
const roleScope=(role,actor)=>{
 const leaders=Object.keys(rpaSeed.aggregates.leaders).filter(name=>name!=='李娜')
 if(role==='leader'){
  const leader=leaders.includes(actor)?actor:leaders.sort((a,b)=>rpaSeed.aggregates.leaders[b]-rpaSeed.aggregates.leaders[a])[0]
  return {label:`${leader}班组`,policy:'仅展示当前班长负责班组人员',leaders:[leader]}
 }
 if(role==='supervisor')return {label:'前台一组',policy:'展示当前主管团队下代永乐、李成雨、李慧、王璐璐四个班组',leaders:['代永乐','李成雨','李慧','王璐璐']}
 if(role==='manager')return {label:'10015升投项目',policy:'展示经理负责项目的全部员工',leaders}
 return {label:'河北基地全域',policy:'展示基地已接入项目数据；当前附件覆盖10015升投',leaders}
}
const employeeStatus=item=>item.attainment==null?'目标待配':item.attainment>=1&&item.satisfactionActual>=item.satisfactionTarget?'达标标杆':item.attainment<.9?'重点追回':'质量关注'
const employeeTask=item=>({
 title:`${item.name} · ${item.attainment==null?'阶段目标配置':'产能与质量改善'}`,targetRole:'leader',owner:`${item.leader}（班长）`,issueCategory:'人员经营改善',issueLocation:`10015升投 / ${item.leader}班组 / ${item.name} ${item.jobNo}`,
 problem:item.attainment==null?`${item.name}已有月截止产能${numberText(item.monthlyActual)}，但附件未配置实操期月度产能目标，当前不能进行达标判断。`:`${item.name}月截止产能${numberText(item.monthlyActual)}，目标${numberText(item.monthlyTarget)}，达成率${pct(item.attainment)}；满意率${pct(item.satisfactionActual)}，需围绕签入、ATT、置忙与服务动作定位差距。`,
 target:item.attainment==null?'完成阶段目标配置并形成可执行的当班跟踪口径':`月截止产能追回至${numberText(item.monthlyTarget)}，并保持满意率不低于${pct(item.satisfactionTarget)}`,
 successCriteria:item.attainment==null?'阶段目标、适用周期和责任人配置完成，主管复核通过，后续日报可计算达成率。':`系统复核产能达成率不低于100%，满意率不低于${pct(item.satisfactionTarget)}，同时提交辅导记录和过程证据。`,
 actionPlan:`按签入影响${numberText(item.signinImpact)}、ATT影响${numberText(item.attImpact)}、置忙影响${numberText(item.busyImpact)}拆解当班动作，每日复盘实际产能和满意度。`,
 metricCode:item.attainment==null?'target_configuration':'responses',metricLabel:item.attainment==null?'阶段目标配置完成率':'月截止产能',metricUnit:item.attainment==null?'%':'通',metricDirection:'higher',baselineValue:item.attainment==null?0:Number(item.monthlyActual||0),targetValue:item.attainment==null?100:Number(item.monthlyTarget||0),
 employeeCode:item.jobNo,employeeName:item.name,team:`${item.leader}班组`,aiRationale:'依据附件“员工达成”表中的产能GAP及归因字段生成。',
})
const buildPeoplePreview=(project,report,role,actor)=>{
 const scope=roleScope(role,actor)
 const people=rpaSeed.employees.filter(item=>scope.leaders.includes(item.leader)).map(item=>{
  const monthlyTarget=Number(item.monthlyTarget)>0?Number(item.monthlyTarget):null
  const satisfactionRaw=Number(item.satisfactionTarget),satisfactionTarget=satisfactionRaw>0&&satisfactionRaw<=1?satisfactionRaw:satisfactionRaw>1?satisfactionRaw-Math.floor(satisfactionRaw):.88
  const normalizedSatisfaction=satisfactionTarget>=.5&&satisfactionTarget<=1?satisfactionTarget:.88
  return {...item,monthlyTarget,attainment:monthlyTarget?Number(item.monthlyActual)/monthlyTarget:null,productionGap:monthlyTarget?Number(item.monthlyActual)-monthlyTarget:null,satisfactionTarget:normalizedSatisfaction,recoveryAttainment:monthlyTarget&&Number(item.recoveryActual)?Number(item.recoveryActual)/monthlyTarget:null}
 }).sort((a,b)=>(a.attainment??Infinity)-(b.attainment??Infinity))
 const met=people.filter(item=>employeeStatus(item)==='达标标杆').length
 const recover=people.filter(item=>employeeStatus(item)==='重点追回').length
 const quality=people.filter(item=>employeeStatus(item)==='质量关注').length
 const pendingTarget=people.filter(item=>employeeStatus(item)==='目标待配').length
 const peopleRows=people.map(item=>({...item,status:employeeStatus(item),team:`${item.leader}班组`,task:employeeTask(item)}))
 const columns=['状态','员工','工号','班组','阶段','月截止目标','月截止达成','达成率','产能GAP','ATT','利用率','置忙小休','满意率','追回后达成率']
 const rows=peopleRows.map(item=>[item.status,item.name,item.jobNo,item.team,item.stage,numberText(item.monthlyTarget),numberText(item.monthlyActual),pct(item.attainment),numberText(item.productionGap),`${numberText(item.att)}s`,pct(item.utilization),pct(item.busyRest),pct(item.satisfactionActual),pct(item.recoveryAttainment)])
 return {project,report,available:true,source:{...sourceProfiles.operations,sheets:['员工达成','考核指标','10015升投'],mode:'attachment_snapshot',modeLabel:'附件数据快照',warnings:[operationWarning,scope.policy]},summary:[
  {label:'可见员工',value:`${people.length}人`,detail:scope.label,status:'normal'},
  {label:'达标标杆',value:`${met}人`,detail:`占可见范围${people.length?pct(met/people.length):'0%'}`,status:'good'},
  {label:'重点追回',value:`${recover}人`,detail:'产能达成率低于90%',status:'risk'},
  {label:'平均满意率',value:pct(average(people,'satisfactionActual')),detail:`质量关注${quality}人 · 目标待配${pendingTarget}人`,status:average(people,'satisfactionActual')>=.88?'good':'risk'},
 ],columns,rows,roleView:{kind:'people',scopeLabel:scope.label,scopePolicy:scope.policy,peopleRows}}
}
const qualityTask=item=>({
 title:`${item.name} · ${item.responsibility}质量整改`,targetRole:'leader',owner:`${item.team}（班长）`,issueCategory:'质量整改',issueLocation:`10015升投 / ${item.team}班组 / ${item.name} ${item.jobNo}`,
 problem:`${item.responsibility}：${item.comment||'质检发现服务规范问题'}；责任扣款${numberText(item.deduction)}元，接触记录${item.contactId||'待补充'}。`,
 target:'完成问题复盘、规范校准与二次抽检，整改合格率达到100%',successCriteria:'提交录音或接触记录、辅导记录和复检结果；同类问题复检样本全部合格。',
 actionPlan:'班长在24小时内完成当事员工复盘，质检抽取同类新样本复检，并回填问题原因、改进动作和验证结论。',
 metricCode:'quality_remediation',metricLabel:'质量整改完成率',metricUnit:'%',metricDirection:'higher',baselineValue:0,targetValue:100,employeeCode:item.jobNo,employeeName:item.name,team:item.team,aiRationale:'依据附件“质检”表责任认定、扣款及评分标准点评生成。',
})
const buildQualityPreview=(project,report)=>{
 const records=rpaSeed.quality.map(item=>({...item,listenDate:excelDateText(item.listenDate),task:qualityTask(item)}))
 const serious=records.filter(item=>['红线','底线'].includes(item.responsibility)).length
 const deduction=records.reduce((sum,item)=>sum+Number(item.deduction||0),0)
 const teams=new Set(records.map(item=>item.team)).size
 const columns=['听音日期','责任等级','员工','工号','班组','队列','省分','扣款','接触记录','质检点评']
 const rows=records.map(item=>[String(item.listenDate||''),item.responsibility,item.name,item.jobNo,item.team,item.queue,item.province,numberText(item.deduction),String(item.contactId||''),String(item.comment||'')])
 return {project,report,available:true,source:{...sourceProfiles.operations,sheets:['质检','考核指标'],mode:'attachment_snapshot',modeLabel:'附件数据快照',warnings:[operationWarning,'质量数据按质检岗位全量可见，任务默认派发至责任班长并由质检验收。']},summary:[
  {label:'质检问题',value:`${records.length}条`,detail:'附件已认定记录',status:'normal'},
  {label:'红线/底线',value:`${serious}条`,detail:'优先整改与复检',status:serious?'risk':'good'},
  {label:'责任扣款',value:`${numberText(deduction)}元`,detail:'降免后责任口径',status:deduction?'risk':'good'},
  {label:'涉及班组',value:`${teams}个`,detail:'支持按班组下发PDCA',status:'normal'},
 ],columns,rows,roleView:{kind:'quality',scopeLabel:'10015升投 · 质检全量',scopePolicy:'质检岗位查看全部质量问题与责任记录',qualityRows:records}}
}
const attritionTask=(item,role)=>({
 title:`${item.reason} · ${item.team}留存改善`,targetRole:'supervisor',owner:`${item.supervisor||'责任主管'}（主管）`,issueCategory:role==='training'?'流失原因培训改善':'人员保留改善',issueLocation:`${item.department} / ${item.team} / ${item.stage}`,
 problem:`${item.name}于${item.leaveDate}离职，人员阶段为${item.stage}，流失原因为“${item.reason}”。需复盘同团队同阶段人员的共性风险。`,
 target:role==='training'?'同阶段人员专项培训与面谈覆盖率达到100%':'同团队高风险人员保留面谈覆盖率达到100%',successCriteria:'完成目标人群清单、逐人访谈或训练记录，并在验证节点提交覆盖率与风险变化证据。',
 actionPlan:role==='training'?'按流失原因设计专项微课和带教动作，联动班长完成同阶段人员训练与效果回访。':'筛选同团队同阶段风险人员，完成原因访谈、保留方案和责任人时限，并复盘落地结果。',
 metricCode:role==='training'?'training_coverage':'retention_interview_coverage',metricLabel:role==='training'?'专项培训覆盖率':'保留面谈覆盖率',metricUnit:'%',metricDirection:'higher',baselineValue:0,targetValue:100,employeeCode:item.jobNo,employeeName:item.name,team:item.team,aiRationale:'依据附件“4月流失”表中的阶段、流失原因与管理归属生成。',
})
const buildAttritionPreview=(project,report,role)=>{
 const records=rpaSeed.attrition.map(item=>({...item,task:attritionTask(item,role)}))
 const reasons=Object.entries(rpaSeed.aggregates.attritionReasons).sort((a,b)=>b[1]-a[1])
 const early=records.filter(item=>String(item.stage).includes('实习')||String(item.stage).includes('实操')).length
 const managerScope=role==='hrbp'?'河北基地组织全域':'河北基地培训分析全域'
 const columns=['离职日期','员工','工号','部门','班组','人员阶段','入职日期','流失原因','主管','经理']
 const rows=records.map(item=>[item.leaveDate,item.name,item.jobNo,item.department,item.team,item.stage,item.hireDate,item.reason,item.supervisor,item.manager])
 return {project,report,available:true,source:{...sourceProfiles.operations,sheets:['4月流失','5月流失','前台人员信息'],mode:'attachment_snapshot',modeLabel:'附件数据快照',warnings:[operationWarning,'5月流失表未形成有效离职记录，本期统计采用4月已填写离职日期与原因的记录。']},summary:[
  {label:'本期流失',value:`${records.length}人`,detail:'4月有效离职记录',status:'risk'},
  {label:'实习/实操流失',value:`${early}人`,detail:'重点关注适岗与带教',status:early?'risk':'good'},
  {label:'TOP原因',value:String(reasons[0]?.[0]||'暂无'),detail:`${reasons[0]?.[1]||0}人`,status:'risk'},
  {label:'原因完整率',value:pct(records.filter(item=>item.reason).length/(records.length||1)),detail:'支持归因与专项改善',status:'good'},
 ],columns,rows,roleView:{kind:'attrition',scopeLabel:managerScope,scopePolicy:role==='training'?'聚焦阶段、原因及对应培训改善':'聚焦团队、原因及人员保留动作',attritionRows:records}}
}

const findProject=id=>projects.find(item=>item.id===id)
const findReport=id=>reportDefinitions.find(item=>item.id===id)

export function catalog(role){return {projects,reports:role?roleReportDefinitions(role):reportDefinitions}}

export function buildPreview(projectId,reportType,context={}){
 const project=findProject(projectId)
 const report=context.role?reportByRole(reportType,context.role):findReport(reportType)
 if(!project)throw Object.assign(new Error('未知项目'),{status:400,code:'REPORT_PROJECT_UNKNOWN'})
 if(!report)throw Object.assign(new Error('未知报表类型'),{status:400,code:'REPORT_TYPE_UNKNOWN'})
 if(!project.runnable)return {project,report,available:false,source:null,summary:[],columns:templateColumns[reportType],rows:[],integrationMessage:'数据接入待配置。当前仅提供报表模板和字段架构，不生成或伪装真实项目报表。'}
 if(context.role){
  if(reportType==='quality-daily'&&context.role==='quality')return buildQualityPreview(project,report)
  if(reportType==='attrition-training-daily'&&context.role==='training')return buildAttritionPreview(project,report,'training')
  if(reportType==='attrition-hrbp-daily'&&context.role==='hrbp')return buildAttritionPreview(project,report,'hrbp')
  if(reportType==='team-morning-brief'&&['leader','supervisor','manager','director'].includes(context.role))return buildPeoplePreview(project,report,context.role,context.actor||'')
 }
 return {project,report,available:true,...previews[reportType]}
}

const protectCell=value=>{
 const text=value==null?'':String(value)
 return /^[\s]*[=+\-@]/.test(text)?`'${text}`:text
}
const csvCell=value=>{
 const text=protectCell(value)
 return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text
}
export function buildCsv(preview){
 const lines=[preview.columns,...preview.rows].map(row=>row.map(csvCell).join(','))
 return `﻿${lines.join('\r\n')}\r\n`
}

const safeToken=value=>String(value).replace(/[^a-zA-Z0-9-]/g,'').slice(0,80)
export function createRun({dataDir,state,projectId,reportType,requestedBy,requestedRole,now,preview:providedPreview}){
 const preview=providedPreview||buildPreview(projectId,reportType)
 if(!preview.available)throw Object.assign(new Error('当前项目尚未接入数据源，不能生成正式报表'),{status:409,code:'REPORT_PROJECT_INTEGRATION_PENDING'})
 const started=Date.now()
 const id=`RP-${crypto.randomUUID()}`
 const csv=buildCsv(preview)
 const generatedDir=path.join(dataDir,'generated')
 fs.mkdirSync(generatedDir,{recursive:true})
 const date=preview.source.reportDate.replace(/-/g,'')
 const fileName=`${preview.project.shortName}_${preview.report.name}_${date}_${safeToken(id)}.csv`
 fs.writeFileSync(path.join(generatedDir,fileName),csv,'utf8')
 const completedAt=now()
 const run={
  id,projectId,reportType,projectName:preview.project.name,reportName:preview.report.name,requestedBy:String(requestedBy||'演示用户').trim().slice(0,40),requestedRole:String(requestedRole||'unknown').trim().slice(0,30),status:'succeeded',createdAt:completedAt,completedAt,
  sourceSnapshot:{mode:preview.project.status,reportDate:preview.source.reportDate,workbooks:preview.source.workbooks,sheets:preview.source.sheets,warnings:preview.source.warnings},
  metrics:{sourceSheetsReferenced:preview.source.sheets.length,outputRows:preview.rows.length,durationMs:Math.max(1,Date.now()-started),artifactBytes:Buffer.byteLength(csv)},
  preview:{summary:preview.summary,columns:preview.columns,rows:preview.rows},artifact:{format:'csv',fileName},warningCount:preview.source.warnings.length,downloadCount:0,
 }
 state.reportRuns.unshift(run)
 state.audit.unshift({at:completedAt,actor:run.requestedBy,action:`运行报表 ${id}（${preview.project.name} / ${preview.report.name}）`})
 return run
}

export function filterRuns(state,{projectId,reportType,limit=20}={}){
 return state.reportRuns.filter(run=>(!projectId||run.projectId===projectId)&&(!reportType||run.reportType===reportType)).slice(0,Math.min(Number(limit)||20,100))
}

export function artifactPath(dataDir,run){
 if(!run?.artifact?.fileName)return null
 const root=path.resolve(dataDir,'generated')
 const target=path.resolve(root,run.artifact.fileName)
 const relative=path.relative(root,target)
 if(relative.startsWith('..')||path.isAbsolute(relative)||relative==='')return null
 return target
}

export function recordDownload({state,run,requestedBy,now}){
 const at=now()
 const item={id:`DL-${crypto.randomUUID()}`,runId:run.id,projectId:run.projectId,reportType:run.reportType,requestedBy:String(requestedBy||run.requestedBy||'演示用户').trim().slice(0,40),downloadedAt:at,format:'csv'}
 state.reportDownloads.unshift(item)
 run.downloadCount=(run.downloadCount||0)+1
 state.audit.unshift({at,actor:item.requestedBy,action:`下载报表 ${run.id}（CSV）`})
 return item
}
