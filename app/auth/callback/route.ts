import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendTrialWelcomeEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the newly authenticated user's data
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Create a row in public.users if it doesn't exist yet
        // Use service role client to bypass RLS on insert
        const adminClient = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } }
        );

        const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        // Step 1: Insert the row if it doesn't exist yet.
        // The DB trigger (handle_new_auth_user) already does this for OAuth sign-ups,
        // so this is a safety net for email/password sign-ups only.
        await adminClient
          .from("users")
          .upsert(
            {
              id: user.id,
              email: user.email!,
              full_name: (user.user_metadata?.full_name as string) ?? null,
              avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
              trial_ends_at: trialEndsAt,
            },
            { onConflict: "id", ignoreDuplicates: true }
          );

        // Step 2: If the row already existed (trigger created it without trial_ends_at),
        // the ignoreDuplicates upsert above did nothing. Fill in trial_ends_at now
        // only when it is still NULL (first-ever sign-in for this user).
        const { count: updatedCount, error: updateError } = await adminClient
          .from("users")
          .update({ trial_ends_at: trialEndsAt }, { count: "exact" })
          .eq("id", user.id)
          .is("trial_ends_at", null);

        if (updateError) {
          console.error("[auth/callback] Error setting trial_ends_at:", updateError.message);
        }

        // Send activation email only to brand-new users (trial_ends_at was just set)
        // updatedCount > 0 means the row existed without trial_ends_at → OAuth new user
        // updatedCount === 0 could mean the ignoreDuplicates INSERT ran (email/pass new user)
        // We detect the email/pass new-user case by checking if the upsert inserted a row
        // via a separate select of trial_ends_at to see if it equals the value we just set.
        // Simpler: fire the email whenever this is a truly fresh signup by checking
        // if the user was created in the last 30 seconds.
        const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
        const isNewUser = (updatedCount ?? 0) > 0 || (Date.now() - createdAt < 30_000);

        if (isNewUser && user.email) {
          try {
            await sendTrialWelcomeEmail(user.email);
          } catch (emailError) {
            // Non-fatal — log and continue
            console.error("[auth/callback] Failed to send trial welcome email:", emailError);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

// Google OAuth specific handling
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if this is a new user (first sign-in via Google)
      const isNewUser =
        data.user?.created_at &&
        Date.now() - new Date(data.user.created_at).getTime() < 10_000; // created in last 10s

      const redirectTo = isNewUser
        ? `${origin}/dashboard?signup=1`
        : `${origin}${next}`;

      return NextResponse.redirect(redirectTo);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
