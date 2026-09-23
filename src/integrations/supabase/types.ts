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
      onboarding_checklist_items: {
        Row: {
          created_at: string
          description: string
          id: string
          is_required: boolean
          order_index: number
          responsible_role: string
          sla_days: number | null
          sla_hours: number | null
          stage: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_required?: boolean
          order_index: number
          responsible_role?: string
          sla_days?: number | null
          sla_hours?: number | null
          stage: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_required?: boolean
          order_index?: number
          responsible_role?: string
          sla_days?: number | null
          sla_hours?: number | null
          stage?: string
          title?: string
        }
        Relationships: []
      }
      onboarding_handoff_forms: {
        Row: {
          activity: string
          client_id: string
          created_at: string
          created_by: string | null
          employee_count: number | null
          fiscal_issues: string
          has_employees: boolean
          has_fixed_assets: string
          id: string
          next_steps: string
          nf_types: string
          notes: string
          organization_level: number | null
          pending_docs: string
          received_docs: string
          start_competency: string
          tax_regime: string
        }
        Insert: {
          activity?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          employee_count?: number | null
          fiscal_issues?: string
          has_employees?: boolean
          has_fixed_assets?: string
          id?: string
          next_steps?: string
          nf_types?: string
          notes?: string
          organization_level?: number | null
          pending_docs?: string
          received_docs?: string
          start_competency?: string
          tax_regime?: string
        }
        Update: {
          activity?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          employee_count?: number | null
          fiscal_issues?: string
          has_employees?: boolean
          has_fixed_assets?: string
          id?: string
          next_steps?: string
          nf_types?: string
          notes?: string
          organization_level?: number | null
          pending_docs?: string
          received_docs?: string
          start_competency?: string
          tax_regime?: string
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
          client_id: string
          created_at: string
          created_by: string | null
          date: string
          demand_status: string
          description: string
          id: string
          is_relevant_event: boolean
          origin: string
          relevant_event_type: string | null
          responsibility_origin: string | null
          responsible: string
          sector: string
          type: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          demand_status?: string
          description?: string
          id?: string
          is_relevant_event?: boolean
          origin?: string
          relevant_event_type?: string | null
          responsibility_origin?: string | null
          responsible?: string
          sector?: string
          type?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          demand_status?: string
          description?: string
          id?: string
          is_relevant_event?: boolean
          origin?: string
          relevant_event_type?: string | null
          responsibility_origin?: string | null
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
      bootstrap_onboarding_locks: {
        Args: { p_client_id: string }
        Returns: undefined
      }
      churn_metrics: { Args: { p_end: string; p_start: string }; Returns: Json }
      create_interaction_with_task: {
        Args: {
          p_client_id: string
          p_create_task?: boolean
          p_demand_status: string
          p_description: string
          p_is_relevant?: boolean
          p_origin: string
          p_relevant_type?: string
          p_responsibility_origin?: string
          p_responsible: string
          p_sector: string
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
      dashboard_health_counts: { Args: never; Returns: Json }
      has_permission: { Args: { _permission: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_internal_user: { Args: never; Returns: boolean }
      link_auth_user: { Args: never; Returns: undefined }
      onboarding_next_stage: {
        Args: { p_stage: string; p_type: string }
        Returns: string
      }
      onboarding_stage_sequence: { Args: { p_type: string }; Returns: string[] }
      revert_termination: {
        Args: { p_reason: string; p_termination_id: string }
        Returns: undefined
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
