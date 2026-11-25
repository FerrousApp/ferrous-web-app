// src/types/transfers.ts
import type { TransactionStatus } from "../lib/transactionStatus";

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

export interface BankOption {
  name: string;
  code: string;
  country_id?: string;
  currency_id?: string;
}

export interface ResolveBankPayload {
  account_number: string;
  bank_code: string;
}

export interface ResolveBankResponse {
  account_name: string;
  account_number: string;
  bank_code: string;
}

export interface SavedBank {
  id: string;
  bank_name: string;
  bank_code?: string;
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
  status: TransactionStatus | string;
}

export type GranularStatus = TransactionStatus;
