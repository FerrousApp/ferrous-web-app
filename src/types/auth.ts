// src/types/auth.ts

// src/types/auth.ts
export interface User {
  id: string;
  email: string;
  role: string;
  account_status: string;
  busha_status: string;
  name?: string; // Add this
  firstName?: string; // Add this
  lastName?: string; // Add this
  avatar?: string; // Add this
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
