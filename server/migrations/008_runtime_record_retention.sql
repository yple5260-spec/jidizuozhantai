CREATE TABLE IF NOT EXISTS platform_notification_archive
LIKE platform_notification;

CREATE TABLE IF NOT EXISTS platform_audit_log_archive
LIKE platform_audit_log;

INSERT IGNORE INTO platform_notification_archive
SELECT * FROM platform_notification
WHERE target_role='data';

INSERT IGNORE INTO platform_audit_log_archive
SELECT * FROM platform_audit_log
WHERE actor_name='定时调度器';

DELETE FROM platform_notification_receipt
WHERE notification_id IN (
  SELECT id FROM platform_notification WHERE target_role='data'
);

DELETE FROM platform_notification
WHERE target_role='data';

DELETE FROM platform_audit_log
WHERE actor_name='定时调度器';

UPDATE platform_state_snapshot
SET payload_json=JSON_REMOVE(payload_json,'$.notifications','$.audit')
WHERE snapshot_key='primary';

DELETE FROM platform_notification
WHERE created_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 90 DAY);

DELETE FROM platform_audit_log
WHERE occurred_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 365 DAY);

DELETE FROM platform_business_audit
WHERE created_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 365 DAY);

DELETE FROM platform_scheduler_execution
WHERE completed_at IS NOT NULL
  AND completed_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 30 DAY);

DELETE FROM platform_business_outbox
WHERE status='completed'
  AND processed_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 7 DAY);
