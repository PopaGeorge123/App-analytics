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
          full_name: string | null;
          avatar_url: string | null;
          company_name: string | null;
          plan: string;
          onboarded: boolean;
          is_premium: boolean;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          trial_ends_at: string | null;
          trial_used: boolean;
          alert_rules: Json | null;
          goals: Json | null;
          goals_notified_month: Json | null;
          digest_subscribed: boolean;
          digest_day: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          company_name?: string | null;
          plan?: string;
          onboarded?: boolean;
          is_premium?: boolean;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_ends_at?: string | null;
          trial_used?: boolean;
          alert_rules?: Json | null;
          goals?: Json | null;
          goals_notified_month?: Json | null;
          digest_subscribed?: boolean;
          digest_day?: number;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          company_name?: string | null;
          plan?: string;
          onboarded?: boolean;
          is_premium?: boolean;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_ends_at?: string | null;
          trial_used?: boolean;
          alert_rules?: Json | null;
          goals?: Json | null;
          goals_notified_month?: Json | null;
          digest_subscribed?: boolean;
          digest_day?: number;
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
          currency: string | null;
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
          currency?: string | null;
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
          currency?: string | null;
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
      website_profiles: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          title: string | null;
          description: string | null;
          score: number;
          report: Json | null;
          analysis_status: string;
          analysis_error: string | null;
          last_scanned_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          title?: string | null;
          description?: string | null;
          score?: number;
          report?: Json | null;
          analysis_status?: string;
          analysis_error?: string | null;
          last_scanned_at?: string | null;
        };
        Update: {
          url?: string;
          title?: string | null;
          description?: string | null;
          score?: number;
          report?: Json | null;
          analysis_status?: string;
          analysis_error?: string | null;
          last_scanned_at?: string | null;
        };
      };
      website_tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string;
          category: string;
          impact_score: number;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description: string;
          category: string;
          impact_score?: number;
          completed?: boolean;
          completed_at?: string | null;
        };
        Update: {
          title?: string;
          description?: string;
          category?: string;
          impact_score?: number;
          completed?: boolean;
          completed_at?: string | null;
        };
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
        };
        Update: {
          title?: string;
          updated_at?: string;
        };
      };
      ai_messages: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string | null;
          role: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          conversation_id?: string | null;
          role: string;
          content: string;
        };
        Update: {
          content?: string;
        };
      };
      ai_insights: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          date?: string;
        };
        Update: {
          content?: string;
        };
      };
      waitlist_entries: {
        Row: {
          id: string;
          email: string;
          status: string;
          confirmation_token: string;
          created_at: string;
          confirmed_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          status?: string;
          confirmation_token: string;
          confirmed_at?: string | null;
        };
        Update: {
          status?: string;
          confirmed_at?: string | null;
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

