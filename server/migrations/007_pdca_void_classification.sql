ALTER TABLE platform_pdca_control
  ADD COLUMN voided_at DATETIME(3) NULL AFTER archive_note,
  ADD COLUMN voided_by VARCHAR(128) NULL AFTER voided_at,
  ADD COLUMN voided_by_role VARCHAR(32) NULL AFTER voided_by,
  ADD COLUMN void_reason TEXT NULL AFTER voided_by_role,
  ADD COLUMN voided_from_status VARCHAR(32) NULL AFTER void_reason,
  ADD INDEX idx_pdca_control_voided (voided_at);
