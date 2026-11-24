/**
 * IT VISION COMPUTER SALES, SERVICE & ACCESSORIES
 * Serverless Backend Engine (Google Apps Script)
 * 
 * Branches: Prantij (Head Office), Talod, Ranasan, Mota Chiloda, Dhansura, Kheda
 * Support & WhatsApp: +91 9924253384 | UPI: 9924253384@paytm
 */

// Database Sheet Configuration
var SHEET_NAMES = {
  PRODUCTS: "Products_DB",
  ORDERS: "Orders_DB",
  SERVICE_TICKETS: "Service_Tickets_DB",
  USERS: "Users_DB",
  OTP_LOGS: "OTP_Logs"
};

var FOLDERS = {
  ROOT: "IT_Vision_Assets",
  IMAGES: "Product_Images",
  INVOICES: "Invoices_PDF",
  TARGET_MEDIA_FOLDER_ID: "1E2MflyKllRq2a5kiZmFargIe5PvA8_X6"
};

var BRANCHES = [
  "Prantij (HO)",
  "Talod",
  "Ranasan",
  "Mota Chiloda",
  "Dhansura",
  "Kheda"
];

/**
 * HTTP GET Entry Point for Web App
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile("Index");
  var output = template.evaluate()
    .setTitle("IT Vision Computer Sales, Service & Accessories")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
    .addMetaTag("description", "High-performance B2B/B2C computer hardware, refurbished systems, laser printers & repairs across 6 regional branches.")
    .addMetaTag("theme-color", "#0F4C81")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
}

/**
 * HTTP POST Entry Point for Media Uploads (Photos, Videos, Audios)
 * Direct upload engine saving files to Google Drive
 */
function doPost(e) {
  try {
    var payload;
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter;
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    } else {
      payload = {};
    }

    var base64Data = payload.base64 || payload.data || payload.file;
    if (!base64Data) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing base64 file data in payload."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Strip data URL scheme prefix if present
    if (base64Data.indexOf("base64,") !== -1) {
      base64Data = base64Data.split("base64,")[1];
    }

    var filename = payload.filename || ("itv_media_" + Date.now());
    var mimeType = payload.mimeType || "application/octet-stream";

    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, mimeType, filename);

    // Save to specified Google Drive Target Folder
    var targetFolder;
    try {
      targetFolder = DriveApp.getFolderById(FOLDERS.TARGET_MEDIA_FOLDER_ID);
    } catch (fErr) {
      var rootFolder = DriveApp.getRootFolder();
      var appFolder = getOrCreateFolder(rootFolder, FOLDERS.ROOT);
      targetFolder = getOrCreateFolder(appFolder, FOLDERS.IMAGES);
    }

    var file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = file.getId();
    var directUrl = "https://lh3.googleusercontent.com/d/" + fileId + "=w800-rw";

    var output = {
      status: "success",
      success: true,
      fileId: fileId,
      filename: filename,
      mimeType: mimeType,
      url: file.getUrl(),
      fileUrl: file.getUrl(),
      directUrl: directUrl,
      downloadUrl: file.getDownloadUrl(),
      message: "Media file uploaded successfully to Google Drive."
    };

    return ContentService.createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      success: false,
      error: "Upload handler error: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Mobile Camera & Media Direct RPC Upload Engine
 * Target Folder ID: 1E2MflyKllRq2a5kiZmFargIe5PvA8_X6
 */
function uploadPhoto(base64Data, fileName) {
  try {
    var folderId = FOLDERS.TARGET_MEDIA_FOLDER_ID;
    var folder = DriveApp.getFolderById(folderId);

    // Convert Base64 data to blob
    var contentType = "image/jpeg";
    if (base64Data.indexOf(';') !== -1 && base64Data.indexOf(':') !== -1) {
      contentType = base64Data.substring(5, base64Data.indexOf(';'));
    }

    var rawBase64 = base64Data;
    if (base64Data.indexOf(',') !== -1) {
      rawBase64 = base64Data.split(',')[1];
    }

    var bytes = Utilities.base64Decode(rawBase64);
    var blob = Utilities.newBlob(bytes, contentType, fileName || ("media_" + Date.now() + ".jpg"));

    // Save file in Google Drive
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = file.getId();
    var directUrl = "https://lh3.googleusercontent.com/d/" + fileId + "=w800-rw";

    return {
      status: "success",
      success: true,
      url: file.getUrl(),
      fileUrl: file.getUrl(),
      directUrl: directUrl,
      fileId: fileId
    };
  } catch (error) {
    return {
      status: "error",
      success: false,
      message: error.toString()
    };
  }
}

/**
 * File inclusion helper for modular templates
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Phase 1: Database Initialization Routine
 * Creates all 5 sheets with relational schema headers and Drive folders.
 */
function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Products_DB
  var prodSheet = getOrCreateSheet(ss, SHEET_NAMES.PRODUCTS);
  if (prodSheet.getLastRow() === 0) {
    prodSheet.appendRow([
      "product_id", "sku_code", "title", "category", "condition",
      "mrp_price", "selling_price", "bulk_price_tier5", "bulk_price_tier10",
      "stock_prantij", "stock_talod", "stock_ranasan", "stock_chiloda", "stock_dhansura", "stock_kheda",
      "drive_image_id", "specs_json", "status"
    ]);
    formatHeaderRow(prodSheet);
  }

  // 2. Orders_DB
  var orderSheet = getOrCreateSheet(ss, SHEET_NAMES.ORDERS);
  if (orderSheet.getLastRow() === 0) {
    orderSheet.appendRow([
      "order_id", "timestamp", "customer_name", "customer_phone", "fulfillment_branch",
      "order_items_json", "total_amount", "payment_status", "utr_number", "pdf_drive_link"
    ]);
    formatHeaderRow(orderSheet);
  }

  // 3. Service_Tickets_DB
  var ticketSheet = getOrCreateSheet(ss, SHEET_NAMES.SERVICE_TICKETS);
  if (ticketSheet.getLastRow() === 0) {
    ticketSheet.appendRow([
      "ticket_id", "created_date", "customer_name", "customer_phone", "device_category",
      "device_serial", "reported_fault", "branch_location", "current_status", "est_cost", "tech_notes_log"
    ]);
    formatHeaderRow(ticketSheet);
  }

  // 4. Users_DB
  var userSheet = getOrCreateSheet(ss, SHEET_NAMES.USERS);
  if (userSheet.getLastRow() === 0) {
    userSheet.appendRow([
      "user_id", "name", "email", "phone", "address", "branch_preference", "created_at"
    ]);
    formatHeaderRow(userSheet);
  }

  // 5. OTP_Logs
  var otpSheet = getOrCreateSheet(ss, SHEET_NAMES.OTP_LOGS);
  if (otpSheet.getLastRow() === 0) {
    otpSheet.appendRow([
      "phone_email", "otp_code", "expiry_time", "verification"
    ]);
    formatHeaderRow(otpSheet);
  }

  // Initialize Drive Assets Folders
  var rootFolder = DriveApp.getRootFolder();
  var appFolder = getOrCreateFolder(rootFolder, FOLDERS.ROOT);
  var imgFolder = getOrCreateFolder(appFolder, FOLDERS.IMAGES);
  var invFolder = getOrCreateFolder(appFolder, FOLDERS.INVOICES);

  // Store Folder IDs in Properties
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    "FOLDER_ROOT_ID": appFolder.getId(),
    "FOLDER_IMAGES_ID": imgFolder.getId(),
    "FOLDER_INVOICES_ID": invFolder.getId()
  });

  Logger.log("IT Vision Database & Drive Folders configured successfully.");
  return { success: true, message: "Database and Drive storage initialized." };
}

/**
 * Seed initial catalog inventory with real IT Vision hardware
 */
function seedProductionData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var prodSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
  if (!prodSheet) {
    setupDatabase();
    prodSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
  }
  
  if (prodSheet.getLastRow() > 1) {
    return { success: false, message: "Products_DB already contains data." };
  }

  var seeds = [
    [
      "ITV-CMB-001", "ITV-COMBO-8IN1", "₹12,999 8-Item Complete Desktop + Printer Package", "Combo", "Certified Refurbished",
      35000, 12999, 12200, 11500,
      12, 4, 3, 5, 2, 4,
      "1sampleDriveImgIdCombo",
      JSON.stringify({ "CPU": "Intel Core i5 6th Gen", "RAM": "8GB DDR4", "Storage": "256GB SSD", "Display": "19\" LED Monitor", "Printer": "HP LaserJet 1020 Refurbished", "Accessories": "Keyboard, Optical Mouse, Wi-Fi Dongle, Stereo Speakers", "Warranty": "1 Year Store Warranty" }),
      "ACTIVE"
    ],
    [
      "ITV-DSK-002", "DELL-OPT-7040", "Dell OptiPlex 7040 SFF Business Desktop", "Desktop", "Certified Refurbished",
      32000, 11999, 11400, 10800,
      15, 6, 4, 8, 3, 5,
      "1sampleDriveImgIdDellSff",
      JSON.stringify({ "CPU": "Intel Core i5 6500 3.2GHz", "RAM": "8GB DDR4", "Storage": "256GB NVMe SSD", "Graphics": "Intel HD 530", "OS": "Windows 11 Pro Genuine", "Warranty": "1 Year Replacement Warranty" }),
      "ACTIVE"
    ],
    [
      "ITV-LAP-003", "LEN-TP-T480", "Lenovo ThinkPad T480 Ultrabook (Quad Core i5)", "Laptop", "Certified Refurbished",
      45000, 19499, 18500, 17800,
      8, 3, 2, 4, 1, 3,
      "1sampleDriveImgIdThinkpad",
      JSON.stringify({ "CPU": "Intel Core i5 8th Gen Quad-Core", "RAM": "16GB DDR4", "Storage": "512GB SSD", "Display": "14\" FHD IPS Anti-Glare", "Battery": "Dual Battery (4+ Hours)", "Warranty": "6 Months Store Warranty" }),
      "ACTIVE"
    ],
    [
      "ITV-PRN-004", "HP-LJP-1020P", "HP LaserJet 1020 Plus Monochrome Printer (Legendary Workhorse)", "Printer", "Certified Refurbished",
      11500, 9499, 9100, 8800,
      10, 4, 2, 5, 1, 3,
      "1sampleDriveImgIdHP1020",
      JSON.stringify({ "Speed": "14 ppm", "Cartridge": "HP 12A / Q2612A", "Connectivity": "USB 2.0 High Speed", "Refill Cost": "₹250 only", "Warranty": "6 Months Comprehensive" }),
      "ACTIVE"
    ],
    [
      "ITV-PRN-005", "HP-M1005-MFP", "HP LaserJet M1005 Monochrome Multi-Function Printer", "Printer", "Certified Refurbished",
      24000, 14999, 14200, 13700,
      6, 2, 1, 3, 1, 2,
      "1sampleDriveImgIdHPM1005",
      JSON.stringify({ "Functions": "Print, Scan, Copy", "Speed": "15 ppm", "Cartridge": "HP 12A", "Optical Resolution": "Up to 1200 dpi", "Warranty": "6 Months Comprehensive" }),
      "ACTIVE"
    ],
    [
      "ITV-TON-006", "ITV-CART-12A", "Compatible 12A (Q2612A) Premium Toner Cartridge", "Cartridge", "Brand New",
      1200, 450, 410, 370,
      60, 25, 20, 30, 15, 20,
      "1sampleDriveImgId12A",
      JSON.stringify({ "Page Yield": "2000 Pages @ 5% Coverage", "Compatibility": "HP LaserJet 1020, 1005, 1010, 1018, 3050, Canon 2900B", "Warranty": "Testing Guarantee / 100% Dark Print" }),
      "ACTIVE"
    ],
    [
      "ITV-TON-007", "ITV-CART-88A", "Compatible 88A (CC388A) High-Density Toner Cartridge", "Cartridge", "Brand New",
      1350, 499, 450, 410,
      45, 18, 15, 20, 10, 15,
      "1sampleDriveImgId88A",
      JSON.stringify({ "Page Yield": "1800 Pages", "Compatibility": "HP LaserJet P1007, P1108, M1136 MFP, M126nw", "Warranty": "100% Dark Print Replacement Guarantee" }),
      "ACTIVE"
    ],
    [
      "ITV-SEC-008", "CP-CCTV-4CAM", "CP PLUS 4-Channel Full HD Night Vision CCTV Security Kit", "Security", "Brand New",
      16500, 8999, 8500, 8000,
      8, 3, 2, 4, 2, 3,
      "1sampleDriveImgIdCCTV",
      JSON.stringify({ "Contents": "4-Channel HD DVR + 4 HD Cameras (2 Bullet, 2 Dome) + 500GB HDD + 4CH SMPS + Cable", "Mobile View": "CP PLUS Mobile App remote viewing", "Warranty": "2 Years Manufacturer Warranty" }),
      "ACTIVE"
    ],
    [
      "ITV-ACC-009", "ITV-KB-MS-CMB", "Pro-Grade USB Keyboard and Optical Mouse Combo", "Accessories", "Brand New",
      850, 420, 380, 340,
      50, 20, 15, 25, 10, 15,
      "1sampleDriveImgIdKbMs",
      JSON.stringify({ "Interface": "USB Plug & Play", "Keys": "104-Key Standard English QWERTY", "DPI": "1200 DPI Optical", "Warranty": "1 Year Replacement" }),
      "ACTIVE"
    ],
    [
      "ITV-ACC-010", "LB-WIFI-300M", "300Mbps High Gain Wi-Fi USB Adapter with Antenna", "Accessories", "Brand New",
      650, 280, 250, 220,
      40, 15, 12, 20, 10, 12,
      "1sampleDriveImgIdWifi",
      JSON.stringify({ "Speed": "Up to 300Mbps", "Antenna": "5dBi Detachable Omni-directional", "Compatibility": "Windows 11 / 10 / 7 / Linux" }),
      "ACTIVE"
    ]
  ];

  for (var i = 0; i < seeds.length; i++) {
    prodSheet.appendRow(seeds[i]);
  }

  return { success: true, count: seeds.length };
}

/**
 * Phase 2: Client Products Catalog API
 * Returns compressed JSON of all active items with multi-branch stock
 */
function getProductsCatalog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
  if (!sheet) {
    setupDatabase();
    seedProductionData();
    sheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    seedProductionData();
    data = sheet.getDataRange().getValues();
  }

  var headers = data[0];
  var catalog = [];

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var status = row[17];
    if (status !== "ACTIVE") continue;

    var specs = {};
    try {
      specs = JSON.parse(row[16]);
    } catch (e) {
      specs = { note: row[16] };
    }

    var totalStock = Number(row[9] || 0) + Number(row[10] || 0) + Number(row[11] || 0) +
                     Number(row[12] || 0) + Number(row[13] || 0) + Number(row[14] || 0);

    catalog.push({
      product_id: String(row[0]),
      sku_code: String(row[1]),
      title: String(row[2]),
      category: String(row[3]),
      condition: String(row[4]),
      mrp_price: Number(row[5]),
      selling_price: Number(row[6]),
      bulk_price_tier5: Number(row[7]),
      bulk_price_tier10: Number(row[8]),
      stock: {
        prantij: Number(row[9] || 0),
        talod: Number(row[10] || 0),
        ranasan: Number(row[11] || 0),
        chiloda: Number(row[12] || 0),
        dhansura: Number(row[13] || 0),
        kheda: Number(row[14] || 0),
        total: totalStock
      },
      drive_image_id: String(row[15] || ""),
      specs: specs,
      status: status
    });
  }

  return { success: true, catalog: catalog, timestamp: new Date().toISOString() };
}

/**
 * Phase 2: Race-Condition Controlled Order Processing Engine
 */
function processCustomerOrder(orderPayload) {
  var lock = LockService.getScriptLock();
  try {
    // Wait up to 10 seconds for concurrent operations to clear
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: "System is busy with simultaneous checkouts. Please retry in a moment." };
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var prodSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    var orderSheet = ss.getSheetByName(SHEET_NAMES.ORDERS);

    if (!orderPayload || !orderPayload.items || orderPayload.items.length === 0) {
      return { success: false, message: "Cart is empty." };
    }

    // Branch column index mapping
    var branchColIndex = getBranchStockColumn(orderPayload.fulfillmentBranch);

    // Verify & Deduct Stock
    var prodData = prodSheet.getDataRange().getValues();
    var items = orderPayload.items;

    for (var i = 0; i < items.length; i++) {
      var itm = items[i];
      var foundRow = -1;
      for (var r = 1; r < prodData.length; r++) {
        if (prodData[r][0] === itm.productId) {
          foundRow = r + 1; // 1-based index
          var curStock = Number(prodData[r][branchColIndex]);
          if (curStock < itm.qty) {
            return {
              success: false,
              message: "Item '" + prodData[r][2] + "' only has " + curStock + " unit(s) available in " + (orderPayload.fulfillmentBranch || "selected branch") + "."
            };
          }
          break;
        }
      }
      if (foundRow === -1) {
        return { success: false, message: "Product " + itm.productId + " not found." };
      }
    }

    // Deduct stock after all validations pass
    for (var j = 0; j < items.length; j++) {
      var itemToDeduct = items[j];
      for (var rowIdx = 1; rowIdx < prodData.length; rowIdx++) {
        if (prodData[rowIdx][0] === itemToDeduct.productId) {
          var currentVal = Number(prodData[rowIdx][branchColIndex]);
          var newVal = Math.max(0, currentVal - itemToDeduct.qty);
          prodSheet.getRange(rowIdx + 1, branchColIndex + 1).setValue(newVal);
          prodData[rowIdx][branchColIndex] = newVal;
          break;
        }
      }
    }

    // Generate Order Record
    var orderId = "ITV-ORD-" + Date.now();
    var timestamp = new Date().toISOString();
    var orderRow = [
      orderId,
      timestamp,
      orderPayload.customerName || "Customer",
      orderPayload.customerPhone || "",
      orderPayload.fulfillmentBranch || "Prantij (HO)",
      JSON.stringify(orderPayload.items),
      orderPayload.totalAmount || 0,
      "PENDING_UTR_VERIFICATION",
      orderPayload.utrNumber || "",
      "" // Invoice PDF link placeholder
    ];

    orderSheet.appendRow(orderRow);

    // Generate Invoice PDF
    var invoiceUrl = "";
    try {
      invoiceUrl = generateInvoicePDF({
        orderId: orderId,
        timestamp: timestamp,
        customerName: orderPayload.customerName,
        customerPhone: orderPayload.customerPhone,
        fulfillmentBranch: orderPayload.fulfillmentBranch,
        items: orderPayload.items,
        totalAmount: orderPayload.totalAmount,
        utrNumber: orderPayload.utrNumber
      });
      // Update invoice URL in sheet
      var lastRow = orderSheet.getLastRow();
      orderSheet.getRange(lastRow, 10).setValue(invoiceUrl);
    } catch (pdfErr) {
      Logger.log("Invoice PDF generation warning: " + pdfErr.toString());
    }

    // Send customer email receipt if email provided
    if (orderPayload.customerEmail) {
      sendOrderReceiptEmail(orderPayload.customerEmail, orderId, orderPayload.totalAmount, invoiceUrl);
    }

    return {
      success: true,
      orderId: orderId,
      invoiceUrl: invoiceUrl,
      message: "Order placed successfully. Pending UTR verification."
    };

  } catch (err) {
    return { success: false, message: "Order error: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Maps branch name to corresponding column index (0-based) in Products_DB
 */
function getBranchStockColumn(branchName) {
  var b = (branchName || "").toLowerCase();
  if (b.indexOf("talod") !== -1) return 10;
  if (b.indexOf("ranasan") !== -1) return 11;
  if (b.indexOf("chiloda") !== -1) return 12;
  if (b.indexOf("dhansura") !== -1) return 13;
  if (b.indexOf("kheda") !== -1) return 14;
  return 9; // Prantij (HO) default
}

/**
 * Phase 2: Dynamic Server-Side Invoice PDF Generation
 */
function generateInvoicePDF(orderData) {
  try {
    var template = HtmlService.createTemplateFromFile("InvoiceTemplate");
    template.order = orderData;
    var htmlContent = template.evaluate().getContent();
    var blob = Utilities.newBlob(htmlContent, "text/html", "Invoice_" + orderData.orderId + ".html").getAs("application/pdf");
    blob.setName("IT_Vision_Invoice_" + orderData.orderId + ".pdf");

    var props = PropertiesService.getScriptProperties();
    var folderId = props.getProperty("FOLDER_INVOICES_ID");
    var folder;
    if (folderId) {
      try {
        folder = DriveApp.getFolderById(folderId);
      } catch (fErr) {
        folder = DriveApp.getRootFolder();
      }
    } else {
      folder = DriveApp.getRootFolder();
    }

    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    Logger.log("generateInvoicePDF fallback: " + e.toString());
    return "";
  }
}

/**
 * Send Transactional Order Email
 */
function sendOrderReceiptEmail(email, orderId, total, invoiceUrl) {
  try {
    var subject = "IT Vision Order Confirmation - " + orderId;
    var htmlBody = "<div style='font-family:sans-serif;padding:20px;color:#0F172A;'>" +
      "<h2 style='color:#0F4C81;'>IT Vision Computer Sales & Service</h2>" +
      "<p>Dear Customer, your order <strong>" + orderId + "</strong> for ₹" + total + " has been received.</p>" +
      "<p>Payment Method: UPI QR (Pending UTR Verification).</p>" +
      (invoiceUrl ? "<p><a href='" + invoiceUrl + "' style='background:#0F4C81;color:#fff;padding:8px 16px;text-decoration:none;border-radius:4px;'>Download PDF Invoice</a></p>" : "") +
      "<hr style='border:1px solid #E2E8F0;'/>" +
      "<p style='font-size:12px;color:#64748B;'>Helpline: +91 9924253384 | Prantij Head Office & 5 Regional Branches</p>" +
      "</div>";
    
    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody
    });
  } catch (e) {
    Logger.log("Email dispatch skipped: " + e.toString());
  }
}

/**
 * Phase 2: OTP Authentication Services (5-Minute TTL)
 */
function generateAndSendOTP(identifier) {
  if (!identifier) return { success: false, message: "Phone or Email required." };

  var code = Math.floor(100000 + Math.random() * 900000).toString();
  var expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.OTP_LOGS);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(SHEET_NAMES.OTP_LOGS);
  }

  sheet.appendRow([identifier, code, expiry, "PENDING"]);

  // If identifier is email, dispatch via Gmail
  if (identifier.indexOf("@") !== -1) {
    try {
      MailApp.sendEmail({
        to: identifier,
        subject: "Your IT Vision Verification Code: " + code,
        htmlBody: "<p>Your 6-digit login OTP for IT Vision is: <strong style='font-size:20px;color:#0F4C81;'>" + code + "</strong></p><p>Valid for 5 minutes.</p>"
      });
    } catch (e) {
      Logger.log("OTP email error: " + e.toString());
    }
  }

  return { success: true, message: "OTP sent. Valid for 5 minutes.", mockCodeInDev: code };
}

function verifyOTP(identifier, code) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.OTP_LOGS);
  if (!sheet) return { success: false, message: "OTP table not found." };

  var data = sheet.getDataRange().getValues();
  var now = new Date().getTime();

  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][0]).toLowerCase() === String(identifier).toLowerCase() && String(data[r][1]) === String(code)) {
      var expiryTime = new Date(data[r][2]).getTime();
      if (now > expiryTime) {
        return { success: false, message: "OTP has expired. Please request a new one." };
      }
      if (data[r][3] === "VERIFIED") {
        return { success: false, message: "OTP already used." };
      }

      sheet.getRange(r + 1, 4).setValue("VERIFIED");
      var token = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, identifier + "_" + now));
      return { success: true, sessionToken: token, identifier: identifier };
    }
  }

  return { success: false, message: "Invalid OTP code. Please verify and try again." };
}

/**
 * Phase 2: Service & Repair Job Management Engine
 */
function createServiceTicket(ticketData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.SERVICE_TICKETS);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(SHEET_NAMES.SERVICE_TICKETS);
  }

  var count = sheet.getLastRow();
  var ticketSeq = ("0000" + count).slice(-4);
  var ticketId = "ITV-SRV-2026-" + ticketSeq;
  var timestamp = new Date().toISOString();

  var initialLog = JSON.stringify([{
    time: new Date().toLocaleTimeString(),
    date: new Date().toLocaleDateString(),
    note: "Device ticket registered online. Awaiting intake at " + (ticketData.branchLocation || "Prantij HO")
  }]);

  sheet.appendRow([
    ticketId,
    timestamp,
    ticketData.customerName || "",
    ticketData.customerPhone || "",
    ticketData.deviceCategory || "Desktop",
    ticketData.deviceSerial || "N/A",
    ticketData.reportedFault || "",
    ticketData.branchLocation || "Prantij (HO)",
    "RECEIVED",
    ticketData.estCost || 0,
    initialLog
  ]);

  return {
    success: true,
    ticketId: ticketId,
    status: "RECEIVED",
    message: "Ticket generated successfully."
  };
}

function getTicketStatus(query) {
  if (!query) return { success: false, message: "Enter Ticket ID or registered phone number." };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.SERVICE_TICKETS);
  if (!sheet) return { success: false, message: "Ticket database unavailable." };

  var data = sheet.getDataRange().getValues();
  var cleanQuery = String(query).trim().toLowerCase();

  for (var r = data.length - 1; r >= 1; r--) {
    var ticketId = String(data[r][0]).toLowerCase();
    var phone = String(data[r][3]).toLowerCase();

    if (ticketId === cleanQuery || phone.indexOf(cleanQuery) !== -1) {
      var notes = [];
      try {
        notes = JSON.parse(data[r][10]);
      } catch (e) {
        notes = [{ note: String(data[r][10]) }];
      }

      return {
        success: true,
        ticket: {
          ticketId: data[r][0],
          createdDate: data[r][1],
          customerName: data[r][2],
          customerPhone: data[r][3],
          deviceCategory: data[r][4],
          deviceSerial: data[r][5],
          reportedFault: data[r][6],
          branchLocation: data[r][7],
          currentStatus: data[r][8],
          estCost: data[r][9],
          notesLog: notes
        }
      };
    }
  }

  return { success: false, message: "No service ticket found for: " + query };
}

/**
 * Phase 2 & 8: Admin Operations Endpoints
 */
function getAdminDashboardData(pinCode) {
  // Simple administrative authorization guard
  if (pinCode !== "9924" && pinCode !== "admin2026") {
    return { success: false, message: "Unauthorized. Enter valid admin PIN." };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var orderSheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
  var ticketSheet = ss.getSheetByName(SHEET_NAMES.SERVICE_TICKETS);
  var prodSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);

  var orders = orderSheet ? orderSheet.getDataRange().getValues() : [];
  var tickets = ticketSheet ? ticketSheet.getDataRange().getValues() : [];
  var products = prodSheet ? prodSheet.getDataRange().getValues() : [];

  var todayRev = 0;
  var pendingOrders = 0;
  var recentOrdersList = [];

  for (var o = orders.length - 1; o >= 1; o--) {
    var amount = Number(orders[o][6] || 0);
    var status = orders[o][7];
    if (status === "PAID" || status === "CONFIRMED" || status === "DELIVERED") {
      todayRev += amount;
    }
    if (status === "PENDING_UTR_VERIFICATION") {
      pendingOrders++;
    }
    if (recentOrdersList.length < 15) {
      recentOrdersList.push({
        orderId: orders[o][0],
        timestamp: orders[o][1],
        customerName: orders[o][2],
        phone: orders[o][3],
        branch: orders[o][4],
        total: amount,
        status: status,
        utr: orders[o][8],
        invoiceUrl: orders[o][9]
      });
    }
  }

  var activeRepairs = 0;
  var recentTicketsList = [];
  for (var t = tickets.length - 1; t >= 1; t--) {
    var tStatus = tickets[t][8];
    if (tStatus !== "COMPLETED" && tStatus !== "DELIVERED") {
      activeRepairs++;
    }
    if (recentTicketsList.length < 15) {
      recentTicketsList.push({
        ticketId: tickets[t][0],
        customer: tickets[t][2],
        device: tickets[t][4] + " - " + tickets[t][5],
        branch: tickets[t][7],
        status: tStatus,
        estCost: tickets[t][9]
      });
    }
  }

  var lowStockItems = [];
  for (var p = 1; p < products.length; p++) {
    var totalStock = Number(products[p][9] || 0) + Number(products[p][10] || 0) + Number(products[p][11] || 0) +
                     Number(products[p][12] || 0) + Number(products[p][13] || 0) + Number(products[p][14] || 0);
    if (totalStock < 5) {
      lowStockItems.push({
        productId: products[p][0],
        title: products[p][2],
        totalStock: totalStock
      });
    }
  }

  return {
    success: true,
    kpis: {
      todayRevenue: todayRev,
      pendingOrders: pendingOrders,
      activeRepairs: activeRepairs,
      lowStockCount: lowStockItems.length
    },
    orders: recentOrdersList,
    tickets: recentTicketsList,
    lowStock: lowStockItems
  };
}

function updateOrderStatus(orderId, newStatus) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
  var data = sheet.getDataRange().getValues();

  for (var r = 1; r < data.length; r++) {
    if (data[r][0] === orderId) {
      sheet.getRange(r + 1, 8).setValue(newStatus);
      return { success: true, message: "Order " + orderId + " updated to " + newStatus };
    }
  }
  return { success: false, message: "Order not found." };
}

function updateTicketStatus(ticketId, newStatus, techNote, estCost) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.SERVICE_TICKETS);
  var data = sheet.getDataRange().getValues();

  for (var r = 1; r < data.length; r++) {
    if (data[r][0] === ticketId) {
      if (newStatus) sheet.getRange(r + 1, 9).setValue(newStatus);
      if (estCost !== undefined && estCost !== null) sheet.getRange(r + 1, 10).setValue(estCost);

      if (techNote) {
        var existingNotes = [];
        try {
          existingNotes = JSON.parse(data[r][10]);
        } catch (e) {
          existingNotes = [];
        }
        existingNotes.push({
          time: new Date().toLocaleTimeString(),
          date: new Date().toLocaleDateString(),
          note: techNote
        });
        sheet.getRange(r + 1, 11).setValue(JSON.stringify(existingNotes));
      }
      return { success: true, message: "Ticket " + ticketId + " updated." };
    }
  }
  return { success: false, message: "Ticket not found." };
}

/**
 * Helper: Sheet retrieval or creation
 */
function getOrCreateSheet(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * Helper: Drive folder retrieval or creation
 */
function getOrCreateFolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}

/**
 * Helper: Format header row
 */
function formatHeaderRow(sheet) {
  var headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#0F4C81");
  headerRange.setFontColor("#FFFFFF");
  sheet.setFrozenRows(1);
}
