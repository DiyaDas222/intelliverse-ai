export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          read_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      asset_shares: {
        Row: {
          allow_download: boolean
          asset_id: string
          created_at: string
          expires_at: string
          id: string
          max_views: number | null
          token: string
          user_id: string
          view_count: number
        }
        Insert: {
          allow_download?: boolean
          asset_id: string
          created_at?: string
          expires_at: string
          id?: string
          max_views?: number | null
          token: string
          user_id: string
          view_count?: number
        }
        Update: {
          allow_download?: boolean
          asset_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          max_views?: number | null
          token?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_shares_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "generated_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          model: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_analyses: {
        Row: {
          created_at: string
          document_id: string
          id: string
          kind: string
          query: string | null
          result: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          kind: string
          query?: string | null
          result: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          kind?: string
          query?: string | null
          result?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_analyses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          extracted_text: string | null
          filename: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          filename: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          filename?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_assets: {
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json
          mime_type: string | null
          prompt: string | null
          public_url: string | null
          size_bytes: number | null
          storage_path: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          mime_type?: string | null
          prompt?: string | null
          public_url?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          mime_type?: string | null
          prompt?: string | null
          public_url?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      github_connections: {
        Row: {
          access_token: string
          created_at: string
          github_user_id: number | null
          github_username: string
          scopes: string[] | null
          token_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          github_user_id?: number | null
          github_username: string
          scopes?: string[] | null
          token_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          github_user_id?: number | null
          github_username?: string
          scopes?: string[] | null
          token_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          edited: boolean
          id: string
          images: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          edited?: boolean
          id?: string
          images?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          edited?: boolean
          id?: string
          images?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paise: number
          captured_at: string | null
          created_at: string
          currency: string
          environment: string
          id: string
          metadata: Json
          plan_id: string
          razorpay_order_id: string
          razorpay_payment_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          metadata?: Json
          plan_id: string
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          metadata?: Json
          plan_id?: string
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          duration_days: number
          features: Json
          id: string
          is_active: boolean
          name: string
          price_paise: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          duration_days: number
          features?: Json
          id: string
          is_active?: boolean
          name: string
          price_paise: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_paise?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bonus_credits: number
          created_at: string
          credits_period_start: string
          display_name: string | null
          email: string | null
          id: string
          monthly_credits_used: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bonus_credits?: number
          created_at?: string
          credits_period_start?: string
          display_name?: string | null
          email?: string | null
          id: string
          monthly_credits_used?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bonus_credits?: number
          created_at?: string
          credits_period_start?: string
          display_name?: string | null
          email?: string | null
          id?: string
          monthly_credits_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      provider_configs: {
        Row: {
          category: string
          enabled: boolean
          env_vars: string[]
          id: string
          name: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          enabled?: boolean
          env_vars?: string[]
          id: string
          name: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          enabled?: boolean
          env_vars?: string[]
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      publish_history: {
        Row: {
          branch: string
          commit_sha: string | null
          created_at: string
          error: string | null
          file_count: number
          id: string
          is_private: boolean
          pro_at_publish: boolean
          repo_name: string
          repo_owner: string
          repo_url: string
          source_id: string | null
          source_kind: string
          status: string
          user_id: string
        }
        Insert: {
          branch?: string
          commit_sha?: string | null
          created_at?: string
          error?: string | null
          file_count?: number
          id?: string
          is_private?: boolean
          pro_at_publish?: boolean
          repo_name: string
          repo_owner: string
          repo_url: string
          source_id?: string | null
          source_kind: string
          status?: string
          user_id: string
        }
        Update: {
          branch?: string
          commit_sha?: string | null
          created_at?: string
          error?: string | null
          file_count?: number
          id?: string
          is_private?: boolean
          pro_at_publish?: boolean
          repo_name?: string
          repo_owner?: string
          repo_url?: string
          source_id?: string | null
          source_kind?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          payment_id: string | null
          plan_id: string | null
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          payment_id?: string | null
          plan_id?: string | null
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          payment_id?: string | null
          plan_id?: string | null
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          count: number
          kind: string
          period_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          kind: string
          period_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          kind?: string
          period_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vibe_projects: {
        Row: {
          created_at: string
          deploy_logs: Json
          deploy_status: string
          deployed_at: string | null
          description: string | null
          entry_file: string | null
          files: Json
          id: string
          kind: string
          messages: Json
          name: string
          slug: string | null
          stack: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deploy_logs?: Json
          deploy_status?: string
          deployed_at?: string | null
          description?: string | null
          entry_file?: string | null
          files?: Json
          id?: string
          kind?: string
          messages?: Json
          name: string
          slug?: string | null
          stack?: Json
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          deploy_logs?: Json
          deploy_status?: string
          deployed_at?: string | null
          description?: string | null
          entry_file?: string | null
          files?: Json
          id?: string
          kind?: string
          messages?: Json
          name?: string
          slug?: string | null
          stack?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_active_pro: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_usage: {
        Args: { _free_limit: number; _kind: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "pro" | "team"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "pro", "team"],
    },
  },
} as const
