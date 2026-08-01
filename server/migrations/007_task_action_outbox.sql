CREATE TABLE IF NOT EXISTS platform_business_outbox (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  state_revision BIGINT UNSIGNED NOT NULL,
  payload_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  locked_at DATETIME(3) NULL,
  locked_by VARCHAR(128) NULL,
  last_error TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  processed_at DATETIME(3) NULL,
  INDEX idx_business_outbox_pending (status,available_at,id),
  INDEX idx_business_outbox_aggregate (aggregate_type,aggregate_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_pdca_projection_revision (
  task_id VARCHAR(64) PRIMARY KEY,
  state_revision BIGINT UNSIGNED NOT NULL,
  projected_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_pdca_projection_task FOREIGN KEY (task_id) REFERENCES platform_pdca_task(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
