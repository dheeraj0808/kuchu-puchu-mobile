/**
 * Types mirroring the backend DTOs (backend/src/auth/dto, backend/src/users/dto).
 * Success: `{ success: true, data, meta? }`. Error: `{ success: false, code, message, details?, requestId? }`.
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

/** backend/src/common/onboarding/onboarding-status.service.ts */
export type OnboardingStep = 'selfie' | 'photos' | 'profile' | 'preferences' | 'done';

/**
 * GET /auth/me (MeResponseDto). `profile` is typed loosely until the profile
 * screens (M09) consume it. `nextStep` is not returned yet (M06); until it
 * is, the gate treats a missing value as 'done'.
 */
export interface Me extends User {
  profile: Record<string, unknown> | null;
  nextStep?: OnboardingStep;
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
