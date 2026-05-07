/**
 * Runtime-safe base64 helpers for Hydrogen (Node / edge runtimes).
 * We need this because `btoa` / `atob` / `Buffer` availability differs by runtime.
 */

/**
 * @param {string} input
 */
export function toBase64(input) {
  // Node / many runtimes
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf-8').toString('base64');
  }

  // Browser / some edge runtimes
  if (typeof btoa !== 'undefined') {
    // btoa expects binary string, so UTF-8 encode first.
    const binary = new TextEncoder()
      .encode(input)
      .reduce((acc, byte) => acc + String.fromCharCode(byte), '');
    return btoa(binary);
  }

  throw new Error('Base64 encoding is not supported in this runtime');
}

/**
 * @param {string} input
 */
export function fromBase64(input) {
  // Node / many runtimes
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'base64').toString('utf-8');
  }

  // Browser / some edge runtimes
  if (typeof atob !== 'undefined') {
    const binary = atob(input);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  throw new Error('Base64 decoding is not supported in this runtime');
}

