import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt } from '../src/utils/crypto.js';

describe('Crypto Utils', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes!!!';
  });

  it('should encrypt and decrypt a string', () => {
    const plaintext = 'my-secret-password';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':');
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('should return empty string for empty input', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('should produce different ciphertexts for same input (random IV)', () => {
    const plaintext = 'same-password';
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2);
    expect(decrypt(enc1)).toBe(plaintext);
    expect(decrypt(enc2)).toBe(plaintext);
  });

  it('should handle special characters', () => {
    const plaintext = 'p@$$w0rd!#%^&*()_+{}|:"<>?';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('should throw without ENCRYPTION_KEY', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
  });
});
