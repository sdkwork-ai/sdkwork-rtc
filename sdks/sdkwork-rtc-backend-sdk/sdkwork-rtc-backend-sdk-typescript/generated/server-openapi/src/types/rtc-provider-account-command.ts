export interface RtcProviderAccountCommand {
  provider: string;
  code: string;
  name: string;
  status?: 'active' | 'disabled' | 'archived';
  environment: 'development' | 'test' | 'staging' | 'production' | 'demo';
  externalTenantId?: string | null;
  cloudAccountId?: string | null;
  projectId?: string | null;
  resourceGroupId?: string | null;
}
