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
      appointments: {
        Row: {
          barber_id: string | null
          created_at: string | null
          customer_id: string | null
          ends_at: string
          id: string
          notes: string | null
          service_id: string | null
          starts_at: string
          status: string | null
        }
        Insert: {
          barber_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          service_id?: string | null
          starts_at: string
          status?: string | null
        }
        Update: {
          barber_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          service_id?: string | null
          starts_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          active: boolean | null
          bio: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          active: boolean | null
          created_at: string | null
          end_time: string
          id: string
          lunch_end: string | null
          lunch_start: string | null
          owner_id: string
          start_time: string
          week_day: number
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          end_time: string
          id?: string
          lunch_end?: string | null
          lunch_start?: string | null
          owner_id: string
          start_time: string
          week_day: number
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          end_time?: string
          id?: string
          lunch_end?: string | null
          lunch_start?: string | null
          owner_id?: string
          start_time?: string
          week_day?: number
        }
        Relationships: []
      }
      customer_notes: {
        Row: {
          barber_id: string | null
          body: string
          created_at: string | null
          customer_id: string | null
          id: string
        }
        Insert: {
          barber_id?: string | null
          body: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
        }
        Update: {
          barber_id?: string | null
          body?: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          archived: boolean | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          last_login_at: string | null
          last_visit_at: string | null
          phone: string | null
          platform_logins: number | null
          total_spent_cents: number | null
          total_visits: number | null
          user_id: string | null
        }
        Insert: {
          archived?: boolean | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          last_login_at?: string | null
          last_visit_at?: string | null
          phone?: string | null
          platform_logins?: number | null
          total_spent_cents?: number | null
          total_visits?: number | null
          user_id?: string | null
        }
        Update: {
          archived?: boolean | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_login_at?: string | null
          last_visit_at?: string | null
          phone?: string | null
          platform_logins?: number | null
          total_spent_cents?: number | null
          total_visits?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      landing_settings: {
        Row: {
          about_barber_name: string | null
          about_description: string | null
          about_title: string | null
          address: string | null
          barber_image_url: string | null
          barber_photo_url: string | null
          barber_title: string | null
          clients_count: number | null
          created_at: string | null
          hero_button_text: string | null
          hero_highlight_word: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          instagram: string | null
          maps_link: string | null
          opening_hours: string | null
          portfolio_description: string | null
          portfolio_item_subtitle: string | null
          portfolio_title: string | null
          rating: number | null
          services_highlight_word: string | null
          services_title: string | null
          specialties: string | null
          user_id: string
          years_experience: number | null
        }
        Insert: {
          about_barber_name?: string | null
          about_description?: string | null
          about_title?: string | null
          address?: string | null
          barber_image_url?: string | null
          barber_photo_url?: string | null
          barber_title?: string | null
          clients_count?: number | null
          created_at?: string | null
          hero_button_text?: string | null
          hero_highlight_word?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          instagram?: string | null
          maps_link?: string | null
          opening_hours?: string | null
          portfolio_description?: string | null
          portfolio_item_subtitle?: string | null
          portfolio_title?: string | null
          rating?: number | null
          services_highlight_word?: string | null
          services_title?: string | null
          specialties?: string | null
          user_id: string
          years_experience?: number | null
        }
        Update: {
          about_barber_name?: string | null
          about_description?: string | null
          about_title?: string | null
          address?: string | null
          barber_image_url?: string | null
          barber_photo_url?: string | null
          barber_title?: string | null
          clients_count?: number | null
          created_at?: string | null
          hero_button_text?: string | null
          hero_highlight_word?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          instagram?: string | null
          maps_link?: string | null
          opening_hours?: string | null
          portfolio_description?: string | null
          portfolio_item_subtitle?: string | null
          portfolio_title?: string | null
          rating?: number | null
          services_highlight_word?: string | null
          services_title?: string | null
          specialties?: string | null
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      loyalty_points: {
        Row: {
          balance: number
          created_at: string | null
          customer_id: string | null
          id: string
          lifetime_earned: number
          updated_at: string | null
        }
        Insert: {
          balance?: number
          created_at?: string | null
          customer_id?: string | null
          id?: string
          lifetime_earned?: number
          updated_at?: string | null
        }
        Update: {
          balance?: number
          created_at?: string | null
          customer_id?: string | null
          id?: string
          lifetime_earned?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          is_active: boolean | null
          show_on_landing: boolean | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean | null
          show_on_landing?: boolean | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          show_on_landing?: boolean | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price_cents: number
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          name: string
          price_cents: number
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price_cents?: number
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          occurred_at: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount_cents: number
          appointment_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          occurred_at?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          occurred_at?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      barber_owner_id: { Args: { _barber_id: string }; Returns: string }
      book_appointment: {
        Args: {
          p_barber_id: string
          p_customer_id: string
          p_notes?: string
          p_service_id: string
          p_start_at: string
        }
        Returns: string
      }
      ensure_self_customer: { Args: never; Returns: string }
      get_available_slots:
        | {
            Args: { p_barber_id: string; p_date: string; p_service_id: string }
            Returns: string[]
          }
        | { Args: { p_date: string; p_service_id: string }; Returns: string[] }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      track_platform_login: {
        Args: { arg_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      payment_method:
        | "cash"
        | "pix"
        | "credit_card"
        | "debit_card"
        | "transfer"
        | "other"
      payment_status: "pending" | "paid" | "refunded" | "failed" | "cancelled"
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
      payment_method: [
        "cash",
        "pix",
        "credit_card",
        "debit_card",
        "transfer",
        "other",
      ],
      payment_status: ["pending", "paid", "refunded", "failed", "cancelled"],
    },
  },
} as const
