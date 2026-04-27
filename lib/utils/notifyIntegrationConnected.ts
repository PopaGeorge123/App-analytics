import { createServiceClient } from "@/lib/supabase/service";
import { sendIntegrationConnectedEmail } from "@/lib/email";

/**
 * Fire-and-forget email notification sent whenever a user successfully
 * connects an integration via OAuth.
 *
 * @param userId   - The Supabase auth user ID (the `state` param in callbacks)
 * @param platform - The platform ID matching INTEGRATIONS_CATALOG (e.g. "stripe")
 */
export async function notifyIntegrationConnected(
  userId: string,
  platform: string
): Promise<void> {
  try {
    const db = createServiceClient();

    // Fetch the user's email from Supabase auth
    const {
      data: { user },
      error,
    } = await db.auth.admin.getUserById(userId);

    if (error) {
      console.error("[notifyIntegrationConnected] Could not fetch user:", error.message);
      return;
    }
    if (!user?.email) {
      console.error("[notifyIntegrationConnected] No email for userId:", userId);
      return;
    }

    await sendIntegrationConnectedEmail(user.email, platform);
    console.log(`[notifyIntegrationConnected] Email sent to ${user.email} for platform: ${platform}`);
  } catch (err) {
    // Never let notification failures bubble up — the connect itself succeeded
    console.error("[notifyIntegrationConnected] Failed to send email:", err);
  }
}
