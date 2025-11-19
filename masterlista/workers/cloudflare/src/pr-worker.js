// Simple in-memory rate limit map (per isolate, not globally consistent)
const rlMap = new Map();
let lastCleanup = Date.now();

function rateLimitCheck(ip, max, windowMs) {
  const now = Date.now();
  if (now - lastCleanup > windowMs * 10) {
    for (const [k, v] of rlMap.entries()) if (now - v.first > windowMs) rlMap.delete(k);
    lastCleanup = now;
  }
  const entry = rlMap.get(ip);
  if (!entry) {
    rlMap.set(ip, { count: 1, first: now });
    return { allowed: true, remaining: max - 1, reset: now + windowMs };
  }
  if (now - entry.first > windowMs) {
    rlMap.set(ip, { count: 1, first: now });
    return { allowed: true, remaining: max - 1, reset: now + windowMs };
  }
  entry.count += 1;
  if (entry.count > max) return { allowed: false, remaining: 0, reset: entry.first + windowMs };
  return { allowed: true, remaining: max - entry.count, reset: entry.first + windowMs };
}

export default {
  async fetch(request, env) {
    // Dynamic CORS: allow specific origins (incl. najjak.com) with sensible defaults
    const origin = request.headers.get('Origin') || '';
    const configured = (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const defaultAllowed = [
      'https://www.najjak.com',
      'https://martinpetkovski.github.io',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5500',
      'http://localhost'
    ];
    const allowedOrigins = configured.length ? configured : defaultAllowed;
    const allowThisOrigin = origin && allowedOrigins.includes(origin);
    const vary = 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowThisOrigin ? origin : '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type,Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': vary,
    };

    // Debug endpoint to inspect auth variable presence (temporary)
    if (request.method === 'GET' && new URL(request.url).pathname === '/debug-auth') {
      const hasAppVars = !!(env.GITHUB_APP_ID && env.GITHUB_INSTALLATION_ID && env.GITHUB_APP_PRIVATE_KEY);
      const installationLooksNumeric = /^(\d+)$/.test(env.GITHUB_INSTALLATION_ID || '');
      const appIdLooksNumeric = /^(\d+)$/.test(env.GITHUB_APP_ID || '');
      const keyPresent = !!env.GITHUB_APP_PRIVATE_KEY;
      const tokenPresent = !!env.GITHUB_TOKEN;
      return json({
        debug: true,
        hasAppVars,
        appId: env.GITHUB_APP_ID || null,
        appIdLooksNumeric,
        installationId: env.GITHUB_INSTALLATION_ID || null,
        installationLooksNumeric,
        privateKeyPresent: keyPresent,
        privateKeyLength: keyPresent ? env.GITHUB_APP_PRIVATE_KEY.length : 0,
        patPresent: tokenPresent,
        authModeWillUse: hasAppVars ? 'github_app' : (tokenPresent ? 'pat' : 'none')
      }, 200, corsHeaders);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method Not Allowed' }, 405, corsHeaders);
    }

    // Rate limiting
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const max = parseInt(env.RATE_LIMIT_MAX || '5', 10); // default 5 requests
    const windowSec = parseInt(env.RATE_LIMIT_WINDOW || '60', 10); // default 60s
    const windowMs = windowSec * 1000;
    const rl = rateLimitCheck(ip, max, windowMs);
    if (!rl.allowed) {
      const retryAfter = Math.max(0, Math.ceil((rl.reset - Date.now()) / 1000));
      const limitedHeaders = {
        ...corsHeaders,
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(max),
        'X-RateLimit-Remaining': String(rl.remaining),
        'X-RateLimit-Reset': String(Math.floor(rl.reset / 1000)),
      };
      return json({ error: 'Rate limit exceeded', retry_after: retryAfter }, 429, limitedHeaders);
    }

    try {
      const body = await request.json();
      const bandsJson = body?.bandsJson;
      const description = body?.description || 'Automated PR from MMM form';
      const contributor = body?.contributor || '';
      const targetPath = body?.path || 'masterlista/bands.json';

      if (!bandsJson || typeof bandsJson !== 'string') {
        return json({ error: 'Invalid payload: bandsJson string required' }, 400, corsHeaders);
      }

      // Prefer GitHub App installation token if app variables are present; fallback to PAT
      let token = null;
      const hasApp = !!(env.GITHUB_APP_ID && env.GITHUB_INSTALLATION_ID && env.GITHUB_APP_PRIVATE_KEY);
      if (hasApp) {
        try {
          token = await getInstallationToken(env);
        } catch (e) {
          if (env.GITHUB_TOKEN) {
            token = env.GITHUB_TOKEN; // fallback to PAT if provided
          } else {
            return json({ error: 'GitHub App auth failed', detail: e.message }, 500, corsHeaders);
          }
        }
      } else if (env.GITHUB_TOKEN) {
        token = env.GITHUB_TOKEN;
      }
      const owner = env.GITHUB_OWNER || 'martinpetkovski';
      const repo = env.GITHUB_REPO || 'martinpetkovski.github.io';
      const baseBranch = env.GITHUB_DEFAULT_BRANCH || 'master';

      if (!token) {
        return json({ error: 'Missing GitHub credentials', hint: 'Set GitHub App vars (GITHUB_APP_ID, GITHUB_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY) or a PAT in GITHUB_TOKEN.' }, 500, corsHeaders);
      }

      const gh = (url, init = {}) => fetch(`https://api.github.com${url}`, {
        ...init,
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'mmm-pr-worker',
          ...(init.headers || {}),
        },
      });

      // 1) Get base ref sha
      const refRes = await gh(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`);
      if (!refRes.ok) {
        const text = await refRes.text();
        return json({ error: 'Failed to get base ref', detail: text }, 500, corsHeaders);
      }
      const refData = await refRes.json();
      const baseSha = refData.object.sha;

      // 2) Create a new branch
      const safeContributor = contributor ? slug(contributor) : 'anon';
      const ts = new Date();
      const branchName = `mmm/update-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}-${safeContributor}`;
      const createRefRes = await gh(`/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      });
      if (!createRefRes.ok) {
        const text = await createRefRes.text();
        return json({ error: 'Failed to create branch', detail: text }, 500, corsHeaders);
      }

      // 3) Get current file SHA (for update)
      const contentsRes = await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(targetPath)}?ref=${encodeURIComponent(baseBranch)}`);
      let currentSha = undefined;
      if (contentsRes.ok) {
        const contents = await contentsRes.json();
        currentSha = contents.sha;
      } // If not ok, file might not exist; treat as create

      // 4) Create or update file on new branch
      const putRes = await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(targetPath)}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: `MMM: update bands.json via form${contributor ? ` by ${contributor}` : ''}`,
          content: b64encode(bandsJson),
          branch: branchName,
          sha: currentSha,
        }),
      });
      if (!putRes.ok) {
        const text = await putRes.text();
        return json({ error: 'Failed to commit file', detail: text }, 500, corsHeaders);
      }

      // 5) Create PR
      const title = `MMM: Предлог промени${contributor ? ` од ${contributor}` : ''}`;
      const bodyText = `${description}\n\nАвтоматски генерирано од MMM формуларот.$${contributor ? `\nПоднесено од: ${contributor}` : ''}`.replace('$', '');
      const prRes = await gh(`/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          head: branchName,
          base: baseBranch,
          body: bodyText,
        }),
      });
      if (!prRes.ok) {
        const text = await prRes.text();
        return json({ error: 'Failed to create PR', detail: text }, 500, corsHeaders);
      }
      const pr = await prRes.json();

      return json({ ok: true, pr_url: pr.html_url, pr_number: pr.number, branch: branchName }, 200, corsHeaders);
    } catch (err) {
      return json({ error: 'Unhandled error', detail: err?.message || String(err) }, 500, corsHeaders);
    }
  },
};

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function pad(n) { return String(n).padStart(2, '0'); }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 32); }
function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

// ---------------- GitHub App Helpers ----------------
let installationTokenCache = null; // { token, expiresAt }

async function getInstallationToken(env) {
  const now = Date.now();
  if (installationTokenCache && installationTokenCache.expiresAt - 60_000 > now) {
    return installationTokenCache.token;
  }
  const jwt = await createGitHubAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
  const res = await fetch(`https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'mmm-pr-worker'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Installation token request failed: ${text}`);
  }
  const data = await res.json();
  installationTokenCache = { token: data.token, expiresAt: Date.parse(data.expires_at) };
  return data.token;
}

async function createGitHubAppJwt(appId, pemKey) {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iat: nowSec - 30, exp: nowSec + 540, iss: appId }; // 9 min exp
  const encode = (obj) => base64Url(JSON.stringify(obj));
  const unsigned = `${encode(header)}.${encode(payload)}`;
  const key = await importFlexiblePrivateKey(pemKey);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const sigB64 = base64UrlFromArrayBuffer(sig);
  return `${unsigned}.${sigB64}`;
}

function base64Url(str) {
  let out = btoa(str).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
  return out;
}

function base64UrlFromArrayBuffer(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
}

async function importFlexiblePrivateKey(pem) {
  // Normalize common dashboard artifacts: literal \n sequences, stray CRs/spaces
  const value = String(pem == null ? '' : pem).trim().replace(/\r/g, '').replace(/\\n/g, '\n');
  if (value.includes('BEGIN PRIVATE KEY')) {
    const cleaned = value
      .replace(/-----BEGIN PRIVATE KEY-----/,'')
      .replace(/-----END PRIVATE KEY-----/,'')
      .replace(/\n/g,'')
      .replace(/\s+/g,'');
    const binaryDer = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
    return crypto.subtle.importKey('pkcs8', binaryDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  }
  if (value.includes('BEGIN RSA PRIVATE KEY')) {
    const cleaned = value
      .replace(/-----BEGIN RSA PRIVATE KEY-----/,'')
      .replace(/-----END RSA PRIVATE KEY-----/,'')
      .replace(/\n/g,'')
      .replace(/\s+/g,'');
    const pkcs1Der = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
    const pkcs8Der = wrapPkcs1ToPkcs8(pkcs1Der);
    return crypto.subtle.importKey('pkcs8', pkcs8Der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  }
  const compact = value.replace(/\n/g,'').replace(/\s+/g,'');
  if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 0) {
    try {
      const rawDer = Uint8Array.from(atob(compact), c => c.charCodeAt(0));
      // Try PKCS#8 import directly
      return await crypto.subtle.importKey('pkcs8', rawDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    } catch (_) {
      // Try treating as PKCS#1 and wrap
      try {
        const pkcs1Der = Uint8Array.from(atob(compact), c => c.charCodeAt(0));
        const pkcs8Der = wrapPkcs1ToPkcs8(pkcs1Der);
        return await crypto.subtle.importKey('pkcs8', pkcs8Der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
      } catch (e2) {
        throw new Error('Unsupported key format after fallback attempts');
      }
    }
  }
  throw new Error('Unsupported key format: provide PEM with BEGIN PRIVATE KEY / BEGIN RSA PRIVATE KEY or raw base64 DER');
}

function wrapPkcs1ToPkcs8(pkcs1Der) {
  // Build: SEQUENCE { INTEGER 0; SEQUENCE { OID 1.2.840.113549.1.1.1; NULL }; OCTET STRING <pkcs1Der> }
  const oidRsa = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]; // 1.2.840.113549.1.1.1
  const nullBytes = [0x05, 0x00];
  const algIdSeq = encodeSequence([...oidRsa, ...nullBytes]);
  const version = [0x02, 0x01, 0x00];
  const pkcs1Octet = encodeOctetString(pkcs1Der);
  const all = [...version, ...algIdSeq, ...pkcs1Octet];
  return new Uint8Array(encodeSequence(all));
}

function encodeSequence(content) {
  const len = encodeLength(content.length);
  return [0x30, ...len, ...content];
}
function encodeOctetString(bytes) {
  const len = encodeLength(bytes.length);
  return [0x04, ...len, ...bytes];
}
function encodeLength(len) {
  if (len < 128) return [len];
  const hex = [];
  while (len > 0) { hex.unshift(len & 0xff); len >>= 8; }
  return [0x80 | hex.length, ...hex];
}
