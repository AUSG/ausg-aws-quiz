-- 경품 목록과 수량은 계속 실시간으로 바뀌지만, 매 요청마다 전체 당첨 기록과
-- 재고 슬롯을 다시 세지 않도록 현재 상태를 작은 집계 행으로 유지한다.
PRAGMA defer_foreign_keys = on;

DROP VIEW prize_inventory_status;

ALTER TABLE prize_stock_units
ADD COLUMN claimed INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0, 1));

-- 기존 당첨 기록을 보존한 채 이미 지급된 슬롯을 표시한다.
UPDATE prize_stock_units AS stock
SET claimed = 1
WHERE EXISTS (
  SELECT 1
  FROM prize_wins AS wins
  WHERE wins.prize_code = stock.prize_code
    AND wins.stock_slot = stock.stock_slot
);

CREATE TABLE prize_stock_counts (
  prize_code TEXT PRIMARY KEY
    REFERENCES prize_inventory(code) ON DELETE CASCADE,
  initial_quantity INTEGER NOT NULL DEFAULT 0
    CHECK (initial_quantity >= 0),
  remaining INTEGER NOT NULL DEFAULT 0
    CHECK (remaining >= 0 AND remaining <= initial_quantity)
);

INSERT INTO prize_stock_counts (prize_code, initial_quantity, remaining)
SELECT
  inventory.code,
  COUNT(stock.stock_slot),
  COALESCE(
    SUM(CASE WHEN stock.stock_slot IS NOT NULL AND stock.claimed = 0 THEN 1 ELSE 0 END),
    0
  )
FROM prize_inventory AS inventory
LEFT JOIN prize_stock_units AS stock
  ON stock.prize_code = inventory.code
WHERE inventory.unlimited = 0
GROUP BY inventory.code;

CREATE TABLE booth_stats (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total_wins INTEGER NOT NULL DEFAULT 0 CHECK (total_wins >= 0)
);

INSERT INTO booth_stats (id, total_wins)
SELECT 1, COUNT(*) FROM prize_wins;

CREATE INDEX prize_stock_units_available_idx
ON prize_stock_units(prize_code, claimed, stock_slot);

-- 새 유한 경품은 수량이 0이어도 집계 행을 바로 가진다.
CREATE TRIGGER prize_inventory_create_stock_count
AFTER INSERT ON prize_inventory
WHEN NEW.unlimited = 0
BEGIN
  INSERT INTO prize_stock_counts (prize_code, initial_quantity, remaining)
  VALUES (NEW.code, 0, 0);
END;

CREATE TRIGGER prize_inventory_keep_kind
BEFORE UPDATE OF unlimited ON prize_inventory
WHEN NEW.unlimited <> OLD.unlimited
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_PRIZE_KIND');
END;

CREATE TRIGGER prize_stock_units_finite_only
BEFORE INSERT ON prize_stock_units
WHEN COALESCE(
  (SELECT unlimited FROM prize_inventory WHERE code = NEW.prize_code),
  1
) <> 0
BEGIN
  SELECT RAISE(ABORT, 'INVALID_FINITE_PRIZE_STOCK');
END;

CREATE TRIGGER prize_stock_units_apply_insert
AFTER INSERT ON prize_stock_units
BEGIN
  UPDATE prize_stock_counts
  SET
    initial_quantity = initial_quantity + 1,
    remaining = remaining + CASE WHEN NEW.claimed = 0 THEN 1 ELSE 0 END
  WHERE prize_code = NEW.prize_code;
END;

CREATE TRIGGER prize_stock_units_protect_claimed
BEFORE DELETE ON prize_stock_units
WHEN OLD.claimed = 1
BEGIN
  SELECT RAISE(ABORT, 'CLAIMED_STOCK_UNIT');
END;

CREATE TRIGGER prize_stock_units_apply_delete
AFTER DELETE ON prize_stock_units
BEGIN
  UPDATE prize_stock_counts
  SET
    initial_quantity = initial_quantity - 1,
    remaining = remaining - CASE WHEN OLD.claimed = 0 THEN 1 ELSE 0 END
  WHERE prize_code = OLD.prize_code;
END;

-- 운영자가 지급을 끈 직후의 경품이나, 다른 요청이 먼저 가져간 슬롯은
-- 같은 INSERT 문 안에서 거절한다. 호출자는 최신 후보를 읽어 다시 추첨한다.
CREATE TRIGGER prize_wins_require_enabled_prize
BEFORE INSERT ON prize_wins
WHEN COALESCE(
  (SELECT enabled FROM prize_inventory WHERE code = NEW.prize_code),
  0
) <> 1
BEGIN
  SELECT RAISE(ABORT, 'PRIZE_DISABLED');
END;

CREATE TRIGGER prize_wins_require_available_slot
BEFORE INSERT ON prize_wins
WHEN NEW.stock_slot IS NOT NULL
  AND (
    COALESCE(
      (
        SELECT claimed
        FROM prize_stock_units
        WHERE prize_code = NEW.prize_code
          AND stock_slot = NEW.stock_slot
      ),
      1
    ) <> 0
    OR COALESCE(
      (
        SELECT remaining
        FROM prize_stock_counts
        WHERE prize_code = NEW.prize_code
      ),
      0
    ) <= 0
  )
BEGIN
  SELECT RAISE(ABORT, 'PRIZE_STOCK_UNAVAILABLE');
END;

CREATE TRIGGER prize_wins_apply_insert
AFTER INSERT ON prize_wins
BEGIN
  UPDATE prize_stock_units
  SET claimed = 1
  WHERE NEW.stock_slot IS NOT NULL
    AND prize_code = NEW.prize_code
    AND stock_slot = NEW.stock_slot;

  UPDATE prize_stock_counts
  SET remaining = remaining - 1
  WHERE NEW.stock_slot IS NOT NULL
    AND prize_code = NEW.prize_code;

  UPDATE booth_stats
  SET total_wins = total_wins + 1
  WHERE id = 1;
END;

-- 운영 중에는 당첨 기록을 지우지 않지만, 수동 복구 시에도 집계가 어긋나지 않게 한다.
CREATE TRIGGER prize_wins_apply_delete
AFTER DELETE ON prize_wins
BEGIN
  UPDATE prize_stock_units
  SET claimed = 0
  WHERE OLD.stock_slot IS NOT NULL
    AND prize_code = OLD.prize_code
    AND stock_slot = OLD.stock_slot;

  UPDATE prize_stock_counts
  SET remaining = remaining + 1
  WHERE OLD.stock_slot IS NOT NULL
    AND prize_code = OLD.prize_code;

  UPDATE booth_stats
  SET total_wins = total_wins - 1
  WHERE id = 1;
END;

CREATE TRIGGER prize_wins_keep_stock_identity
BEFORE UPDATE OF prize_code, stock_slot ON prize_wins
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_PRIZE_WIN_STOCK');
END;

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
    ELSE counts.initial_quantity
  END AS initial_quantity,
  CASE
    WHEN inventory.unlimited = 1 THEN NULL
    ELSE counts.remaining
  END AS remaining
FROM prize_inventory AS inventory
LEFT JOIN prize_stock_counts AS counts
  ON counts.prize_code = inventory.code;

PRAGMA foreign_key_check;
PRAGMA defer_foreign_keys = off;
