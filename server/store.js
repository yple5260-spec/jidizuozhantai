import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir=path.dirname(fileURLToPath(import.meta.url))
const dataDir=process.env.DATA_DIR||path.join(dir,'data')
const dataFile=path.join(dataDir,'state.json')
const backupFile=path.join(dataDir,'state.backup.json')
const tempFile=path.join(dataDir,'state.tmp.json')
const financialSeedFile=path.join(dir,'seeds','hebei-10015-financial-performance.json')
const financialPerformanceSeed=JSON.parse(fs.readFileSync(financialSeedFile,'utf8'))
const reflowFinancialSeedFile=path.join(dir,'seeds','hebei-reflow-financial-performance.json')
const reflowFinancialPerformanceSeed=JSON.parse(fs.readFileSync(reflowFinancialSeedFile,'utf8'))
const now=()=>new Date().toISOString()
const businessDateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'})
const dateKey=offset=>businessDateFormatter.format(new Date(Date.now()+offset*24*60*60*1000))
const initialWorkforce=()=>({
  employees:[
    {id:'EMP-10913',jobNo:'JR10913',name:'王芳',role:'employee',area:'前台普通客服一区',team:'普通客服一区·8班',leader:'张伟',stage:'适应期',skills:['10015前台','续约'],status:'active',currentShift:'早班 08:30-17:30'},
    {id:'EMP-11005',jobNo:'JR11005',name:'孙雷',role:'employee',area:'前台普通客服一区',team:'普通客服一区·8班',leader:'张伟',stage:'新人期',skills:['10015前台'],status:'active',currentShift:'中班 10:00-19:00'},
    {id:'EMP-10776',jobNo:'JR10776',name:'李倩',role:'employee',area:'前台普通客服一区',team:'普通客服一区·8班',leader:'张伟',stage:'成熟期',skills:['10015前台','续约'],status:'active',currentShift:'早班 08:30-17:30'},
    {id:'EMP-10381',jobNo:'JR10381',name:'赵晨',role:'employee',area:'前台普通客服一区',team:'普通客服一区·8班',leader:'张伟',stage:'成熟期',skills:['10015前台','投诉协同'],status:'active',currentShift:'晚班 13:00-22:00'},
    {id:'EMP-10822',jobNo:'JR10822',name:'刘欣',role:'employee',area:'前台普通客服一区',team:'普通客服一区·6班',leader:'刘洋',stage:'成熟期',skills:['10015前台'],status:'active',currentShift:'早班 08:30-17:30'},
    {id:'EMP-10691',jobNo:'JR10691',name:'周浩',role:'employee',area:'前台普通客服一区',team:'普通客服一区·6班',leader:'刘洋',stage:'成熟期',skills:['10015前台','续约'],status:'active',currentShift:'中班 10:00-19:00'},
    {id:'LEAD-008',jobNo:'JR10008',name:'张伟',role:'leader',area:'前台普通客服一区',team:'普通客服一区·8班',leader:'前台客服主管',stage:'班长',skills:['现场管理','10015前台'],status:'active',currentShift:'管理班 08:00-18:00'},
    {id:'LEAD-006',jobNo:'JR10006',name:'刘洋',role:'leader',area:'前台普通客服一区',team:'普通客服一区·6班',leader:'前台客服主管',stage:'班长',skills:['现场管理','10015前台'],status:'active',currentShift:'管理班 08:00-18:00'},
  ],
  coverage:[
    {id:'COV-2',date:dateKey(0),team:'普通客服一区·2班',required:15,scheduled:15,onDuty:14,forecastLoad:86,targetCoverage:95},
    {id:'COV-4',date:dateKey(0),team:'普通客服一区·4班',required:15,scheduled:12,onDuty:9,forecastLoad:68,targetCoverage:95},
    {id:'COV-5',date:dateKey(0),team:'普通客服一区·5班',required:16,scheduled:15,onDuty:13,forecastLoad:73,targetCoverage:95},
    {id:'COV-6',date:dateKey(0),team:'普通客服一区·6班',required:16,scheduled:17,onDuty:17,forecastLoad:88,targetCoverage:95},
    {id:'COV-8',date:dateKey(0),team:'普通客服一区·8班',required:15,scheduled:13,onDuty:12,forecastLoad:65,targetCoverage:95},
  ],
  shifts:[
    {id:'SHIFT-10913-0',employeeId:'EMP-10913',jobNo:'JR10913',name:'王芳',team:'普通客服一区·8班',date:dateKey(0),shift:'早班',start:'08:30',end:'17:30',status:'confirmed'},
    {id:'SHIFT-10913-1',employeeId:'EMP-10913',jobNo:'JR10913',name:'王芳',team:'普通客服一区·8班',date:dateKey(1),shift:'中班',start:'10:00',end:'19:00',status:'confirmed'},
    {id:'SHIFT-11005-0',employeeId:'EMP-11005',jobNo:'JR11005',name:'孙雷',team:'普通客服一区·8班',date:dateKey(0),shift:'中班',start:'10:00',end:'19:00',status:'confirmed'},
    {id:'SHIFT-10776-0',employeeId:'EMP-10776',jobNo:'JR10776',name:'李倩',team:'普通客服一区·8班',date:dateKey(0),shift:'早班',start:'08:30',end:'17:30',status:'confirmed'},
    {id:'SHIFT-10381-0',employeeId:'EMP-10381',jobNo:'JR10381',name:'赵晨',team:'普通客服一区·8班',date:dateKey(0),shift:'晚班',start:'13:00',end:'22:00',status:'confirmed'},
  ],
  requests:[
    {id:'WF-260724-001',kind:'cross_team_dispatch',title:'4班高峰时段跨班支援',requesterRole:'supervisor',requester:'前台客服主管',employeeId:'',employeeName:'',fromTeam:'普通客服一区·6班',toTeam:'普通客服一区·4班',date:dateKey(0),detail:'11:00—11:30从6班调入1名续约技能员工，预计4班覆盖率提升至90%。',status:'manager_pending',ownerRole:'manager',owner:'客服经理',dueAt:new Date(Date.now()+90*60*1000).toISOString(),createdAt:now(),updatedAt:now(),result:'',hrbpFiledAt:'',history:[{at:now(),actor:'前台客服主管',action:'提交跨班组调度方案，等待客服经理审批'}]},
    {id:'WF-260724-002',kind:'shift_change',title:'王芳明日早班调整申请',requesterRole:'employee',requester:'王芳',employeeId:'EMP-10913',employeeName:'王芳',fromTeam:'普通客服一区·8班',toTeam:'',date:dateKey(1),detail:'因家庭就医安排，申请明日中班调整为早班；已与李倩确认可互换。',status:'leader_pending',ownerRole:'leader',owner:'张伟（班长）',dueAt:new Date(Date.now()+2*60*60*1000).toISOString(),createdAt:now(),updatedAt:now(),result:'',hrbpFiledAt:'',history:[{at:now(),actor:'王芳',action:'提交调班申请，等待班长初审'}]},
  ],
})

const initialTraining=()=>({
  cohorts:[
    {
      id:'COH-202607-01',name:'2026年7月10015新工班',project:'10015升投',trainer:'刘颖',
      planCount:24,arrivedCount:22,startDate:'2026-07-22',plannedEndDate:'2026-07-30',
      status:'training',targetPassRate:85,targetAttendance:98,forecastPassRate:88.5,
      stages:[
        {id:'arrival',name:'招聘到位',owner:'招聘岗 + 培训',goal:'计划24人，到位22人',dueAt:'2026-07-21T10:00:00+08:00',progress:100,status:'done',evidence:'招聘到位名单与入职资料已核对。'},
        {id:'classplan',name:'开班计划',owner:'培训师 刘颖',goal:'课程、师资、场地和考试节点全部排定',dueAt:'2026-07-21T17:00:00+08:00',progress:100,status:'done',evidence:'10天课程表、讲师排期及通关标准已发布。'},
        {id:'training',name:'培训实施',owner:'主讲 + 助教',goal:'课程完成率100%',dueAt:'2026-07-28T17:30:00+08:00',progress:64,status:'active',evidence:'已完成基础业务、系统操作和6轮场景演练。'},
        {id:'clearance',name:'培训通关',owner:'培训 + 质检',goal:'通关率≥85%',dueAt:'2026-07-29T17:30:00+08:00',progress:20,status:'pending',evidence:'理论晨测已完成，实操终测待组织。'},
        {id:'profile',name:'档案初建',owner:'培训师',goal:'22人档案完整率100%',dueAt:'2026-07-28T17:30:00+08:00',progress:35,status:'pending',evidence:'身份与入职信息已录入，能力画像待补齐。'},
        {id:'assessment',name:'能力评估',owner:'培训 + 班长',goal:'形成上岗分层与帮扶建议',dueAt:'2026-07-30T17:30:00+08:00',progress:10,status:'pending',evidence:'已建立评估模板，等待终测数据。'},
      ],
      history:[{at:now(),actor:'系统',action:'初始化7月新工班任务链'}],
    },
  ],
  trainees:[
    {id:'TRN-001',jobNo:'JR12117',name:'高翔',cohortId:'COH-202607-01',attendance:94.8,theoryScore:91,practiceScore:68,scenarioScore:70,profileComplete:70,riskLevel:'high',assessmentStatus:'assessed',ability:{business:68,system:82,communication:70},supportPlan:'今日18:30一对一强化业务口径，明日复测2个场景。',history:[{at:now(),actor:'培训师 刘颖',action:'识别为实操高风险学员并安排专项帮扶'}]},
    {id:'TRN-002',jobNo:'JR12118',name:'魏琳',cohortId:'COH-202607-01',attendance:98.2,theoryScore:88,practiceScore:76,scenarioScore:78,profileComplete:80,riskLevel:'attention',assessmentStatus:'assessed',ability:{business:80,system:66,communication:78},supportPlan:'增加系统沙盘练习，目标将平均操作时长压降20秒。',history:[{at:now(),actor:'培训师 刘颖',action:'完成阶段能力评估'}]},
    {id:'TRN-003',jobNo:'JR12119',name:'宋佳',cohortId:'COH-202607-01',attendance:99.1,theoryScore:93,practiceScore:79,scenarioScore:72,profileComplete:85,riskLevel:'attention',assessmentStatus:'assessed',ability:{business:86,system:84,communication:68},supportPlan:'跟读优秀录音并完成3轮压力场景演练。',history:[{at:now(),actor:'培训师 刘颖',action:'完成阶段能力评估'}]},
    {id:'TRN-004',jobNo:'JR12120',name:'陈敏',cohortId:'COH-202607-01',attendance:99.6,theoryScore:95,practiceScore:88,scenarioScore:90,profileComplete:92,riskLevel:'normal',assessmentStatus:'assessed',ability:{business:91,system:90,communication:88},supportPlan:'按正常计划进入通关，建议作为同伴练习组长。',history:[{at:now(),actor:'培训师 刘颖',action:'完成阶段能力评估'}]},
    {id:'TRN-005',jobNo:'JR12121',name:'郭悦',cohortId:'COH-202607-01',attendance:98.9,theoryScore:90,practiceScore:84,scenarioScore:86,profileComplete:90,riskLevel:'normal',assessmentStatus:'assessed',ability:{business:86,system:88,communication:84},supportPlan:'保持晨测节奏，进入标准通关流程。',history:[{at:now(),actor:'培训师 刘颖',action:'完成阶段能力评估'}]},
    {id:'TRN-006',jobNo:'JR12122',name:'马骁',cohortId:'COH-202607-01',attendance:97.2,theoryScore:86,practiceScore:77,scenarioScore:76,profileComplete:78,riskLevel:'attention',assessmentStatus:'assessed',ability:{business:77,system:80,communication:75},supportPlan:'加强营销开口与异议处理，明日安排1轮复测。',history:[{at:now(),actor:'培训师 刘颖',action:'完成阶段能力评估'}]},
  ],
  programs:[
    {id:'TP-20260724-001',title:'续约业务规范集中传达',source:'昨日重复来电TOP问题',audience:'普通客服一区',audienceCount:86,owner:'刘颖',targetCoverage:100,targetPassRate:95,actualCoverage:77.9,actualPassRate:93.1,progress:78,dueAt:'2026-07-24T14:00:00+08:00',status:'active',effectStatus:'not_submitted',baseline:'重复来电率4.5%',result:'已覆盖67/86人，待完成尾班传达和补测。',history:[{at:now(),actor:'系统',action:'根据重复来电TOP问题生成岗中专项'}]},
    {id:'TP-20260724-002',title:'投诉升级首次联系场景演练',source:'质检重大投诉复盘',audience:'预警专席',audienceCount:28,owner:'周静',targetCoverage:100,targetPassRate:90,actualCoverage:53.6,actualPassRate:86.7,progress:55,dueAt:'2026-07-24T16:00:00+08:00',status:'active',effectStatus:'not_submitted',baseline:'首次联系规范率89.4%',result:'已完成脚本校准，15人完成首轮演练。',history:[{at:now(),actor:'质检专员',action:'推送重大投诉复盘培训需求'}]},
    {id:'TP-20260724-003',title:'工单八步曲与建单合规',source:'工单规范TOP2',audience:'新工 + 尾端员工',audienceCount:35,owner:'刘颖',targetCoverage:100,targetPassRate:96,actualCoverage:100,actualPassRate:96.8,progress:92,dueAt:'2026-07-25T10:00:00+08:00',status:'active',effectStatus:'not_submitted',baseline:'建单合规率93.9%',result:'课程与错例已发布，全员测试达标，待提交质检效果验证。',history:[{at:now(),actor:'系统',action:'根据工单规范TOP2生成岗中专项'}]},
  ],
})

const initialQuality=()=>({
  version:2,
  plans:[
    {
      id:'QPL-20260725-001',name:'10015前台日常质量抽检',project:'10015升投',owner:'质检专员 钱敏',date:dateKey(0),
      targetSamples:150,completedSamples:148,targetEmployeeCoverage:30,actualEmployeeCoverage:27.5,targetTimelyRate:95,actualTimelyRate:87.5,
      status:'active',dueAt:new Date(`${dateKey(0)}T17:30:00+08:00`).toISOString(),
      strata:[
        {team:'普通客服一区·8班',target:35,completed:35,employeeCoverage:31.2},
        {team:'普通客服一区·6班',target:30,completed:29,employeeCoverage:28.4},
        {team:'普通客服二区·3班',target:30,completed:29,employeeCoverage:26.8},
        {team:'预警专席区·1班',target:30,completed:30,employeeCoverage:25.9},
        {team:'新工实操组',target:25,completed:25,employeeCoverage:24.6},
      ],
      history:[{at:now(),actor:'质量系统',action:'按班组、员工周期和风险等级生成分层抽检计划'}],
    },
  ],
  records:[
    {id:'QR-20260725-001',planId:'QPL-20260725-001',callId:'CALL-10015-0725-0918',employeeId:'JR10913',employeeName:'王芳',team:'普通客服一区·8班',business:'续约业务',score:72,result:'failed',severity:'critical',problem:'承诺期解释不完整，未完成办理结果复述',standard:'续约四步解释法 V3.2',evidence:'09:18录音 03:22—04:10',inspector:'钱敏',inspectedAt:now(),appealStatus:'appealed',collaborationTaskId:'',history:[{at:now(),actor:'钱敏',action:'完成抽检并识别重大规范问题'}]},
    {id:'QR-20260725-002',planId:'QPL-20260725-001',callId:'CALL-10015-0725-0936',employeeId:'JR11005',employeeName:'孙雷',team:'普通客服一区·8班',business:'套餐办理',score:78,result:'failed',severity:'major',problem:'办理路径解释缺失，未进行二次确认',standard:'一次解决质检标准 V2.8',evidence:'09:36录音 05:01—05:42',inspector:'钱敏',inspectedAt:now(),appealStatus:'none',collaborationTaskId:'',history:[{at:now(),actor:'钱敏',action:'完成抽检并标记为重点员工'}]},
    {id:'QR-20260725-003',planId:'QPL-20260725-001',callId:'CALL-10015-0725-1012',employeeId:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',business:'营销推荐',score:88,result:'failed',severity:'minor',problem:'推荐前需求确认不足',standard:'营销推荐规范 V4.1',evidence:'10:12录音 02:16—02:48',inspector:'钱敏',inspectedAt:now(),appealStatus:'none',collaborationTaskId:'',history:[{at:now(),actor:'钱敏',action:'完成抽检并记录一般规范问题'}]},
    {id:'QR-20260725-004',planId:'QPL-20260725-001',callId:'CALL-10015-0725-1045',employeeId:'JR10381',employeeName:'赵晨',team:'普通客服一区·8班',business:'投诉协同',score:96,result:'passed',severity:'none',problem:'无',standard:'投诉首次联系规范 V2.3',evidence:'10:45录音全程',inspector:'钱敏',inspectedAt:now(),appealStatus:'none',collaborationTaskId:'',history:[{at:now(),actor:'钱敏',action:'抽检通过'}]},
  ],
  appeals:[
    {id:'QA-20260725-001',recordId:'QR-20260725-001',applicantRole:'leader',applicant:'张伟',employeeName:'王芳',team:'普通客服一区·8班',reason:'录音中客户曾打断坐席，申请复核承诺期解释是否应判重大问题。',status:'pending_quality_review',owner:'质检专员',dueAt:new Date(Date.now()+4*60*60*1000).toISOString(),reviewer:'',reviewResult:'',createdAt:now(),updatedAt:now(),history:[{at:now(),actor:'张伟',action:'代表员工提交质量申诉'}]},
    {id:'QA-20260724-003',recordId:'QR-20260725-003',applicantRole:'leader',applicant:'张伟',employeeName:'李倩',team:'普通客服一区·8班',reason:'需求确认已在前段完成，申请结合完整录音复核。',status:'reviewing',owner:'钱敏',dueAt:new Date(Date.now()+2*60*60*1000).toISOString(),reviewer:'钱敏',reviewResult:'已调取完整录音，等待校准组交叉复核。',createdAt:new Date(Date.now()-3*60*60*1000).toISOString(),updatedAt:now(),history:[{at:new Date(Date.now()-3*60*60*1000).toISOString(),actor:'张伟',action:'提交质量申诉'},{at:now(),actor:'钱敏',action:'受理申诉并调取完整录音'}]},
  ],
  calibrations:[
    {id:'QC-20260725-001',title:'续约承诺期判定口径校准',scope:'质检组8人 + 培训2人',sampleCount:10,targetConsistency:95,actualConsistency:92.4,status:'planned',owner:'质检主管',dueAt:new Date(Date.now()+5*60*60*1000).toISOString(),conclusion:'',participants:['钱敏','周静','刘颖'],history:[{at:now(),actor:'质量系统',action:'根据申诉与质检偏差生成校准任务'}]},
  ],
  cases:[
    {id:'QKB-20260724-001',title:'续约承诺期四步解释优秀案例',category:'业务口径',sourceRecordId:'QR-20260725-004',problem:'客户对承诺期和生效时间存在疑问',standard:'先确认需求—解释规则—说明办理结果—客户复述确认',example:'坐席用客户语言解释承诺期，并在结束前复述生效时间和查询路径。',status:'published',createdBy:'钱敏',reviewedBy:'质检主管',createdAt:new Date(Date.now()-24*60*60*1000).toISOString(),publishedAt:new Date(Date.now()-22*60*60*1000).toISOString(),history:[{at:new Date(Date.now()-22*60*60*1000).toISOString(),actor:'质检主管',action:'审核发布至质检案例库'}]},
    {id:'QKB-20260725-002',title:'营销推荐需求确认缺失反例',category:'营销规范',sourceRecordId:'QR-20260725-003',problem:'未确认客户现有套餐和使用偏好即直接推荐',standard:'营销推荐规范 V4.1',example:'反例片段已脱敏，需补充正确示范话术后发布。',status:'draft',createdBy:'钱敏',reviewedBy:'',createdAt:now(),publishedAt:'',history:[{at:now(),actor:'钱敏',action:'从抽检问题生成案例草稿'}]},
  ],
})

const curatedPhraseSeed=()=>[
 {id:'PHR-001',category:'催单话术',title:'首次催办：让客户听见具体动作',scenario:'工单处理中 · 首次催办',customerSignal:'客户已等待但尚未超时，反复询问“到底什么时候处理”',objective:'用正在做的动作、下一节点和反馈时间体现主动推进，不用空泛的“请耐心等待”。',text:'您这件事我现在就替您往前推，不让它停在“处理中”。我先核对当前卡在哪个环节，随后联系处理人员确认进度；无论是否已经有最终结果，我都会在今天16点前主动给您一次反馈，您不用再重复来电说明。',steps:['复述客户等待时长和当前诉求','说明马上执行的两个具体动作','给出可兑现的首次反馈时间','承诺主动反馈，减少客户重复说明'],avoid:['请耐心等待','已经帮您催了','有结果会通知您'],sourceRecordingId:'REC-202607-002',employeeName:'刘欣',qualityScore:97,tags:['首次催办','主动反馈','节点承诺'],useCount:23},
 {id:'PHR-002',category:'催单话术',title:'超时催办：先承认延误再升级',scenario:'工单已超时 · 客户情绪高',customerSignal:'客户明确指出已超过承诺时间，并质疑无人负责',objective:'不推责、不重复安抚，明确承认超时并告知升级对象、催办重点和回告节点。',text:'您着急是有原因的，这件事已经超过之前约定的时间。现在由我继续跟进：我会把“已超时”和您当前受影响的情况一起升级给负责人，请对方优先确认；我在30分钟内先回告您是否已接手，最晚今天18点前再同步处理进展。',steps:['明确承认已超时','说明本次升级增加了什么信息','设置短回告和进展回告两个节点','记录客户可接受的联系方式'],avoid:['这不是我们部门处理','只能继续等','已经加急，时间不能保证'],sourceRecordingId:'REC-202607-002',employeeName:'刘欣',qualityScore:97,tags:['超时催办','升级处理','双节点反馈'],useCount:19},
 {id:'PHR-003',category:'催单话术',title:'暂无结果：如实说明但不停在解释',scenario:'上游尚未反馈 · 暂无最终结果',customerSignal:'客户再次来电，但处理部门尚未返回结论',objective:'诚实说明没有结果，同时展示已核验内容和下一步追踪动作，避免虚假承诺。',text:'我刚刚再次核对了记录，目前处理部门还没有返回最终结论，我不想用“正在处理”敷衍您。现在能确认的是工单仍在有效流程内；我会继续追问具体卡点，并在17点前把“处理到哪一步、还差什么、下一次完成时间”三项信息明确反馈给您。',steps:['如实说明当前没有最终结论','告诉客户已经核验到的事实','追问卡点而非只发送催办','下一次反馈必须包含三项具体信息'],avoid:['后台还没回','我也没有办法','您晚点再打来看看'],sourceRecordingId:'REC-202607-002',employeeName:'刘欣',qualityScore:97,tags:['进度回告','如实沟通','拒绝敷衍'],useCount:16},
 {id:'PHR-004',category:'问题解决话术',title:'错充号码：先核实订单，再选择挽回路径',scenario:'话费错充到其他号码',customerSignal:'客户发现充值号码填写错误，希望立即退回或转回',objective:'先锁定订单状态和号码归属，再按可撤销、未到账、已到账三种结果给路径，不把“建工单”当作第一动作。',text:'您先别重复充值，我先帮您把这笔订单核清楚。请您确认充值时间、金额、充值渠道和充错的号码后四位。我会先查订单是否成功、是否仍可拦截：如果尚未到账，我们优先尝试撤销；如果已经到账，我再根据充值渠道和号码状态确认能否发起协商退回。只有需要跨部门核查时才为您建立工单，并把所需凭证和处理时限一次讲清。',steps:['提醒客户暂停重复充值，避免扩大损失','核对时间、金额、渠道、目标号码和订单号','查询订单为处理中、失败或成功','按状态给撤销、原路退回或协商处理路径','确需建单时一次收齐支付凭证'],avoid:['充错了肯定退不了','我先给您建个工单','您自己联系对方号码'],sourceRecordingId:'REC-202607-003',employeeName:'质检示范',qualityScore:98,tags:['错充','订单核验','优先解决'],useCount:31},
 {id:'PHR-005',category:'问题解决话术',title:'重复扣费：先分清扣费来源和账期',scenario:'同一业务疑似重复扣费',customerSignal:'客户发现两笔相似费用，认为被重复收取',objective:'用账期、业务名称和支付渠道核对是否真重复；能现场解释或退订的立即处理。',text:'我先和您把两笔费用逐项对清，不急着让您再提交材料。请您看一下扣费日期和金额，我同步核对业务名称、所属账期以及是话费账单还是第三方支付。如果确认是同一业务同一账期重复扣收，我会按规则直接发起退费核验；如果是两个不同业务，我会把名称、订购时间和取消方式逐项告诉您，由您决定保留哪一项。',steps:['核对两笔费用日期、金额和渠道','区分账期费用、增值业务和第三方代扣','确认重复则进入退费核验','非重复则逐项解释并提供退订选择'],avoid:['账单上就是这样显示的','可能是您订了两个业务','先投诉后续再查'],sourceRecordingId:'REC-202607-003',employeeName:'质检示范',qualityScore:98,tags:['重复扣费','账单核对','现场解决'],useCount:24},
 {id:'PHR-006',category:'问题解决话术',title:'办理未生效：现场完成四项排查',scenario:'业务已办理但无法使用',customerSignal:'客户收到办理成功提示，但功能尚未生效',objective:'围绕办理结果、生效时间、终端状态和使用条件现场排查，无法解决再精准建单。',text:'我看到业务已经办理成功，咱们先不重复办理。我和您一起排查四项：第一看约定的生效时间，第二确认当前套餐状态，第三请您刷新网络或重启终端，第四核对使用范围。如果前面三项都正常仍无法使用，我会把已完成的排查结果一并提交技术处理，避免后续再让您重复操作。',steps:['确认办理流水与生效时间','核对账户和套餐状态','指导一次必要的终端刷新','确认地域、网络和使用范围','带排查结论精准建单'],avoid:['系统显示正常','您重启试试吧','只能建单等处理'],sourceRecordingId:'REC-202607-001',employeeName:'赵晨',qualityScore:98,tags:['办理未生效','四项排查','避免重复建单'],useCount:27},
 {id:'PHR-007',category:'优秀服务话术',title:'专业开场：敬语简洁，不机械复读',scenario:'客户直接描述问题',customerSignal:'客户已清楚说明来电事项，不需要重复完整身份话术',objective:'用敬语确认已经听懂，并立即进入处理，避免机械复述和无效寒暄。',text:'您好，您刚才说的情况我听清楚了：这笔费用您不认可，希望先查明扣费来源。请您稍等，我现在就为您核对账单明细。',steps:['使用“您好、请您”等自然敬语','只复述核心问题，不重复客户所有原话','说明马上执行的动作','避免连续道歉和模板化寒暄'],avoid:['亲，您消消气','我这边帮您看一下哈','请问您还有什么问题需要咨询'],sourceRecordingId:'REC-202607-001',employeeName:'赵晨',qualityScore:98,tags:['专业开场','敬语','需求复述'],useCount:38},
 {id:'PHR-008',category:'优秀服务话术',title:'解释规则：先讲客户结果，再讲规则依据',scenario:'规则限制或无法直接满足',customerSignal:'客户诉求与现行规则存在冲突，容易因“不能办理”升级情绪',objective:'避免生硬引用规定，先说明对客户的影响，再解释原因并给替代方案。',text:'我先把结果向您说明：这项业务今天不能直接取消，是因为本月费用已经按整月生成；但我可以现在为您关闭下月自动续订，并帮您核对本月是否具备减免条件。这样处理后，下月不会再继续产生这项费用。',steps:['先给客户明确结果','用一句话解释关键规则','立即提供可执行替代方案','复述替代方案产生的实际效果'],avoid:['系统不允许','公司规定就是这样','这个没办法处理'],sourceRecordingId:'REC-202607-001',employeeName:'赵晨',qualityScore:98,tags:['规则解释','替代方案','专业表达'],useCount:35},
 {id:'PHR-009',category:'优秀服务话术',title:'结束确认：结果、时间、查询路径一次说清',scenario:'业务办理或问题处理结束',customerSignal:'客户准备结束通话，需要确认后续是否还要操作',objective:'用最少的话完整交付结果，避免“还有其他问题吗”的无效结束语。',text:'我为您确认一下最终结果：业务已经取消，今天受理、明天生效，下月不会再扣费；您可以在联通APP“已订业务”中查询。今天不需要再做其他操作，如果明天仍显示未生效，凭本次受理编号可以直接继续查询。',steps:['复述已完成的动作','明确生效时间和费用影响','提供一个查询路径','说明异常时如何继续处理'],avoid:['已经给您处理好了','应该明天生效','没有问题就挂机了'],sourceRecordingId:'REC-202607-001',employeeName:'赵晨',qualityScore:98,tags:['结果确认','查询路径','专业结束'],useCount:42},
]

const excellenceDimensionValues={
 'EA-001':{productivity:108.4,quality:96,satisfaction:98.8,fcr:96.2,marketing:112.5},
 'EA-002':{productivity:105.7,quality:95,satisfaction:99.3,fcr:93.8,marketing:108.2},
 'EA-003':{productivity:103.6,quality:94,satisfaction:99.1,fcr:94.5,marketing:104.8},
 'EA-004':{productivity:107.2,quality:93,satisfaction:98.2,fcr:92.1,marketing:101.0},
 'EA-005':{productivity:101.8,quality:92,satisfaction:97.8,fcr:90.1,marketing:103.5},
 'EA-006':{productivity:99.6,quality:91,satisfaction:96.7,fcr:91.3,marketing:98.4},
 'EA-007':{productivity:98.9,quality:90,satisfaction:97.1,fcr:88.7,marketing:96.2},
 'EA-008':{productivity:96.2,quality:86,satisfaction:95.8,fcr:87.9,marketing:96.2},
 'EA-009':{productivity:94.8,quality:84,satisfaction:94.9,fcr:85.8,marketing:91.5},
 'EA-010':{productivity:92.6,quality:82,satisfaction:91.6,fcr:84.2,marketing:88.7},
}
const excellenceDimensions=item=>{
 const values=excellenceDimensionValues[item.id]||{productivity:0,quality:Number(item.qualityScore||0),satisfaction:0,fcr:0,marketing:0}
 const definitions=[
  ['productivity','产能达成率',100,values.productivity],['quality','质量质检得分',95,values.quality],
  ['satisfaction','客户满意度',97,values.satisfaction],['fcr','一次性解决率',90,values.fcr],
  ['marketing','营销达成率',100,values.marketing],
 ]
 return definitions.map(([code,label,target,actual])=>({code,label,weight:20,unit:code==='quality'?'分':'%',target,actual,score:Math.min(120,Number(actual)/Number(target)*100)}))
}
const withExcellenceScorecard=item=>{
 const dimensions=Array.isArray(item.dimensions)&&item.dimensions.length===5?item.dimensions:excellenceDimensions(item)
 const compositeScore=dimensions.reduce((total,metric)=>total+Number(metric.score??Math.min(120,Number(metric.actual)/Number(metric.target)*100))*Number(metric.weight)/100,0)
 return {...item,dimensions,compositeScore:Number(compositeScore.toFixed(1))}
}

const initialExcellence=()=>({
  version:1,
  scorecardVersion:2,
  evaluation:{period:'2026年7月',topPercent:20,rule:'产能、质量质检、客户满意度、一次性解决率、营销达成五项等权，各占20%；按综合评分降序，同分时依次比较质量质检得分、有效任务单数',minimumEvidenceTasks:2,weights:{productivity:20,quality:20,satisfaction:20,fcr:20,marketing:20}},
  employeeAchievements:[
    {id:'EA-001',jobNo:'JR10381',name:'赵晨',team:'普通客服一区·8班',metric:'一次解决率',unit:'%',target:90,actual:96.2,qualityScore:96,effectiveTaskCount:5},
    {id:'EA-002',jobNo:'JR10822',name:'刘欣',team:'普通客服一区·6班',metric:'客户满意率',unit:'%',target:97,actual:99.3,qualityScore:95,effectiveTaskCount:4},
    {id:'EA-003',jobNo:'JR10776',name:'李倩',team:'普通客服一区·8班',metric:'客户满意率',unit:'%',target:97,actual:99.1,qualityScore:94,effectiveTaskCount:4},
    {id:'EA-004',jobNo:'JR10691',name:'周浩',team:'普通客服一区·6班',metric:'续约成功率',unit:'%',target:21,actual:21.2,qualityScore:93,effectiveTaskCount:3},
    {id:'EA-005',jobNo:'JR10517',name:'陈敏',team:'普通客服一区·5班',metric:'一次解决率',unit:'%',target:90,actual:90.1,qualityScore:92,effectiveTaskCount:3},
    {id:'EA-006',jobNo:'JR10438',name:'郭悦',team:'普通客服一区·4班',metric:'客户满意率',unit:'%',target:97,actual:96.7,qualityScore:91,effectiveTaskCount:2},
    {id:'EA-007',jobNo:'JR10182',name:'魏琳',team:'普通客服一区·2班',metric:'建单合规率',unit:'%',target:96,actual:94.9,qualityScore:90,effectiveTaskCount:2},
    {id:'EA-008',jobNo:'JR10913',name:'王芳',team:'普通客服一区·8班',metric:'续约成功率',unit:'%',target:21,actual:20.2,qualityScore:86,effectiveTaskCount:2},
    {id:'EA-009',jobNo:'JR11005',name:'孙雷',team:'普通客服一区·8班',metric:'一次解决率',unit:'%',target:90,actual:85.8,qualityScore:84,effectiveTaskCount:1},
    {id:'EA-010',jobNo:'JR10276',name:'林雪',team:'普通客服一区·4班',metric:'客户满意率',unit:'%',target:97,actual:91.6,qualityScore:82,effectiveTaskCount:1},
  ].map(withExcellenceScorecard),
  experiences:[
    {id:'EXP-202607-001',title:'续约争议“四步确认”闭环法',category:'续约业务',sourceTaskId:'TK-202607-021',sourceTaskTitle:'8班续约争议重复来电改善',ownerJobNo:'JR10381',ownerName:'赵晨',team:'普通客服一区·8班',metric:'重复来电率',unit:'%',direction:'lower',baseline:6.1,target:4.5,actual:3.8,actionSummary:'先复述客户争议点，再按承诺期、办理结果、查询路径和客户确认四步闭环。',steps:['定位客户真正争议点并复述确认','用客户语言解释承诺期与生效时间','复述办理结果和查询路径','邀请客户复述并纠偏'],evidence:['连续7日样本126通','质检复核20通，规范率100%'],verifiedBy:'质检主管',verifiedAt:'2026-07-27T10:20:00+08:00',aiPublished:true,publishedAt:'2026-07-27T10:35:00+08:00',keywords:['续约','承诺期','重复来电','生效时间'],invocationCount:18},
    {id:'EXP-202607-002',title:'高峰前30分钟跨班技能预调度',category:'现场运营',sourceTaskId:'TK-202607-018',sourceTaskTitle:'普通客服一区高峰接通率改善',ownerJobNo:'JR10006',ownerName:'刘洋',team:'普通客服一区·6班',metric:'高峰接通率',unit:'%',direction:'higher',baseline:83.4,target:89,actual:91.3,actionSummary:'基于未来30分钟话务预测，提前核对调出侧保护线并按技能标签完成跨班调度。',steps:['读取30分钟话务预测与技能缺口','校验调出班组覆盖率不低于95%','提前10分钟完成技能切换','结束后回填接通率与排队量'],evidence:['连续5个高峰窗口达标','调出侧覆盖率保持96%以上'],verifiedBy:'客服经理',verifiedAt:'2026-07-26T18:00:00+08:00',aiPublished:true,publishedAt:'2026-07-26T18:15:00+08:00',keywords:['接通率','高峰','调度','排队','覆盖率'],invocationCount:11},
    {id:'EXP-202607-003',title:'新人建单错项当日清零法',category:'建单规范',sourceTaskId:'TK-202607-025',sourceTaskTitle:'新工建单合规率提升',ownerJobNo:'JR10776',ownerName:'李倩',team:'普通客服一区·8班',metric:'建单合规率',unit:'%',direction:'higher',baseline:91.8,target:96,actual:97.2,actionSummary:'将当日错项按字段聚类，班后用正反例对照复盘并在次日首单进行班长验证。',steps:['每日汇总错项字段TOP3','为每个错项绑定一个正反例','班后15分钟完成同伴复盘','次日首单由班长抽验'],evidence:['新工样本80单','连续3日合规率高于96%'],verifiedBy:'培训主管',verifiedAt:'2026-07-28T17:20:00+08:00',aiPublished:false,publishedAt:'',keywords:['建单','新工','合规','错项','复盘'],invocationCount:0},
  ],
  recordings:[
    {id:'REC-202607-001',title:'续约承诺期解释与确认示范',callId:'CALL-10015-0726-1420',employeeJobNo:'JR10381',employeeName:'赵晨',team:'普通客服一区·8班',business:'续约业务',durationSeconds:382,qualityScore:98,targetScore:95,submittedBy:'质检专员 钱敏',submittedAt:'2026-07-27T09:30:00+08:00',aiSummary:'坐席在客户情绪较高时先确认争议点，再用三句话讲清承诺期、生效节点和查询路径，结束前完成客户复述确认。',highlights:['00:42 先共情再复述争议点','02:18 用时间线解释承诺期','05:31 让客户复述关键结果'],phraseIds:['PHR-001','PHR-002'],aiPublished:true},
    {id:'REC-202607-002',title:'投诉首次联系情绪降级示范',callId:'CALL-10015-0726-1605',employeeJobNo:'JR10822',employeeName:'刘欣',team:'普通客服一区·6班',business:'投诉协同',durationSeconds:468,qualityScore:97,targetScore:95,submittedBy:'质检专员 钱敏',submittedAt:'2026-07-27T11:10:00+08:00',aiSummary:'坐席避免急于解释，通过确认诉求、说明处理边界和承诺下一节点，将客户情绪从高压引导到可协商状态。',highlights:['01:05 不打断客户陈述','03:12 明确能做与不能做的边界','06:40 给出下一次反馈时间'],phraseIds:['PHR-003'],aiPublished:true},
  ],
  phraseLibraryVersion:2,
  phrases:curatedPhraseSeed(),
})
const initialFinancialPerformance=()=>structuredClone(financialPerformanceSeed)
const initialFinancialPerformances=()=>[initialFinancialPerformance(),structuredClone(reflowFinancialPerformanceSeed)]

const initialPeople=()=>({
  version:1,
  staffingPlans:[
    {
      id:'HC-202607-10015',project:'10015升投',month:'2026-07',approvedHeadcount:502,activeHeadcount:486,
      targetOccupancy:98,actualOccupancy:96.8,hiringTarget:24,interviewed:41,offersAccepted:22,onboarded:18,gap:16,
      owner:'HRBP经理 王丽伟',dueAt:'2026-07-31T18:00:00+08:00',status:'active',managerComment:'',
      channels:[
        {name:'社会招聘',target:14,interviewed:26,accepted:12},
        {name:'内部推荐',target:6,interviewed:9,accepted:6},
        {name:'校企渠道',target:4,interviewed:6,accepted:4},
      ],
      history:[{at:now(),actor:'HRBP经理 王丽伟',action:'根据目标编制、在岗人数和预计离职形成7月补员计划'}],
    },
  ],
  lifecycle:[
    {
      id:'LC-20260725-001',type:'onboarding_batch',title:'7月10015新工班合格人员入列',employeeId:'',employeeName:'',personCount:0,employeeIds:[],
      source:'COH-202607-01',fromOrg:'培训班',toOrg:'普通客服一区',effectiveDate:'2026-07-31',status:'training_pending',
      ownerRole:'training',owner:'培训主管',detail:'培训通关后，系统自动把合格名单推送HRBP完成入职资料、账号、班组和排班准备。',
      managerComment:'',result:'',checklist:{contract:false,medical:false,account:false,shift:false,team:false},
      history:[{at:now(),actor:'系统',action:'根据新工班计划创建待通关入列事项'}],
    },
    {
      id:'LC-20260725-002',type:'transfer',title:'王芳班组调整申请',employeeId:'EMP-10913',employeeName:'王芳',personCount:1,employeeIds:['EMP-10913'],
      source:'HRBP组织盘点',fromOrg:'普通客服一区·8班',toOrg:'普通客服一区·6班',effectiveDate:dateKey(1),status:'hrbp_preparing',
      ownerRole:'hrbp',owner:'HRBP经理 王丽伟',detail:'结合班组人力覆盖和员工适应情况，拟调整至6班；需确认交接、排班和直属班长。',
      managerComment:'',result:'',checklist:{contract:true,medical:true,account:true,shift:false,team:false},
      history:[{at:now(),actor:'HRBP经理 王丽伟',action:'创建员工调动事项并开始核对组织与排班信息'}],
    },
  ],
  laborCases:[
    {
      id:'LR-20260725-001',type:'contract_renewal',employeeId:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',
      title:'劳动合同续签评估',risk:'medium',dueAt:'2026-07-29T17:30:00+08:00',status:'hrbp_todo',ownerRole:'hrbp',owner:'HRBP经理 王丽伟',
      detail:'合同将于30日内到期，需要核对绩效、出勤、员工续签意愿和用工部门意见。',result:'',
      history:[{at:now(),actor:'系统',action:'合同到期前30日自动生成续签评估事项'}],
    },
    {
      id:'LR-20260725-002',type:'grievance',employeeId:'JR12068',employeeName:'张璐',team:'普通客服二区·3班',
      title:'排班公平性员工申诉',risk:'high',dueAt:new Date(Date.now()+8*60*60*1000).toISOString(),status:'manager_pending',ownerRole:'manager',owner:'运营经理',
      detail:'员工反馈连续夜班影响家庭安排，HRBP已完成事实核对，涉及业务资源调整和管理争议，升级经理裁决。',result:'',
      history:[{at:now(),actor:'HRBP经理 王丽伟',action:'完成申诉受理与排班记录核对，升级运营经理裁决'}],
    },
  ],
  costs:[
    {
      id:'COST-10015-202607',project:'10015升投',month:'2026-07',budget:4260000,actual:3478000,forecast:4326000,
      targetPerCapita:8765,actualPerCapita:8897,overtimeCost:168000,recruitmentCost:92000,gap:66000,updatedAt:now(),
      history:[{at:now(),actor:'HRBP经理 王丽伟',action:'更新7月人员成本预测，预计超预算6.6万元'}],
    },
  ],
  interviews:[
    {
      id:'INT-20260725-001',type:'probation',employeeId:'JR11005',employeeName:'孙雷',team:'普通客服一区·8班',interviewer:'HRBP经理 王丽伟',
      scheduledAt:'2026-07-25T15:30:00+08:00',followUpAt:'2026-08-01T15:30:00+08:00',status:'planned',
      conclusion:'',commitments:[],linkedCaseId:'',
      history:[{at:now(),actor:'HRBP经理 王丽伟',action:'创建入列第30天试用期访谈'}],
    },
    {
      id:'INT-20260724-003',type:'retention',employeeId:'JR11832',employeeName:'赵凯',team:'普通客服一区·8班',interviewer:'HRBP经理 王丽伟',
      scheduledAt:'2026-07-24T15:00:00+08:00',followUpAt:'2026-07-31T15:00:00+08:00',status:'followup_due',
      conclusion:'员工愿意留任，主要诉求是理解绩效构成并获得短周期目标辅导。',commitments:['班长连续一周提供目标辅导','HRBP一周后回访留任状态'],linkedCaseId:'HR-260723-004',
      history:[{at:new Date(Date.now()-24*60*60*1000).toISOString(),actor:'HRBP经理 王丽伟',action:'完成留任访谈并形成双方承诺'},{at:now(),actor:'系统',action:'进入承诺回访窗口'}],
    },
  ],
})

const initialLearning=()=>({
  version:2,
  questionBanks:[
    {
      id:'QB-10015-RENEW-V4',title:'10015续约业务与争议处理',version:'V4.2',category:'业务规范',questionCount:38,targetQuestionCount:40,
      passingScore:85,status:'draft',owner:'培训主管 刘颖',updatedAt:now(),
      history:[{at:now(),actor:'培训主管 刘颖',action:'根据续约业务变更与质检案例更新题库，当前38/40题'}],
    },
    {
      id:'QB-ORDER-V3',title:'工单八步曲与建单合规',version:'V3.1',category:'工单规范',questionCount:30,targetQuestionCount:30,
      passingScore:90,status:'published',owner:'培训主管 刘颖',updatedAt:now(),
      history:[{at:now(),actor:'培训主管 刘颖',action:'题库校验完成并发布至岗中考试'}],
    },
  ],
  sessions:[
    {
      id:'LS-20260725-001',title:'续约规范集中学习与考试',type:'onjob',bankId:'QB-10015-RENEW-V4',trainer:'刘颖',room:'线上直播间A',
      startAt:new Date(`${dateKey(0)}T14:00:00+08:00`).toISOString(),endAt:new Date(`${dateKey(0)}T15:00:00+08:00`).toISOString(),
      capacity:90,enrolled:86,attendanceRate:0,targetAttendance:98,status:'planned',
      history:[{at:now(),actor:'培训主管 刘颖',action:'排定课程、讲师、场地和考试题库'}],
    },
    {
      id:'LS-20260724-002',title:'工单建单合规复训',type:'onjob',bankId:'QB-ORDER-V3',trainer:'周静',room:'培训室2',
      startAt:new Date(Date.now()-24*60*60*1000).toISOString(),endAt:new Date(Date.now()-23*60*60*1000).toISOString(),
      capacity:40,enrolled:35,attendanceRate:100,targetAttendance:98,status:'completed',
      history:[{at:now(),actor:'培训主管 刘颖',action:'35人全员参训，场次完成并进入个人考试验证'}],
    },
  ],
  assignments:[
    {
      id:'LA-20260725-001',employeeId:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',leader:'张伟',
      title:'续约争议四步法强化',source:'个人重复来电率高于目标0.2pp',bankId:'QB-10015-RENEW-V4',targetScore:85,
      dueAt:new Date(Date.now()+6*60*60*1000).toISOString(),status:'assigned',score:0,attempts:0,progress:0,reflection:'',
      improvementTarget:'考试≥85分；未来7日重复来电率由4.2%降至4.0%以内。',leaderComment:'',
      abilityDelta:{business:4,system:0,communication:2},history:[{at:now(),actor:'培训主管 刘颖',action:'根据个人质量Gap下发学习与考试任务'}],
    },
    {
      id:'LA-20260724-004',employeeId:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',leader:'张伟',
      title:'营销推荐需求确认规范',source:'质检营销规范问题',bankId:'QB-ORDER-V3',targetScore:90,
      dueAt:new Date(Date.now()-8*60*60*1000).toISOString(),status:'closed',score:94,attempts:1,progress:100,
      reflection:'推荐前先确认客户现有套餐和使用偏好，再进行需求匹配，避免直接介绍产品。',
      improvementTarget:'未来10通营销录音需求确认完整率100%。',leaderComment:'已抽查2通新录音，需求确认完整，继续保持。',
      abilityDelta:{business:2,system:0,communication:3},history:[{at:now(),actor:'张伟',action:'班长验证学习后录音改善，任务关闭'}],
    },
    {
      id:'LA-20260725-002',employeeId:'JR11005',employeeName:'孙雷',team:'普通客服一区·8班',leader:'张伟',
      title:'套餐续约一次解决专项',source:'一次解决率低于成长线4.8pp',bankId:'QB-10015-RENEW-V4',targetScore:85,
      dueAt:new Date(Date.now()+8*60*60*1000).toISOString(),status:'in_progress',score:0,attempts:0,progress:35,reflection:'',
      improvementTarget:'考试≥85分；复盘2通重复来电并由班长验证。',leaderComment:'',
      abilityDelta:{business:5,system:1,communication:2},history:[{at:now(),actor:'孙雷',action:'开始专项学习，当前课程进度35%'}],
    },
  ],
  suggestions:[
    {
      id:'SG-20260724-001',employeeId:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',category:'learning',
      title:'增加续约边界场景练习',detail:'建议在续约课程中增加客户打断、承诺期争议和办理失败三类边界场景录音练习。',
      status:'accepted',owner:'培训主管 刘颖',response:'已纳入V4.2题库和今日14:00场景演练，完成后回传效果。',
      createdAt:new Date(Date.now()-24*60*60*1000).toISOString(),history:[{at:now(),actor:'培训主管 刘颖',action:'采纳员工建议并纳入课程与题库'}],
    },
  ],
  growthReviews:[
    {
      id:'GR-20260725-030',employeeId:'JR11005',employeeName:'孙雷',team:'普通客服一区·8班',leader:'张伟',milestone:30,
      dueAt:new Date(Date.now()+24*60*60*1000).toISOString(),status:'training_review',trainingComment:'',leaderComment:'',
      metrics:[
        {label:'一次解决率',target:88,actual:82.4,unit:'%',higherBetter:true},
        {label:'重复来电率',target:4.5,actual:5.2,unit:'%',higherBetter:false},
        {label:'业务能力',target:80,actual:74,unit:'分',higherBetter:true},
      ],
      history:[{at:now(),actor:'系统',action:'入列第30日自动生成成长评估，推送培训岗分析能力差距'}],
    },
    {
      id:'GR-20260725-090',employeeId:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',leader:'张伟',milestone:90,
      dueAt:new Date(Date.now()+3*24*60*60*1000).toISOString(),status:'planned',trainingComment:'',leaderComment:'',
      metrics:[
        {label:'月度CPH',target:15,actual:15.8,unit:'',higherBetter:true},
        {label:'一次解决率',target:90,actual:89.1,unit:'%',higherBetter:true},
        {label:'重复来电率',target:4,actual:4.2,unit:'%',higherBetter:false},
      ],
      history:[{at:now(),actor:'系统',action:'生成入列第90日能力与绩效综合评估计划'}],
    },
  ],
  developmentCases:[
    {
      id:'DV-20260727-001',type:'training',title:'续约争议四步法强化训练',reason:'个人重复来电率高于目标0.2pp，需要结合真实录音强化关键步骤。',
      goal:'完成课程与2通录音复盘，未来7日重复来电率降至4.0%以内。',employeeId:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',
      initiatorRole:'training',initiatorName:'培训主管 刘颖',responderRole:'employee',responderName:'李倩',ownerRole:'employee',verificationRole:'training',
      status:'in_progress',dueAt:new Date(Date.now()+8*60*60*1000).toISOString(),createdAt:new Date(Date.now()-2*60*60*1000).toISOString(),
      acknowledgement:'已接收任务，计划在今日15:00前完成课程和录音复盘。',result:'',verificationComment:'',
      history:[{at:new Date(Date.now()-2*60*60*1000).toISOString(),actor:'培训主管 刘颖',action:'发起个人强化训练并明确效果目标'},{at:new Date(Date.now()-90*60*1000).toISOString(),actor:'李倩',action:'接收培训任务并反馈完成计划'}],
    },
    {
      id:'DV-20260727-002',type:'interview',title:'月度目标与薪资成长面谈',reason:'当前产能接近目标但满意率距离五星标准0.6pp，需要共同拆解下一阶段目标。',
      goal:'确认未来7日产能、满意率与营销三个行动目标，并形成每日复盘节奏。',employeeId:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',
      initiatorRole:'leader',initiatorName:'张伟',responderRole:'employee',responderName:'李倩',ownerRole:'leader',verificationRole:'leader',
      status:'pending_verification',dueAt:new Date(Date.now()+5*60*60*1000).toISOString(),createdAt:new Date(Date.now()-20*60*60*1000).toISOString(),
      acknowledgement:'已确认今日11:30进行目标面谈。',result:'已完成面谈，确认每日有效话务量≥95通、满意率≥97%、营销有效推荐≥8次，并由本人每日下班前复盘。',verificationComment:'',
      history:[{at:new Date(Date.now()-20*60*60*1000).toISOString(),actor:'张伟',action:'发起月度目标面谈'},{at:new Date(Date.now()-4*60*60*1000).toISOString(),actor:'李倩',action:'完成面谈并向发起班长反馈行动承诺'}],
    },
    {
      id:'DV-20260727-003',type:'training',title:'申请质检陪听与规范反馈',reason:'对续约承诺期边界仍不确定，希望质检结合本人真实录音给出判断。',
      goal:'质检陪听2通录音，标注规范问题并给出可执行的标准话术建议。',employeeId:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',
      initiatorRole:'employee',initiatorName:'李倩',responderRole:'quality',responderName:'质检专员',ownerRole:'quality',verificationRole:'employee',
      status:'pending_acceptance',dueAt:new Date(Date.now()+26*60*60*1000).toISOString(),createdAt:new Date(Date.now()-45*60*1000).toISOString(),
      acknowledgement:'',result:'',verificationComment:'',
      history:[{at:new Date(Date.now()-45*60*1000).toISOString(),actor:'李倩',action:'发起质检陪听培训需求，等待责任岗位回执'}],
    },
    {
      id:'DV-20260726-004',type:'interview',title:'新人阶段适应与稳定回访',reason:'入职90日节点，需要确认工作适应、排班感受与后续发展诉求。',
      goal:'完成结构化回访，明确需要协调的事项并完成员工确认。',employeeId:'JR10776',employeeName:'李倩',team:'普通客服一区·8班',
      initiatorRole:'hrbp',initiatorName:'HRBP经理 王丽伟',responderRole:'employee',responderName:'李倩',ownerRole:'hrbp',verificationRole:'hrbp',
      status:'closed',dueAt:new Date(Date.now()-18*60*60*1000).toISOString(),createdAt:new Date(Date.now()-2*24*60*60*1000).toISOString(),
      acknowledgement:'已确认回访时间。',result:'工作适应稳定，希望增加营销产品知识训练；暂无离职倾向。',verificationComment:'回访结果有效，培训需求已转培训主管，纳入员工成长档案。',
      history:[{at:new Date(Date.now()-2*24*60*60*1000).toISOString(),actor:'HRBP经理 王丽伟',action:'发起新人阶段回访'},{at:new Date(Date.now()-24*60*60*1000).toISOString(),actor:'李倩',action:'反馈阶段适应与发展诉求'},{at:new Date(Date.now()-23*60*60*1000).toISOString(),actor:'HRBP经理 王丽伟',action:'验收回访结果并关闭归档'}],
    },
    {
      id:'DV-20260727-005',type:'training',title:'质检TOP问题班组补训',reason:'承诺期解释缺项在普通客服一区连续两日位列质检问题TOP1。',
      goal:'完成8班全员补训，抽测规范率达到95%以上。',employeeId:'JR10913',employeeName:'王芳',team:'普通客服一区·8班',
      initiatorRole:'quality',initiatorName:'质检专员',responderRole:'employee',responderName:'王芳',ownerRole:'employee',verificationRole:'quality',
      status:'returned',dueAt:new Date(Date.now()+3*60*60*1000).toISOString(),createdAt:new Date(Date.now()-6*60*60*1000).toISOString(),
      acknowledgement:'已完成知识卡片学习。',result:'已学习承诺期标准并复盘1通录音。',verificationComment:'反馈缺少第2通录音证据，请补齐后重新提交。',
      history:[{at:new Date(Date.now()-6*60*60*1000).toISOString(),actor:'质检专员',action:'发起质检TOP问题补训'},{at:new Date(Date.now()-2*60*60*1000).toISOString(),actor:'王芳',action:'提交学习反馈'},{at:new Date(Date.now()-90*60*1000).toISOString(),actor:'质检专员',action:'验收未通过，退回补充第2通录音'}],
    },
  ],
})

const initialGovernance=()=>({
  version:1,
  shiftPlans:[
    {
      id:'SP-20260726-001',date:dateKey(1),area:'前台普通客服一区',targetCoverage:95,required:77,scheduled:72,
      status:'manager_pending',ownerRole:'manager',owner:'客服经理',dueAt:new Date(Date.now()+4*60*60*1000).toISOString(),
      teams:[
        {team:'普通客服一区·2班',required:15,scheduled:15,gap:0},
        {team:'普通客服一区·4班',required:15,scheduled:12,gap:3},
        {team:'普通客服一区·5班',required:16,scheduled:15,gap:1},
        {team:'普通客服一区·6班',required:16,scheduled:17,gap:-1},
        {team:'普通客服一区·8班',required:15,scheduled:13,gap:2},
      ],
      comment:'已按预测话务量、技能结构和请假情况完成明日排班；4班、8班需通过跨班支援补齐高峰缺口。',
      result:'',history:[{at:now(),actor:'前台客服主管',action:'提交明日全区域排班计划，等待经理审批'}],
    },
  ],
  skillRoutes:[
    {
      id:'SR-20260725-001',source:'AI未来30分钟话务预测',fromSkill:'续约低负荷池',toSkill:'10015前台',
      people:2,window:'11:00—11:30',baselineAnswerRate:83.4,targetAnswerRate:89,actualAnswerRate:0,sourceProtectionAfter:96,
      status:'manager_pending',ownerRole:'manager',owner:'客服经理',dueAt:new Date(Date.now()+90*60*1000).toISOString(),
      result:'',history:[{at:now(),actor:'前台客服主管',action:'提交技能路由调整方案，调出侧预计仍高于96%保护线'}],
    },
  ],
  budgets:[
    {
      id:'BG-2026H1-10015',dataVersion:'2026-08-01-full-year',month:'2026-01—06',project:'河北10015',revenueTarget:1356.95,costBudget:923.86,forecastRevenue:1299.51,forecastCost:852.91,
      targetMargin:27.8,forecastMargin:30.4,status:'director_pending',ownerRole:'director',owner:'运营总监',dueAt:new Date(Date.now()+6*60*60*1000).toISOString(),
      managerComment:'预算已按《河北基地-10015-项目预算.xls》的10015单项目口径更正：H1收入预算1356.95万元、实际1299.51万元，Gap 57.44万元；实际毛利率30.4%高于预算27.8%。全年收入预算2823.26万元，H2需完成1523.75万元、月均253.96万元。',
      directorComment:'',history:[{at:now(),actor:'客服经理',action:'提交7月滚动经营预测与预算偏差说明'}],
    },
  ],
  contracts:[
    {
      id:'CT-10015-20250901',customer:'中国联通河北分公司',project:'10015',amount:7500,billingMode:'固定合同额',startDate:'2025-09-01',endDate:'2027-08-31',renewalDue:'2027-08-31T23:59:59+08:00',status:'active',ownerRole:'manager',owner:'合同管理员',risk:'low',managerComment:'合同有效期两年，总监仅查阅合同状态与到期提醒，不承担续约审批。',directorComment:'',milestones:[],history:[{at:now(),actor:'系统',action:'按最新合同台账更新：合同额7500万元，2027年8月31日到期'}],
    },
    {
      id:'CT-10010-20250901',customer:'中国联通河北分公司',project:'10010',amount:6000,billingMode:'固定合同额',startDate:'2025-09-01',endDate:'2027-08-31',renewalDue:'2027-08-31T23:59:59+08:00',status:'active',ownerRole:'manager',owner:'合同管理员',risk:'low',managerComment:'合同有效期两年，总监仅查阅合同状态与到期提醒，不承担续约审批。',directorComment:'',milestones:[],history:[{at:now(),actor:'系统',action:'按最新合同台账更新：合同额6000万元，2027年8月31日到期'}],
    },
    {
      id:'CT-HBMARKETING-20250901',customer:'中国联通河北分公司',project:'河北营销',amount:null,billingMode:'按佣金结费',startDate:'2025-09-01',endDate:'2027-08-31',renewalDue:'2027-08-31T23:59:59+08:00',status:'active',ownerRole:'manager',owner:'合同管理员',risk:'low',managerComment:'暂无固定合同额，按实际营销业绩及约定佣金规则结费；总监仅查阅与接收到期提醒。',directorComment:'',milestones:[],history:[{at:now(),actor:'系统',action:'按最新合同台账更新：暂无固定合同额，按佣金结费，2027年8月31日到期'}],
    },
  ],
  meetings:[
    {
      id:'OM-20260725-001',date:dateKey(0),title:'河北基地日经营复盘会',status:'draft',ownerRole:'director',owner:'运营总监',
      summary:'围绕经营预测、现场产能、人员稳定和质量风险形成跨岗位决策。',
      conclusions:['河北10015单项目口径下H1收入完成率95.8%、Gap 57.44万元；全年收入预算2823.26万元，H2月均目标253.96万元','普通客服一区高峰覆盖不足，需完成调度验效'],
      actions:[
        {id:'OMA-001',title:'提交河北10015收入追回计划',ownerRole:'manager',owner:'客服经理',dueAt:new Date(Date.now()+8*60*60*1000).toISOString(),target:'分解H1收入Gap 57.44万元，按H2累计1523.75万元、月均253.96万元滚动追踪',status:'draft'},
        {id:'OMA-002',title:'完成高峰技能调度并回填接通率',ownerRole:'supervisor',owner:'前台客服主管',dueAt:new Date(Date.now()+3*60*60*1000).toISOString(),target:'10015前台接通率恢复至89%以上',status:'draft'},
      ],
      publishedAt:'',history:[{at:now(),actor:'系统',action:'根据经营、现场、人力与质量数据生成例会草稿'}],
    },
  ],
  crossDepartmentItems:[
    {
      id:'CD-20260725-001',title:'河北10015全年预算与追回计划',originRole:'director',targetRole:'manager',targetDepartment:'客户驱动部',
      detail:'联合财务与结算岗按河北10015单项目全年预算，将H1收入差额和H2月均目标分解为可验收动作。',
      target:'确认H1收入Gap 57.44万元的追回责任，并按H2月均253.96万元滚动复盘',dueAt:new Date(Date.now()+8*60*60*1000).toISOString(),
      status:'target_doing',ownerRole:'manager',owner:'客服经理',result:'',
      history:[{at:now(),actor:'运营总监',action:'下发跨部门经营协同事项，客服经理开始组织核对'}],
    },
  ],
})

const initialMorningBriefings=()=>{
 const teams=[
  {team:'普通客服一区·2班',leader:'魏琳',supervisor:'前台客服主管',planned:7,held:7,averageScore:93,latestScore:95,quality:'优秀',needsHelp:false,diagnosis:'召开稳定，目标宣讲和员工互动完整，可沉淀为区域示范。'},
  {team:'普通客服一区·4班',leader:'赵敏',supervisor:'前台客服主管',planned:7,held:5,averageScore:74,latestScore:71,quality:'需帮扶',needsHelp:true,diagnosis:'近7日缺开2次，录音中目标量化不足，建议主管跟会并下发改善任务。'},
  {team:'普通客服一区·5班',leader:'陈敏',supervisor:'前台客服主管',planned:7,held:7,averageScore:86,latestScore:88,quality:'达标',needsHelp:false,diagnosis:'召开完整，业务口径清晰；可增加员工复述确认环节。'},
  {team:'普通客服一区·6班',leader:'刘洋',supervisor:'前台客服主管',planned:7,held:7,averageScore:96,latestScore:97,quality:'优秀',needsHelp:false,diagnosis:'数据复盘、业务传达和会后动作均形成闭环，具备复制价值。'},
  {team:'普通客服一区·8班',leader:'张伟',supervisor:'前台客服主管',planned:7,held:6,averageScore:82,latestScore:84,quality:'达标',needsHelp:false,diagnosis:'召开率需提升；重点人员辅导安排清晰，录音完整度良好。'},
 ]
 const scheduleTeams=['普通客服一区·8班','普通客服一区·6班','普通客服一区·4班','普通客服一区·5班','普通客服一区·2班','普通客服一区·8班','普通客服一区·6班']
 const leaders={'普通客服一区·2班':'魏琳','普通客服一区·4班':'赵敏','普通客服一区·5班':'陈敏','普通客服一区·6班':'刘洋','普通客服一区·8班':'张伟'}
 const schedules=scheduleTeams.map((team,index)=>({
  id:`MB-${dateKey(index).replaceAll('-','')}-${team.match(/(\d+)班/)?.[1]||index}`,date:dateKey(index),time:'08:20',team,leader:leaders[team],
  title:index===0?'补齐昨日Gap，统一续约服务口径':index===1?'高峰产能与接通率保障':index===2?'一次解决率专项提升':'日目标复盘与业务重点传达',
  focus:index===0?['昨日六项指标Gap及今日硬目标','续约“四步确认”服务口径','重点员工会后辅导安排']:index===1?['高峰前技能与人力确认','小时级应答目标','异常升级路径']:['昨日指标复盘','当日目标与过程动作','质检及培训重点'],
  source:'AI项目运行诊断 + 主管业务重点',status:index===0?'issued':index<4?'issued':'draft',issuedBy:index<4?'前台客服主管':'',issuedAt:index<4?now():'',
  recording:index===0?{fileName:'8班班前会_0820.m4a',durationSeconds:914,recordedAt:now(),aiSummary:'五个环节完整，目标与业务口径清晰；员工复述环节可进一步加强。'}:null,
  qualityScore:index===0?84:0,qualitySummary:index===0?'结构完整、目标量化清晰；员工互动与复述确认不足。':'',
 }))
 return {version:1,teams,schedules,suggestions:[
  {id:'MBS-001',sourceRole:'quality',sourceName:'质检专员',title:'续约争议四步确认口径',content:'建议未来一周班前会统一宣讲“确认套餐—解释规则—指引办理—复述确认”，并在会后抽测。',targetTeam:'全部班组',proposedDate:dateKey(1),status:'pending',supervisorComment:'',createdAt:now()},
  {id:'MBS-002',sourceRole:'training',sourceName:'培训主管',title:'新人首单建单校验',content:'建议安排新人在班前会完成一组正反例辨析，班长于首单进行字段校验。',targetTeam:'普通客服一区·8班',proposedDate:dateKey(2),status:'adopted',supervisorComment:'纳入周三班前会重点',createdAt:now()},
 ],todayBulletin:{date:dateKey(0),title:'补齐昨日Gap，稳定客户感知',points:['人工应答量与置忙小休按小时校准','续约争议执行“四步确认”','异常口径先查询、再答复、及时升级'],targets:['人工应答量≥1,360通','满意率≥97.2%','一次解决率≥90%','重复来电率≤4%'],businessUpdate:'续约产品办理路径已更新，统一确认套餐、解释规则、指引办理、复述确认。'}}
}

const initialState=()=>({
  meta:{lastRefresh:now(),nextRefresh:new Date(Date.now()+30*60*1000).toISOString(),refreshIntervalMinutes:30,batchNo:41,sourceMode:'simulated'},
  org:{base:'河北基地',business:'10015升投',area:'前台普通客服一区',approvalChain:['leader','supervisor','manager','director']},
  events:[
    {id:'EV-001',type:'员工异常',severity:'critical',title:'王芳连续下滑叠加小休超限',team:'普通客服一区·8班',person:'王芳',evidence:'CPH连续3天下降；小休占比22.6%；本月迟到2次。',suggestion:'完成关注面谈并安排1小时跟岗辅导。',confidence:92,status:'pending_supervisor_review',createdAt:now(),dueAt:new Date(Date.now()+2*60*60*1000).toISOString(),currentRole:'supervisor',reviewer:'前台客服主管',rule:'EMP-RISK-001',source:'产能表+员工日考勤表',history:[{at:now(),actor:'系统',action:'半小时巡检生成预警'}]},
    {id:'EV-002',type:'话务异常',severity:'warning',title:'未来半小时排队预计高于基线38%',team:'10015前台',evidence:'人工请求量同比增长31%，排队挂机数连续两个窗口升高。',suggestion:'从低负载技能组调入3人，延后2人培训30分钟。',confidence:86,status:'pending_supervisor_review',createdAt:now(),dueAt:new Date(Date.now()+75*60*1000).toISOString(),currentRole:'supervisor',reviewer:'前台客服主管',rule:'TRAFFIC-001',source:'f_sh_fwqqmx',history:[{at:now(),actor:'系统',action:'半小时巡检生成预警'}]},
    {id:'EV-003',type:'投诉超时',severity:'critical',title:'2件工单进入超时风险窗口',team:'预警专席区·1班',evidence:'剩余处理时间不足2小时；1件90天内重复投诉2次、催促3次。',suggestion:'转主管督办，30分钟内完成首次联系。',confidence:96,status:'pending_supervisor_review',createdAt:now(),dueAt:new Date(Date.now()+60*60*1000).toISOString(),currentRole:'supervisor',reviewer:'专席客服主管',rule:'COMPLAINT-SLA-001',source:'f_sh_pdlv_details',history:[{at:now(),actor:'系统',action:'半小时巡检生成预警'}]},
    {id:'EV-004',type:'质量趋势',severity:'warning',title:'新人一次解决率低于成长线',team:'普通客服一区·8班',person:'孙雷',evidence:'入列第18天，一次解决率82.4%，低于同批次均值4.8个百分点。',suggestion:'推送续约争议微课并复盘2通案例。',confidence:83,status:'pending_supervisor_review',createdAt:now(),dueAt:new Date(Date.now()+4*60*60*1000).toISOString(),currentRole:'supervisor',reviewer:'前台客服主管',rule:'QUALITY-TREND-001',source:'产能表+接触记录',history:[{at:now(),actor:'系统',action:'半小时巡检生成预警'}]}
  ],
  tasks:[],notifications:[],audit:[{at:now(),actor:'系统',action:'初始化比赛演示数据'}],reportRuns:[],reportDownloads:[],trainingReports:[],
  hrbpCases:[
    {id:'HR-260724-001',employeeId:'JR12068',name:'张璐',team:'普通客服二区·3班',batch:'2026年5月批次',cycle:'实习期',riskScore:91,reasons:['近14日请假3次','绩效连续下降','班长反馈情绪波动'],status:'manager_pending',owner:'运营经理',createdAt:'今日 09:12',due:'今日 15:00',hrbpNote:'员工表达工作适应困难并提出转岗诉求，HRBP无法独立承诺岗位调整，申请经理介入。',managerNote:'',result:'',filedAt:'',filedBy:'',history:[{time:'09:12',actor:'HRBP经理',action:'完成首次沟通，判断需升级经理协调岗位与排班方案'},{time:'09:18',actor:'系统',action:'任务升级运营经理并进入经理PDCA'}]},
    {id:'HR-260723-004',employeeId:'JR11832',name:'赵凯',team:'普通客服一区·8班',batch:'2026年4月批次',cycle:'正式期',riskScore:84,reasons:['收入预期差异','近7日小休升高'],status:'closed',owner:'已关闭',createdAt:'昨日 10:20',due:'昨日 16:00',hrbpNote:'员工对绩效规则理解存在偏差。',managerNote:'已解释绩效构成，安排班长提供一周目标辅导，并确认员工愿意继续稳定工作。',result:'员工留任；一周后由HRBP回访，结果已纳入人员稳定档案。',filedAt:'昨日 15:45',filedBy:'HRBP经理',history:[{time:'昨日 10:20',actor:'HRBP经理',action:'创建重点人员沟通任务'},{time:'昨日 14:05',actor:'HRBP经理',action:'升级运营经理协同'},{time:'昨日 15:40',actor:'运营经理',action:'完成沟通并关闭任务'},{time:'昨日 15:42',actor:'系统',action:'关闭结果回传HRBP备案'},{time:'昨日 15:45',actor:'HRBP经理',action:'确认沟通结果并完成HRBP备案'}]},
  ],
  workforce:initialWorkforce(),
  training:initialTraining(),
  quality:initialQuality(),
  excellence:initialExcellence(),
  financialPerformance:initialFinancialPerformance(),
  financialPerformances:initialFinancialPerformances(),
  people:initialPeople(),
  learning:initialLearning(),
  governance:initialGovernance(),
  morningBriefings:initialMorningBriefings(),
})

const migrateHrbpManagerName=state=>JSON.parse(JSON.stringify(state).replaceAll('陈静','王丽伟'))
const normalizeWorkforce=source=>{
 const workforce=source&&Array.isArray(source.employees)&&Array.isArray(source.requests)?source:initialWorkforce()
 return {...workforce,requests:workforce.requests.map(request=>{
  if(request.kind!=='cross_team_dispatch'||request.status!=='manager_pending'||request.aiWarning!==undefined)return request
  const coverage=workforce.coverage.find(item=>item.team===request.fromTeam)
  if(!coverage)return {...request,aiWarning:null}
  const projectedOnDuty=Math.max(0,coverage.onDuty-1)
  const projectedRate=coverage.required?projectedOnDuty/coverage.required*100:0
  if(projectedRate>=coverage.targetCoverage)return {...request,aiWarning:null}
  return {...request,aiWarning:{
   level:'warning',
   message:`调出后${request.fromTeam}覆盖率预计为${projectedRate.toFixed(1)}%，低于${coverage.targetCoverage}%目标线`,
   impact:`该方案可能使调出班组增加${Math.max(0,coverage.required-projectedOnDuty)}人人力缺口。AI仅提示目标偏差，不替代经理审批。`,
   acknowledged:false,acknowledgedBy:'',acknowledgedAt:'',
  }}
 })}
}
export const normalizeState=rawState=>{
 const state=migrateHrbpManagerName(rawState)
 const learningBase=state.learning&&Array.isArray(state.learning.questionBanks)&&Array.isArray(state.learning.sessions)&&Array.isArray(state.learning.assignments)&&Array.isArray(state.learning.suggestions)&&Array.isArray(state.learning.growthReviews)?state.learning:initialLearning()
 const learning={...learningBase,version:2,developmentCases:Array.isArray(learningBase.developmentCases)?learningBase.developmentCases:initialLearning().developmentCases}
 const excellenceBase=state.excellence?.version===1&&Array.isArray(state.excellence.employeeAchievements)&&Array.isArray(state.excellence.experiences)&&Array.isArray(state.excellence.recordings)&&Array.isArray(state.excellence.phrases)?state.excellence:initialExcellence()
 const curatedPhraseIds=new Set(curatedPhraseSeed().map(item=>item.id))
 const customPhrases=excellenceBase.phrases.filter(item=>!curatedPhraseIds.has(item.id))
 const excellence={...excellenceBase,scorecardVersion:2,evaluation:initialExcellence().evaluation,phraseLibraryVersion:2,employeeAchievements:excellenceBase.employeeAchievements.map(item=>withExcellenceScorecard(item.id==='EA-002'&&item.actual>100?{...item,actual:99.3}:item)),phrases:[...curatedPhraseSeed(),...customPhrases]}
 const financialPerformance=state.financialPerformance?.version===1&&Array.isArray(state.financialPerformance.metrics)&&state.financialPerformance.sources?.budget?.fileName===financialPerformanceSeed.sources.budget.fileName?state.financialPerformance:initialFinancialPerformance()
 const financialPerformances=initialFinancialPerformances()
 const morningBriefings=state.morningBriefings?.version===1&&Array.isArray(state.morningBriefings.teams)&&Array.isArray(state.morningBriefings.schedules)&&Array.isArray(state.morningBriefings.suggestions)?state.morningBriefings:initialMorningBriefings()
 const governanceBase=state.governance?.version===1&&Array.isArray(state.governance.shiftPlans)&&Array.isArray(state.governance.skillRoutes)&&Array.isArray(state.governance.budgets)&&Array.isArray(state.governance.contracts)&&Array.isArray(state.governance.meetings)&&Array.isArray(state.governance.crossDepartmentItems)?state.governance:initialGovernance()
 const budgetSeed=initialGovernance().budgets[0]
 const budgetCurrent=governanceBase.budgets.find(item=>['BG-202607-10015','BG-2026H1-NORTH1','BG-2026H1-10015'].includes(item.id))
 const budgetDataChanged=budgetCurrent?.dataVersion!==budgetSeed.dataVersion
 const budgetUpdated=budgetCurrent?{...budgetCurrent,id:budgetSeed.id,dataVersion:budgetSeed.dataVersion,month:budgetSeed.month,project:budgetSeed.project,revenueTarget:budgetSeed.revenueTarget,costBudget:budgetSeed.costBudget,forecastRevenue:budgetSeed.forecastRevenue,forecastCost:budgetSeed.forecastCost,targetMargin:budgetSeed.targetMargin,forecastMargin:budgetSeed.forecastMargin,managerComment:budgetDataChanged?budgetSeed.managerComment:budgetCurrent.managerComment}:budgetSeed
 const contractSeed=initialGovernance().contracts,contractsCurrent=governanceBase.contracts.length===3&&governanceBase.contracts.every(item=>contractSeed.some(seed=>seed.id===item.id))
 const governance={...governanceBase,budgets:[budgetUpdated,...governanceBase.budgets.filter(item=>!['BG-202607-10015','BG-2026H1-NORTH1','BG-2026H1-10015'].includes(item.id))],contracts:contractsCurrent?governanceBase.contracts:contractSeed}
 return {...state,reportRuns:Array.isArray(state.reportRuns)?state.reportRuns:[],reportDownloads:Array.isArray(state.reportDownloads)?state.reportDownloads:[],trainingReports:Array.isArray(state.trainingReports)?state.trainingReports:[],hrbpCases:Array.isArray(state.hrbpCases)?state.hrbpCases:initialState().hrbpCases,workforce:normalizeWorkforce(state.workforce),training:state.training&&Array.isArray(state.training.cohorts)&&Array.isArray(state.training.trainees)&&Array.isArray(state.training.programs)?{...state.training,cohorts:state.training.cohorts.map(cohort=>({...cohort,forecastPassRate:Number(cohort.forecastPassRate)||88.5}))}:initialTraining(),quality:state.quality?.version===2&&Array.isArray(state.quality.plans)&&Array.isArray(state.quality.records)&&Array.isArray(state.quality.appeals)&&Array.isArray(state.quality.calibrations)&&Array.isArray(state.quality.cases)?state.quality:initialQuality(),excellence,financialPerformance,financialPerformances,morningBriefings,people:state.people?.version===1&&Array.isArray(state.people.staffingPlans)&&Array.isArray(state.people.lifecycle)&&Array.isArray(state.people.laborCases)&&Array.isArray(state.people.interviews)?state.people:initialPeople(),learning,governance}
}

export function load(){
 if(!fs.existsSync(dataFile)){const s=initialState();save(s);return s}
 try{
  const raw=fs.readFileSync(dataFile,'utf8').trim()
  if(!raw) throw new Error('状态文件为空')
  const parsed=JSON.parse(raw)
  if(!parsed.meta||!Array.isArray(parsed.events)||!Array.isArray(parsed.tasks)) throw new Error('状态文件结构不完整')
  const normalized=normalizeState(parsed)
  const contractIds=['CT-10015-20250901','CT-10010-20250901','CT-HBMARKETING-20250901']
  const contractsCurrent=parsed.governance?.contracts?.length===3&&parsed.governance.contracts.every(item=>contractIds.includes(item.id))
  if(raw.includes('陈静')||!parsed.training||parsed.training.cohorts?.some(cohort=>!Number(cohort.forecastPassRate))||parsed.quality?.version!==2||parsed.excellence?.version!==1||parsed.excellence?.scorecardVersion!==2||parsed.excellence?.phraseLibraryVersion!==2||parsed.excellence?.employeeAchievements?.some(item=>item.id==='EA-002'&&item.actual>100)||parsed.financialPerformance?.version!==1||parsed.financialPerformance?.sources?.budget?.fileName!==financialPerformanceSeed.sources.budget.fileName||!Array.isArray(parsed.financialPerformances)||parsed.financialPerformances.length!==2||parsed.morningBriefings?.version!==1||parsed.people?.version!==1||parsed.learning?.version!==2||!Array.isArray(parsed.learning?.developmentCases)||parsed.governance?.version!==1||!contractsCurrent)save(normalized)
  return normalized
 }catch(error){
  console.warn(`状态文件损坏，自动恢复：${error.message}`)
  try{
   if(fs.existsSync(backupFile)){
    const backup=normalizeState(JSON.parse(fs.readFileSync(backupFile,'utf8')))
    save(backup)
    return backup
   }
  }catch{}
  const s=initialState();save(s);return s
 }
}
export function save(state){
 fs.mkdirSync(path.dirname(dataFile),{recursive:true})
 const content=JSON.stringify(state,null,2)
 fs.writeFileSync(tempFile,content,'utf8')
 if(fs.existsSync(dataFile)){
  try{fs.copyFileSync(dataFile,backupFile)}catch{}
 }
 fs.renameSync(tempFile,dataFile)
 return state
}
export function reset(){
 const s=normalizeState(initialState())
 fs.mkdirSync(dataDir,{recursive:true})
 fs.rmSync(path.join(dataDir,'generated'),{recursive:true,force:true})
 const content=JSON.stringify(s,null,2)
 fs.writeFileSync(tempFile,content,'utf8')
 fs.renameSync(tempFile,dataFile)
 fs.writeFileSync(backupFile,content,'utf8')
 return s
}
export {now,dataDir}
