export type Role = 'director' | 'manager' | 'supervisor' | 'leader' | 'employee' | 'quality' | 'training' | 'hrbp'
export type Severity = 'critical' | 'warning' | 'notice'
export type AlertStatus = 'open' | 'processing' | 'closed'

export interface RoleMeta { id: Role; label: string; scope: string; initials: string }
export interface Metric { label: string; value: string; target: string; delta: number; status: 'good'|'risk'|'bad'; source: string; field: string }
export interface TeamMember { id: string; name: string; stage: string; status: 'online'|'busy'|'rest'|'offline'|'training'; response: number; cph: number; satisfaction: number; busyRest: number; trend: number; risk: Severity|'normal' }
export interface Alert { id: string; severity: Severity; type: string; person?: string; team: string; title: string; evidence: string; suggestion: string; due: string; status: AlertStatus; source: string; confidence: number }
export interface TaskItem { id: string; title: string; owner: string; source: string; phase: 'P'|'D'|'C'|'A'; due: string; progress: number; status: 'todo'|'doing'|'done' }

export interface SystemUser {
  id: string
  name: string
  jobNo: string
  roleId: string
  jobTitle: string
  department: string
  phone: string
  email: string
  status: 'active' | 'disabled'
  password?: string
  forceChangePassword: boolean
  moduleOverrides: string[]
  createdAt: string
}

export interface SystemRole {
  id: string
  name: string
  code: string
  level: string
  description: string
  memberCount: number
  menus: string[]
  builtIn: boolean
  status: 'active' | 'disabled'
}
