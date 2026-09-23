// Signed session tokens (JWT-like), implemented with the native Web
// Crypto API. Deliberately avoids an external library such as
// "jsonwebtoken": it doesn't work in the "edge" runtime used by
// middleware.ts, whereas crypto.subtle works both server-side (API
// routes) and at the edge (middleware).

const encoder = new TextEncoder();

function base64urlFromBytes(bytes: ArrayBuffer): string {
  let binary = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlFromString(str: string): string {
  return base64urlFromBytes(encoder.encode(str).buffer as ArrayBuffer);
}

function bytesFromBase64url(b64url: string): Uint8Array<ArrayBuffer> {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Creates a signed token containing `payload`, valid for `expiresInSeconds` seconds.
export async function signToken(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 60 * 60 * 24 * 7
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = { ...payload, exp };

  const encodedHeader = base64urlFromString(JSON.stringify(header));
  const encodedBody = base64urlFromString(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedBody}`;

  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const encodedSignature = base64urlFromBytes(signature);

  return `${data}.${encodedSignature}`;
}

// Verifies a token and returns its payload, or `null` if invalid,
// tampered with, or expired.
export async function verifyToken<T = Record<string, unknown>>(
  token: string | undefined | null,
  secret: string
): Promise<(T & { exp?: number }) | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedBody, encodedSignature] = parts;

  try {
    const key = await getSigningKey(secret);
    const data = `${encodedHeader}.${encodedBody}`;
    const signatureBytes = bytesFromBase64url(encodedSignature);
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(data));
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(bytesFromBase64url(encodedBody)));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
