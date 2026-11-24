CREATE TABLE IF NOT EXISTS orders (
  id_order BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_user BIGINT NOT NULL,
  status ENUM('pending', 'approved', 'canceled') NOT NULL DEFAULT 'pending',
  total DECIMAL(10,2) NOT NULL,
  preference_id VARCHAR(50) NOT NULL,
  external_reference VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_orders_external_reference (external_reference),
  KEY idx_orders_user (id_user)
);
