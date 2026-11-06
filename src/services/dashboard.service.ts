// src/services/dashboard.service.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import type { Asset, TransactionsResponse } from "../types/dashboard";

const dashboardApi = {
  getBalances: async (): Promise<Record<string, string>> => {
    // Strongly type as unknown, then cast safely to Records
    const res = await apiClient.get<unknown, unknown>("/wallet/balances");
    const root = res as Record<string, unknown>;
    const data1 = root?.data as Record<string, unknown> | undefined;
    const data2 = data1?.data as Record<string, unknown> | undefined;

    // Check all possible depth levels
    if (root?.balances) return root.balances as Record<string, string>;
    if (data1?.balances) return data1.balances as Record<string, string>;
    if (data2?.balances) return data2.balances as Record<string, string>;

    return {};
  },

  getMarketAssets: async (): Promise<Asset[]> => {
    const res = await apiClient.get<unknown, unknown>("/market/assets");
    const root = res as Record<string, unknown>;
    const data1 = root?.data as Record<string, unknown> | undefined;

    // Array checks
    if (Array.isArray(res)) return res as Asset[];
    if (Array.isArray(root?.data)) return root.data as Asset[];
    if (Array.isArray(data1?.data)) return data1.data as Asset[];

    return [];
  },

  getTrendingAssets: async (): Promise<Asset[]> => {
    const res = await apiClient.get<unknown, unknown>("/utility/trending");
    const root = res as Record<string, unknown>;
    const data1 = root?.data as Record<string, unknown> | undefined;

    if (Array.isArray(res)) return res as Asset[];
    if (Array.isArray(root?.data)) return root.data as Asset[];
    if (Array.isArray(data1?.data)) return data1.data as Asset[];

    return [];
  },

  getTransactions: async (
    limit = 20,
    offset = 0,
  ): Promise<TransactionsResponse> => {
    const res = await apiClient.get<unknown, unknown>(
      `/transactions/?limit=${limit}&offset=${offset}`,
    );
    const root = res as Record<string, unknown>;
    const data1 = root?.data as Record<string, unknown> | undefined;
    const data2 = data1?.data as Record<string, unknown> | undefined;

    if (root?.transactions) return root as unknown as TransactionsResponse;
    if (data1?.transactions) return data1 as unknown as TransactionsResponse;
    if (data2?.transactions) return data2 as unknown as TransactionsResponse;

    return {
      transactions: [],
      pagination: { total: 0, limit, offset, has_more: false },
    };
  },
};

// React Query Hooks
export const useWalletBalances = () =>
  useQuery({ queryKey: ["balances"], queryFn: dashboardApi.getBalances });

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
  });
