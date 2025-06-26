import * as crypto from 'crypto';
import { encrypt, decrypt } from '../crypto.util';

describe('Crypto Utils (AES-256-GCM)', () => {
  let testKeyB64: string;

  beforeAll(() => {
    // Generate a random 32-byte key for testing and encode it as Base64
    // This ensures tests use a valid key format similar to what would be in .env
    testKeyB64 = crypto.randomBytes(32).toString('base64');
    // Ensure the generated key is 44 chars, possibly ending with '==' for 32 bytes.
    // The validation regex was /^[A-Za-z0-9+/]{43}=$/ , so we might need to adjust this key gen for tests
    // if the regex is very strict and a randomly generated one doesn't fit.
    // For AES-256-GCM, any 32-byte key is fine. The Base64 representation is what's validated.
    // Let's assume our crypto functions handle standard Base64 (which they do via Buffer.from(key, 'base64')).
  });

  describe('encrypt', () => {
    it('should encrypt plaintext into a Base64 string', () => {
      const plainText = 'Hello, DigiLocker! This is a test.';
      const encrypted = encrypt(plainText, testKeyB64);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      // Further checks could include trying to Base64 decode it to see if it has a reasonable length
      const bufferFromEncrypted = Buffer.from(encrypted, 'base64');
      // Expected length: IV (12) + AuthTag (16) + encrypted text length
      expect(bufferFromEncrypted.length).toBeGreaterThanOrEqual(12 + 16);
    });

    it('should throw if key is empty', () => {
      expect(() => encrypt('test', '')).toThrow(
        'Encryption key cannot be empty.',
      );
    });

    it('should throw if key is not 32 bytes after base64 decoding', () => {
      const shortKey = Buffer.from('shortkey').toString('base64');
      const longKey = crypto.randomBytes(48).toString('base64');
      expect(() => encrypt('test', shortKey)).toThrow(
        'Encryption key must be 32 bytes (256 bits) long after Base64 decoding.',
      );
      expect(() => encrypt('test', longKey)).toThrow(
        'Encryption key must be 32 bytes (256 bits) long after Base64 decoding.',
      );
    });
  });

  describe('decrypt', () => {
    it('should correctly decrypt an encrypted string', () => {
      const plainText = 'This is a secret message for round-trip testing.';
      const encrypted = encrypt(plainText, testKeyB64);
      const decrypted = decrypt(encrypted, testKeyB64);
      expect(decrypted).toBe(plainText);
    });

    it('should throw an error if the ciphertext is tampered (auth tag mismatch)', () => {
      const plainText = 'Tamper me!';
      const encrypted = encrypt(plainText, testKeyB64);

      const encryptedBuffer = Buffer.from(encrypted, 'base64');
      // Tamper one byte of the encrypted part (after IV and AuthTag)
      // IV_LENGTH = 12, AUTH_TAG_LENGTH = 16. So, tamper at index 12 + 16 = 28 (if data exists there)
      if (encryptedBuffer.length > 28) {
        encryptedBuffer[28] = encryptedBuffer[28] ^ 0xff; // Flip bits of a byte
      }
      const tamperedEncryptedB64 = encryptedBuffer.toString('base64');

      expect(() => decrypt(tamperedEncryptedB64, testKeyB64)).toThrow(
        'Decryption failed. Data may be tampered or key is incorrect.',
      );
    });

    it('should throw an error if a different key is used for decryption', () => {
      const plainText = 'Wrong key test';
      const encrypted = encrypt(plainText, testKeyB64);
      const differentKeyB64 = crypto.randomBytes(32).toString('base64');
      expect(() => decrypt(encrypted, differentKeyB64)).toThrow(
        'Decryption failed. Data may be tampered or key is incorrect.',
      );
    });

    it('should throw if key is empty', () => {
      const encrypted = encrypt('test', testKeyB64);
      expect(() => decrypt(encrypted, '')).toThrow(
        'Decryption key cannot be empty.',
      );
    });

    it('should throw if ciphertext is empty', () => {
      expect(() => decrypt('', testKeyB64)).toThrow(
        'Ciphertext cannot be empty.',
      );
    });

    it('should throw if key is not 32 bytes after base64 decoding', () => {
      const encrypted = encrypt('test', testKeyB64);
      const shortKey = Buffer.from('shortkey').toString('base64');
      expect(() => decrypt(encrypted, shortKey)).toThrow(
        'Decryption key must be 32 bytes (256 bits) long after Base64 decoding.',
      );
    });

    it('should throw if ciphertext is too short', () => {
      const shortCipher = Buffer.from('short').toString('base64');
      expect(() => decrypt(shortCipher, testKeyB64)).toThrow(
        'Invalid ciphertext format: too short to contain IV and authTag.',
      );
    });
  });

  describe('Edge case: empty plaintext', () => {
    it('should encrypt and decrypt empty string correctly', () => {
      const plainText = '';
      const encrypted = encrypt(plainText, testKeyB64);
      const decrypted = decrypt(encrypted, testKeyB64);
      expect(decrypted).toBe(plainText);
    });
  });
});
