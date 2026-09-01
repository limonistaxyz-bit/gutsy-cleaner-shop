// Shared Web Crypto verification; never trust identity headers without a valid JWT.
export async function verifyHmac(secret: string, message: string, signature: string) {
  try {
    const bytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(message));
  } catch { return false; }
}

function decode(part: string) {
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')), c => c.charCodeAt(0));
}

type AccessConfig = { team?: string; audience?: string; email?: string };
let cached: { team: string; until: number; keys: (JsonWebKey & { kid?: string })[] } | undefined;
export async function verifyOwner(token: string | null, config: AccessConfig) {
  if (!token || !config.team || !config.audience || !config.email || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(config.team)) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const now = Date.now() / 1000;
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || claims.iss !== `https://${config.team}` ||
        !Number.isFinite(claims.exp) || claims.exp <= now || (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now)) ||
        !Array.isArray(claims.aud) || !claims.aud.includes(config.audience) ||
        typeof claims.email !== 'string' || claims.email.toLowerCase() !== config.email.toLowerCase()) return false;
    if (!cached || cached.team !== config.team || cached.until < Date.now() || !cached.keys.some(k => k.kid === header.kid)) {
      const response = await fetch(`https://${config.team}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return false;
      const data = await response.json() as { keys: (JsonWebKey & { kid?: string })[] };
      if (!Array.isArray(data.keys)) return false;
      cached = { team: config.team, until: Date.now() + 300000, keys: data.keys };
    }
    const jwk = cached.keys.find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  } catch { return false; }
}
