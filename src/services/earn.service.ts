// src/services/earn.service.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import type { MarketMeta } from "../types/dashboard";
import type {
  EarnAsset,
  InvestmentQuotePayload,
  InvestmentQuoteResponse,
  InvestmentExecutePayload,
  InvestmentExecuteResponse,
} from "../types/earn";

const unwrapPayload = <T>(res: unknown): T => {
  let current = res;

  if (
    current &&
    typeof current === "object" &&
    "data" in current &&
    "headers" in current &&
    "config" in current
  ) {
    current = (current as { data: unknown }).data;
  }

  if (
    current &&
    typeof current === "object" &&
    "data" in current &&
    (current as { data: unknown }).data !== undefined
  ) {
    return (current as { data: T }).data;
  }

  return current as T;
};

const earnApi = {
  getEarnAssets: async (): Promise<EarnAsset[]> => {
    const res = await apiClient.get<unknown, unknown>("/market/assets");
    const root = res as Record<string, unknown>;
    const data1 = root?.data as Record<string, unknown> | undefined;

    const meta = (root?.meta || data1?.meta) as MarketMeta | undefined;

    if (meta) {
      const globalRate = Number(meta.global_usd_ngn_rate);
      const buyRate = Number(meta.global_usd_ngn_buy_rate);
      const sellRate = Number(meta.global_usd_ngn_sell_rate);

      useUIStore.getState().setExchangeRates({
        global:
          Number.isFinite(globalRate) && globalRate > 0
            ? globalRate
            : undefined,
        buy: Number.isFinite(buyRate) && buyRate > 0 ? buyRate : undefined,
        sell: Number.isFinite(sellRate) && sellRate > 0 ? sellRate : undefined,
      });
    }

    if (Array.isArray(res)) return res as EarnAsset[];
    if (Array.isArray(root?.data)) return root.data as EarnAsset[];
    if (Array.isArray(data1?.data)) return data1.data as EarnAsset[];

    return [];
  },

  getInvestmentQuote: async (
    payload: InvestmentQuotePayload,
  ): Promise<InvestmentQuoteResponse> => {
    const res = await apiClient.post<unknown, unknown>(
      "/investments/quote",
      payload,
    );
    return unwrapPayload<InvestmentQuoteResponse>(res);
  },

  executeInvestment: async (
    payload: InvestmentExecutePayload,
  ): Promise<InvestmentExecuteResponse> => {
    const idempotencyKey = crypto.randomUUID();

    const res = await apiClient.post<unknown, InvestmentExecuteResponse>(
      "/investments/execute",
      {
        ...payload,
        amountInNgn: Number(payload.amountInNgn),
      },
      {
        headers: {
          "x-idempotency-key": idempotencyKey,
        },
      },
    );
    return res;
  },

  executeSwapFinalization: async (transactionId: string): Promise<void> => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error(
        "Authentication token required for blockchain execution.",
      );
    }

    await apiClient.post(
      "/investments/execute-swap",
      { transactionId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
  },
};

export const useEarnAssets = () =>
  useQuery({ queryKey: ["earn-assets"], queryFn: earnApi.getEarnAssets });

export const useInvestmentQuote = () =>
  useMutation({
    mutationFn: (payload: InvestmentQuotePayload) =>
      earnApi.getInvestmentQuote(payload),
  });

export const useExecuteInvestment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InvestmentExecutePayload) =>
      earnApi.executeInvestment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};

export const useExecuteSwap = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) =>
      earnApi.executeSwapFinalization(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};
