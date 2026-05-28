# AI-Powered Outbound Prospecting System

This is an intelligent prospecting system that uses AI to generate and optimize search terms, learning from performance data to find better prospects over time.

## How It Works

### 1. AI Search Term Generation
- GPT-4 generates 20 unique search queries based on your category and target profile
- Each term includes reasoning for why it will find qualified prospects
- AI learns from previous performance data to improve future generations

### 2. Performance Tracking
Every search term tracks:
- **Efficiency Score**: `(unique_prospects_found / total_results) * 100`
- **Email Efficiency**: `(emails_found / unique_prospects_found) * 100`
- **Composite Score**: `(efficiency * 0.6 + email_efficiency * 0.4)`

### 3. Continuous Learning
- Best performing terms inform future AI generations
- Worst performing patterns are avoided
- System gets smarter with each batch

### 4. Automatic Iteration
- If target not reached with 20 terms → AI generates 20 more
- Continues until target prospects found
- Never repeats same search term

## Database Schema

### `outbound_search_terms`
Stores all AI-generated search terms with performance metrics:
```sql
- search_term (text, unique per category)
- generation_batch (int, which AI batch generated it)
- times_searched (int)
- total_results (int)
- unique_prospects_found (int)
- duplicate_count (int)
- efficiency_score (0-100)
- emails_found (int)
- email_efficiency_score (0-100)
- ai_reasoning (text, why AI picked this term)
```

### `outbound_prospect_sources`
Links prospects to the search terms that found them:
```sql
- prospect_id (uuid)
- search_term_id (uuid)
- was_new_prospect (boolean)
```

## Usage

### Basic Command
```bash
node scripts/outbound-prospecting-ai.mjs "SaaS" --prospects=50
```

### With Email Sending
```bash
node scripts/outbound-prospecting-ai.mjs "SaaS" --prospects=50 --send-emails
```

### Parameters
- `category` - Required: SaaS, E-commerce, Agency, etc.
- `--prospects=N` - Target number of NEW prospects to find (default: 10)
- `--send-emails` - Actually send emails (without this, it's a dry run)

## Example Run

```
🚀 AI-Powered Outbound Prospecting for: SaaS
   Target: 50 NEW prospects

🤖 Generating 20 new search terms for SaaS...
   Batch: 1
   ✓ "micro saas lifetime deal pricing page"
   ✓ "solo founder bootstrap saas contact"
   ✓ "indie maker saas product small team"
   ... (17 more)

🔎 Searching: "micro saas lifetime deal pricing page"
   💡 Why: Lifetime deals indicate bootstrap/indie focus
   
  [1/50] lovable.dev
    📧 Email: founder@lovable.dev
  
  📈 Term performance: 3 new | 7 duplicates | 2 emails
  🎯 Efficiency: 30.0%

... continues until 50 prospects found ...

✅ PROSPECTING COMPLETE!
   Total prospects saved: 50
   Emails sent: 28
   AI batches generated: 3
```

## Performance Analysis

Run queries from `SEARCH_TERM_ANALYTICS.sql` to analyze:

### Top Performing Terms
```sql
SELECT search_term, efficiency_score, unique_prospects_found
FROM outbound_search_terms
ORDER BY efficiency_score DESC
LIMIT 10;
```

### AI Learning Progress
```sql
SELECT 
  generation_batch,
  AVG(efficiency_score) as avg_efficiency
FROM outbound_search_terms
GROUP BY generation_batch
ORDER BY generation_batch;
```

You should see efficiency improving over batches as AI learns!

## Environment Variables Required

```bash
OPENAI_API_KEY=sk-...           # For AI search term generation
SERPER_API_KEY=...              # For Google searches
SUPABASE_URL=...                # Database
SUPABASE_SERVICE_ROLE_KEY=...   # Service role access
RESEND_API_KEY=...              # Email sending (optional)
```

## Migration

Run the migration to create the new tables:
```bash
# Apply migration 031
psql $DATABASE_URL -f supabase/migrations/031_search_terms_tracking.sql
```

## Advantages Over Old System

### Old System (Static Queries)
❌ 5 hardcoded queries per category  
❌ High duplicate rate as queries exhausted  
❌ No learning or optimization  
❌ Manual query updates needed  

### New System (AI-Powered)
✅ Unlimited AI-generated queries  
✅ Learns from performance data  
✅ Avoids duplicate searches  
✅ Optimizes efficiency over time  
✅ 100% automated  

## Expected Performance

- **Initial batches**: 10-30% efficiency (lots of duplicates)
- **After 3-5 batches**: 30-50% efficiency (AI learns patterns)
- **Long term**: 50-70% efficiency (optimal search terms)

## Cost Estimates

Per 50 prospects:
- **Serper API**: ~30-60 searches = $0.30-$0.60
- **OpenAI API**: 2-3 batches * $0.02 = $0.04-$0.06
- **Total**: ~$0.35-$0.65

Much cheaper than manual research! 🎯

## Monitoring

Watch for:
1. **Efficiency scores trending up** = AI is learning ✅
2. **Email efficiency > 40%** = Good prospect quality ✅
3. **Duplicate rate decreasing** = Better search diversity ✅

## Next Steps

1. Run migration: `031_search_terms_tracking.sql`
2. Test with small batch: `--prospects=10`
3. Review performance in database
4. Scale up: `--prospects=100 --send-emails`
5. Monitor open/click rates
6. Let AI optimize automatically! 🚀
