/**
 * IT VISION COMPUTER SALES & SERVICE
 * Supabase Client Adapter & Cloud Database Service
 * 
 * Project ID: mztnzrpfpszfieooeprj
 * Project URL: https://mztnzrpfpszfieooeprj.supabase.co
 * (Non-media data: Products, Orders, Service Tickets, Users, OTP Logs)
 */

const SUPABASE_CONFIG = {
  PROJECT_ID: "mztnzrpfpszfieooeprj",
  URL: "https://mztnzrpfpszfieooeprj.supabase.co",
  // Stored in localStorage or injected via environment
  ANON_KEY: localStorage.getItem("ITV_SUPABASE_ANON_KEY") || ""
};

let supabaseClient = null;

function initSupabase() {
  if (typeof supabase !== "undefined" && SUPABASE_CONFIG.ANON_KEY) {
    try {
      supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
      console.log("✔ Supabase Client initialized for project:", SUPABASE_CONFIG.PROJECT_ID);
    } catch (e) {
      console.warn("Supabase init error:", e);
    }
  }
}

/**
 * Fetch Products from Supabase
 */
async function fetchSupabaseCatalog() {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('status', 'ACTIVE');
    
    if (error) {
      console.warn("Supabase products fetch failed:", error);
      return null;
    }

    return data.map(item => ({
      product_id: item.product_id,
      sku_code: item.sku_code,
      title: item.title,
      category: item.category,
      condition: item.condition,
      mrp_price: Number(item.mrp_price),
      selling_price: Number(item.selling_price),
      bulk_price_tier5: Number(item.bulk_price_tier5 || 0),
      bulk_price_tier10: Number(item.bulk_price_tier10 || 0),
      stock: {
        prantij: item.stock_prantij || 0,
        talod: item.stock_talod || 0,
        ranasan: item.stock_ranasan || 0,
        chiloda: item.stock_chiloda || 0,
        dhansura: item.stock_dhansura || 0,
        kheda: item.stock_kheda || 0,
        total: (item.stock_prantij || 0) + (item.stock_talod || 0) + (item.stock_ranasan || 0) +
               (item.stock_chiloda || 0) + (item.stock_dhansura || 0) + (item.stock_kheda || 0)
      },
      drive_image_id: item.drive_image_id || "",
      specs: item.specs_json || {},
      status: item.status
    }));
  } catch (err) {
    console.warn("Supabase catalog exception:", err);
    return null;
  }
}

/**
 * Insert Order into Supabase
 */
async function insertSupabaseOrder(orderPayload) {
  if (!supabaseClient) return null;
  try {
    const orderId = "ITV-ORD-" + Date.now();
    const { data, error } = await supabaseClient
      .from('orders')
      .insert([{
        order_id: orderId,
        customer_name: orderPayload.customerName,
        customer_phone: orderPayload.customerPhone,
        customer_email: orderPayload.customerEmail,
        fulfillment_branch: orderPayload.fulfillmentBranch,
        order_items_json: orderPayload.items,
        total_amount: orderPayload.totalAmount,
        payment_method: 'UPI_QR',
        payment_status: 'PENDING_UTR_VERIFICATION',
        utr_number: orderPayload.utrNumber,
        pdf_drive_link: orderPayload.invoiceUrl || ''
      }])
      .select();

    if (error) {
      console.warn("Supabase order insert failed:", error);
      return null;
    }
    return { success: true, orderId: orderId, data: data };
  } catch (err) {
    console.warn("Supabase order exception:", err);
    return null;
  }
}

/**
 * Insert Service Ticket into Supabase
 */
async function insertSupabaseTicket(ticketData) {
  if (!supabaseClient) return null;
  try {
    const seq = ("0000" + Math.floor(Math.random() * 9000 + 1000)).slice(-4);
    const ticketId = "ITV-SRV-2026-" + seq;
    const initialLog = [{
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      note: `Ticket created online. Drop-off selected at ${ticketData.branchLocation || 'Prantij (HO)'}`
    }];

    const { data, error } = await supabaseClient
      .from('service_tickets')
      .insert([{
        ticket_id: ticketId,
        customer_name: ticketData.customerName,
        customer_phone: ticketData.customerPhone,
        device_category: ticketData.deviceCategory,
        device_serial: ticketData.deviceSerial || 'N/A',
        reported_fault: ticketData.reportedFault,
        branch_location: ticketData.branchLocation || 'Prantij (HO)',
        current_status: 'RECEIVED',
        est_cost: ticketData.estCost || 0.00,
        tech_notes_log: initialLog
      }])
      .select();

    if (error) {
      console.warn("Supabase ticket insert failed:", error);
      return null;
    }
    return { success: true, ticketId: ticketId, data: data };
  } catch (err) {
    console.warn("Supabase ticket exception:", err);
    return null;
  }
}

/**
 * Fetch Ticket by Ticket ID or Phone
 */
async function fetchSupabaseTicket(query) {
  if (!supabaseClient) return null;
  try {
    const clean = query.trim();
    let q = supabaseClient.from('service_tickets').select('*');
    if (clean.toUpperCase().startsWith("ITV-SRV-")) {
      q = q.eq('ticket_id', clean.toUpperCase());
    } else {
      q = q.eq('customer_phone', clean);
    }

    const { data, error } = await q.order('created_at', { ascending: false }).limit(1);
    if (error || !data || data.length === 0) return null;

    const row = data[0];
    return {
      ticketId: row.ticket_id,
      createdDate: row.created_at,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      deviceCategory: row.device_category,
      deviceSerial: row.device_serial,
      reportedFault: row.reported_fault,
      branchLocation: row.branch_location,
      currentStatus: row.current_status,
      estCost: Number(row.est_cost || 0),
      notesLog: row.tech_notes_log || []
    };
  } catch (err) {
    console.warn("Supabase ticket lookup error:", err);
    return null;
  }
}
