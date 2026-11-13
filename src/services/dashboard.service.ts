// src/services/dashboard.service.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import type { Asset, TransactionsResponse } from "../types/dashboard";

const dashboardApi = {
  getBalances: async (): Promise<Record<string, number>> => {
    const res = await apiClient.get<unknown, unknown>("/wallet/balances");

    // Safely extract from Axios response without 'any'
    const axiosRes = res as { data?: unknown };
    const payload = axiosRes.data ? axiosRes.data : res;

    const root = payload as {
      data?: {
        balances?: Record<string, string>;
      };
      balances?: Record<string, string>;
    };

    const rawBalances = root?.data?.balances || root?.balances || {};

    const parsedBalances: Record<string, number> = {};
    for (const [key, value] of Object.entries(rawBalances)) {
      parsedBalances[key] = parseFloat(value) || 0;
    }

    return parsedBalances;
  },

  getMarketAssets: async (): Promise<Asset[]> => {
    const res = await apiClient.get<unknown, unknown>("/market/assets");

    const axiosRes = res as { data?: unknown };
    const payload = axiosRes.data ? axiosRes.data : res;

    const root = payload as { data?: Asset[] } | Asset[];

    if (Array.isArray(root)) return root;
    if (
      root &&
      typeof root === "object" &&
      "data" in root &&
      Array.isArray(root.data)
    )
      return root.data;

    return [];
  },

  getTrendingAssets: async (): Promise<Asset[]> => {
    const res = await apiClient.get<unknown, unknown>("/utility/trending");

    const axiosRes = res as { data?: unknown };
    const payload = axiosRes.data ? axiosRes.data : res;

    const root = payload as { data?: Asset[] } | Asset[];

    if (Array.isArray(root)) return root;
    if (
      root &&
      typeof root === "object" &&
      "data" in root &&
      Array.isArray(root.data)
    )
      return root.data;

    return [];
  },

  getTransactions: async (
    limit = 20,
    offset = 0,
  ): Promise<TransactionsResponse> => {
    const res = await apiClient.get<unknown, unknown>(
      `/transactions/?limit=${limit}&offset=${offset}`,
    );

    const axiosRes = res as { data?: unknown };
    const payload = axiosRes.data ? axiosRes.data : res;

    // Cast through unknown to avoid structural overlap errors from the compiler
    const root = payload as unknown as TransactionsResponse;

    if (root?.transactions) {
      return root;
    }

    const nestedRoot = payload as { data?: TransactionsResponse };
    if (nestedRoot?.data?.transactions) {
      return nestedRoot.data;
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
