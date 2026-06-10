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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          module: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          record_label: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          module: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          record_label?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          module?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          record_label?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      backups: {
        Row: {
          backup_type: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          file_path: string | null
          file_size: number | null
          id: string
          notes: string | null
          status: string
          tables_included: Json | null
        }
        Insert: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          notes?: string | null
          status?: string
          tables_included?: Json | null
        }
        Update: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          notes?: string | null
          status?: string
          tables_included?: Json | null
        }
        Relationships: []
      }
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
      buybacks: {
        Row: {
          client_id: string | null
          created_at: string
          destination: string
          id: string
          invoice_ref: string | null
          metal_type: string | null
          notes: string | null
          rate_used: number
          reason: string | null
          round_off: number
          total_credits_added: number
          type: string
          weight: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          destination?: string
          id?: string
          invoice_ref?: string | null
          metal_type?: string | null
          notes?: string | null
          rate_used?: number
          reason?: string | null
          round_off?: number
          total_credits_added?: number
          type: string
          weight?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          destination?: string
          id?: string
          invoice_ref?: string | null
          metal_type?: string | null
          notes?: string | null
          rate_used?: number
          reason?: string | null
          round_off?: number
          total_credits_added?: number
          type?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "buybacks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      client_schemes: {
        Row: {
          amount_paid: number
          client_id: string
          created_at: string
          duration_months: number
          id: string
          monthly_amount: number
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          client_id: string
          created_at?: string
          duration_months?: number
          id?: string
          monthly_amount?: number
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          client_id?: string
          created_at?: string
          duration_months?: number
          id?: string
          monthly_amount?: number
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_schemes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          polish_total_allowed: number
          polish_used: number
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
          polish_total_allowed?: number
          polish_used?: number
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
          polish_total_allowed?: number
          polish_used?: number
          total_purchases?: number
          updated_at?: string
        }
        Relationships: []
      }
      custom_order_components: {
        Row: {
          component_name: string
          created_at: string
          custom_order_id: string
          id: string
          material: string | null
          quantity: number
          rate_per_gram: number
          total: number
          unit_price: number
          weight_grams: number
        }
        Insert: {
          component_name: string
          created_at?: string
          custom_order_id: string
          id?: string
          material?: string | null
          quantity?: number
          rate_per_gram?: number
          total?: number
          unit_price?: number
          weight_grams?: number
        }
        Update: {
          component_name?: string
          created_at?: string
          custom_order_id?: string
          id?: string
          material?: string | null
          quantity?: number
          rate_per_gram?: number
          total?: number
          unit_price?: number
          weight_grams?: number
        }
        Relationships: []
      }
      custom_order_items: {
        Row: {
          base_price: number
          category: string | null
          created_at: string
          custom_order_id: string
          customization_notes: string | null
          discount: number
          discount_on_mc: number | null
          discount_type: string
          discount_value: number
          expected_weight: number | null
          flat_price: number | null
          id: string
          item_description: string
          item_total: number
          mc_amount: number
          mc_per_gram: number | null
          pricing_mode: string
          product_id: string | null
          quantity: number
          rate_per_gram: number | null
          reference_image_url: string | null
          sku: string | null
        }
        Insert: {
          base_price?: number
          category?: string | null
          created_at?: string
          custom_order_id: string
          customization_notes?: string | null
          discount?: number
          discount_on_mc?: number | null
          discount_type?: string
          discount_value?: number
          expected_weight?: number | null
          flat_price?: number | null
          id?: string
          item_description: string
          item_total?: number
          mc_amount?: number
          mc_per_gram?: number | null
          pricing_mode?: string
          product_id?: string | null
          quantity?: number
          rate_per_gram?: number | null
          reference_image_url?: string | null
          sku?: string | null
        }
        Update: {
          base_price?: number
          category?: string | null
          created_at?: string
          custom_order_id?: string
          customization_notes?: string | null
          discount?: number
          discount_on_mc?: number | null
          discount_type?: string
          discount_value?: number
          expected_weight?: number | null
          flat_price?: number | null
          id?: string
          item_description?: string
          item_total?: number
          mc_amount?: number
          mc_per_gram?: number | null
          pricing_mode?: string
          product_id?: string | null
          quantity?: number
          rate_per_gram?: number | null
          reference_image_url?: string | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_order_items_custom_order_id_fkey"
            columns: ["custom_order_id"]
            isOneToOne: false
            referencedRelation: "custom_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_orders: {
        Row: {
          additional_charge: number
          additional_charge_label: string | null
          client_name: string
          components_total: number
          components_weight: number
          converted_to_invoice_id: string | null
          created_at: string
          created_by: string | null
          design_charges: number
          expected_delivery_date: string | null
          flat_discount: number
          gst_percentage: number
          id: string
          notes: string | null
          order_date: string
          phone_number: string | null
          reference_number: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          additional_charge?: number
          additional_charge_label?: string | null
          client_name: string
          components_total?: number
          components_weight?: number
          converted_to_invoice_id?: string | null
          created_at?: string
          created_by?: string | null
          design_charges?: number
          expected_delivery_date?: string | null
          flat_discount?: number
          gst_percentage?: number
          id?: string
          notes?: string | null
          order_date?: string
          phone_number?: string | null
          reference_number: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          additional_charge?: number
          additional_charge_label?: string | null
          client_name?: string
          components_total?: number
          components_weight?: number
          converted_to_invoice_id?: string | null
          created_at?: string
          created_by?: string | null
          design_charges?: number
          expected_delivery_date?: string | null
          flat_discount?: number
          gst_percentage?: number
          id?: string
          notes?: string | null
          order_date?: string
          phone_number?: string | null
          reference_number?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_orders_converted_to_invoice_id_fkey"
            columns: ["converted_to_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachment_url: string | null
          bill_image_url: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          edit_reason: string | null
          expense_date: string
          expense_type: string
          id: string
          invoice_number: string | null
          notes: string | null
          paid_to_name: string | null
          paid_to_phone: string | null
          payment_mode: string | null
          product_name: string | null
          quantity: number | null
          sku: string | null
          supplier_name: string | null
          updated_at: string
          updated_by: string | null
          weight_grams: number | null
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          bill_image_url?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          edit_reason?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_to_name?: string | null
          paid_to_phone?: string | null
          payment_mode?: string | null
          product_name?: string | null
          quantity?: number | null
          sku?: string | null
          supplier_name?: string | null
          updated_at?: string
          updated_by?: string | null
          weight_grams?: number | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          bill_image_url?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          edit_reason?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_to_name?: string | null
          paid_to_phone?: string | null
          payment_mode?: string | null
          product_name?: string | null
          quantity?: number | null
          sku?: string | null
          supplier_name?: string | null
          updated_at?: string
          updated_by?: string | null
          weight_grams?: number | null
        }
        Relationships: []
      }
      hidden_sold_entries: {
        Row: {
          created_at: string
          created_by: string | null
          entry_key: string
          source: string
          source_ref: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_key: string
          source: string
          source_ref?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_key?: string
          source?: string
          source_ref?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
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
          description?: string | null
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
          description?: string | null
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
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_mode: string
          receipt_number: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          receipt_number: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          receipt_number?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          advance_paid: number
          amount_after_credits: number
          amount_paid_via_mode: number
          balance_due: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string | null
          client_source: string | null
          combined_payment_label: string | null
          created_at: string
          created_by: string | null
          discount_amount: number
          grand_total: number
          gst_amount: number
          gst_mode: string
          gst_percentage: number
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_amount_1: number
          payment_amount_2: number
          payment_mode: string | null
          payment_mode_1: string | null
          payment_mode_2: string | null
          payment_mode_for_remaining: string | null
          payment_status: string
          round_off: number
          sent_at: string | null
          status: string
          store_credits_used: number
          store_id: string | null
          subtotal: number
          total_paid: number
          updated_at: string
        }
        Insert: {
          advance_paid?: number
          amount_after_credits?: number
          amount_paid_via_mode?: number
          balance_due?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string | null
          client_source?: string | null
          combined_payment_label?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          grand_total?: number
          gst_amount?: number
          gst_mode?: string
          gst_percentage?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payment_amount_1?: number
          payment_amount_2?: number
          payment_mode?: string | null
          payment_mode_1?: string | null
          payment_mode_2?: string | null
          payment_mode_for_remaining?: string | null
          payment_status?: string
          round_off?: number
          sent_at?: string | null
          status?: string
          store_credits_used?: number
          store_id?: string | null
          subtotal?: number
          total_paid?: number
          updated_at?: string
        }
        Update: {
          advance_paid?: number
          amount_after_credits?: number
          amount_paid_via_mode?: number
          balance_due?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string | null
          client_source?: string | null
          combined_payment_label?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          grand_total?: number
          gst_amount?: number
          gst_mode?: string
          gst_percentage?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_amount_1?: number
          payment_amount_2?: number
          payment_mode?: string | null
          payment_mode_1?: string | null
          payment_mode_2?: string | null
          payment_mode_for_remaining?: string | null
          payment_status?: string
          round_off?: number
          sent_at?: string | null
          status?: string
          store_credits_used?: number
          store_id?: string | null
          subtotal?: number
          total_paid?: number
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
          {
            foreignKeyName: "invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_sold_items: {
        Row: {
          client_name: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string | null
          product_name: string
          quantity: number
          sku: string | null
          sold_date: string
          total: number
          weight_grams: number
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          sku?: string | null
          sold_date?: string
          total?: number
          weight_grams?: number
        }
        Update: {
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string | null
          sold_date?: string
          total?: number
          weight_grams?: number
        }
        Relationships: []
      }
      order_note_items: {
        Row: {
          created_at: string
          customization_notes: string | null
          expected_price: number | null
          id: string
          image_url: string | null
          item_description: string
          order_note_id: string
          quantity: number
          service_type: string | null
        }
        Insert: {
          created_at?: string
          customization_notes?: string | null
          expected_price?: number | null
          id?: string
          image_url?: string | null
          item_description: string
          order_note_id: string
          quantity?: number
          service_type?: string | null
        }
        Update: {
          created_at?: string
          customization_notes?: string | null
          expected_price?: number | null
          id?: string
          image_url?: string | null
          item_description?: string
          order_note_id?: string
          quantity?: number
          service_type?: string | null
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
      order_note_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_note_id: string
          payment_date: string
          payment_mode: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_note_id: string
          payment_date?: string
          payment_mode?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_note_id?: string
          payment_date?: string
          payment_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_note_payments_order_note_id_fkey"
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
          service_type: string | null
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
          service_type?: string | null
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
          service_type?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_note_status"] | null
          time_slot?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_store_quantities: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_store_quantities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_store_quantities_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          bangle_size: string | null
          category_id: string | null
          created_at: string
          date_ordered: string | null
          deleted_at: string | null
          description: string | null
          gst_percentage: number
          id: string
          image_url: string | null
          locked_by_custom_order_id: string | null
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
          deleted_at?: string | null
          description?: string | null
          gst_percentage?: number
          id?: string
          image_url?: string | null
          locked_by_custom_order_id?: string | null
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
          deleted_at?: string | null
          description?: string | null
          gst_percentage?: number
          id?: string
          image_url?: string | null
          locked_by_custom_order_id?: string | null
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
            foreignKeyName: "products_locked_by_custom_order_id_fkey"
            columns: ["locked_by_custom_order_id"]
            isOneToOne: false
            referencedRelation: "custom_orders"
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
      repair_items: {
        Row: {
          amount_credited: number | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          created_by: string | null
          date_resolved: string | null
          date_sent: string
          id: string
          metal_type: string | null
          notes: string | null
          original_invoice_id: string | null
          original_invoice_number: string | null
          product_id: string | null
          product_name: string
          quantity: number
          rate_used: number | null
          sku: string | null
          source: string
          source_ref_id: string | null
          source_reference_id: string | null
          source_type: string | null
          status: string
          updated_at: string
          weight_grams: number
        }
        Insert: {
          amount_credited?: number | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          date_resolved?: string | null
          date_sent?: string
          id?: string
          metal_type?: string | null
          notes?: string | null
          original_invoice_id?: string | null
          original_invoice_number?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          rate_used?: number | null
          sku?: string | null
          source: string
          source_ref_id?: string | null
          source_reference_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          weight_grams?: number
        }
        Update: {
          amount_credited?: number | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          date_resolved?: string | null
          date_sent?: string
          id?: string
          metal_type?: string | null
          notes?: string | null
          original_invoice_id?: string | null
          original_invoice_number?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          rate_used?: number | null
          sku?: string | null
          source?: string
          source_ref_id?: string | null
          source_reference_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      return_exchange_items: {
        Row: {
          category: string | null
          created_at: string
          direction: string
          discount: number
          gst_amount: number
          gst_percentage: number
          id: string
          line_total: number
          making_charges: number
          product_id: string | null
          product_name: string
          quantity: number
          rate_per_gram: number
          return_exchange_id: string
          sku: string | null
          total: number
          weight_grams: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          direction: string
          discount?: number
          gst_amount?: number
          gst_percentage?: number
          id?: string
          line_total?: number
          making_charges?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          rate_per_gram?: number
          return_exchange_id: string
          sku?: string | null
          total?: number
          weight_grams?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          direction?: string
          discount?: number
          gst_amount?: number
          gst_percentage?: number
          id?: string
          line_total?: number
          making_charges?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          rate_per_gram?: number
          return_exchange_id?: string
          sku?: string | null
          total?: number
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_exchange_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_exchange_items_return_exchange_id_fkey"
            columns: ["return_exchange_id"]
            isOneToOne: false
            referencedRelation: "return_exchanges"
            referencedColumns: ["id"]
          },
        ]
      }
      return_exchanges: {
        Row: {
          additional_charge: number
          buyback_kind: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          created_by: string | null
          disposition: string
          id: string
          live_rate_used: number | null
          metal_type: string | null
          notes: string | null
          original_invoice_id: string | null
          original_invoice_number: string | null
          payment_mode: string | null
          reason: string | null
          reference_number: string
          refund_amount: number
          refund_method: string
          round_off: number
          store_id: string | null
          subtype: string | null
          total_weight: number
          type: string
          updated_at: string
        }
        Insert: {
          additional_charge?: number
          buyback_kind?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          disposition?: string
          id?: string
          live_rate_used?: number | null
          metal_type?: string | null
          notes?: string | null
          original_invoice_id?: string | null
          original_invoice_number?: string | null
          payment_mode?: string | null
          reason?: string | null
          reference_number: string
          refund_amount?: number
          refund_method?: string
          round_off?: number
          store_id?: string | null
          subtype?: string | null
          total_weight?: number
          type: string
          updated_at?: string
        }
        Update: {
          additional_charge?: number
          buyback_kind?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          disposition?: string
          id?: string
          live_rate_used?: number | null
          metal_type?: string | null
          notes?: string | null
          original_invoice_id?: string | null
          original_invoice_number?: string | null
          payment_mode?: string | null
          reason?: string | null
          reference_number?: string
          refund_amount?: number
          refund_method?: string
          round_off?: number
          store_id?: string | null
          subtype?: string | null
          total_weight?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_exchanges_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_exchanges_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_forms: {
        Row: {
          client_id: string | null
          client_name: string
          client_phone: string | null
          completed_at: string | null
          completed_invoice_id: string | null
          condition_on_receipt: string | null
          created_at: string
          created_by: string | null
          estimated_cost: number
          estimated_delivery_date: string | null
          final_cost: number
          from_our_shop: boolean
          id: string
          item_description: string
          material: string | null
          original_invoice_no: string | null
          other_service_text: string | null
          photo_url: string | null
          receipt_number: string
          service_notes: string | null
          service_types: string[]
          status: string
          updated_at: string
          weight_grams: number
        }
        Insert: {
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          completed_at?: string | null
          completed_invoice_id?: string | null
          condition_on_receipt?: string | null
          created_at?: string
          created_by?: string | null
          estimated_cost?: number
          estimated_delivery_date?: string | null
          final_cost?: number
          from_our_shop?: boolean
          id?: string
          item_description: string
          material?: string | null
          original_invoice_no?: string | null
          other_service_text?: string | null
          photo_url?: string | null
          receipt_number: string
          service_notes?: string | null
          service_types?: string[]
          status?: string
          updated_at?: string
          weight_grams?: number
        }
        Update: {
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          completed_at?: string | null
          completed_invoice_id?: string | null
          condition_on_receipt?: string | null
          created_at?: string
          created_by?: string | null
          estimated_cost?: number
          estimated_delivery_date?: string | null
          final_cost?: number
          from_our_shop?: boolean
          id?: string
          item_description?: string
          material?: string | null
          original_invoice_no?: string | null
          other_service_text?: string | null
          photo_url?: string | null
          receipt_number?: string
          service_notes?: string | null
          service_types?: string[]
          status?: string
          updated_at?: string
          weight_grams?: number
        }
        Relationships: []
      }
      stock_deduction_blocks: {
        Row: {
          attempted_by: string | null
          attempted_quantity: number
          created_at: string
          current_stock: number | null
          id: string
          invoice_id: string | null
          invoice_number: string | null
          invoice_status: string | null
          product_id: string | null
          product_name: string | null
          reason: string
        }
        Insert: {
          attempted_by?: string | null
          attempted_quantity?: number
          created_at?: string
          current_stock?: number | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          invoice_status?: string | null
          product_id?: string | null
          product_name?: string | null
          reason: string
        }
        Update: {
          attempted_by?: string | null
          attempted_quantity?: number
          created_at?: string
          current_stock?: number | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          invoice_status?: string | null
          product_id?: string | null
          product_name?: string | null
          reason?: string
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
      stock_transfers: {
        Row: {
          created_at: string
          from_store_id: string
          id: string
          product_id: string
          quantity: number
          reason: string | null
          to_store_id: string
          transferred_by: string | null
        }
        Insert: {
          created_at?: string
          from_store_id: string
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          to_store_id: string
          transferred_by?: string | null
        }
        Update: {
          created_at?: string
          from_store_id?: string
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          to_store_id?: string
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_store_id_fkey"
            columns: ["from_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_store_id_fkey"
            columns: ["to_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_wallets: {
        Row: {
          balance: number
          client_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          client_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          client_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          invoice_prefix: string
          is_active: boolean
          is_default: boolean
          phone: string | null
          store_name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          invoice_prefix?: string
          is_active?: boolean
          is_default?: boolean
          phone?: string | null
          store_name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          invoice_prefix?: string
          is_active?: boolean
          is_default?: boolean
          phone?: string | null
          store_name?: string
          updated_at?: string
        }
        Relationships: []
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
          vendor_code: string | null
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
          vendor_code?: string | null
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
          vendor_code?: string | null
        }
        Relationships: []
      }
      types_of_work: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
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
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          reference_id: string | null
          reference_label: string | null
          source: string
          type: string
        }
        Insert: {
          amount?: number
          balance_after?: number | null
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_label?: string | null
          source: string
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_label?: string | null
          source?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_wallet_balance: {
        Args: {
          p_client_id: string
          p_delta: number
          p_notes: string
          p_reference_id: string
          p_reference_label: string
          p_source: string
          p_type: string
        }
        Returns: number
      }
      generate_custom_order_reference: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_order_reference: { Args: never; Returns: string }
      generate_receipt_number: { Args: never; Returns: string }
      generate_return_exchange_reference: {
        Args: { p_type: string }
        Returns: string
      }
      generate_service_receipt_number: { Args: never; Returns: string }
      generate_store_invoice_number: {
        Args: { p_store_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      process_buyback: {
        Args: {
          p_client_id: string
          p_destination?: string
          p_invoice_id?: string
          p_invoice_number?: string
          p_items?: Json
          p_kind?: string
          p_metal_type?: string
          p_notes?: string
          p_rate_used?: number
          p_reason?: string
          p_round_off?: number
          p_total_credits_added?: number
          p_weight?: number
        }
        Returns: Json
      }
      transfer_stock: {
        Args: {
          p_from_store_id: string
          p_product_id: string
          p_quantity: number
          p_reason?: string
          p_to_store_id: string
        }
        Returns: string
      }
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
