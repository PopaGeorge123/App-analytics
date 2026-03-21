import { createClient } from "@/lib/supabase/server";
import type { User, UserUpdate } from "@/lib/supabase/types";

// Get the currently authenticated user from public.users
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return data as User | null;
}

// Update the currently authenticated user's data
export async function updateCurrentUser(
  updates: UserUpdate
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("users")
    .update(updates)
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
