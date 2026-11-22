-- KUponum demo eşleştirme kataloğu (Faz 3). Idempotent.
-- source='demo-catalog' — gerçek platform beslemesi Faz 5 adapter'ı ile gelir.

insert into teams (canonical_name, normalized_name, aliases, league) values
  ('Fenerbahçe', 'fenerbahce', '["Fenerbahce","Fenerbahçe SK","Fener"]', 'Süper Lig'),
  ('Galatasaray', 'galatasaray', '["Galatasaray SK","Gala","GS"]', 'Süper Lig'),
  ('Beşiktaş', 'besiktas', '["Besiktas","Besiktas JK","BJK"]', 'Süper Lig'),
  ('Trabzonspor', 'trabzonspor', '["Trabzon","TS"]', 'Süper Lig'),
  ('Barcelona', 'barcelona', '["FC Barcelona","Barca","Barça"]', 'La Liga'),
  ('Real Madrid', 'real madrid', '["Real Madrid CF","R Madrid","Real"]', 'La Liga'),
  ('Liverpool', 'liverpool', '["Liverpool FC","LFC"]', 'Premier League'),
  ('Arsenal', 'arsenal', '["Arsenal FC","ARS"]', 'Premier League'),
  ('Manchester United', 'manchester united', '["Man Utd","Manchester Utd","Manchester United FC","Man United"]', 'Premier League'),
  ('Manchester City', 'manchester city', '["Man City","Manchester City FC"]', 'Premier League'),
  ('Ajax', 'ajax', '["AFC Ajax","Ajax Amsterdam"]', 'Eredivisie'),
  ('PSV', 'psv', '["PSV Eindhoven"]', 'Eredivisie'),
  ('Celtic', 'celtic', '["Celtic FC","Celtic Glasgow"]', 'Scottish Premiership'),
  ('Rangers', 'rangers', '["Rangers FC","Glasgow Rangers"]', 'Scottish Premiership')
on conflict (canonical_name) do nothing;

insert into event_catalog (external_id, home_team, away_team, league, event_date, start_time, markets, source) values
  ('EVT-DEMO-001', 'Fenerbahçe', 'Galatasaray', 'Süper Lig', current_date, '20:00',
   '{"MATCH_WINNER":{"HOME":"1.78","DRAW":"3.60","AWAY":"4.20"},"BOTH_TEAMS_TO_SCORE":{"YES":"1.65","NO":"2.10"}}', 'demo-catalog'),
  ('EVT-DEMO-002', 'Barcelona', 'Real Madrid', 'La Liga', current_date, '22:00',
   '{"MATCH_WINNER":{"HOME":"2.45","DRAW":"3.40","AWAY":"2.70"},"BOTH_TEAMS_TO_SCORE":{"YES":"1.55","NO":"2.30"}}', 'demo-catalog'),
  ('EVT-DEMO-003', 'Liverpool', 'Arsenal', 'Premier League', current_date, '21:45',
   '{"MATCH_WINNER":{"HOME":"2.10","DRAW":"3.50","AWAY":"3.20"},"BOTH_TEAMS_TO_SCORE":{"YES":"1.72","NO":"2.00"}}', 'demo-catalog'),
  ('EVT-DEMO-004', 'Ajax', 'PSV', 'Eredivisie', current_date, '19:00',
   '{"MATCH_WINNER":{"HOME":"2.10","DRAW":"3.60","AWAY":"3.10"}}', 'demo-catalog'),
  ('EVT-DEMO-005', 'Celtic', 'Rangers', 'Scottish Premiership', current_date, '18:30',
   '{"MATCH_WINNER":{"HOME":"2.30","DRAW":"3.40","AWAY":"4.01"}}', 'demo-catalog'),
  ('EVT-DEMO-006', 'Trabzonspor', 'Beşiktaş', 'Süper Lig', current_date, '20:30',
   '{"MATCH_WINNER":{"HOME":"1.80","DRAW":"3.50","AWAY":"4.10"},"BOTH_TEAMS_TO_SCORE":{"YES":"1.70","NO":"2.05"}}', 'demo-catalog')
on conflict (external_id) do nothing;
