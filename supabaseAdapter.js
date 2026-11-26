/**
 * IT VISION COMPUTER SALES & SERVICE
 * Supabase Client Adapter & Google Drive Media Upload Engine
 * 
 * Supabase Project: mztnzrpfpszfieooeprj
 * Supabase URL: https://mztnzrpfpszfieooeprj.supabase.co
 * Google Drive Media Script URL: https://script.google.com/macros/s/AKfycbxRR30Z9eMtp6WntWzfIB8Bg52jPWXah-b4pDQsFeOR6fn0A6TqTmocbZSVFlE4Ip4noQ/exec
 * 
 * Security Note:
 * Private credentials (SUPABASE_SECRET_KEY) are kept strictly in server `.env` and
 * NEVER exposed to the browser. Localhost / Node server requests route safely through
 * `/api/supabase/*`.
 * 
 * Target Schema:
 * Table: public.products (id, name, price, photos_link, description, available_pcs)
 */

const IT_VISION_CONFIG = {
  SUPABASE_PROJECT_ID: "mztnzrpfpszfieooeprj",
  SUPABASE_URL: "https://mztnzrpfpszfieooeprj.supabase.co",
  // Browser-safe Supabase publishable key (governed by Row Level Security; private secret key remains strictly server-side in env vars)
  SUPABASE_ANON_KEY: "sb_publishable_jlE51hoDjEw_Nd74IoHCuA_9_Ws5yAC",
  MEDIA_UPLOAD_ENDPOINT: "https://script.google.com/macros/s/AKfycbxRR30Z9eMtp6WntWzfIB8Bg52jPWXah-b4pDQsFeOR6fn0A6TqTmocbZSVFlE4Ip4noQ/exec"
};

let supabaseClient = null;
let serverBackendAvailable = false;
let serverConfigLoaded = false;
let serverInitPromise = null;

function isServerHostedEnvironment() {
  if (typeof window === "undefined") return false;
  const proto = window.location.protocol;
  const host = window.location.hostname || "";
  if (proto !== "http:" && proto !== "https:") return false;
  if (host.includes("script.google.com") || host.includes("googleusercontent.com")) return false;
  return true;
}

const SUPABASE_CONFIG_CACHE_KEY = "ITV_SUPA_CONFIG_CACHE";
const SUPABASE_CONFIG_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes to minimize serverless + Postgres hits

/**
 * Asynchronously bootstrap Supabase connection from server `.env` (cached in sessionStorage to avoid redundant calls)
 */
async function initSupabaseAsync(forceRefresh = false) {
  if (serverConfigLoaded && !forceRefresh) {
    return {
      connected: serverBackendAvailable || !!supabaseClient,
      mode: serverBackendAvailable ? "server_env" : (supabaseClient ? "client_key" : "disconnected")
    };
  }

  if (!forceRefresh && typeof sessionStorage !== "undefined") {
    try {
      const raw = sessionStorage.getItem(SUPABASE_CONFIG_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.ts && (Date.now() - parsed.ts < SUPABASE_CONFIG_CACHE_TTL_MS) && parsed.cfg) {
          const cfg = parsed.cfg;
          if (cfg.connected && cfg.mode === "server_env") {
            serverBackendAvailable = true;
            if (cfg.url) IT_VISION_CONFIG.SUPABASE_URL = cfg.url;
            if (cfg.projectId) IT_VISION_CONFIG.SUPABASE_PROJECT_ID = cfg.projectId;
            if (cfg.publishableKey) {
              IT_VISION_CONFIG.SUPABASE_ANON_KEY = cfg.publishableKey;
              initSupabase(cfg.publishableKey);
            }
            serverConfigLoaded = true;
            return { connected: true, mode: "server_env" };
          }
        }
      }
    } catch (_) {}
  }

  if (serverInitPromise && !forceRefresh) return serverInitPromise;

  serverInitPromise = (async () => {
    if (isServerHostedEnvironment()) {
      try {
        const res = await fetch("/api/supabase/config", { method: "GET" });
        const contentType = (res.headers && res.headers.get && res.headers.get("content-type")) || "";
        if (res.ok && contentType.includes("application/json")) {
          const cfg = await res.json();
          if (cfg && cfg.connected && cfg.mode === "server_env") {
            serverBackendAvailable = true;
            if (cfg.url) IT_VISION_CONFIG.SUPABASE_URL = cfg.url;
            if (cfg.projectId) IT_VISION_CONFIG.SUPABASE_PROJECT_ID = cfg.projectId;
            if (cfg.publishableKey) {
              IT_VISION_CONFIG.SUPABASE_ANON_KEY = cfg.publishableKey;
              initSupabase(cfg.publishableKey);
            }
            if (typeof sessionStorage !== "undefined") {
              try {
                sessionStorage.setItem(SUPABASE_CONFIG_CACHE_KEY, JSON.stringify({ ts: Date.now(), cfg }));
              } catch (_) {}
            }
          }
        }
      } catch (e) {
        // Static server without backend proxy — continue cleanly with manual/localStorage key
      }
    }

    serverConfigLoaded = true;
    if (!supabaseClient) initSupabase();
    return {
      connected: serverBackendAvailable || !!supabaseClient,
      mode: serverBackendAvailable ? "server_env" : (supabaseClient ? "client_key" : "disconnected")
    };
  })();

  return serverInitPromise;
}

/**
 * Initialize Supabase JS Client (using publishable/anon key only — never secret keys)
 * @param {string} [explicitKey] - Optional publishable/anon key passed directly
 */
function initSupabase(explicitKey) {
  const anonKey = explicitKey ||
    IT_VISION_CONFIG.SUPABASE_ANON_KEY ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("ITV_SUPABASE_ANON_KEY") : "");

  if (anonKey) {
    IT_VISION_CONFIG.SUPABASE_ANON_KEY = anonKey;
  }

  if (typeof supabase !== "undefined" && anonKey) {
    try {
      supabaseClient = supabase.createClient(IT_VISION_CONFIG.SUPABASE_URL, anonKey);
      return supabaseClient;
    } catch (e) {
      console.warn("Supabase init error:", e);
    }
  }
  return null;
}

/**
 * Set and persist Supabase Publishable / Anon Key (for non-proxy static deployments)
 */
function setSupabaseAnonKey(key) {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (!trimmed) return false;
  IT_VISION_CONFIG.SUPABASE_ANON_KEY = trimmed;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("ITV_SUPABASE_ANON_KEY", trimmed);
  }
  const client = initSupabase(trimmed);
  return !!client;
}

/**
 * Clear stored browser Supabase key
 */
function clearSupabaseAnonKey() {
  IT_VISION_CONFIG.SUPABASE_ANON_KEY = "";
  supabaseClient = null;
  if (typeof localStorage !== "undefined") {
    if (typeof localStorage.removeItem === "function") {
      localStorage.removeItem("ITV_SUPABASE_ANON_KEY");
    } else if (typeof localStorage.setItem === "function") {
      localStorage.setItem("ITV_SUPABASE_ANON_KEY", "");
    }
  }
}

/**
 * Check if Supabase connection is ready (either via .env server proxy or client key)
 */
function isSupabaseConnected() {
  if (serverBackendAvailable) return true;
  if (!supabaseClient) initSupabase();
  return !!supabaseClient;
}

/**
 * Check Supabase connection & database table readiness
 */
async function checkSupabaseHealth() {
  await initSupabaseAsync();

  if (serverBackendAvailable) {
    try {
      const res = await fetch("/api/supabase/health");
      const data = await res.json();
      return { ...data, mode: "server_env" };
    } catch (e) {
      return {
        success: false,
        authValid: false,
        tableExists: false,
        tableMissing: false,
        mode: "server_env",
        message: e.message
      };
    }
  }

  const connected = isSupabaseConnected();
  return {
    success: connected,
    authValid: connected,
    tableExists: connected,
    tableMissing: false,
    mode: "client_key",
    projectId: IT_VISION_CONFIG.SUPABASE_PROJECT_ID,
    message: connected
      ? `Connected via client API key (${IT_VISION_CONFIG.SUPABASE_PROJECT_ID})`
      : "Disconnected (Publishable/Anon key needed)"
  };
}

/**
 * Check Google Drive Apps Script doPost readiness (via local proxy when hosted by server.js)
 */
async function checkDriveHealth() {
  if (isServerHostedEnvironment()) {
    try {
      const res = await fetch("/api/drive/health");
      if (res.ok) return await res.json();
    } catch (_) { }
  }
  return {
    connected: null,
    doPostMissing: false,
    targetFolderId: "1E2MflyKllRq2a5kiZmFargIe5PvA8_X6",
    message: "Direct upload to Google Apps Script endpoint"
  };
}

/**
 * Retry pushing a locally backed-up file in `/uploads/` straight to Google Drive
 */
async function retryLocalFileToDrive(localFilename, mimeType) {
  const res = await fetch("/api/drive/sync-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: localFilename, mimeType: mimeType || "" })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    const err = new Error(data.error || "Drive upload failed.");
    err.doPostMissing = Boolean(data.doPostMissing);
    err.driveErrorCode = data.driveErrorCode || null;
    throw err;
  }
  return data;
}

/**
 * Upload Media (Photos, Videos, Audios) to Google Drive
 * via the Apps Script Web App Endpoint or local proxy with live percentage progress.
 * 
 * @param {File} file - The file object from <input type="file">
 * @param {Function} [onStatusUpdate] - Callback for progress/status messages
 * @param {Function} [onProgress] - Callback receiving (percent: number, label: string)
 * @returns {Promise<{success: boolean, directUrl: string, fileUrl: string, fileId: string}>}
 */
async function uploadMediaToGoogleDrive(file, onStatusUpdate, onProgress) {
  if (!file) {
    throw new Error("No file provided for upload.");
  }

  const emitProgress = (pct, msg) => {
    if (onProgress) onProgress(Math.min(100, Math.max(0, Math.round(pct))), msg);
    if (msg && onStatusUpdate) onStatusUpdate(msg);
  };

  emitProgress(5, `Preparing ${file.name} (${Math.round(file.size / 1024)} KB)...`);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = function (ev) {
      if (ev.lengthComputable) {
        const readPct = 5 + Math.round((ev.loaded / ev.total) * 15);
        emitProgress(readPct, `Reading ${file.name}...`);
      }
    };

    reader.onload = async function () {
      try {
        const fullDataUrl = reader.result;
        let base64Content = fullDataUrl;
        if (base64Content.indexOf("base64,") !== -1) {
          base64Content = base64Content.split("base64,")[1];
        }

        const payload = {
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          base64: base64Content
        };

        emitProgress(20, `Starting upload of ${file.name} to Google Drive...`);

        // 1. Direct Apps Script RPC if running inside Google Apps Script
        if (typeof google !== "undefined" && google.script && google.script.run && typeof google.script.run.uploadPhoto === "function") {
          emitProgress(50, `Uploading ${file.name} via Google Apps Script...`);
          google.script.run
            .withSuccessHandler(function (res) {
              if (res && (res.status === "success" || res.success)) {
                var directUrl = res.directUrl ||
                  (res.fileId ? `https://lh3.googleusercontent.com/d/${res.fileId}=w800-rw` : res.url);
                emitProgress(100, `✔ Uploaded successfully to Google Drive!`);
                resolve({
                  success: true,
                  status: "success",
                  fileId: res.fileId || "",
                  fileUrl: res.url || directUrl,
                  directUrl: directUrl,
                  filename: file.name
                });
              } else {
                reject(new Error(res ? res.message : "Upload failed"));
              }
            })
            .withFailureHandler(function (err) {
              reject(err);
            })
            .uploadPhoto(fullDataUrl, file.name, file.type || "");
          return;
        }

        // Check whether genuine server.js / Netlify backend proxy is active before using /api/upload-media
        await initSupabaseAsync();

        // Same-origin XHR upload (safe for real byte progress only on same origin — never triggers CORS preflight)
        const sendSameOriginXhrUpload = (endpoint, bodyStr) => {
          return new Promise((xhrResolve, xhrReject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", endpoint, true);
            xhr.setRequestHeader("Content-Type", "application/json");

            xhr.upload.onprogress = function (ev) {
              if (ev.lengthComputable && ev.total > 0) {
                const pct = 20 + Math.round((ev.loaded / ev.total) * 65);
                emitProgress(pct, `Uploading ${file.name}... ${Math.round((ev.loaded / ev.total) * 100)}%`);
              }
            };

            xhr.upload.onload = function () {
              emitProgress(90, `Saving ${file.name} to Google Drive...`);
            };

            xhr.onreadystatechange = function () {
              if (xhr.readyState !== 4) return;
              let parsed = null;
              try {
                parsed = JSON.parse(xhr.responseText);
              } catch (_) {
                const parseErr = new Error(`Upload endpoint returned HTTP ${xhr.status} (invalid JSON).`);
                parseErr.httpStatus = xhr.status;
                parseErr.isInvalidJson = true;
                return xhrReject(parseErr);
              }
              xhrResolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, result: parsed });
            };

            xhr.onerror = function () {
              const netErr = new Error("Network error during media upload.");
              netErr.httpStatus = 0;
              xhrReject(netErr);
            };

            xhr.send(bodyStr);
          });
        };

        // Cross-origin CORS simple-request POST via fetch (NO xhr.upload listeners, so NO OPTIONS preflight!)
        // Google Apps Script Web Apps omit ACAO on OPTIONS preflight, which breaks cross-origin XHR with upload listeners.
        const sendDirectAppsScriptFetch = async (bodyStr) => {
          let currentPct = 22;
          emitProgress(currentPct, `Uploading ${file.name} to Google Drive...`);
          const progressTimer = setInterval(() => {
            if (currentPct < 92) {
              currentPct += currentPct < 70 ? 6 : 2;
              emitProgress(currentPct, `Uploading ${file.name} to Google Drive... ${currentPct}%`);
            }
          }, 300);

          try {
            const res = await fetch(IT_VISION_CONFIG.MEDIA_UPLOAD_ENDPOINT, {
              method: "POST",
              mode: "cors",
              credentials: "omit",
              redirect: "follow",
              headers: {
                "Content-Type": "text/plain;charset=utf-8"
              },
              body: bodyStr
            });

            const rawText = await res.text();
            let parsed = null;
            try {
              parsed = JSON.parse(rawText);
            } catch (_) {
              if (rawText && rawText.includes("Script function not found: doPost")) {
                throw new Error("Google Apps Script deployment is missing doPost(e).");
              }
              throw new Error(`Google Drive script returned HTTP ${res.status} (non-JSON response).`);
            }
            return { ok: res.ok, status: res.status, result: parsed };
          } finally {
            clearInterval(progressTimer);
          }
        };

        const bodyJson = JSON.stringify(payload);
        let uploadResponse;

        if (serverBackendAvailable && typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
          try {
            uploadResponse = await sendSameOriginXhrUpload("/api/upload-media", bodyJson);
          } catch (proxyErr) {
            if (proxyErr.httpStatus === 404 || proxyErr.isInvalidJson || proxyErr.httpStatus === 0) {
              uploadResponse = await sendDirectAppsScriptFetch(bodyJson);
            } else {
              throw proxyErr;
            }
          }
        } else {
          // Netlify / static / production hosting: upload directly to Google Apps Script without OPTIONS preflight
          uploadResponse = await sendDirectAppsScriptFetch(bodyJson);
        }

        const { ok, status, result } = uploadResponse;

        if (ok && result && (result.success || result.status === "success" || result.fileUrl || result.directUrl || result.url)) {
          let directUrl = result.directUrl;
          if (!directUrl && result.url) {
            var m = result.url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (m && m[1]) {
              directUrl = (file.type && (file.type.startsWith("video/") || file.type.startsWith("audio/")))
                ? `https://drive.google.com/uc?export=download&id=${m[1]}`
                : `https://lh3.googleusercontent.com/d/${m[1]}=w800-rw`;
            } else {
              directUrl = result.url;
            }
          } else if (!directUrl && result.fileId) {
            directUrl = `https://lh3.googleusercontent.com/d/${result.fileId}=w800-rw`;
          }

          emitProgress(100, `✔ Uploaded to Google Drive!`);

          resolve({
            success: true,
            status: "success",
            source: result.source || "google_drive",
            fileId: result.fileId || "",
            fileUrl: result.fileUrl || result.url || directUrl,
            directUrl: directUrl,
            previewUrl: result.previewUrl || directUrl,
            filename: result.filename || file.name,
            mimeType: file.type || ""
          });
        } else {
          const err = new Error((result && (result.error || result.message)) || `Google Drive upload failed (HTTP ${status}).`);
          err.doPostMissing = Boolean(result && result.doPostMissing);
          err.driveErrorCode = (result && result.driveErrorCode) || null;
          err.localBackupFilename = (result && result.localBackupFilename) || null;
          err.localBackupUrl = (result && result.localBackupUrl) || null;
          throw err;
        }
      } catch (err) {
        console.error("Media upload error:", err);
        if (onStatusUpdate) onStatusUpdate(`❌ Upload failed: ${err.message}`);
        reject(err);
      }
    };

    reader.onerror = function () {
      if (onStatusUpdate) onStatusUpdate(`❌ File read error`);
      reject(new Error("Failed to read file on client side."));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Supabase Products Operations (Only Table in Database)
 */

function isMissingTableErr(errObj) {
  if (!errObj) return false;
  const msg = String(errObj.message || errObj.error || "");
  return errObj.code === "PGRST205" || Boolean(errObj.tableMissing) || msg.includes("schema cache") || msg.includes("public.products");
}

function isMissingCategoryColErr(errObj) {
  if (!errObj) return false;
  const msg = String(errObj.message || errObj.error || "");
  return (errObj.code === "PGRST204" || errObj.code === "42703") && msg.includes("category");
}

/**
 * Fetch all products from Supabase (prefers server `.env` proxy when available)
 */
async function fetchSupabaseProducts() {
  await initSupabaseAsync();

  if (serverBackendAvailable) {
    try {
      const res = await fetch("/api/supabase/products");
      const data = await res.json();
      if (res.ok && data && data.success) {
        return data.products || [];
      }
      if (data && data.tableMissing) {
        console.warn("Supabase notice:", data.error);
        const err = new Error(data.error || "Table 'public.products' missing");
        err.tableMissing = true;
        err.code = data.code || "PGRST205";
        throw err;
      }
      return null;
    } catch (err) {
      if (err && err.tableMissing) throw err;
      console.warn("Server Supabase proxy fetch exception:", err);
      return null;
    }
  }

  if (!supabaseClient) initSupabase();
  if (!supabaseClient) return null;

  try {
    let { data, error } = await supabaseClient
      .from('products')
      .select('id, name, price, photos_link, description, available_pcs, category')
      .order('price', { ascending: false });

    if (error && isMissingCategoryColErr(error)) {
      const fallback = await supabaseClient
        .from('products')
        .select('id, name, price, photos_link, description, available_pcs')
        .order('price', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.warn("Supabase fetch error:", error);
      if (isMissingTableErr(error)) {
        const err = new Error(error.message || "Table 'public.products' does not exist in Supabase yet.");
        err.tableMissing = true;
        err.code = error.code || "PGRST205";
        throw err;
      }
      return null;
    }
    return data;
  } catch (err) {
    if (err && err.tableMissing) throw err;
    console.warn("Supabase fetch exception:", err);
    return null;
  }
}

/**
 * Insert or Update Product in Supabase
 * @param {Object} product - { id, name, price, category, photos_link, description, available_pcs }
 */
async function saveSupabaseProduct(product) {
  await initSupabaseAsync();

  const payload = {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    photos_link: product.photos_link || "",
    description: product.description || "",
    available_pcs: Number(product.available_pcs || 0),
    updated_at: new Date().toISOString()
  };
  if (product.category) {
    payload.category = String(product.category).trim();
  }

  if (serverBackendAvailable) {
    const res = await fetch("/api/supabase/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const resJson = await res.json();
    if (!res.ok || !resJson.success) {
      const err = new Error(resJson.error || `Supabase save failed (HTTP ${res.status})`);
      err.tableMissing = Boolean(resJson.tableMissing || isMissingTableErr(resJson));
      err.code = resJson.code || null;
      throw err;
    }
    return resJson.data;
  }

  if (!supabaseClient) initSupabase();

  if (!supabaseClient) {
    throw new Error("Supabase SDK failed to initialize with project publishable key.");
  }

  let { data, error } = await supabaseClient
    .from('products')
    .upsert(payload, { onConflict: 'id' })
    .select();

  if (error && isMissingCategoryColErr(error)) {
    const sdkFallback = { ...payload };
    delete sdkFallback.category;
    const retry = await supabaseClient
      .from('products')
      .upsert(sdkFallback, { onConflict: 'id' })
      .select();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    const isRlsDeny = error.code === "42501" || (error.message && error.message.toLowerCase().includes("row-level security"));
    const wrapped = new Error(isRlsDeny
      ? "Writes are secured server-side via /api/supabase/products (SUPABASE_SECRET_KEY). Open the hosted app rather than direct anonymous client writes."
      : (error.message || "Supabase upsert error"));
    wrapped.code = error.code;
    wrapped.tableMissing = isMissingTableErr(error);
    throw wrapped;
  }
  return data;
}

/**
 * Delete Product from Supabase by ID
 */
async function deleteSupabaseProduct(productId) {
  await initSupabaseAsync();

  if (serverBackendAvailable) {
    const res = await fetch(`/api/supabase/products?id=${encodeURIComponent(productId)}`, {
      method: "DELETE"
    });
    const resJson = await res.json();
    if (!res.ok || !resJson.success) {
      const err = new Error(resJson.error || `Delete failed (HTTP ${res.status})`);
      err.tableMissing = Boolean(resJson.tableMissing || isMissingTableErr(resJson));
      err.code = resJson.code || null;
      throw err;
    }
    return resJson.data;
  }

  if (!supabaseClient) initSupabase();
  if (!supabaseClient) throw new Error("Supabase client is not connected. Please set your key.");

  const { data, error } = await supabaseClient
    .from('products')
    .delete()
    .eq('id', productId)
    .select();

  if (error) {
    const isRlsDeny = error.code === "42501" || (error.message && error.message.toLowerCase().includes("row-level security"));
    const wrapped = new Error(isRlsDeny
      ? "Deletes are secured server-side via /api/supabase/products (SUPABASE_SECRET_KEY). Open the hosted app rather than direct anonymous client deletes."
      : (error.message || "Delete failed"));
    wrapped.code = error.code;
    wrapped.tableMissing = isMissingTableErr(error);
    throw wrapped;
  }
  return data;
}

let adminSessionToken = "";

function setAdminToken(token) {
  adminSessionToken = token ? String(token) : "";
  if (typeof sessionStorage !== "undefined") {
    try {
      if (adminSessionToken) sessionStorage.setItem("ITV_ADMIN_TOKEN", adminSessionToken);
      else if (typeof sessionStorage.removeItem === "function") sessionStorage.removeItem("ITV_ADMIN_TOKEN");
    } catch (_) {}
  }
}

function getAdminToken() {
  if (adminSessionToken) return adminSessionToken;
  if (typeof sessionStorage !== "undefined") {
    try {
      adminSessionToken = sessionStorage.getItem("ITV_ADMIN_TOKEN") || "";
    } catch (_) {}
  }
  return adminSessionToken;
}

function clearAdminToken() {
  setAdminToken("");
}

/**
 * Fetch Admin Transactions from Supabase via authenticated Netlify/Node server proxy
 */
async function fetchSupabaseTransactions() {
  await initSupabaseAsync();
  const token = getAdminToken();
  if (!serverBackendAvailable || !token) return null;

  try {
    const res = await fetch("/api/supabase/transactions", {
      method: "GET",
      headers: { "X-Admin-Token": token }
    });
    const data = await res.json();
    if (res.ok && data && data.success) {
      return data.transactions || [];
    }
    if (res.status === 401) {
      clearAdminToken();
      const err = new Error(data.error || "Admin session expired. Please unlock Control Panel again.");
      err.authRequired = true;
      throw err;
    }
    return null;
  } catch (err) {
    if (err && err.authRequired) throw err;
    console.warn("Transactions fetch exception:", err);
    return null;
  }
}

/**
 * Insert or Update Admin Transaction Bill in Supabase
 */
async function saveSupabaseTransaction(txn) {
  await initSupabaseAsync();
  const token = getAdminToken();
  if (!serverBackendAvailable) {
    throw new Error("Server proxy unavailable; saved in local browser storage.");
  }
  if (!token) {
    const err = new Error("Admin session required. Please sign in to save to Supabase.");
    err.authRequired = true;
    throw err;
  }

  const res = await fetch("/api/supabase/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Token": token
    },
    body: JSON.stringify(txn)
  });
  const resJson = await res.json();
  if (!res.ok || !resJson.success) {
    const err = new Error(resJson.error || `Transaction save failed (HTTP ${res.status})`);
    err.authRequired = res.status === 401;
    throw err;
  }
  return resJson.data;
}

/**
 * Delete Admin Transaction Bill from Supabase by Bill No
 */
async function deleteSupabaseTransaction(billNo) {
  await initSupabaseAsync();
  const token = getAdminToken();
  if (!serverBackendAvailable) {
    throw new Error("Server proxy unavailable; removed from local browser storage.");
  }
  if (!token) {
    const err = new Error("Admin session required. Please sign in to delete from Supabase.");
    err.authRequired = true;
    throw err;
  }

  const res = await fetch(`/api/supabase/transactions?bill_no=${encodeURIComponent(billNo)}`, {
    method: "DELETE",
    headers: { "X-Admin-Token": token }
  });
  const resJson = await res.json();
  if (!res.ok || !resJson.success) {
    const err = new Error(resJson.error || `Transaction delete failed (HTTP ${res.status})`);
    err.authRequired = res.status === 401;
    throw err;
  }
  return resJson.data;
}

// Global exposure
window.ITVisionSupabase = {
  config: IT_VISION_CONFIG,
  init: initSupabase,
  initAsync: initSupabaseAsync,
  setAnonKey: setSupabaseAnonKey,
  clearAnonKey: clearSupabaseAnonKey,
  isConnected: isSupabaseConnected,
  isServerBacked: () => serverBackendAvailable,
  checkHealth: checkSupabaseHealth,
  checkDriveHealth: checkDriveHealth,
  retryLocalFileToDrive: retryLocalFileToDrive,
  uploadMedia: uploadMediaToGoogleDrive,
  fetchProducts: fetchSupabaseProducts,
  saveProduct: saveSupabaseProduct,
  deleteProduct: deleteSupabaseProduct,
  setAdminToken: setAdminToken,
  getAdminToken: getAdminToken,
  clearAdminToken: clearAdminToken,
  fetchTransactions: fetchSupabaseTransactions,
  saveTransaction: saveSupabaseTransaction,
  deleteTransaction: deleteSupabaseTransaction
};

// Pre-warm .env connection on load in browser environments
if (typeof window !== "undefined") {
  initSupabaseAsync().then(() => {
    if (typeof window.updateSupabaseStatusUI === "function") {
      window.updateSupabaseStatusUI();
    }
  });
}
