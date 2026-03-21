import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

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

        const { error: insertError } = await adminClient
          .from("users")
          .insert({
            id: user.id,
            email: user.email!,
            full_name: (user.user_metadata?.full_name as string) ?? null,
            avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
          });

        // If error is a duplicate (row already exists) — ignore it
        // Otherwise log the error but don't block the login
        if (insertError && insertError.code !== "23505") {
          console.error("[auth/callback] Error creating user row:", insertError.message);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
