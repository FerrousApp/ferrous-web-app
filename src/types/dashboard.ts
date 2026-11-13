// src/types/dashboard.ts

export interface LivePricing {
  cost_in_usd: number;
  cost_in_fiat: number;
  fiat_currency: string;
  annualized_yield_bps: number;
  last_updated: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  chain: "solana" | "stellar" | "base" | "optimism";
  contract_address: string;
  underlying_currency: "USDC" | "USDT";
  provider: "etherfuse" | "aave" | "morpho";
  active: boolean;
  decimals: number;
  minimum_deposit_usd: number;
  tags: string[];
  live_pricing: LivePricing | null;
}

export interface Transaction {
  id: string;
  reference: string;
  type:
    | "bond_investment"
    | "bond_liquidation"
    | "fiat_deposit"
    | "fiat_withdrawal"
    | string;
  provider: string;
  amount: number;
  currency: string;
  // FIX: Added 'reversed' and 'completed' to the allowed status strings
  status: "success" | "failed" | "pending" | "reversed" | "completed";
  created_at: string;
  granular_status?: string;
  metadata?: {
    bank_name?: string;
    account_number?: string;
    busha_fee?: string;
    [key: string]: unknown;
  };
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  pagination: Pagination;
}

export interface BalancesResponse {
  balances: Record<string, string>;
}
