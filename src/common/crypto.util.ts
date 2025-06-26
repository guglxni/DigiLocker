import * as crypto from 'crypto';

const IV_LENGTH = 12; // AES-GCM standard IV length is 12 bytes (96 bits)
const AUTH_TAG_LENGTH = 16; // AES-GCM standard auth tag length is 16 bytes (128 bits)

/**
 * Encrypts plaintext using AES-256-GCM.
 * @param plainText The string to encrypt.
 * @param keyB64 A Base64 encoded 32-byte key.
 * @returns A Base64 encoded string: iv + authTag + encryptedData
 */
export function encrypt(plainText: string, keyB64: string): string {
  if (!keyB64 || keyB64.length === 0) {
    throw new Error('Encryption key cannot be empty.');
  }
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'Encryption key must be 32 bytes (256 bits) long after Base64 decoding.',
    );
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(
        `Generated authTag has incorrect length: ${authTag.length}. Expected ${AUTH_TAG_LENGTH}`,
      );
    }
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  } catch (error) {
    throw new Error(
      'Encryption failed. Ensure key is correct and data is valid.',
    );
  }
}

/**
 * Decrypts ciphertext using AES-256-GCM.
 * @param cipherTextB64 Base64 encoded string: iv + authTag + encryptedData.
 * @param keyB64 A Base64 encoded 32-byte key.
 * @returns The decrypted plaintext string.
 * @throws Error if decryption or authentication fails, or key is invalid.
 */
export function decrypt(cipherTextB64: string, keyB64: string): string {
  if (!keyB64 || keyB64.length === 0) {
    throw new Error('Decryption key cannot be empty.');
  }
  if (!cipherTextB64 || cipherTextB64.length === 0) {
    throw new Error('Ciphertext cannot be empty.');
  }

  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'Decryption key must be 32 bytes (256 bits) long after Base64 decoding.',
    );
  }

  const combinedData = Buffer.from(cipherTextB64, 'base64');
  if (combinedData.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error(
      'Invalid ciphertext format: too short to contain IV and authTag.',
    );
  }

  const iv = combinedData.subarray(0, IV_LENGTH);
  const authTag = combinedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encryptedText = combinedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  if (iv.length !== IV_LENGTH) {
    throw new Error('Failed to extract IV or IV has incorrect length.');
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      'Failed to extract authTag or authTag has incorrect length.',
    );
  }

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(
      'Decryption failed. Data may be tampered or key is incorrect.',
    );
  }
}
