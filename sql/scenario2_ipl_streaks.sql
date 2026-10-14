-- Scenario 2: players with 30+ runs in at least 3 consecutive matches (IPL 2024).
-- Returns the player and the date the streak commenced (plus its end and length for readability).
--
-- Technique: "gaps and islands" with two ROW_NUMBER()s.
--   rn_all  numbers a player's 2024 appearances in date order
--   rn_30   numbers only the 30+ appearances
--   rn_all - rn_30 is constant inside an unbroken run of 30+ scores, and jumps whenever a sub-30 score
--   (or a did-not-bat NULL) interrupts it - so (player, grp) identifies one streak.
--
-- Assumption: "consecutive" means consecutive appearances of that player in the season (a NULL = did not bat counts
-- as an appearance that is not 30+, so it breaks the streak).
WITH appearances AS (
    SELECT
        b.player_name,
        m.match_id,
        m.match_date,
        b.runs,
        ROW_NUMBER() OVER (PARTITION BY b.player_name ORDER BY m.match_date, m.match_id) AS rn_all
    FROM batting_scores b
    JOIN ipl_matches m ON m.match_id = b.match_id
    WHERE m.season = 2024
),
thirties AS (
    SELECT
        *,
        rn_all - ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY match_date, match_id) AS grp
    FROM appearances
    WHERE runs >= 30                       -- NULL >= 30 is not true, so did-not-bat rows drop out here
)
SELECT
    player_name,
    MIN(match_date) AS streak_start_date,
    MAX(match_date) AS streak_end_date,
    COUNT(*)        AS matches_in_streak
FROM thirties
GROUP BY player_name, grp
HAVING COUNT(*) >= 3
ORDER BY streak_start_date, player_name;
