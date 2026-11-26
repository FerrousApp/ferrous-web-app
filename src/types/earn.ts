// src/types/earn.ts
import type { Asset } from "./dashboard";

export interface ProtocolDetails {
  description: string;
  tvl_usd: number;
  volume_24h_usd: number;
  fee_bps: number;
}

export interface EarnAsset extends Asset {
  protocol_details?: ProtocolDetails;
}

export interface InvestmentQuotePayload {
  assetId: string;
  amountInNgn: number;
}

export interface InvestmentQuoteResponse {
  exchangeRate: number;
  estimatedShares: number;
  fees: number;
}

export interface InvestmentExecutePayload {
  assetId: string;
  amountInNgn: number;
}

export interface InvestmentExecuteResponse {
  status?: string;
  message?: string;
  transaction: {
    id: string;
    reference?: string;
    status?: string;
  };
}

export interface ExecuteSwapResponse {
  status: string;
  txHash: string;
  bondOutputTokens: string;
  message?: string;
}

export interface LiquidationQuotePayload {
  assetId: string;
  amountInAsset: number;
}

export interface LiquidationQuoteDetails {
  input_asset_amount: number;
  estimated_usdc_recovered: string;
  applied_exchange_rate: string;
  net_ngn_payout: string;
}

export interface LiquidationQuoteResponse {
  asset: {
    id: string;
    chain: string;
  };
  quote: LiquidationQuoteDetails;
  disclaimer?: string;
}

export interface LiquidationExecutePayload {
  assetId: string;
  amountInAsset: number;
}

export interface LiquidationExecuteResponse {
  id: string;
  reference: string;
  status: string;
  created_at: string;
  message?: string;
}
