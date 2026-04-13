import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { LIVE_INTEGRATIONS } from "@/lib/integrations/catalog";
import OnboardingFlow from "./_components/OnboardingFlow";

export const metadata = {
  title: "Connect your first integration – Fold",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if user already has at least one integration
  const db = createServiceClient();
  const { data: integrations } = await db
    .from("integrations")
    .select("platform")
    .eq("user_id", user.id);

  if (integrations && integrations.length > 0) {
    redirect("/dashboard");
  }

  return (
    <OnboardingFlow
      liveIntegrations={LIVE_INTEGRATIONS}
      userEmail={user.email ?? ""}
    />
  );
}
