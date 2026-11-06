// src/services/transactions.service.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import type { LedgerTransactionsResponse } from "../types/transactions";

const transactionsApi = {
  getLedger: async (
    limit = 20,
    offset = 0,
    status?: string,
    type?: string,
  ): Promise<LedgerTransactionsResponse> => {
    let url = `/transactions/?limit=${limit}&offset=${offset}`;

    if (status && status !== "all") url += `&status=${status}`;
    if (type && type !== "all") url += `&type=${type}`;

    const res = await apiClient.get<unknown, unknown>(url);

    // Safely unwrap standard backend response structures
    const root = res as Record<string, unknown>;
    const data1 = root?.data as Record<string, unknown> | undefined;
    const data2 = data1?.data as Record<string, unknown> | undefined;

    if (root?.transactions)
      return root as unknown as LedgerTransactionsResponse;
    if (data1?.transactions)
      return data1 as unknown as LedgerTransactionsResponse;
    if (data2?.transactions)
      return data2 as unknown as LedgerTransactionsResponse;

    // Fallback if empty
    return {
      transactions: [],
      pagination: { total: 0, limit, offset, has_more: false },
    };
  },
};

// React Query Hook specifically for the Ledger UI
export const useLedgerTransactions = (
  limit = 20,
  offset = 0,
  status?: string,
  type?: string,
) =>
  useQuery({
    queryKey: ["transactions-ledger", limit, offset, status, type],
    queryFn: () => transactionsApi.getLedger(limit, offset, status, type),
  });
