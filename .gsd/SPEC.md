# System Requirements Specification (SPEC.md)

**Product Name:** IT Vision Computer Sales, Service & Accessories WebApp  
**Entity:** IT Vision Computer Sales and Service (Dwarkeshwar IT Educare)  
**Footprint:** Prantij (Head Office), Talod, Ranasan, Mota Chiloda, Dhansura, and Kheda (Gujarat)  
**Primary Contact:** +91 9924253384  
**UPI VPA:** `9924253384@paytm`  
**Status:** FINALIZED  
**Date:** 2026-11-24  

---

## 1. Executive Summary & Architecture

The application is a high-density, high-performance, mobile-first B2B/B2C digital storefront and repair job tracking web platform. It operates on a 100% zero-cost serverless architecture using:
- **Serverless Backend Engine:** Google Apps Script (`Code.gs`) deployed as a Web App (`doGet` entrypoint, asynchronous RPC execution via `google.script.run`).
- **Database Engine:** Google Sheets as a relational database with 5 structured sheets:
  1. `Products_DB`: Product catalog, pricing (B2C, B2B/bulk tiers), specifications, multi-branch stock, Drive image IDs, and status.
  2. `Orders_DB`: Sales transactions, customer details, branch selection, line items JSON, total amount, payment status, UTR reference number, and PDF invoice link.
  3. `Service_Tickets_DB`: Repair job cards, device category, serial number, reported fault, branch location, status workflow (`RECEIVED` → `DIAGNOSING` → `WAITING_FOR_PARTS` → `READY_FOR_DELIVERY` → `COMPLETED`), cost estimate, and technician notes log.
  4. `Users_DB`: Customer/staff directory, user role (`Customer`, `Branch_Admin`, `Super_Admin`), session tokens, and timestamps.
  5. `OTP_Logs`: 6-digit numeric passkeys with 5-minute TTL and verification state.
- **File Storage & Invoicing:** Google Drive API via `DriveApp` storing product assets (`Product_Images`) and compiling dynamic server-side PDF invoices/job cards (`Invoices_PDF`).
- **Media Delivery:** Google edge-cached CDN format `https://lh3.googleusercontent.com/d/{FILE_ID}=w{width}-rw`.
- **Payment & Messaging:** Client-side dynamic UPI QR code generator (`upi://pay`) with 12-digit UTR confirmation, Gmail API (`MailApp`/`GmailApp`) for transactional receipts & OTPs, and direct WhatsApp links (`https://wa.me/919924253384`).
- **Concurrency Control:** `LockService.getScriptLock()` with a 10-second timeout on checkout and stock updates to prevent race conditions.

---

## 2. Core Functional Requirements

### 2.1 E-Commerce Storefront & Discovery
- Instant client-side search (<10ms execution delay) indexing product title, category, specs, and product ID.
- Fast `sessionStorage` catalog caching to eliminate repeated Google Apps Script roundtrips.
- Category filters: Desktops, Laptops, Printers, Toners & Cartridges, Accessories, Combo Deals, CCTV & Security.
- Visual condition tagging: `BRAND NEW`, `CERTIFIED REFURBISHED`, `OPEN BOX`.
- High-density product card component with dynamic discount pill, stock indicators, bulk steppers (`+1`, `+5`, `+10`), and WhatsApp quote triggers.

### 2.2 Shopping Cart & UPI Checkout
- Slide-out drawer cart with unit controls, item removal, and subtotal calculation with GST breakdown.
- Fulfillment selector: Store Pickup (across 6 branches: Prantij HO, Talod, Ranasan, Mota Chiloda, Dhansura, Kheda) or Local Delivery.
- Dynamic UPI QR generation with store VPA and order ID note.
- Mandatory 12-digit UTR verification input field.
- Order creation with automated PDF invoice generation in Google Drive.

### 2.3 Service & Repair Job Management
- Public service booking form (device type, brand/model, serial number, issue summary, branch, drop-off vs. on-site).
- Sequential reference ticket ID: `ITV-SRV-2026-XXXX`.
- Public self-service tracking widget with 5-stage visual stepper, technician notes history, and repair cost approval.

### 2.4 Admin & Operations Dashboard (`#admin`)
- Secure session validation for store operators.
- KPI metric cards: Today's Revenue, Pending Orders, Active Repairs, Low Stock Alerts.
- Inline product stock and pricing editor for all 6 branch locations.
- Order fulfillment and UTR verification hub.
- Digital job card manager for technician assignment and status advancement.

---

## 3. UI/UX & Design Tokens

- Corporate Navy Primary: `#0F4C81` (hover: `#0A3459`, soft tint: `#EBF3FA`)
- Call-to-Action Accent Orange: `#F97316` (hover: `#EA580C`)
- Status Green: `#16A34A` (soft bg: `#DCFCE7`)
- Warning Amber: `#D97706`, Danger Red: `#DC2626`
- Canvas Surface: `#F8FAFC`, Card Surface: `#FFFFFF`, Subtle BG: `#F1F5F9`
- Tabular numerals across all prices, stock quantities, and tracking IDs: `font-variant-numeric: tabular-nums`.
- Responsive breakpoints: Mobile `<640px` (2 cols, persistent bottom bar), Tablet `640px-1024px` (3 cols), Desktop `>1024px` (4 cols, max 1280px), Ultra-Wide `>1440px` (5 cols).
- Performance targets over 4G: Initial payload `< 120 KB`, FCP `< 1.2s`, TTI `< 1.8s`.
