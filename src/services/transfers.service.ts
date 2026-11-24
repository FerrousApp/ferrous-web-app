// src/services/transfers.service.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import type {
  BankOption,
  DvaDetails,
  DvaResponse,
  ResolveBankPayload,
  ResolveBankResponse,
  SaveBankPayload,
  SavedBank,
  WithdrawalPayload,
  WithdrawalResponse,
} from "../types/transfers";

const unwrapResponse = <T>(res: unknown): T => {
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

const transfersApi = {
  getDva: async (): Promise<DvaResponse> => {
    const res = await apiClient.get<unknown, unknown>("/wallet/dva");
    const data = unwrapResponse<DvaResponse | DvaDetails[]>(res);

    if (Array.isArray(data)) {
      return { dvas: data, dva: null };
    }

    return data;
  },

  getBankList: async (): Promise<BankOption[]> => {
    const res = await apiClient.get<unknown, unknown>("/utility/banks/list");
    const data = unwrapResponse<BankOption[]>(res);
    return Array.isArray(data) ? data : [];
  },

  resolveBank: async (
    payload: ResolveBankPayload,
  ): Promise<ResolveBankResponse> => {
    const res = await apiClient.post<unknown, unknown>(
      "/utility/banks/resolve",
      payload,
    );
    return unwrapResponse<ResolveBankResponse>(res);
  },

  getSavedBanks: async (): Promise<SavedBank[]> => {
    const res = await apiClient.get<unknown, unknown>("/utility/banks");
    const data = unwrapResponse<SavedBank[]>(res);
    return Array.isArray(data) ? data : [];
  },

  saveBank: async (payload: SaveBankPayload): Promise<SavedBank> => {
    const res = await apiClient.post<unknown, unknown>(
      "/utility/banks",
      payload,
    );
    return unwrapResponse<SavedBank>(res);
  },

  deleteBank: async (accountId: string): Promise<void> => {
    await apiClient.delete<unknown, unknown>(`/utility/banks/${accountId}`);
  },

  requestWithdrawal: async (
    payload: WithdrawalPayload,
  ): Promise<WithdrawalResponse> => {
    const idempotencyKey = crypto.randomUUID();
    const res = await apiClient.post<unknown, unknown>(
      "/withdrawals",
      {
        amountInNgn: Number(payload.amountInNgn),
        savedBankId: payload.savedBankId,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
      },
    );
    return unwrapResponse<WithdrawalResponse>(res);
  },
};

export const useDepositAccount = () =>
  useQuery({
    queryKey: ["deposit-account"],
    queryFn: transfersApi.getDva,
  });

export const useBankList = (enabled = true) =>
  useQuery({
    queryKey: ["bank-list"],
    queryFn: transfersApi.getBankList,
    enabled,
    staleTime: 1000 * 60 * 60,
  });

export const useResolveBankAccount = (
  accountNumber: string,
  bankCode: string,
) =>
  useQuery({
    queryKey: ["resolve-bank", accountNumber, bankCode],
    queryFn: () =>
      transfersApi.resolveBank({
        account_number: accountNumber,
        bank_code: bankCode,
      }),
    enabled: accountNumber.length === 10 && bankCode.length > 0,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

export const useSavedBanks = () =>
  useQuery({
    queryKey: ["saved-banks"],
    queryFn: transfersApi.getSavedBanks,
  });

export const useSaveBank = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveBankPayload) => transfersApi.saveBank(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-banks"] });
    },
  });
};

export const useDeleteBank = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => transfersApi.deleteBank(accountId),
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
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};
