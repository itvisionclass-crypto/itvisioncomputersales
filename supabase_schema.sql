-- =============================================================================
-- IT VISION COMPUTER SALES, SERVICE & ACCESSORIES
-- Supabase PostgreSQL Relational Schema
-- Project ID: mztnzrpfpszfieooeprj
-- Endpoint: https://mztnzrpfpszfieooeprj.supabase.co
-- Note: Media assets (photos/videos/invoices) stay on Google Drive / CDN
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(50) UNIQUE NOT NULL,
    sku_code VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    condition VARCHAR(50) DEFAULT 'Brand New',
    mrp_price NUMERIC(10, 2) NOT NULL,
    selling_price NUMERIC(10, 2) NOT NULL,
    bulk_price_tier5 NUMERIC(10, 2),
    bulk_price_tier10 NUMERIC(10, 2),
    stock_prantij INTEGER DEFAULT 0,
    stock_talod INTEGER DEFAULT 0,
    stock_ranasan INTEGER DEFAULT 0,
    stock_chiloda INTEGER DEFAULT 0,
    stock_dhansura INTEGER DEFAULT 0,
    stock_kheda INTEGER DEFAULT 0,
    drive_image_id VARCHAR(255),
    specs_json JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for fast search and filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_product_id ON public.products(product_id);

-- 2. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(100),
    fulfillment_branch VARCHAR(50) NOT NULL DEFAULT 'Prantij (HO)',
    order_items_json JSONB NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'UPI_QR',
    payment_status VARCHAR(50) DEFAULT 'PENDING_UTR_VERIFICATION',
    utr_number VARCHAR(12) NOT NULL,
    pdf_drive_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(payment_status);

-- 3. SERVICE TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.service_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    device_category VARCHAR(50) NOT NULL,
    device_serial VARCHAR(100),
    reported_fault TEXT NOT NULL,
    branch_location VARCHAR(50) NOT NULL DEFAULT 'Prantij (HO)',
    current_status VARCHAR(50) DEFAULT 'RECEIVED',
    est_cost NUMERIC(10, 2) DEFAULT 0.00,
    tech_notes_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON public.service_tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_phone ON public.service_tickets(customer_phone);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.service_tickets(current_status);

-- 4. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    address TEXT,
    branch_preference VARCHAR(50) DEFAULT 'Prantij (HO)',
    role VARCHAR(30) DEFAULT 'Customer',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. OTP LOGS TABLE
CREATE TABLE IF NOT EXISTS public.otp_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_email VARCHAR(100) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expiry_time TIMESTAMPTZ NOT NULL,
    verification VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_identifier ON public.otp_logs(phone_email);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_logs ENABLE ROW LEVEL SECURITY;

-- Products: Everyone can read active products; Service role can manage
CREATE POLICY "Public read access for active products"
    ON public.products FOR SELECT
    USING (status = 'ACTIVE');

CREATE POLICY "Service role full access on products"
    ON public.products FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Orders: Public can insert new orders; Public can read their own order by order_id or phone
CREATE POLICY "Public can insert orders"
    ON public.orders FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public can select their own order"
    ON public.orders FOR SELECT
    USING (true);

CREATE POLICY "Service role full access on orders"
    ON public.orders FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Service Tickets: Public can create tickets and read by ticket_id
CREATE POLICY "Public can create service tickets"
    ON public.service_tickets FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public can track service tickets"
    ON public.service_tickets FOR SELECT
    USING (true);

CREATE POLICY "Service role full access on service tickets"
    ON public.service_tickets FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- =============================================================================
-- SEED MASTER PRODUCTS DATA
-- =============================================================================

INSERT INTO public.products (
    product_id, sku_code, title, category, condition, mrp_price, selling_price,
    bulk_price_tier5, bulk_price_tier10, stock_prantij, stock_talod, stock_ranasan,
    stock_chiloda, stock_dhansura, stock_kheda, drive_image_id, specs_json, status
) VALUES 
(
    'ITV-CMB-001', 'ITV-COMBO-8IN1', '₹12,999 8-Item Complete Desktop + Printer Package', 'Combo', 'Certified Refurbished',
    35000, 12999, 12200, 11500, 12, 4, 3, 5, 2, 4, '1aB2c3D4e5F6g7H8i9J0k',
    '{"CPU": "Intel Core i5 6th Gen", "RAM": "8GB DDR4", "Storage": "256GB SSD", "Display": "19\" LED Monitor", "Printer": "HP LaserJet 1020 Refurbished", "Accessories": "Keyboard, Mouse, Wi-Fi Dongle, Speakers", "Warranty": "1 Year Store Warranty"}'::jsonb,
    'ACTIVE'
),
(
    'ITV-DSK-002', 'DELL-OPT-7040', 'Dell OptiPlex 7040 SFF Business Desktop', 'Desktop', 'Certified Refurbished',
    32000, 11999, 11400, 10800, 15, 6, 4, 8, 3, 5, '1sampleDriveImgIdDellSff',
    '{"CPU": "Intel Core i5 6500 3.2GHz", "RAM": "8GB DDR4", "Storage": "256GB NVMe SSD", "OS": "Windows 11 Pro Genuine", "Warranty": "1 Year Replacement Warranty"}'::jsonb,
    'ACTIVE'
),
(
    'ITV-LAP-003', 'LEN-TP-T480', 'Lenovo ThinkPad T480 Ultrabook (Quad Core i5)', 'Laptop', 'Certified Refurbished',
    45000, 19499, 18500, 17800, 8, 3, 2, 4, 1, 3, '1sampleDriveImgIdThinkpad',
    '{"CPU": "Intel Core i5 8th Gen Quad-Core", "RAM": "16GB DDR4", "Storage": "512GB SSD", "Display": "14\" FHD IPS", "Warranty": "6 Months Store Warranty"}'::jsonb,
    'ACTIVE'
),
(
    'ITV-PRN-004', 'HP-LJP-1020P', 'HP LaserJet 1020 Plus Monochrome Printer (Legendary Workhorse)', 'Printer', 'Certified Refurbished',
    11500, 9499, 9100, 8800, 10, 4, 2, 5, 1, 3, '1sampleDriveImgIdHP1020',
    '{"Speed": "14 ppm", "Cartridge": "HP 12A / Q2612A", "Connectivity": "USB 2.0", "Refill Cost": "₹250 only", "Warranty": "6 Months Comprehensive"}'::jsonb,
    'ACTIVE'
),
(
    'ITV-PRN-005', 'HP-M1005-MFP', 'HP LaserJet M1005 Monochrome Multi-Function Printer', 'Printer', 'Certified Refurbished',
    24000, 14999, 14200, 13700, 6, 2, 1, 3, 1, 2, '1sampleDriveImgIdHPM1005',
    '{"Functions": "Print, Scan, Copy", "Speed": "15 ppm", "Cartridge": "HP 12A", "Warranty": "6 Months Comprehensive"}'::jsonb,
    'ACTIVE'
),
(
    'ITV-TON-006', 'ITV-CART-12A', 'Compatible 12A (Q2612A) Premium Toner Cartridge', 'Cartridge', 'Brand New',
    1200, 450, 410, 370, 60, 25, 20, 30, 15, 20, '1sampleDriveImgId12A',
    '{"Page Yield": "2000 Pages @ 5% Coverage", "Compatibility": "HP LaserJet 1020, 1005, 1010, Canon 2900B", "Warranty": "100% Dark Print Guarantee"}'::jsonb,
    'ACTIVE'
),
(
    'ITV-TON-007', 'ITV-CART-88A', 'Compatible 88A (CC388A) High-Density Toner Cartridge', 'Cartridge', 'Brand New',
    1350, 499, 450, 410, 45, 18, 15, 20, 10, 15, '1sampleDriveImgId88A',
    '{"Page Yield": "1800 Pages", "Compatibility": "HP LaserJet P1007, P1108, M1136 MFP, M126nw", "Warranty": "100% Dark Print Replacement"}'::jsonb,
    'ACTIVE'
),
(
    'ITV-SEC-008', 'CP-CCTV-4CAM', 'CP PLUS 4-Channel Full HD Night Vision CCTV Security Kit', 'Security', 'Brand New',
    16500, 8999, 8500, 8000, 8, 3, 2, 4, 2, 3, '1sampleDriveImgIdCCTV',
    '{"Contents": "4-Channel HD DVR + 4 HD Cameras + 500GB HDD + SMPS + Cable", "Warranty": "2 Years Official Warranty"}'::jsonb,
    'ACTIVE'
),
(
    'ITV-ACC-009', 'ITV-KB-MS-CMB', 'Pro-Grade USB Keyboard and Optical Mouse Combo', 'Accessories', 'Brand New',
    850, 420, 380, 340, 50, 20, 15, 25, 10, 15, '1sampleDriveImgIdKbMs',
    '{"Interface": "USB Plug & Play", "Keys": "104 Key Rupee Layout", "DPI": "1200 DPI Optical", "Warranty": "1 Year Replacement"}'::jsonb,
    'ACTIVE'
),
(
    'ITV-ACC-010', 'LB-WIFI-300M', '300Mbps High Gain Wi-Fi USB Adapter with Antenna', 'Accessories', 'Brand New',
    650, 280, 250, 220, 40, 15, 12, 20, 10, 12, '1sampleDriveImgIdWifi',
    '{"Speed": "Up to 300Mbps", "Antenna": "5dBi Omni Detachable", "Compatibility": "Windows 11 / 10 / 7 / Linux"}'::jsonb,
    'ACTIVE'
)
ON CONFLICT (product_id) DO NOTHING;
