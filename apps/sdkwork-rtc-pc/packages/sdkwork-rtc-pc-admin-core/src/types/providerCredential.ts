import type { RtcProviderCredential } from "@sdkwork/rtc-backend-sdk";

/** RTC provider credential admin view model — the generated SDK `RtcProviderCredential` (contract authority). */
export type ProviderCredential = RtcProviderCredential;

export interface ProviderCredentialCommand {
  credentialRole: string;
  credentialKind?: string;
  credentialLabel: string;
  credentialRef: string;
  /**
   * Write-only provider secret. The backend seals it with the deployment master
   * secret before persistence; it is never echoed back by the API.
   */
  credentialSecret?: string;
  credentialFingerprint?: string;
  secretVersion?: string;
  status?: "active" | "pending" | "disabled";
  validFrom?: string;
  expiresAt?: string;
  rotationDueAt?: string;
}
