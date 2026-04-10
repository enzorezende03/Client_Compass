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
      audit_logs: {
        Row: {
          changed_by: string
          client_id: string
          created_at: string
          field_name: string
          id: string
          new_value: string
          old_value: string
        }
        Insert: {
          changed_by?: string
          client_id: string
          created_at?: string
          field_name: string
          id?: string
          new_value?: string
          old_value?: string
        }
        Update: {
          changed_by?: string
          client_id?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string
          old_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          action_plan: string | null
          attention_points: string
          behavioral_profile: string
          complexity: string
          contract_start_date: string
          created_at: string
          cs_responsible: string
          document: string
          expectations: string
          financial_status: string
          gclick_carteira: string | null
          gclick_id: string | null
          health_score: string
          id: string
          name: string
          pain_points: string
          profile: string
          recurring_issues: string
          risk_identified_date: string | null
          risk_reason: string | null
          risk_type: string | null
          segment: string
          status: string
          strategic_notes: string
          taxation: string
          updated_at: string
        }
        Insert: {
          action_plan?: string | null
          attention_points?: string
          behavioral_profile?: string
          complexity?: string
          contract_start_date?: string
          created_at?: string
          cs_responsible?: string
          document?: string
          expectations?: string
          financial_status?: string
          gclick_carteira?: string | null
          gclick_id?: string | null
          health_score?: string
          id?: string
          name: string
          pain_points?: string
          profile?: string
          recurring_issues?: string
          risk_identified_date?: string | null
          risk_reason?: string | null
          risk_type?: string | null
          segment?: string
          status?: string
          strategic_notes?: string
          taxation?: string
          updated_at?: string
        }
        Update: {
          action_plan?: string | null
          attention_points?: string
          behavioral_profile?: string
          complexity?: string
          contract_start_date?: string
          created_at?: string
          cs_responsible?: string
          document?: string
          expectations?: string
          financial_status?: string
          gclick_carteira?: string | null
          gclick_id?: string | null
          health_score?: string
          id?: string
          name?: string
          pain_points?: string
          profile?: string
          recurring_issues?: string
          risk_identified_date?: string | null
          risk_reason?: string | null
          risk_type?: string | null
          segment?: string
          status?: string
          strategic_notes?: string
          taxation?: string
          updated_at?: string
        }
        Relationships: []
      }
      digisac_complaints: {
        Row: {
          contact_name: string
          created_at: string
          external_id: string
          id: string
          matched_client_id: string | null
          message: string
          processed: boolean
          received_at: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          external_id: string
          id?: string
          matched_client_id?: string | null
          message?: string
          processed?: boolean
          received_at?: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          external_id?: string
          id?: string
          matched_client_id?: string | null
          message?: string
          processed?: boolean
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digisac_complaints_matched_client_id_fkey"
            columns: ["matched_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gclick_sync_log: {
        Row: {
          created_at: string
          details: string | null
          id: string
          records_synced: number | null
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          records_synced?: number | null
          status?: string
          sync_type?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          records_synced?: number | null
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      internal_users: {
        Row: {
          access_profile: string
          active: boolean
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: string
          sector: string
          updated_at: string
        }
        Insert: {
          access_profile?: string
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name: string
          role?: string
          sector?: string
          updated_at?: string
        }
        Update: {
          access_profile?: string
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          sector?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          task_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          task_id?: string | null
          title?: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          task_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          client_id: string
          created_at: string
          description: string
          due_date: string
          id: string
          reminder_minutes: number | null
          responsible: string
          responsible_id: string | null
          scheduled_time: string | null
          status: string
          title: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          reminder_minutes?: number | null
          responsible?: string
          responsible_id?: string | null
          scheduled_time?: string | null
          status?: string
          title: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          reminder_minutes?: number | null
          responsible?: string
          responsible_id?: string | null
          scheduled_time?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_entries: {
        Row: {
          client_id: string
          created_at: string
          date: string
          demand_status: string
          description: string
          id: string
          is_relevant_event: boolean
          origin: string
          relevant_event_type: string | null
          responsible: string
          sector: string
          type: string
        }
        Insert: {
          client_id: string
          created_at?: string
          date?: string
          demand_status?: string
          description?: string
          id?: string
          is_relevant_event?: boolean
          origin?: string
          relevant_event_type?: string | null
          responsible?: string
          sector?: string
          type?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          date?: string
          demand_status?: string
          description?: string
          id?: string
          is_relevant_event?: boolean
          origin?: string
          relevant_event_type?: string | null
          responsible?: string
          sector?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_internal_user: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
