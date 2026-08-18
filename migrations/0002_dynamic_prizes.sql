-- 운영 중 당첨 기록을 보존하면서 고정 4종 스키마를 동적 경품 스키마로 바꾼다.
-- D1은 migration 전체를 트랜잭션으로 실행하므로, 테이블 교체 중에만 FK 검사를 미룬다.
PRAGMA defer_foreign_keys = on;

DROP VIEW prize_inventory_status;

CREATE TABLE prize_inventory_v2 (
  code TEXT PRIMARY KEY
    CHECK (length(code) BETWEEN 1 AND 64),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 30),
  color TEXT NOT NULL CHECK (length(color) = 7 AND substr(color, 1, 1) = '#'),
  unlimited INTEGER NOT NULL DEFAULT 0 CHECK (unlimited IN (0, 1)),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO prize_inventory_v2 (code, label, color, unlimited, sort_order)
SELECT
  code,
  label,
  CASE code
    WHEN 'sticker' THEN '#2e49f5'
    WHEN 'tumbler' THEN '#ff9900'
    WHEN 'cleaner' THEN '#0f9f6e'
    WHEN 'notebook' THEN '#a0a2ff'
  END,
  CASE WHEN code = 'sticker' THEN 1 ELSE 0 END,
  CASE code
    WHEN 'sticker' THEN 0
    WHEN 'tumbler' THEN 1
    WHEN 'cleaner' THEN 2
    WHEN 'notebook' THEN 3
  END
FROM prize_inventory;

CREATE TABLE prize_stock_units_v2 (
  prize_code TEXT NOT NULL REFERENCES prize_inventory_v2(code),
  stock_slot INTEGER NOT NULL CHECK (stock_slot > 0),
  PRIMARY KEY (prize_code, stock_slot)
);

INSERT INTO prize_stock_units_v2 (prize_code, stock_slot)
SELECT prize_code, stock_slot FROM prize_stock_units;

CREATE TABLE prize_wins_v2 (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL UNIQUE,
  prize_code TEXT NOT NULL REFERENCES prize_inventory_v2(code),
  stock_slot INTEGER CHECK (stock_slot IS NULL OR stock_slot > 0),
  quiz_score INTEGER NOT NULL CHECK (quiz_score >= 0),
  quiz_total INTEGER NOT NULL CHECK (quiz_total BETWEEN 1 AND 10),
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms BETWEEN 0 AND 600000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (quiz_score <= quiz_total),
  UNIQUE (prize_code, stock_slot),
  FOREIGN KEY (prize_code, stock_slot)
    REFERENCES prize_stock_units_v2(prize_code, stock_slot)
);

INSERT INTO prize_wins_v2
  (id, attempt_id, prize_code, stock_slot, quiz_score, quiz_total, elapsed_ms, created_at)
SELECT
  id, attempt_id, prize_code, stock_slot, quiz_score, quiz_total, elapsed_ms, created_at
FROM prize_wins;

DROP TABLE prize_wins;
DROP TABLE prize_stock_units;
DROP TABLE prize_inventory;

ALTER TABLE prize_inventory_v2 RENAME TO prize_inventory;
ALTER TABLE prize_stock_units_v2 RENAME TO prize_stock_units;
ALTER TABLE prize_wins_v2 RENAME TO prize_wins;

CREATE INDEX prize_wins_created_at_idx ON prize_wins(created_at DESC);
CREATE INDEX prize_wins_prize_code_idx ON prize_wins(prize_code);
CREATE INDEX prize_inventory_sort_order_idx ON prize_inventory(sort_order, code);

-- 무제한 상품은 슬롯이 없어야 하고, 유한 상품은 반드시 실제 재고 슬롯을 가져야 한다.
CREATE TRIGGER prize_wins_stock_kind_insert
BEFORE INSERT ON prize_wins
WHEN
  ((SELECT unlimited FROM prize_inventory WHERE code = NEW.prize_code) = 1
    AND NEW.stock_slot IS NOT NULL)
  OR
  ((SELECT unlimited FROM prize_inventory WHERE code = NEW.prize_code) = 0
    AND NEW.stock_slot IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'INVALID_PRIZE_STOCK_SLOT');
END;

CREATE VIEW prize_inventory_status AS
SELECT
  inventory.code,
  inventory.label,
  inventory.color,
  inventory.unlimited,
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

PRAGMA foreign_key_check;
PRAGMA defer_foreign_keys = off;
