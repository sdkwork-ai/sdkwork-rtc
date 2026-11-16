//! Fail-closed AES-256-GCM envelope for RTC provider credential material.
//!
//! The RTC provider tables store only a sealed envelope plus a non-reversible
//! fingerprint and masked preview. The master secret is deployment
//! configuration (`SDKWORK_RTC_PROVIDER_CREDENTIAL_MASTER_SECRET`); sealing
//! without it is an error, so a misconfigured deployment fails loudly instead
//! of writing recoverable plaintext into the database.

use aes_gcm::{
    Aes256Gcm, Key, Nonce,
    aead::{Aead, AeadCore, KeyInit},
};
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use rand_core::OsRng;
use sha2::{Digest, Sha256};

/// Prefix written in front of every sealed payload.
pub const ENVELOPE_PREFIX: &str = "rtcenc:v1:";
/// Algorithm recorded next to the ciphertext.
pub const ENVELOPE_ALGORITHM: &str = "aes-256-gcm";
/// Key id recorded next to the ciphertext.
pub const PRIMARY_KEY_ID: &str = "local-aes256gcm:primary";
/// Master secret environment variable.
pub const MASTER_SECRET_ENV: &str = "SDKWORK_RTC_PROVIDER_CREDENTIAL_MASTER_SECRET";
/// Comma-separated historical master secrets, tried after the active one.
pub const LEGACY_MASTER_SECRETS_ENV: &str = "SDKWORK_RTC_PROVIDER_CREDENTIAL_LEGACY_MASTER_SECRETS";

const NONCE_LENGTH: usize = 12;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RtcSecretEnvelopeError {
    CipherUnavailable,
    Invalid(String),
}

impl std::fmt::Display for RtcSecretEnvelopeError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::CipherUnavailable => write!(
                formatter,
                "{MASTER_SECRET_ENV} must be configured before RTC provider credentials can be stored or read"
            ),
            Self::Invalid(message) => write!(formatter, "{message}"),
        }
    }
}

impl std::error::Error for RtcSecretEnvelopeError {}

fn env_value(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

/// The configured active master secret, if any.
pub fn active_master_secret() -> Option<String> {
    env_value(MASTER_SECRET_ENV)
}

fn legacy_master_secrets() -> Vec<String> {
    env_value(LEGACY_MASTER_SECRETS_ENV)
        .map(|raw| {
            raw.split(',')
                .map(str::trim)
                .filter(|candidate| !candidate.is_empty())
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

/// Whether sealing is possible in this process.
pub fn sealing_available() -> bool {
    resolve_active_master(active_master_secret()).is_ok()
}

pub fn resolve_active_master(candidate: Option<String>) -> Result<String, RtcSecretEnvelopeError> {
    candidate
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .ok_or(RtcSecretEnvelopeError::CipherUnavailable)
}

/// Seal `plaintext` with the process master secret.
pub fn seal(plaintext: &str) -> Result<SealedRtcSecret, RtcSecretEnvelopeError> {
    let master = resolve_active_master(active_master_secret())?;
    seal_with_master(plaintext, &master)
}

/// A sealed payload plus its key metadata.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SealedRtcSecret {
    pub ciphertext: String,
    pub key_id: String,
    pub algorithm: String,
    pub fingerprint: String,
    pub masked_label: String,
}

pub fn seal_with_master(
    plaintext: &str,
    master: &str,
) -> Result<SealedRtcSecret, RtcSecretEnvelopeError> {
    let key = derive_key(master)?;
    let cipher = Aes256Gcm::new(&key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher.encrypt(&nonce, plaintext.as_bytes()).map_err(|_| {
        RtcSecretEnvelopeError::Invalid("failed to seal RTC provider credential".into())
    })?;
    let mut payload = nonce.to_vec();
    payload.extend(ciphertext);
    Ok(SealedRtcSecret {
        ciphertext: format!("{ENVELOPE_PREFIX}{}", URL_SAFE_NO_PAD.encode(payload)),
        key_id: PRIMARY_KEY_ID.to_owned(),
        algorithm: ENVELOPE_ALGORITHM.to_owned(),
        fingerprint: fingerprint(plaintext.as_bytes()),
        masked_label: mask_secret_label(plaintext),
    })
}

/// Open a sealed payload using the active master secret, then historical ones.
pub fn open(envelope: &str) -> Result<String, RtcSecretEnvelopeError> {
    let mut candidates: Vec<String> = Vec::new();
    if let Some(active) = active_master_secret() {
        candidates.push(active);
    }
    candidates.extend(legacy_master_secrets());
    open_with_masters(envelope, &candidates)
}

pub fn open_with_masters(
    envelope: &str,
    masters: &[String],
) -> Result<String, RtcSecretEnvelopeError> {
    let encoded = envelope.trim();
    let payload = encoded.strip_prefix(ENVELOPE_PREFIX).ok_or_else(|| {
        RtcSecretEnvelopeError::Invalid(format!(
            "RTC provider credential envelope must start with {ENVELOPE_PREFIX}"
        ))
    })?;
    let decoded = URL_SAFE_NO_PAD.decode(payload).map_err(|error| {
        RtcSecretEnvelopeError::Invalid(format!(
            "RTC provider credential envelope is not valid base64url: {error}"
        ))
    })?;
    if decoded.len() <= NONCE_LENGTH {
        return Err(RtcSecretEnvelopeError::Invalid(
            "RTC provider credential envelope is truncated".into(),
        ));
    }
    if masters.is_empty() {
        return Err(RtcSecretEnvelopeError::CipherUnavailable);
    }

    let (nonce_bytes, ciphertext) = decoded.split_at(NONCE_LENGTH);
    let nonce = Nonce::from_slice(nonce_bytes);
    let mut last_error = None;
    for master in masters {
        let key = match derive_key(master) {
            Ok(key) => key,
            Err(error) => {
                last_error = Some(error);
                continue;
            }
        };
        match Aes256Gcm::new(&key).decrypt(nonce, ciphertext) {
            Ok(plaintext) => {
                return String::from_utf8(plaintext).map_err(|error| {
                    RtcSecretEnvelopeError::Invalid(format!(
                        "RTC provider credential envelope is not valid UTF-8: {error}"
                    ))
                });
            }
            Err(_) => {
                last_error = Some(RtcSecretEnvelopeError::Invalid(
                    "RTC provider credential envelope could not be decrypted with any configured master secret"
                        .into(),
                ));
            }
        }
    }
    Err(last_error.unwrap_or(RtcSecretEnvelopeError::CipherUnavailable))
}

/// Stable, non-reversible fingerprint of a secret payload.
pub fn fingerprint(plaintext: &[u8]) -> String {
    format!("{:x}", Sha256::digest(plaintext))
}

/// Human-readable, non-reversible label for a secret.
pub fn mask_secret_label(value: &str) -> String {
    let trimmed = value.trim();
    let characters: Vec<char> = trimmed.chars().collect();
    if characters.len() <= 8 {
        return "*".repeat(characters.len().max(3));
    }
    let head: String = characters.iter().take(4).collect();
    let tail: String = characters.iter().skip(characters.len() - 4).collect();
    format!("{head}****{tail}")
}

fn derive_key(master: &str) -> Result<Key<Aes256Gcm>, RtcSecretEnvelopeError> {
    let trimmed = master.trim();
    if trimmed.is_empty() {
        return Err(RtcSecretEnvelopeError::CipherUnavailable);
    }
    let digest = Sha256::digest(trimmed.as_bytes());
    Ok(*Key::<Aes256Gcm>::from_slice(&digest))
}

#[cfg(test)]
mod tests {
    use super::*;

    const MASTER: &str = "rtc-unit-test-master-secret";

    #[test]
    fn sealed_payload_roundtrips_and_is_prefixed() {
        let sealed = seal_with_master("app-key-value", MASTER).unwrap();
        assert!(sealed.ciphertext.starts_with(ENVELOPE_PREFIX));
        assert_eq!(sealed.key_id, PRIMARY_KEY_ID);
        assert_eq!(sealed.algorithm, ENVELOPE_ALGORITHM);
        assert_eq!(
            open_with_masters(&sealed.ciphertext, &[MASTER.to_owned()]).unwrap(),
            "app-key-value"
        );
    }

    #[test]
    fn sealing_without_master_secret_fails_closed() {
        assert_eq!(
            resolve_active_master(None).unwrap_err(),
            RtcSecretEnvelopeError::CipherUnavailable
        );
        assert_eq!(
            resolve_active_master(Some("   ".into())).unwrap_err(),
            RtcSecretEnvelopeError::CipherUnavailable
        );
        assert!(seal_with_master("secret", "").is_err());
        assert!(open_with_masters(&format!("{ENVELOPE_PREFIX}AAAA"), &[]).is_err());
    }

    #[test]
    fn tampered_ciphertext_is_rejected() {
        let sealed = seal_with_master("secret-payload", MASTER).unwrap();
        let mut bytes = URL_SAFE_NO_PAD
            .decode(sealed.ciphertext.strip_prefix(ENVELOPE_PREFIX).unwrap())
            .unwrap();
        let last = bytes.len() - 1;
        bytes[last] ^= 0x01;
        let tampered = format!("{ENVELOPE_PREFIX}{}", URL_SAFE_NO_PAD.encode(bytes));
        assert!(open_with_masters(&tampered, &[MASTER.to_owned()]).is_err());
    }

    #[test]
    fn legacy_master_secret_can_still_open_old_payloads() {
        let sealed = seal_with_master("legacy", "old-master").unwrap();
        let opened = open_with_masters(
            &sealed.ciphertext,
            &["new-master".to_owned(), "old-master".to_owned()],
        )
        .unwrap();
        assert_eq!(opened, "legacy");
    }

    #[test]
    fn secret_labels_are_masked() {
        assert_eq!(mask_secret_label("AKIDEXAMPLEKEY"), "AKID****EKEY");
        assert_eq!(mask_secret_label("short"), "*****");
    }
}
