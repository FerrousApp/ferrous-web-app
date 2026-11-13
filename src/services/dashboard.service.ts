// src/services/dashboard.service.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import type { Asset, TransactionsResponse } from "../types/dashboard";

// 1. Strictly-typed recursive extractor to pierce through all Axios AND backend wrappers
const extractBalances = (payload: unknown): Record<string, string> | null => {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;

  // If we found the "balances" key, return it
  if (
    "balances" in record &&
    record.balances &&
    typeof record.balances === "object"
  ) {
    return record.balances as Record<string, string>;
  }

  // If there is a "data" wrapper, drill down one layer deeper
  if ("data" in record && record.data) {
    return extractBalances(record.data);
  }

  return null;
};

// 2. Recursive extractor for arrays
const extractArray = <T>(payload: unknown): T[] | null => {
  if (!payload || typeof payload !== "object") return null;

  if (Array.isArray(payload)) return payload as T[];

  const record = payload as Record<string, unknown>;
  if ("data" in record && record.data) {
    return extractArray<T>(record.data);
  }

  return null;
};

// 3. Recursive extractor for Transactions
const extractTransactions = (payload: unknown): TransactionsResponse | null => {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;

  if ("transactions" in record && Array.isArray(record.transactions)) {
    return record as unknown as TransactionsResponse;
  }

  if ("data" in record && record.data) {
    return extractTransactions(record.data);
  }

  return null;
};

const dashboardApi = {
  getBalances: async (): Promise<Record<string, number>> => {
    const res = await apiClient.get<unknown, unknown>("/wallet/balances");

    // The recursive extractor guarantees we find the balances object whether the
    // shape is res.balances, res.data.balances, or res.data.data.balances
    const rawBalances = extractBalances(res) || {};

    const parsedBalances: Record<string, number> = {};
    for (const [key, value] of Object.entries(rawBalances)) {
      // Cast to string to satisfy TS, then parse to a float
      parsedBalances[key] = parseFloat(String(value)) || 0;
    }

    return parsedBalances;
  },

  getMarketAssets: async (): Promise<Asset[]> => {
    const res = await apiClient.get<unknown, unknown>("/market/assets");
    return extractArray<Asset>(res) || [];
  },

  getTrendingAssets: async (): Promise<Asset[]> => {
    const res = await apiClient.get<unknown, unknown>("/utility/trending");
    return extractArray<Asset>(res) || [];
  },

  getTransactions: async (
    limit = 20,
    offset = 0,
  ): Promise<TransactionsResponse> => {
    const res = await apiClient.get<unknown, unknown>(
      `/transactions/?limit=${limit}&offset=${offset}`,
    );

    const extractedData = extractTransactions(res);

    if (extractedData) {
      return extractedData;
    }

    return {
      transactions: [],
      pagination: { total: 0, limit, offset, has_more: false },
    };
  },
};

// React Query Hooks
export const useWalletBalances = () =>
  useQuery({
    queryKey: ["balances"],
    queryFn: dashboardApi.getBalances,
    refetchInterval: 10000,
  });

export const useMarketAssets = () =>
  useQuery({
    queryKey: ["market-assets"],
    queryFn: dashboardApi.getMarketAssets,
  });

export const useTrendingAssets = () =>
  useQuery({
    queryKey: ["trending-assets"],
    queryFn: dashboardApi.getTrendingAssets,
  });

export const useTransactions = (limit = 20, offset = 0) =>
  useQuery({
    queryKey: ["transactions", limit, offset],
    queryFn: () => dashboardApi.getTransactions(limit, offset),
    refetchInterval: 5000,
  });
