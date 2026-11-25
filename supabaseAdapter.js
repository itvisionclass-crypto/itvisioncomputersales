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
  SUPABASE_ANON_KEY: (typeof localStorage !== "undefined" ? localStorage.getItem("ITV_SUPABASE_ANON_KEY") : "") || "",
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

/**
 * Asynchronously bootstrap Supabase connection from server `.env` (safe public config + proxy)
 */
async function initSupabaseAsync() {
  if (serverConfigLoaded) {
    return {
      connected: serverBackendAvailable || !!supabaseClient,
      mode: serverBackendAvailable ? "server_env" : (supabaseClient ? "client_key" : "disconnected")
    };
  }

  if (serverInitPromise) return serverInitPromise;

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
    localStorage.removeItem("ITV_SUPABASE_ANON_KEY");
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
    } catch (_) {}
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

    reader.onprogress = function(ev) {
      if (ev.lengthComputable) {
        const readPct = 5 + Math.round((ev.loaded / ev.total) * 15);
        emitProgress(readPct, `Reading ${file.name}...`);
      }
    };

    reader.onload = async function() {
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
            .withSuccessHandler(function(res) {
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
            .withFailureHandler(function(err) {
              reject(err);
            })
            .uploadPhoto(fullDataUrl, file.name, file.type || "");
          return;
        }

        // Check whether genuine server.js backend is active before using /api/upload-media proxy
        await initSupabaseAsync();

        const sendXhrUpload = (endpoint, contentType, bodyStr) => {
          return new Promise((xhrResolve, xhrReject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", endpoint, true);
            xhr.setRequestHeader("Content-Type", contentType);

            xhr.upload.onprogress = function(ev) {
              if (ev.lengthComputable && ev.total > 0) {
                const pct = 20 + Math.round((ev.loaded / ev.total) * 65);
                emitProgress(pct, `Uploading ${file.name}... ${Math.round((ev.loaded / ev.total) * 100)}%`);
              }
            };

            xhr.upload.onload = function() {
              emitProgress(90, `Saving ${file.name} to Google Drive...`);
            };

            xhr.onreadystatechange = function() {
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

            xhr.onerror = function() {
              const netErr = new Error("Network error during media upload.");
              netErr.httpStatus = 0;
              xhrReject(netErr);
            };

            xhr.send(bodyStr);
          });
        };

        const bodyJson = JSON.stringify(payload);
        let xhrResult;

        if (serverBackendAvailable) {
          try {
            xhrResult = await sendXhrUpload("/api/upload-media", "application/json", bodyJson);
          } catch (proxyErr) {
            // If static host / proxy returned 404 or non-JSON HTML, seamlessly upload directly to Google Apps Script
            if (proxyErr.httpStatus === 404 || proxyErr.isInvalidJson || proxyErr.httpStatus === 0) {
              emitProgress(25, `Uploading ${file.name} directly to Google Drive script...`);
              xhrResult = await sendXhrUpload(
                IT_VISION_CONFIG.MEDIA_UPLOAD_ENDPOINT,
                "text/plain;charset=utf-8",
                bodyJson
              );
            } else {
              throw proxyErr;
            }
          }
        } else {
          // Direct upload to Google Apps Script doPost(e) using simple-request CORS Content-Type
          xhrResult = await sendXhrUpload(
            IT_VISION_CONFIG.MEDIA_UPLOAD_ENDPOINT,
            "text/plain;charset=utf-8",
            bodyJson
          );
        }

        const { ok, status, result } = xhrResult;

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

    reader.onerror = function() {
      if (onStatusUpdate) onStatusUpdate(`❌ File read error`);
      reject(new Error("Failed to read file on client side."));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Supabase Products Operations (Only Table in Database)
 */

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
      }
      return null;
    } catch (err) {
      console.warn("Server Supabase proxy fetch exception:", err);
      return null;
    }
  }

  if (!supabaseClient) initSupabase();
  if (!supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('id, name, price, photos_link, description, available_pcs')
      .order('price', { ascending: false });

    if (error) {
      console.warn("Supabase fetch error:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn("Supabase fetch exception:", err);
    return null;
  }
}

/**
 * Insert or Update Product in Supabase
 * @param {Object} product - { id, name, price, photos_link, description, available_pcs }
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

  if (serverBackendAvailable) {
    const res = await fetch("/api/supabase/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const resJson = await res.json();
    if (!res.ok || !resJson.success) {
      const err = new Error(resJson.error || `Supabase save failed (HTTP ${res.status})`);
      err.tableMissing = Boolean(resJson.tableMissing);
      err.code = resJson.code || null;
      throw err;
    }
    return resJson.data;
  }

  if (!supabaseClient) initSupabase();

  if (!supabaseClient && typeof window !== "undefined") {
    const entered = window.prompt(
      "Supabase Project: mztnzrpfpszfieooeprj\n\n" +
      "To save products to your Supabase database, please paste your publishable/anon key:\n" +
      "(Found in Supabase Dashboard -> Project Settings -> API)"
    );
    if (entered && entered.trim()) {
      setSupabaseAnonKey(entered.trim());
      if (typeof window.updateSupabaseStatusUI === "function") {
        window.updateSupabaseStatusUI();
      }
    }
  }

  if (!supabaseClient) {
    throw new Error("Supabase client is not connected. Please paste your publishable/anon key in the Supabase Connection bar above.");
  }

  const { data, error } = await supabaseClient
    .from('products')
    .upsert(payload, { onConflict: 'id' })
    .select();

  if (error) {
    const wrapped = new Error(error.message || "Supabase upsert error");
    wrapped.code = error.code;
    wrapped.tableMissing = error.code === "PGRST205" || (error.message && error.message.includes("schema cache"));
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
      throw new Error(resJson.error || `Delete failed (HTTP ${res.status})`);
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
    throw error;
  }
  return data;
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
  deleteProduct: deleteSupabaseProduct
};

// Pre-warm .env connection on load in browser environments
if (typeof window !== "undefined") {
  initSupabaseAsync().then(() => {
    if (typeof window.updateSupabaseStatusUI === "function") {
      window.updateSupabaseStatusUI();
    }
  });
}
