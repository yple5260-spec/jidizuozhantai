import { databaseTransaction } from './database.js'
import { createHash } from 'node:crypto'

let queuedState=null
let syncing=false

const date=value=>{
 const parsed=Date.parse(String(value||''))
 return Number.isFinite(parsed)?new Date(parsed):null
}
const text=(value,max=255)=>String(value||'').slice(0,max)
const nullable=value=>value==null||value===''?null:value

const syncTasks=async(connection,state)=>{
 for(const task of state.tasks||[]){
  await connection.query(`
   INSERT INTO platform_pdca_task
    (id,source_type,source_id,title,problem,target_text,owner_role,owner_name,verification_role,employee_code,employee_name,team_name,phase,status,progress,due_at,success_criteria,evidence,result_text,created_by,created_at,updated_at,closed_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE source_type=VALUES(source_type),source_id=VALUES(source_id),title=VALUES(title),problem=VALUES(problem),
    target_text=VALUES(target_text),owner_role=VALUES(owner_role),owner_name=VALUES(owner_name),verification_role=VALUES(verification_role),
    employee_code=VALUES(employee_code),employee_name=VALUES(employee_name),team_name=VALUES(team_name),phase=VALUES(phase),status=VALUES(status),
    progress=VALUES(progress),due_at=VALUES(due_at),success_criteria=VALUES(success_criteria),evidence=VALUES(evidence),
    result_text=VALUES(result_text),updated_at=VALUES(updated_at),closed_at=VALUES(closed_at)`,[
   text(task.id,64),text(task.workflowKind||task.sourceLabel||task.type||'pdca',64),nullable(text(task.sourceKey||task.sourceEventId||'',128)),
   text(task.title||task.type||'未命名任务'),nullable(task.requirement||task.problem),nullable(task.target),text(task.ownerRole||'unknown',32),
   nullable(text(task.owner,128)),nullable(text(task.verificationRole||'',32)),nullable(text(task.employeeId||'',64)),
   nullable(text(task.person||task.employeeName||'',128)),nullable(text(task.team||'',255)),text(task.phase||'P',1),
   text(task.status||'todo',32),Number(task.progress||0),date(task.dueAt),nullable(task.successCriteria),nullable(task.evidence),
   nullable(task.verification||task.result),text(task.originActor||task.createdBy||task.owner||'平台',128),
   date(task.createdAt)||new Date(),date(task.updatedAt)||new Date(),task.status==='closed'?(date(task.updatedAt)||new Date()):null,
  ])
  await connection.query('DELETE FROM platform_pdca_history WHERE task_id=?',[task.id])
  for(const history of task.history||[]){
   await connection.query('INSERT INTO platform_pdca_history(task_id,actor_role,actor_name,action_code,action_note,created_at) VALUES (?,?,?,?,?,?)',[
    task.id,null,text(history.actor||'平台',128),'state_transition',nullable(history.action),date(history.at)||new Date(),
   ])
  }
  const metric=task.metric||{}
  await connection.query(`
   INSERT INTO platform_pdca_task_extension
    (task_id,initiator_role,initiator_name,execution_owner_role,execution_owner_name,issue_category,issue_location,
     metric_code,metric_label,metric_direction,baseline_value,target_value,metric_unit,planned_start_at,submit_due_at,
     verification_due_at,started_at,submitted_at,verified_at,ai_target_rationale)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE initiator_role=VALUES(initiator_role),initiator_name=VALUES(initiator_name),
    execution_owner_role=VALUES(execution_owner_role),execution_owner_name=VALUES(execution_owner_name),
    issue_category=VALUES(issue_category),issue_location=VALUES(issue_location),metric_code=VALUES(metric_code),
    metric_label=VALUES(metric_label),metric_direction=VALUES(metric_direction),baseline_value=VALUES(baseline_value),
    target_value=VALUES(target_value),metric_unit=VALUES(metric_unit),planned_start_at=VALUES(planned_start_at),
    submit_due_at=VALUES(submit_due_at),verification_due_at=VALUES(verification_due_at),started_at=VALUES(started_at),
    submitted_at=VALUES(submitted_at),verified_at=VALUES(verified_at),ai_target_rationale=VALUES(ai_target_rationale)`,[
   task.id,nullable(text(task.initiatorRole||task.originRole||'',32)),nullable(text(task.initiatorName||'',128)),
   nullable(text(task.executionOwnerRole||'',32)),nullable(text(task.executionOwner||'',128)),nullable(text(task.issueCategory||'',64)),
   nullable(text(task.issueLocation||'',500)),nullable(text(metric.code||'',64)),nullable(text(metric.label||'',128)),
   nullable(text(metric.direction||'',16)),metric.baseline==null?null:Number(metric.baseline),metric.target==null?null:Number(metric.target),
   nullable(text(metric.unit||'',32)),date(task.plannedStartAt),date(task.submitDueAt||task.dueAt),date(task.verificationDueAt),
   date(task.startedAt),date(task.submittedAt),date(task.verifiedAt),nullable(task.aiRationale||task.aiTargetRationale),
  ])
  for(const node of task.nodes||[]){
   await connection.query(`
    INSERT INTO platform_pdca_node
     (id,task_id,node_code,node_name,target_text,owner_role,owner_name,planned_at,completed_at,status,result_text,sequence_no)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE node_name=VALUES(node_name),target_text=VALUES(target_text),owner_role=VALUES(owner_role),
     owner_name=VALUES(owner_name),planned_at=VALUES(planned_at),completed_at=VALUES(completed_at),
     status=VALUES(status),result_text=VALUES(result_text),sequence_no=VALUES(sequence_no)`,[
    text(node.id||`${task.id}:${node.code}`,128),task.id,text(node.code,32),text(node.name,128),nullable(node.target),
    nullable(text(node.ownerRole||'',32)),nullable(text(node.owner||'',128)),date(node.plannedAt),date(node.completedAt),
    text(node.status||'pending',32),nullable(node.result),Number(node.sequence||0),
   ])
  }
  for(const snapshot of task.metricSnapshots||[]){
   await connection.query(`
    INSERT INTO platform_pdca_metric_snapshot
     (id,task_id,metric_code,metric_label,actual_value,target_value,metric_unit,metric_direction,snapshot_type,source_name,observed_at,note_text)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE actual_value=VALUES(actual_value),target_value=VALUES(target_value),source_name=VALUES(source_name),
     observed_at=VALUES(observed_at),note_text=VALUES(note_text)`,[
    text(snapshot.id,128),task.id,text(snapshot.metricCode||metric.code||'general',64),text(snapshot.metricLabel||metric.label||'任务目标',128),
    snapshot.actual==null?null:Number(snapshot.actual),snapshot.target==null?null:Number(snapshot.target),
    nullable(text(snapshot.unit||metric.unit||'',32)),text(snapshot.direction||metric.direction||'higher',16),
    text(snapshot.type||'observation',32),nullable(text(snapshot.source||'',255)),date(snapshot.observedAt)||new Date(),nullable(snapshot.note),
   ])
  }
  if(task.sourceLabel==='质检协同单'){
   await connection.query(`
    INSERT INTO platform_quality_collaboration
     (id,quality_case_id,pdca_task_id,target_leader,requirement_text,feedback_due_at,reinspect_at,status)
    VALUES (?,NULL,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE target_leader=VALUES(target_leader),requirement_text=VALUES(requirement_text),
     feedback_due_at=VALUES(feedback_due_at),reinspect_at=VALUES(reinspect_at),status=VALUES(status)`,[
    text(`COL-${task.id}`,64),task.id,nullable(text(task.owner,128)),task.requirement||task.title,date(task.dueAt),date(task.reinspectAt),text(task.status,32),
   ])
  }
 }
}

const syncQuality=async(connection,state)=>{
 for(const record of state.quality?.records||[]){
  await connection.query(`
   INSERT INTO platform_quality_case
    (id,employee_code,employee_name,team_name,call_id,issue_type,severity,problem,standard_text,evidence,status,owner_name,created_by,created_at,updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE employee_code=VALUES(employee_code),employee_name=VALUES(employee_name),team_name=VALUES(team_name),
    call_id=VALUES(call_id),issue_type=VALUES(issue_type),severity=VALUES(severity),problem=VALUES(problem),
    standard_text=VALUES(standard_text),evidence=VALUES(evidence),status=VALUES(status),owner_name=VALUES(owner_name),updated_at=VALUES(updated_at)`,[
   text(record.id,64),nullable(text(record.employeeId||'',64)),nullable(text(record.employeeName||'',128)),nullable(text(record.team||'',255)),
   nullable(text(record.callId||'',128)),text(record.business||record.problem||'规范性问题',128),text(record.severity||'minor',32),
   record.problem||'待补充问题描述',nullable(record.standard),nullable(record.evidence),text(record.status||record.result||'open',32),
   nullable(text(record.owner||'',128)),text(record.inspector||record.createdBy||'质检岗位',128),date(record.createdAt)||new Date(),date(record.updatedAt)||new Date(),
  ])
 }
}

const syncTraining=async(connection,state)=>{
 for(const cohort of state.training?.cohorts||[]){
  const progressValues=(cohort.stages||[]).map(stage=>Number(stage.progress||0))
  const progress=progressValues.length?progressValues.reduce((sum,value)=>sum+value,0)/progressValues.length:0
  await connection.query(`
   INSERT INTO platform_training_plan
    (id,training_type,title,target_text,audience_text,planned_count,completed_count,target_pass_rate,actual_pass_rate,owner_name,manager_name,status,start_at,due_at,result_text,created_by,created_at,updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE title=VALUES(title),target_text=VALUES(target_text),audience_text=VALUES(audience_text),
    planned_count=VALUES(planned_count),completed_count=VALUES(completed_count),target_pass_rate=VALUES(target_pass_rate),
    actual_pass_rate=VALUES(actual_pass_rate),owner_name=VALUES(owner_name),manager_name=VALUES(manager_name),status=VALUES(status),
    due_at=VALUES(due_at),result_text=VALUES(result_text),updated_at=VALUES(updated_at)`,[
   text(cohort.id,64),'pre_job',text(cohort.name),`通关率≥${Number(cohort.targetPassRate||0)}%，出勤率≥${Number(cohort.targetAttendance||0)}%`,
   cohort.project,Number(cohort.planCount||0),Number(cohort.arrivedCount||0),Number(cohort.targetPassRate||0)/100||null,
   Number(cohort.forecastPassRate||0)/100||null,nullable(text(cohort.trainer||'',128)),'客服经理',text(cohort.status||'draft',32),
   date(cohort.startDate),date(cohort.plannedEndDate),`任务链平均进度${Math.round(progress)}%`,text(cohort.trainer||'培训岗位',128),
   date(cohort.startDate)||new Date(),new Date(),
  ])
 }
 for(const plan of state.training?.programs||[]){
  await connection.query(`
   INSERT INTO platform_training_plan
    (id,training_type,title,target_text,audience_text,planned_count,completed_count,target_pass_rate,actual_pass_rate,owner_name,manager_name,status,start_at,due_at,result_text,created_by,created_at,updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE title=VALUES(title),target_text=VALUES(target_text),audience_text=VALUES(audience_text),
    planned_count=VALUES(planned_count),completed_count=VALUES(completed_count),target_pass_rate=VALUES(target_pass_rate),
    actual_pass_rate=VALUES(actual_pass_rate),owner_name=VALUES(owner_name),manager_name=VALUES(manager_name),status=VALUES(status),
    due_at=VALUES(due_at),result_text=VALUES(result_text),updated_at=VALUES(updated_at)`,[
   text(plan.id,64),'on_job',text(plan.title),plan.baseline||plan.target||'完成培训并验证改善',nullable(plan.audience),
   Number(plan.audienceCount||0),Math.round(Number(plan.audienceCount||0)*Number(plan.actualCoverage||plan.progress||0)/100),
   Number(plan.targetPassRate||0)/100||null,Number(plan.actualPassRate||0)/100||null,nullable(text(plan.owner||'',128)),'客服经理',
   text(plan.status||'draft',32),date(plan.createdAt),date(plan.dueAt),nullable(plan.result),text(plan.createdBy||plan.owner||'培训岗位',128),
   date(plan.createdAt)||new Date(),date(plan.updatedAt)||new Date(),
  ])
 }
 for(const trainee of state.training?.trainees||[]){
  const score=Math.round((Number(trainee.theoryScore||0)+Number(trainee.practiceScore||0)+Number(trainee.scenarioScore||0))/3*100)/100
  await connection.query(`
   INSERT INTO platform_training_assignment
    (id,training_plan_id,employee_code,employee_name,team_name,status,score,feedback_text,verified_by,verified_at)
   VALUES (?,?,?,?,?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE training_plan_id=VALUES(training_plan_id),employee_code=VALUES(employee_code),employee_name=VALUES(employee_name),
    team_name=VALUES(team_name),status=VALUES(status),score=VALUES(score),feedback_text=VALUES(feedback_text),
    verified_by=VALUES(verified_by),verified_at=VALUES(verified_at)`,[
   text(trainee.id,64),text(trainee.cohortId,64),text(trainee.jobNo,64),nullable(text(trainee.name,128)),null,
   text(trainee.assessmentStatus||'assigned',32),score,nullable(trainee.supportPlan),nullable(trainee.assessmentStatus==='assessed'?'培训师':null),
   trainee.assessmentStatus==='assessed'?new Date():null,
  ])
 }
}

const syncWorkflowEntities=async(connection,state)=>{
 const groups=[
  ['workforce','workforce_request',state.workforce?.requests||[]],
  ['hrbp','retention_case',state.hrbpCases||[]],
  ['learning','learning_assignment',state.learning?.assignments||[]],
  ['development','development_case',state.learning?.developmentCases||[]],
  ['people','interview',state.people?.interviews||[]],
  ['governance','cross_department',state.governance?.crossDepartmentItems||[]],
  ['governance','shift_plan',state.governance?.shiftPlans||[]],
  ['training','training_report',state.trainingReports||[]],
 ]
 for(const [moduleCode,entityType,items] of groups){
  for(const item of items){
   await connection.query(`
    INSERT INTO platform_workflow_entity
     (module_code,entity_id,entity_type,status,owner_role,owner_name,due_at,payload_json,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE entity_type=VALUES(entity_type),status=VALUES(status),owner_role=VALUES(owner_role),
     owner_name=VALUES(owner_name),due_at=VALUES(due_at),payload_json=VALUES(payload_json),updated_at=VALUES(updated_at)`,[
    moduleCode,text(item.id,128),entityType,nullable(text(item.status||'',64)),nullable(text(item.ownerRole||item.responderRole||'',32)),
    nullable(text(item.owner||item.responderName||'',128)),date(item.dueAt||item.due),JSON.stringify(item),
    date(item.createdAt||item.sentAt)||new Date(),date(item.updatedAt||item.reviewedAt||item.sentAt)||new Date(),
   ])
  }
 }
}

const syncRuntimeRecords=async(connection,state)=>{
 for(const notice of state.notifications||[]){
  await connection.query(`
   INSERT INTO platform_notification
    (id,target_role,title,description_text,target_module,priority,created_at)
   VALUES (?,?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE target_role=VALUES(target_role),title=VALUES(title),
    description_text=VALUES(description_text),target_module=VALUES(target_module),priority=VALUES(priority)`,[
   text(notice.id,128),text(notice.role||'unknown',32),text(notice.title),nullable(notice.desc),
   nullable(text(notice.target||'',64)),text(notice.priority||'medium',32),date(notice.createdAt)||new Date(),
  ])
 }
 for(const run of state.reportRuns||[]){
  await connection.query(`
   INSERT INTO platform_report_run
    (id,project_id,report_type,report_name,requested_by,requested_role,status,artifact_name,artifact_bytes,
     output_rows,warning_count,download_count,source_snapshot_json,preview_json,started_at,completed_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE status=VALUES(status),artifact_name=VALUES(artifact_name),artifact_bytes=VALUES(artifact_bytes),
    output_rows=VALUES(output_rows),warning_count=VALUES(warning_count),download_count=VALUES(download_count),
    source_snapshot_json=VALUES(source_snapshot_json),preview_json=VALUES(preview_json),completed_at=VALUES(completed_at)`,[
   text(run.id,128),text(run.projectId||'unknown',128),text(run.reportType||'unknown',128),text(run.reportName||run.reportType||'报表'),
   text(run.requestedBy||'平台',128),nullable(text(run.requestedRole||'',32)),text(run.status||'completed',32),
   nullable(text(run.artifact?.fileName||'',255)),Number(run.metrics?.artifactBytes||0),Number(run.metrics?.outputRows||0),
   Number(run.warningCount||0),Number(run.downloadCount||0),JSON.stringify(run.sourceSnapshot||{}),JSON.stringify(run.preview||{}),
   date(run.startedAt||run.completedAt),date(run.completedAt)||new Date(),
  ])
 }
 for(const download of state.reportDownloads||[]){
  await connection.query(`
   INSERT INTO platform_report_download (id,report_run_id,requested_by,downloaded_at)
   VALUES (?,?,?,?)
   ON DUPLICATE KEY UPDATE requested_by=VALUES(requested_by),downloaded_at=VALUES(downloaded_at)`,[
   text(download.id,128),text(download.runId||download.reportRunId,128),text(download.requestedBy||'平台',128),
   date(download.downloadedAt||download.at)||new Date(),
  ])
 }
 for(const entry of state.audit||[]){
  const occurredAt=date(entry.at)||new Date()
  const fingerprint=createHash('sha256').update(`${entry.at}|${entry.actor}|${entry.action}`).digest('hex')
  await connection.query(`
   INSERT IGNORE INTO platform_audit_log (fingerprint,actor_name,action_note,occurred_at)
   VALUES (?,?,?,?)`,[fingerprint,text(entry.actor||'平台',128),entry.action||'未记录动作',occurredAt])
 }
}

export const syncBusinessStateWithConnection=async(connection,state)=>{
 await syncTasks(connection,state)
 await syncQuality(connection,state)
 await syncTraining(connection,state)
 await syncWorkflowEntities(connection,state)
 await syncRuntimeRecords(connection,state)
}

const persist=state=>databaseTransaction(connection=>syncBusinessStateWithConnection(connection,state))

const drain=async()=>{
 if(syncing)return
 syncing=true
 try{
  while(queuedState){
   const state=queuedState
   queuedState=null
   await persist(state)
  }
 }catch(error){
  console.error(`team_006业务状态同步失败: ${error.code||error.message}`)
 }finally{
  syncing=false
  if(queuedState)void drain()
 }
}

export const queueBusinessStateSync=state=>{
 queuedState=structuredClone(state)
 void drain()
}

export const syncBusinessState=state=>persist(structuredClone(state))
