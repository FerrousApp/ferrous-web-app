// src/types/transactions.ts

export interface LedgerTransaction {
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
  status: "success" | "failed" | "pending";
  created_at: string;
  granular_status?: string;
}

export interface TransactionsPagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface LedgerTransactionsResponse {
  transactions: LedgerTransaction[];
  pagination: TransactionsPagination;
}
