import type { RtcProviderCapabilitySnapshot } from './rtc-provider-capability-snapshot';

export interface RtcProviderProfileCommand {
  provider: string;
  code: string;
  name: string;
  status?: 'active' | 'disabled' | 'archived';
  isDefault?: boolean;
  priority?: number;
  environment: 'development' | 'test' | 'staging' | 'production' | 'demo';
  region?: string | null;
  providerApplicationId?: string | null;
  providerAppId?: string | null;
  endpoint?: string | null;
  credentialRef?: string | null;
  webhookSecretRef?: string | null;
  capabilities: RtcProviderCapabilitySnapshot;
  configSnapshot: Record<string, unknown>;
}
