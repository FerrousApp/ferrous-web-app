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
  status: string;
  message: string;
  data: {
    transaction: {
      id: string;
      reference: string;
      status: string;
    };
  };
}
