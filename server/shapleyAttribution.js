const finite=value=>{
 const parsed=Number(value)
 return value==null||value===''||!Number.isFinite(parsed)?null:parsed
}

const factorial=value=>{
 let result=1
 for(let index=2;index<=value;index+=1)result*=index
 return result
}

/**
 * 通用 Shapley 归因引擎。
 * baseline 为对照/目标值，actual 为实际值，evaluate 负责把一组指标换算为结果指标。
 */
export const shapleyAttribution=({factors,evaluate})=>{
 if(!Array.isArray(factors)||!factors.length)throw new TypeError('Shapley归因至少需要一个过程指标')
 if(typeof evaluate!=='function')throw new TypeError('Shapley归因必须提供结果计算公式')
 const normalized=factors.map((factor,index)=>({
  ...factor,
  code:String(factor?.code||`factor_${index+1}`),
  actual:finite(factor?.actual),
  baseline:finite(factor?.baseline),
 }))
 const incomplete=normalized.filter(factor=>factor.actual==null||factor.baseline==null)
 if(incomplete.length)return {
  method:'shapley',baselineValue:null,actualValue:null,totalImpact:null,reconciliationGap:null,
  missingFactors:incomplete.map(factor=>factor.code),
  contributions:normalized.map(factor=>({...factor,impact:null,contributionRate:null})),
 }
 const count=normalized.length
 const allMask=(1<<count)-1
 const values=new Map()
 for(let mask=0;mask<=allMask;mask+=1){
  const inputs=Object.fromEntries(normalized.map((factor,index)=>[factor.code,mask&(1<<index)?factor.actual:factor.baseline]))
  const result=finite(evaluate(inputs))
  if(result==null)throw new TypeError(`Shapley公式在组合 ${mask} 下未返回有效数值`)
  values.set(mask,result)
 }
 const denominator=factorial(count)
 const raw=normalized.map((factor,index)=>{
  let impact=0
  for(let mask=0;mask<=allMask;mask+=1){
   if(mask&(1<<index))continue
   const coalitionSize=normalized.reduce((sum,_factor,factorIndex)=>sum+((mask&(1<<factorIndex))?1:0),0)
   const weight=factorial(coalitionSize)*factorial(count-coalitionSize-1)/denominator
   impact+=weight*(values.get(mask|(1<<index))-values.get(mask))
  }
  return {...factor,impact}
 })
 const absoluteTotal=raw.reduce((sum,item)=>sum+Math.abs(item.impact),0)
 const baselineValue=values.get(0),actualValue=values.get(allMask)
 const totalImpact=actualValue-baselineValue
 return {
  method:'shapley',baselineValue,actualValue,totalImpact,
  reconciliationGap:totalImpact-raw.reduce((sum,item)=>sum+item.impact,0),
  missingFactors:[],
  contributions:raw.map(item=>({...item,contributionRate:absoluteTotal?Math.abs(item.impact)/absoluteTotal:0})),
 }
}

export const answeredCallsFormula=({work_hours,utilization,att,acw})=>{
 const denominator=finite(att)+finite(acw)
 return denominator>0?finite(work_hours)*finite(utilization)/100*3600/denominator:null
}

export const answeredCallsShapley=factors=>shapleyAttribution({factors,evaluate:answeredCallsFormula})
