# Email Campaign Tracking System

## 📧 Plain Text Email Templates

Sistemul folosește **10 template-uri plain text** (fără HTML, fără emoji) pentru a maximiza deliverability-ul și a părea mai autentic.

### Template-uri disponibile:

1. **Direct Question** - "Quick question about {business_name}"
2. **Problem Agitate** - "Are you tired of switching between dashboards?"
3. **Founder to Founder** - "{first_name}, fellow founder here"
4. **Social Proof** - "100+ founders switched to this"
5. **Time Saver** - "Save 10 hours/month on analytics"
6. **Curiosity Hook** - "This might interest you"
7. **Pain Point Direct** - "Still using spreadsheets for analytics?"
8. **ROI Focus** - "Cut your analytics costs by 90%"
9. **Feature Highlight** - "One dashboard for everything"
10. **No Pressure** - "Built something that might help"

## 🎯 Auto-Optimization System

### Cum funcționează:

1. **Primele 20 de email-uri**: Template-urile sunt distribuite uniform (round-robin) pentru a colecta date
2. **După 20 de email-uri**: Sistemul folosește weighted selection:
   - Top 3 template-uri primesc **70%** din trafic
   - Restul primesc **30%** (exploration)
   - Template-urile sunt alese probabilistic bazat pe `performance_score`

### Performance Score Calculation:

```
performance_score = (open_rate × 30%) + (click_rate × 40%) + (reply_rate × 30%)
```

### Trigger-uri automate:

- Când un email este **deschis** → actualizează `open_rate` și `performance_score`
- Când un link este **accesat** → actualizează `click_rate`, `conversion_rate`, `performance_score`
- Când primești **reply** → actualizează `reply_rate` și `performance_score`

## 📊 Tracking Metrics

### Overall Campaign:
- **Total Sent**: Total email-uri trimise
- **Open Rate**: % din email-uri deschise (**NOTE**: nu poate fi tracked în plain text, se bazează pe click-uri)
- **Click Rate**: % din email-uri cu click pe link
- **Click-to-Open Rate**: % din deschideri care au dat click
- **Reply Rate**: % din email-uri cu răspuns

### Per Template:
- **Times Sent**: De câte ori a fost folosit template-ul
- **Times Opened**: De câte ori a fost deschis (**NOTE**: tracked doar dacă user-ul dă click)
- **Times Clicked**: De câte ori s-a dat click pe link
- **Times Replied**: De câte ori am primit reply
- **Performance Score**: Scor calculat automat (0-100)

## 🚀 Setup Instructions

### Step 1: Run Database Migration

Trebuie să rulezi migrația SQL pentru a crea tabelele necesare. Alege una dintre opțiuni:

#### OPTION 1: Supabase Dashboard (Cel mai simplu) ✅

1. Mergi la: `https://supabase.com/dashboard/project/YOUR_PROJECT/sql`
2. Click pe **"New Query"**
3. Copiază tot conținutul din: `supabase/migrations/033_email_templates_tracking.sql`
4. Lipește în SQL Editor și apasă **"Run"**

#### OPTION 2: Supabase CLI (Pentru automation)

```bash
# Instalează Supabase CLI
brew install supabase/tap/supabase  # macOS
# sau
scoop install supabase              # Windows

# Link project-ul tău
supabase link --project-ref YOUR_PROJECT_REF

# Push migrațiile
supabase db push
```

#### OPTION 3: PostgreSQL Direct

```bash
# Ia database URL din Supabase Dashboard
psql YOUR_DATABASE_URL -f supabase/migrations/033_email_templates_tracking.sql
```

### Step 2: Insert Email Templates

După ce ai rulat migrația, inserează cele 10 template-uri:

```bash
node scripts/run-email-migration.mjs
```

Output așteptat:
```
🚀 Initializing email templates...

✅ #1: Direct Question
✅ #2: Problem Agitate
✅ #3: Founder to Founder
...
✅ #10: No Pressure

✅ Done! Inserted: 10 | Skipped: 0
```

### Step 3: Verificare

Verifică că totul e setat corect:

1. **Database**: Verifică în Supabase Dashboard → Table Editor:
   - `outbound_email_templates` ar trebui să aibă 10 rânduri
   
2. **Admin Dashboard**: Accesează `/admin` → tab **Email Campaign**:
   - Ar trebui să vezi toate cele 10 template-uri
   - Toate cu `0` emails sent (până nu rulezi campania)

## 🚀 Rulare Script

### Setup:

```bash
# 1. Rulează migrația (o singură dată)
node scripts/run-email-migration.mjs

# 2. Rulează campania (fără trimitere reală)
node scripts/outbound-prospecting-ai.mjs "SaaS" --prospects=20

# 3. Rulează cu trimitere reală de email-uri
node scripts/outbound-prospecting-ai.mjs "SaaS" --prospects=50 --send-emails
```

### Parametri:

- **Category**: `SaaS`, `E-commerce`, `Agency`, `Media & Content`, etc.
- **--prospects=N**: Câte prospect-uri NOI să găsească
- **--send-emails**: Flag pentru a trimite email-uri (fără flag = dry run)

## 📈 Admin Dashboard

Accesează `/admin` → Tab **Email Campaign** pentru a vedea:

### Overview Cards:
- 📧 Emails Sent
- ✉️ Opened (%)
- 🖱️ Clicked (%)
- 💬 Replied (%)

### Conversion Funnel:
```
Emails Sent (100%)
  ↓
Opened (X%)
  ↓
Clicked from Opens (Y%)
  ↓
Replied (Z%)
```

### AI Insights:
- 🟢 **Best Performer**: Template cu cel mai mare performance score
- 🔴 **Needs Improvement**: Template cu cel mai mic score
- 💡 **Recommendation**: Sugestii automate bazate pe date

### Template Performance Table:
Tabel sortable cu toate template-urile și metrici detaliate.

## 🔧 API Endpoints

### Admin API:
```
GET /api/admin/email-campaign-stats
```
Returnează toate statisticile campaniei (necesită autentificare admin).

### Tracking API:
```
GET /api/track/open/[prospectId]
GET /api/track/click/[prospectId]
```
Tracking automat pentru opens și clicks.

## ⚙️ Configuration

### Environment Variables (.env):

```bash
RESEND_API_KEY=re_xxx           # Pentru trimitere email-uri
ANTHROPIC_API_KEY=sk-ant-xxx    # Pentru AI search terms
SERPER_API_KEY=xxx              # Pentru Google search
NEXT_PUBLIC_SUPABASE_URL=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

## 📝 Database Tables

### `outbound_email_templates`:
Stochează cele 10 template-uri + metrici de performanță.

### `outbound_prospects`:
Prospects cu tracking columns:
- `email_template_id` → Care template a fost folosit
- `email_sent_at` → Când a fost trimis
- `email_opened_at` → Când a fost deschis (doar dacă a dat click)
- `email_clicked_at` → Când a dat click pe link
- `email_replied_at` → Când a răspuns

### `outbound_email_campaign_stats` (VIEW):
View agregat cu toate statisticile per template.

## 🎨 UI Components

### Dark Theme Email Campaign Tab:
- Background: `#0a0a0f` (dark)
- Cards: Gradient purple/cyan/green/blue
- Charts: Purple → Cyan gradient
- Status badges: Green (active) / Gray (paused)

## 🧠 Self-Optimization Logic

Sistemul învață automat ce template-uri funcționează:

1. **Data Gathering Phase** (0-20 emails):
   - Distribuie uniform toate template-urile
   - Colectează date de bază

2. **Exploitation Phase** (20+ emails):
   - 70% trafic → Top 3 template-uri
   - 30% trafic → Restul (exploration)
   - Re-calculează scoruri la fiecare event

3. **Continuous Learning**:
   - Template-urile slabe primesc mai puțin trafic
   - Template-urile bune primesc mai mult trafic
   - Se adaptează automat în timp real

## 📧 Plain Text vs HTML

**De ce plain text?**
- ✅ Deliverability mai bună (nu e marcat ca spam)
- ✅ Pare mai autentic (ca un email personal)
- ✅ Nu e blocat de email clients
- ✅ Nu necesită imagini (care pot fi blocate)

**Trade-off:**
- ❌ Nu putem tracka opens prin tracking pixel
- ✅ Dar putem tracka clicks (care sunt mai importante)

## 🎯 Success Metrics

### Benchmark-uri industry:
- **Open Rate**: 20-30% (good)
- **Click Rate**: 2-5% (good)
- **Reply Rate**: 0.5-2% (excellent)

### Cum să optimizezi:
1. Monitorizează performance_score în dashboard
2. Pauzează template-urile cu score < 10 după 20+ trimiteri
3. Focusează pe top 3 template-uri
4. Testează variații ale template-urilor câștigătoare

## 🚨 Notes

- **Open tracking** în plain text nu este 100% acurat (se bazează pe clicks)
- **Click tracking** este precis
- **Reply tracking** trebuie marcat manual sau prin webhook Resend
- Template-urile se auto-optimizează, dar monitorizează în dashboard
