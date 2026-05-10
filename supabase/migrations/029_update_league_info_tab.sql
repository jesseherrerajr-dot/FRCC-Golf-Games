-- Migration 029: Update Thursday League "Conditions of Play" tab
-- Renames tab label to "League Info" and updates content

UPDATE event_league_tabs
SET
  label = 'League Info',
  content = '
<h2>Details</h2>
<ul>
  <li><strong>Duration:</strong> 10 weeks (May 7 – July 9, 2026)</li>
  <li><strong>Day:</strong> Every Thursday</li>
  <li><strong>Tee Times:</strong> Starting at 3:30 PM with simultaneous tee-offs on two different nines so everyone finishes around the same time</li>
  <li><strong>Format:</strong> 9 holes, Modified Stableford (Net Scoring)</li>
  <li><strong>Post-Round:</strong> Food and drinks on the patio are highly encouraged</li>
</ul>

<h2>Eligibility &amp; Qualification</h2>
<ul>
  <li>You must play at least <strong>6 of the 10 weeks</strong> to qualify for season-long prizes</li>
  <li>Your <strong>top 6 weekly scores</strong> will be used to determine the winners</li>
  <li>Top 9 season finishers are paid from the season-long pot</li>
  <li>If you commit to playing and no-call/no-show it really messes up the entire game for everyone and delays the results. Life happens but just please take a minute to call or text Mike Leiby if you cannot make it. If you commit but no-show we will count your score as a <strong>ZERO</strong> for one of your 6 qualifying weeks.</li>
</ul>

<h2>Weekly Games</h2>
<p>In addition to the season-long competition, there is a $400 weekly game pot each week. Weekly games include:</p>
<ul>
  <li>Closest to the Pin</li>
  <li>Low Net</li>
  <li>Low Gross</li>
</ul>
<p>Weekly game results are managed separately and are not tracked in the season standings.</p>
',
  updated_at = now()
WHERE tab_key = 'rules';
