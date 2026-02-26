import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a string (e.g. OAuth tokens for device connections).
 * Returns a hex-encoded string: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, "hex").subarray(0, 32);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return iv.toString("hex") + authTag.toString("hex") + encrypted;
}

/**
 * Decrypt a string previously encrypted with encrypt().
 */
export function decrypt(encryptedHex: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, "hex").subarray(0, 32);
  const iv = Buffer.from(encryptedHex.slice(0, IV_LENGTH * 2), "hex");
  const authTag = Buffer.from(
    encryptedHex.slice(IV_LENGTH * 2, IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2),
    "hex"
  );
  const encrypted = encryptedHex.slice(
    IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2
  );

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
