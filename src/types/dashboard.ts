// src/types/dashboard.ts
import type { TransactionStatus } from "../lib/transactionStatus";

export interface LivePricing {
  cost_in_usd: number;
  cost_in_fiat: number;
  fiat_currency: string;
  annualized_yield_bps: number;
  last_updated: string;
}

export interface MarketMeta {
  global_usd_ngn_rate?: number;
  global_usd_ngn_buy_rate?: number;
  global_usd_ngn_sell_rate?: number;
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
  minimum_deposit_ngn?: number | null;
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
  amount: number | string;
  currency: string;
  status: TransactionStatus | string;
  created_at: string;
  granular_status?: TransactionStatus | string;
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
  balances: Record<string, unknown>;
}
