// Types pentru schema Supabase — Fold

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          company_name: string | null;
          plan: "free" | "pro" | "enterprise";
          onboarded: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          company_name?: string | null;
          plan?: "free" | "pro" | "enterprise";
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          company_name?: string | null;
          plan?: "free" | "pro" | "enterprise";
          onboarded?: boolean;
          updated_at?: string;
        };
      };
      waitlist_entries: {
        Row: {
          id: string;
          email: string;
          status: "pending" | "confirmed";
          confirmation_token: string;
          created_at: string;
          confirmed_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          status?: "pending" | "confirmed";
          confirmation_token: string;
          created_at?: string;
          confirmed_at?: string | null;
        };
        Update: {
          status?: "pending" | "confirmed";
          confirmed_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_plan: "free" | "pro" | "enterprise";
    };
  };
};

// Shorthand helpers
export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

export type WaitlistEntry = Database["public"]["Tables"]["waitlist_entries"]["Row"];
