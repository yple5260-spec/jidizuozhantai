import type { Role } from '../types'

export type LiveMetric={
 label:string;actual:number|null;target:number|null;unit:string;direction:'higher'|'lower';gap:number|null;status:'met'|'attention'|'unknown'
}
export type LiveMember={
 jobNo:string;name:string;team:string;leaderCode:string;supervisor:string;stage:string
 metrics:{responses:LiveMetric;cph:LiveMetric;satisfaction:LiveMetric;fcr:LiveMetric;busyRest:LiveMetric;repeatCall:LiveMetric}
 productivityDrivers:{
  formula:string;workHours:LiveMetric;utilization:LiveMetric;handleTime:LiveMetric;busyRest:LiveMetric
  talkSeconds:number|null;totalWorkSeconds:number|null;calculatedActualResponses:number|null;calculatedTargetResponses:number|null
  sourceImpacts:{workHours:number|null;utilization:number|null;talkTime:number|null;afterCall:number|null;busyRest:number|null}
 }
 monthly:{responses:LiveMetric;cph:LiveMetric;satisfaction:LiveMetric;fcr:LiveMetric}
 marketing:{valid:number;broadband:number;volume:number}
 flags:{potential:boolean;focus:boolean};summary:string;dataDate:string
}
export type LiveSalaryPerson={
 jobNo:string;name:string;team:string;position:string;contractSalary:number|null;performanceSalary:number|null
 businessReward:number|null;subsidies:number|null;rewards:number|null;grossSalary:number|null;netSalary:number|null;laborCost:number|null
}
export type RealDataState={
 meta:{mode:'real';sourceSchema:string;scopeLabel:string;warning:string;refreshedAt:string;dates:Record<string,string>}
 team:{members:LiveMember[];groups:{team:string;total:number;met:number;attention:number;potential:number;focus:number}[];marketing:{broadband:{period:string;result:number;rowsCount:number};package:{period:string;result:number;rowsCount:number}}}
 employee:{matched:boolean;profile:LiveMember;salary:LiveSalaryPerson|null;requestedJobNo:string}|null
 morning:{date:string;praise:LiveMember[];focus:LiveMember[];metrics:LiveMetric[];marketing:RealDataState['team']['marketing']}
 attendance:{dataDate:string;summary:{employeeCount:number;scheduled:number;fullWork:number;late:number;absent:number};people:{jobNo:string;name:string;team:string;leader:string;stage:string;schedule:string;attendanceStatus:string;fullWork:string;late:string;absent:string;signHours:number|null;dataDate:string}[]}
 hrbp:{dataMonth:string;lifecycle:{stage:string;total:number;departed:number;turnoverRate:number}[];teams:{team:string;total:number;departed:number;turnoverRate:number}[];risks:{jobNo:string;name:string;team:string;cycle:string;tenureDays:number;lateCount:number;absentCount:number;riskScore:number;reasons:string[]}[]}
 salary:{period:string;personal:LiveSalaryPerson|null;matched:boolean;distribution:{range:string;count:number;rate:number}[];projects:{project:string;headcount:number;averageSalary:number|null;averagePerformance:number|null;lowSalaryRate:number|null;salaryCostRate:number|null}[];team:LiveSalaryPerson[]}
}

export const realDataApi={
 get:async(role:Role)=>{
  const response=await fetch(`/api/real-data?role=${encodeURIComponent(role)}`,{cache:'no-store',credentials:'include'})
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(data.error||`真实数据接口请求失败（HTTP ${response.status}）`)
  return data as RealDataState
 },
}
