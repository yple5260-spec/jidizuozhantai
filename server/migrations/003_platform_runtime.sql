CREATE TABLE IF NOT EXISTS platform_state_snapshot (
  snapshot_key VARCHAR(64) PRIMARY KEY,
  payload_json JSON NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_system_role (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  code VARCHAR(80) NOT NULL,
  level_name VARCHAR(80) NOT NULL,
  description_text TEXT NULL,
  menus_json JSON NOT NULL,
  built_in TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_system_role_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_system_user (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  job_no VARCHAR(64) NOT NULL,
  role_id VARCHAR(64) NOT NULL,
  job_title VARCHAR(128) NOT NULL,
  department VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NULL,
  email VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  password_hash VARCHAR(512) NOT NULL,
  force_change_password TINYINT(1) NOT NULL DEFAULT 1,
  password_changed_at DATETIME(3) NULL,
  failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME(3) NULL,
  last_login_at DATETIME(3) NULL,
  last_login_ip VARCHAR(64) NULL,
  session_version INT UNSIGNED NOT NULL DEFAULT 1,
  module_overrides_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_system_user_job_no (job_no),
  INDEX idx_system_user_role_status (role_id,status),
  CONSTRAINT fk_system_user_role FOREIGN KEY (role_id) REFERENCES platform_system_role(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_access_audit (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fingerprint CHAR(64) NOT NULL,
  actor_user_id VARCHAR(64) NULL,
  actor_name VARCHAR(128) NOT NULL,
  action_code VARCHAR(80) NOT NULL,
  action_note TEXT NULL,
  client_ip VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_access_audit_fingerprint (fingerprint),
  INDEX idx_access_audit_actor_time (actor_user_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_notification (
  id VARCHAR(128) PRIMARY KEY,
  target_role VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description_text TEXT NULL,
  target_module VARCHAR(64) NULL,
  priority VARCHAR(32) NOT NULL DEFAULT 'medium',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_notification_role_time (target_role,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_notification_receipt (
  notification_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  read_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (notification_id,user_id),
  INDEX idx_notification_receipt_user_time (user_id,read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_ai_thread (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  runtime_role VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '新对话',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_ai_thread_user_role (user_id,runtime_role,status,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_ai_message (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  thread_id VARCHAR(128) NOT NULL,
  message_role VARCHAR(32) NOT NULL,
  content_text MEDIUMTEXT NOT NULL,
  model_name VARCHAR(128) NULL,
  token_usage_json JSON NULL,
  context_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_ai_message_thread_time (thread_id,created_at),
  CONSTRAINT fk_ai_message_thread FOREIGN KEY (thread_id) REFERENCES platform_ai_thread(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_report_run (
  id VARCHAR(128) PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL,
  report_type VARCHAR(128) NOT NULL,
  report_name VARCHAR(255) NOT NULL,
  requested_by VARCHAR(128) NOT NULL,
  requested_role VARCHAR(32) NULL,
  status VARCHAR(32) NOT NULL,
  artifact_name VARCHAR(255) NULL,
  artifact_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  output_rows INT UNSIGNED NOT NULL DEFAULT 0,
  warning_count INT UNSIGNED NOT NULL DEFAULT 0,
  download_count INT UNSIGNED NOT NULL DEFAULT 0,
  source_snapshot_json JSON NULL,
  preview_json JSON NULL,
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_report_run_project_time (project_id,completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_report_download (
  id VARCHAR(128) PRIMARY KEY,
  report_run_id VARCHAR(128) NOT NULL,
  requested_by VARCHAR(128) NOT NULL,
  downloaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_report_download_run_time (report_run_id,downloaded_at),
  CONSTRAINT fk_report_download_run FOREIGN KEY (report_run_id) REFERENCES platform_report_run(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_audit_log (
  fingerprint CHAR(64) PRIMARY KEY,
  actor_name VARCHAR(128) NOT NULL,
  action_note TEXT NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_audit_log_occurred_at (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_scheduler_execution (
  job_name VARCHAR(128) NOT NULL,
  batch_key VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  owner_id VARCHAR(128) NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  result_text TEXT NULL,
  PRIMARY KEY (job_name,batch_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
