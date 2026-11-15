import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import type {
  DvaResponse,
  WithdrawalPayload,
  WithdrawalResponse,
  SavedBank,
  SaveBankPayload,
} from "../types/transfers";
import type { SuccessResponse } from "../types/auth";

const transfersApi = {
  getDva: async (): Promise<DvaResponse> => {
    const res = await apiClient.get<unknown, SuccessResponse<DvaResponse>>(
      "/wallet/dva",
    );
    if (Array.isArray(res.data)) {
      return { dvas: res.data, dva: null };
    }
    return res.data;
  },

  getSavedBanks: async (): Promise<SavedBank[]> => {
    const res = await apiClient.get<unknown, SuccessResponse<SavedBank[]>>(
      "/utilities/banks",
    );
    return res.data;
  },

  saveBank: async (payload: SaveBankPayload): Promise<SavedBank> => {
    const res = await apiClient.post<unknown, SuccessResponse<SavedBank>>(
      "/utilities/banks",
      payload,
    );
    return res.data;
  },

  requestWithdrawal: async (
    payload: WithdrawalPayload,
  ): Promise<WithdrawalResponse> => {
    const idempotencyKey = crypto.randomUUID();
    // Pointed to the initiate endpoint as requested
    const res = await apiClient.post<
      unknown,
      SuccessResponse<WithdrawalResponse>
    >("/withdrawals/initiate", payload, {
      headers: { "x-idempotency-key": idempotencyKey },
    });
    return res.data;
  },
};

// React Query Hooks
export const useDepositAccount = () =>
  useQuery({ queryKey: ["deposit-account"], queryFn: transfersApi.getDva });

export const useSavedBanks = () =>
  useQuery({ queryKey: ["saved-banks"], queryFn: transfersApi.getSavedBanks });

export const useSaveBank = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveBankPayload) => transfersApi.saveBank(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-banks"] });
    },
  });
};

export const useWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WithdrawalPayload) =>
      transfersApi.requestWithdrawal(payload),
    onSuccess: () => {
      // Backend Request: Optimistically refetch balances and tx pipeline instantly
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};
