import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Unsubscribe handler
 * GET /api/unsubscribe/[prospectId]
 */

export async function GET(
  request: Request,
  { params }: { params: { prospectId: string } }
) {
  const prospectId = params.prospectId;
  
  try {
    const db = createServiceClient();
    
    // Log the unsubscribe event
    await db.from("outbound_email_events").insert({
      prospect_id: prospectId,
      event_type: "unsubscribe",
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
    
    console.log(`🚫 Prospect ${prospectId} unsubscribed`);
    
    // Return simple unsubscribe confirmation page
    return new NextResponse(
      `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed - Fold Analytics</title>
  <style>
    body {
      margin: 0;
      padding: 40px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #0a0a0f;
      color: #e8e8f0;
      text-align: center;
    }
    .container {
      max-width: 500px;
      margin: 60px auto;
      background: #13131a;
      border: 1px solid #1f1f2a;
      border-radius: 16px;
      padding: 48px 32px;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #635bff 0%, #00d4aa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p {
      margin: 0 0 24px;
      font-size: 15px;
      line-height: 24px;
      color: #bcbcd8;
    }
    a {
      color: #00d4aa;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>You've been unsubscribed</h1>
    <p>You won't receive any more outreach emails from Fold Analytics.</p>
    <p style="font-size: 14px; color: #6a6a90;">
      Changed your mind? <a href="https://usefold.io">Visit our website</a>
    </p>
  </div>
</body>
</html>
      `,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  } catch (err) {
    console.error("❌ Failed to process unsubscribe:", err);
    return NextResponse.json(
      { error: "Failed to process unsubscribe" },
      { status: 500 }
    );
  }
}
