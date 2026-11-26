// src/services/earn.service.ts
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import type { MarketMeta } from "../types/dashboard";
import type {
  EarnAsset,
  ExecuteSwapResponse,
  InvestmentQuotePayload,
  InvestmentQuoteResponse,
  InvestmentExecutePayload,
  InvestmentExecuteResponse,
  LiquidationQuotePayload,
  LiquidationQuoteResponse,
  LiquidationExecutePayload,
  LiquidationExecuteResponse,
} from "../types/earn";

const unwrapAxiosBody = (res: unknown): Record<string, unknown> => {
  if (!res || typeof res !== "object") return {};
  const record = res as Record<string, unknown>;

  if (
    "data" in record &&
    "headers" in record &&
    "config" in record &&
    record.data &&
    typeof record.data === "object"
  ) {
    return record.data as Record<string, unknown>;
  }

  return record;
};

const unwrapPayload = <T>(res: unknown): T => {
  const body = unwrapAxiosBody(res);
  if ("data" in body && body.data !== undefined) {
    return body.data as T;
  }
  return body as T;
};

const earnApi = {
  getEarnAssets: async (): Promise<EarnAsset[]> => {
    const res = await apiClient.get<unknown, unknown>("/market/assets");
    const root = unwrapAxiosBody(res);
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

    const res = await apiClient.post<unknown, unknown>(
      "/investments/execute",
      {
        ...payload,
        amountInNgn: Number(payload.amountInNgn),
      },
      {
        headers: {
          "x-idempotency-key": idempotencyKey,
          "Content-Type": "application/json",
        },
      },
    );

    const body = unwrapAxiosBody(res);
    const inner = (body.data as Record<string, unknown> | undefined) ?? body;
    const tx = (inner.transaction ?? body.transaction) as
      | { id?: string; reference?: string; status?: string }
      | undefined;

    if (!tx?.id) {
      throw new Error(
        "Investment initiated, but no transaction ID was returned.",
      );
    }

    return {
      status: typeof body.status === "string" ? body.status : undefined,
      message: typeof body.message === "string" ? body.message : undefined,
      transaction: {
        id: tx.id,
        reference: tx.reference,
        status: tx.status,
      },
    };
  },

  executeSwapFinalization: async (
    transactionId: string,
  ): Promise<ExecuteSwapResponse> => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error(
        "Authentication token required for blockchain execution.",
      );
    }

    const res = await apiClient.post<unknown, unknown>(
      "/investments/execute-swap",
      { transactionId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const body = unwrapAxiosBody(res);
    const inner = (body.data as Record<string, unknown> | undefined) ?? body;

    return {
      status:
        (typeof inner.status === "string" && inner.status) ||
        (typeof body.status === "string" && body.status) ||
        "SUCCESS",
      txHash: typeof inner.txHash === "string" ? inner.txHash : "",
      bondOutputTokens:
        inner.bondOutputTokens !== undefined
          ? String(inner.bondOutputTokens)
          : "",
      message:
        typeof body.message === "string"
          ? body.message
          : "Bond asset purchased and secured in your wallet.",
    };
  },

  getLiquidationQuote: async (
    payload: LiquidationQuotePayload,
  ): Promise<LiquidationQuoteResponse> => {
    const res = await apiClient.post<unknown, unknown>(
      "/liquidations/quote",
      {
        assetId: payload.assetId,
        amountInAsset: Number(payload.amountInAsset),
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    return unwrapPayload<LiquidationQuoteResponse>(res);
  },

  executeLiquidation: async (
    payload: LiquidationExecutePayload,
  ): Promise<LiquidationExecuteResponse> => {
    const res = await apiClient.post<unknown, unknown>(
      "/liquidations/execute",
      {
        assetId: payload.assetId,
        amountInAsset: Number(payload.amountInAsset),
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const body = unwrapAxiosBody(res);
    const inner = (body.data as Record<string, unknown> | undefined) ?? body;

    if (typeof inner.id !== "string" || !inner.id) {
      throw new Error(
        "Liquidation accepted, but no transaction ID was returned.",
      );
    }

    return {
      id: inner.id,
      reference: typeof inner.reference === "string" ? inner.reference : "",
      status:
        typeof inner.status === "string"
          ? inner.status
          : "PROCESSING_ON_CHAIN_SWAP",
      created_at:
        typeof inner.created_at === "string"
          ? inner.created_at
          : new Date().toISOString(),
      message: typeof body.message === "string" ? body.message : undefined,
    };
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["balances"],
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: ["transactions"],
          refetchType: "all",
        }),
      ]);
    },
  });
};

export const useExecuteSwap = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) =>
      earnApi.executeSwapFinalization(transactionId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["balances"],
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: ["transactions"],
          refetchType: "all",
        }),
      ]);
    },
  });
};

export const useLiquidationQuote = (
  assetId: string | undefined,
  amountInAsset: number,
  enabled: boolean,
  debounceMs = 500,
) => {
  const [debouncedAmount, setDebouncedAmount] = useState<number>(amountInAsset);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedAmount(amountInAsset);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [amountInAsset, debounceMs]);

  const isAmountValid = Number.isFinite(debouncedAmount) && debouncedAmount > 0;
  const isDebouncing =
    enabled &&
    Number.isFinite(amountInAsset) &&
    amountInAsset > 0 &&
    amountInAsset !== debouncedAmount;

  const query = useQuery({
    queryKey: ["liquidation-quote", assetId, debouncedAmount],
    queryFn: () =>
      earnApi.getLiquidationQuote({
        assetId: assetId as string,
        amountInAsset: debouncedAmount,
      }),
    enabled: Boolean(enabled && assetId && isAmountValid),
    retry: false,
    staleTime: 15000,
  });

  return {
    ...query,
    isDebouncing,
  };
};

export const useExecuteLiquidation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LiquidationExecutePayload) =>
      earnApi.executeLiquidation(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["balances"],
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: ["transactions"],
          refetchType: "all",
        }),
      ]);
    },
  });
};
