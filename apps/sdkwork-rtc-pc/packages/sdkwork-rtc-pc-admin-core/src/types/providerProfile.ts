import type { RtcProviderProfile } from "@sdkwork/rtc-backend-sdk";

/** RTC provider profile admin view model — the generated SDK `RtcProviderProfile` (contract authority). */
export type ProviderProfile = RtcProviderProfile;

export interface ProviderProfileCommand {
  provider: string;
  code: string;
  name: string;
  status?: "active" | "disabled" | "archived";
  isDefault: boolean;
  priority: number;
  environment: string;
  region?: string;
  providerApplicationId?: string;
  providerAppId?: string;
  endpoint?: string;
  credentialRef?: string;
  webhookSecretRef?: string;
  capabilities: {
    audio: boolean;
    video: boolean;
    live: boolean;
    liveBroadcast?: boolean;
    liveAudience?: boolean;
    cdnRelay?: boolean;
    screenShare: boolean;
    recording: boolean;
    webhook: boolean;
    activeQuery: boolean;
    maxParticipants?: number | null;
    supportedRegions: string[];
    providerFeatures: Record<string, unknown>;
  };
  configSnapshot: Record<string, unknown>;
}
