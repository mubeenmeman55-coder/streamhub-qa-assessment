-- ILLUSTRATIVE data (player names are real IPL players, the scores are made up to exercise edge cases).

-- ---------- Scenario 1 ----------
INSERT INTO transactions (txn_id, from_account, to_account, amount, txn_time) VALUES
 (1,  'ACC-A', 'ACC-B', 1000, '2024-03-01 10:00:00'),   -- pair with 2: 5% lower, 8h   -> MATCH
 (2,  'ACC-B', 'ACC-A',  950, '2024-03-01 18:00:00'),
 (3,  'ACC-A', 'ACC-B',  500, '2024-03-02 09:00:00'),   -- pair with 4: 12% higher     -> no (amount)
 (4,  'ACC-B', 'ACC-A',  560, '2024-03-02 12:00:00'),
 (5,  'ACC-C', 'ACC-D', 2000, '2024-03-03 08:00:00'),   -- pair with 6: 5%, 23h59m     -> MATCH
 (6,  'ACC-D', 'ACC-C', 2100, '2024-03-04 07:59:00'),
 (7,  'ACC-E', 'ACC-F',  800, '2024-03-05 10:00:00'),   -- pair with 8: same amount, 24h01m -> no (time)
 (8,  'ACC-F', 'ACC-E',  800, '2024-03-06 10:01:00'),
 (9,  'ACC-G', 'ACC-H', 1000, '2024-03-07 12:00:00'),   -- pair with 10: exactly +10% -> MATCH (inclusive)
 (10, 'ACC-H', 'ACC-G', 1100, '2024-03-07 20:00:00'),
 (11, 'ACC-A', 'ACC-B',  300, '2024-03-08 09:00:00'),   -- same direction twice        -> no
 (12, 'ACC-A', 'ACC-B',  300, '2024-03-08 09:30:00'),
 (13, 'ACC-J', 'ACC-I',  380, '2024-03-09 09:00:00'),   -- pair with 14: reply is first in time -> MATCH (J->I then I->J)
 (14, 'ACC-I', 'ACC-J',  400, '2024-03-09 10:00:00'),
 (15, 'ACC-K', 'ACC-L', 1000, '2024-03-10 09:00:00'),   -- one outgoing, two replies   -> 2 MATCHES (16, 17)
 (16, 'ACC-L', 'ACC-K', 1000, '2024-03-10 10:00:00'),
 (17, 'ACC-L', 'ACC-K', 1050, '2024-03-10 11:00:00'),
 (18, 'ACC-M', 'ACC-N', 5000, '2024-03-11 09:00:00'),   -- reply to a different account -> no
 (19, 'ACC-N', 'ACC-O', 5000, '2024-03-11 10:00:00');

-- ---------- Scenario 2 ----------
INSERT INTO ipl_matches (match_id, season, match_date) VALUES
 (1, 2024, '2024-03-22'), (2, 2024, '2024-03-23'), (3, 2024, '2024-03-25'), (4, 2024, '2024-03-27'),
 (5, 2024, '2024-03-29'), (6, 2024, '2024-03-31'), (7, 2024, '2024-04-02'), (8, 2024, '2024-04-05'),
 (13, 2023, '2023-04-01'), (14, 2023, '2023-04-04'), (15, 2023, '2023-04-08');

INSERT INTO batting_scores (match_id, player_name, team, runs) VALUES
 -- Kohli: 45,52,38 (starts 03-23) then a 9 breaks it, then 31,40,55 (starts 03-31)  -> two streaks
 (1, 'Virat Kohli', 'RCB', 12), (2, 'Virat Kohli', 'RCB', 45), (3, 'Virat Kohli', 'RCB', 52), (4, 'Virat Kohli', 'RCB', 38),
 (5, 'Virat Kohli', 'RCB', 9),  (6, 'Virat Kohli', 'RCB', 31), (7, 'Virat Kohli', 'RCB', 40), (8, 'Virat Kohli', 'RCB', 55),
 -- Sharma: 30,31 | 29 | 50,60  -> longest run is 2, boundary value 30 counts, 29 does not
 (1, 'Rohit Sharma', 'MI', 30), (2, 'Rohit Sharma', 'MI', 31), (3, 'Rohit Sharma', 'MI', 29),
 (4, 'Rohit Sharma', 'MI', 50), (5, 'Rohit Sharma', 'MI', 60),
 -- Samson: four in a row starting 03-25
 (3, 'Sanju Samson', 'RR', 35), (4, 'Sanju Samson', 'RR', 42), (5, 'Sanju Samson', 'RR', 67),
 (6, 'Sanju Samson', 'RR', 71), (7, 'Sanju Samson', 'RR', 12),
 -- Head: 40, did-not-bat (NULL breaks the run), then 35,60,33 -> streak starts 03-29, not 03-23
 (2, 'Travis Head', 'SRH', 40), (4, 'Travis Head', 'SRH', NULL), (5, 'Travis Head', 'SRH', 35),
 (6, 'Travis Head', 'SRH', 60), (7, 'Travis Head', 'SRH', 33),
 -- Dube: five in a row starting 03-22 (reports one row, with length 5)
 (1, 'Shivam Dube', 'CSK', 33), (2, 'Shivam Dube', 'CSK', 34), (3, 'Shivam Dube', 'CSK', 35),
 (4, 'Shivam Dube', 'CSK', 36), (5, 'Shivam Dube', 'CSK', 37), (6, 'Shivam Dube', 'CSK', 10),
 -- Gaikwad: always just under 30 -> never qualifies
 (1, 'Ruturaj Gaikwad', 'CSK', 5), (2, 'Ruturaj Gaikwad', 'CSK', 12), (3, 'Ruturaj Gaikwad', 'CSK', 28),
 (4, 'Ruturaj Gaikwad', 'CSK', 29), (5, 'Ruturaj Gaikwad', 'CSK', 29),
 -- Gill: a 3-match streak, but in the 2023 season only -> excluded by the season filter
 (13, 'Shubman Gill', 'GT', 60), (14, 'Shubman Gill', 'GT', 45), (15, 'Shubman Gill', 'GT', 39),
 (1, 'Shubman Gill', 'GT', 10);
