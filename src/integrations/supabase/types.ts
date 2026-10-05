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
      action_plans: {
        Row: {
          category: string
          client_id: string
          completed_at: string | null
          created_at: string
          description: string
          due_date: string
          expected_result: string
          id: string
          next_step: string
          objective: string
          observations: string
          priority: string
          responsible: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string
          expected_result?: string
          id?: string
          next_step?: string
          objective?: string
          observations?: string
          priority?: string
          responsible?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string
          expected_result?: string
          id?: string
          next_step?: string
          objective?: string
          observations?: string
          priority?: string
          responsible?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          changed_by: string
          client_id: string
          created_at: string
          field_name: string
          id: string
          new_value: string
          old_value: string
          record_id: string | null
        }
        Insert: {
          changed_by?: string
          client_id: string
          created_at?: string
          field_name: string
          id?: string
          new_value?: string
          old_value?: string
          record_id?: string | null
        }
        Update: {
          changed_by?: string
          client_id?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string
          old_value?: string
          record_id?: string | null
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
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string
          id: string
          is_whatsapp: boolean
          name: string
          phone: string
          role: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string
          id?: string
          is_whatsapp?: boolean
          name?: string
          phone?: string
          role?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          is_whatsapp?: boolean
          name?: string
          phone?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_feedback_surveys: {
        Row: {
          applied_at: string
          applied_by: string | null
          clarity: number
          client_id: string
          created_at: string
          id: string
          improvement_point: string
          nps: number
          security: string
          suggestion: string
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          clarity: number
          client_id: string
          created_at?: string
          id?: string
          improvement_point?: string
          nps: number
          security: string
          suggestion?: string
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          clarity?: number
          client_id?: string
          created_at?: string
          id?: string
          improvement_point?: string
          nps?: number
          security?: string
          suggestion?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_feedback_surveys_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feedback_surveys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding_progress: {
        Row: {
          checklist_item_id: string
          client_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          force_unlock_reason: string | null
          force_unlocked_at: string | null
          force_unlocked_by: string | null
          id: string
          locked: boolean
          notes: string | null
          notes_updated_at: string | null
          notes_updated_by: string | null
          status: string
          unlocked_at: string | null
        }
        Insert: {
          checklist_item_id: string
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          force_unlock_reason?: string | null
          force_unlocked_at?: string | null
          force_unlocked_by?: string | null
          id?: string
          locked?: boolean
          notes?: string | null
          notes_updated_at?: string | null
          notes_updated_by?: string | null
          status?: string
          unlocked_at?: string | null
        }
        Update: {
          checklist_item_id?: string
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          force_unlock_reason?: string | null
          force_unlocked_at?: string | null
          force_unlocked_by?: string | null
          id?: string
          locked?: boolean
          notes?: string | null
          notes_updated_at?: string | null
          notes_updated_by?: string | null
          status?: string
          unlocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_progress_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "onboarding_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_progress_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "onboarding_sla_status"
            referencedColumns: ["checklist_item_id"]
          },
          {
            foreignKeyName: "client_onboarding_progress_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_progress_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_progress_force_unlocked_by_fkey"
            columns: ["force_unlocked_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_terminations: {
        Row: {
          archive_client: boolean
          client_id: string
          created_at: string
          during_onboarding: boolean
          effective_date: string | null
          error_sector: string | null
          id: string
          improvement_notes: string
          initiated_by: string
          monthly_fee_at_termination: number | null
          reason_category: string
          reason_detail: string
          registered_by: string | null
          request_date: string
          revert_reason: string | null
          reverted_at: string | null
          reverted_by: string | null
          was_error: boolean
        }
        Insert: {
          archive_client?: boolean
          client_id: string
          created_at?: string
          during_onboarding?: boolean
          effective_date?: string | null
          error_sector?: string | null
          id?: string
          improvement_notes?: string
          initiated_by?: string
          monthly_fee_at_termination?: number | null
          reason_category: string
          reason_detail?: string
          registered_by?: string | null
          request_date: string
          revert_reason?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          was_error?: boolean
        }
        Update: {
          archive_client?: boolean
          client_id?: string
          created_at?: string
          during_onboarding?: boolean
          effective_date?: string | null
          error_sector?: string | null
          id?: string
          improvement_notes?: string
          initiated_by?: string
          monthly_fee_at_termination?: number | null
          reason_category?: string
          reason_detail?: string
          registered_by?: string | null
          request_date?: string
          revert_reason?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          was_error?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "client_terminations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_terminations_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_terminations_reverted_by_fkey"
            columns: ["reverted_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          action_plan: string | null
          archived: boolean
          archived_at: string | null
          archived_by: string
          archived_reason: string
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
          onboarding_completed_at: string | null
          onboarding_stage: string | null
          onboarding_started_at: string | null
          onboarding_status: string
          onboarding_type: string | null
          pain_points: string
          parceria: string | null
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
          archived?: boolean
          archived_at?: string | null
          archived_by?: string
          archived_reason?: string
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
          onboarding_completed_at?: string | null
          onboarding_stage?: string | null
          onboarding_started_at?: string | null
          onboarding_status?: string
          onboarding_type?: string | null
          pain_points?: string
          parceria?: string | null
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
          archived?: boolean
          archived_at?: string | null
          archived_by?: string
          archived_reason?: string
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
          onboarding_completed_at?: string | null
          onboarding_stage?: string | null
          onboarding_started_at?: string | null
          onboarding_status?: string
          onboarding_type?: string | null
          pain_points?: string
          parceria?: string | null
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
      commercial_handoff: {
        Row: {
          client_id: string
          commercial_notes: string | null
          deal_closed_at: string | null
          filled_at: string
          filled_by: string | null
          id: string
          monthly_value: number | null
          payment_due_day: number | null
          payment_method: string | null
          salesperson: string | null
          services: Json
          updated_at: string
        }
        Insert: {
          client_id: string
          commercial_notes?: string | null
          deal_closed_at?: string | null
          filled_at?: string
          filled_by?: string | null
          id?: string
          monthly_value?: number | null
          payment_due_day?: number | null
          payment_method?: string | null
          salesperson?: string | null
          services?: Json
          updated_at?: string
        }
        Update: {
          client_id?: string
          commercial_notes?: string | null
          deal_closed_at?: string | null
          filled_at?: string
          filled_by?: string | null
          id?: string
          monthly_value?: number | null
          payment_due_day?: number | null
          payment_method?: string | null
          salesperson?: string | null
          services?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_handoff_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_handoff_filled_by_fkey"
            columns: ["filled_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_sla_catalog: {
        Row: {
          active: boolean
          created_at: string
          demand_name: string
          id: string
          notes: string
          sector: string
          sla_unit: string
          sla_value: number
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          demand_name: string
          id?: string
          notes?: string
          sector: string
          sla_unit: string
          sla_value: number
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          demand_name?: string
          id?: string
          notes?: string
          sector?: string
          sla_unit?: string
          sla_value?: number
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_sla_catalog_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_sla_catalog_history: {
        Row: {
          action: string
          catalog_id: string | null
          changed_by: string | null
          changed_by_name: string
          created_at: string
          demand_name: string
          field_name: string
          id: string
          new_value: string
          old_value: string
          sector: string
        }
        Insert: {
          action: string
          catalog_id?: string | null
          changed_by?: string | null
          changed_by_name?: string
          created_at?: string
          demand_name: string
          field_name: string
          id?: string
          new_value?: string
          old_value?: string
          sector: string
        }
        Update: {
          action?: string
          catalog_id?: string | null
          changed_by?: string | null
          changed_by_name?: string
          created_at?: string
          demand_name?: string
          field_name?: string
          id?: string
          new_value?: string
          old_value?: string
          sector?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_sla_catalog_history_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "demand_sla_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_sla_catalog_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
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
      gclick_ignored_clients: {
        Row: {
          created_at: string
          gclick_id: string
          id: string
          ignored_by: string
          inscricao: string
          nome: string
        }
        Insert: {
          created_at?: string
          gclick_id: string
          id?: string
          ignored_by?: string
          inscricao?: string
          nome?: string
        }
        Update: {
          created_at?: string
          gclick_id?: string
          id?: string
          ignored_by?: string
          inscricao?: string
          nome?: string
        }
        Relationships: []
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
      holidays: {
        Row: {
          created_at: string
          day: string
          kind: string
          name: string
        }
        Insert: {
          created_at?: string
          day: string
          kind?: string
          name: string
        }
        Update: {
          created_at?: string
          day?: string
          kind?: string
          name?: string
        }
        Relationships: []
      }
      internal_user_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          internal_user_id: string
          permission: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          internal_user_id: string
          permission: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          internal_user_id?: string
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_user_permissions_internal_user_id_fkey"
            columns: ["internal_user_id"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
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
      message_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          moment: string
          onboarding_type: string
          stage: string
          title: string
          variables: Json
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          moment: string
          onboarding_type: string
          stage: string
          title: string
          variables?: Json
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          moment?: string
          onboarding_type?: string
          stage?: string
          title?: string
          variables?: Json
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
      occurrence_treatments: {
        Row: {
          author_id: string | null
          author_name: string
          content: string
          created_at: string
          entry_id: string
          id: string
          kind: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          content?: string
          created_at?: string
          entry_id: string
          id?: string
          kind: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          content?: string
          created_at?: string
          entry_id?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_treatments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrence_treatments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "timeline_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklist_items: {
        Row: {
          active: boolean
          applies_to_types: string[] | null
          channel: string | null
          completion_rule: string | null
          created_at: string
          description: string
          execution_notes_md: string | null
          guidance_md: string | null
          id: string
          internal_standards_md: string | null
          is_required: boolean
          links: Json
          order_index: number
          report_month: number | null
          responsible_role: string
          role: string | null
          sla_days: number | null
          sla_hours: number | null
          sla_unit: string | null
          sla_value: number | null
          stage: string
          title: string
          trigger_note: string | null
          trigger_type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          applies_to_types?: string[] | null
          channel?: string | null
          completion_rule?: string | null
          created_at?: string
          description?: string
          execution_notes_md?: string | null
          guidance_md?: string | null
          id?: string
          internal_standards_md?: string | null
          is_required?: boolean
          links?: Json
          order_index: number
          report_month?: number | null
          responsible_role?: string
          role?: string | null
          sla_days?: number | null
          sla_hours?: number | null
          sla_unit?: string | null
          sla_value?: number | null
          stage: string
          title: string
          trigger_note?: string | null
          trigger_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          applies_to_types?: string[] | null
          channel?: string | null
          completion_rule?: string | null
          created_at?: string
          description?: string
          execution_notes_md?: string | null
          guidance_md?: string | null
          id?: string
          internal_standards_md?: string | null
          is_required?: boolean
          links?: Json
          order_index?: number
          report_month?: number | null
          responsible_role?: string
          role?: string | null
          sla_days?: number | null
          sla_hours?: number | null
          sla_unit?: string | null
          sla_value?: number | null
          stage?: string
          title?: string
          trigger_note?: string | null
          trigger_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      onboarding_handoff_forms: {
        Row: {
          activity: string
          client_id: string
          cnpj: string
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at: string
          created_by: string | null
          employee_count: number | null
          financial_contact: string
          fiscal_issues: string
          has_employees: boolean
          has_fixed_assets: string
          id: string
          legal_name: string
          next_steps: string
          nf_types: string
          notes: string
          organization_level: number | null
          pending_docs: string
          profit_distribution_minutes: boolean | null
          received_docs: string
          rented_hq: string
          sent_at: string | null
          start_competency: string
          tax_regime: string
          updated_at: string
          worker_risk_programs: boolean | null
        }
        Insert: {
          activity?: string
          client_id: string
          cnpj?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          created_by?: string | null
          employee_count?: number | null
          financial_contact?: string
          fiscal_issues?: string
          has_employees?: boolean
          has_fixed_assets?: string
          id?: string
          legal_name?: string
          next_steps?: string
          nf_types?: string
          notes?: string
          organization_level?: number | null
          pending_docs?: string
          profit_distribution_minutes?: boolean | null
          received_docs?: string
          rented_hq?: string
          sent_at?: string | null
          start_competency?: string
          tax_regime?: string
          updated_at?: string
          worker_risk_programs?: boolean | null
        }
        Update: {
          activity?: string
          client_id?: string
          cnpj?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          created_by?: string | null
          employee_count?: number | null
          financial_contact?: string
          fiscal_issues?: string
          has_employees?: boolean
          has_fixed_assets?: string
          id?: string
          legal_name?: string
          next_steps?: string
          nf_types?: string
          notes?: string
          organization_level?: number | null
          pending_docs?: string
          profit_distribution_minutes?: boolean | null
          received_docs?: string
          rented_hq?: string
          sent_at?: string | null
          start_competency?: string
          tax_regime?: string
          updated_at?: string
          worker_risk_programs?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_handoff_forms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_handoff_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_item_attachments: {
        Row: {
          client_onboarding_item_id: string
          file_name: string
          file_path: string
          id: string
          mime_type: string
          size_bytes: number
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          client_onboarding_item_id: string
          file_name: string
          file_path: string
          id?: string
          mime_type: string
          size_bytes: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          client_onboarding_item_id?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_item_attachments_client_onboarding_item_id_fkey"
            columns: ["client_onboarding_item_id"]
            isOneToOne: false
            referencedRelation: "client_onboarding_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_item_attachments_client_onboarding_item_id_fkey"
            columns: ["client_onboarding_item_id"]
            isOneToOne: false
            referencedRelation: "onboarding_sla_status"
            referencedColumns: ["progress_id"]
          },
        ]
      }
      onboarding_item_templates: {
        Row: {
          body_md: string
          channel: string
          created_at: string
          id: string
          item_definition_id: string
          sort_order: number
          subject: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_md?: string
          channel?: string
          created_at?: string
          id?: string
          item_definition_id: string
          sort_order?: number
          subject?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_md?: string
          channel?: string
          created_at?: string
          id?: string
          item_definition_id?: string
          sort_order?: number
          subject?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_item_templates_item_definition_id_fkey"
            columns: ["item_definition_id"]
            isOneToOne: false
            referencedRelation: "onboarding_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_item_templates_item_definition_id_fkey"
            columns: ["item_definition_id"]
            isOneToOne: false
            referencedRelation: "onboarding_sla_status"
            referencedColumns: ["checklist_item_id"]
          },
        ]
      }
      onboarding_procedure_history: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          changed_by: string | null
          changed_by_name: string
          created_at: string
          id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          changed_by_name?: string
          created_at?: string
          id?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          changed_by_name?: string
          created_at?: string
          id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_procedure_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_procedure_items: {
        Row: {
          active: boolean
          channel: string | null
          content: string
          created_at: string
          id: string
          kind: string
          phase_id: string
          sort_order: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          channel?: string | null
          content?: string
          created_at?: string
          id?: string
          kind: string
          phase_id: string
          sort_order?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          channel?: string | null
          content?: string
          created_at?: string
          id?: string
          kind?: string
          phase_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_procedure_items_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "onboarding_procedure_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_procedure_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_procedure_phases: {
        Row: {
          active: boolean
          created_at: string
          description: string
          id: string
          linked_stage_key: string | null
          onboarding_type: string | null
          sort_order: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          linked_stage_key?: string | null
          onboarding_type?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          linked_stage_key?: string | null
          onboarding_type?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_procedure_phases_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_monthly_reports: {
        Row: {
          client_id: string
          completed_obligations: string
          cs_attention_points: string
          id: string
          integration_progress: string
          operational_difficulties: string
          overall_status: string
          pending_items: string
          reference_month: string
          submitted_at: string
          submitted_by: string | null
          upcoming_milestones: string
        }
        Insert: {
          client_id: string
          completed_obligations?: string
          cs_attention_points?: string
          id?: string
          integration_progress?: string
          operational_difficulties?: string
          overall_status?: string
          pending_items?: string
          reference_month: string
          submitted_at?: string
          submitted_by?: string | null
          upcoming_milestones?: string
        }
        Update: {
          client_id?: string
          completed_obligations?: string
          cs_attention_points?: string
          id?: string
          integration_progress?: string
          operational_difficulties?: string
          overall_status?: string
          pending_items?: string
          reference_month?: string
          submitted_at?: string
          submitted_by?: string | null
          upcoming_milestones?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_monthly_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_monthly_reports_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_force_unlocks: {
        Row: {
          client_id: string
          created_at: string
          id: string
          progress_id: string | null
          reason: string
          stage: string | null
          task_id: string | null
          unlocked_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          progress_id?: string | null
          reason: string
          stage?: string | null
          task_id?: string | null
          unlocked_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          progress_id?: string | null
          reason?: string
          stage?: string | null
          task_id?: string | null
          unlocked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_force_unlocks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_force_unlocks_progress_id_fkey"
            columns: ["progress_id"]
            isOneToOne: false
            referencedRelation: "client_onboarding_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_force_unlocks_progress_id_fkey"
            columns: ["progress_id"]
            isOneToOne: false
            referencedRelation: "onboarding_sla_status"
            referencedColumns: ["progress_id"]
          },
          {
            foreignKeyName: "task_force_unlocks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_force_unlocks_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reschedules: {
        Row: {
          client_id: string
          created_at: string
          id: string
          new_due_date: string
          previous_due_date: string
          reason: string
          rescheduled_by: string | null
          rescheduled_by_name: string
          task_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          new_due_date: string
          previous_due_date: string
          reason?: string
          rescheduled_by?: string | null
          rescheduled_by_name?: string
          task_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          new_due_date?: string
          previous_due_date?: string
          reason?: string
          rescheduled_by?: string | null
          rescheduled_by_name?: string
          task_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string
          checklist_item_id: string | null
          client_due_date: string | null
          client_id: string
          created_at: string
          description: string
          due_date: string
          external_task_id: string | null
          force_unlock_reason: string | null
          force_unlocked_by: string | null
          id: string
          internal_due_date: string | null
          last_reschedule_reason: string | null
          last_rescheduled_at: string | null
          locked: boolean
          onboarding_stage: string | null
          reminder_minutes: number | null
          reschedule_count: number
          responsible: string
          responsible_id: string | null
          scheduled_time: string | null
          source_timeline_entry_id: string | null
          status: string
          title: string
          unlocked_at: string | null
        }
        Insert: {
          category?: string
          checklist_item_id?: string | null
          client_due_date?: string | null
          client_id: string
          created_at?: string
          description?: string
          due_date?: string
          external_task_id?: string | null
          force_unlock_reason?: string | null
          force_unlocked_by?: string | null
          id?: string
          internal_due_date?: string | null
          last_reschedule_reason?: string | null
          last_rescheduled_at?: string | null
          locked?: boolean
          onboarding_stage?: string | null
          reminder_minutes?: number | null
          reschedule_count?: number
          responsible?: string
          responsible_id?: string | null
          scheduled_time?: string | null
          source_timeline_entry_id?: string | null
          status?: string
          title: string
          unlocked_at?: string | null
        }
        Update: {
          category?: string
          checklist_item_id?: string | null
          client_due_date?: string | null
          client_id?: string
          created_at?: string
          description?: string
          due_date?: string
          external_task_id?: string | null
          force_unlock_reason?: string | null
          force_unlocked_by?: string | null
          id?: string
          internal_due_date?: string | null
          last_reschedule_reason?: string | null
          last_rescheduled_at?: string | null
          locked?: boolean
          onboarding_stage?: string | null
          reminder_minutes?: number | null
          reschedule_count?: number
          responsible?: string
          responsible_id?: string | null
          scheduled_time?: string | null
          source_timeline_entry_id?: string | null
          status?: string
          title?: string
          unlocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "onboarding_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "onboarding_sla_status"
            referencedColumns: ["checklist_item_id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_force_unlocked_by_fkey"
            columns: ["force_unlocked_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_timeline_entry_id_fkey"
            columns: ["source_timeline_entry_id"]
            isOneToOne: false
            referencedRelation: "timeline_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_entries: {
        Row: {
          assigned_cs_id: string | null
          assumed_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_charged: boolean | null
          client_charged_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          date: string
          demand_status: string
          description: string
          id: string
          initial_followup: boolean
          is_occurrence: boolean
          is_relevant_event: boolean
          missing_info: string | null
          occurred_at: string
          occurrence_category: string | null
          origin: string
          raised_by_area: string | null
          relevant_event_type: string | null
          resolution_outcome: string | null
          resolution_status: string
          resolved_at: string | null
          responsibility_origin: string | null
          responsible: string
          sector: string
          severity: string | null
          type: string
        }
        Insert: {
          assigned_cs_id?: string | null
          assumed_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_charged?: boolean | null
          client_charged_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          demand_status?: string
          description?: string
          id?: string
          initial_followup?: boolean
          is_occurrence?: boolean
          is_relevant_event?: boolean
          missing_info?: string | null
          occurred_at?: string
          occurrence_category?: string | null
          origin?: string
          raised_by_area?: string | null
          relevant_event_type?: string | null
          resolution_outcome?: string | null
          resolution_status?: string
          resolved_at?: string | null
          responsibility_origin?: string | null
          responsible?: string
          sector?: string
          severity?: string | null
          type?: string
        }
        Update: {
          assigned_cs_id?: string | null
          assumed_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_charged?: boolean | null
          client_charged_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          demand_status?: string
          description?: string
          id?: string
          initial_followup?: boolean
          is_occurrence?: boolean
          is_relevant_event?: boolean
          missing_info?: string | null
          occurred_at?: string
          occurrence_category?: string | null
          origin?: string
          raised_by_area?: string | null
          relevant_event_type?: string | null
          resolution_outcome?: string | null
          resolution_status?: string
          resolved_at?: string | null
          responsibility_origin?: string | null
          responsible?: string
          sector?: string
          severity?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_entries_assigned_cs_id_fkey"
            columns: ["assigned_cs_id"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_entries_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      onboarding_sla_status: {
        Row: {
          checklist_item_id: string | null
          client_id: string | null
          client_name: string | null
          concluded_at: string | null
          cs_responsible: string | null
          current_stage: string | null
          days_overdue: number | null
          due_at: string | null
          force_unlocked: boolean | null
          is_overdue: boolean | null
          is_required: boolean | null
          item_title: string | null
          locked: boolean | null
          onboarding_status: string | null
          onboarding_type: string | null
          order_index: number | null
          progress_id: string | null
          responsible: string | null
          stage: string | null
          unlocked_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_progress_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_business_days: {
        Args: { p_days: number; p_start: string }
        Returns: string
      }
      add_business_hours: {
        Args: { p_hours: number; p_start: string }
        Returns: string
      }
      bootstrap_onboarding_locks: {
        Args: { p_client_id: string }
        Returns: undefined
      }
      can_write_clients: { Args: never; Returns: boolean }
      cancel_occurrence: {
        Args: { p_entry_id: string; p_reason: string }
        Returns: undefined
      }
      churn_metrics: { Args: { p_end: string; p_start: string }; Returns: Json }
      complete_items_by_rule: {
        Args: { p_client_id: string; p_max_month?: number; p_rule: string }
        Returns: undefined
      }
      create_interaction_with_task: {
        Args: {
          p_client_id: string
          p_create_task?: boolean
          p_demand_status: string
          p_description: string
          p_is_relevant?: boolean
          p_occurred_at?: string
          p_origin: string
          p_relevant_type?: string
          p_responsibility_origin?: string
          p_responsible: string
          p_sector: string
          p_severity?: string
          p_task_client_due_date?: string
          p_task_due_date?: string
          p_task_internal_due_date?: string
          p_task_responsible?: string
          p_task_responsible_id?: string
          p_task_time?: string
          p_task_title?: string
          p_type: string
        }
        Returns: Json
      }
      current_access_profile: { Args: never; Returns: string }
      current_internal_user_id: { Args: never; Returns: string }
      dashboard_health_counts: { Args: never; Returns: Json }
      edit_occurrence: {
        Args: {
          p_category: string
          p_description: string
          p_entry_id: string
          p_reason: string
          p_responsibility_origin: string
          p_sector: string
          p_severity: string
        }
        Returns: undefined
      }
      has_permission: { Args: { _permission: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_internal_user: { Args: never; Returns: boolean }
      is_operacional: { Args: never; Returns: boolean }
      is_viewer: { Args: never; Returns: boolean }
      is_writer: { Args: never; Returns: boolean }
      link_auth_user: { Args: never; Returns: undefined }
      occ_me: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      occurrence_action: {
        Args: { p_action: string; p_entry_id: string; p_text?: string }
        Returns: undefined
      }
      onboarding_feedback_metrics: { Args: { p_days?: number }; Returns: Json }
      onboarding_item_applies: {
        Args: { p_item_id: string; p_type: string }
        Returns: boolean
      }
      onboarding_item_due_at: {
        Args: { p_progress_id: string }
        Returns: string
      }
      onboarding_next_stage: {
        Args: { p_stage: string; p_type: string }
        Returns: string
      }
      onboarding_sla_due: {
        Args: {
          p_fallback_hours: number
          p_start: string
          p_unit: string
          p_value: number
        }
        Returns: string
      }
      onboarding_stage_sequence: { Args: { p_type: string }; Returns: string[] }
      register_operational_deviation: {
        Args: {
          p_client_charged: boolean
          p_client_charged_at: string
          p_client_id: string
          p_create_task: boolean
          p_description: string
          p_missing_info: string
          p_occurred_at: string
          p_sector: string
          p_severity: string
        }
        Returns: Json
      }
      revert_termination: {
        Args: { p_reason: string; p_termination_id: string }
        Returns: undefined
      }
      rework_metrics: {
        Args: {
          p_end: string
          p_responsible?: string
          p_sector?: string
          p_start: string
        }
        Returns: Json
      }
      seed_onboarding_stage: {
        Args: { p_client_id: string; p_locked?: boolean; p_stage: string }
        Returns: undefined
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
