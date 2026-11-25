// src/services/dashboard.service.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import { useUIStore } from "../store/uiStore";
import {
  getEffectiveStatus,
  isTransactionActionable,
  isTransactionInProgress,
} from "../lib/transactionStatus";
import type {
  Asset,
  MarketMeta,
  TransactionsResponse,
} from "../types/dashboard";

const ENVELOPE_KEYS = new Set(["success", "status", "message", "meta"]);

const parseBalanceValue = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") return parseFloat(value || "0") || 0;

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("amount" in obj && obj.amount !== undefined) {
      return parseFloat(String(obj.amount || "0")) || 0;
    }
    if ("fiat" in obj && obj.fiat && typeof obj.fiat === "object") {
      const fiat = obj.fiat as Record<string, unknown>;
      if ("amount" in fiat && fiat.amount !== undefined) {
        return parseFloat(String(fiat.amount || "0")) || 0;
      }
    }
  }

  return 0;
};

const syncMarketMeta = (res: unknown): void => {
  if (!res || typeof res !== "object") return;
  const root = res as Record<string, unknown>;
  const data1 = root.data as Record<string, unknown> | undefined;
  const meta = (root.meta || data1?.meta) as MarketMeta | undefined;

  if (!meta) return;

  const globalRate = Number(meta.global_usd_ngn_rate);
  const buyRate = Number(meta.global_usd_ngn_buy_rate);
  const sellRate = Number(meta.global_usd_ngn_sell_rate);

  useUIStore.getState().setExchangeRates({
    global:
      Number.isFinite(globalRate) && globalRate > 0 ? globalRate : undefined,
    buy: Number.isFinite(buyRate) && buyRate > 0 ? buyRate : undefined,
    sell: Number.isFinite(sellRate) && sellRate > 0 ? sellRate : undefined,
  });
};

const extractBalances = (payload: unknown): Record<string, unknown> | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (
    "balances" in record &&
    record.balances &&
    typeof record.balances === "object" &&
    !Array.isArray(record.balances)
  ) {
    return record.balances as Record<string, unknown>;
  }

  if ("data" in record && record.data && typeof record.data === "object") {
    return extractBalances(record.data);
  }

  const entries = Object.entries(record).filter(
    ([key]) => !ENVELOPE_KEYS.has(key),
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
};

const extractArray = <T>(payload: unknown): T[] | null => {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload)) return payload as T[];

  const record = payload as Record<string, unknown>;
  if ("data" in record && record.data) {
    return extractArray<T>(record.data);
  }

  return null;
};

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
    const rawBalances = extractBalances(res) || {};

    const parsedBalances: Record<string, number> = {
      NGN: parseBalanceValue(rawBalances.NGN),
    };

    for (const [key, value] of Object.entries(rawBalances)) {
      if (key === "NGN") continue;
      parsedBalances[key] = parseBalanceValue(value);
    }

    return parsedBalances;
  },

  getMarketAssets: async (): Promise<Asset[]> => {
    const res = await apiClient.get<unknown, unknown>("/market/assets");
    syncMarketMeta(res);
    return extractArray<Asset>(res) || [];
  },

  getTrendingAssets: async (): Promise<Asset[]> => {
    const res = await apiClient.get<unknown, unknown>("/utility/trending");
    syncMarketMeta(res);
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
    refetchInterval: (query) => {
      const txs = query.state.data?.transactions ?? [];
      const hasActive = txs.some((tx) => {
        const eff = getEffectiveStatus(tx);
        return isTransactionInProgress(eff) || isTransactionActionable(eff);
      });
      return hasActive ? 5000 : 15000;
    },
  });
