import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFreshdeskAuthUrl } from "@/lib/integrations/freshdesk/auth";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));

  let subdomain = request.nextUrl.searchParams.get("subdomain") ?? "";
  if (!subdomain) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&freshdesk=missing_subdomain", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  // Extract subdomain if user provided a full URL
  // e.g., "https://mycompany.freshdesk.com" → "mycompany"
  if (subdomain.includes("://") || subdomain.includes(".")) {
    try {
      // Try parsing as URL first
      const url = subdomain.startsWith("http") ? new URL(subdomain) : new URL(`https://${subdomain}`);
      const hostname = url.hostname;
      
      // Extract subdomain from hostname (e.g., "mycompany.freshdesk.com" → "mycompany")
      if (hostname.includes(".freshdesk.com")) {
        subdomain = hostname.split(".freshdesk.com")[0];
      } else if (hostname.includes(".freshworks.com")) {
        // If they entered freshworks.com, reject it
        return NextResponse.redirect(
          new URL("/dashboard?tab=settings&freshdesk=invalid_subdomain", process.env.NEXT_PUBLIC_APP_URL),
        );
      } else {
        // If it's some other domain, use the first part
        subdomain = hostname.split(".")[0];
      }
    } catch {
      // If URL parsing fails, try to extract from string
      subdomain = subdomain.replace(/^https?:\/\//, "").split(".")[0].split("/")[0];
    }
  }

  // Clean up any remaining slashes or special characters
  subdomain = subdomain.replace(/[^a-zA-Z0-9-]/g, "");

  if (!subdomain) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&freshdesk=invalid_subdomain", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  return NextResponse.redirect(getFreshdeskAuthUrl(user.id, subdomain));
}
