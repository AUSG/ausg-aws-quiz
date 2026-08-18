-- 운영 중 재고와 당첨 기록은 그대로 두고, 경품 지급 여부/가중치와
-- 부스 퀴즈 문항 수 설정을 추가한다.
PRAGMA defer_foreign_keys = on;

DROP VIEW prize_inventory_status;

ALTER TABLE prize_inventory
ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1));

ALTER TABLE prize_inventory
ADD COLUMN weight INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 100);

CREATE TABLE booth_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  question_count INTEGER NOT NULL CHECK (question_count BETWEEN 3 AND 5),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO booth_settings (id, question_count) VALUES (1, 3);

CREATE VIEW prize_inventory_status AS
SELECT
  inventory.code,
  inventory.label,
  inventory.color,
  inventory.unlimited,
  inventory.enabled,
  inventory.weight,
  inventory.sort_order,
  CASE
    WHEN inventory.unlimited = 1 THEN NULL
    ELSE (
      SELECT COUNT(*)
      FROM prize_stock_units AS stock
      WHERE stock.prize_code = inventory.code
    )
  END AS initial_quantity,
  CASE
    WHEN inventory.unlimited = 1 THEN NULL
    ELSE (
      SELECT COUNT(*)
      FROM prize_stock_units AS stock
      LEFT JOIN prize_wins AS wins
        ON wins.prize_code = stock.prize_code
       AND wins.stock_slot = stock.stock_slot
      WHERE stock.prize_code = inventory.code
        AND wins.id IS NULL
    )
  END AS remaining
FROM prize_inventory AS inventory;

-- 관리자 실수로 모든 경품을 한 번에 끄면 참가자가 룰렛을 열 수 없으므로
-- 최소 한 종류는 지급 켬 상태로 유지한다.
CREATE TRIGGER prize_inventory_keep_one_enabled
BEFORE UPDATE OF enabled ON prize_inventory
WHEN
  OLD.enabled = 1
  AND NEW.enabled = 0
  AND NOT EXISTS (
    SELECT 1
    FROM prize_inventory
    WHERE code <> OLD.code AND enabled = 1
  )
BEGIN
  SELECT RAISE(ABORT, 'LAST_ENABLED_PRIZE');
END;

PRAGMA foreign_key_check;
PRAGMA defer_foreign_keys = off;
