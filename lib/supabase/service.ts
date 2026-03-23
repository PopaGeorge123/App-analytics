import { createClient } from "@supabase/supabase-js";
import type {
  Integration,
  DailySnapshot,
  Digest,
  DbUser,
} from "@/lib/supabase/database.types";

// Re-export row types for consumers
export type { Integration, DailySnapshot, Digest, DbUser };

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS — use only in server-side code (API routes, cron jobs, lib/).
 *
 * Returns an untyped client; use the exported row types for casting results.
 */
export function createServiceClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
