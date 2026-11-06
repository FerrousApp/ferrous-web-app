// src/types/transfers.ts

export interface DvaDetails {
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  instructions: string;
}

export interface DvaResponse {
  kyc_status?: string;
  dva: DvaDetails | null;
  dvas?: DvaDetails[]; // NEW: Multi-bank array support
}

export interface WithdrawalPayload {
  amountInNgn: number;
  savedBankId: string;
}

export interface WithdrawalResponse {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
}

export type GranularStatus =
  | "PROCESSING_FIAT_RAMP"
  | "PENDING_ON_CHAIN"
  | "PROCESSING_ON_CHAIN_SWAP"
  | "success"
  | "failed";
