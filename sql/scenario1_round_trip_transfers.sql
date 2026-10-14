-- Scenario 1: A sends to B, then B sends a similar amount (within 10%) back to A, all inside 24 hours.
--
-- Rules chosen (documented assumptions):
--   * "within 10%" is measured against the FIRST transfer:  |reply - original| <= 10% of original (inclusive)
--   * "within 24 hours" is inclusive of exactly 24h; the reply must come strictly AFTER the original
--   * every (original, reply) pair is reported, so one original with two replies yields two rows
SELECT
    t1.txn_id                                         AS original_txn,
    t1.from_account                                   AS account_a,
    t1.to_account                                     AS account_b,
    t1.amount                                         AS amount_sent,
    t1.txn_time                                       AS sent_at,
    t2.txn_id                                         AS return_txn,
    t2.amount                                         AS amount_returned,
    t2.txn_time                                       AS returned_at,
    ROUND(ABS(t2.amount - t1.amount) * 100.0 / t1.amount, 2)            AS pct_difference,
    ROUND((strftime('%s', t2.txn_time) - strftime('%s', t1.txn_time)) / 3600.0, 2) AS hours_between
FROM transactions t1
JOIN transactions t2
  ON  t2.from_account = t1.to_account
  AND t2.to_account   = t1.from_account
  AND t2.txn_time     > t1.txn_time
  AND t2.txn_time    <= datetime(t1.txn_time, '+24 hours')
  AND ABS(t2.amount - t1.amount) * 10 <= t1.amount      -- integer-style maths avoids 0.1 float error at the 10% boundary
ORDER BY t1.txn_time, t2.txn_time;
