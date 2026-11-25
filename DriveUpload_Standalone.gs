/**
 * IT VISION COMPUTER SALES, SERVICE & ACCESSORIES
 * Google Drive Media Upload Engine (Standalone Google Apps Script)
 * 
 * Target Google Drive Folder ID: 1E2MflyKllRq2a5kiZmFargIe5PvA8_X6
 * Web App Endpoint: https://script.google.com/macros/s/AKfycbwa3D0RyEZl50W6IDGijCKcaL7qbSBm9q4W05yy4l7G5LRIZ9fQvww6j-PVkGoQ7ID53g/exec
 * 
 * Instructions to Deploy (REQUIRED ONCE):
 * 1. Open your Apps Script project at https://script.google.com
 * 2. Replace the contents of Code.gs with this entire file and click Save (Ctrl+S)
 * 3. Run "testDriveAuthorization" once in the editor to grant Google Drive permissions
 * 4. Click "Deploy" -> "Manage deployments"
 * 5. Click the Pencil (Edit) icon next to your active Web App deployment
 * 6. Under "Version", select "New version" (VERY IMPORTANT - otherwise old code stays active)
 * 7. Make sure "Execute as: Me" and "Who has access: Anyone" are selected
 * 8. Click "Deploy"
 */

// Target Google Drive Folder ID for all IT Vision media uploads (Photos, Videos, Audios)
var TARGET_FOLDER_ID = "1E2MflyKllRq2a5kiZmFargIe5PvA8_X6";

/**
 * Run this once inside the Apps Script editor to authorize Google Drive access.
 */
function testDriveAuthorization() {
  var folder = DriveApp.getFolderById(TARGET_FOLDER_ID);
  Logger.log("Authorized access to Google Drive folder: " + folder.getName());
  return folder.getName();
}

/**
 * HTTP GET: Serves the Web App UI or JSON health info
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === "ping") {
    return ContentService.createTextOutput(JSON.stringify({
      status: "ok",
      success: true,
      service: "IT Vision Google Drive Media Engine",
      targetFolderId: TARGET_FOLDER_ID,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('IT Vision - Google Drive Media Engine')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "active",
      service: "IT Vision Media Engine",
      targetFolderId: TARGET_FOLDER_ID,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * HTTP POST: Handles media uploads (Photos, Videos, Audios) from web app / REST client
 */
function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    if (payload.action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "ok",
        success: true,
        doPostReady: true,
        targetFolderId: TARGET_FOLDER_ID,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var base64Data = payload.base64 || payload.data || payload.file;
    if (!base64Data) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        success: false,
        message: "Missing base64 data in payload."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var fileName = payload.filename || ("itv_media_" + Date.now());
    var mimeType = payload.mimeType || "";
    var uploadResult = uploadPhoto(base64Data, fileName, mimeType);

    return ContentService.createTextOutput(JSON.stringify(uploadResult))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Infer MIME type from file extension when not explicitly supplied.
 */
function inferMimeTypeFromName(fileName) {
  var lower = (fileName || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "image/jpeg";
}

/**
 * Core Media Upload function
 * Supports RPC calls from google.script.run.uploadPhoto(base64Data, fileName)
 * and HTTP POST calls from doPost(e).
 *
 * @param {string} base64Data - Full data URL or raw Base64 string
 * @param {string} fileName - File name with extension
 * @param {string} [explicitMimeType] - Optional MIME type
 * @returns {Object} JSON response with Drive URLs
 */
function uploadPhoto(base64Data, fileName, explicitMimeType) {
  try {
    var folder = DriveApp.getFolderById(TARGET_FOLDER_ID);

    var contentType = explicitMimeType || inferMimeTypeFromName(fileName);
    if (base64Data.indexOf('data:') === 0 && base64Data.indexOf(';') !== -1) {
      contentType = base64Data.substring(5, base64Data.indexOf(';'));
    }

    var rawBase64 = base64Data;
    if (rawBase64.indexOf('base64,') !== -1) {
      rawBase64 = rawBase64.split('base64,')[1];
    }

    var bytes = Utilities.base64Decode(rawBase64);
    var blob = Utilities.newBlob(bytes, contentType, fileName || ("itv_media_" + Date.now()));

    // Create file in the specified Google Drive target folder
    var file = folder.createFile(blob);

    // Set public view permissions so products/media display in the web app
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (permErr) {
      Logger.log("Sharing permission warning: " + permErr.toString());
    }

    var fileId = file.getId();
    var directUrl = contentType.indexOf("image/") === 0
      ? ("https://lh3.googleusercontent.com/d/" + fileId + "=w800-rw")
      : ("https://drive.google.com/uc?export=download&id=" + fileId);

    return {
      status: "success",
      success: true,
      fileId: fileId,
      filename: fileName,
      mimeType: contentType,
      url: file.getUrl(),
      fileUrl: file.getUrl(),
      directUrl: directUrl,
      previewUrl: "https://drive.google.com/file/d/" + fileId + "/preview",
      downloadUrl: file.getDownloadUrl(),
      message: "File uploaded successfully to Google Drive folder " + TARGET_FOLDER_ID
    };

  } catch (error) {
    return {
      status: "error",
      success: false,
      message: error.toString()
    };
  }
}
