const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const BASE_DIR = path.resolve(__dirname);
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');

/**
 * Load private environment variables from local .env file without external dependencies.
 */
function loadDotEnv(envFilePath) {
  if (!fs.existsSync(envFilePath)) return;
  try {
    const raw = fs.readFileSync(envFilePath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    });
  } catch (err) {
    console.warn('[ENV] Failed to parse .env file:', err.message);
  }
}

loadDotEnv(path.join(BASE_DIR, '.env'));

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxRR30Z9eMtp6WntWzfIB8Bg52jPWXah-b4pDQsFeOR6fn0A6TqTmocbZSVFlE4Ip4noQ/exec";

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.sql': 'text/plain',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4'
};

/**
 * Retrieve Supabase environment configuration strictly on the server.
 */
function getSupabaseEnv() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';
  const secretKey = process.env.SUPABASE_SECRET_KEY || '';
  const jwksUrl = process.env.SUPABASE_JWKS_URL || '';
  let projectId = '';
  try {
    if (url) {
      projectId = new URL(url).hostname.split('.')[0] || '';
    }
  } catch (_) {}
  return { url, publishableKey, secretKey, jwksUrl, projectId };
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, payload) {
  setCors(res);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        req.destroy();
        reject(new Error('Request payload exceeds maximum allowed size.'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Perform an authenticated HTTPS request to Supabase PostgREST API using server-side .env keys.
 * Uses the `apikey` header required by Supabase sb_publishable_ / sb_secret_ key format.
 */
function supabaseRestRequest({ method, restPath, bodyObj = null, useSecret = true, prefer = null }) {
  return new Promise((resolve, reject) => {
    const cfg = getSupabaseEnv();
    const apiKey = useSecret ? (cfg.secretKey || cfg.publishableKey) : cfg.publishableKey;
    if (!cfg.url || !apiKey) {
      return reject(new Error('Supabase credentials are missing from .env file.'));
    }

    const target = new URL(`${cfg.url}/rest/v1${restPath}`);
    const bodyStr = bodyObj !== null ? JSON.stringify(bodyObj) : null;
    const headers = {
      'apikey': apiKey,
      'Accept': 'application/json'
    };

    if (bodyStr !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    if (prefer) {
      headers['Prefer'] = prefer;
    }

    const req = https.request({
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method,
      headers
    }, (supaRes) => {
      let raw = '';
      supaRes.on('data', (c) => { raw += c; });
      supaRes.on('end', () => {
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch (_) {
          data = null;
        }
        resolve({ statusCode: supaRes.statusCode, data, raw });
      });
    });

    req.on('error', reject);
    if (bodyStr !== null) req.write(bodyStr);
    req.end();
  });
}

/**
 * Forward upload payload to Google Apps Script Web App
 * Follows 302/301 redirects to retrieve JSON response from Google CDN
 */
function forwardToGoogleAppsScript(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);

    function sendRequest(targetUrl, method, data) {
      try {
        const parsed = new URL(targetUrl);
        const options = {
          hostname: parsed.hostname,
          port: parsed.port || 443,
          path: parsed.pathname + parsed.search,
          method: method,
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          }
        };

        if (data) {
          options.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const req = https.request(options, (res) => {
          if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
            return sendRequest(res.headers.location, 'GET', null);
          }

          let responseBody = '';
          res.on('data', chunk => { responseBody += chunk; });
          res.on('end', () => {
            try {
              const parsedJson = JSON.parse(responseBody);
              resolve({ statusCode: res.statusCode, data: parsedJson });
            } catch (err) {
              resolve({ statusCode: res.statusCode, rawBody: responseBody });
            }
          });
        });

        req.on('error', reject);
        if (data) req.write(data);
        req.end();
      } catch (err) {
        reject(err);
      }
    }

    sendRequest(GOOGLE_SCRIPT_URL, 'POST', postData);
  });
}

/**
 * Save file locally as a recovery backup when Drive deployment is pending
 */
function saveFileLocally(filename, base64Content) {
  const safeName = Date.now() + '_' + filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetPath = path.join(UPLOADS_DIR, safeName);
  const fileBuffer = Buffer.from(base64Content, 'base64');
  fs.writeFileSync(targetPath, fileBuffer);
  return safeName;
}

/**
 * Upload media payload to Google Drive via Apps Script Web App with detailed diagnostics.
 */
async function uploadBufferToDrive({ filename, mimeType, base64 }) {
  try {
    const gasRes = await forwardToGoogleAppsScript({ filename, mimeType, base64 });
    if (gasRes && gasRes.data && (gasRes.data.success || gasRes.data.status === 'success' || gasRes.data.fileUrl || gasRes.data.directUrl)) {
      const fileId = gasRes.data.fileId || '';
      const isMediaStream = mimeType.startsWith('video/') || mimeType.startsWith('audio/');
      const defaultUrl = fileId
        ? (isMediaStream ? `https://drive.google.com/uc?export=download&id=${fileId}` : `https://lh3.googleusercontent.com/d/${fileId}=w800-rw`)
        : (gasRes.data.url || gasRes.data.fileUrl);
      const directUrl = gasRes.data.directUrl || defaultUrl;
      return {
        ok: true,
        fileId,
        filename,
        mimeType,
        fileUrl: gasRes.data.fileUrl || gasRes.data.url || directUrl,
        directUrl,
        previewUrl: gasRes.data.previewUrl || (fileId ? `https://drive.google.com/file/d/${fileId}/preview` : directUrl)
      };
    }

    const rawText = (gasRes && gasRes.rawBody) ? gasRes.rawBody : '';
    const jsonErr = (gasRes && gasRes.data && (gasRes.data.error || gasRes.data.message)) || '';
    const isDoPostMissing = rawText.includes('Script function not found: doPost');
    const isAuthHtml = rawText.includes('ServiceLogin') || rawText.includes('accounts.google.com') || rawText.includes('Authorization');

    return {
      ok: false,
      doPostMissing: isDoPostMissing,
      driveErrorCode: isDoPostMissing ? 'DOPOST_MISSING' : (isAuthHtml ? 'AUTH_REQUIRED' : 'SCRIPT_ERROR'),
      error: isDoPostMissing
        ? 'Google Apps Script is missing doPost(e) or needs a New Version deployment on script.google.com.'
        : isAuthHtml
          ? 'Google Apps Script returned a login/permission page. Set "Execute as: Me" and "Who has access: Anyone".'
          : (jsonErr || 'Google Apps Script did not return a Drive file URL.')
    };
  } catch (err) {
    return {
      ok: false,
      doPostMissing: false,
      driveErrorCode: 'NETWORK_ERROR',
      error: 'Could not reach Google Apps Script: ' + err.message
    };
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = reqUrl.pathname;

  // 1. Safe Public Supabase Config (NEVER returns SUPABASE_SECRET_KEY)
  if (pathname === '/api/supabase/config' && req.method === 'GET') {
    const cfg = getSupabaseEnv();
    return sendJson(res, 200, {
      success: true,
      connected: Boolean(cfg.url && (cfg.publishableKey || cfg.secretKey)),
      mode: 'server_env',
      projectId: cfg.projectId,
      url: cfg.url,
      publishableKey: cfg.publishableKey,
      hasSecretKey: Boolean(cfg.secretKey),
      hasJwksUrl: Boolean(cfg.jwksUrl)
    });
  }

  // 2. Supabase Live Connection & Schema Health Check
  if (pathname === '/api/supabase/health' && req.method === 'GET') {
    const cfg = getSupabaseEnv();
    if (!cfg.url || (!cfg.secretKey && !cfg.publishableKey)) {
      return sendJson(res, 500, {
        success: false,
        authValid: false,
        tableExists: false,
        tableMissing: true,
        message: 'Supabase keys are not configured in .env.'
      });
    }

    try {
      const rootRes = await supabaseRestRequest({ method: 'GET', restPath: '/', useSecret: true });
      const authValid = rootRes.statusCode >= 200 && rootRes.statusCode < 300;
      const tblRes = await supabaseRestRequest({
        method: 'GET',
        restPath: '/products?select=id&limit=1',
        useSecret: true
      });
      const tableExists = tblRes.statusCode >= 200 && tblRes.statusCode < 300;
      const tableMissing = !tableExists && tblRes.data && tblRes.data.code === 'PGRST205';

      return sendJson(res, 200, {
        success: authValid && tableExists,
        authValid,
        tableExists,
        tableMissing,
        projectId: cfg.projectId,
        message: tableExists
          ? `Connected to Supabase (${cfg.projectId}) and public.products table is ready.`
          : tableMissing
            ? `Supabase API keys in .env authenticated cleanly, but table 'public.products' does not exist yet. Run supabase_schema.sql in Supabase SQL Editor.`
            : (tblRes.data && tblRes.data.message) || `Supabase returned status ${tblRes.statusCode}`
      });
    } catch (err) {
      return sendJson(res, 502, {
        success: false,
        authValid: false,
        tableExists: false,
        tableMissing: false,
        message: err.message
      });
    }
  }

  // 3. Server-Side Supabase Products Endpoint (GET / POST / DELETE)
  if (pathname === '/api/supabase/products') {
    try {
      if (req.method === 'GET') {
        const supaRes = await supabaseRestRequest({
          method: 'GET',
          restPath: '/products?select=id,name,price,photos_link,description,available_pcs&order=price.desc',
          useSecret: true
        });
        if (supaRes.statusCode >= 200 && supaRes.statusCode < 300) {
          return sendJson(res, 200, {
            success: true,
            products: Array.isArray(supaRes.data) ? supaRes.data : []
          });
        }
        const tableMissing = supaRes.data && supaRes.data.code === 'PGRST205';
        return sendJson(res, supaRes.statusCode || 502, {
          success: false,
          tableMissing,
          code: supaRes.data && supaRes.data.code,
          error: (supaRes.data && supaRes.data.message) || 'Failed to fetch products from Supabase.'
        });
      }

      if (req.method === 'POST') {
        const rawBody = await readRequestBody(req);
        const product = JSON.parse(rawBody);
        if (!product || !product.id || !product.name || isNaN(Number(product.price))) {
          return sendJson(res, 400, {
            success: false,
            error: 'Invalid product payload: id, name, and numeric price are required.'
          });
        }

        const payload = {
          id: String(product.id).trim(),
          name: String(product.name).trim(),
          price: Number(product.price),
          photos_link: product.photos_link ? String(product.photos_link).trim() : '',
          description: product.description ? String(product.description).trim() : '',
          available_pcs: parseInt(product.available_pcs, 10) || 0,
          updated_at: new Date().toISOString()
        };

        const supaRes = await supabaseRestRequest({
          method: 'POST',
          restPath: '/products?on_conflict=id',
          bodyObj: payload,
          useSecret: true,
          prefer: 'resolution=merge-duplicates,return=representation'
        });

        if (supaRes.statusCode >= 200 && supaRes.statusCode < 300) {
          return sendJson(res, 200, { success: true, data: supaRes.data });
        }
        const tableMissing = supaRes.data && supaRes.data.code === 'PGRST205';
        return sendJson(res, supaRes.statusCode || 502, {
          success: false,
          tableMissing,
          code: supaRes.data && supaRes.data.code,
          error: tableMissing
            ? "Table 'public.products' does not exist in Supabase yet. Run supabase_schema.sql in Supabase SQL Editor."
            : (supaRes.data && supaRes.data.message) || 'Failed to save product to Supabase.'
        });
      }

      if (req.method === 'DELETE') {
        let productId = reqUrl.searchParams.get('id');
        if (!productId) {
          try {
            const rawBody = await readRequestBody(req);
            if (rawBody) productId = JSON.parse(rawBody).id;
          } catch (_) {}
        }
        if (!productId) {
          return sendJson(res, 400, { success: false, error: 'Missing product id for deletion.' });
        }

        const supaRes = await supabaseRestRequest({
          method: 'DELETE',
          restPath: `/products?id=eq.${encodeURIComponent(productId)}`,
          useSecret: true,
          prefer: 'return=representation'
        });

        if (supaRes.statusCode >= 200 && supaRes.statusCode < 300) {
          return sendJson(res, 200, { success: true, data: supaRes.data });
        }
        return sendJson(res, supaRes.statusCode || 502, {
          success: false,
          error: (supaRes.data && supaRes.data.message) || 'Failed to delete product from Supabase.'
        });
      }

      return sendJson(res, 405, { success: false, error: 'Method not allowed.' });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 4. Google Drive Health Check & Local-Backup-to-Drive Sync Routes
  if (pathname === '/api/drive/health' && req.method === 'GET') {
    try {
      const gasRes = await forwardToGoogleAppsScript({ action: 'ping' });
      const rawText = (gasRes && gasRes.rawBody) ? gasRes.rawBody : '';
      const isDoPostMissing = rawText.includes('Script function not found: doPost');
      const isAuthHtml = rawText.includes('ServiceLogin') || rawText.includes('accounts.google.com') || rawText.includes('Authorization');
      const isReadyJson = Boolean(
        gasRes && gasRes.data && (
          gasRes.data.doPostReady ||
          gasRes.data.status === 'ok' ||
          (gasRes.data.message && gasRes.data.message.includes('Missing base64'))
        )
      );

      return sendJson(res, 200, {
        connected: isReadyJson,
        doPostMissing: isDoPostMissing,
        authRequired: isAuthHtml,
        targetFolderId: '1E2MflyKllRq2a5kiZmFargIe5PvA8_X6',
        message: isReadyJson
          ? 'Google Apps Script doPost(e) is live! All photos, videos, and audios save to Google Drive.'
          : isDoPostMissing
            ? 'Google Apps Script deployment is missing doPost(e). Copy DriveUpload_Standalone.gs, paste into script.google.com, and deploy a New Version.'
            : isAuthHtml
              ? 'Google Apps Script requires "Execute as: Me" and "Who has access: Anyone".'
              : 'Google Apps Script did not return expected JSON status.'
      });
    } catch (err) {
      return sendJson(res, 502, {
        connected: false,
        doPostMissing: false,
        message: 'Network error testing Google Apps Script: ' + err.message
      });
    }
  }

  if (pathname === '/api/drive/sync-local' && req.method === 'POST') {
    try {
      const rawBody = await readRequestBody(req);
      const { filename, mimeType } = JSON.parse(rawBody || '{}');
      if (!filename) {
        return sendJson(res, 400, { success: false, error: 'Missing local filename.' });
      }
      const safeTarget = path.resolve(UPLOADS_DIR, path.basename(String(filename)));
      if (!safeTarget.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(safeTarget)) {
        return sendJson(res, 404, { success: false, error: 'Local backup file not found.' });
      }
      const base64 = fs.readFileSync(safeTarget).toString('base64');
      const ext = path.extname(safeTarget).toLowerCase();
      const resolvedMime = mimeType || MIME_TYPES[ext] || 'application/octet-stream';
      const driveRes = await uploadBufferToDrive({ filename: path.basename(safeTarget), mimeType: resolvedMime, base64 });

      if (driveRes.ok) {
        return sendJson(res, 200, {
          status: 'success',
          success: true,
          source: 'google_drive',
          fileId: driveRes.fileId,
          filename: driveRes.filename,
          fileUrl: driveRes.fileUrl,
          directUrl: driveRes.directUrl,
          previewUrl: driveRes.previewUrl,
          message: 'Synced directly to Google Drive folder 1E2MflyKllRq2a5kiZmFargIe5PvA8_X6'
        });
      }

      return sendJson(res, 502, {
        status: 'error',
        success: false,
        doPostMissing: driveRes.doPostMissing,
        driveErrorCode: driveRes.driveErrorCode,
        error: driveRes.error
      });
    } catch (err) {
      return sendJson(res, 500, { status: 'error', success: false, error: err.message });
    }
  }

  // 5. API Proxy Route for Google Drive Media Uploads
  if (pathname === '/api/upload-media' && req.method === 'POST') {
    try {
      const body = await readRequestBody(req, 100 * 1024 * 1024);
      const payload = JSON.parse(body);
      let base64 = payload.base64 || '';
      if (base64.indexOf('base64,') !== -1) {
        base64 = base64.split('base64,')[1];
      }

      const filename = payload.filename || ('media_' + Date.now() + '.jpg');
      const mimeType = payload.mimeType || 'application/octet-stream';

      const driveRes = await uploadBufferToDrive({ filename, mimeType, base64 });
      if (driveRes.ok) {
        return sendJson(res, 200, {
          status: 'success',
          success: true,
          source: 'google_drive',
          fileId: driveRes.fileId,
          filename: driveRes.filename,
          fileUrl: driveRes.fileUrl,
          directUrl: driveRes.directUrl,
          previewUrl: driveRes.previewUrl,
          message: 'Uploaded directly to Google Drive folder 1E2MflyKllRq2a5kiZmFargIe5PvA8_X6'
        });
      }

      // Save temporary recovery backup so user can 1-click retry to Google Drive once doPost is deployed,
      // but return an honest 502 error instead of pretending it saved to Google Drive!
      console.warn(`[Upload Proxy] Google Drive upload rejected (${driveRes.driveErrorCode}): ${driveRes.error}`);
      const savedName = saveFileLocally(filename, base64);
      const backupUrl = `http://localhost:${PORT}/uploads/${savedName}`;

      return sendJson(res, 502, {
        status: 'error',
        success: false,
        doPostMissing: driveRes.doPostMissing,
        driveErrorCode: driveRes.driveErrorCode,
        error: driveRes.error,
        localBackupFilename: savedName,
        localBackupUrl: backupUrl
      });
    } catch (err) {
      console.error('[Upload Proxy] Error:', err);
      return sendJson(res, 500, { status: 'error', success: false, error: err.message });
    }
  }

  // 5. Static File Serving (with strict protection blocking .env & dotfiles)
  let cleanPath = pathname === '/' || pathname === '' ? '/Index.html' : pathname;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(cleanPath);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('400 Bad Request');
    return;
  }

  // Block hidden files/folders such as .env, .env.example, .git, .gsd
  const segments = decodedPath.split(/[\\/]+/).filter(Boolean);
  if (segments.some((seg) => seg.startsWith('.'))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Private files are protected.');
    return;
  }

  let filePath = path.resolve(BASE_DIR, decodedPath.replace(/^\/+/, ''));
  if (filePath !== BASE_DIR && !filePath.startsWith(BASE_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      filePath = path.join(BASE_DIR, 'Index.html');
    } else if (stats.isDirectory()) {
      filePath = path.join(filePath, 'Index.html');
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      setCors(res);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  const cfg = getSupabaseEnv();
  console.log(`IT Vision Local Development Server running at http://localhost:${PORT}/`);
  console.log(`Storefront: http://localhost:${PORT}/Index.html#home`);
  console.log(`Admin Portal: http://localhost:${PORT}/Index.html#admin`);
  console.log(`Media Upload API: http://localhost:${PORT}/api/upload-media`);
  console.log(`Supabase Project (.env): ${cfg.projectId || 'Not configured'} (${cfg.secretKey ? 'Secret Key Loaded' : 'Missing Secret Key'})`);
});
