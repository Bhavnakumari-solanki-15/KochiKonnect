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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      csv_upload_rows: {
        Row: {
          id: string
          upload_id: string | null
          row_index: number | null
          row_data: Json | null
        }
        Insert: {
          id?: string
          upload_id?: string | null
          row_index?: number | null
          row_data?: Json | null
        }
        Update: {
          id?: string
          upload_id?: string | null
          row_index?: number | null
          row_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "csv_upload_rows_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "csv_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_uploads: {
        Row: {
          id: string
          uploaded_at: string | null
          filename: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          uploaded_at?: string | null
          filename?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          uploaded_at?: string | null
          filename?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      train_data: {
        Row: {
          id: string
          train_id: string
          fitness_certificate_status: string | null
          job_card_status: string | null
          branding_priority: string | null
          mileage: number | null
          cleaning_status: string | null
          stabling_position: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          train_id: string
          fitness_certificate_status?: string | null
          job_card_status?: string | null
          branding_priority?: string | null
          mileage?: number | null
          cleaning_status?: string | null
          stabling_position?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          train_id?: string
          fitness_certificate_status?: string | null
          job_card_status?: string | null
          branding_priority?: string | null
          mileage?: number | null
          cleaning_status?: string | null
          stabling_position?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          notes: string | null
          ranking_data: Json | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          notes?: string | null
          ranking_data?: Json | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          notes?: string | null
          ranking_data?: Json | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      branding_priorities: {
        Row: {
          campaign_name: string | null
          created_at: string | null
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["branding_priority"] | null
          train_id: string | null
        }
        Insert: {
          campaign_name?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["branding_priority"] | null
          train_id?: string | null
        }
        Update: {
          campaign_name?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["branding_priority"] | null
          train_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_priorities_train_id_fkey"
            columns: ["train_id"]
            isOneToOne: false
            referencedRelation: "trains"
            referencedColumns: ["train_id"]
          },
        ]
      }
      cleaning_slots: {
        Row: {
          cleaning_type: string | null
          completed_date: string | null
          created_at: string | null
          id: string
          is_pending: boolean | null
          scheduled_date: string | null
          train_id: string | null
        }
        Insert: {
          cleaning_type?: string | null
          completed_date?: string | null
          created_at?: string | null
          id?: string
          is_pending?: boolean | null
          scheduled_date?: string | null
          train_id?: string | null
        }
        Update: {
          cleaning_type?: string | null
          completed_date?: string | null
          created_at?: string | null
          id?: string
          is_pending?: boolean | null
          scheduled_date?: string | null
          train_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_slots_train_id_fkey"
            columns: ["train_id"]
            isOneToOne: false
            referencedRelation: "trains"
            referencedColumns: ["train_id"]
          },
        ]
      }
      fitness_certificates: {
        Row: {
          certificate_type: string | null
          created_at: string | null
          expiry_date: string | null
          id: string
          is_valid: boolean | null
          issue_date: string | null
          train_id: string | null
        }
        Insert: {
          certificate_type?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          is_valid?: boolean | null
          issue_date?: string | null
          train_id?: string | null
        }
        Update: {
          certificate_type?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          is_valid?: boolean | null
          issue_date?: string | null
          train_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fitness_certificates_train_id_fkey"
            columns: ["train_id"]
            isOneToOne: false
            referencedRelation: "trains"
            referencedColumns: ["train_id"]
          },
        ]
      }
      job_cards: {
        Row: {
          created_at: string | null
          created_date: string | null
          due_date: string | null
          id: string
          is_open: boolean | null
          job_description: string | null
          priority: Database["public"]["Enums"]["job_card_priority"] | null
          train_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_date?: string | null
          due_date?: string | null
          id?: string
          is_open?: boolean | null
          job_description?: string | null
          priority?: Database["public"]["Enums"]["job_card_priority"] | null
          train_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_date?: string | null
          due_date?: string | null
          id?: string
          is_open?: boolean | null
          job_description?: string | null
          priority?: Database["public"]["Enums"]["job_card_priority"] | null
          train_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_cards_train_id_fkey"
            columns: ["train_id"]
            isOneToOne: false
            referencedRelation: "trains"
            referencedColumns: ["train_id"]
          },
        ]
      }
      mileage_logs: {
        Row: {
          created_at: string | null
          current_mileage: number | null
          id: string
          log_date: string | null
          needs_balancing: boolean | null
          target_mileage: number | null
          train_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_mileage?: number | null
          id?: string
          log_date?: string | null
          needs_balancing?: boolean | null
          target_mileage?: number | null
          train_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_mileage?: number | null
          id?: string
          log_date?: string | null
          needs_balancing?: boolean | null
          target_mileage?: number | null
          train_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mileage_logs_train_id_fkey"
            columns: ["train_id"]
            isOneToOne: false
            referencedRelation: "trains"
            referencedColumns: ["train_id"]
          },
        ]
      }
      stabling_positions: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          position_name: string | null
          requires_shunting: boolean | null
          train_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          position_name?: string | null
          requires_shunting?: boolean | null
          train_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          position_name?: string | null
          requires_shunting?: boolean | null
          train_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stabling_positions_train_id_fkey"
            columns: ["train_id"]
            isOneToOne: false
            referencedRelation: "trains"
            referencedColumns: ["train_id"]
          },
        ]
      }
      trains: {
        Row: {
          created_at: string | null
          id: string
          model: string | null
          status: Database["public"]["Enums"]["train_status"] | null
          train_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          model?: string | null
          status?: Database["public"]["Enums"]["train_status"] | null
          train_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          model?: string | null
          status?: Database["public"]["Enums"]["train_status"] | null
          train_id?: string
          updated_at?: string | null
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
      branding_priority: "low" | "medium" | "high"
      job_card_priority: "low" | "medium" | "high" | "critical"
      train_status: "active" | "maintenance" | "retired"
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
      branding_priority: ["low", "medium", "high"],
      job_card_priority: ["low", "medium", "high", "critical"],
      train_status: ["active", "maintenance", "retired"],
    },
  },
} as const
