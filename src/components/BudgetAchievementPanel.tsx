import { useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, CircleDollarSign, Database, Target, TrendingUp } from './Icons'
import { FinancialMetric, FinancialPerformanceState } from '../data/workflowApi'
import '../budget-business-switch.css'

type Props={state:FinancialPerformanceState;states?:FinancialPerformanceState[];role:'manager'|'director'}
const sum=(values:number[])=>values.reduce((total,value)=>total+Number(value||0),0)
const average=(values:number[])=>values.length?sum(values)/values.length:0
const moneyWan=(value:number)=>`${(value/10000).toLocaleString('zh-CN',{minimumFractionDigits:1,maximumFractionDigits:1})}万`
const pct=(value:number,digits=1)=>`${(value*100).toFixed(digits)}%`
const marginRateCodes=new Set(['0601','0603'])
const authorizedMarginText=(value:string)=>value.includes('毛利率')?value.replace(/\d+(?:\.\d+)?(?:%|个百分点|pp)/g,'待授权'):value
const rateCodes=new Set(['0100','01050201','01060103'])
const penaltyCodes=new Set(['0105','010502','010503'])
const valueFor=(metric:FinancialMetric,kind:'budget'|'actual',all:FinancialMetric[])=>{
 const values=kind==='budget'?metric.budget.slice(0,6):metric.actual
 if(metric.code==='0601')return sum((kind==='budget'?all.find(item=>item.code==='06')?.budget.slice(0,6):all.find(item=>item.code==='06')?.actual)||[])/sum((kind==='budget'?all.find(item=>item.code==='0101')?.budget.slice(0,6):all.find(item=>item.code==='0101')?.actual)||[])
 if(metric.code==='0603')return sum((kind==='budget'?all.find(item=>item.code==='0602')?.budget.slice(0,6):all.find(item=>item.code==='0602')?.actual)||[])/sum((kind==='budget'?all.find(item=>item.code==='0101')?.budget.slice(0,6):all.find(item=>item.code==='0101')?.actual)||[])
 if(rateCodes.has(metric.code))return average(values)
 return sum(values)
}
const displayValue=(metric:FinancialMetric,value:number)=>rateCodes.has(metric.code)||['0601','0603'].includes(metric.code)?pct(value):['01060101'].includes(metric.code)?`${Math.round(value)}人次`:moneyWan(value)

export default function BudgetAchievementPanel({state:defaultState,states,role}:Props){
 const [expanded,setExpanded]=useState(false)
 const availableStates=states?.length?states:[defaultState]
 const [selectedScope,setSelectedScope]=useState(defaultState.scope)
 const state=availableStates.find(item=>item.scope===selectedScope)||availableStates[0]
 const byCode=(code:string)=>state.metrics.find(item=>item.code===code)!
 const revenue=byCode('01'),noTax=byCode('0101'),gross=byCode('06'),afterGross=byCode('0602')
 const budgetYtd=valueFor(revenue,'budget',state.metrics),actualYtd=valueFor(revenue,'actual',state.metrics),gap=actualYtd-budgetYtd,completion=actualYtd/budgetYtd
 const hasFullYearBudget=state.budgetMonths.length>=12&&revenue.budget.length>=12
 const annualBudget=sum(revenue.budget),h2Required=annualBudget-actualYtd,monthlyRequired=h2Required/6
 const nextBudgetIndex=state.months.length,nextBudgetMonth=state.budgetMonths[nextBudgetIndex],nextMonthBudget=revenue.budget[nextBudgetIndex]||0
 const maxMonth=Math.max(...revenue.budget.slice(0,6),...revenue.actual)
 const detailCodes=['01','0101','0103','01030102','01030111','0105','010502','010503','0106','0108','0110','0117','0118','06','0601','0602','0603'].filter(code=>state.metrics.some(item=>item.code===code))
 return <section className={`budget-achievement ${role}`}>
  <header><div><span><CircleDollarSign size={17}/> 预算达成 · 附件真实数据</span><h2>{state.scope} 1—6月经营预算完成情况</h2><p>预算取自《{state.sources.budget.fileName}》的“{state.sources.budget.section}”；实际取自《{state.sources.actual.fileName}》的“{state.sources.actual.section}”。</p></div><div className="budget-header-actions">{availableStates.length>1&&<nav aria-label="经营业务切换">{availableStates.map(item=><button key={item.scope} className={item.scope===state.scope?'active':''} onClick={()=>{setSelectedScope(item.scope);setExpanded(false)}}>{item.scope==='河北10015'?'10015业务':'河北回流业务'}</button>)}</nav>}<em>数据截至 {state.asOf}</em></div></header>
  <div className="budget-headline">
   <article className="primary"><div className="budget-kpi-label"><span><CircleDollarSign size={15}/>H1收入完成率</span><em>核心</em></div><strong>{pct(completion)}</strong><small>实际 {moneyWan(actualYtd)} <i/> 预算 {moneyWan(budgetYtd)}</small><div className="budget-kpi-progress"><i style={{width:`${Math.min(completion*100,100)}%`}}/></div></article>
   <article className="risk"><div className="budget-kpi-label"><span><AlertTriangle size={15}/>截止目前 Gap</span><em>关注</em></div><strong>{moneyWan(gap)}</strong><small>距离H1收入预算 <i/> 已按{state.scope}口径核验</small><div className="budget-kpi-rule"><b/>收入追回优先级最高</div></article>
   {hasFullYearBudget?<article><div className="budget-kpi-label"><span><Target size={15}/>H2月均目标</span><em>追回</em></div><strong>{moneyWan(monthlyRequired)}</strong><small>全年预算 {moneyWan(annualBudget)} <i/> H2需完成 {moneyWan(h2Required)}</small><div className="budget-kpi-rule"><b/>按剩余6个月滚动追踪</div></article>:<article><div className="budget-kpi-label"><span><Target size={15}/>{nextBudgetMonth?`${Number(nextBudgetMonth.slice(4))}月收入预算`:'后续预算'}</span><em>已更新</em></div><strong>{moneyWan(nextMonthBudget)}</strong><small>附件预算覆盖至 {nextBudgetMonth?`${nextBudgetMonth.slice(0,4)}-${nextBudgetMonth.slice(4)}`:'当前月份'} <i/> 8—12月待补</small><div className="budget-kpi-rule"><b/>预算补齐后再计算H2月均目标</div></article>}
   <article><div className="budget-kpi-label"><span><TrendingUp size={15}/>H1毛利率</span><em>待授权</em></div><strong>待授权</strong><small>预算 待授权 <i/> 差值 待授权</small><div className="budget-kpi-rule"><b/>毛利率数据待授权</div></article>
  </div>
  <div className="budget-body">
   <section className="budget-months"><div className="budget-section-head"><div><span>月度走势</span><h3>收入实际 vs 预算</h3></div><em>单位：万元</em></div><div className="month-bars">{state.months.map((month,index)=>{const budget=revenue.budget[index],actual=revenue.actual[index],rate=actual/budget;return <article key={month}><header><b>{Number(month.slice(4))}月</b><span className={rate>=1?'good':rate>=.8?'watch':'risk'}>{pct(rate,0)}</span></header><div className="month-bar budget"><i style={{width:`${budget/maxMonth*100}%`}}/><span>预算 {moneyWan(budget)}</span></div><div className="month-bar actual"><i style={{width:`${actual/maxMonth*100}%`}}/><span>实际 {moneyWan(actual)}</span></div><footer>Gap <b>{moneyWan(actual-budget)}</b></footer></article>})}</div></section>
   <aside className="budget-focus"><div className="budget-section-head"><div><span>重点关注</span><h3>AI追回计划</h3></div><Bot size={19}/></div>{state.recoveryPlan.map(item=><article key={item.priority}><b>{String(item.priority).padStart(2,'0')}</b><div><h4>{item.title}</h4><p>{authorizedMarginText(item.target)}</p><small>{item.owner} · {authorizedMarginText(item.rationale)}</small></div></article>)}</aside>
  </div>
  <div className={`budget-quality ${state.dataQuality.status==='verified'?'verified':''}`}>{state.dataQuality.status==='verified'?<CheckCircle2 size={17}/>:<AlertTriangle size={17}/>}<div><strong>{state.dataQuality.status==='verified'?'数据口径已更新':'口径校验提醒'}</strong><p>{state.dataQuality.message}</p></div></div>
  <button className="budget-expand" onClick={()=>setExpanded(value=>!value)}><Database size={15}/>{expanded?'收起逐项明细':'查看逐项预算完成率与Gap'}<ChevronDown size={15} className={expanded?'open':''}/></button>
  {expanded&&<div className="budget-detail"><div className="budget-detail-head"><span>指标</span><span>H1预算</span><span>H1实际</span><span>完成/消耗</span><span>Gap</span><span>判断</span></div>{detailCodes.map(code=>{const metric=byCode(code),budget=valueFor(metric,'budget',state.metrics),actual=valueFor(metric,'actual',state.metrics),isMarginRate=marginRateCodes.has(code),isPenalty=penaltyCodes.has(code),isRate=rateCodes.has(code)||isMarginRate;const metricGap=actual-budget;const rate=budget?actual/budget:actual>0?1:0;const favorable=isPenalty?metricGap>=0:isRate?metricGap>=0:rate>=1;return <div className="budget-detail-row" key={code}><span><b>{metric.name}</b><small>{metric.code}</small></span><span>{isMarginRate?'待授权':displayValue(metric,budget)}</span><span>{isMarginRate?'待授权':displayValue(metric,actual)}</span><span>{isMarginRate?'待授权':isPenalty?`预算消耗 ${pct(Math.abs(actual/budget))}`:pct(rate)}</span><span className={isMarginRate?'':favorable?'good':'risk'}>{isMarginRate?'待授权':isRate?`${metricGap>=0?'+':''}${(metricGap*100).toFixed(1)}pp`:moneyWan(metricGap)}</span><span className={isMarginRate?'':favorable?'good':'risk'}>{isMarginRate?'待授权':favorable?<><CheckCircle2 size={13}/>达标/有利</>:<><Target size={13}/>重点追回</>}</span></div>})}</div>}
  <footer><span><TrendingUp size={14}/> 毛利额实际 {moneyWan(valueFor(gross,'actual',state.metrics))} / 预算 {moneyWan(valueFor(gross,'budget',state.metrics))}</span><span>分摊后毛利率 待授权 / 预算 待授权</span><span>不含税收入 {moneyWan(valueFor(noTax,'actual',state.metrics))}</span><span>分摊后毛利额 {moneyWan(valueFor(afterGross,'actual',state.metrics))}</span></footer>
 </section>
}
