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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      business_settings: {
        Row: {
          address: string | null
          business_name: string
          created_at: string
          currency: string
          default_gst: number
          email: string | null
          gold_rate_per_gram: number
          gst_number: string | null
          id: string
          invoice_prefix: string
          logo_url: string | null
          phone: string | null
          silver_rate_per_gram: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_name?: string
          created_at?: string
          currency?: string
          default_gst?: number
          email?: string | null
          gold_rate_per_gram?: number
          gst_number?: string | null
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          phone?: string | null
          silver_rate_per_gram?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_name?: string
          created_at?: string
          currency?: string
          default_gst?: number
          email?: string | null
          gold_rate_per_gram?: number
          gst_number?: string | null
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          phone?: string | null
          silver_rate_per_gram?: number
          updated_at?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string
          created_by: string | null
          customer_name: string | null
          event_date: string
          event_type: string
          id: string
          notes: string | null
          order_note_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          event_date: string
          event_type: string
          id?: string
          notes?: string | null
          order_note_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          event_date?: string
          event_type?: string
          id?: string
          notes?: string | null
          order_note_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_order_note_id_fkey"
            columns: ["order_note_id"]
            isOneToOne: false
            referencedRelation: "order_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          comments: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          last_invoice_date: string | null
          name: string
          outstanding_balance: number
          phone: string | null
          total_purchases: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          comments?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          last_invoice_date?: string | null
          name: string
          outstanding_balance?: number
          phone?: string | null
          total_purchases?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          comments?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          last_invoice_date?: string | null
          name?: string
          outstanding_balance?: number
          phone?: string | null
          total_purchases?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          bill_image_url: string | null
          category: string
          created_at: string
          created_by: string | null
          expense_date: string
          id: string
          notes: string | null
          payment_mode: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bill_image_url?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_mode?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bill_image_url?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_mode?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          category: string | null
          created_at: string
          discount: number
          discounted_making: number
          gold_value: number
          gst_amount: number
          gst_percentage: number
          id: string
          invoice_id: string
          making_charges: number
          mrp: number
          product_id: string | null
          product_name: string
          quantity: number
          rate_per_gram: number
          subtotal: number
          total: number
          weight_grams: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          discount?: number
          discounted_making?: number
          gold_value?: number
          gst_amount?: number
          gst_percentage?: number
          id?: string
          invoice_id: string
          making_charges?: number
          mrp?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          rate_per_gram?: number
          subtotal?: number
          total?: number
          weight_grams?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          discount?: number
          discounted_making?: number
          gold_value?: number
          gst_amount?: number
          gst_percentage?: number
          id?: string
          invoice_id?: string
          making_charges?: number
          mrp?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          rate_per_gram?: number
          subtotal?: number
          total?: number
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          discount_amount: number
          grand_total: number
          gst_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_mode: string | null
          payment_status: string
          sent_at: string | null
          status: string
          subtotal: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          grand_total?: number
          gst_amount?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payment_mode?: string | null
          payment_status?: string
          sent_at?: string | null
          status?: string
          subtotal?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          grand_total?: number
          gst_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_mode?: string | null
          payment_status?: string
          sent_at?: string | null
          status?: string
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      order_note_items: {
        Row: {
          created_at: string
          customization_notes: string | null
          expected_price: number | null
          id: string
          item_description: string
          order_note_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          customization_notes?: string | null
          expected_price?: number | null
          id?: string
          item_description: string
          order_note_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          customization_notes?: string | null
          expected_price?: number | null
          id?: string
          item_description?: string
          order_note_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_note_items_order_note_id_fkey"
            columns: ["order_note_id"]
            isOneToOne: false
            referencedRelation: "order_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          address: string | null
          advance_received: number | null
          balance: number | null
          created_at: string
          created_by: string | null
          customer_name: string
          delivery_type: Database["public"]["Enums"]["delivery_type"] | null
          expected_delivery_date: string | null
          handled_by: string | null
          id: string
          order_date: string
          order_reference: string
          payment_mode: string | null
          phone_number: string | null
          quoted_estimate: number | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_note_status"] | null
          time_slot: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          advance_received?: number | null
          balance?: number | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          expected_delivery_date?: string | null
          handled_by?: string | null
          id?: string
          order_date?: string
          order_reference: string
          payment_mode?: string | null
          phone_number?: string | null
          quoted_estimate?: number | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_note_status"] | null
          time_slot?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          advance_received?: number | null
          balance?: number | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          expected_delivery_date?: string | null
          handled_by?: string | null
          id?: string
          order_date?: string
          order_reference?: string
          payment_mode?: string | null
          phone_number?: string | null
          quoted_estimate?: number | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_note_status"] | null
          time_slot?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          bangle_size: string | null
          category_id: string | null
          created_at: string
          date_ordered: string | null
          description: string | null
          gst_percentage: number
          id: string
          image_url: string | null
          low_stock_alert: number
          making_charges: number
          metal_type: string | null
          mrp: number | null
          name: string
          price_per_gram: number | null
          pricing_mode: string
          purchase_making_charges: number | null
          purchase_price: number
          purchase_price_per_gram: number | null
          purity: string | null
          quantity: number
          selling_price: number
          sku: string
          status: string | null
          supplier_id: string | null
          type_of_work: string | null
          updated_at: string
          weight_grams: number
        }
        Insert: {
          bangle_size?: string | null
          category_id?: string | null
          created_at?: string
          date_ordered?: string | null
          description?: string | null
          gst_percentage?: number
          id?: string
          image_url?: string | null
          low_stock_alert?: number
          making_charges?: number
          metal_type?: string | null
          mrp?: number | null
          name: string
          price_per_gram?: number | null
          pricing_mode?: string
          purchase_making_charges?: number | null
          purchase_price?: number
          purchase_price_per_gram?: number | null
          purity?: string | null
          quantity?: number
          selling_price?: number
          sku: string
          status?: string | null
          supplier_id?: string | null
          type_of_work?: string | null
          updated_at?: string
          weight_grams?: number
        }
        Update: {
          bangle_size?: string | null
          category_id?: string | null
          created_at?: string
          date_ordered?: string | null
          description?: string | null
          gst_percentage?: number
          id?: string
          image_url?: string | null
          low_stock_alert?: number
          making_charges?: number
          metal_type?: string | null
          mrp?: number | null
          name?: string
          price_per_gram?: number | null
          pricing_mode?: string
          purchase_making_charges?: number | null
          purchase_price?: number
          purchase_price_per_gram?: number | null
          purity?: string | null
          quantity?: number
          selling_price?: number
          sku?: string
          status?: string | null
          supplier_id?: string | null
          type_of_work?: string | null
          updated_at?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_history: {
        Row: {
          changed_by: string | null
          created_at: string
          gold_rate_per_gram: number
          id: string
          silver_rate_per_gram: number
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          gold_rate_per_gram: number
          id?: string
          silver_rate_per_gram: number
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          gold_rate_per_gram?: number
          id?: string
          silver_rate_per_gram?: number
        }
        Relationships: []
      }
      stock_history: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity_change: number
          reason: string | null
          reference_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity_change: number
          reason?: string | null
          reference_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity_change?: number
          reason?: string | null
          reference_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          last_purchase_date: string | null
          name: string
          notes: string | null
          outstanding_balance: number
          phone: string | null
          total_paid: number
          total_purchases: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          last_purchase_date?: string | null
          name: string
          notes?: string | null
          outstanding_balance?: number
          phone?: string | null
          total_paid?: number
          total_purchases?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          last_purchase_date?: string | null
          name?: string
          notes?: string | null
          outstanding_balance?: number
          phone?: string | null
          total_paid?: number
          total_purchases?: number
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
          role?: Database["public"]["Enums"]["app_role"]
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
      vendor_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_mode: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invoice_number: { Args: never; Returns: string }
      generate_order_reference: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      upsert_client_on_invoice: {
        Args: { p_amount: number; p_name: string; p_phone: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      delivery_type: "pickup" | "home_delivery"
      order_note_status:
        | "order_noted"
        | "design_approved"
        | "in_production"
        | "ready"
        | "delivered"
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
      app_role: ["admin", "staff"],
      delivery_type: ["pickup", "home_delivery"],
      order_note_status: [
        "order_noted",
        "design_approved",
        "in_production",
        "ready",
        "delivered",
      ],
    },
  },
} as const
