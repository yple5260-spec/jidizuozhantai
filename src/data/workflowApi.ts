export type WorkflowEventStatus = 'pending_supervisor_review' | 'approved' | 'rejected' | 'closed'
export type WorkflowTaskStatus = 'todo' | 'doing' | 'pending_verification' | 'closed' | 'escalated' | 'executive_escalated' | 'returned_to_supervisor' | 'returned_to_leader' | 'returned_to_origin'

export interface WorkflowEvent {
  id:string; type:string; severity:'critical'|'warning'; title:string; team:string; person?:string
  evidence:string; suggestion:string; confidence:number; status:WorkflowEventStatus; createdAt:string; dueAt:string
  currentRole:string; reviewer:string; rule:string; source:string
  history:{at:string;actor:string;action:string}[]
}
export interface WorkflowTask {
  id:string;eventId:string;title:string;type:string;ownerRole:string;owner:string;supervisor:string
  status:WorkflowTaskStatus;phase:'P'|'D'|'C'|'A';progress:number;dueAt:string;evidence:string;verification:string
  createdAt:string;updatedAt:string;managerGuidance?:string;supervisorGuidance?:string;history:{at:string;actor:string;action:string}[]
  sourceKey?:string;sourceLabel?:string;person?:string;team?:string
  verificationRole?:string;employeeId?:string;leader?:string;qualityProblem?:string;qualityEvidence?:string
  requirement?:string;successCriteria?:string;reinspectAt?:string;workflowKind?:string;requestType?:string;requestDetail?:string
  originRole?:string;target?:string;aiRationale?:string;collaborationRole?:string
  initiatorRole?:string;initiatorName?:string;executionOwnerRole?:string;executionOwner?:string;verificationOwner?:string
  problem?:string;issueCategory?:string;issueLocation?:string;actionPlan?:string
  plannedStartAt?:string;submitDueAt?:string;verificationDueAt?:string;startedAt?:string;submittedAt?:string;verifiedAt?:string;closedAt?:string
  standardizedAction?:string
 archivedAt?:string;archivedBy?:string;archiveNote?:string;nextFollowUpAt?:string;lastFollowUpAt?:string
 interventionCount?:number;reopenCount?:number;interventionRequirement?:string
 slaStatus?:'not_applicable'|'archived'|'closed'|'follow_up_due'|'overdue_verification'|'overdue_execution'|'due_soon'|'on_track';slaDeadline?:string
  managementRecords?:{
   id:string;type:'follow_up'|'intervention'|'reassign'|'deadline_change'|'archive'|'reopen'|'comment'
   actorRole:string;actor:string;note:string;createdAt:string;nextFollowUpAt?:string
   before?:Record<string,string>;after?:Record<string,string>
  }[]
  metric?:{code:string;label:string;baseline:number|null;target:number|null;unit:string;direction:'higher'|'lower'}
  nodes?:{id:string;code:string;name:string;target:string;ownerRole:string;owner:string;plannedAt:string;completedAt:string;status:'pending'|'active'|'completed';sequence:number;result:string;completedBy?:string;completedByRole?:string}[]
  attachments?:{id:string;taskId:string;nodeCode:string;fileName:string;mimeType:string;fileSize:number;uploadedBy:string;uploadedRole:string;createdAt:string}[]
  metricSnapshots?:{id:string;metricCode:string;metricLabel:string;actual:number|null;target:number|null;unit:string;direction:'higher'|'lower';type:string;source:string;observedAt:string;note:string}[]
}
export interface WorkflowNotice {id:string;role:string;title:string;desc:string;target:string;priority:string;createdAt:string;read:boolean}
export interface TrainingReportRecord {
 id:string;reportDate:string;status:'pending_manager_review'|'reviewed';trainer:string;manager:string
 generatedAt:string;sentAt:string;reviewedAt:string;reviewedBy:string;reviewComment:string;summary:string
 metrics:{prejobTrainees:number;passForecast:number;onjobPrograms:number;onTimeRate:number}
 risks:string[];tomorrowPlan:string[]
}
export interface TrainingStage {
 id:string;name:string;owner:string;goal:string;dueAt:string;progress:number;status:'pending'|'active'|'done';evidence:string
}
export interface TrainingCohort {
 id:string;name:string;project:string;trainer:string;planCount:number;arrivedCount:number;startDate:string;plannedEndDate:string
 status:'training'|'completed';targetPassRate:number;targetAttendance:number;forecastPassRate:number;stages:TrainingStage[];history:{at:string;actor:string;action:string}[]
}
export interface TrainingTrainee {
 id:string;jobNo:string;name:string;cohortId:string;attendance:number;theoryScore:number;practiceScore:number;scenarioScore:number
 profileComplete:number;riskLevel:'high'|'attention'|'normal';assessmentStatus:'pending'|'assessed'
 ability:{business:number;system:number;communication:number};supportPlan:string;history:{at:string;actor:string;action:string}[]
}
export interface TrainingProgram {
 id:string;title:string;source:string;audience:string;audienceCount:number;owner:string;targetCoverage:number;targetPassRate:number
 actualCoverage:number;actualPassRate:number;progress:number;dueAt:string
 status:'active'|'quality_pending'|'returned_to_training'|'closed';effectStatus:'not_submitted'|'pending_quality_review'|'verified'|'failed'
 baseline:string;result:string;effectResult?:string;verifiedAt?:string;verifiedBy?:string;history:{at:string;actor:string;action:string}[]
}
export interface TrainingState {cohorts:TrainingCohort[];trainees:TrainingTrainee[];programs:TrainingProgram[]}
export interface QualityPlan {
 id:string;name:string;project:string;owner:string;date:string;targetSamples:number;completedSamples:number
 targetEmployeeCoverage:number;actualEmployeeCoverage:number;targetTimelyRate:number;actualTimelyRate:number
 status:'active'|'closed';dueAt:string;closedAt?:string;closedBy?:string
 strata:{team:string;target:number;completed:number;employeeCoverage:number}[];history:{at:string;actor:string;action:string}[]
}
export interface QualityRecord {
 id:string;planId:string;callId:string;employeeId:string;employeeName:string;team:string;business:string;score:number
 result:'passed'|'failed'|'adjusted';severity:'none'|'minor'|'major'|'critical';problem:string;standard:string;evidence:string
 inspector:string;inspectedAt:string;appealStatus:'none'|'appealed'|'upheld'|'overturned';collaborationTaskId:string;leader?:string
 history:{at:string;actor:string;action:string}[]
}
export interface QualityAppeal {
 id:string;recordId:string;applicantRole:'leader'|'employee';applicant:string;employeeName:string;team:string;reason:string
 status:'pending_quality_review'|'reviewing'|'upheld'|'overturned';owner:string;dueAt:string;reviewer:string;reviewResult:string
 createdAt:string;updatedAt:string;history:{at:string;actor:string;action:string}[]
}
export interface QualityCalibration {
 id:string;title:string;scope:string;sampleCount:number;targetConsistency:number;actualConsistency:number
 status:'planned'|'doing'|'action_required'|'closed';owner:string;dueAt:string;conclusion:string;participants:string[]
 closedAt?:string;history:{at:string;actor:string;action:string}[]
}
export interface QualityCase {
 id:string;title:string;category:string;sourceRecordId:string;problem:string;standard:string;example:string
 status:'draft'|'published';createdBy:string;reviewedBy:string;createdAt:string;publishedAt:string;history:{at:string;actor:string;action:string}[]
}
export interface QualityState {version:number;plans:QualityPlan[];records:QualityRecord[];appeals:QualityAppeal[];calibrations:QualityCalibration[];cases:QualityCase[]}
export interface StaffingPlan {
 id:string;project:string;month:string;approvedHeadcount:number;activeHeadcount:number;targetOccupancy:number;actualOccupancy:number
 hiringTarget:number;interviewed:number;offersAccepted:number;onboarded:number;gap:number;owner:string;dueAt:string
 status:'active'|'manager_pending'|'returned_hrbp'|'closed';managerComment:string
 channels:{name:string;target:number;interviewed:number;accepted:number}[];history:{at:string;actor:string;action:string}[]
}
export interface PeopleLifecycle {
 id:string;type:'onboarding_batch'|'transfer'|'resignation';title:string;employeeId:string;employeeName:string;personCount:number
 employeeIds:string[];source:string;fromOrg:string;toOrg:string;effectiveDate:string
 status:'training_pending'|'hrbp_preparing'|'manager_pending'|'hrbp_execute'|'returned_hrbp'|'closed'
 ownerRole:'training'|'hrbp'|'manager'|'closed';owner:string;detail:string;managerComment:string;result:string
 checklist:{contract:boolean;medical:boolean;account:boolean;shift:boolean;team:boolean}
 history:{at:string;actor:string;action:string}[]
}
export interface LaborCase {
 id:string;type:'contract_renewal'|'grievance'|'discipline';employeeId:string;employeeName:string;team:string;title:string
 risk:'high'|'medium'|'low';dueAt:string;status:'hrbp_todo'|'hrbp_doing'|'manager_pending'|'manager_doing'|'closed'
 ownerRole:'hrbp'|'manager'|'closed';owner:string;detail:string;result:string;history:{at:string;actor:string;action:string}[]
}
export interface PeopleCost {
 id:string;project:string;month:string;budget:number;actual:number;forecast:number;targetPerCapita:number;actualPerCapita:number
 overtimeCost:number;recruitmentCost:number;gap:number;updatedAt:string;history:{at:string;actor:string;action:string}[]
}
export interface PeopleInterview {
 id:string;type:'probation'|'retention'|'exit';employeeId:string;employeeName:string;team:string;interviewer:string
 scheduledAt:string;followUpAt:string;status:'planned'|'completed'|'followup_due'|'closed';conclusion:string
 commitments:string[];linkedCaseId:string;history:{at:string;actor:string;action:string}[]
}
export interface PeopleState {
 version:number;staffingPlans:StaffingPlan[];lifecycle:PeopleLifecycle[];laborCases:LaborCase[];costs:PeopleCost[];interviews:PeopleInterview[]
}
export interface LearningQuestionBank {
 id:string;title:string;version:string;category:string;questionCount:number;targetQuestionCount:number;passingScore:number
 status:'draft'|'published'|'retired';owner:string;updatedAt:string;history:{at:string;actor:string;action:string}[]
}
export interface LearningSession {
 id:string;title:string;type:'prejob'|'onjob';bankId:string;trainer:string;room:string;startAt:string;endAt:string
 capacity:number;enrolled:number;attendanceRate:number;targetAttendance:number;status:'planned'|'running'|'completed'
 history:{at:string;actor:string;action:string}[]
}
export interface LearningAssignment {
 id:string;employeeId:string;employeeName:string;team:string;leader:string;title:string;source:string;bankId:string
 targetScore:number;dueAt:string;status:'assigned'|'in_progress'|'failed'|'leader_verification'|'closed'
 score:number;attempts:number;progress:number;reflection:string;improvementTarget:string;leaderComment:string
 abilityDelta:{business:number;system:number;communication:number};history:{at:string;actor:string;action:string}[]
}
export interface LearningSuggestion {
 id:string;employeeId:string;employeeName:string;team:string;category:'business'|'system'|'management'|'learning';title:string;detail:string
 status:'pending_training'|'reviewing'|'accepted'|'rejected'|'closed';owner:string;response:string;createdAt:string
 history:{at:string;actor:string;action:string}[]
}
export interface GrowthReview {
 id:string;employeeId:string;employeeName:string;team:string;leader:string;milestone:30|60|90;dueAt:string
 status:'planned'|'training_review'|'leader_pending'|'closed';trainingComment:string;leaderComment:string
 metrics:{label:string;target:number;actual:number;unit:string;higherBetter:boolean}[];history:{at:string;actor:string;action:string}[]
}
export type DevelopmentRole='employee'|'leader'|'supervisor'|'quality'|'training'|'hrbp'|'manager'|'director'
export type DevelopmentStatus='pending_acceptance'|'in_progress'|'pending_verification'|'returned'|'closed'
export type DevelopmentCommentNode='plan'|'execute'|'verify'|'close'
export interface DevelopmentComment {
 id:string;nodeCode:DevelopmentCommentNode;nodeName:string;role:DevelopmentRole;actor:string;content:string;createdAt:string
}
export interface DevelopmentCase {
 id:string;type:'training'|'interview';title:string;reason:string;goal:string
 employeeId:string;employeeName:string;team:string
 initiatorRole:DevelopmentRole;initiatorName:string;responderRole:DevelopmentRole;responderName:string
 ownerRole:DevelopmentRole;verificationRole:DevelopmentRole;status:DevelopmentStatus
 plannedAt?:string;dueAt:string;verificationDueAt?:string;actionPlan?:string;successCriteria?:string
 createdAt:string;startedAt?:string;submittedAt?:string;closedAt?:string
 acknowledgement:string;result:string;verificationComment:string;comments?:DevelopmentComment[]
 history:{at:string;actor:string;action:string}[]
}
export interface LearningState {
 version:number;questionBanks:LearningQuestionBank[];sessions:LearningSession[];assignments:LearningAssignment[];suggestions:LearningSuggestion[];growthReviews:GrowthReview[];developmentCases:DevelopmentCase[]
}
export type HrbpCaseStatus='hrbp_todo'|'hrbp_contacting'|'manager_pending'|'manager_contacting'|'closed'
export interface HrbpCaseRecord {
 id:string;employeeId:string;name:string;team:string;batch:string;cycle:'培训期'|'实操期'|'实习期'|'正式期'
 riskScore:number;reasons:string[];status:HrbpCaseStatus;owner:string;createdAt:string;due:string
 hrbpNote?:string;managerNote?:string;result?:string;filedAt?:string;filedBy?:string
 history:{time:string;actor:string;action:string}[]
}
export type WorkforceRequestKind='shift_change'|'leave'|'attendance_exception'|'cross_team_dispatch'
export type WorkforceRequestStatus='leader_pending'|'supervisor_pending'|'manager_pending'|'hrbp_pending'|'closed'|'rejected'
export interface WorkforceEmployee {
 id:string;jobNo:string;name:string;role:'employee'|'leader';area:string;team:string;leader:string;stage:string
 skills:string[];status:'active'|'inactive';currentShift:string
}
export interface WorkforceCoverage {
 id:string;date:string;team:string;required:number;scheduled:number;onDuty:number;forecastLoad:number;targetCoverage:number
}
export interface WorkforceShift {
 id:string;employeeId:string;jobNo:string;name:string;team:string;date:string;shift:string;start:string;end:string
 status:'confirmed'|'adjusted'|'leave'
}
export interface WorkforceRequest {
 id:string;kind:WorkforceRequestKind;title:string;requesterRole:string;requester:string;employeeId:string;employeeName:string
 fromTeam:string;toTeam:string;date:string;detail:string;status:WorkforceRequestStatus;ownerRole:string;owner:string
 dueAt:string;createdAt:string;updatedAt:string;result:string;hrbpFiledAt:string;history:{at:string;actor:string;action:string}[]
 aiWarning?:{
  level:'warning';message:string;impact:string;acknowledged:boolean;acknowledgedBy:string;acknowledgedAt:string
 }|null
}
export interface WorkforceState {
 employees:WorkforceEmployee[];coverage:WorkforceCoverage[];shifts:WorkforceShift[];requests:WorkforceRequest[]
}
export interface GovernanceHistory {at:string;actor:string;action:string}
export interface GovernanceShiftPlan {
 id:string;date:string;area:string;targetCoverage:number;required:number;scheduled:number
 status:'draft'|'manager_pending'|'published'|'returned';ownerRole:string;owner:string;dueAt:string;comment:string;result:string
 teams:{team:string;required:number;scheduled:number;gap:number}[];history:GovernanceHistory[]
}
export interface GovernanceSkillRoute {
 id:string;source:string;fromSkill:string;toSkill:string;people:number;window:string;baselineAnswerRate:number;targetAnswerRate:number
 actualAnswerRate:number;sourceProtectionAfter:number;status:'draft'|'manager_pending'|'executing'|'effect_pending'|'closed'|'returned'
 ownerRole:string;owner:string;dueAt:string;result:string;history:GovernanceHistory[]
}
export interface GovernanceBudget {
 id:string;dataVersion?:string;month:string;project:string;revenueTarget:number;costBudget:number;forecastRevenue:number;forecastCost:number;targetMargin:number
 forecastMargin:number;status:'manager_draft'|'director_pending'|'active'|'returned'|'closed';ownerRole:string;owner:string;dueAt:string
 managerComment:string;directorComment:string;history:GovernanceHistory[]
}
export interface GovernanceContract {
 id:string;customer:string;project:string;amount:number|null;billingMode:string;startDate:string;endDate:string;renewalDue:string
 status:'active'|'expired'|'manager_draft'|'director_pending'|'approved'|'returned'|'closed';ownerRole:string;owner:string;risk:'low'|'medium'|'high'
 managerComment:string;directorComment:string;milestones:{name:string;status:'done'|'active'|'pending';dueAt:string}[];history:GovernanceHistory[]
}
export interface GovernanceMeetingAction {
 id:string;title:string;ownerRole:string;owner:string;dueAt:string;target:string;status:'draft'|'issued'
}
export interface GovernanceMeeting {
 id:string;date:string;title:string;status:'draft'|'published';ownerRole:string;owner:string;summary:string;conclusions:string[]
 actions:GovernanceMeetingAction[];publishedAt:string;history:GovernanceHistory[]
}
export interface GovernanceCrossDepartmentItem {
 id:string;title:string;originRole:string;targetRole:string;targetDepartment:string;detail:string;target:string;dueAt:string
 status:'target_pending'|'target_doing'|'director_verification'|'returned'|'closed';ownerRole:string;owner:string;result:string;history:GovernanceHistory[]
}
export interface GovernanceState {
 version:1;shiftPlans:GovernanceShiftPlan[];skillRoutes:GovernanceSkillRoute[];budgets:GovernanceBudget[];contracts:GovernanceContract[]
 meetings:GovernanceMeeting[];crossDepartmentItems:GovernanceCrossDepartmentItem[]
}
export interface ExcellenceEmployeeAchievement {id:string;jobNo:string;name:string;team:string;metric:string;unit:string;target:number;actual:number;qualityScore:number;effectiveTaskCount:number}
export interface ExcellenceExperience {id:string;title:string;category:string;sourceTaskId:string;sourceTaskTitle:string;ownerJobNo:string;ownerName:string;team:string;metric:string;unit:string;direction:'higher'|'lower';baseline:number;target:number;actual:number;actionSummary:string;steps:string[];evidence:string[];verifiedBy:string;verifiedAt:string;aiPublished:boolean;publishedAt:string;keywords:string[];invocationCount:number}
export interface ExcellenceRecording {id:string;title:string;callId:string;employeeJobNo:string;employeeName:string;team:string;business:string;durationSeconds:number;qualityScore:number;targetScore:number;submittedBy:string;submittedAt:string;aiSummary:string;highlights:string[];phraseIds:string[];aiPublished:boolean}
export interface ExcellencePhrase {id:string;text:string;scenario:string;sourceRecordingId:string;employeeName:string;qualityScore:number;tags:string[];useCount:number}
export interface ExcellenceState {version:1;evaluation:{period:string;topPercent:number;rule:string;minimumEvidenceTasks:number};employeeAchievements:ExcellenceEmployeeAchievement[];experiences:ExcellenceExperience[];recordings:ExcellenceRecording[];phrases:ExcellencePhrase[]}
export interface FinancialMetric {code:string;name:string;budget:number[];actual:number[]}
export interface FinancialPerformanceState {
 version:1;scope:string;asOf:string;months:string[];budgetMonths:string[]
 sources:{budget:{fileName:string;section:string;period:string};actual:{fileName:string;section:string;period:string}}
 dataQuality:{status:string;message:string};metrics:FinancialMetric[]
 recoveryPlan:{priority:number;title:string;owner:string;target:string;rationale:string}[]
}
export interface MorningBriefingTeam {team:string;leader:string;supervisor:string;planned:number;held:number;averageScore:number;latestScore:number;quality:string;needsHelp:boolean;diagnosis:string}
export interface MorningBriefingSchedule {id:string;date:string;time:string;team:string;leader:string;title:string;focus:string[];source:string;status:'draft'|'issued'|'completed';issuedBy:string;issuedAt:string;recording:{fileName:string;mimeType?:string;fileSize?:number;storageKey?:string;durationSeconds:number;recordedAt:string;aiSummary:string}|null;qualityScore:number;qualitySummary:string}
export interface MorningBriefingSuggestion {id:string;sourceRole:'quality'|'training';sourceName:string;title:string;content:string;targetTeam:string;proposedDate:string;status:'pending'|'adopted'|'rejected';supervisorComment:string;createdAt:string}
export interface MorningBriefingState {version:1;teams:MorningBriefingTeam[];schedules:MorningBriefingSchedule[];suggestions:MorningBriefingSuggestion[];todayBulletin:{date:string;title:string;points:string[];targets:string[];businessUpdate:string}}
export interface WorkflowState {
 persistenceRevision?:number
 meta:{lastRefresh:string;nextRefresh:string;refreshIntervalMinutes:number;batchNo:number;sourceMode:string}
 org:{base:string;business:string;area:string;approvalChain:string[]}
 events:WorkflowEvent[];tasks:WorkflowTask[];notifications:WorkflowNotice[];audit:{at:string;actor:string;action:string}[];trainingReports:TrainingReportRecord[];training:TrainingState;quality:QualityState;excellence:ExcellenceState;financialPerformance:FinancialPerformanceState;morningBriefings:MorningBriefingState;people:PeopleState;learning:LearningState;governance:GovernanceState;hrbpCases:HrbpCaseRecord[];workforce:WorkforceState
}
export interface WorkflowTaskActionPatch {
 patchType:'task_action';persistenceRevision?:number;task:WorkflowTask|null;tasks:WorkflowTask[]
 event:WorkflowEvent|null;events:WorkflowEvent[];notifications:WorkflowNotice[]
}
export type WorkflowMutationResult=WorkflowState|WorkflowTaskActionPatch

export const applyWorkflowMutation=(current:WorkflowState|null,result:WorkflowMutationResult):WorkflowState=>{
 if(!('patchType' in result))return result
 if(!current)throw new Error('任务状态尚未加载，请刷新后重试')
 const task=result.task
 const event=result.event
 const tasks=task
  ?current.tasks.some(item=>item.id===task.id)?current.tasks.map(item=>item.id===task.id?task:item):[task,...current.tasks]
  :current.tasks
 const events=event
  ?current.events.some(item=>item.id===event.id)?current.events.map(item=>item.id===event.id?event:item):[event,...current.events]
  :current.events
 const noticeIds=new Set(result.notifications.map(item=>item.id))
 return {
  ...current,
  ...(result.persistenceRevision===undefined?{}:{persistenceRevision:result.persistenceRevision}),
  tasks,events,notifications:[...result.notifications,...current.notifications.filter(item=>!noticeIds.has(item.id))],
 }
}

class WorkflowHttpError extends Error {
 status:number
 constructor(status:number,message:string){super(message);this.status=status}
}

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
const call=async<T=WorkflowState>(path:string,options:RequestInit={},retries=options.method?0:2):Promise<T>=>{
 let lastError:Error=new Error('请求失败')
 for(let attempt=0;attempt<=retries;attempt++){
  try{
   const r=await fetch(path,{headers:{'content-type':'application/json','cache-control':'no-cache'},cache:'no-store',credentials:'include',...options})
   const text=await r.text()
   let data:any={}
   if(text.trim())try{data=JSON.parse(text)}catch{throw new WorkflowHttpError(r.status,`业务服务响应格式异常（HTTP ${r.status}）`)}
   if(!r.ok) throw new WorkflowHttpError(r.status,data.error||`请求失败（HTTP ${r.status}）`)
   if(!text.trim()) throw new Error(`业务服务返回空响应（HTTP ${r.status}）`)
   return data as T
  }catch(error){
   lastError=error instanceof Error?error:new Error('请求失败')
   if(error instanceof WorkflowHttpError&&error.status>=400&&error.status<500)throw error
   if(attempt<retries) await sleep(300*(attempt+1))
  }
 }
 throw lastError
}
export const workflowApi={
 get:()=>call('/api/state'),
 reset:()=>call('/api/reset',{method:'POST'}),
 refresh:()=>call('/api/refresh',{method:'POST'}),
 excellenceMatches:(query:string)=>call<{taskId:string;query:string;matches:(ExcellenceExperience&{matchScore:number;matchedKeywords:string[]})[]}>(`/api/excellence/matches?query=${encodeURIComponent(query)}`),
 excellenceExperienceAction:(id:string,role:'director'|'manager'|'supervisor'|'quality'|'training',action:'publish_ai'|'withdraw_ai')=>call(`/api/excellence/experiences/${id}/action`,{method:'POST',body:JSON.stringify({role,action})}),
 createExcellenceRecording:(payload:{role:'quality';title:string;callId:string;employeeJobNo:string;employeeName:string;team:string;business:string;durationSeconds:number;qualityScore:number;targetScore:number;notes:string;phrase:string;aiPublished:boolean})=>call('/api/excellence/recordings',{method:'POST',body:JSON.stringify(payload)}),
 morningSuggestionCreate:(payload:{role:'quality'|'training';title:string;content:string;targetTeam:string;proposedDate:string})=>call('/api/morning-briefings/suggestions',{method:'POST',body:JSON.stringify(payload)}),
 morningSuggestionAction:(id:string,action:'adopt'|'reject',comment:string)=>call(`/api/morning-briefings/suggestions/${id}/action`,{method:'POST',body:JSON.stringify({role:'supervisor',action,comment})}),
 morningScheduleAction:(id:string,role:'supervisor'|'leader',action:'save'|'issue'|'complete',payload:Record<string,unknown>={})=>call(`/api/morning-briefings/schedules/${id}/action`,{method:'POST',body:JSON.stringify({role,action,...payload})}),
 morningHelpTask:(role:'manager'|'director',team:string)=>call('/api/morning-briefings/help-task',{method:'POST',body:JSON.stringify({role,team})}),
 review:(id:string,action:'approve'|'reject',comment='')=>call(`/api/events/${id}/review`,{method:'POST',body:JSON.stringify({role:'supervisor',actor:'前台客服主管',action,comment})}),
 createReportTask:(payload:{role:string;actor:string;reportDate:string;employee:{category:string;position:string;sourceRow:number;name:string;jobNo:string;team:string;reason:string}})=>call('/api/tasks',{method:'POST',body:JSON.stringify({...payload,source:'team-morning-brief'})}),
 createDirectiveTask:(payload:{role:string;title:string;targetRole:string;owner:string;problem:string;issueCategory:string;issueLocation:string;target:string;successCriteria:string;actionPlan:string;metricCode:string;metricLabel:string;metricUnit:string;metricDirection:'higher'|'lower';baselineValue:number;targetValue:number;plannedStartAt:string;submitDueAt:string;verificationDueAt:string;aiRationale:string;employeeCode?:string;employeeName?:string;team?:string})=>call('/api/tasks',{method:'POST',body:JSON.stringify({...payload,source:'management-directive'})}),
 createTaskRequest:(payload:{role:string;title:string;targetRole:string;owner:string;problem:string;issueCategory:string;issueLocation:string;target:string;successCriteria:string;actionPlan:string;metricCode:string;metricLabel:string;metricUnit:string;metricDirection:'higher'|'lower';baselineValue:number;targetValue:number;plannedStartAt:string;submitDueAt:string;verificationDueAt:string;aiRationale:string;employeeCode?:string;employeeName?:string;team?:string})=>call('/api/tasks',{method:'POST',body:JSON.stringify({...payload,source:'role-request'})}),
 createQualityCollaboration:(payload:{role:'quality';actor:string;requirement:string;dueAt:string;reinspectAt:string;successCriteria:string;employee:{id:string;name:string;team:string;leader:string;problem:string;evidence:string}})=>call('/api/quality/collaborations',{method:'POST',body:JSON.stringify(payload)}),
 qualityPlanAction:(id:string,action:'update'|'close',payload:Record<string,number>={})=>call(`/api/quality/plans/${id}/action`,{method:'POST',body:JSON.stringify({role:'quality',action,...payload})}),
 createQualityRecord:(payload:{planId:string;callId:string;employeeId:string;employeeName:string;team:string;business:string;score:number;result:'passed'|'failed';severity:'none'|'minor'|'major'|'critical';problem:string;standard:string;evidence:string})=>call('/api/quality/records',{method:'POST',body:JSON.stringify({role:'quality',...payload})}),
 createQualityAppeal:(role:'leader'|'employee',recordId:string,reason:string)=>call('/api/quality/appeals',{method:'POST',body:JSON.stringify({role,recordId,reason})}),
 qualityAppealAction:(id:string,action:'start'|'uphold'|'overturn',comment='')=>call(`/api/quality/appeals/${id}/action`,{method:'POST',body:JSON.stringify({role:'quality',action,comment})}),
 qualityCalibrationAction:(id:string,action:'start'|'complete',actualConsistency?:number,conclusion='')=>call(`/api/quality/calibrations/${id}/action`,{method:'POST',body:JSON.stringify({role:'quality',action,actualConsistency,conclusion})}),
 publishQualityCase:(id:string)=>call(`/api/quality/cases/${id}/action`,{method:'POST',body:JSON.stringify({role:'quality',action:'publish'})}),
 createEmployeeSupport:(payload:{role:'employee';actor:string;supportType:string;detail:string;dueAt:string;successCriteria:string;requester:{id:string;name:string;team:string;leader:string}})=>call('/api/employee/support-requests',{method:'POST',body:JSON.stringify(payload)}),
 publishTrainingReport:(payload:{role:'training';actor:string;reportDate:string;summary:string;metrics:{prejobTrainees:number;passForecast:number;onjobPrograms:number;onTimeRate:number};risks:string[];tomorrowPlan:string[]})=>call('/api/training/reports',{method:'POST',body:JSON.stringify(payload)}),
 reviewTrainingReport:(id:string,comment='')=>call(`/api/training/reports/${id}/review`,{method:'POST',body:JSON.stringify({role:'manager',actor:'客服经理',comment})}),
 trainingStageAction:(cohortId:string,stageId:string,progress:number,evidence='')=>call(`/api/training/cohorts/${cohortId}/stages/${stageId}/action`,{method:'POST',body:JSON.stringify({role:'training',progress,evidence})}),
 updateTrainingAssessment:(id:string,payload:{attendance:number;theoryScore:number;practiceScore:number;scenarioScore:number;profileComplete:number;ability:{business:number;system:number;communication:number};supportPlan:string})=>call(`/api/training/trainees/${id}/assessment`,{method:'PUT',body:JSON.stringify({role:'training',...payload})}),
 createTrainingProgram:(payload:{title:string;source:string;audience:string;audienceCount:number;targetCoverage:number;targetPassRate:number;dueAt:string;baseline:string})=>call('/api/training/programs',{method:'POST',body:JSON.stringify({role:'training',...payload})}),
 updateTrainingProgram:(id:string,payload:{progress:number;actualCoverage:number;actualPassRate:number;result:string})=>call(`/api/training/programs/${id}/action`,{method:'POST',body:JSON.stringify({role:'training',action:'update',...payload})}),
 verifyTrainingProgram:(id:string,verified:boolean,comment:string)=>call(`/api/training/programs/${id}/action`,{method:'POST',body:JSON.stringify({role:'quality',action:'quality_verify',verified,comment})}),
 createHrbpCase:(payload:{role:'hrbp';actor:string;plan:string;due:string;employee:{id:string;name:string;team:string;batch:string;cycle:HrbpCaseRecord['cycle'];riskScore:number;reasons:string[]}})=>call('/api/hrbp/cases',{method:'POST',body:JSON.stringify(payload)}),
 hrbpCaseAction:(id:string,role:'hrbp'|'manager',action:'hrbp_start'|'hrbp_close'|'escalate_manager'|'manager_start'|'manager_close'|'hrbp_file',note='')=>call(`/api/hrbp/cases/${id}/action`,{method:'POST',body:JSON.stringify({role,action,note,actor:role==='manager'?'运营经理':'HRBP经理'})}),
 staffingAction:(id:string,role:'hrbp'|'manager',action:'update_pipeline'|'submit_gap_plan'|'manager_approve'|'manager_return'|'close',payload:Record<string,string|number>={})=>call(`/api/hrbp/staffing/${id}/action`,{method:'POST',body:JSON.stringify({role,action,...payload})}),
 createLifecycle:(payload:{type:'transfer'|'resignation';employeeId:string;toOrg?:string;effectiveDate:string;detail:string})=>call('/api/hrbp/lifecycle',{method:'POST',body:JSON.stringify({role:'hrbp',...payload})}),
 lifecycleAction:(id:string,role:'hrbp'|'manager',action:'prepare'|'submit_manager'|'manager_approve'|'manager_return'|'complete',payload:Record<string,string|boolean>={})=>call(`/api/hrbp/lifecycle/${id}/action`,{method:'POST',body:JSON.stringify({role,action,...payload})}),
 laborAction:(id:string,role:'hrbp'|'manager',action:'start'|'escalate_manager'|'manager_start'|'close',result='')=>call(`/api/hrbp/labor/${id}/action`,{method:'POST',body:JSON.stringify({role,action,result})}),
 costAction:(id:string,forecast:number,actual:number)=>call(`/api/hrbp/costs/${id}/action`,{method:'POST',body:JSON.stringify({role:'hrbp',action:'update_forecast',forecast,actual})}),
 createInterview:(payload:{type:'probation'|'retention'|'exit';employeeId:string;scheduledAt:string;followUpAt:string;linkedCaseId?:string})=>call('/api/hrbp/interviews',{method:'POST',body:JSON.stringify({role:'hrbp',...payload})}),
 interviewAction:(id:string,action:'complete'|'close',conclusion:string,commitments:string[]=[] )=>call(`/api/hrbp/interviews/${id}/action`,{method:'POST',body:JSON.stringify({role:'hrbp',action,conclusion,commitments})}),
 learningBankAction:(id:string,action:'update'|'publish'|'retire',payload:Record<string,string|number>={})=>call(`/api/learning/banks/${id}/action`,{method:'POST',body:JSON.stringify({role:'training',action,...payload})}),
 learningSessionAction:(id:string,action:'start'|'complete',attendanceRate?:number)=>call(`/api/learning/sessions/${id}/action`,{method:'POST',body:JSON.stringify({role:'training',action,attendanceRate})}),
 createLearningAssignment:(payload:{employeeId:string;title:string;source:string;bankId:string;targetScore:number;dueAt:string;improvementTarget:string})=>call('/api/learning/assignments',{method:'POST',body:JSON.stringify({role:'training',...payload})}),
 learningAssignmentAction:(id:string,role:'employee'|'training'|'leader',action:'start'|'submit'|'reassign'|'leader_verify',payload:Record<string,string|number>={})=>call(`/api/learning/assignments/${id}/action`,{method:'POST',body:JSON.stringify({role,action,...payload})}),
 createLearningSuggestion:(payload:{category:LearningSuggestion['category'];title:string;detail:string})=>call('/api/learning/suggestions',{method:'POST',body:JSON.stringify({role:'employee',employeeId:'JR10776',...payload})}),
 learningSuggestionAction:(id:string,action:'start'|'accept'|'reject'|'close',response:string)=>call(`/api/learning/suggestions/${id}/action`,{method:'POST',body:JSON.stringify({role:'training',action,response})}),
 growthReviewAction:(id:string,role:'training'|'leader',action:'training_submit'|'leader_close',comment:string)=>call(`/api/learning/growth-reviews/${id}/action`,{method:'POST',body:JSON.stringify({role,action,comment})}),
 createDevelopmentCase:(payload:{role:DevelopmentRole;type:'training'|'interview';title:string;reason:string;goal:string;employeeId:string;responderRole:'employee';plannedAt:string;dueAt:string;verificationDueAt:string;actionPlan:string;successCriteria:string})=>call('/api/development/cases',{method:'POST',body:JSON.stringify(payload)}),
 developmentCaseAction:(id:string,role:DevelopmentRole,action:'accept'|'submit'|'verify_success'|'verify_return',comment:string)=>call(`/api/development/cases/${id}/action`,{method:'POST',body:JSON.stringify({role,action,comment})}),
 developmentCaseComment:(id:string,role:'supervisor'|'manager'|'director',nodeCode:DevelopmentCommentNode,comment:string)=>call(`/api/development/cases/${id}/comments`,{method:'POST',body:JSON.stringify({role,nodeCode,comment})}),
 governanceShiftPlanAction:(id:string,role:'supervisor'|'manager',action:'submit'|'manager_approve'|'manager_return',comment='')=>call(`/api/governance/shift-plans/${id}/action`,{method:'POST',body:JSON.stringify({role,action,comment})}),
 governanceSkillRouteAction:(id:string,role:'supervisor'|'manager',action:'submit'|'manager_approve'|'manager_return'|'submit_effect',payload:Record<string,string|number>={})=>call(`/api/governance/skill-routes/${id}/action`,{method:'POST',body:JSON.stringify({role,action,...payload})}),
 governanceBudgetAction:(id:string,role:'manager'|'director',action:'manager_submit'|'director_approve'|'director_return',comment='')=>call(`/api/governance/budgets/${id}/action`,{method:'POST',body:JSON.stringify({role,action,comment})}),
 governanceMeetingAction:(id:string,summary:string)=>call(`/api/governance/meetings/${id}/action`,{method:'POST',body:JSON.stringify({role:'director',action:'publish',summary})}),
 createCrossDepartmentItem:(payload:{title:string;targetRole:'manager'|'supervisor'|'hrbp'|'quality'|'training';targetDepartment:string;detail:string;target:string;dueAt:string})=>call('/api/governance/cross-department',{method:'POST',body:JSON.stringify({role:'director',...payload})}),
 governanceCrossDepartmentAction:(id:string,role:'manager'|'supervisor'|'hrbp'|'quality'|'training'|'director',action:'start'|'submit_result'|'director_verify'|'director_return',result='')=>call(`/api/governance/cross-department/${id}/action`,{method:'POST',body:JSON.stringify({role,action,result})}),
 createWorkforceRequest:(payload:{role:string;kind:WorkforceRequestKind;title?:string;employeeId?:string;fromTeam?:string;toTeam?:string;date:string;detail:string;dueAt?:string})=>call('/api/workforce/requests',{method:'POST',body:JSON.stringify(payload)}),
 workforceRequestAction:(id:string,role:string,action:'leader_approve'|'leader_reject'|'supervisor_approve'|'supervisor_reject'|'manager_acknowledge_warning'|'manager_approve'|'manager_reject'|'hrbp_file',comment='')=>call(`/api/workforce/requests/${id}/action`,{method:'POST',body:JSON.stringify({role,action,comment})}),
  taskAction:(id:string,role:string,action:string,payload:Record<string,string>={})=>call<WorkflowTaskActionPatch>(`/api/tasks/${id}/action`,{method:'POST',body:JSON.stringify({role,action,...payload})}),
 simulateTimeout:(role:string)=>call('/api/simulate-timeout',{method:'POST',body:JSON.stringify({role})})
}
