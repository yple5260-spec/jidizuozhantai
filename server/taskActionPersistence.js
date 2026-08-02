import { createHash } from 'node:crypto'

const date=value=>{
 const parsed=Date.parse(String(value||''))
 return Number.isFinite(parsed)?new Date(parsed):null
}
const text=(value,max=255)=>String(value||'').slice(0,max)
const nullable=value=>value==null||value===''?null:value

const upsertTask=async(connection,task)=>{
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
  date(task.createdAt)||new Date(),date(task.updatedAt)||new Date(),task.status==='closed'?(date(task.closedAt||task.updatedAt)||new Date()):null,
 ])
}

const appendHistory=async(connection,task,history,actorRole)=>{
 if(!history)return
 await connection.query(
  'INSERT INTO platform_pdca_history(task_id,actor_role,actor_name,action_code,action_note,created_at) VALUES (?,?,?,?,?,?)',
  [task.id,nullable(text(actorRole||'',32)),text(history.actor||'平台',128),'state_transition',nullable(history.action),date(history.at)||new Date()],
 )
}

const insertNotices=async(connection,notices)=>{
 for(const notice of notices||[]){
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
}

const insertAudit=async(connection,entry)=>{
 if(!entry)return
 const occurredAt=date(entry.at)||new Date()
 const fingerprint=createHash('sha256').update(`${entry.at}|${entry.actor}|${entry.action}`).digest('hex')
 await connection.query(
  'INSERT IGNORE INTO platform_audit_log (fingerprint,actor_name,action_note,occurred_at) VALUES (?,?,?,?)',
  [fingerprint,text(entry.actor||'平台',128),entry.action||'未记录动作',occurredAt],
 )
}

export const persistTaskActionCoreWithConnection=async(connection,{task,beforeTask,history,notifications,audit,actorRole,action,stateRevision})=>{
 await upsertTask(connection,task)
 await appendHistory(connection,task,history,actorRole)
 await insertNotices(connection,notifications)
 await insertAudit(connection,audit)
 await connection.query(`
  INSERT INTO platform_business_audit
   (module_code,entity_type,entity_id,actor_role,actor_name,action_code,before_json,after_json,created_at)
  VALUES ('pdca','task',?,?,?,?,?,?,?)`,[
  text(task.id,128),nullable(text(actorRole||'',32)),text(audit?.actor||history?.actor||'平台',128),
  text(action||'task_updated',64),JSON.stringify(beforeTask||{}),JSON.stringify(task),date(audit?.at||history?.at)||new Date(),
 ])
 await connection.query(`
  INSERT INTO platform_business_outbox
   (aggregate_type,aggregate_id,event_type,state_revision,payload_json,status)
  VALUES ('pdca_task',?,?,?,?, 'pending')`,[
  text(task.id,128),text(action||'task_updated',80),Number(stateRevision),JSON.stringify({task}),
 ])
}

export const syncTaskDerivedWithConnection=async(connection,task)=>{
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
 await connection.query(`
  INSERT INTO platform_pdca_control
   (task_id,archived_at,archived_by,archive_note,voided_at,voided_by,voided_by_role,void_reason,voided_from_status,next_follow_up_at,last_follow_up_at,intervention_count,intervention_requirement,reopen_count)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON DUPLICATE KEY UPDATE archived_at=VALUES(archived_at),archived_by=VALUES(archived_by),
   archive_note=VALUES(archive_note),voided_at=VALUES(voided_at),voided_by=VALUES(voided_by),voided_by_role=VALUES(voided_by_role),
   void_reason=VALUES(void_reason),voided_from_status=VALUES(voided_from_status),next_follow_up_at=VALUES(next_follow_up_at),
   last_follow_up_at=VALUES(last_follow_up_at),intervention_count=VALUES(intervention_count),
   intervention_requirement=VALUES(intervention_requirement),reopen_count=VALUES(reopen_count)`,[
  task.id,date(task.archivedAt),nullable(text(task.archivedBy||'',128)),nullable(task.archiveNote),
  date(task.voidedAt),nullable(text(task.voidedBy||'',128)),nullable(text(task.voidedByRole||'',32)),nullable(task.voidReason),nullable(text(task.voidedFromStatus||'',32)),
  date(task.nextFollowUpAt),date(task.lastFollowUpAt),Number(task.interventionCount||0),nullable(task.interventionRequirement),Number(task.reopenCount||0),
 ])
 for(const record of task.managementRecords||[]){
  await connection.query(`
   INSERT INTO platform_pdca_management_record
    (id,task_id,record_type,actor_role,actor_name,note_text,next_follow_up_at,before_json,after_json,created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?)
   ON DUPLICATE KEY UPDATE note_text=VALUES(note_text),next_follow_up_at=VALUES(next_follow_up_at),
    before_json=VALUES(before_json),after_json=VALUES(after_json)`,[
   text(record.id,128),task.id,text(record.type,32),text(record.actorRole||'unknown',32),
   text(record.actor||'平台',128),record.note||'未记录说明',date(record.nextFollowUpAt),
   JSON.stringify(record.before||{}),JSON.stringify(record.after||{}),date(record.createdAt)||new Date(),
  ])
 }
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
