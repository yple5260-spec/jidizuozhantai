import { Alert, TaskItem } from '../types'
import { WorkflowEvent, WorkflowState, WorkflowTask } from './workflowApi'

const formatDue = (value:string) => new Date(value).toLocaleString('zh-CN', {
  month:'2-digit',
  day:'2-digit',
  hour:'2-digit',
  minute:'2-digit',
})

export const workflowEventToAlert = (event:WorkflowEvent):Alert => ({
  id:event.id,
  severity:event.severity,
  type:event.type,
  person:event.person,
  team:event.team,
  title:event.title,
  evidence:event.evidence,
  suggestion:event.suggestion,
  due:formatDue(event.dueAt),
  status:event.status==='pending_supervisor_review'?'open':event.status==='approved'?'processing':'closed',
  source:event.source,
  confidence:event.confidence,
})

export const workflowTaskToTaskItem = (task:WorkflowTask):TaskItem => ({
  id:task.id,
  title:task.title,
  owner:task.owner,
  source:task.sourceLabel||`AI${task.type}预警`,
  phase:task.phase,
  due:formatDue(task.dueAt),
  progress:task.progress,
  status:task.status==='closed'?'done':task.status==='todo'?'todo':'doing',
})

export const workflowAlerts = (state:WorkflowState|null) => state?.events.map(workflowEventToAlert) ?? []
export const workflowTasks = (state:WorkflowState|null) => state?.tasks.map(workflowTaskToTaskItem) ?? []
export const pendingWorkflowEventCount = (state:WorkflowState|null) => state?.events.filter(event=>event.status==='pending_supervisor_review').length ?? 0
export const openWorkflowTaskCount = (state:WorkflowState|null,role?:string) => state?.tasks.filter(task=>task.status!=='closed'&&(!role||task.ownerRole===role)).length ?? 0
