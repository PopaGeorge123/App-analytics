-- Query to analyze search term performance and optimize future searches

-- Overall performance summary
SELECT 
  category,
  COUNT(*) as total_terms,
  AVG(efficiency_score) as avg_efficiency,
  AVG(email_efficiency_score) as avg_email_efficiency,
  SUM(unique_prospects_found) as total_prospects_found,
  SUM(emails_found) as total_emails_found,
  MAX(generation_batch) as max_batch
FROM outbound_search_terms
GROUP BY category
ORDER BY avg_efficiency DESC;

-- Top performing search terms (to learn from)
SELECT 
  category,
  search_term,
  generation_batch,
  times_searched,
  unique_prospects_found,
  efficiency_score,
  email_efficiency_score,
  (efficiency_score * 0.6 + email_efficiency_score * 0.4) as composite_score
FROM outbound_search_terms
WHERE times_searched > 0
ORDER BY composite_score DESC
LIMIT 20;

-- Worst performing terms (to avoid patterns)
SELECT 
  category,
  search_term,
  times_searched,
  total_results,
  unique_prospects_found,
  duplicate_count,
  efficiency_score
FROM outbound_search_terms
WHERE times_searched > 0 AND efficiency_score < 10
ORDER BY efficiency_score ASC
LIMIT 20;

-- Performance by batch (shows if AI is learning)
SELECT 
  category,
  generation_batch,
  COUNT(*) as terms_in_batch,
  AVG(efficiency_score) as avg_efficiency,
  AVG(email_efficiency_score) as avg_email_efficiency,
  SUM(unique_prospects_found) as prospects_found
FROM outbound_search_terms
GROUP BY category, generation_batch
ORDER BY category, generation_batch;

-- Search terms that need more testing (searched once or never)
SELECT 
  category,
  search_term,
  generation_batch,
  times_searched,
  ai_reasoning
FROM outbound_search_terms
WHERE times_searched <= 1
ORDER BY generation_batch DESC, category;

-- Prospects found by each search term
SELECT 
  st.category,
  st.search_term,
  st.efficiency_score,
  COUNT(ps.id) as prospects_linked,
  COUNT(CASE WHEN p.contact_email IS NOT NULL THEN 1 END) as with_email,
  COUNT(CASE WHEN p.status = 'email_sent' THEN 1 END) as emails_sent,
  COUNT(CASE WHEN p.status = 'opened' THEN 1 END) as emails_opened
FROM outbound_search_terms st
LEFT JOIN outbound_prospect_sources ps ON ps.search_term_id = st.id
LEFT JOIN outbound_prospects p ON p.id = ps.prospect_id
GROUP BY st.id, st.category, st.search_term, st.efficiency_score
HAVING COUNT(ps.id) > 0
ORDER BY prospects_linked DESC;
