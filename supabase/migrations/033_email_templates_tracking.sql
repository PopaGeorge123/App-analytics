-- Email templates tracking table
CREATE TABLE IF NOT EXISTS outbound_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  template_number INT NOT NULL,
  subject_line TEXT NOT NULL,
  body_template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Performance metrics
  times_sent INT DEFAULT 0,
  times_opened INT DEFAULT 0,
  times_clicked INT DEFAULT 0,
  times_replied INT DEFAULT 0,
  
  -- Calculated rates
  open_rate DECIMAL(5,2) DEFAULT 0.00,
  click_rate DECIMAL(5,2) DEFAULT 0.00,
  reply_rate DECIMAL(5,2) DEFAULT 0.00,
  conversion_rate DECIMAL(5,2) DEFAULT 0.00,
  
  -- A/B testing
  is_active BOOLEAN DEFAULT true,
  performance_score DECIMAL(5,2) DEFAULT 0.00,
  
  last_used_at TIMESTAMPTZ
);

-- Add template tracking to prospects
ALTER TABLE outbound_prospects 
ADD COLUMN IF NOT EXISTS email_template_id UUID REFERENCES outbound_email_templates(id),
ADD COLUMN IF NOT EXISTS email_opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_clicked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_replied_at TIMESTAMPTZ;

-- Function to update template stats when email is opened
CREATE OR REPLACE FUNCTION update_template_open_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_opened_at IS NOT NULL AND OLD.email_opened_at IS NULL THEN
    UPDATE outbound_email_templates
    SET 
      times_opened = times_opened + 1,
      open_rate = CASE 
        WHEN times_sent > 0 THEN ((times_opened + 1)::DECIMAL / times_sent * 100)
        ELSE 0 
      END,
      performance_score = (
        (CASE WHEN times_sent > 0 THEN ((times_opened + 1)::DECIMAL / times_sent * 100) ELSE 0 END * 0.3) +
        (CASE WHEN times_sent > 0 THEN (times_clicked::DECIMAL / times_sent * 100) ELSE 0 END * 0.4) +
        (CASE WHEN times_sent > 0 THEN (times_replied::DECIMAL / times_sent * 100) ELSE 0 END * 0.3)
      )
    WHERE id = NEW.email_template_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update template stats when link is clicked
CREATE OR REPLACE FUNCTION update_template_click_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_clicked_at IS NOT NULL AND OLD.email_clicked_at IS NULL THEN
    UPDATE outbound_email_templates
    SET 
      times_clicked = times_clicked + 1,
      click_rate = CASE 
        WHEN times_sent > 0 THEN ((times_clicked + 1)::DECIMAL / times_sent * 100)
        ELSE 0 
      END,
      conversion_rate = CASE
        WHEN times_opened > 0 THEN ((times_clicked + 1)::DECIMAL / times_opened * 100)
        ELSE 0
      END,
      performance_score = (
        (CASE WHEN times_sent > 0 THEN (times_opened::DECIMAL / times_sent * 100) ELSE 0 END * 0.3) +
        (CASE WHEN times_sent > 0 THEN ((times_clicked + 1)::DECIMAL / times_sent * 100) ELSE 0 END * 0.4) +
        (CASE WHEN times_sent > 0 THEN (times_replied::DECIMAL / times_sent * 100) ELSE 0 END * 0.3)
      )
    WHERE id = NEW.email_template_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS on_email_opened ON outbound_prospects;
CREATE TRIGGER on_email_opened
  AFTER UPDATE ON outbound_prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_template_open_stats();

DROP TRIGGER IF EXISTS on_email_clicked ON outbound_prospects;
CREATE TRIGGER on_email_clicked
  AFTER UPDATE ON outbound_prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_template_click_stats();

-- View for email campaign analytics
CREATE OR REPLACE VIEW outbound_email_campaign_stats AS
SELECT
  t.id,
  t.template_name,
  t.template_number,
  t.subject_line,
  t.times_sent,
  t.times_opened,
  t.times_clicked,
  t.times_replied,
  t.open_rate,
  t.click_rate,
  t.reply_rate,
  t.conversion_rate,
  t.performance_score,
  t.is_active,
  t.last_used_at,
  COUNT(p.id) FILTER (WHERE p.email_sent_at IS NOT NULL) as total_sent,
  COUNT(p.id) FILTER (WHERE p.email_opened_at IS NOT NULL) as total_opened,
  COUNT(p.id) FILTER (WHERE p.email_clicked_at IS NOT NULL) as total_clicked,
  COUNT(p.id) FILTER (WHERE p.email_replied_at IS NOT NULL) as total_replied
FROM outbound_email_templates t
LEFT JOIN outbound_prospects p ON p.email_template_id = t.id
GROUP BY t.id, t.template_name, t.template_number, t.subject_line, 
         t.times_sent, t.times_opened, t.times_clicked, t.times_replied,
         t.open_rate, t.click_rate, t.reply_rate, t.conversion_rate,
         t.performance_score, t.is_active, t.last_used_at
ORDER BY t.performance_score DESC;

-- Insert 10 email templates
INSERT INTO outbound_email_templates (template_name, template_number, subject_line, body_template) VALUES
(
  'Direct Question',
  1,
  'Quick question about {business_name}',
  'Hey {first_name},

I came across {business_name} and wanted to reach out.

Quick question: how are you currently tracking your business metrics?

Most founders I talk to are either juggling 5+ dashboards or stuck in spreadsheets. We built Fold to fix that - one dashboard, all your data, $19/mo.

Worth a look: {tracking_link}

Best,
George
Fold Analytics'
),
(
  'Problem Agitate',
  2,
  'Are you tired of switching between dashboards?',
  'Hi {first_name},

Noticed {business_name} - looks solid.

Real talk: Are you still logging into Stripe, GA4, and Meta separately to see your numbers?

That was driving me crazy too. That''s why I built Fold.

Connect everything in 90 seconds. See it all in one place. $19/mo.

Demo: {tracking_link}

- George'
),
(
  'Founder to Founder',
  3,
  '{first_name}, fellow founder here',
  'Hey {first_name},

Fellow founder here. Saw {business_name} and thought I''d reach out.

I built Fold because I was frustrated with expensive, bloated analytics tools. 

Simple idea: Connect Stripe + GA4 + Meta. Get one clean dashboard. $19/mo instead of $500+/mo.

Take a look: {tracking_link}

Would love your feedback.

George
usefold.io'
),
(
  'Social Proof',
  4,
  '100+ founders switched to this',
  '{first_name},

100+ small business owners just switched from their old analytics setup to Fold.

Why? Because they were tired of:
- Paying $200+/mo for tools built for enterprises
- Switching between 5 different dashboards
- Missing important trends in their data

Fold: One dashboard. All your metrics. $19/mo.

See demo: {tracking_link}

George'
),
(
  'Time Saver',
  5,
  'Save 10 hours/month on analytics',
  'Hi {first_name},

{business_name} caught my attention.

Quick stat: Our users save 10+ hours per month by having all their analytics in one place instead of jumping between Stripe, GA4, Meta, etc.

10 hours = $500+ in your time.
Fold = $19/mo.

Check it out: {tracking_link}

George
Fold Analytics'
),
(
  'Curiosity Hook',
  6,
  'This might interest you',
  '{first_name},

Running {business_name}, you probably track revenue, traffic, conversions etc.

Question: How long does it take you to get all those numbers each morning?

With Fold, it''s one click. Everything connected. AI highlights what matters.

See how it works: {tracking_link}

Best,
George'
),
(
  'Pain Point Direct',
  7,
  'Still using spreadsheets for analytics?',
  'Hey {first_name},

Saw {business_name} and had to ask: are you still using spreadsheets to track your metrics?

No judgment - I did that for 2 years. Then I built Fold.

All your data sources → One dashboard → AI insights
$19/mo, setup in 90 seconds.

Demo: {tracking_link}

George'
),
(
  'ROI Focus',
  8,
  'Cut your analytics costs by 90%',
  '{first_name},

If you''re using Mixpanel, Amplitude, or similar tools, you''re probably paying $200-500/mo.

Fold does the same thing for $19/mo.

Same insights. Better interface. Built for small businesses, not enterprises.

See the difference: {tracking_link}

George
Fold Analytics'
),
(
  'Feature Highlight',
  9,
  'One dashboard for everything',
  'Hi {first_name},

{business_name} looks great.

Quick pitch: Fold connects all your tools (Stripe, GA4, Meta Ads, etc.) and shows everything in one beautiful dashboard.

No more tab switching. No more spreadsheets. Just insights.

$19/mo. 90-second setup.

Try it: {tracking_link}

Best,
George'
),
(
  'No Pressure',
  10,
  'Built something that might help',
  '{first_name},

I built an analytics dashboard for small businesses and thought it might be useful for {business_name}.

No sales pitch. Just wanted to share:

{tracking_link}

It''s $19/mo, connects all your tools in one place, and has AI insights.

Happy to answer questions if you have any.

George'
)
ON CONFLICT (template_name) DO NOTHING;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_prospects_template_id ON outbound_prospects(email_template_id);
CREATE INDEX IF NOT EXISTS idx_prospects_email_opened ON outbound_prospects(email_opened_at) WHERE email_opened_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_email_clicked ON outbound_prospects(email_clicked_at) WHERE email_clicked_at IS NOT NULL;
