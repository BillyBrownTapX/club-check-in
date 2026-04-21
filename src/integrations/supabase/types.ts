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
      attendance_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["attendance_action_type"]
          attendance_record_id: string | null
          created_at: string
          event_id: string
          host_id: string
          id: string
          notes: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["attendance_action_type"]
          attendance_record_id?: string | null
          created_at?: string
          event_id: string
          host_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["attendance_action_type"]
          attendance_record_id?: string | null
          created_at?: string
          event_id?: string
          host_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_actions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_actions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_actions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "host_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          check_in_method: Database["public"]["Enums"]["check_in_method"]
          check_in_source: Database["public"]["Enums"]["check_in_source"]
          checked_in_at: string
          created_at: string
          event_id: string
          id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          check_in_method?: Database["public"]["Enums"]["check_in_method"]
          check_in_source?: Database["public"]["Enums"]["check_in_source"]
          checked_in_at?: string
          created_at?: string
          event_id: string
          id?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          check_in_method?: Database["public"]["Enums"]["check_in_method"]
          check_in_source?: Database["public"]["Enums"]["check_in_source"]
          checked_in_at?: string
          created_at?: string
          event_id?: string
          id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          club_name: string
          club_slug: string
          created_at: string
          description: string | null
          host_id: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          club_name: string
          club_slug: string
          created_at?: string
          description?: string | null
          host_id: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          club_name?: string
          club_slug?: string
          created_at?: string
          description?: string | null
          host_id?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "host_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_templates: {
        Row: {
          club_id: string
          created_at: string
          default_check_in_close_offset_minutes: number
          default_check_in_open_offset_minutes: number
          default_end_time: string | null
          default_event_name: string | null
          default_location: string | null
          default_start_time: string | null
          id: string
          template_name: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          default_check_in_close_offset_minutes?: number
          default_check_in_open_offset_minutes?: number
          default_end_time?: string | null
          default_event_name?: string | null
          default_location?: string | null
          default_start_time?: string | null
          id?: string
          template_name: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          default_check_in_close_offset_minutes?: number
          default_check_in_open_offset_minutes?: number
          default_end_time?: string | null
          default_event_name?: string | null
          default_location?: string | null
          default_start_time?: string | null
          id?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_templates_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          check_in_closes_at: string
          check_in_opens_at: string
          club_id: string
          created_at: string
          end_time: string
          event_date: string
          event_name: string
          event_template_id: string | null
          id: string
          is_active: boolean
          is_archived: boolean
          location: string | null
          qr_token: string
          start_time: string
          updated_at: string
        }
        Insert: {
          check_in_closes_at: string
          check_in_opens_at: string
          club_id: string
          created_at?: string
          end_time: string
          event_date: string
          event_name: string
          event_template_id?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          location?: string | null
          qr_token: string
          start_time: string
          updated_at?: string
        }
        Update: {
          check_in_closes_at?: string
          check_in_opens_at?: string
          club_id?: string
          created_at?: string
          end_time?: string
          event_date?: string
          event_name?: string
          event_template_id?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          location?: string | null
          qr_token?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_event_template_id_fkey"
            columns: ["event_template_id"]
            isOneToOne: false
            referencedRelation: "event_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      host_profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      student_device_sessions: {
        Row: {
          created_at: string
          device_token: string
          id: string
          last_used_at: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_token: string
          id?: string
          last_used_at?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_token?: string
          id?: string
          last_used_at?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_device_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          first_name: string
          id: string
          last_name: string
          nine_hundred_number: string
          student_email: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          nine_hundred_number: string
          student_email: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          nine_hundred_number?: string
          student_email?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_event_host: { Args: { _event_id: string }; Returns: boolean }
      is_student_visible_to_host: {
        Args: { _student_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      attendance_action_type: "removed" | "restored" | "note"
      check_in_method:
        | "qr_scan"
        | "returning_lookup"
        | "remembered_device"
        | "host_correction"
      check_in_source: "public_mobile" | "host_dashboard"
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
      app_role: ["admin", "moderator", "user"],
      attendance_action_type: ["removed", "restored", "note"],
      check_in_method: [
        "qr_scan",
        "returning_lookup",
        "remembered_device",
        "host_correction",
      ],
      check_in_source: ["public_mobile", "host_dashboard"],
    },
  },
} as const
