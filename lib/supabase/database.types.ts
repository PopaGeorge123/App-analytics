export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  PostgrestVersion: "12";
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          is_premium: boolean;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          is_premium?: boolean;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          is_premium?: boolean;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
        };
      };
      integrations: {
        Row: {
          id: string;
          user_id: string;
          platform: string;
          access_token: string;
          refresh_token: string | null;
          account_id: string | null;
          property_id: string | null;
          scope: string | null;
          expires_at: string | null;
          connected_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          platform: string;
          access_token: string;
          refresh_token?: string | null;
          account_id?: string | null;
          property_id?: string | null;
          scope?: string | null;
          expires_at?: string | null;
          connected_at?: string;
        };
        Update: {
          user_id?: string;
          platform?: string;
          access_token?: string;
          refresh_token?: string | null;
          account_id?: string | null;
          property_id?: string | null;
          scope?: string | null;
          expires_at?: string | null;
          connected_at?: string;
        };
      };
      daily_snapshots: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          date: string;
          data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          date: string;
          data: Json;
        };
        Update: {
          user_id?: string;
          provider?: string;
          date?: string;
          data?: Json;
        };
      };
      digests: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          summary: string;
          highlights: Json;
          anomalies: Json;
          cross_insight: string;
          action: Json;
          raw_context: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          summary: string;
          highlights: Json;
          anomalies: Json;
          cross_insight: string;
          action: Json;
          raw_context: Json;
        };
        Update: {
          user_id?: string;
          date?: string;
          summary?: string;
          highlights?: Json;
          anomalies?: Json;
          cross_insight?: string;
          action?: Json;
          raw_context?: Json;
        };
      };
      share_tokens: {
        Row: {
          id: string;
          token: string;
          user_id: string;
          label: string;
          date_from: string;
          date_to: string;
          platforms: string[];
          payload: Json;
          expires_at: string;
          created_at: string;
          view_count: number;
        };
        Insert: {
          id?: string;
          token: string;
          user_id: string;
          label?: string;
          date_from: string;
          date_to: string;
          platforms: string[];
          payload: Json;
          expires_at: string;
          view_count?: number;
        };
        Update: {
          view_count?: number;
          expires_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience row types
export type Integration =
  Database["public"]["Tables"]["integrations"]["Row"];
export type DailySnapshot =
  Database["public"]["Tables"]["daily_snapshots"]["Row"];
export type Digest = Database["public"]["Tables"]["digests"]["Row"];
export type DbUser = Database["public"]["Tables"]["users"]["Row"];
export type ShareToken = Database["public"]["Tables"]["share_tokens"]["Row"];

