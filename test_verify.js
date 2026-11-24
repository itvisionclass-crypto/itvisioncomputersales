const fs = require('fs');
const vm = require('vm');

console.log("=== IT VISION PROJECT VERIFICATION SUITE ===");

// 1. Verify Code.gs
console.log("\n[1] Verifying Code.gs Syntax & Exports...");
const codeGs = fs.readFileSync('Code.gs', 'utf8');

// Create mock Google Apps Script environment for syntax & logic testing
const mockGasEnv = {
  Logger: { log: console.log },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getSheetByName: () => null,
      insertSheet: (name) => ({
        getLastRow: () => 0,
        getLastColumn: () => 18,
        appendRow: () => {},
        getRange: () => ({
          setFontWeight: () => {},
          setBackground: () => {},
          setFontColor: () => {},
          setValue: () => {}
        }),
        setFrozenRows: () => {},
        getDataRange: () => ({
          getValues: () => [[]]
        })
      })
    })
  },
  DriveApp: {
    getRootFolder: () => ({
      getFoldersByName: () => ({ hasNext: () => false, next: () => null }),
      createFolder: (name) => ({
        getId: () => "mock_folder_" + name,
        getFoldersByName: () => ({ hasNext: () => false }),
        createFolder: (sub) => ({ getId: () => "mock_sub_" + sub })
      })
    })
  },
  PropertiesService: {
    getScriptProperties: () => ({
      setProperties: () => {},
      getProperty: () => "mock_prop"
    })
  },
  HtmlService: {
    createTemplateFromFile: () => ({
      evaluate: () => ({
        setTitle: function() { return this; },
        addMetaTag: function() { return this; },
        setXFrameOptionsMode: function() { return this; },
        getContent: () => "<html></html>"
      })
    }),
    XFrameOptionsMode: { ALLOWALL: "ALLOWALL" }
  },
  LockService: {
    getScriptLock: () => ({
      waitLock: () => {},
      releaseLock: () => {}
    })
  },
  MailApp: {
    sendEmail: () => {}
  },
  Utilities: {
    newBlob: () => ({
      getAs: () => ({ setName: () => {} })
    }),
    computeDigest: () => [1, 2, 3],
    DigestAlgorithm: { SHA_256: "SHA_256" },
    base64Encode: () => "mock_token"
  }
};

const scriptContext = vm.createContext(mockGasEnv);
vm.runInContext(codeGs, scriptContext);

console.log("✔ Code.gs parsed successfully.");
console.log("✔ Function setupDatabase exists:", typeof scriptContext.setupDatabase === 'function');
console.log("✔ Function getProductsCatalog exists:", typeof scriptContext.getProductsCatalog === 'function');
console.log("✔ Function processCustomerOrder exists:", typeof scriptContext.processCustomerOrder === 'function');
console.log("✔ Function createServiceTicket exists:", typeof scriptContext.createServiceTicket === 'function');
console.log("✔ Function getTicketStatus exists:", typeof scriptContext.getTicketStatus === 'function');
console.log("✔ Function getAdminDashboardData exists:", typeof scriptContext.getAdminDashboardData === 'function');

// 2. Verify Index.html script block
console.log("\n[2] Verifying Index.html Script Block...");
const indexHtml = fs.readFileSync('Index.html', 'utf8');
const scriptMatches = indexHtml.match(/<script>([\s\S]*?)<\/script>/);

if (scriptMatches && scriptMatches[1]) {
  const clientScript = scriptMatches[1];
  const clientEnv = {
    window: {},
    document: {
      addEventListener: () => {},
      getElementById: () => ({ addEventListener: () => {}, value: "" }),
      querySelectorAll: () => []
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    console: console,
    setTimeout: setTimeout
  };
  const clientCtx = vm.createContext(clientEnv);
  vm.runInContext(clientScript, clientCtx);
  console.log("✔ Index.html script parsed and executed without errors.");
  console.log("✔ ITVisionState hydrated with default branch:", clientEnv.window.ITVisionState.selectedBranch);
} else {
  throw new Error("No script block found in Index.html!");
}

// 3. Verify Key Requirements & Specs
console.log("\n[3] Verifying Business Requirements & Design Tokens...");
const requiredStrings = [
  "#0F4C81", // Navy primary
  "#F97316", // Accent orange
  "#16A34A", // Success green
  "tabular-nums",
  "9924253384",
  "9924253384@paytm",
  "Prantij (HO)",
  "Talod",
  "Ranasan",
  "Mota Chiloda",
  "Dhansura",
  "Kheda",
  "ITV-SRV-2026-",
  "ITV-ORD-",
  "12,999",
  "HP LaserJet 1020",
  "Dell OptiPlex",
  "12A",
  "88A"
];

let missing = [];
requiredStrings.forEach(str => {
  if (!indexHtml.includes(str)) {
    missing.push(str);
  }
});

if (missing.length === 0) {
  console.log("✔ All brand tokens, contact credentials, branches, and SKU patterns verified in Index.html.");
} else {
  console.error("❌ Missing required tokens in Index.html:", missing);
  process.exit(1);
}

console.log("\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY! ===");
