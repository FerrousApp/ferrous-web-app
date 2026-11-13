// src/services/earn.service.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import type {
  EarnAsset,
  InvestmentQuotePayload,
  InvestmentQuoteResponse,
  InvestmentExecutePayload,
  InvestmentExecuteResponse,
} from "../types/earn";
import type { SuccessResponse } from "../types/auth";

const earnApi = {
  getEarnAssets: async (): Promise<EarnAsset[]> => {
    const res = await apiClient.get<unknown, unknown>("/market/assets");
    const root = res as Record<string, unknown>;
    const data1 = root?.data as Record<string, unknown> | undefined;

    const meta = (root?.meta || data1?.meta) as
      | Record<string, unknown>
      | undefined;

    if (meta?.global_usd_ngn_rate) {
      useUIStore.getState().setExchangeRate(Number(meta.global_usd_ngn_rate));
    }

    if (Array.isArray(res)) return res as EarnAsset[];
    if (Array.isArray(root?.data)) return root.data as EarnAsset[];
    if (Array.isArray(data1?.data)) return data1.data as EarnAsset[];

    return [];
  },

  getInvestmentQuote: async (
    payload: InvestmentQuotePayload,
  ): Promise<InvestmentQuoteResponse> => {
    const res = await apiClient.post<
      unknown,
      SuccessResponse<InvestmentQuoteResponse>
    >("/investments/quote", payload);
    return res.data;
  },

  executeInvestment: async (
    payload: InvestmentExecutePayload,
  ): Promise<InvestmentExecuteResponse> => {
    const idempotencyKey = crypto.randomUUID();

    const res = await apiClient.post<unknown, InvestmentExecuteResponse>(
      "/investments/execute",
      payload,
      {
        headers: {
          "x-idempotency-key": idempotencyKey,
        },
      },
    );
    return res;
  },

  executeSwapFinalization: async (transactionId: string): Promise<void> => {
    // FIX: Changed from .token to .accessToken based on AuthState interface
    const token = useAuthStore.getState().accessToken;
    if (!token)
      throw new Error(
        "Authentication token required for blockchain execution.",
      );

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

export const useExecuteInvestment = () =>
  useMutation({
    mutationFn: (payload: InvestmentExecutePayload) =>
      earnApi.executeInvestment(payload),
  });

export const useExecuteSwap = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) =>
      earnApi.executeSwapFinalization(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};
