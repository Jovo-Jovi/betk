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
  betk: {
    Tables: {
      addresses: {
        Row: {
          building_notes: string | null
          buyer_id: string
          city: string
          created_at: string
          governorate: string
          id: string
          is_default: boolean
          label: string | null
          street_address: string
        }
        Insert: {
          building_notes?: string | null
          buyer_id: string
          city: string
          created_at?: string
          governorate: string
          id?: string
          is_default?: boolean
          label?: string | null
          street_address: string
        }
        Update: {
          building_notes?: string | null
          buyer_id?: string
          city?: string
          created_at?: string
          governorate?: string
          id?: string
          is_default?: boolean
          label?: string | null
          street_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      boost_packages: {
        Row: {
          duration_hours: number
          id: string
          is_active: boolean
          name: string
          price_egp: number
          sort_order: number
        }
        Insert: {
          duration_hours: number
          id?: string
          is_active?: boolean
          name: string
          price_egp: number
          sort_order?: number
        }
        Update: {
          duration_hours?: number
          id?: string
          is_active?: boolean
          name?: string
          price_egp?: number
          sort_order?: number
        }
        Relationships: []
      }
      boosts: {
        Row: {
          amount_paid: number
          created_at: string
          expires_at: string | null
          id: string
          listing_id: string
          package_id: string
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_method: Database["betk"]["Enums"]["payout_method"]
          starts_at: string | null
          status: Database["betk"]["Enums"]["boost_status"]
          store_id: string
          views_during_boost: number
        }
        Insert: {
          amount_paid: number
          created_at?: string
          expires_at?: string | null
          id?: string
          listing_id: string
          package_id: string
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_method: Database["betk"]["Enums"]["payout_method"]
          starts_at?: string | null
          status?: Database["betk"]["Enums"]["boost_status"]
          store_id: string
          views_during_boost?: number
        }
        Update: {
          amount_paid?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          listing_id?: string
          package_id?: string
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_method?: Database["betk"]["Enums"]["payout_method"]
          starts_at?: string | null
          status?: Database["betk"]["Enums"]["boost_status"]
          store_id?: string
          views_during_boost?: number
        }
        Relationships: [
          {
            foreignKeyName: "boosts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boosts_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "boost_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boosts_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boosts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_profiles: {
        Row: {
          city: string | null
          full_name: string
          governorate: string
          id: string
          interests: Json
          notification_prefs: Json
        }
        Insert: {
          city?: string | null
          full_name: string
          governorate: string
          id: string
          interests?: Json
          notification_prefs?: Json
        }
        Update: {
          city?: string | null
          full_name?: string
          governorate?: string
          id?: string
          interests?: Json
          notification_prefs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "buyer_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          icon_url: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number
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
      collection_listings: {
        Row: {
          added_at: string
          collection_id: string
          id: string
          listing_id: string
          sort_order: number
        }
        Insert: {
          added_at?: string
          collection_id: string
          id?: string
          listing_id: string
          sort_order: number
        }
        Update: {
          added_at?: string
          collection_id?: string
          id?: string
          listing_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_listings_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          archive_at: string | null
          created_at: string
          created_by: string
          description_ar: string | null
          homepage_position: number
          id: string
          name_ar: string
          name_en: string | null
          publish_at: string | null
          status: Database["betk"]["Enums"]["collection_status"]
          updated_at: string
        }
        Insert: {
          archive_at?: string | null
          created_at?: string
          created_by: string
          description_ar?: string | null
          homepage_position: number
          id?: string
          name_ar: string
          name_en?: string | null
          publish_at?: string | null
          status?: Database["betk"]["Enums"]["collection_status"]
          updated_at?: string
        }
        Update: {
          archive_at?: string | null
          created_at?: string
          created_by?: string
          description_ar?: string | null
          homepage_position?: number
          id?: string
          name_ar?: string
          name_en?: string | null
          publish_at?: string | null
          status?: Database["betk"]["Enums"]["collection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_evidence: {
        Row: {
          description: string | null
          dispute_id: string
          id: string
          uploaded_at: string
          url: string
        }
        Insert: {
          description?: string | null
          dispute_id: string
          id?: string
          uploaded_at?: string
          url: string
        }
        Update: {
          description?: string | null
          dispute_id?: string
          id?: string
          uploaded_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_messages: {
        Row: {
          body: string
          dispute_id: string
          id: string
          is_read: boolean
          sender_id: string
          sender_type: Database["betk"]["Enums"]["sender_type"]
          sent_at: string
        }
        Insert: {
          body: string
          dispute_id: string
          id?: string
          is_read?: boolean
          sender_id: string
          sender_type: Database["betk"]["Enums"]["sender_type"]
          sent_at?: string
        }
        Update: {
          body?: string
          dispute_id?: string
          id?: string
          is_read?: boolean
          sender_id?: string
          sender_type?: Database["betk"]["Enums"]["sender_type"]
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          assigned_to: string | null
          buyer_id: string
          created_at: string
          description: string | null
          id: string
          order_id: string
          reason: Database["betk"]["Enums"]["dispute_reason"]
          resolution: Database["betk"]["Enums"]["dispute_resolution"] | null
          resolution_notes: string | null
          resolved_at: string | null
          sla_deadline: string
          status: Database["betk"]["Enums"]["dispute_status"]
          store_id: string
        }
        Insert: {
          assigned_to?: string | null
          buyer_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_id: string
          reason: Database["betk"]["Enums"]["dispute_reason"]
          resolution?: Database["betk"]["Enums"]["dispute_resolution"] | null
          resolution_notes?: string | null
          resolved_at?: string | null
          sla_deadline: string
          status?: Database["betk"]["Enums"]["dispute_status"]
          store_id: string
        }
        Update: {
          assigned_to?: string | null
          buyer_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string
          reason?: Database["betk"]["Enums"]["dispute_reason"]
          resolution?: Database["betk"]["Enums"]["dispute_resolution"] | null
          resolution_notes?: string | null
          resolved_at?: string | null
          sla_deadline?: string
          status?: Database["betk"]["Enums"]["dispute_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      flagged_content: {
        Row: {
          content_id: string
          content_type: Database["betk"]["Enums"]["content_type"]
          created_at: string
          id: string
          notes: string | null
          reason: Database["betk"]["Enums"]["flag_reason"]
          reported_by: string | null
          reporter_type: Database["betk"]["Enums"]["sender_type"]
          reviewed_at: string | null
          reviewed_by: string | null
          severity: Database["betk"]["Enums"]["flag_severity"]
          status: Database["betk"]["Enums"]["flag_status"]
        }
        Insert: {
          content_id: string
          content_type: Database["betk"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          notes?: string | null
          reason: Database["betk"]["Enums"]["flag_reason"]
          reported_by?: string | null
          reporter_type: Database["betk"]["Enums"]["sender_type"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: Database["betk"]["Enums"]["flag_severity"]
          status?: Database["betk"]["Enums"]["flag_status"]
        }
        Update: {
          content_id?: string
          content_type?: Database["betk"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          notes?: string | null
          reason?: Database["betk"]["Enums"]["flag_reason"]
          reported_by?: string | null
          reporter_type?: Database["betk"]["Enums"]["sender_type"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: Database["betk"]["Enums"]["flag_severity"]
          status?: Database["betk"]["Enums"]["flag_status"]
        }
        Relationships: [
          {
            foreignKeyName: "flagged_content_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flagged_content_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          buyer_first_message: string
          buyer_id: string
          converted_to_order_id: string | null
          created_at: string
          delivery_preference:
            | Database["betk"]["Enums"]["delivery_preference"]
            | null
          id: string
          last_message_at: string
          listing_id: string
          quantity: number | null
          special_requests: string | null
          status: Database["betk"]["Enums"]["inquiry_status"]
          store_id: string
        }
        Insert: {
          buyer_first_message: string
          buyer_id: string
          converted_to_order_id?: string | null
          created_at?: string
          delivery_preference?:
            | Database["betk"]["Enums"]["delivery_preference"]
            | null
          id?: string
          last_message_at?: string
          listing_id: string
          quantity?: number | null
          special_requests?: string | null
          status?: Database["betk"]["Enums"]["inquiry_status"]
          store_id: string
        }
        Update: {
          buyer_first_message?: string
          buyer_id?: string
          converted_to_order_id?: string | null
          created_at?: string
          delivery_preference?:
            | Database["betk"]["Enums"]["delivery_preference"]
            | null
          id?: string
          last_message_at?: string
          listing_id?: string
          quantity?: number | null
          special_requests?: string | null
          status?: Database["betk"]["Enums"]["inquiry_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inquiries_order"
            columns: ["converted_to_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_messages: {
        Row: {
          body: string
          id: string
          inquiry_id: string
          is_read: boolean
          sender_id: string
          sender_type: Database["betk"]["Enums"]["sender_type"]
          sent_at: string
        }
        Insert: {
          body: string
          id?: string
          inquiry_id: string
          is_read?: boolean
          sender_id: string
          sender_type: Database["betk"]["Enums"]["sender_type"]
          sent_at?: string
        }
        Update: {
          body?: string
          id?: string
          inquiry_id?: string
          is_read?: boolean
          sender_id?: string
          sender_type?: Database["betk"]["Enums"]["sender_type"]
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_messages_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_images: {
        Row: {
          id: string
          listing_id: string
          sort_order: number
          uploaded_at: string
          url: string
        }
        Insert: {
          id?: string
          listing_id: string
          sort_order: number
          uploaded_at?: string
          url: string
        }
        Update: {
          id?: string
          listing_id?: string
          sort_order?: number
          uploaded_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_tags: {
        Row: {
          id: string
          listing_id: string
          tag: string
        }
        Insert: {
          id?: string
          listing_id: string
          tag: string
        }
        Update: {
          id?: string
          listing_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_tags_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          accepts_custom_orders: boolean
          category_id: string
          created_at: string
          custom_order_notes: string | null
          deleted_at: string | null
          delivery_options: Json
          description_ar: string | null
          id: string
          inquiry_count: number
          is_made_to_order: boolean
          low_stock_threshold: number
          price: number | null
          price_type: Database["betk"]["Enums"]["price_type"]
          search_vector: unknown
          status: Database["betk"]["Enums"]["listing_status"]
          stock_qty: number | null
          store_id: string
          subcategory_id: string | null
          title_ar: string
          title_en: string | null
          type: Database["betk"]["Enums"]["listing_type"]
          updated_at: string
          view_count: number
        }
        Insert: {
          accepts_custom_orders?: boolean
          category_id: string
          created_at?: string
          custom_order_notes?: string | null
          deleted_at?: string | null
          delivery_options?: Json
          description_ar?: string | null
          id?: string
          inquiry_count?: number
          is_made_to_order?: boolean
          low_stock_threshold?: number
          price?: number | null
          price_type?: Database["betk"]["Enums"]["price_type"]
          search_vector?: unknown
          status?: Database["betk"]["Enums"]["listing_status"]
          stock_qty?: number | null
          store_id: string
          subcategory_id?: string | null
          title_ar: string
          title_en?: string | null
          type: Database["betk"]["Enums"]["listing_type"]
          updated_at?: string
          view_count?: number
        }
        Update: {
          accepts_custom_orders?: boolean
          category_id?: string
          created_at?: string
          custom_order_notes?: string | null
          deleted_at?: string | null
          delivery_options?: Json
          description_ar?: string | null
          id?: string
          inquiry_count?: number
          is_made_to_order?: boolean
          low_stock_threshold?: number
          price?: number | null
          price_type?: Database["betk"]["Enums"]["price_type"]
          search_vector?: unknown
          status?: Database["betk"]["Enums"]["listing_status"]
          stock_qty?: number | null
          store_id?: string
          subcategory_id?: string | null
          title_ar?: string
          title_en?: string | null
          type?: Database["betk"]["Enums"]["listing_type"]
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          reason: string | null
          target_id: string
          target_type: Database["betk"]["Enums"]["moderation_target"]
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_id: string
          target_type: Database["betk"]["Enums"]["moderation_target"]
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_id?: string
          target_type?: Database["betk"]["Enums"]["moderation_target"]
        }
        Relationships: [
          {
            foreignKeyName: "moderation_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          channel: Database["betk"]["Enums"]["notification_channel"]
          data: Json | null
          id: string
          is_read: boolean
          read_at: string | null
          sent_at: string
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          body: string
          channel: Database["betk"]["Enums"]["notification_channel"]
          data?: Json | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          sent_at?: string
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: Database["betk"]["Enums"]["notification_channel"]
          data?: Json | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          sent_at?: string
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          listing_id: string
          listing_title_ar: string
          order_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          id?: string
          listing_id: string
          listing_title_ar: string
          order_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          id?: string
          listing_id?: string
          listing_title_ar?: string
          order_id?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          body: string
          id: string
          is_read: boolean
          order_id: string
          sender_id: string
          sender_type: Database["betk"]["Enums"]["sender_type"]
          sent_at: string
        }
        Insert: {
          body: string
          id?: string
          is_read?: boolean
          order_id: string
          sender_id: string
          sender_type: Database["betk"]["Enums"]["sender_type"]
          sent_at?: string
        }
        Update: {
          body?: string
          id?: string
          is_read?: boolean
          order_id?: string
          sender_id?: string
          sender_type?: Database["betk"]["Enums"]["sender_type"]
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_messages_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          changed_by_type: Database["betk"]["Enums"]["cancelled_by_type"]
          created_at: string
          from_status: Database["betk"]["Enums"]["order_status"] | null
          id: string
          notes: string | null
          order_id: string
          to_status: Database["betk"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          changed_by_type: Database["betk"]["Enums"]["cancelled_by_type"]
          created_at?: string
          from_status?: Database["betk"]["Enums"]["order_status"] | null
          id?: string
          notes?: string | null
          order_id: string
          to_status: Database["betk"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          changed_by_type?: Database["betk"]["Enums"]["cancelled_by_type"]
          created_at?: string
          from_status?: Database["betk"]["Enums"]["order_status"] | null
          id?: string
          notes?: string | null
          order_id?: string
          to_status?: Database["betk"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          betk_ref: string
          buyer_id: string
          cancellation_reason: string | null
          cancelled_by: Database["betk"]["Enums"]["cancelled_by_type"] | null
          confirmed_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_address_id: string | null
          delivery_fee: number
          delivery_method: Database["betk"]["Enums"]["delivery_preference"]
          id: string
          inquiry_id: string | null
          notes: string | null
          status: Database["betk"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total_amount: number
        }
        Insert: {
          betk_ref: string
          buyer_id: string
          cancellation_reason?: string | null
          cancelled_by?: Database["betk"]["Enums"]["cancelled_by_type"] | null
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address_id?: string | null
          delivery_fee?: number
          delivery_method: Database["betk"]["Enums"]["delivery_preference"]
          id?: string
          inquiry_id?: string | null
          notes?: string | null
          status?: Database["betk"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total_amount: number
        }
        Update: {
          betk_ref?: string
          buyer_id?: string
          cancellation_reason?: string | null
          cancelled_by?: Database["betk"]["Enums"]["cancelled_by_type"] | null
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address_id?: string | null
          delivery_fee?: number
          delivery_method?: Database["betk"]["Enums"]["delivery_preference"]
          id?: string
          inquiry_id?: string | null
          notes?: string | null
          status?: Database["betk"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_tokens: {
        Row: {
          attempt_count: number
          created_at: string
          expires_at: string
          id: string
          is_used: boolean
          phone_number: string
          token_hash: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          expires_at: string
          id?: string
          is_used?: boolean
          phone_number: string
          token_hash: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          phone_number?: string
          token_hash?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          method: Database["betk"]["Enums"]["payment_method"]
          notes: string | null
          order_id: string
          payment_type: Database["betk"]["Enums"]["payment_type"]
          status: Database["betk"]["Enums"]["payment_status"]
          transfer_reference: string | null
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          method: Database["betk"]["Enums"]["payment_method"]
          notes?: string | null
          order_id: string
          payment_type: Database["betk"]["Enums"]["payment_type"]
          status?: Database["betk"]["Enums"]["payment_status"]
          transfer_reference?: string | null
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          method?: Database["betk"]["Enums"]["payment_method"]
          notes?: string | null
          order_id?: string
          payment_type?: Database["betk"]["Enums"]["payment_type"]
          status?: Database["betk"]["Enums"]["payment_status"]
          transfer_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          account_details: string
          amount: number
          id: string
          method: Database["betk"]["Enums"]["payout_method"]
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          requested_at: string
          status: Database["betk"]["Enums"]["payout_status"]
          store_id: string
        }
        Insert: {
          account_details: string
          amount: number
          id?: string
          method: Database["betk"]["Enums"]["payout_method"]
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requested_at?: string
          status?: Database["betk"]["Enums"]["payout_status"]
          store_id: string
        }
        Update: {
          account_details?: string
          amount?: number
          id?: string
          method?: Database["betk"]["Enums"]["payout_method"]
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requested_at?: string
          status?: Database["betk"]["Enums"]["payout_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_aggregates: {
        Row: {
          average_rating: number
          last_recalculated_at: string
          rating_1: number
          rating_2: number
          rating_3: number
          rating_4: number
          rating_5: number
          store_id: string
          total_reviews: number
        }
        Insert: {
          average_rating?: number
          last_recalculated_at?: string
          rating_1?: number
          rating_2?: number
          rating_3?: number
          rating_4?: number
          rating_5?: number
          store_id: string
          total_reviews?: number
        }
        Update: {
          average_rating?: number
          last_recalculated_at?: string
          rating_1?: number
          rating_2?: number
          rating_3?: number
          rating_4?: number
          rating_5?: number
          store_id?: string
          total_reviews?: number
        }
        Relationships: [
          {
            foreignKeyName: "rating_aggregates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_alerts: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          listing_id: string
          notified_at: string | null
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          listing_id: string
          notified_at?: string | null
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_alerts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restock_alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      review_photos: {
        Row: {
          id: string
          review_id: string
          sort_order: number
          uploaded_at: string
          url: string
        }
        Insert: {
          id?: string
          review_id: string
          sort_order: number
          uploaded_at?: string
          url: string
        }
        Update: {
          id?: string
          review_id?: string
          sort_order?: number
          uploaded_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_photos_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          admin_verified: boolean
          body: string | null
          buyer_id: string
          created_at: string
          edit_deadline: string
          id: string
          is_visible: boolean
          order_id: string
          rating: number
          seller_replied_at: string | null
          seller_reply: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          admin_verified?: boolean
          body?: string | null
          buyer_id: string
          created_at?: string
          edit_deadline: string
          id?: string
          is_visible?: boolean
          order_id: string
          rating: number
          seller_replied_at?: string | null
          seller_reply?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          admin_verified?: boolean
          body?: string | null
          buyer_id?: string
          created_at?: string
          edit_deadline?: string
          id?: string
          is_visible?: boolean
          order_id?: string
          rating?: number
          seller_replied_at?: string | null
          seller_reply?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_documents: {
        Row: {
          document_type: Database["betk"]["Enums"]["doc_type"]
          id: string
          review_status: Database["betk"]["Enums"]["doc_review_status"]
          reviewed_at: string | null
          seller_id: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          document_type: Database["betk"]["Enums"]["doc_type"]
          id?: string
          review_status?: Database["betk"]["Enums"]["doc_review_status"]
          reviewed_at?: string | null
          seller_id: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          document_type?: Database["betk"]["Enums"]["doc_type"]
          id?: string
          review_status?: Database["betk"]["Enums"]["doc_review_status"]
          reviewed_at?: string | null
          seller_id?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_documents_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          approved_at: string | null
          avg_response_hours: number | null
          created_at: string
          id: string
          is_verified: boolean
          level: Database["betk"]["Enums"]["seller_level"]
          level_score: number
          rejected_reason: string | null
          status: Database["betk"]["Enums"]["seller_status"]
          strike_count: number
          submitted_at: string | null
          suspension_ends_at: string | null
          total_orders_completed: number
          total_reviews_count: number
        }
        Insert: {
          approved_at?: string | null
          avg_response_hours?: number | null
          created_at?: string
          id: string
          is_verified?: boolean
          level?: Database["betk"]["Enums"]["seller_level"]
          level_score?: number
          rejected_reason?: string | null
          status?: Database["betk"]["Enums"]["seller_status"]
          strike_count?: number
          submitted_at?: string | null
          suspension_ends_at?: string | null
          total_orders_completed?: number
          total_reviews_count?: number
        }
        Update: {
          approved_at?: string | null
          avg_response_hours?: number | null
          created_at?: string
          id?: string
          is_verified?: boolean
          level?: Database["betk"]["Enums"]["seller_level"]
          level_score?: number
          rejected_reason?: string | null
          status?: Database["betk"]["Enums"]["seller_status"]
          strike_count?: number
          submitted_at?: string | null
          suspension_ends_at?: string | null
          total_orders_completed?: number
          total_reviews_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "seller_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_strikes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          issued_by: string
          reason: string
          seller_id: string
          strike_type: Database["betk"]["Enums"]["strike_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          issued_by: string
          reason: string
          seller_id: string
          strike_type: Database["betk"]["Enums"]["strike_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          issued_by?: string
          reason?: string
          seller_id?: string
          strike_type?: Database["betk"]["Enums"]["strike_type"]
        }
        Relationships: [
          {
            foreignKeyName: "seller_strikes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_strikes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          device_info: Json | null
          expires_at: string
          id: string
          last_active_at: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          expires_at: string
          id?: string
          last_active_at?: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          expires_at?: string
          id?: string
          last_active_at?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_tracking_events: {
        Row: {
          description: string | null
          event_at: string
          id: string
          location: string | null
          shipment_id: string
          status: string
        }
        Insert: {
          description?: string | null
          event_at: string
          id?: string
          location?: string | null
          shipment_id: string
          status: string
        }
        Update: {
          description?: string | null
          event_at?: string
          id?: string
          location?: string | null
          shipment_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          courier: string
          created_at: string
          delivered_at: string | null
          dispatched_at: string | null
          id: string
          order_id: string
          status: Database["betk"]["Enums"]["shipment_status"]
          tracking_number: string | null
          tracking_url: string | null
        }
        Insert: {
          courier: string
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          id?: string
          order_id: string
          status?: Database["betk"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
        }
        Update: {
          courier?: string
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          id?: string
          order_id?: string
          status?: Database["betk"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_follows: {
        Row: {
          buyer_id: string
          followed_at: string
          id: string
          store_id: string
        }
        Insert: {
          buyer_id: string
          followed_at?: string
          id?: string
          store_id: string
        }
        Update: {
          buyer_id?: string
          followed_at?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_follows_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_follows_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          avatar_url: string | null
          bio_ar: string | null
          category_primary: string
          category_secondary: string | null
          city: string | null
          cover_url: string | null
          created_at: string
          delivery_options: Json
          governorate: string
          id: string
          min_order_egp: number | null
          name_ar: string
          name_en: string | null
          payment_methods: Json
          return_policy: string | null
          seller_id: string
          slug: string
          slug_changed_at: string | null
          status: Database["betk"]["Enums"]["store_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio_ar?: string | null
          category_primary: string
          category_secondary?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          delivery_options?: Json
          governorate: string
          id?: string
          min_order_egp?: number | null
          name_ar: string
          name_en?: string | null
          payment_methods?: Json
          return_policy?: string | null
          seller_id: string
          slug: string
          slug_changed_at?: string | null
          status?: Database["betk"]["Enums"]["store_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio_ar?: string | null
          category_primary?: string
          category_secondary?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          delivery_options?: Json
          governorate?: string
          id?: string
          min_order_egp?: number | null
          name_ar?: string
          name_en?: string | null
          payment_methods?: Json
          return_policy?: string | null
          seller_id?: string
          slug?: string
          slug_changed_at?: string | null
          status?: Database["betk"]["Enums"]["store_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          anonymized_at: string | null
          auth_provider: Database["betk"]["Enums"]["auth_provider"]
          created_at: string
          deleted_at: string | null
          id: string
          last_login_at: string | null
          phone_number: string | null
          role: Database["betk"]["Enums"]["user_role"]
          status: Database["betk"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          auth_provider?: Database["betk"]["Enums"]["auth_provider"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_login_at?: string | null
          phone_number?: string | null
          role?: Database["betk"]["Enums"]["user_role"]
          status?: Database["betk"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          auth_provider?: Database["betk"]["Enums"]["auth_provider"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_login_at?: string | null
          phone_number?: string | null
          role?: Database["betk"]["Enums"]["user_role"]
          status?: Database["betk"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          body_template: string
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          language: string
          name: string
        }
        Insert: {
          body_template: string
          created_at?: string
          event_type: string
          id?: string
          is_active?: boolean
          language?: string
          name: string
        }
        Update: {
          body_template?: string
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          language?: string
          name?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          buyer_id: string
          id: string
          listing_id: string
          restock_alert: boolean
          saved_at: string
        }
        Insert: {
          buyer_id: string
          id?: string
          listing_id: string
          restock_alert?: boolean
          saved_at?: string
        }
        Update: {
          buyer_id?: string
          id?: string
          listing_id?: string
          restock_alert?: boolean
          saved_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
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
      my_store_id: { Args: never; Returns: string }
      resubmit_seller_application: {
        Args: { p_doc_back_path: string; p_doc_front_path: string }
        Returns: undefined
      }
      submit_seller_application: {
        Args: {
          p_bio_ar: string
          p_category_primary: string
          p_category_secondary: string
          p_city: string
          p_delivery_options: Json
          p_doc_back_path: string
          p_doc_front_path: string
          p_governorate: string
          p_min_order_egp: number
          p_name_ar: string
          p_name_en: string
          p_payment_methods: Json
          p_return_policy: string
          p_slug: string
        }
        Returns: undefined
      }
    }
    Enums: {
      auth_provider: "phone" | "google"
      boost_status: "pending_payment" | "active" | "expired" | "cancelled"
      cancelled_by_type: "buyer" | "seller" | "admin" | "system"
      collection_status: "draft" | "live" | "scheduled" | "archived"
      content_type: "listing" | "review"
      delivery_preference: "delivery" | "pickup" | "remote"
      dispute_reason:
        | "not_received"
        | "not_as_described"
        | "damaged"
        | "wrong_item"
        | "return_request"
        | "refund_request"
      dispute_resolution:
        | "buyer_favour"
        | "seller_favour"
        | "partial"
        | "no_action"
      dispute_status:
        | "submitted"
        | "under_review"
        | "awaiting_seller"
        | "resolved"
        | "closed"
      doc_review_status: "pending" | "approved" | "rejected"
      doc_type: "national_id_front" | "national_id_back"
      flag_reason:
        | "misleading"
        | "counterfeit"
        | "inappropriate"
        | "spam"
        | "prohibited"
        | "wrong_category"
      flag_severity: "low" | "medium" | "high"
      flag_status: "pending" | "reviewed" | "actioned" | "dismissed"
      inquiry_status: "open" | "replied" | "confirmed" | "declined" | "expired"
      listing_status: "draft" | "active" | "sold_out" | "paused" | "removed"
      listing_type: "product" | "service"
      moderation_target:
        | "seller"
        | "buyer"
        | "listing"
        | "review"
        | "dispute"
        | "payout"
      notification_channel: "push" | "sms" | "whatsapp" | "email"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "dispatched"
        | "delivered"
        | "cancelled"
        | "returned"
      payment_method: "instapay" | "vodafone_cash" | "orange_cash" | "cod"
      payment_status: "pending" | "confirmed" | "failed" | "refunded"
      payment_type: "deposit" | "balance"
      payout_method: "instapay" | "vodafone_cash" | "orange_cash"
      payout_status: "pending" | "processing" | "processed" | "rejected"
      price_type: "fixed" | "per_hour" | "starting_from" | "quote_only"
      seller_level: "bronze" | "silver" | "gold"
      seller_status: "pending" | "active" | "suspended" | "banned"
      sender_type: "buyer" | "seller" | "admin" | "system"
      shipment_status:
        | "created"
        | "picked_up"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "failed"
        | "returned"
      store_status: "pending" | "active" | "suspended"
      strike_type: "warning" | "temp_suspension" | "permanent_ban"
      user_role: "buyer" | "seller" | "admin" | "superadmin"
      user_status: "active" | "suspended" | "banned" | "pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  betk_analytics: {
    Tables: {
      platform_snapshots: {
        Row: {
          boost_revenue_egp: number
          disputes_opened: number
          disputes_resolved: number
          gmv_egp: number
          new_buyers: number
          new_sellers: number
          orders_created: number
          orders_delivered: number
          snapshot_date: string
          total_buyers: number
          total_sellers_active: number
        }
        Insert: {
          boost_revenue_egp?: number
          disputes_opened?: number
          disputes_resolved?: number
          gmv_egp?: number
          new_buyers?: number
          new_sellers?: number
          orders_created?: number
          orders_delivered?: number
          snapshot_date: string
          total_buyers?: number
          total_sellers_active?: number
        }
        Update: {
          boost_revenue_egp?: number
          disputes_opened?: number
          disputes_resolved?: number
          gmv_egp?: number
          new_buyers?: number
          new_sellers?: number
          orders_created?: number
          orders_delivered?: number
          snapshot_date?: string
          total_buyers?: number
          total_sellers_active?: number
        }
        Relationships: []
      }
      seller_snapshots: {
        Row: {
          id: string
          inquiries_received: number
          listing_views: number
          orders_confirmed: number
          profile_views: number
          revenue_egp: number
          snapshot_date: string
          store_id: string
        }
        Insert: {
          id?: string
          inquiries_received?: number
          listing_views?: number
          orders_confirmed?: number
          profile_views?: number
          revenue_egp?: number
          snapshot_date: string
          store_id: string
        }
        Update: {
          id?: string
          inquiries_received?: number
          listing_views?: number
          orders_confirmed?: number
          profile_views?: number
          revenue_egp?: number
          snapshot_date?: string
          store_id?: string
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
  betk: {
    Enums: {
      auth_provider: ["phone", "google"],
      boost_status: ["pending_payment", "active", "expired", "cancelled"],
      cancelled_by_type: ["buyer", "seller", "admin", "system"],
      collection_status: ["draft", "live", "scheduled", "archived"],
      content_type: ["listing", "review"],
      delivery_preference: ["delivery", "pickup", "remote"],
      dispute_reason: [
        "not_received",
        "not_as_described",
        "damaged",
        "wrong_item",
        "return_request",
        "refund_request",
      ],
      dispute_resolution: [
        "buyer_favour",
        "seller_favour",
        "partial",
        "no_action",
      ],
      dispute_status: [
        "submitted",
        "under_review",
        "awaiting_seller",
        "resolved",
        "closed",
      ],
      doc_review_status: ["pending", "approved", "rejected"],
      doc_type: ["national_id_front", "national_id_back"],
      flag_reason: [
        "misleading",
        "counterfeit",
        "inappropriate",
        "spam",
        "prohibited",
        "wrong_category",
      ],
      flag_severity: ["low", "medium", "high"],
      flag_status: ["pending", "reviewed", "actioned", "dismissed"],
      inquiry_status: ["open", "replied", "confirmed", "declined", "expired"],
      listing_status: ["draft", "active", "sold_out", "paused", "removed"],
      listing_type: ["product", "service"],
      moderation_target: [
        "seller",
        "buyer",
        "listing",
        "review",
        "dispute",
        "payout",
      ],
      notification_channel: ["push", "sms", "whatsapp", "email"],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "dispatched",
        "delivered",
        "cancelled",
        "returned",
      ],
      payment_method: ["instapay", "vodafone_cash", "orange_cash", "cod"],
      payment_status: ["pending", "confirmed", "failed", "refunded"],
      payment_type: ["deposit", "balance"],
      payout_method: ["instapay", "vodafone_cash", "orange_cash"],
      payout_status: ["pending", "processing", "processed", "rejected"],
      price_type: ["fixed", "per_hour", "starting_from", "quote_only"],
      seller_level: ["bronze", "silver", "gold"],
      seller_status: ["pending", "active", "suspended", "banned"],
      sender_type: ["buyer", "seller", "admin", "system"],
      shipment_status: [
        "created",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed",
        "returned",
      ],
      store_status: ["pending", "active", "suspended"],
      strike_type: ["warning", "temp_suspension", "permanent_ban"],
      user_role: ["buyer", "seller", "admin", "superadmin"],
      user_status: ["active", "suspended", "banned", "pending"],
    },
  },
  betk_analytics: {
    Enums: {},
  },
} as const
