/**
 * IT VISION COMPUTER SALES, SERVICE & ACCESSORIES
 * Google Drive Media Upload Engine (Standalone Google Apps Script)
 * 
 * Target Google Drive Folder ID: 1E2MflyKllRq2a5kiZmFargIe5PvA8_X6
 * Web App Endpoint: https://script.google.com/macros/s/AKfycbwa3D0RyEZl50W6IDGijCKcaL7qbSBm9q4W05yy4l7G5LRIZ9fQvww6j-PVkGoQ7ID53g/exec
 * 
 * Instructions to Deploy:
 * 1. Open your Apps Script project at script.google.com
 * 2. Paste this entire code into your Code.gs
 * 3. Click "Deploy" -> "Manage Deployments"
 * 4. Click the Pencil (Edit) icon next to your active deployment
 * 5. Under "Version", select "New Version"
 * 6. Make sure "Who has access" is set to "Anyone"
 * 7. Click "Deploy"
 */

// Target Google Drive Folder ID for all IT Vision media uploads
var TARGET_FOLDER_ID = "1E2MflyKllRq2a5kiZmFargIe5PvA8_X6";

/**
 * HTTP GET: Serves the Web App UI or status check
 */
function doGet(e) {
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

    var base64Data = payload.base64 || payload.data || payload.file;
    if (!base64Data) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        success: false,
        message: "Missing base64 data in payload."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var fileName = payload.filename || ("itv_media_" + Date.now());
    var uploadResult = uploadPhoto(base64Data, fileName);

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
 * Core Media Upload function
 * Supports RPC calls from google.script.run.uploadPhoto(base64Data, fileName)
 * and internal calls from doPost
 * 
 * @param {string} base64Data - Full data URL or raw Base64 string
 * @param {string} fileName - File name with extension
 * @returns {Object} JSON response with URLs
 */
function uploadPhoto(base64Data, fileName) {
  try {
    var folder = DriveApp.getFolderById(TARGET_FOLDER_ID);

    // Extract content-type if present in data URL
    var contentType = "image/jpeg";
    if (base64Data.indexOf('data:') === 0 && base64Data.indexOf(';') !== -1) {
      contentType = base64Data.substring(5, base64Data.indexOf(';'));
    }

    // Strip data URL scheme prefix
    var rawBase64 = base64Data;
    if (rawBase64.indexOf('base64,') !== -1) {
      rawBase64 = rawBase64.split('base64,')[1];
    }

    var bytes = Utilities.base64Decode(rawBase64);
    var blob = Utilities.newBlob(bytes, contentType, fileName);

    // Create file in the specified Google Drive target folder
    var file = folder.createFile(blob);
    
    // Set public view permissions so it displays in web app catalogs
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (permErr) {
      Logger.log("Sharing permission warning: " + permErr.toString());
    }

    var fileId = file.getId();
    var directUrl = "https://lh3.googleusercontent.com/d/" + fileId + "=w800-rw";

    return {
      status: "success",
      success: true,
      fileId: fileId,
      filename: fileName,
      mimeType: contentType,
      url: file.getUrl(),
      fileUrl: file.getUrl(),
      directUrl: directUrl,
      downloadUrl: file.getDownloadUrl(),
      message: "File uploaded successfully to Google Drive folder 1E2MflyKllRq2a5kiZmFargIe5PvA8_X6"
    };

  } catch (error) {
    return {
      status: "error",
      success: false,
      message: error.toString()
    };
  }
}
