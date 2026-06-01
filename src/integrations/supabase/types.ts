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
      agent_candidates: {
        Row: {
          conference_id: string | null
          created_at: string
          decision: string
          description: string | null
          extracted: Json | null
          id: string
          reason: string
          run_id: string
          title: string | null
          url: string
        }
        Insert: {
          conference_id?: string | null
          created_at?: string
          decision: string
          description?: string | null
          extracted?: Json | null
          id?: string
          reason: string
          run_id: string
          title?: string | null
          url: string
        }
        Update: {
          conference_id?: string | null
          created_at?: string
          decision?: string
          description?: string | null
          extracted?: Json | null
          id?: string
          reason?: string
          run_id?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_candidates_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          added_count: number
          completion_tokens: number | null
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          flagged_count: number
          found_count: number
          id: string
          prompt_tokens: number | null
          skipped_count: number
          started_at: string
          status: string
          total_tokens: number | null
          trigger: string
        }
        Insert: {
          added_count?: number
          completion_tokens?: number | null
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          flagged_count?: number
          found_count?: number
          id?: string
          prompt_tokens?: number | null
          skipped_count?: number
          started_at?: string
          status?: string
          total_tokens?: number | null
          trigger?: string
        }
        Update: {
          added_count?: number
          completion_tokens?: number | null
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          flagged_count?: number
          found_count?: number
          id?: string
          prompt_tokens?: number | null
          skipped_count?: number
          started_at?: string
          status?: string
          total_tokens?: number | null
          trigger?: string
        }
        Relationships: []
      }
      conference_change_flags: {
        Row: {
          conference_id: string
          created_at: string
          field: string
          id: string
          new_value: Json | null
          old_value: Json | null
          source_url: string | null
          status: string
        }
        Insert: {
          conference_id: string
          created_at?: string
          field: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          source_url?: string | null
          status?: string
        }
        Update: {
          conference_id?: string
          created_at?: string
          field?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          source_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conference_change_flags_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      conferences: {
        Row: {
          assigned_reps: string[]
          city: string
          confidence: number | null
          country: string
          created_at: string
          deleted_at: string | null
          end_date: string
          estimated_audience_size: number
          icp_score: number
          id: string
          name: string
          provenance: Database["public"]["Enums"]["conf_provenance"]
          region: string
          source_url: string
          start_date: string
          status: Database["public"]["Enums"]["conf_decision_status"]
          sub_accessibility: number
          sub_audience_quality: number
          sub_decision_maker_presence: number
          sub_past_performance: number
          sub_vertical_fit: number
          tags: string[]
          tier: string
          updated_at: string
          vertical: string
        }
        Insert: {
          assigned_reps?: string[]
          city: string
          confidence?: number | null
          country: string
          created_at?: string
          deleted_at?: string | null
          end_date: string
          estimated_audience_size?: number
          icp_score?: number
          id?: string
          name: string
          provenance?: Database["public"]["Enums"]["conf_provenance"]
          region: string
          source_url: string
          start_date: string
          status?: Database["public"]["Enums"]["conf_decision_status"]
          sub_accessibility?: number
          sub_audience_quality?: number
          sub_decision_maker_presence?: number
          sub_past_performance?: number
          sub_vertical_fit?: number
          tags?: string[]
          tier?: string
          updated_at?: string
          vertical: string
        }
        Update: {
          assigned_reps?: string[]
          city?: string
          confidence?: number | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          estimated_audience_size?: number
          icp_score?: number
          id?: string
          name?: string
          provenance?: Database["public"]["Enums"]["conf_provenance"]
          region?: string
          source_url?: string
          start_date?: string
          status?: Database["public"]["Enums"]["conf_decision_status"]
          sub_accessibility?: number
          sub_audience_quality?: number
          sub_decision_maker_presence?: number
          sub_past_performance?: number
          sub_vertical_fit?: number
          tags?: string[]
          tier?: string
          updated_at?: string
          vertical?: string
        }
        Relationships: []
      }
      do_not_resurrect: {
        Row: {
          city_lower: string
          created_at: string
          id: string
          name_lower: string
          reason: string | null
          year: number
        }
        Insert: {
          city_lower: string
          created_at?: string
          id?: string
          name_lower: string
          reason?: string | null
          year: number
        }
        Update: {
          city_lower?: string
          created_at?: string
          id?: string
          name_lower?: string
          reason?: string | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      conf_decision_status: "Considering" | "Going" | "Passed"
      conf_provenance: "verified" | "ai_added"
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
      conf_decision_status: ["Considering", "Going", "Passed"],
      conf_provenance: ["verified", "ai_added"],
    },
  },
} as const
