/**
 * Supabase Database types for PMPP.
 *
 * After running the schema in Supabase, regenerate this file with:
 *   npx supabase gen types typescript --project-id aabmwadzrmfwkaxnlluq > src/types/database.ts
 *
 * For now, this provides the core type structure.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: string;
          domain: string | null;
          logo_url: string | null;
          timezone: string;
          settings: Json;
          subscription_status: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: string;
          domain?: string | null;
          logo_url?: string | null;
          timezone?: string;
          settings?: Json;
          subscription_status?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          plan?: string;
          domain?: string | null;
          logo_url?: string | null;
          timezone?: string;
          settings?: Json;
          subscription_status?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      users: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          password_hash: string | null;
          full_name: string;
          role: "owner" | "property_manager" | "maintenance_tech" | "leasing_agent" | "accounting" | "vendor_user";
          phone: string | null;
          avatar_url: string | null;
          is_active: boolean;
          last_login_at: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          full_name: string;
          role: "owner" | "property_manager" | "maintenance_tech" | "leasing_agent" | "accounting" | "vendor_user";
          password_hash?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          settings?: Json;
        };
        Update: {
          full_name?: string;
          role?: "owner" | "property_manager" | "maintenance_tech" | "leasing_agent" | "accounting" | "vendor_user";
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          settings?: Json;
          deleted_at?: string | null;
        };
      };
      properties: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          property_type: "single_family" | "multi_family" | "commercial" | "mixed_use" | "industrial";
          address_line1: string;
          address_line2: string | null;
          city: string;
          state: string;
          zip: string;
          county: string | null;
          latitude: number | null;
          longitude: number | null;
          year_built: number | null;
          total_units: number;
          total_sqft: number | null;
          manager_id: string | null;
          purchase_price: number | null;
          purchase_date: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          property_type: "single_family" | "multi_family" | "commercial" | "mixed_use" | "industrial";
          address_line1: string;
          city: string;
          state: string;
          zip: string;
          total_units?: number;
          address_line2?: string | null;
          county?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          year_built?: number | null;
          total_sqft?: number | null;
          manager_id?: string | null;
          purchase_price?: number | null;
          purchase_date?: string | null;
          metadata?: Json;
        };
        Update: {
          name?: string;
          property_type?: "single_family" | "multi_family" | "commercial" | "mixed_use" | "industrial";
          address_line1?: string;
          city?: string;
          state?: string;
          zip?: string;
          total_units?: number;
          manager_id?: string | null;
          metadata?: Json;
          deleted_at?: string | null;
        };
      };
      units: {
        Row: {
          id: string;
          org_id: string;
          property_id: string;
          unit_number: string;
          floor: number | null;
          bedrooms: number | null;
          bathrooms: number | null;
          sqft: number | null;
          unit_type: string | null;
          market_rent: number | null;
          status: "vacant" | "occupied" | "maintenance" | "renovation" | "off_market";
          amenities: string[];
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          property_id: string;
          unit_number: string;
          floor?: number | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          sqft?: number | null;
          unit_type?: string | null;
          market_rent?: number | null;
          status?: "vacant" | "occupied" | "maintenance" | "renovation" | "off_market";
          amenities?: string[];
        };
        Update: {
          unit_number?: string;
          market_rent?: number | null;
          status?: "vacant" | "occupied" | "maintenance" | "renovation" | "off_market";
          amenities?: string[];
          deleted_at?: string | null;
        };
      };
      tenants: {
        Row: {
          id: string;
          org_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
        };
        Update: {
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          deleted_at?: string | null;
        };
      };
      leases: {
        Row: {
          id: string;
          org_id: string;
          unit_id: string;
          tenant_id: string;
          lease_type: string;
          status: "draft" | "pending_signature" | "active" | "month_to_month" | "expired" | "terminated" | "renewed";
          start_date: string;
          end_date: string | null;
          monthly_rent: number;
          security_deposit: number | null;
          previous_lease_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          unit_id: string;
          tenant_id: string;
          start_date: string;
          monthly_rent: number;
          lease_type?: string;
          status?: "draft" | "pending_signature" | "active" | "month_to_month" | "expired" | "terminated" | "renewed";
          end_date?: string | null;
          security_deposit?: number | null;
          previous_lease_id?: string | null;
        };
        Update: {
          status?: "draft" | "pending_signature" | "active" | "month_to_month" | "expired" | "terminated" | "renewed";
          monthly_rent?: number;
          end_date?: string | null;
          deleted_at?: string | null;
        };
      };
      work_orders: {
        Row: {
          id: string;
          org_id: string;
          property_id: string;
          unit_id: string | null;
          title: string;
          description: string | null;
          category: string;
          priority: "emergency" | "high" | "medium" | "low";
          status: "open" | "assigned" | "in_progress" | "pending_parts" | "pending_vendor" | "completed" | "closed" | "cancelled";
          assigned_to: string | null;
          vendor_id: string | null;
          total_cost: number | null;
          reported_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          property_id: string;
          title: string;
          category: string;
          unit_id?: string | null;
          description?: string | null;
          priority?: "emergency" | "high" | "medium" | "low";
          status?: "open" | "assigned" | "in_progress" | "pending_parts" | "pending_vendor" | "completed" | "closed" | "cancelled";
          assigned_to?: string | null;
          vendor_id?: string | null;
        };
        Update: {
          title?: string;
          category?: string;
          priority?: "emergency" | "high" | "medium" | "low";
          status?: "open" | "assigned" | "in_progress" | "pending_parts" | "pending_vendor" | "completed" | "closed" | "cancelled";
          assigned_to?: string | null;
          vendor_id?: string | null;
          deleted_at?: string | null;
        };
      };
      vendors: {
        Row: {
          id: string;
          org_id: string;
          company_name: string;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          specialties: string[];
          hourly_rate: number | null;
          rating_avg: number;
          is_preferred: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          company_name: string;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          specialties?: string[];
          hourly_rate?: number | null;
          is_preferred?: boolean;
        };
        Update: {
          company_name?: string;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          specialties?: string[];
          hourly_rate?: number | null;
          is_preferred?: boolean;
          deleted_at?: string | null;
        };
      };
      transactions: {
        Row: {
          id: string;
          org_id: string;
          property_id: string;
          unit_id: string | null;
          lease_id: string | null;
          tenant_id: string | null;
          type: string;
          status: "pending" | "completed" | "failed" | "refunded" | "voided";
          category: string;
          amount: number;
          transaction_date: string;
          due_date: string | null;
          paid_date: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          property_id: string;
          type: string;
          category: string;
          amount: number;
          transaction_date: string;
          created_by: string;
          unit_id?: string | null;
          lease_id?: string | null;
          tenant_id?: string | null;
          status?: "pending" | "completed" | "failed" | "refunded" | "voided";
          due_date?: string | null;
          paid_date?: string | null;
        };
        Update: {
          status?: "pending" | "completed" | "failed" | "refunded" | "voided";
          paid_date?: string | null;
          deleted_at?: string | null;
        };
      };
      metric_snapshots: {
        Row: {
          id: string;
          org_id: string;
          property_id: string | null;
          period_type: string;
          period_date: string;
          noi: number | null;
          vacancy_rate: number | null;
          occupancy_rate: number | null;
          avg_rent_per_unit: number | null;
          rent_collection_rate: number | null;
          avg_completion_hours: number | null;
          maintenance_cost_per_unit: number | null;
          tenant_retention_rate: number | null;
          total_units: number | null;
          occupied_units: number | null;
          vacant_units: number | null;
          computed_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          period_type: string;
          period_date: string;
          property_id?: string | null;
          noi?: number | null;
          vacancy_rate?: number | null;
          occupancy_rate?: number | null;
          avg_rent_per_unit?: number | null;
          rent_collection_rate?: number | null;
          avg_completion_hours?: number | null;
          maintenance_cost_per_unit?: number | null;
          tenant_retention_rate?: number | null;
          total_units?: number | null;
          occupied_units?: number | null;
          vacant_units?: number | null;
        };
        Update: {
          noi?: number | null;
          vacancy_rate?: number | null;
          occupancy_rate?: number | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: "owner" | "property_manager" | "maintenance_tech" | "leasing_agent" | "accounting" | "vendor_user";
      property_type: "single_family" | "multi_family" | "commercial" | "mixed_use" | "industrial";
      unit_status: "vacant" | "occupied" | "maintenance" | "renovation" | "off_market";
      lease_status: "draft" | "pending_signature" | "active" | "month_to_month" | "expired" | "terminated" | "renewed";
      work_order_priority: "emergency" | "high" | "medium" | "low";
      work_order_status: "open" | "assigned" | "in_progress" | "pending_parts" | "pending_vendor" | "completed" | "closed" | "cancelled";
      transaction_type: "rent_payment" | "security_deposit" | "late_fee" | "pet_fee" | "parking_fee" | "utility_charge" | "maintenance_expense" | "vendor_payment" | "insurance" | "tax" | "management_fee" | "capex" | "refund" | "adjustment" | "other_income" | "other_expense";
      transaction_status: "pending" | "completed" | "failed" | "refunded" | "voided";
      ai_action_type: "classification" | "recommendation" | "generation" | "analysis" | "prediction" | "automation" | "chat_response";
    };
  };
}
