CREATE TABLE IF NOT EXISTS platform_schema_migration (
  version VARCHAR(64) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_pdca_task (
  id VARCHAR(64) PRIMARY KEY,
  source_type VARCHAR(64) NOT NULL,
  source_id VARCHAR(128) NULL,
  title VARCHAR(255) NOT NULL,
  problem TEXT NULL,
  target_text TEXT NULL,
  owner_role VARCHAR(32) NOT NULL,
  owner_name VARCHAR(128) NULL,
  verification_role VARCHAR(32) NULL,
  employee_code VARCHAR(64) NULL,
  employee_name VARCHAR(128) NULL,
  team_name VARCHAR(255) NULL,
  phase CHAR(1) NOT NULL DEFAULT 'P',
  status VARCHAR(32) NOT NULL DEFAULT 'todo',
  progress DECIMAL(5,2) NOT NULL DEFAULT 0,
  due_at DATETIME NULL,
  success_criteria TEXT NULL,
  evidence TEXT NULL,
  result_text TEXT NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  closed_at DATETIME(3) NULL,
  INDEX idx_pdca_owner_status (owner_role,status),
  INDEX idx_pdca_employee (employee_code),
  INDEX idx_pdca_due_at (due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_pdca_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  actor_role VARCHAR(32) NULL,
  actor_name VARCHAR(128) NOT NULL,
  action_code VARCHAR(64) NOT NULL,
  action_note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_pdca_history_task_time (task_id,created_at),
  CONSTRAINT fk_pdca_history_task FOREIGN KEY (task_id) REFERENCES platform_pdca_task(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_quality_case (
  id VARCHAR(64) PRIMARY KEY,
  employee_code VARCHAR(64) NULL,
  employee_name VARCHAR(128) NULL,
  team_name VARCHAR(255) NULL,
  call_id VARCHAR(128) NULL,
  issue_type VARCHAR(128) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  problem TEXT NOT NULL,
  standard_text TEXT NULL,
  evidence TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  owner_name VARCHAR(128) NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_quality_employee_status (employee_code,status),
  INDEX idx_quality_team_status (team_name,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_quality_collaboration (
  id VARCHAR(64) PRIMARY KEY,
  quality_case_id VARCHAR(64) NULL,
  pdca_task_id VARCHAR(64) NOT NULL,
  target_leader VARCHAR(128) NULL,
  requirement_text TEXT NOT NULL,
  feedback_due_at DATETIME NULL,
  reinspect_at DATETIME NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'sent',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_quality_collaboration_task (pdca_task_id),
  CONSTRAINT fk_quality_collaboration_task FOREIGN KEY (pdca_task_id) REFERENCES platform_pdca_task(id),
  CONSTRAINT fk_quality_collaboration_case FOREIGN KEY (quality_case_id) REFERENCES platform_quality_case(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_training_plan (
  id VARCHAR(64) PRIMARY KEY,
  training_type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  target_text TEXT NOT NULL,
  audience_text TEXT NULL,
  planned_count INT NOT NULL DEFAULT 0,
  completed_count INT NOT NULL DEFAULT 0,
  target_pass_rate DECIMAL(7,4) NULL,
  actual_pass_rate DECIMAL(7,4) NULL,
  owner_name VARCHAR(128) NULL,
  manager_name VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  start_at DATETIME NULL,
  due_at DATETIME NULL,
  result_text TEXT NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_training_type_status (training_type,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_training_assignment (
  id VARCHAR(64) PRIMARY KEY,
  training_plan_id VARCHAR(64) NOT NULL,
  employee_code VARCHAR(64) NOT NULL,
  employee_name VARCHAR(128) NULL,
  team_name VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'assigned',
  score DECIMAL(7,2) NULL,
  feedback_text TEXT NULL,
  verified_by VARCHAR(128) NULL,
  verified_at DATETIME NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_training_plan_employee (training_plan_id,employee_code),
  CONSTRAINT fk_training_assignment_plan FOREIGN KEY (training_plan_id) REFERENCES platform_training_plan(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_business_audit (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module_code VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  actor_role VARCHAR(32) NULL,
  actor_name VARCHAR(128) NOT NULL,
  action_code VARCHAR(64) NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_business_audit_entity (entity_type,entity_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
