// src/types/auth.ts
export interface User {
  id: string;
  email: string;
  role: string;
  account_status: string;
  busha_status: string;
  privy_did?: string | null;
  has_consented_to_terms?: boolean;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession extends AuthTokens {
  user: User;
}

export interface GoogleSignInPayload {
  token: string;
  device_name?: string;
  os_version?: string;
  ip_address?: string;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
  };
}
