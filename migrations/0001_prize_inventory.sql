CREATE TABLE prize_inventory (
  code TEXT PRIMARY KEY CHECK (code IN ('sticker', 'tumbler', 'cleaner', 'notebook')),
  label TEXT NOT NULL,
  initial_quantity INTEGER CHECK (initial_quantity IS NULL OR initial_quantity >= 0),
  CHECK (
    (code = 'sticker' AND initial_quantity IS NULL)
    OR
    (code <> 'sticker' AND initial_quantity IS NOT NULL)
  )
);

INSERT INTO prize_inventory (code, label, initial_quantity) VALUES
  ('sticker', '스티커', NULL),
  ('tumbler', '텀블러', 20),
  ('cleaner', '클리너', 20),
  ('notebook', '노트', 20);

-- 유한 상품의 실물 한 개를 슬롯 한 행으로 표현한다. 당첨 기록의 UNIQUE 제약이
-- 같은 슬롯의 중복 지급을 막으므로 별도의 가변 remaining 값이나 트리거가 필요 없다.
CREATE TABLE prize_stock_units (
  prize_code TEXT NOT NULL REFERENCES prize_inventory(code),
  stock_slot INTEGER NOT NULL CHECK (stock_slot > 0),
  PRIMARY KEY (prize_code, stock_slot)
);

WITH RECURSIVE slots(slot) AS (
  VALUES (1)
  UNION ALL
  SELECT slot + 1 FROM slots WHERE slot < 20
)
INSERT INTO prize_stock_units (prize_code, stock_slot)
SELECT inventory.code, slots.slot
FROM prize_inventory AS inventory
CROSS JOIN slots
WHERE inventory.initial_quantity IS NOT NULL
  AND slots.slot <= inventory.initial_quantity;

CREATE TABLE prize_wins (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL UNIQUE,
  prize_code TEXT NOT NULL REFERENCES prize_inventory(code),
  stock_slot INTEGER,
  quiz_score INTEGER NOT NULL CHECK (quiz_score >= 0),
  quiz_total INTEGER NOT NULL CHECK (quiz_total BETWEEN 1 AND 10),
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms BETWEEN 0 AND 600000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (quiz_score <= quiz_total),
  CHECK (
    (prize_code = 'sticker' AND stock_slot IS NULL)
    OR
    (prize_code <> 'sticker' AND stock_slot IS NOT NULL)
  ),
  UNIQUE (prize_code, stock_slot),
  FOREIGN KEY (prize_code, stock_slot)
    REFERENCES prize_stock_units(prize_code, stock_slot)
);

CREATE INDEX prize_wins_created_at_idx ON prize_wins(created_at DESC);
CREATE INDEX prize_wins_prize_code_idx ON prize_wins(prize_code);

CREATE VIEW prize_inventory_status AS
SELECT
  inventory.code,
  inventory.label,
  inventory.initial_quantity,
  CASE
    WHEN inventory.initial_quantity IS NULL THEN NULL
    ELSE inventory.initial_quantity - (
      SELECT COUNT(*)
      FROM prize_wins AS wins
      WHERE wins.prize_code = inventory.code
    )
  END AS remaining
FROM prize_inventory AS inventory;
