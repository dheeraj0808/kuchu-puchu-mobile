/**
 * Types mirroring the backend DTOs (backend/src/auth/dto, backend/src/users/dto).
 * Every successful response is wrapped as `{ success: true, data, timestamp }`.
 */

export type IdentifierType = 'email' | 'phone';

export type UserStatus = 'active' | 'suspended' | 'deactivated';
export type UserRole = 'user' | 'moderator' | 'admin';

/** UserResponseDto */
export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
}

/** POST /auth/request-otp body (RequestOtpDto) */
export interface RequestOtpBody {
  identifierType: IdentifierType;
  identifier: string;
}

/** RequestOtpResponse */
export interface RequestOtpResponse {
  message: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

/** POST /auth/verify-otp body (VerifyOtpDto) */
export interface VerifyOtpBody {
  identifierType: IdentifierType;
  identifier: string;
  otp: string;
  deviceId?: string;
  deviceName?: string;
}

/** AuthTokensResponse */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: string;
  user: User;
}

/** MessageResponse */
export interface MessageResponse {
  message: string;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ErrorEnvelope {
  success: false;
  message: string;
  code: string;
  timestamp: string;
  path: string;
  requestId?: string;
  details?: Record<string, unknown>;
}
