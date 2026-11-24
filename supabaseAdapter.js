/**
 * IT VISION COMPUTER SALES & SERVICE
 * Supabase Client Adapter & Google Drive Media Upload Engine
 * 
 * Supabase Project: mztnzrpfpszfieooeprj
 * Supabase URL: https://mztnzrpfpszfieooeprj.supabase.co
 * Google Drive Media Script URL: https://script.google.com/macros/s/AKfycbwa3D0RyEZl50W6IDGijCKcaL7qbSBm9q4W05yy4l7G5LRIZ9fQvww6j-PVkGoQ7ID53g/exec
 * 
 * Target Schema:
 * Table: public.products (id, name, price, photos_link, description, available_pcs)
 */

const IT_VISION_CONFIG = {
  SUPABASE_PROJECT_ID: "mztnzrpfpszfieooeprj",
  SUPABASE_URL: "https://mztnzrpfpszfieooeprj.supabase.co",
  SUPABASE_ANON_KEY: localStorage.getItem("ITV_SUPABASE_ANON_KEY") || "",
  MEDIA_UPLOAD_ENDPOINT: "https://script.google.com/macros/s/AKfycbwa3D0RyEZl50W6IDGijCKcaL7qbSBm9q4W05yy4l7G5LRIZ9fQvww6j-PVkGoQ7ID53g/exec"
};

let supabaseClient = null;

/**
 * Initialize Supabase Client
 */
function initSupabase() {
  const anonKey = IT_VISION_CONFIG.SUPABASE_ANON_KEY || localStorage.getItem("ITV_SUPABASE_ANON_KEY");
  if (typeof supabase !== "undefined" && anonKey) {
    try {
      supabaseClient = supabase.createClient(IT_VISION_CONFIG.SUPABASE_URL, anonKey);
      console.log("✔ Supabase initialized for project:", IT_VISION_CONFIG.SUPABASE_PROJECT_ID);
      return supabaseClient;
    } catch (e) {
      console.warn("Supabase init error:", e);
    }
  }
  return null;
}

/**
 * Upload Media (Photos, Videos, Audios) to Google Drive
 * via the Apps Script Web App Endpoint.
 * 
 * @param {File} file - The file object from <input type="file">
 * @param {Function} [onStatusUpdate] - Callback for progress/status messages
 * @returns {Promise<{success: boolean, directUrl: string, fileUrl: string, fileId: string}>}
 */
async function uploadMediaToGoogleDrive(file, onStatusUpdate) {
  if (!file) {
    throw new Error("No file provided for upload.");
  }

  if (onStatusUpdate) onStatusUpdate(`Reading ${file.name} (${Math.round(file.size / 1024)} KB)...`);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async function() {
      try {
        const fullDataUrl = reader.result;
        // Extract raw base64 string
        let base64Content = fullDataUrl;
        if (base64Content.indexOf("base64,") !== -1) {
          base64Content = base64Content.split("base64,")[1];
        }

        const payload = {
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          base64: base64Content
        };

        if (onStatusUpdate) onStatusUpdate(`Uploading ${file.name} to Google Drive...`);

        // Send payload via POST as text/plain to prevent browser CORS preflight (OPTIONS) block
        const response = await fetch(IT_VISION_CONFIG.MEDIA_UPLOAD_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        // Support various Google Apps Script response formats
        if (result && (result.success || result.fileUrl || result.directUrl || result.url)) {
          const directUrl = result.directUrl || 
            (result.fileId ? `https://lh3.googleusercontent.com/d/${result.fileId}=w800-rw` : result.fileUrl || result.url);
          
          if (onStatusUpdate) onStatusUpdate(`✔ Uploaded successfully to Google Drive!`);
          
          resolve({
            success: true,
            fileId: result.fileId || "",
            fileUrl: result.fileUrl || result.url || directUrl,
            directUrl: directUrl,
            filename: file.name
          });
        } else {
          throw new Error(result.error || result.message || "Upload failed from Google Apps Script.");
        }
      } catch (err) {
        console.error("Media upload error:", err);
        if (onStatusUpdate) onStatusUpdate(`❌ Upload failed: ${err.message}`);
        reject(err);
      }
    };

    reader.onerror = function(e) {
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
 * Fetch all products from Supabase
 */
async function fetchSupabaseProducts() {
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
  if (!supabaseClient) initSupabase();
  if (!supabaseClient) throw new Error("Supabase client is not connected. Please set anon key.");

  const payload = {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    photos_link: product.photos_link || "",
    description: product.description || "",
    available_pcs: Number(product.available_pcs || 0),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseClient
    .from('products')
    .upsert(payload, { onConflict: 'id' })
    .select();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Delete Product from Supabase by ID
 */
async function deleteSupabaseProduct(productId) {
  if (!supabaseClient) initSupabase();
  if (!supabaseClient) throw new Error("Supabase client is not connected.");

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
  uploadMedia: uploadMediaToGoogleDrive,
  fetchProducts: fetchSupabaseProducts,
  saveProduct: saveSupabaseProduct,
  deleteProduct: deleteSupabaseProduct
};
