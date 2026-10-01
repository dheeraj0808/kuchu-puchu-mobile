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
  /** Guide contract: returned with the tokens after OTP verify (M06). */
  nextStep?: OnboardingStep;
}

/** backend/src/common/onboarding/onboarding-status.service.ts */
export type OnboardingStep = 'selfie' | 'photos' | 'profile' | 'preferences' | 'done';

/**
 * GET /auth/me (MeResponseDto). `profile` is typed loosely until the profile
 * screens (M09) consume it. `nextStep` is not returned yet (M06); until it
 * is, the gate treats a missing value as 'done'.
 */
export type Plan = 'free' | 'basic' | 'plus' | 'premium';

export type Gender = 'woman' | 'man' | 'non_binary' | 'other';
export type LookingFor = 'long_term' | 'marriage' | 'short_term' | 'friends' | 'not_sure';

/** POST /profile — screen 10. dateOfBirth is ISO YYYY-MM-DD and locked once saved. */
export interface ProfileBasics {
  firstName: string;
  dateOfBirth: string;
  gender: Gender;
  showGender: boolean;
}

/** PATCH /profile — screen 11. Every field optional; `{}` records a skip. */
export interface ProfileAbout {
  bio?: string;
  jobTitle?: string;
  education?: string;
  lookingFor?: LookingFor;
}

export interface CatalogInterest {
  id: string;
  name: string;
}

/** GET /catalog/interests */
export interface InterestCategory {
  id: string;
  name: string;
  interests: CatalogInterest[];
}

/** GET /catalog/prompts */
export interface PromptQuestion {
  id: string;
  text: string;
}

/** PUT /profile/prompts item */
export interface PromptAnswer {
  promptId: string;
  answer: string;
}

/**
 * The owner's profile (GET /auth/me → profile). `aboutCompletedAt` and
 * `promptsCompletedAt` record that the skippable steps were finished or
 * skipped, so onboarding resumes at the right screen on any device.
 */
export interface Profile extends ProfileBasics, ProfileAbout {
  interestIds: string[];
  prompts: PromptAnswer[];
  aboutCompletedAt: string | null;
  promptsCompletedAt: string | null;
}

export type ShowMe = 'men' | 'women' | 'everyone';

/** PUT /preferences (guide M10). */
export interface Preferences {
  showMe: ShowMe;
  ageMin: number;
  ageMax: number;
  maxDistanceKm: number;
}

/** GET /catalog/cities item. */
export interface City {
  id: string;
  name: string;
  state: string;
}

/** PUT /profile/location: rounded GPS coordinates, or a city when permission is denied. */
export type LocationBody = { lat: number; lng: number } | { cityId: string };

/** Where the server places the user. Never coordinates: only how it was set and the city. */
export interface UserLocation {
  source: 'gps' | 'city';
  city: string | null;
}

/**
 * PUT /notifications/devices (guide M20). `token: null` records "Not now"
 * so onboarding can finish without push (assumption until M20 is specified).
 */
export interface PushDeviceBody {
  token: string | null;
  platform: 'android' | 'ios' | 'web';
}

// ---- Verification (guide M11) and photos (M12)

export type FaceStatus = 'none' | 'review' | 'approved' | 'rejected';

/** POST /verification/face/session */
export interface FaceSession {
  sessionId: string;
  provider: 'mock' | 'aws' | 'hyperverge' | 'idfy';
}

/** POST /verification/face/complete — the only source of the selfie decision. */
export interface FaceResult {
  status: 'approved' | 'review' | 'rejected';
  reason?: string;
  attemptsLeft?: number;
}

/** GET /verification */
export interface VerificationState {
  face: {
    status: FaceStatus;
    submittedAt: string | null;
    reviewedAt: string | null;
  };
}

export type PhotoStatus = 'approved' | 'review' | 'rejected';

/** GET /profile/photos item. URLs are signed and change every hour — cache by id, not URL. */
export interface Photo {
  id: string;
  status: PhotoStatus;
  rejectionReason: string | null;
  urls: { thumb: string; medium: string; large: string };
}

/** A prepared file for POST /profile/photos (multipart field `file`). */
export interface PhotoUpload {
  uri: string;
  name: string;
  type: 'image/jpeg';
  width: number;
  height: number;
  size: number | null;
}

// ---- Safety (guide M13 reports, M14 blocks, M15 restrictions)

export type ReportCategory = 'fake_profile' | 'scam' | 'harassment' | 'explicit_content' | 'underage' | 'threats' | 'other';

/** POST /reports — the outcome is never shown to the reporter. */
export interface ReportBody {
  targetUserId: string;
  category: ReportCategory;
  details?: string;
}

/** GET /blocks item. `id` is the block; `userId` the blocked person. */
export interface BlockedUser {
  id: string;
  userId: string;
  name: string;
  blockedAt: string;
}

export type RestrictionReason = 'harassment' | 'scam' | 'fake_profile' | 'explicit_content' | 'underage' | 'threats' | 'spam' | 'other';

/** 403 ACCOUNT_RESTRICTED details (guide §11). */
export interface Restriction {
  status: 'suspended' | 'banned';
  reasonCategory: RestrictionReason;
  /** ISO date; null for bans. */
  endsAt: string | null;
  appealAllowed: boolean;
}

// ---- Discovery (guide M16 matches, M17 likes, M18 discovery)

/** Server-side distance bucket; the exact distance is never sent (guide §9.3). */
export type DistanceBucket = 'lt5' | 'lt10' | 'lt25' | 'lt50' | 'gt50';
export type ProfileBadge = 'live_verified' | 'id_verified';

export interface ProfilePhoto {
  id: string;
  urls: { thumb: string; medium: string; large: string };
}

/** GET /discovery item. */
export interface DiscoveryCard {
  userId: string;
  name: string;
  age: number;
  city: string;
  distanceBucket: DistanceBucket;
  badges: ProfileBadge[];
  photos: ProfilePhoto[];
  topPrompt: { question: string; answer: string } | null;
}

/** GET /profiles/:userId */
export interface ProfileDetail extends DiscoveryCard {
  bio: string | null;
  jobTitle: string | null;
  prompts: { question: string; answer: string }[];
  interests: { id: string; name: string; shared: boolean }[];
}

/** POST /likes */
export interface LikeResult {
  matched: boolean;
  matchId?: string;
}

/** 409 DISCOVERY_NOT_READY details.missing */
export type DiscoveryMissing = 'selfie' | 'photos' | 'profile' | 'preferences' | 'location';

export interface Me extends User {
  profile: Profile | null;
  /** Selfie state for the onboarding gate (assumption until M11 adds it to /auth/me). */
  faceStatus?: FaceStatus;
  /**
   * Preferences-step progress (assumption until M10/M20 ship): the onboarding
   * gate reads these to resume at preferences → location → notifications.
   */
  preferences?: Preferences | null;
  location?: UserLocation | null;
  notificationsChoiceAt?: string | null;
  /** Provisional until billing (M21) ships GET /billing/me; absent from the real API today. */
  plan?: Plan;
}

/** GET /auth/sessions item (guide M06). */
export interface DeviceSession {
  id: string;
  deviceName: string;
  /** Approximate city from the sign-in IP; null when unknown. */
  city: string | null;
  lastActiveAt: string;
  isCurrent: boolean;
}

/** POST /auth/reauth/request */
export interface ReauthRequestResponse {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

/** POST /auth/reauth/verify — the server remembers the step-up for this session. */
export interface ReauthVerifyResponse {
  validForSeconds: number;
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
