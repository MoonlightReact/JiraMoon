CREATE TABLE IF NOT EXISTS order_items (
  id_order BIGINT UNSIGNED NOT NULL,
  id_game BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  image VARCHAR(255) NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_order, id_game),
  CONSTRAINT fk_order_items_order FOREIGN KEY (id_order) REFERENCES orders (id_order) ON DELETE CASCADE
);
