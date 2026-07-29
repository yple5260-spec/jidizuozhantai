CREATE TABLE IF NOT EXISTS platform_workflow_entity (
  module_code VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  status VARCHAR(64) NULL,
  owner_role VARCHAR(32) NULL,
  owner_name VARCHAR(128) NULL,
  due_at DATETIME NULL,
  payload_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (module_code,entity_id),
  INDEX idx_workflow_module_status (module_code,status),
  INDEX idx_workflow_owner (owner_role,status),
  INDEX idx_workflow_due_at (due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
