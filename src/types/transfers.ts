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
  dvas?: DvaDetails[];
}

// NEW: Saved Bank Interfaces
export interface SavedBank {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  alias?: string;
}

export interface SaveBankPayload {
  account_number: string;
  bank_code: string;
  bank_name: string;
  alias?: string;
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
  | "USDC_DELIVERED"
  | "PENDING_ON_CHAIN"
  | "PROCESSING_ON_CHAIN_SWAP"
  | "success"
  | "failed";
