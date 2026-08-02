import test from 'node:test'
import assert from 'node:assert/strict'
import {actionAllowed,applyTaskSlaSweep,experienceCandidateFromTask,pdcaBusinessMetrics,verificationGate} from '../server/pdcaEngine.js'

const leanTask=overrides=>({
 id:'LP-TEST',title:'满意率改善',type:'管理指派',workflowKind:'lean_directive',status:'pending_verification',ownerRole:'manager',
 executionOwnerRole:'supervisor',executionOwner:'客服主管',verificationRole:'manager',metric:{label:'满意率',baseline:90,target:95,unit:'%',direction:'higher'},
 evidence:'已完成服务动作复盘并提交抽检结果。',attachments:[],evidencePolicy:{requiredAttachments:0},metricSnapshots:[{type:'submission',actual:96}],
 actionPlan:'复盘低满意录音；校准服务动作',standardizedAction:'每日抽检两通录音；周度复盘服务动作',history:[],createdAt:new Date().toISOString(),
 ...overrides,
})

test('不同任务模板不能跨状态机调用动作',()=>{
 assert.equal(actionAllowed(leanTask({}),'lean_start'),true)
 assert.equal(actionAllowed(leanTask({}),'start'),false)
 assert.equal(actionAllowed({workflowKind:'meeting_action'},'lean_start'),false)
})

test('量化验收同时校验实际值、目标与必需证据',()=>{
 assert.deepEqual(verificationGate(leanTask({})),{hasActual:true,targetMet:true,evidenceComplete:true,actual:96,target:95,requiredAttachments:0,attachmentCount:0})
 assert.equal(verificationGate(leanTask({metricSnapshots:[{type:'submission',actual:92}]})).targetMet,false)
 assert.equal(verificationGate(leanTask({evidencePolicy:{requiredAttachments:1}})).evidenceComplete,false)
})

test('达标任务生成候选经验，例外关闭不生成',()=>{
 const candidate=experienceCandidateFromTask(leanTask({}),'运营经理')
 assert.equal(candidate.status,'candidate')
 assert.ok(candidate.steps.length>=2)
 assert.equal(experienceCandidateFromTask(leanTask({exceptionClosure:{decision:'approve'}}),'运营经理'),null)
})

test('SLA扫描幂等提醒并升级管理关注但不夺走执行责任',()=>{
 const due=Date.now()-10*60*1000
 const task=leanTask({status:'doing',ownerRole:'supervisor',owner:'客服主管',submitDueAt:new Date(due).toISOString(),metricSnapshots:[],slaPolicy:{enabled:true},slaEvents:[]})
 const state={tasks:[task],notifications:[]}
 assert.ok(applyTaskSlaSweep(state,Date.now())>=2)
 const notices=state.notifications.length
 assert.equal(task.ownerRole,'supervisor')
 assert.equal(task.slaEscalationRole,'manager')
 assert.equal(task.escalationStatus,'escalated')
 assert.equal(applyTaskSlaSweep(state,Date.now()),0)
 assert.equal(state.notifications.length,notices)
})

test('管理成效按达标而非仅关单统计',()=>{
 const closed=leanTask({status:'closed',submittedAt:'2026-07-01T09:00:00.000Z',submitDueAt:'2026-07-01T10:00:00.000Z',experienceCandidateId:'EXP-1'})
 const metrics=pdcaBusinessMetrics([closed,leanTask({id:'LP-2',status:'doing'})])
 assert.equal(metrics.closeRate,50)
 assert.equal(metrics.targetAttainmentRate,100)
 assert.equal(metrics.experienceConversionRate,100)
})
