-- 024_onboarding_profile.sql
-- Adds business profile fields collected during onboarding steps 1 & 2

alter table public.users
  add column if not exists website_url            text,
  add column if not exists business_description   text,
  add column if not exists business_industry      text,
  add column if not exists employee_count         text,
  add column if not exists monthly_revenue        text,
  add column if not exists referral_source        text,
  add column if not exists onboarding_step        smallint not null default 1;

comment on column public.users.website_url          is 'Business website URL entered during onboarding step 1';
comment on column public.users.business_description is 'AI-extracted (and user-edited) business description from website';
comment on column public.users.business_industry    is 'Industry selected in onboarding step 2';
comment on column public.users.employee_count       is 'Employee count range selected in onboarding step 2';
comment on column public.users.monthly_revenue      is 'Monthly revenue range selected in onboarding step 2';
comment on column public.users.referral_source      is 'How user heard about Fold (onboarding step 2)';
comment on column public.users.onboarding_step      is 'Last completed onboarding step (1=website, 2=profile, 3=integrations)';
