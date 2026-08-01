CREATE TABLE IF NOT EXISTS platform_pdca_control (
  task_id VARCHAR(64) PRIMARY KEY,
  archived_at DATETIME(3) NULL,
  archived_by VARCHAR(128) NULL,
  archive_note TEXT NULL,
  next_follow_up_at DATETIME(3) NULL,
  last_follow_up_at DATETIME(3) NULL,
  intervention_count INT UNSIGNED NOT NULL DEFAULT 0,
  reopen_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_pdca_control_follow_up (next_follow_up_at),
  INDEX idx_pdca_control_archive (archived_at),
  CONSTRAINT fk_pdca_control_task FOREIGN KEY (task_id) REFERENCES platform_pdca_task(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_pdca_management_record (
  id VARCHAR(128) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  record_type VARCHAR(32) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  actor_name VARCHAR(128) NOT NULL,
  note_text TEXT NOT NULL,
  next_follow_up_at DATETIME(3) NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  created_at DATETIME(3) NOT NULL,
  INDEX idx_pdca_management_task_time (task_id,created_at),
  INDEX idx_pdca_management_type_time (record_type,created_at),
  CONSTRAINT fk_pdca_management_task FOREIGN KEY (task_id) REFERENCES platform_pdca_task(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
