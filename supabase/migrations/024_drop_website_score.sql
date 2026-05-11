-- Remove website health score (0-100) from website_profiles
-- The score column and impact_score on tasks are no longer used.

alter table website_profiles
  drop column if exists score;

alter table website_tasks
  drop column if exists impact_score;
