import { Alert, Metric, RoleMeta, TaskItem, TeamMember } from '../types'

export const roles: RoleMeta[] = [
  { id:'director', label:'运营总监', scope:'河北基地全域', initials:'总' },
  { id:'manager', label:'客服经理', scope:'10015升投', initials:'经' },
  { id:'supervisor', label:'客服主管', scope:'前台普通客服一区', initials:'主' },
  { id:'leader', label:'客服班长', scope:'普通客服一区 · 8班', initials:'班' },
  { id:'employee', label:'客服专员', scope:'个人视图', initials:'员' },
  { id:'quality', label:'质检专员', scope:'业务驱动部 · 质培管理', initials:'质' },
  { id:'training', label:'培训主管', scope:'业务驱动部 · 质培管理', initials:'培' },
  { id:'hrbp', label:'HRBP经理', scope:'HAC支持部', initials:'H' }
]

export const metrics: Metric[] = [
  { label:'人工应答量', value:'1,284', target:'日目标 1,360', delta:-5.6, status:'risk', source:'bpo_dws_base_pord_sum', field:'YDL_rdc / YDL_rmb' },
  { label:'人工服务满意率', value:'96.8%', target:'目标 97.2%', delta:-0.4, status:'risk', source:'bpo_dws_base_pord_sum', field:'RGFWMYL_RDC / RGFWMYL_rmb' },
  { label:'前台一次解决率', value:'89.6%', target:'目标 88.0%', delta:1.6, status:'good', source:'bpo_dws_base_pord_sum', field:'QTYCXJJL_RDC / QTYCXJJL_rmb' },
  { label:'2小时重复来电率', value:'4.7%', target:'目标 ≤ 4.0%', delta:0.7, status:'bad', source:'bpo_dws_base_pord_sum', field:'twoxscfldl_rdc / twoxscfldl_rmb' },
  { label:'置忙小休占比', value:'13.4%', target:'目标 ≤ 12.0%', delta:1.4, status:'bad', source:'bpo_dws_base_pord_sum', field:'ZMXXZB_rdc / ZMXXZB_rmb' },
  { label:'签入率', value:'94.8%', target:'目标 96.0%', delta:-1.2, status:'risk', source:'bpo_dws_base_pord_sum', field:'QRL_rdc / QRL_rmb' }
]

export const members: TeamMember[] = [
 {id:'JR10381',name:'赵晨',stage:'成熟期',status:'online',response:96,cph:16.2,satisfaction:98.1,busyRest:8.2,trend:3.1,risk:'normal'},
 {id:'JR10822',name:'刘欣',stage:'成熟期',status:'busy',response:88,cph:15.4,satisfaction:97.4,busyRest:11.3,trend:1.4,risk:'normal'},
 {id:'JR10913',name:'王芳',stage:'适应期',status:'rest',response:73,cph:12.8,satisfaction:93.2,busyRest:22.6,trend:-12.8,risk:'critical'},
 {id:'JR11005',name:'孙雷',stage:'新人期',status:'online',response:61,cph:10.1,satisfaction:95.6,busyRest:15.3,trend:-6.7,risk:'warning'},
 {id:'JR10776',name:'李倩',stage:'成熟期',status:'offline',response:79,cph:14.3,satisfaction:96.9,busyRest:10.8,trend:-1.3,risk:'warning'},
 {id:'JR10691',name:'周浩',stage:'成熟期',status:'online',response:102,cph:17.1,satisfaction:98.7,busyRest:7.5,trend:6.4,risk:'normal'},
 {id:'JR11142',name:'陈雨',stage:'新人期',status:'training',response:42,cph:9.8,satisfaction:97.0,busyRest:9.1,trend:2.0,risk:'normal'},
 {id:'JR10554',name:'郑敏',stage:'成熟期',status:'online',response:91,cph:15.8,satisfaction:97.9,busyRest:9.7,trend:1.8,risk:'normal'}
]

export const seedAlerts: Alert[] = [
 {id:'AL-250721-001',severity:'critical',type:'异常员工',person:'王芳',team:'普通客服一区·8班',title:'连续下滑叠加小休超限',evidence:'CPH连续3天下降，今日置忙小休占比22.6%，高于班组均值11.2个百分点；本月已出现2次迟到。',suggestion:'今天14:30前完成一次关注面谈，优先确认工作负荷与情绪状态；明日安排1小时跟岗辅导。',due:'14:30',status:'open',source:'产能表+员工日考勤表',confidence:92},
 {id:'AL-250721-002',severity:'critical',type:'投诉升级',team:'预警专席区·1班',title:'2件工单进入超时风险窗口',evidence:'工单要求处理时间剩余不足2小时；其中1件90天内重复投诉2次、催促3次并命中预警规则。',suggestion:'立即转主管督办，30分钟内完成首次联系并更新中途意见。',due:'12:10',status:'processing',source:'f_sh_pdlv_details',confidence:96},
 {id:'AL-250721-003',severity:'warning',type:'异常话务',team:'10015前台',title:'未来半小时排队预计高于基线38%',evidence:'10:30半小时人工请求量同比上周同日增长31%，排队挂机数连续两个窗口升高。',suggestion:'从低负载技能组临时调入3人，延后2人培训时段30分钟。',due:'10:25',status:'open',source:'f_sh_fwqqmx',confidence:86},
 {id:'AL-250721-004',severity:'warning',type:'质量趋势',person:'孙雷',team:'普通客服一区·8班',title:'新人一次解决率低于成长线',evidence:'入列第18天，一次解决率82.4%，低于同批次均值4.8个百分点；重复来电主要集中在套餐续约问题。',suggestion:'推送“续约争议四步法”微课，抽取2通重复来电案例进行复盘。',due:'明日 09:00',status:'open',source:'产能表+接触记录',confidence:83}
]

export const seedTasks: TaskItem[] = [
 {id:'T-101',title:'王芳异常状态关注面谈',owner:'张伟（班长）',source:'AI员工异常预警',phase:'D',due:'今日 14:30',progress:25,status:'doing'},
 {id:'T-102',title:'2件高风险投诉工单首次联系',owner:'李明（主管）',source:'AI投诉升级预警',phase:'D',due:'今日 12:10',progress:50,status:'doing'},
 {id:'T-103',title:'重复来电率专项复盘',owner:'张伟（班长）',source:'班前会行动项',phase:'C',due:'今日 17:30',progress:0,status:'todo'},
 {id:'T-104',title:'续约争议微课学习',owner:'孙雷',source:'AI培训建议',phase:'D',due:'明日 09:00',progress:0,status:'todo'},
 {id:'T-105',title:'上周满意度改善效果验证',owner:'周静（质检）',source:'PDCA自动检查',phase:'C',due:'今日 16:00',progress:80,status:'doing'}
]

export const industryNews = [
 {id:'MIIT',source:'工信部',time:'今天 09:20',title:'信息通信行业高质量发展相关政策动态',summary:'关注服务质量、个人信息保护和智能客服规范要求，对基地质检规则与培训内容有直接影响。',impact:'需评估',sentiment:'政策'},
 {id:'UNICOM',source:'中国联通',time:'今天 08:45',title:'中国联通持续推进智慧客服与AI服务能力升级',summary:'集团强调人机协同和客户感知，建议将AI预警准确率及闭环时效纳入月度沟通材料。',impact:'高相关',sentiment:'客户'},
 {id:'HOTLINE',source:'10015舆情',time:'昨天 21:10',title:'套餐续约、业务退订成为近24小时讨论热点',summary:'公开讨论升温，河北基地续约争议重复来电率同步偏高，建议启动专项监控。',impact:'立即关注',sentiment:'舆情'},
 {id:'INDUSTRY',source:'行业竞品',time:'昨天 17:30',title:'运营商客服中心加速部署全量质检与智能辅导',summary:'行业从抽检向全量质检迁移，AI教练与员工成长档案成为重点应用方向。',impact:'趋势参考',sentiment:'行业'},
]

export const settlements = [
 {id:'S-10015',name:'10015升投 · 6月结费',plan:286.4,actual:268.8,stage:'审核中',statusLabel:'审核中',riskLevel:'high',owner:'运营管理部',due:'07-25'},
 {id:'S-10010',name:'河北10010服营 · 6月结费',plan:198,actual:198,stage:'待开票',statusLabel:'待开票',riskLevel:'low',owner:'联通河北项目',due:'07-23'},
 {id:'S-400',name:'400联通在线 · 6月结费',plan:42.6,actual:39.1,stage:'待核算',statusLabel:'补充材料',riskLevel:'medium',owner:'400专席',due:'07-22'},
] as const

export const trendData = [
 {time:'08:30',actual:88,target:90,forecast:88},{time:'09:00',actual:91,target:90,forecast:91},{time:'09:30',actual:90,target:90,forecast:90},{time:'10:00',actual:86,target:90,forecast:86},{time:'10:30',actual:83,target:90,forecast:84},{time:'11:00',actual:null,target:90,forecast:82},{time:'11:30',actual:null,target:90,forecast:85},{time:'12:00',actual:null,target:90,forecast:89}
]

export const morningAgenda = [
 {time:'2分钟',label:'昨日结论',text:'一次解决率达标，但重复来电率与置忙小休占比双红。'},
 {time:'4分钟',label:'重点到人',text:'王芳需关注面谈；孙雷安排续约争议案例复盘。'},
 {time:'3分钟',label:'业务提醒',text:'今日重点核实续约产品办理路径，避免重复来电。'},
 {time:'3分钟',label:'今日目标',text:'人工应答量人均≥85，满意率≥97.2%，重复来电率压至4.0%以内。'},
 {time:'3分钟',label:'行动确认',text:'每项行动明确责任人、截止时间，自动进入PDCA任务板。'}
]
