// src/services/transfers.service.ts
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import type {
  DvaResponse,
  WithdrawalPayload,
  WithdrawalResponse,
} from "../types/transfers";
import type { SuccessResponse } from "../types/auth";

const transfersApi = {
  getDva: async (): Promise<DvaResponse> => {
    const res = await apiClient.get<unknown, SuccessResponse<DvaResponse>>(
      "/wallet/dva",
    );

    // Safely wrap the response if the backend returns a direct array instead of an object
    if (Array.isArray(res.data)) {
      return { dvas: res.data, dva: null };
    }

    return res.data;
  },

  requestWithdrawal: async (
    payload: WithdrawalPayload,
  ): Promise<WithdrawalResponse> => {
    const idempotencyKey = crypto.randomUUID();

    const res = await apiClient.post<
      unknown,
      SuccessResponse<WithdrawalResponse>
    >("/withdrawals", payload, {
      headers: {
        "x-idempotency-key": idempotencyKey,
      },
    });
    return res.data;
  },
};

// React Query Hooks
export const useDepositAccount = () =>
  useQuery({ queryKey: ["deposit-account"], queryFn: transfersApi.getDva });

export const useWithdrawal = () =>
  useMutation({
    mutationFn: (payload: WithdrawalPayload) =>
      transfersApi.requestWithdrawal(payload),
  });
