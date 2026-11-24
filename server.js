const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwa3D0RyEZl50W6IDGijCKcaL7qbSBm9q4W05yy4l7G5LRIZ9fQvww6j-PVkGoQ7ID53g/exec";

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
          // Follow HTTP redirects (301, 302, 303, 307)
          if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
            return sendRequest(res.headers.location, 'GET', null);
          }

          let responseBody = '';
          res.on('data', chunk => { responseBody += chunk; });
          res.on('end', () => {
            // Check if response is JSON
            try {
              const parsedJson = JSON.parse(responseBody);
              resolve({ statusCode: res.statusCode, data: parsedJson });
            } catch (err) {
              resolve({ statusCode: res.statusCode, rawBody: responseBody });
            }
          });
        });

        req.on('error', (err) => {
          reject(err);
        });

        if (data) {
          req.write(data);
        }
        req.end();
      } catch (err) {
        reject(err);
      }
    }

    sendRequest(GOOGLE_SCRIPT_URL, 'POST', postData);
  });
}

/**
 * Save file locally as a reliable fallback
 */
function saveFileLocally(filename, base64Content) {
  const safeName = Date.now() + '_' + filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetPath = path.join(UPLOADS_DIR, safeName);
  const fileBuffer = Buffer.from(base64Content, 'base64');
  fs.writeFileSync(targetPath, fileBuffer);
  return safeName;
}

const server = http.createServer(async (req, res) => {
  // Common CORS headers
  const setCors = () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  };

  if (req.method === 'OPTIONS') {
    setCors();
    res.writeHead(204);
    res.end();
    return;
  }

  // API Proxy Route for Media Uploads
  if (req.url === '/api/upload-media' && req.method === 'POST') {
    setCors();
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Protection against absurdly huge uploads (> 50MB)
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        let base64 = payload.base64 || '';
        if (base64.indexOf('base64,') !== -1) {
          base64 = base64.split('base64,')[1];
        }

        const filename = payload.filename || ('media_' + Date.now() + '.jpg');
        const mimeType = payload.mimeType || 'application/octet-stream';

        // 1. Try forwarding to Google Apps Script
        let gasSuccess = false;
        let gasResult = null;

        try {
          const gasRes = await forwardToGoogleAppsScript({
            filename: filename,
            mimeType: mimeType,
            base64: base64
          });

          if (gasRes && gasRes.data && (gasRes.data.success || gasRes.data.status === 'success' || gasRes.data.fileUrl || gasRes.data.directUrl)) {
            gasSuccess = true;
            gasResult = gasRes.data;
          } else {
            console.warn('[Upload Proxy] Google Apps Script response:', gasRes.data || (gasRes.rawBody ? gasRes.rawBody.slice(0, 200) : 'No response'));
          }
        } catch (gasErr) {
          console.warn('[Upload Proxy] Google Apps Script connection error:', gasErr.message);
        }

        // If Google Apps Script returned a valid file URL
        if (gasSuccess && gasResult) {
          const fileId = gasResult.fileId || '';
          const directUrl = gasResult.directUrl || (fileId ? `https://lh3.googleusercontent.com/d/${fileId}=w800-rw` : gasResult.url || gasResult.fileUrl);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'success',
            success: true,
            source: 'google_drive',
            fileId: fileId,
            filename: filename,
            fileUrl: gasResult.fileUrl || gasResult.url || directUrl,
            directUrl: directUrl,
            message: 'Uploaded directly to Google Drive folder 1E2MflyKllRq2a5kiZmFargIe5PvA8_X6'
          }));
          return;
        }

        // 2. Fallback: Save file locally on server
        console.log(`[Upload Proxy] Saving ${filename} locally to /uploads/...`);
        const savedName = saveFileLocally(filename, base64);
        const localUrl = `http://localhost:${PORT}/uploads/${savedName}`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          success: true,
          source: 'local_storage',
          filename: savedName,
          fileUrl: localUrl,
          directUrl: localUrl,
          warning: 'Saved locally on server. To store in Google Drive, deploy the updated Code.gs in Google Apps Script.',
          instructions: 'Deploy Code.gs in script.google.com as New Version.'
        }));

      } catch (err) {
        console.error('[Upload Proxy] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'error',
          success: false,
          error: err.message
        }));
      }
    });
    return;
  }

  // Static File Serving
  let parsedUrl = req.url.split('?')[0];
  if (parsedUrl === '/' || parsedUrl === '') {
    parsedUrl = '/Index.html';
  }

  let filePath = path.join(BASE_DIR, decodeURIComponent(parsedUrl));

  // Security check: stay within BASE_DIR
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      // If file not found, fallback to Index.html for SPA routing
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

      setCors();
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`IT Vision Local Development Server running at http://localhost:${PORT}/`);
  console.log(`Storefront: http://localhost:${PORT}/Index.html#home`);
  console.log(`Admin Portal: http://localhost:${PORT}/Index.html#admin`);
  console.log(`Media Upload API: http://localhost:${PORT}/api/upload-media`);
});
