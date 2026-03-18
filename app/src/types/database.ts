export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AgentStatus = "pending" | "verified" | "listed" | "suspended";
export type EscrowStatus = "pending" | "funded" | "released" | "refunded";
export type Rail = "fiat" | "crypto";
export type KycStatus = "none" | "pending" | "verified" | "rejected";
export type PaymentStatus =
  | "pending"
  | "tokenized"
  | "requires_3ds"
  | "authorized"
  | "captured"
  | "declined"
  | "error"
  | "refunded";

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          name: string;
          description: string;
          category: string;
          operator_id: string;
          revenue_source: string;
          monthly_revenue: number;
          revenue_verified_at: string | null;
          verification_days: number;
          status: AgentStatus;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          category?: string;
          operator_id: string;
          revenue_source?: string;
          monthly_revenue?: number;
          revenue_verified_at?: string | null;
          verification_days?: number;
          status?: AgentStatus;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          category?: string;
          operator_id?: string;
          revenue_source?: string;
          monthly_revenue?: number;
          revenue_verified_at?: string | null;
          verification_days?: number;
          status?: AgentStatus;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      offerings: {
        Row: {
          id: string;
          agent_id: string;
          revenue_share_pct: number;
          total_shares: number;
          shares_sold: number;
          price_per_share: number;
          min_raise: number;
          max_raise: number;
          escrow_status: EscrowStatus;
          starts_at: string;
          ends_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          revenue_share_pct: number;
          total_shares: number;
          shares_sold?: number;
          price_per_share: number;
          min_raise: number;
          max_raise: number;
          escrow_status?: EscrowStatus;
          starts_at: string;
          ends_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          revenue_share_pct?: number;
          total_shares?: number;
          shares_sold?: number;
          price_per_share?: number;
          min_raise?: number;
          max_raise?: number;
          escrow_status?: EscrowStatus;
          starts_at?: string;
          ends_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      shares: {
        Row: {
          id: string;
          offering_id: string;
          investor_id: string;
          quantity: number;
          purchase_price: number;
          rail: Rail;
          token_id: string | null;
          purchased_at: string;
        };
        Insert: {
          id?: string;
          offering_id: string;
          investor_id: string;
          quantity: number;
          purchase_price: number;
          rail: Rail;
          token_id?: string | null;
          purchased_at?: string;
        };
        Update: {
          id?: string;
          offering_id?: string;
          investor_id?: string;
          quantity?: number;
          purchase_price?: number;
          rail?: Rail;
          token_id?: string | null;
          purchased_at?: string;
        };
      };
      distributions: {
        Row: {
          id: string;
          agent_id: string;
          period_start: string;
          period_end: string;
          gross_revenue: number;
          platform_fee: number;
          operator_amount: number;
          investor_amount: number;
          distributed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          period_start: string;
          period_end: string;
          gross_revenue: number;
          platform_fee: number;
          operator_amount: number;
          investor_amount: number;
          distributed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          period_start?: string;
          period_end?: string;
          gross_revenue?: number;
          platform_fee?: number;
          operator_amount?: number;
          investor_amount?: number;
          distributed_at?: string | null;
          created_at?: string;
        };
      };
      operators: {
        Row: {
          id: string;
          user_id: string;
          kyc_status: KycStatus;
          stripe_connect_id: string | null;
          wallet_address: string | null;
          reputation_score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kyc_status?: KycStatus;
          stripe_connect_id?: string | null;
          wallet_address?: string | null;
          reputation_score?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kyc_status?: KycStatus;
          stripe_connect_id?: string | null;
          wallet_address?: string | null;
          reputation_score?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      investors: {
        Row: {
          id: string;
          user_id: string;
          kyc_status: KycStatus;
          wallet_address: string | null;
          total_invested: number;
          total_earned: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kyc_status?: KycStatus;
          wallet_address?: string | null;
          total_invested?: number;
          total_earned?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kyc_status?: KycStatus;
          wallet_address?: string | null;
          total_invested?: number;
          total_earned?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          offering_id: string;
          investor_id: string;
          quantity: number;
          amount: number;
          currency: string;
          status: PaymentStatus;
          fiserv_order_id: string | null;
          fiserv_ipg_tx_id: string | null;
          fiserv_session_id: string | null;
          card_last4: string | null;
          card_brand: string | null;
          payment_token: string | null;
          three_ds_type: string | null;
          three_ds_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          offering_id: string;
          investor_id: string;
          quantity: number;
          amount: number;
          currency?: string;
          status?: PaymentStatus;
          fiserv_order_id?: string | null;
          fiserv_ipg_tx_id?: string | null;
          fiserv_session_id?: string | null;
          card_last4?: string | null;
          card_brand?: string | null;
          payment_token?: string | null;
          three_ds_type?: string | null;
          three_ds_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          offering_id?: string;
          investor_id?: string;
          quantity?: number;
          amount?: number;
          currency?: string;
          status?: PaymentStatus;
          fiserv_order_id?: string | null;
          fiserv_ipg_tx_id?: string | null;
          fiserv_session_id?: string | null;
          card_last4?: string | null;
          card_brand?: string | null;
          payment_token?: string | null;
          three_ds_type?: string | null;
          three_ds_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      agent_status: AgentStatus;
      escrow_status: EscrowStatus;
      rail: Rail;
      kyc_status: KycStatus;
      payment_status: PaymentStatus;
    };
  };
}
