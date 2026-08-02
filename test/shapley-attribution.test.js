import test from 'node:test'
import assert from 'node:assert/strict'
import { answeredCallsShapley } from '../server/shapleyAttribution.js'

const factors=[
 {code:'work_hours',baseline:8,actual:7},
 {code:'utilization',baseline:85,actual:75},
 {code:'att',baseline:165,actual:190},
 {code:'acw',baseline:15,actual:20},
]

test('Shapley接听量归因满足效率性且不受指标排列顺序影响',()=>{
 const result=answeredCallsShapley(factors)
 assert.equal(result.baselineValue,136)
 assert.equal(result.actualValue,90)
 assert.equal(result.totalImpact,-46)
 assert.ok(Math.abs(result.reconciliationGap)<1e-10)
 assert.ok(Math.abs(result.contributions.reduce((sum,item)=>sum+item.impact,0)-result.totalImpact)<1e-10)

 const reversed=answeredCallsShapley([...factors].reverse())
 const originalByCode=Object.fromEntries(result.contributions.map(item=>[item.code,item.impact]))
 for(const contribution of reversed.contributions){
  assert.ok(Math.abs(contribution.impact-originalByCode[contribution.code])<1e-10)
 }
})

test('Shapley引擎在过程指标缺失时明确返回待补齐字段',()=>{
 const result=answeredCallsShapley(factors.map(item=>item.code==='acw'?{...item,actual:null}:item))
 assert.deepEqual(result.missingFactors,['acw'])
 assert.equal(result.totalImpact,null)
 assert.ok(result.contributions.every(item=>item.impact==null))
})
