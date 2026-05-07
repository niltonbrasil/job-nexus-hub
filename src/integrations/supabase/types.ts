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
      billing_items: {
        Row: {
          amount: number
          billing_id: string
          created_at: string
          demand_id: string
          execution_id: string
          hours: number
          id: string
        }
        Insert: {
          amount?: number
          billing_id: string
          created_at?: string
          demand_id: string
          execution_id: string
          hours?: number
          id?: string
        }
        Update: {
          amount?: number
          billing_id?: string
          created_at?: string
          demand_id?: string
          execution_id?: string
          hours?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_items_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_items_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_items_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "shift_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      billings: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["billing_status"]
          total_amount: number
          total_hours: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["billing_status"]
          total_amount?: number
          total_hours?: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["billing_status"]
          total_amount?: number
          total_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "billings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          contact_email: string | null
          created_at: string
          document: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          document?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          document?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_services: {
        Row: {
          contract_id: string
          created_at: string
          credits_days: number
          hours_per_day: number
          id: string
          min_workers: number
          padding_days: number
          personalization: Json
          plan_level: string
          price_per_hour: number
          rules: Json
          service_type: Database["public"]["Enums"]["service_type"]
        }
        Insert: {
          contract_id: string
          created_at?: string
          credits_days?: number
          hours_per_day?: number
          id?: string
          min_workers?: number
          padding_days?: number
          personalization?: Json
          plan_level?: string
          price_per_hour?: number
          rules?: Json
          service_type: Database["public"]["Enums"]["service_type"]
        }
        Update: {
          contract_id?: string
          created_at?: string
          credits_days?: number
          hours_per_day?: number
          id?: string
          min_workers?: number
          padding_days?: number
          personalization?: Json
          plan_level?: string
          price_per_hour?: number
          rules?: Json
          service_type?: Database["public"]["Enums"]["service_type"]
        }
        Relationships: [
          {
            foreignKeyName: "contract_services_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          client_id: string
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          client_id: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          client_id?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_logs: {
        Row: {
          action: string
          created_at: string
          demand_id: string
          id: string
          payload: Json
        }
        Insert: {
          action: string
          created_at?: string
          demand_id: string
          id?: string
          payload?: Json
        }
        Update: {
          action?: string
          created_at?: string
          demand_id?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "demand_logs_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
      }
      demands: {
        Row: {
          block_index: number
          contract_service_id: string
          created_at: string
          date: string
          end_time: string
          hours_required: number
          id: string
          job_type: Database["public"]["Enums"]["service_type"]
          parity_type: Database["public"]["Enums"]["parity_type"]
          plan_snapshot: Json
          priority: Database["public"]["Enums"]["priority_level"]
          shift_type: Database["public"]["Enums"]["shift_type"]
          slots_required: number
          start_time: string
          status: Database["public"]["Enums"]["demand_status"]
          weekend: boolean
        }
        Insert: {
          block_index?: number
          contract_service_id: string
          created_at?: string
          date: string
          end_time: string
          hours_required?: number
          id?: string
          job_type: Database["public"]["Enums"]["service_type"]
          parity_type?: Database["public"]["Enums"]["parity_type"]
          plan_snapshot?: Json
          priority?: Database["public"]["Enums"]["priority_level"]
          shift_type?: Database["public"]["Enums"]["shift_type"]
          slots_required?: number
          start_time: string
          status?: Database["public"]["Enums"]["demand_status"]
          weekend?: boolean
        }
        Update: {
          block_index?: number
          contract_service_id?: string
          created_at?: string
          date?: string
          end_time?: string
          hours_required?: number
          id?: string
          job_type?: Database["public"]["Enums"]["service_type"]
          parity_type?: Database["public"]["Enums"]["parity_type"]
          plan_snapshot?: Json
          priority?: Database["public"]["Enums"]["priority_level"]
          shift_type?: Database["public"]["Enums"]["shift_type"]
          slots_required?: number
          start_time?: string
          status?: Database["public"]["Enums"]["demand_status"]
          weekend?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "demands_contract_service_id_fkey"
            columns: ["contract_service_id"]
            isOneToOne: false
            referencedRelation: "contract_services"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_events: {
        Row: {
          execution_id: string
          id: string
          metadata: Json
          timestamp: string
          type: string
        }
        Insert: {
          execution_id: string
          id?: string
          metadata?: Json
          timestamp?: string
          type: string
        }
        Update: {
          execution_id?: string
          id?: string
          metadata?: Json
          timestamp?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_events_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "shift_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shift_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          id: string
          offer_id: string
          source: Database["public"]["Enums"]["acceptance_source"]
          status: Database["public"]["Enums"]["acceptance_status"]
          worker_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          id?: string
          offer_id: string
          source?: Database["public"]["Enums"]["acceptance_source"]
          status?: Database["public"]["Enums"]["acceptance_status"]
          worker_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          id?: string
          offer_id?: string
          source?: Database["public"]["Enums"]["acceptance_source"]
          status?: Database["public"]["Enums"]["acceptance_status"]
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_acceptances_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "shift_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_acceptances_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_executions: {
        Row: {
          acceptance_id: string
          checkin_time: string | null
          checkout_time: string | null
          created_at: string
          hours_worked: number
          id: string
          notes: string | null
          proof_data: Json
          proof_type: Database["public"]["Enums"]["proof_type"]
          status: Database["public"]["Enums"]["execution_status"]
          worked: boolean
          worker_id: string
        }
        Insert: {
          acceptance_id: string
          checkin_time?: string | null
          checkout_time?: string | null
          created_at?: string
          hours_worked?: number
          id?: string
          notes?: string | null
          proof_data?: Json
          proof_type?: Database["public"]["Enums"]["proof_type"]
          status?: Database["public"]["Enums"]["execution_status"]
          worked?: boolean
          worker_id: string
        }
        Update: {
          acceptance_id?: string
          checkin_time?: string | null
          checkout_time?: string | null
          created_at?: string
          hours_worked?: number
          id?: string
          notes?: string | null
          proof_data?: Json
          proof_type?: Database["public"]["Enums"]["proof_type"]
          status?: Database["public"]["Enums"]["execution_status"]
          worked?: boolean
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_executions_acceptance_id_fkey"
            columns: ["acceptance_id"]
            isOneToOne: false
            referencedRelation: "shift_acceptances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_executions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_offers: {
        Row: {
          created_at: string
          demand_id: string
          eligible_teams: string[]
          id: string
          opens_at: string
          slots_filled: number
          slots_total: number
          status: Database["public"]["Enums"]["offer_status"]
          visibility_rule: Json
          wave: number
        }
        Insert: {
          created_at?: string
          demand_id: string
          eligible_teams?: string[]
          id?: string
          opens_at?: string
          slots_filled?: number
          slots_total?: number
          status?: Database["public"]["Enums"]["offer_status"]
          visibility_rule?: Json
          wave?: number
        }
        Update: {
          created_at?: string
          demand_id?: string
          eligible_teams?: string[]
          id?: string
          opens_at?: string
          slots_filled?: number
          slots_total?: number
          status?: Database["public"]["Enums"]["offer_status"]
          visibility_rule?: Json
          wave?: number
        }
        Relationships: [
          {
            foreignKeyName: "shift_offers_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
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
      worker_capacity: {
        Row: {
          date: string
          id: string
          max_hours_per_day: number
          worker_id: string
        }
        Insert: {
          date: string
          id?: string
          max_hours_per_day?: number
          worker_id: string
        }
        Update: {
          date?: string
          id?: string
          max_hours_per_day?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_capacity_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_metrics: {
        Row: {
          last_updated: string
          reliability_score: number
          total_accepted: number
          total_no_show: number
          total_worked: number
          worker_id: string
        }
        Insert: {
          last_updated?: string
          reliability_score?: number
          total_accepted?: number
          total_no_show?: number
          total_worked?: number
          worker_id: string
        }
        Update: {
          last_updated?: string
          reliability_score?: number
          total_accepted?: number
          total_no_show?: number
          total_worked?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_metrics_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["worker_status"]
          team: string | null
          type: Database["public"]["Enums"]["worker_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["worker_status"]
          team?: string | null
          type?: Database["public"]["Enums"]["worker_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["worker_status"]
          team?: string | null
          type?: Database["public"]["Enums"]["worker_type"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_monthly_billing: {
        Args: { _period_start?: string }
        Returns: number
      }
      generate_shifts_for_date: { Args: { _date: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      worker_checkin: { Args: { _execution_id: string }; Returns: undefined }
      worker_checkout: {
        Args: { _execution_id: string; _hours?: number; _proof?: Json }
        Returns: undefined
      }
    }
    Enums: {
      acceptance_source: "manual" | "auto"
      acceptance_status: "accepted" | "cancelled" | "no_show"
      app_role: "admin" | "company" | "worker"
      billing_cycle: "monthly" | "weekly"
      billing_status: "open" | "closed" | "paid"
      contract_status: "active" | "paused" | "cancelled"
      demand_status:
        | "open"
        | "partially_filled"
        | "filled"
        | "completed"
        | "cancelled"
      execution_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "no_show"
        | "cancelled"
      offer_status: "open" | "closed" | "filled" | "cancelled"
      parity_type: "odd" | "even" | "none"
      priority_level: "low" | "normal" | "high"
      proof_type: "photo" | "gps" | "system" | "none"
      service_type: "chat" | "voice" | "visit"
      shift_type: "day" | "night"
      worker_status: "active" | "inactive" | "blocked"
      worker_type: "freelancer" | "internal"
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
      acceptance_source: ["manual", "auto"],
      acceptance_status: ["accepted", "cancelled", "no_show"],
      app_role: ["admin", "company", "worker"],
      billing_cycle: ["monthly", "weekly"],
      billing_status: ["open", "closed", "paid"],
      contract_status: ["active", "paused", "cancelled"],
      demand_status: [
        "open",
        "partially_filled",
        "filled",
        "completed",
        "cancelled",
      ],
      execution_status: [
        "scheduled",
        "in_progress",
        "completed",
        "no_show",
        "cancelled",
      ],
      offer_status: ["open", "closed", "filled", "cancelled"],
      parity_type: ["odd", "even", "none"],
      priority_level: ["low", "normal", "high"],
      proof_type: ["photo", "gps", "system", "none"],
      service_type: ["chat", "voice", "visit"],
      shift_type: ["day", "night"],
      worker_status: ["active", "inactive", "blocked"],
      worker_type: ["freelancer", "internal"],
    },
  },
} as const
