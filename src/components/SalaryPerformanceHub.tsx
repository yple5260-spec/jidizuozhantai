import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowUpRight, BarChart3, CheckCircle2, CircleDollarSign, Database, Edit3, Gauge, ShieldCheck, Sparkles, Target, TrendingUp, Users, X } from './Icons'
import { Role } from '../types'
import { RealDataState } from '../data/realDataApi'

type SalaryInput={
 validCalls:number
 satisfaction:number
 fcr:number
 marketing:number
 negative:boolean
}

type TeamSalaryRecord=SalaryInput&{
 id:string
 name:string
 stage:string
 targetSalary:number
 trend:number
}

const tierRules=[
 {tier:1,min:0,label:'＜2,300',satisfied:.36,unsatisfied:.12,unrated:.30},
 {tier:2,min:2300,label:'≥2,300',satisfied:.48,unsatisfied:.16,unrated:.40},
 {tier:3,min:3000,label:'≥3,000',satisfied:.60,unsatisfied:.20,unrated:.50},
 {tier:4,min:3500,label:'≥3,500',satisfied:.72,unsatisfied:.24,unrated:.60},
 {tier:5,min:4300,label:'≥4,300',satisfied:.96,unsatisfied:.32,unrated:.80},
 {tier:6,min:5100,label:'≥5,100',satisfied:1.20,unsatisfied:.40,unrated:1.00},
 {tier:7,min:6000,label:'≥6,000',satisfied:1.44,unsatisfied:.48,unrated:1.20},
]

const starRules=[
 {name:'五星',calls:4000,satisfaction:97,fcr:86,amount:1000},
 {name:'四星',calls:3200,satisfaction:96,fcr:86,amount:700},
 {name:'三星',calls:2600,satisfaction:95,fcr:85,amount:500},
 {name:'二星',calls:2400,satisfaction:92,fcr:84,amount:300},
 {name:'一星',calls:2000,satisfaction:90,fcr:83,amount:200},
]

const money=(value:number)=>`¥${Math.round(value).toLocaleString('zh-CN')}`
const signedMoney=(value:number)=>`${value>=0?'+':'-'}${money(Math.abs(value))}`
const tierFor=(calls:number)=>[...tierRules].reverse().find(item=>calls>=item.min)||tierRules[0]
const kpiFor=(satisfaction:number)=>satisfaction>=97?1.10:satisfaction>=96?1.05:satisfaction>=95?1:satisfaction>=92 ? .9 : .8
const starFor=(input:SalaryInput)=>{
 if(input.negative)return {name:'无星',amount:0,calls:0,satisfaction:0,fcr:0}
 return starRules.find(item=>input.validCalls>=item.calls&&input.satisfaction>=item.satisfaction&&input.fcr>=item.fcr)||{name:'无星',amount:0,calls:0,satisfaction:0,fcr:0}
}
const nextTierFor=(calls:number)=>tierRules.find(item=>item.min>calls)
const nextStarFor=(input:SalaryInput)=>[...starRules].reverse().find(item=>input.validCalls<item.calls||input.satisfaction<item.satisfaction||input.fcr<item.fcr)

const calculateSalary=(input:SalaryInput)=>{
 const tier=tierFor(input.validCalls)
 const kpi=kpiFor(input.satisfaction)
 const evaluated=Math.round(input.validCalls*.82)
 const satisfied=Math.round(evaluated*input.satisfaction/100)
 const unsatisfied=evaluated-satisfied
 const unrated=input.validCalls-evaluated
 const performance=(satisfied*tier.satisfied+unsatisfied*tier.unsatisfied+unrated*tier.unrated)*kpi
 const star=starFor(input)
 const base=1500
 const subsidies=400
 const deductions=input.negative?300:20
 const total=base+performance+star.amount+input.marketing+subsidies-deductions
 return {tier,kpi,performance,star,base,subsidies,deductions,total,satisfied,unsatisfied,unrated,marketing:input.marketing}
}

const employeeInitial:SalaryInput={validCalls:4420,satisfaction:96.4,fcr:86.8,marketing:420,negative:false}

const teamSalaryData:TeamSalaryRecord[]=[
 {id:'JR10913',name:'王芳',stage:'适应期',validCalls:3380,satisfaction:93.2,fcr:83.7,marketing:180,negative:false,targetSalary:6200,trend:-4.8},
 {id:'JR11005',name:'孙雷',stage:'新人期',validCalls:3180,satisfaction:95.6,fcr:84.2,marketing:260,negative:false,targetSalary:6200,trend:5.2},
 {id:'JR10776',name:'李倩',stage:'成熟期',validCalls:4420,satisfaction:96.4,fcr:86.8,marketing:420,negative:false,targetSalary:7200,trend:3.6},
 {id:'JR10381',name:'赵晨',stage:'成熟期',validCalls:5160,satisfaction:98.1,fcr:88.6,marketing:680,negative:false,targetSalary:9000,trend:7.8},
 {id:'JR10822',name:'刘欣',stage:'成熟期',validCalls:4680,satisfaction:97.4,fcr:87.1,marketing:520,negative:false,targetSalary:8000,trend:2.9},
 {id:'JR10691',name:'周浩',stage:'成熟期',validCalls:5570,satisfaction:98.7,fcr:89.2,marketing:760,negative:false,targetSalary:9600,trend:8.4},
 {id:'JR11142',name:'陈雨',stage:'新人期',validCalls:2860,satisfaction:95.1,fcr:83.4,marketing:120,negative:false,targetSalary:5600,trend:4.1},
 {id:'JR10554',name:'郑敏',stage:'成熟期',validCalls:4320,satisfaction:97.9,fcr:87.6,marketing:480,negative:false,targetSalary:7600,trend:2.2},
]

const distribution=[
 {range:'＜5千',count:38,rate:8.7},
 {range:'5—6千',count:82,rate:18.7},
 {range:'6—7千',count:144,rate:32.9},
 {range:'7—8千',count:105,rate:24.0},
 {range:'8—9千',count:47,rate:10.7},
 {range:'≥9千',count:22,rate:5.0},
]

const projectHealth=[
 {project:'河北回流10010',headcount:438,average:6842,median:6710,performanceRate:53.8,lowRate:8.7,deductionRate:1.6,status:'健康'},
 {project:'10015升投',headcount:286,average:7126,median:6980,performanceRate:55.2,lowRate:6.3,deductionRate:1.2,status:'健康'},
 {project:'投诉专席',headcount:64,average:7658,median:7480,performanceRate:48.6,lowRate:4.7,deductionRate:2.8,status:'关注'},
]

function PageIntro({eyebrow,title,desc,badge}:{eyebrow:string;title:string;desc:string;badge:string}){
 return <div className="salary-page-intro"><div><span>{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div><em><ShieldCheck size={15}/>{badge}</em></div>
}

function MetricCard({label,value,detail,tone='normal'}:{label:string;value:string;detail:string;tone?:'normal'|'good'|'risk'}){
 return <article className={`salary-metric-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function SalaryComposition({result}:{result:ReturnType<typeof calculateSalary>}){
 const rows=[
  {label:'岗位工资',value:result.base,detail:'1,500元封顶，按174小时出勤折算'},
  {label:'话务绩效',value:result.performance,detail:`第${result.tier.tier}档单价 × KPI系数 ${result.kpi.toFixed(2)}`},
  {label:`${result.star.name}奖励`,value:result.star.amount,detail:'话务量、满意率、一次解决率共同评定'},
  {label:'营销提成',value:result.marketing,detail:'按业务推荐与营销奖励制度核算'},
  {label:'补贴补助',value:result.subsidies,detail:'餐补、全勤、交通、话费等过程预估'},
  {label:'负向扣减',value:-result.deductions,detail:'质量及现场运营负向清单'},
 ]
 return <section className="panel salary-composition"><header><div><span>方案口径拆解</span><h2>预估薪资构成</h2></div><CircleDollarSign size={20}/></header>{rows.map(row=><div className={row.value<0?'deduction':''} key={row.label}><span><b>{row.label}</b><small>{row.detail}</small></span><strong>{row.value<0?'-':''}{money(Math.abs(row.value))}</strong></div>)}<footer>最终工资以月度结算、实际出勤与审批后的奖惩结果为准。</footer></section>
}

function EmployeeSalaryPage({notify}:{notify:(message:string)=>void}){
 const [input,setInput]=useState<SalaryInput>(employeeInitial)
 const result=useMemo(()=>calculateSalary(input),[input])
 const current=calculateSalary(employeeInitial)
 const nextTier=nextTierFor(input.validCalls)
 const nextStar=nextStarFor(input)
 const salaryDelta=result.total-current.total
 const update=<K extends keyof SalaryInput>(key:K,value:SalaryInput[K])=>setInput(currentInput=>({...currentInput,[key]:value}))
 return <><PageIntro eyebrow="客服专员 · 个人薪资驾驶舱" title="每提升一个指标，都能看到收入变化" desc="只展示本人数据。产能决定话务单价档位，满意率决定KPI系数，质量与一次解决率共同决定星级奖励。" badge="仅本人可见"/>
  <section className="salary-personal-hero"><div><span>李倩 · JR10776 · 河北回流10010</span><h2>本月预估税前工资</h2><strong>{money(result.total)}</strong><p>测算区间 {money(result.total*.975)}—{money(result.total*1.025)} · 按当前全月预测口径</p></div><aside><span>相对当前预测</span><b className={salaryDelta>=0?'up':'down'}>{signedMoney(salaryDelta)}</b><small>调整下方阶段目标，可即时测算</small></aside><div className="salary-hero-formula"><Sparkles size={17}/><span><b>工资公式</b>岗位工资 + 话务绩效 + 星级奖励 + 营销提成 + 补贴 − 负向扣减</span></div></section>
  <div className="salary-metric-grid">
   <MetricCard label="预测有效话务量" value={`${input.validCalls.toLocaleString()}通`} detail={`当前第${result.tier.tier}档 · ${result.tier.label}`} tone={input.validCalls>=4300?'good':'risk'}/>
   <MetricCard label="人工满意率" value={`${input.satisfaction.toFixed(1)}%`} detail={`KPI系数 ${result.kpi.toFixed(2)} · 下一档97%`} tone={input.satisfaction>=97?'good':'risk'}/>
   <MetricCard label="一次解决率" value={`${input.fcr.toFixed(1)}%`} detail="星级底线86% · 与质量相辅相成" tone={input.fcr>=86?'good':'risk'}/>
   <MetricCard label="当前星级" value={result.star.name} detail={`星级奖励 ${money(result.star.amount)}`} tone={result.star.name==='五星'?'good':'normal'}/>
  </div>
  <div className="salary-employee-layout">
   <section className="panel salary-simulator"><header><div><span>阶段目标测算器</span><h2>做到什么，可以拿到更高薪资</h2></div><em>实时联动</em></header>
    <label><span><b>预测有效话务量</b><small>跨档后全部有效话务按新档单价核算</small></span><strong>{input.validCalls.toLocaleString()}通</strong><input type="range" min="2000" max="6200" step="20" value={input.validCalls} onChange={event=>update('validCalls',Number(event.target.value))}/></label>
    <label><span><b>人工满意率</b><small>92% / 95% / 96% / 97% 对应不同KPI系数</small></span><strong>{input.satisfaction.toFixed(1)}%</strong><input type="range" min="90" max="99" step=".1" value={input.satisfaction} onChange={event=>update('satisfaction',Number(event.target.value))}/></label>
    <label><span><b>一次解决率</b><small>用于月度星级评定，质量底线不可牺牲</small></span><strong>{input.fcr.toFixed(1)}%</strong><input type="range" min="82" max="91" step=".1" value={input.fcr} onChange={event=>update('fcr',Number(event.target.value))}/></label>
    <label><span><b>营销提成预估</b><small>河北回流10010重点业务推荐奖励</small></span><strong>{money(input.marketing)}</strong><input type="range" min="0" max="1200" step="20" value={input.marketing} onChange={event=>update('marketing',Number(event.target.value))}/></label>
    <div className="salary-negative-switch"><div><AlertTriangle size={16}/><span><b>当月负向清单</b><small>出现负向清单将直接判定无星，并产生相应扣减</small></span></div><button className={input.negative?'active':''} onClick={()=>update('negative',!input.negative)}>{input.negative?'存在':'无'}</button></div>
    <footer><button className="secondary" onClick={()=>setInput(employeeInitial)}>恢复当前预测</button><button className="primary" onClick={()=>notify(`阶段目标已保存：${input.validCalls}通、满意率${input.satisfaction.toFixed(1)}%、一次解决率${input.fcr.toFixed(1)}%`)}><Target size={14}/>保存为本月挑战目标</button></footer>
   </section>
   <SalaryComposition result={result}/>
  </div>
  <section className="panel salary-challenge-ladder"><header><div><span>目标导向 · 收入阶梯</span><h2>下一步最值得完成的三件事</h2></div><b>预计最多再提升 {money(Math.max(0,calculateSalary({validCalls:5100,satisfaction:97,fcr:87,marketing:700,negative:false}).total-result.total))}</b></header><div>
   <article className={!nextTier?'done':''}><span>{!nextTier?<CheckCircle2 size={19}/>:<TrendingUp size={19}/>}</span><div><b>{nextTier?`进入第${nextTier.tier}档话务单价`:'已达到最高话务档位'}</b><p>{nextTier?`还差 ${Math.max(0,nextTier.min-input.validCalls)} 通；达档后满意话务单价提升至 ${nextTier.satisfied.toFixed(2)}元/通。`:'保持有效话务量，同时稳定客户感知。'}</p></div><em>{nextTier?nextTier.label:'已完成'}</em></article>
   <article className={!nextStar?'done':''}><span>{!nextStar?<CheckCircle2 size={19}/>:<Gauge size={19}/>}</span><div><b>{nextStar?`挑战${nextStar.name}员工`:'已达到五星标准'}</b><p>{nextStar?`话务≥${nextStar.calls}、满意率≥${nextStar.satisfaction}%、一次解决率≥${nextStar.fcr}%，且无负向清单。`:'继续保持产能与质量双达标。'}</p></div><em>{nextStar?`奖励 ${money(nextStar.amount)}`:'奖励 ¥1,000'}</em></article>
   <article><span><ArrowUpRight size={19}/></span><div><b>营销奖励再增加280元</b><p>围绕续约推荐与异议处理完成阶段目标，营销提成由{money(input.marketing)}提升至{money(input.marketing+280)}。</p></div><em>目标 {money(input.marketing+280)}</em></article>
  </div></section>
 </>
}

function LeaderSalaryPage({notify}:{notify:(message:string)=>void}){
 const [selected,setSelected]=useState<TeamSalaryRecord|null>(null)
 const [plans,setPlans]=useState<Record<string,number>>({})
 const calculated=useMemo(()=>teamSalaryData.map(item=>({...item,result:calculateSalary(item)})),[])
 const average=calculated.reduce((sum,item)=>sum+item.result.total,0)/calculated.length
 const belowTarget=calculated.filter(item=>item.result.total<item.targetSalary).length
 const chartData=calculated.map(item=>({name:item.name,salary:Math.round(item.result.total),target:item.targetSalary}))
 const savePlan=()=>{
  if(!selected)return
  setPlans(current=>({...current,[selected.id]:selected.targetSalary}))
  notify(`${selected.name}的薪资挑战目标已加入班长辅导清单`)
  setSelected(null)
 }
 return <><PageIntro eyebrow="客服班长 · 班组收入管理" title="看清每个人的差距，把收入目标转成业务动作" desc="班长可查看下属的预估工资、话务档位与质量约束，用于目标辅导；不得用于公开排名或简单以收入评价员工。" badge="仅本班组可见"/>
  <div className="salary-metric-grid leader">
   <MetricCard label="班组预估平均工资" value={money(average)} detail={`8人 · 较上月 +${money(286)}`} tone="good"/>
   <MetricCard label="预计工资总额" value={money(calculated.reduce((sum,item)=>sum+item.result.total,0))} detail="按当前全月预测口径"/>
   <MetricCard label="低于个人目标" value={`${belowTarget}人`} detail="优先制定可完成的阶段动作" tone="risk"/>
   <MetricCard label="五星/四星员工" value={`${calculated.filter(item=>['五星','四星'].includes(item.result.star.name)).length}人`} detail="可复制优秀方法" tone="good"/>
  </div>
  <div className="salary-leader-top">
   <section className="panel salary-team-chart"><header><div><span>班组薪资达成预测</span><h2>预估工资与个人目标</h2></div><em>单位：元</em></header><div><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:12,right:18,left:2,bottom:0}}><CartesianGrid stroke="#e8eef4" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#6b7d91'}}/><YAxis domain={[3000,11000]} axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#7a8999'}}/><Tooltip formatter={(value:number)=>money(value)} contentStyle={{borderRadius:7,border:'1px solid #dce5ef',fontSize:11}}/><ReferenceLine y={7000} stroke="#e38b29" strokeDasharray="5 4" label={{value:'班组目标线',fill:'#9c671d',fontSize:9}}/><Bar dataKey="salary" name="预估工资" radius={[4,4,0,0]}>{chartData.map(item=><Cell key={item.name} fill={item.salary>=item.target?'#198466':'#257bb4'}/>)}</Bar></BarChart></ResponsiveContainer></div><footer><span><i className="met"></i>达到个人目标</span><span><i></i>仍有差距</span><b>目标由班长与员工共同确认</b></footer></section>
   <section className="panel salary-leader-focus"><header><div><span>本周辅导优先级</span><h2>先帮助差距最可改善的人</h2></div><Target size={19}/></header>{calculated.filter(item=>item.result.total<item.targetSalary).sort((a,b)=>(a.targetSalary-a.result.total)-(b.targetSalary-b.result.total)).slice(0,3).map((item,index)=><article key={item.id}><b>{index+1}</b><div><strong>{item.name} · 差 {money(item.targetSalary-item.result.total)}</strong><p>{item.validCalls<4300?`话务量再提升${4300-item.validCalls}通进入第5档`:`满意率提升至97%，KPI系数可提升`}</p></div><button onClick={()=>setSelected(item)}>{plans[item.id]?'已制定':'制定目标'}</button></article>)}</section>
  </div>
  <section className="panel salary-team-table"><header><div><span>下属薪资过程管理</span><h2>8班员工目标与预估达成</h2></div><em><ShieldCheck size={13}/>仅限班长辅导使用</em></header><div className="salary-team-head"><span>员工</span><span>预估工资</span><span>话务量 / 档位</span><span>满意率 / KPI</span><span>一次解决率</span><span>星级</span><span>目标差距</span><span>辅导操作</span></div>{calculated.map(item=>{const gap=item.result.total-item.targetSalary;return <article key={item.id}><div className="salary-person"><span>{item.name.slice(0,1)}</span><div><strong>{item.name}</strong><small>{item.id} · {item.stage}</small></div></div><div><strong>{money(item.result.total)}</strong><small className={item.trend>=0?'up':'down'}>{item.trend>=0?'+':''}{item.trend}%</small></div><div><strong>{item.validCalls.toLocaleString()}通</strong><small>第{item.result.tier.tier}档</small></div><div><strong>{item.satisfaction.toFixed(1)}%</strong><small>系数 {item.result.kpi.toFixed(2)}</small></div><div><strong>{item.fcr.toFixed(1)}%</strong><small>{item.fcr>=86?'质量达标':'需提升'}</small></div><div><strong>{item.result.star.name}</strong><small>{money(item.result.star.amount)}</small></div><div><strong className={gap>=0?'up':'down'}>{signedMoney(gap)}</strong><small>目标 {money(item.targetSalary)}</small></div><button onClick={()=>setSelected(item)}><Edit3 size={13}/>{plans[item.id]?'调整目标':'制定目标'}</button></article>})}</section>
  {selected&&<div className="salary-plan-backdrop" onClick={()=>setSelected(null)}><section className="salary-plan-dialog" onClick={event=>event.stopPropagation()}><header><div><span>员工收入目标辅导</span><h2>为 {selected.name} 制定阶段目标</h2><p>从工资差距倒推话务、满意率与一次解决率目标。</p></div><button onClick={()=>setSelected(null)}><X size={20}/></button></header><div className="salary-plan-summary"><div><span>当前预估</span><strong>{money(calculateSalary(selected).total)}</strong></div><div><span>个人目标</span><strong>{money(selected.targetSalary)}</strong></div><div><span>目标差距</span><strong>{money(Math.max(0,selected.targetSalary-calculateSalary(selected).total))}</strong></div></div><div className="salary-plan-fields"><label>有效话务目标<input defaultValue={Math.max(selected.validCalls,4300)} type="number"/><small>下一关键档位：4,300 / 5,100 / 6,000通</small></label><label>满意率目标<input defaultValue={Math.max(selected.satisfaction,97)} type="number" step=".1"/><small>达到97%后KPI系数为1.10</small></label><label>一次解决率目标<input defaultValue={Math.max(selected.fcr,86)} type="number" step=".1"/><small>四星、五星最低标准为86%</small></label><label>阶段动作<textarea defaultValue={selected.validCalls<4300?'班长每日两次查看话务节奏，午间复盘1通低效录音；质量不降线的前提下提升接续效率。':'保持产能节奏，每日抽听2通争议场景录音，将满意率稳定在97%以上。'}/></label></div><footer><button className="secondary" onClick={()=>setSelected(null)}>取消</button><button className="primary" onClick={savePlan}><Target size={14}/>保存并加入辅导清单</button></footer></section></div>}
 </>
}

function HrbpSalaryPage({notify}:{notify:(message:string)=>void}){
 const [scope,setScope]=useState('全部项目')
 const visibleProjects=scope==='全部项目'?projectHealth:projectHealth.filter(item=>item.project===scope)
 const totalHeadcount=visibleProjects.reduce((sum,item)=>sum+item.headcount,0)
 const average=visibleProjects.reduce((sum,item)=>sum+item.average*item.headcount,0)/totalHeadcount
 const performanceRate=visibleProjects.reduce((sum,item)=>sum+item.performanceRate*item.headcount,0)/totalHeadcount
 return <><PageIntro eyebrow="HRBP经理 · 薪资健康分析" title="不看个人工资，判断项目薪资机制是否健康" desc="仅展示匿名聚合数据，从分布、结构、绩效弹性和低收入人群占比识别招聘、留任与机制风险。" badge="已匿名聚合"/>
  <div className="salary-hrbp-toolbar"><div><button className={scope==='全部项目'?'active':''} onClick={()=>setScope('全部项目')}>全部项目</button>{projectHealth.map(item=><button className={scope===item.project?'active':''} key={item.project} onClick={()=>setScope(item.project)}>{item.project}</button>)}</div><span>统计周期：2026年7月预测 · 人数 {totalHeadcount}</span></div>
  <div className="salary-metric-grid hrbp">
   <MetricCard label="项目平均工资" value={money(average)} detail="较上月预测 +4.3%" tone="good"/>
   <MetricCard label="工资中位数" value={money(scope==='全部项目'?6840:visibleProjects[0].median)} detail="P25 ¥5,920 · P75 ¥7,860"/>
   <MetricCard label="绩效浮动占比" value={`${performanceRate.toFixed(1)}%`} detail="与产能、满意度和星级联动"/>
   <MetricCard label="低收入区间占比" value={`${scope==='全部项目'?8.7:visibleProjects[0].lowRate}%`} detail="低于5,000元人群，无个人明细" tone={scope==='投诉专席'?'good':'risk'}/>
  </div>
  <div className="salary-hrbp-grid">
   <section className="panel salary-distribution"><header><div><span>匿名薪资分布</span><h2>员工工资区间结构</h2></div><em>{scope} · {totalHeadcount}人</em></header><div><ResponsiveContainer width="100%" height="100%"><BarChart data={distribution} margin={{top:14,right:18,left:0,bottom:0}}><CartesianGrid stroke="#e8eef4" vertical={false}/><XAxis dataKey="range" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#6f8093'}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#7a8999'}}/><Tooltip formatter={(value:number,name:string)=>name==='count'?[`${value}人`,'人数']:[`${value}%`,'占比']} contentStyle={{borderRadius:7,border:'1px solid #dce5ef',fontSize:11}}/><Bar dataKey="count" name="人数" radius={[5,5,0,0]}>{distribution.map((item,index)=><Cell key={item.range} fill={index===0?'#e28a32':index>=4?'#3b8f7a':'#287eb6'}/>)}</Bar></BarChart></ResponsiveContainer></div><footer><AlertTriangle size={14}/><span>低于5,000元区间占比8.7%，主要集中在新人期与出勤不足人群；建议结合流失风险按周期分析。</span></footer></section>
   <section className="panel salary-structure-health"><header><div><span>工资结构健康度</span><h2>收入是否真正与目标挂钩</h2></div><Gauge size={19}/></header><div className="salary-health-score"><strong>86</strong><span>健康分</span><p>绩效弹性充分，质量约束有效；新人低收入区间仍需关注。</p></div><div className="salary-structure-bar"><i style={{width:'22%'}}></i><i style={{width:'54%'}}></i><i style={{width:'9%'}}></i><i style={{width:'7%'}}></i><i style={{width:'8%'}}></i></div><div className="salary-structure-legend">{[['岗位工资','22%'],['话务绩效','54%'],['星级奖励','9%'],['营销提成','7%'],['补贴净额','8%']].map((item,index)=><span key={item[0]}><i className={`c${index}`}></i><b>{item[0]}</b><em>{item[1]}</em></span>)}</div><div className="salary-health-insights"><article><TrendingUp size={16}/><div><b>正向弹性清晰</b><p>话务量跨档和满意率KPI系数共同拉开收入差异。</p></div></article><article className="risk"><AlertTriangle size={16}/><div><b>新人保护不足</b><p>新人期薪资中位数低于成熟期18%，需联动培训通关与保留策略。</p></div></article></div></section>
  </div>
  <section className="panel salary-project-table"><header><div><span>项目薪资健康台账</span><h2>只看组织结构，不展示个人明细</h2></div><em><Users size={14}/>匿名聚合到项目层级</em></header><div className="salary-project-head"><span>项目</span><span>人数</span><span>平均工资</span><span>中位数</span><span>绩效收入占比</span><span>低于5千占比</span><span>负向扣减率</span><span>健康判断</span></div>{visibleProjects.map(item=><article key={item.project}><strong>{item.project}</strong><span>{item.headcount}人</span><span>{money(item.average)}</span><span>{money(item.median)}</span><span>{item.performanceRate}%</span><span className={item.lowRate>8?'risk':''}>{item.lowRate}%</span><span className={item.deductionRate>2?'risk':''}>{item.deductionRate}%</span><em className={item.status==='健康'?'good':'risk'}>{item.status}</em></article>)}</section>
  <section className="salary-hrbp-actions"><div><BarChart3 size={20}/><span><b>HRBP建议</b>将低于5,000元区间与员工周期、培训通关、出勤和离职风险做关联分析，不下钻个人工资；若某项目连续两月低收入占比超过12%，触发薪资机制专项复盘。</span></div><button onClick={()=>notify('月度薪资健康简报已生成，可在消息中心查阅')}>生成月度薪资健康简报</button></section>
 </>
}

function LiveSalarySource({role,data}:{role:Role;data:RealDataState}){
 const salary=data.salary
 if(role==='employee'&&salary.personal)return <><div className="live-data-scope"><Database size={16}/><div><strong>历史薪资已接入人工成本真实表 · {salary.period}</strong><span>{salary.matched?'已匹配当前登录工号':'当前工号未匹配，暂展示真实库代表记录'} · 以下历史实发与页面预测测算分开呈现</span></div></div><section className="salary-metric-grid"><MetricCard label="历史应发工资" value={money(salary.personal.grossSalary||0)} detail={`岗位：${salary.personal.position}`}/><MetricCard label="历史实发工资" value={money(salary.personal.netSalary||0)} detail="来自 f_jyfx_rgcb" tone="good"/><MetricCard label="历史绩效工资" value={money(salary.personal.performanceSalary||0)} detail="实际结算记录"/><MetricCard label="历史补贴小计" value={money(salary.personal.subsidies||0)} detail="实际结算记录"/></section></>
 if(role==='leader'&&salary.team.length)return <><div className="live-data-scope"><Database size={16}/><div><strong>班组历史薪资已接入真实表 · {salary.period}</strong><span>仅用于班长辅导范围，当前返回 {salary.team.length} 条真实结算记录；下方目标模拟仍按薪资方案测算。</span></div></div><section className="panel salary-project-table"><header><div><span>真实历史结算</span><h2>员工应发、绩效与补贴</h2></div><em><ShieldCheck size={14}/>班长范围</em></header><div className="salary-project-head"><span>员工</span><span>岗位</span><span>应发工资</span><span>绩效工资</span><span>补贴</span><span>奖惩</span><span>班组</span><span>月份</span></div>{salary.team.slice(0,12).map(item=><article key={item.jobNo}><strong>{item.name}</strong><span>{item.position}</span><span>{money(item.grossSalary||0)}</span><span>{money(item.performanceSalary||0)}</span><span>{money(item.subsidies||0)}</span><span>{money(item.rewards||0)}</span><span>{item.team}</span><em>{salary.period}</em></article>)}</section></>
 if((role==='hrbp'||role==='director')&&salary.distribution.length)return <><div className="live-data-scope"><Database size={16}/><div><strong>HRBP历史薪资分析已接入真实表 · {salary.period}</strong><span>接口仅返回匿名区间分布和组织聚合，不返回员工工资明细。</span></div></div><section className="salary-metric-grid"><MetricCard label="统计人数" value={`${salary.distribution.reduce((sum,item)=>sum+item.count,0)}人`} detail="客服专员匿名汇总"/><MetricCard label="项目数" value={`${salary.projects.length}个`} detail="按组织聚合"/><MetricCard label="低于4千占比" value={`${salary.distribution.filter(item=>['＜3千','3—4千'].includes(item.range)).reduce((sum,item)=>sum+item.rate,0).toFixed(1)}%`} detail="健康度观察指标" tone="risk"/><MetricCard label="数据权限" value="聚合" detail="不返回个人明细" tone="good"/></section></>
 return null
}

export default function SalaryPerformanceHub({role,notify,realData}:{role:Role;notify:(message:string)=>void;realData:RealDataState|null}){
 if(role==='employee')return <>{realData&&<LiveSalarySource role={role} data={realData}/>}<EmployeeSalaryPage notify={notify}/></>
 if(role==='leader')return <>{realData&&<LiveSalarySource role={role} data={realData}/>}<LeaderSalaryPage notify={notify}/></>
 if(role==='hrbp'||role==='director')return <>{realData&&<LiveSalarySource role={role} data={realData}/>}<HrbpSalaryPage notify={notify}/></>
 return <><PageIntro eyebrow="绩效与薪资" title="当前岗位无薪资查看职责" desc="薪资数据按岗位最小权限开放：员工看本人、班长看本班组目标、HRBP和总监看匿名组织分布。" badge="字段级权限"/><div className="salary-no-access"><ShieldCheck size={34}/><h2>没有可展示的薪资数据</h2><p>如业务需要，请由系统管理员在角色管理中配置对应模块。</p></div></>
}
