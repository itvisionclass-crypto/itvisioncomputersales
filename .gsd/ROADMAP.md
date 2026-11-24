# IT Vision Computer WebApp — Roadmap & Phase Plan

## Status: ACTIVE
**Methodology:** GSD Canonical (SPEC → PLAN → EXECUTE → VERIFY → COMMIT)

---

## Phase Breakdown

### Phase 1: Data Infrastructure & Storage Setup
- [ ] Task 01: Create Google Sheets Database Workbook definition & schema constants
- [ ] Task 02: Build `setupDatabase()` initialization script in `Code.gs`
- [ ] Task 03: Run DB Initializer to create 5 schema sheets with headers
- [ ] Task 04: Initialize Google Drive storage folders structure definition
- [ ] Task 05: Seed master product catalog & branch inventory data

### Phase 2: Backend Core Services (Google Apps Script — Code.gs)
- [ ] Task 06: Implement base Apps Script Web entry point (`doGet`)
- [ ] Task 07: Implement products data access layer (`getProductsCatalog`)
- [ ] Task 08: Implement concurrency lock & order service (`processCustomerOrder`)
- [ ] Task 09: Implement OTP authentication service (`generateAndSendOTP` & `verifyOTP`)
- [ ] Task 10: Implement service ticket engine (`createServiceTicket` & `getTicketStatus`)
- [ ] Task 11: Implement server-side PDF generation engine (`generateInvoicePDF`)
- [ ] Task 12: Implement admin management endpoints (`getAdminDashboardData`, `updateStock`, `updateTicketStatus`)

### Phase 3: Frontend Foundations & Design System
- [ ] Task 13: Scaffold Single-Page Application base structure (`Index.html`)
- [ ] Task 14: Define CSS design tokens & base theme variables
- [ ] Task 15: Implement responsive layout grids & breakpoints
- [ ] Task 16: Implement global client state store (`window.ITVisionState`)
- [ ] Task 17: Implement client-side hash router (`#home`, `#catalog`, `#service`, `#cart`, `#admin`)

### Phase 4: Storefront & Navigation Components
- [ ] Task 18: Build Tier 1 announcement bar & Tier 2 sticky main header
- [ ] Task 19: Build Tier 3 category mega-menu & Tier 5 category icon grid
- [ ] Task 20: Build Tier 4 split hero banner & trust strip
- [ ] Task 21: Build Tier 8 bulk inquiry banner & Tier 9 branch footer
- [ ] Task 22: Build mobile bottom sticky navigation (<640px)

### Phase 5: Product Discovery, Search & Catalog UI
- [ ] Task 23: Implement Google Drive CDN image URL formatter helper
- [ ] Task 24: Implement sessionStorage catalog caching layer
- [ ] Task 25: Implement sub-10ms in-memory client search engine (Ctrl+K)
- [ ] Task 26: Build high-density product card component
- [ ] Task 27: Build filterable product grid & merchandising carousels

### Phase 6: Shopping Cart, UPI Payments & Checkout Flow
- [ ] Task 28: Build slide-out shopping cart drawer component
- [ ] Task 29: Implement localStorage cart synchronization & bulk stepper
- [ ] Task 30: Implement dynamic UPI QR generation canvas (`upi://pay`)
- [ ] Task 31: Build checkout modal with 12-digit UTR input form
- [ ] Task 32: Integrate checkout submission with Apps Script RPC & invoice download
- [ ] Task 33: Integrate floating WhatsApp action button (FAB)

### Phase 7: Repair Service & Live Ticket Tracking Module
- [ ] Task 34: Build public service booking intake form
- [ ] Task 35: Implement ticket ID generation (`ITV-SRV-2026-XXXX`)
- [ ] Task 36: Build public ticket status stepper tracker

### Phase 8: Store Operations & Admin Management Portal (#admin)
- [ ] Task 37: Build admin secure login & session guard
- [ ] Task 38: Build operations metric KPI cards
- [ ] Task 39: Build product inventory & price editor table
- [ ] Task 40: Build order fulfillment & UTR verification hub
- [ ] Task 41: Build service job card management & diagnostic note logger

### Phase 9: End-to-End Testing, Quota Hardening & Production Deployment
- [ ] Task 42: Conduct end-to-end order & invoice generation test
- [ ] Task 43: Conduct end-to-end repair ticket lifecycle test
- [ ] Task 44: Audit web performance & mobile 4G budget
- [ ] Task 45: Publish production web app deployment setup
- [ ] Task 46: Configure custom domain binding & branch staff access guide
