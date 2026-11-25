// src/lib/transactionStatus.ts
export type PendingTransactionStatus =
  | "pending"
  | "processing"
  | "initiated"
  | "PROCESSING_FIAT_RAMP"
  | "PENDING_ON_CHAIN"
  | "PROCESSING_ON_CHAIN_SWAP"
  | "AWAITING_BUSHA_DEPOSIT"
  | "PROCESSING_FIAT_PAYOUT";

export type ActionableTransactionStatus =
  | "USDC_DELIVERED"
  | "AWAITING_ON_CHAIN_RETRY";

export type TerminalTransactionStatus =
  | "success"
  | "completed"
  | "failed"
  | "failed_usdc_retained"
  | "reversed"
  | "cancelled"
  | "expired";

export type TransactionStatus =
  | PendingTransactionStatus
  | ActionableTransactionStatus
  | TerminalTransactionStatus;

export type StatusCategory = "pending" | "actionable" | "success" | "failed";

export interface TransactionStatusMeta {
  label: string;
  category: StatusCategory;
  icon: string;
  color: string;
  bg: string;
  spin?: boolean;
}

export const PENDING_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "processing",
  "initiated",
  "PROCESSING_FIAT_RAMP",
  "PENDING_ON_CHAIN",
  "PROCESSING_ON_CHAIN_SWAP",
  "AWAITING_BUSHA_DEPOSIT",
  "PROCESSING_FIAT_PAYOUT",
]);

export const ACTIONABLE_STATUSES: ReadonlySet<string> = new Set([
  "USDC_DELIVERED",
  "AWAITING_ON_CHAIN_RETRY",
]);

export const SUCCESS_STATUSES: ReadonlySet<string> = new Set([
  "success",
  "completed",
]);

export const FAILED_STATUSES: ReadonlySet<string> = new Set([
  "failed",
  "failed_usdc_retained",
  "reversed",
  "cancelled",
  "expired",
]);

export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  ...SUCCESS_STATUSES,
  ...FAILED_STATUSES,
]);

export const isTransactionInProgress = (status?: string): boolean =>
  Boolean(status && PENDING_STATUSES.has(status));

export const isTransactionActionable = (status?: string): boolean =>
  Boolean(status && ACTIONABLE_STATUSES.has(status));

export const isTransactionSuccess = (status?: string): boolean =>
  Boolean(status && SUCCESS_STATUSES.has(status));

export const isTransactionFailed = (status?: string): boolean =>
  Boolean(status && FAILED_STATUSES.has(status));

export const isTransactionTerminal = (status?: string): boolean =>
  Boolean(status && TERMINAL_STATUSES.has(status));

export const getEffectiveStatus = (tx?: {
  status?: string;
  granular_status?: string;
}): string => {
  if (!tx) return "pending";
  if (tx.granular_status && TERMINAL_STATUSES.has(tx.granular_status)) {
    return tx.granular_status;
  }
  if (tx.status && TERMINAL_STATUSES.has(tx.status)) {
    return tx.status;
  }
  return tx.granular_status || tx.status || "pending";
};

const STATUS_META_MAP: Record<string, TransactionStatusMeta> = {
  // Pending / In-progress
  pending: {
    label: "Pending",
    category: "pending",
    icon: "sync",
    color: "text-tertiary",
    bg: "bg-tertiary-fixed",
    spin: true,
  },
  processing: {
    label: "Processing",
    category: "pending",
    icon: "sync",
    color: "text-tertiary",
    bg: "bg-tertiary-fixed",
    spin: true,
  },
  initiated: {
    label: "Initiated",
    category: "pending",
    icon: "schedule",
    color: "text-tertiary",
    bg: "bg-tertiary-fixed",
  },
  PROCESSING_FIAT_RAMP: {
    label: "Processing Fiat",
    category: "pending",
    icon: "sync",
    color: "text-tertiary",
    bg: "bg-tertiary-fixed",
    spin: true,
  },
  PENDING_ON_CHAIN: {
    label: "Confirming On-Chain",
    category: "pending",
    icon: "sync",
    color: "text-tertiary",
    bg: "bg-tertiary-fixed",
    spin: true,
  },
  PROCESSING_ON_CHAIN_SWAP: {
    label: "Swapping On-Chain",
    category: "pending",
    icon: "sync",
    color: "text-tertiary",
    bg: "bg-tertiary-fixed",
    spin: true,
  },
  AWAITING_BUSHA_DEPOSIT: {
    label: "Awaiting Deposit",
    category: "pending",
    icon: "hourglass_top",
    color: "text-tertiary",
    bg: "bg-tertiary-fixed",
  },
  PROCESSING_FIAT_PAYOUT: {
    label: "Sending Payout",
    category: "pending",
    icon: "sync",
    color: "text-tertiary",
    bg: "bg-tertiary-fixed",
    spin: true,
  },

  // Actionable / Retryable
  USDC_DELIVERED: {
    label: "Action Required",
    category: "actionable",
    icon: "fingerprint",
    color: "text-amber-800",
    bg: "bg-amber-100",
  },
  AWAITING_ON_CHAIN_RETRY: {
    label: "Retry Available",
    category: "actionable",
    icon: "refresh",
    color: "text-amber-800",
    bg: "bg-amber-100",
  },

  // Terminal - Success
  success: {
    label: "Success",
    category: "success",
    icon: "check_circle",
    color: "text-[#1E7E34]",
    bg: "bg-[#EBF9EB]",
  },
  completed: {
    label: "Success",
    category: "success",
    icon: "check_circle",
    color: "text-[#1E7E34]",
    bg: "bg-[#EBF9EB]",
  },

  // Terminal - Failed / Reversed
  failed: {
    label: "Failed",
    category: "failed",
    icon: "cancel",
    color: "text-error",
    bg: "bg-error-container",
  },
  failed_usdc_retained: {
    label: "Failed (USDC Retained)",
    category: "failed",
    icon: "warning",
    color: "text-error",
    bg: "bg-error-container",
  },
  reversed: {
    label: "Reversed",
    category: "failed",
    icon: "undo",
    color: "text-error",
    bg: "bg-error-container",
  },
  cancelled: {
    label: "Cancelled",
    category: "failed",
    icon: "block",
    color: "text-error",
    bg: "bg-error-container",
  },
  expired: {
    label: "Expired",
    category: "failed",
    icon: "timer_off",
    color: "text-error",
    bg: "bg-error-container",
  },
};

export const getTransactionStatusMeta = (
  status?: string,
): TransactionStatusMeta => {
  if (status && STATUS_META_MAP[status]) {
    return STATUS_META_MAP[status];
  }
  return STATUS_META_MAP.pending;
};
