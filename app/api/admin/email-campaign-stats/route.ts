import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

const ADMIN_USER_ID = 'bfd5f621-a8f0-4530-ae27-aabbe54491e0';

/**
 * Email Campaign Analytics API
 * GET /api/admin/email-campaign-stats
 * 
 * Returns comprehensive statistics about email outreach campaign:
 * - Template performance (opens, clicks, conversions)
 * - Overall campaign metrics
 * - Time-based trends
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || user.id !== ADMIN_USER_ID) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = createServiceClient();

    // Get overall campaign stats
    const { data: campaignStats } = await db
      .from('outbound_prospects')
      .select('id, email_sent_at, email_opened_at, email_clicked_at, email_replied_at, status')
      .not('email_sent_at', 'is', null);

    const totalSent = campaignStats?.length || 0;
    const totalOpened = campaignStats?.filter(p => p.email_opened_at).length || 0;
    const totalClicked = campaignStats?.filter(p => p.email_clicked_at).length || 0;
    const totalReplied = campaignStats?.filter(p => p.email_replied_at).length || 0;

    const openRate = totalSent > 0 ? (totalOpened / totalSent * 100).toFixed(2) : '0.00';
    const clickRate = totalSent > 0 ? (totalClicked / totalSent * 100).toFixed(2) : '0.00';
    const clickToOpenRate = totalOpened > 0 ? (totalClicked / totalOpened * 100).toFixed(2) : '0.00';
    const replyRate = totalSent > 0 ? (totalReplied / totalSent * 100).toFixed(2) : '0.00';

    // Get template performance stats
    const { data: templates } = await db
      .from('outbound_email_campaign_stats')
      .select('*')
      .order('performance_score', { ascending: false });

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentProspects } = await db
      .from('outbound_prospects')
      .select('email_sent_at, email_opened_at, email_clicked_at, created_at')
      .not('email_sent_at', 'is', null)
      .gte('email_sent_at', thirtyDaysAgo.toISOString())
      .order('email_sent_at', { ascending: true });

    // Group by day for chart data
    const dailyStats: Record<string, { sent: number; opened: number; clicked: number }> = {};
    
    recentProspects?.forEach(p => {
      const date = new Date(p.email_sent_at).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { sent: 0, opened: 0, clicked: 0 };
      }
      dailyStats[date].sent++;
      if (p.email_opened_at) dailyStats[date].opened++;
      if (p.email_clicked_at) dailyStats[date].clicked++;
    });

    const chartData = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      sent: stats.sent,
      opened: stats.opened,
      clicked: stats.clicked,
      openRate: stats.sent > 0 ? (stats.opened / stats.sent * 100).toFixed(1) : '0',
      clickRate: stats.sent > 0 ? (stats.clicked / stats.sent * 100).toFixed(1) : '0',
    }));

    // Calculate template rankings and insights
    const topTemplate = templates?.[0];
    const worstTemplate = templates?.[templates.length - 1];

    return NextResponse.json({
      campaign: {
        totalSent,
        totalOpened,
        totalClicked,
        totalReplied,
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate),
        clickToOpenRate: parseFloat(clickToOpenRate),
        replyRate: parseFloat(replyRate),
      },
      templates: templates?.map(t => ({
        id: t.id,
        name: t.template_name,
        number: t.template_number,
        subject: t.subject_line,
        sent: t.times_sent || 0,
        opened: t.times_opened || 0,
        clicked: t.times_clicked || 0,
        replied: t.times_replied || 0,
        openRate: parseFloat(t.open_rate || 0),
        clickRate: parseFloat(t.click_rate || 0),
        replyRate: parseFloat(t.reply_rate || 0),
        conversionRate: parseFloat(t.conversion_rate || 0),
        performanceScore: parseFloat(t.performance_score || 0),
        isActive: t.is_active,
        lastUsed: t.last_used_at,
      })) || [],
      trends: {
        daily: chartData,
        last30Days: {
          sent: recentProspects?.length || 0,
          opened: recentProspects?.filter(p => p.email_opened_at).length || 0,
          clicked: recentProspects?.filter(p => p.email_clicked_at).length || 0,
        },
      },
      insights: {
        bestTemplate: topTemplate ? {
          name: topTemplate.template_name,
          score: parseFloat(topTemplate.performance_score || 0),
          openRate: parseFloat(topTemplate.open_rate || 0),
          clickRate: parseFloat(topTemplate.click_rate || 0),
        } : null,
        worstTemplate: worstTemplate && templates && templates.length > 1 ? {
          name: worstTemplate.template_name,
          score: parseFloat(worstTemplate.performance_score || 0),
          openRate: parseFloat(worstTemplate.open_rate || 0),
          clickRate: parseFloat(worstTemplate.click_rate || 0),
        } : null,
        recommendation: generateRecommendation(templates || []),
      },
    });
  } catch (err) {
    console.error('❌ Email campaign stats error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch campaign stats' },
      { status: 500 }
    );
  }
}

function generateRecommendation(templates: any[]): string {
  if (!templates || templates.length === 0) {
    return 'No email templates found. Run the prospecting script to start collecting data.';
  }

  const totalSent = templates.reduce((sum, t) => sum + (t.times_sent || 0), 0);
  
  if (totalSent < 20) {
    return `Continue sending emails to gather more data (${totalSent}/20 minimum for optimization).`;
  }

  const top = templates[0];
  const avgScore = templates.reduce((sum, t) => sum + parseFloat(t.performance_score || 0), 0) / templates.length;
  const topScore = parseFloat(top.performance_score || 0);

  if (topScore > avgScore * 1.5) {
    return `Template "${top.template_name}" is performing exceptionally well (${topScore.toFixed(1)}% vs avg ${avgScore.toFixed(1)}%). Consider focusing on this template.`;
  }

  const lowPerformers = templates.filter(t => parseFloat(t.performance_score || 0) < avgScore * 0.5 && (t.times_sent || 0) > 5);
  
  if (lowPerformers.length > 0) {
    return `Consider pausing templates: ${lowPerformers.map(t => t.template_name).join(', ')}. They're underperforming significantly.`;
  }

  return `Campaign is performing consistently. Top template: "${top.template_name}" with ${topScore.toFixed(1)}% score.`;
}
