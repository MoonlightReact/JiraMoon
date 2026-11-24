CREATE TABLE IF NOT EXISTS notification (
  id_notification BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_envelope VARCHAR(64) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  external_reference VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(150) NOT NULL,
  status ENUM('sent', 'failed') NOT NULL DEFAULT 'sent',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notification_event_ref (event_name, external_reference)
);
