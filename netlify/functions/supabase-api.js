const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const ADMIN_CRED_SHA256 = 'f966a9ce0782d1d49d05ce904990c8ce0451b6e29ee6011908d4ede5ccc677f3';

function sha256Buffer(str) {
  return crypto.createHash('sha256').update(String(str || ''), 'utf8').digest();
}

function getSupabaseEnv() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';
  const secretKey = process.env.SUPABASE_SECRET_KEY || '';
  const jwksUrl = process.env.SUPABASE_JWKS_URL || '';
  let projectId = 'mztnzrpfpszfieooeprj';
  try {
    if (url) projectId = new URL(url).hostname.split('.')[0] || projectId;
  } catch (_) {}
  return { url, publishableKey, secretKey, jwksUrl, projectId };
}

function jsonResponse(statusCode, bodyObj, cacheControl = 'no-store') {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(bodyObj)
  };
}

function isMissingTableResponse(res) {
  const data = res && res.data;
  return Boolean(data && (data.code === 'PGRST205' || (typeof data.message === 'string' && data.message.includes('schema cache'))));
}

function isMissingCategoryCol(res) {
  const data = res && res.data;
  return Boolean(data && (data.code === 'PGRST204' || data.code === '42703') && typeof data.message === 'string' && data.message.includes('category'));
}

function supabaseRestRequest({ method, restPath, bodyObj = null, useSecret = true, prefer = null }) {
  return new Promise((resolve, reject) => {
    const cfg = getSupabaseEnv();
    const apiKey = useSecret ? (cfg.secretKey || cfg.publishableKey) : cfg.publishableKey;
    if (!cfg.url || !apiKey) {
      return reject(new Error('Supabase credentials are not configured in Netlify environment variables.'));
    }

    const target = new URL(`${cfg.url}/rest/v1${restPath}`);
    const bodyStr = bodyObj !== null ? JSON.stringify(bodyObj) : null;
    const headers = {
      apikey: apiKey,
      Accept: 'application/json'
    };

    if (bodyStr !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    if (prefer) {
      headers.Prefer = prefer;
    }

    const req = https.request({
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method,
      headers
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch (_) {
          data = null;
        }
        resolve({ statusCode: res.statusCode, data, raw });
      });
    });

    req.on('error', reject);
    if (bodyStr !== null) req.write(bodyStr);
    req.end();
  });
}

exports.handler = async function (event) {
  const method = (event.httpMethod || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  const reqPath = (event.path || '').toLowerCase();
  const cfg = getSupabaseEnv();

  // Safe Config Endpoint (never exposes SUPABASE_SECRET_KEY)
  if (reqPath.endsWith('/config') && method === 'GET') {
    const configured = Boolean(cfg.url && (cfg.secretKey || cfg.publishableKey));
    return jsonResponse(200, {
      success: true,
      connected: configured,
      mode: configured ? 'server_env' : 'client_key',
      projectId: cfg.projectId,
      url: cfg.url || 'https://mztnzrpfpszfieooeprj.supabase.co',
      publishableKey: cfg.publishableKey,
      hasSecretKey: Boolean(cfg.secretKey),
      hasJwksUrl: Boolean(cfg.jwksUrl)
    }, 'public, max-age=300');
  }

  // Health Check Endpoint (single lightweight table probe — no OpenAPI root schema query)
  if (reqPath.endsWith('/health') && method === 'GET') {
    if (!cfg.url || (!cfg.secretKey && !cfg.publishableKey)) {
      return jsonResponse(200, {
        success: false,
        authValid: false,
        tableExists: false,
        tableMissing: false,
        message: 'Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY in Netlify Environment Variables, or paste your publishable key below.'
      });
    }

    try {
      const tblRes = await supabaseRestRequest({
        method: 'GET',
        restPath: '/products?select=id&limit=1',
        useSecret: true
      });
      const tableExists = tblRes.statusCode >= 200 && tblRes.statusCode < 300;
      const tableMissing = !tableExists && isMissingTableResponse(tblRes);
      const authValid = tableExists || tableMissing || (tblRes.statusCode !== 401 && tblRes.statusCode !== 403 && tblRes.statusCode < 500);

      return jsonResponse(200, {
        success: authValid && tableExists,
        authValid,
        tableExists,
        tableMissing,
        projectId: cfg.projectId,
        message: tableExists
          ? `Connected to Supabase (${cfg.projectId}) and public.products table is ready.`
          : tableMissing
            ? `Supabase connected, but table 'public.products' does not exist yet. Run supabase_schema.sql in Supabase SQL Editor.`
            : (tblRes.data && tblRes.data.message) || `Supabase returned status ${tblRes.statusCode}`
      });
    } catch (err) {
      return jsonResponse(502, { success: false, message: err.message });
    }
  }

  // Products CRUD Endpoint
  if (reqPath.endsWith('/products')) {
    try {
      if (method === 'GET') {
        let supaRes = await supabaseRestRequest({
          method: 'GET',
          restPath: '/products?select=id,name,price,photos_link,description,available_pcs,category&order=price.desc',
          useSecret: true
        });
        if (isMissingCategoryCol(supaRes)) {
          supaRes = await supabaseRestRequest({
            method: 'GET',
            restPath: '/products?select=id,name,price,photos_link,description,available_pcs&order=price.desc',
            useSecret: true
          });
        }
        if (supaRes.statusCode >= 200 && supaRes.statusCode < 300) {
          return jsonResponse(200, {
            success: true,
            products: Array.isArray(supaRes.data) ? supaRes.data : []
          });
        }
        const tableMissing = isMissingTableResponse(supaRes);
        return jsonResponse(supaRes.statusCode || 502, {
          success: false,
          tableMissing,
          code: supaRes.data && supaRes.data.code,
          error: tableMissing
            ? "Table 'public.products' does not exist in Supabase yet. Run supabase_schema.sql in Supabase SQL Editor."
            : (supaRes.data && supaRes.data.message) || 'Failed to fetch products from Supabase.'
        });
      }

      if (method === 'POST') {
        const product = JSON.parse(event.body || '{}');
        if (!product || !product.id || !product.name || isNaN(Number(product.price))) {
          return jsonResponse(400, {
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
        if (product.category) {
          payload.category = String(product.category).trim();
        }

        let supaRes = await supabaseRestRequest({
          method: 'POST',
          restPath: '/products?on_conflict=id',
          bodyObj: payload,
          useSecret: true,
          prefer: 'resolution=merge-duplicates,return=representation'
        });
        if (isMissingCategoryCol(supaRes)) {
          delete payload.category;
          supaRes = await supabaseRestRequest({
            method: 'POST',
            restPath: '/products?on_conflict=id',
            bodyObj: payload,
            useSecret: true,
            prefer: 'resolution=merge-duplicates,return=representation'
          });
        }

        if (supaRes.statusCode >= 200 && supaRes.statusCode < 300) {
          return jsonResponse(200, { success: true, data: supaRes.data });
        }
        const tableMissing = isMissingTableResponse(supaRes);
        return jsonResponse(supaRes.statusCode || 502, {
          success: false,
          tableMissing,
          code: supaRes.data && supaRes.data.code,
          error: tableMissing
            ? "Table 'public.products' does not exist in Supabase yet. Run supabase_schema.sql in Supabase SQL Editor."
            : (supaRes.data && supaRes.data.message) || 'Failed to save product to Supabase.'
        });
      }

      if (method === 'DELETE') {
        const qs = event.queryStringParameters || {};
        let productId = qs.id;
        if (!productId && event.body) {
          try {
            productId = JSON.parse(event.body).id;
          } catch (_) {}
        }
        if (!productId) {
          return jsonResponse(400, { success: false, error: 'Missing product id for deletion.' });
        }

        const supaRes = await supabaseRestRequest({
          method: 'DELETE',
          restPath: `/products?id=eq.${encodeURIComponent(productId)}`,
          useSecret: true,
          prefer: 'return=representation'
        });

        if (supaRes.statusCode >= 200 && supaRes.statusCode < 300) {
          return jsonResponse(200, { success: true, data: supaRes.data });
        }
        const tableMissing = isMissingTableResponse(supaRes);
        return jsonResponse(supaRes.statusCode || 502, {
          success: false,
          tableMissing,
          code: supaRes.data && supaRes.data.code,
          error: tableMissing
            ? "Table 'public.products' does not exist in Supabase yet. Run supabase_schema.sql in Supabase SQL Editor."
            : (supaRes.data && supaRes.data.message) || 'Failed to delete product from Supabase.'
        });
      }

      return jsonResponse(405, { success: false, error: 'Method not allowed.' });
    } catch (err) {
      return jsonResponse(500, { success: false, error: err.message });
    }
  }

  // Admin Portal Authentication Endpoint (verifies credentials against server env vars)
  if (reqPath.endsWith('/admin-login') && method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!username || !password) {
        return jsonResponse(400, { success: false, error: 'Username and password are required.' });
      }

      const envUser = process.env.ADMIN_USERNAME;
      const envPass = process.env.ADMIN_PASSWORD;
      let isValid = false;

      if (envUser && envPass) {
        const uOk = crypto.timingSafeEqual(sha256Buffer(username), sha256Buffer(envUser));
        const pOk = crypto.timingSafeEqual(sha256Buffer(password), sha256Buffer(envPass));
        isValid = uOk && pOk;
      } else {
        const expectedBuf = Buffer.from(ADMIN_CRED_SHA256, 'hex');
        const inputBuf = sha256Buffer(`${username}::${password}`);
        isValid = crypto.timingSafeEqual(inputBuf, expectedBuf);
      }

      if (!isValid) {
        return jsonResponse(401, { success: false, error: 'Invalid admin username or password.' });
      }
      return jsonResponse(200, { success: true, username });
    } catch (_) {
      return jsonResponse(400, { success: false, error: 'Invalid authentication request payload.' });
    }
  }

  return jsonResponse(404, { success: false, error: 'Supabase API route not found.' });
};
