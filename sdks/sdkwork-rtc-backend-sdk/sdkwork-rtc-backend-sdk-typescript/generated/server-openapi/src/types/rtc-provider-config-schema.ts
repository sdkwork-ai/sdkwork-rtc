import type { RtcProviderConfigFieldSchema } from './rtc-provider-config-field-schema';
import type { RtcProviderCredentialRoleSchema } from './rtc-provider-credential-role-schema';

export interface RtcProviderConfigSchema {
  provider: string;
  displayName: string;
  description: string;
  /** Catalog status of the provider kind: implemented kinds have a runtime adapter; planned kinds are vendor-catalog entries only and every configuration write against them is rejected. */
  adapterStatus: 'implemented' | 'planned';
  accountFields: RtcProviderConfigFieldSchema[];
  applicationFields: RtcProviderConfigFieldSchema[];
  credentialRoles: RtcProviderCredentialRoleSchema[];
  profileFields: RtcProviderConfigFieldSchema[];
  optionalCapabilities: string[];
  requiredCapabilities: string[];
}
