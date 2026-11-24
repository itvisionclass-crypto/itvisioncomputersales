-- =============================================================================
-- IT VISION COMPUTER SALES, SERVICE & ACCESSORIES
-- Supabase PostgreSQL Schema (Simplified Products Database)
-- Project ID: mztnzrpfpszfieooeprj
-- Endpoint: https://mztnzrpfpszfieooeprj.supabase.co
-- Note: Media assets (photos, videos, audios) are hosted on Google Drive:
-- https://script.google.com/macros/s/AKfycbwa3D0RyEZl50W6IDGijCKcaL7qbSBm9q4W05yy4l7G5LRIZ9fQvww6j-PVkGoQ7ID53g/exec
-- =============================================================================

-- 1. Remove all old tables from Supabase to keep ONLY products table
DROP TABLE IF EXISTS public.otp_logs CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.service_tickets CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;

-- 2. CREATE SIMPLIFIED PRODUCTS TABLE
-- Schema fields requested: id, name, price, photos_link (url), description, available_pcs
CREATE TABLE public.products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    photos_link TEXT,
    description TEXT,
    available_pcs INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for fast title and price queries
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_price ON public.products(price);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all products
CREATE POLICY "Allow public read access on products"
    ON public.products FOR SELECT
    USING (true);

-- Allow public and service role insert/update/delete access
CREATE POLICY "Allow full access on products"
    ON public.products FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. SEED INITIAL PRODUCTS DATA
INSERT INTO public.products (id, name, price, photos_link, description, available_pcs) VALUES
(
    'ITV-CMB-001',
    '₹12,999 8-Item Complete Desktop + Laser Printer Package',
    12999.00,
    'https://lh3.googleusercontent.com/d/1aB2c3D4e5F6g7H8i9J0k=w600-rw',
    'Core i5 CPU, 8GB DDR4 RAM, 256GB SSD, 19 Inch LED Monitor, HP LaserJet 1020 Refurbished, Keyboard, Optical Mouse, Wi-Fi Dongle, Stereo Speakers. 1 Year Store Warranty.',
    30
),
(
    'ITV-DSK-002',
    'Dell OptiPlex 7040 SFF Business Desktop Set',
    11999.00,
    'https://lh3.googleusercontent.com/d/1sampleDriveImgIdDellSff=w600-rw',
    'Intel Core i5 6500 3.2GHz, 8GB DDR4, 256GB NVMe SSD, Genuine Windows 11 Pro, 1 Year Replacement Warranty.',
    41
),
(
    'ITV-LAP-003',
    'Lenovo ThinkPad T480 Quad-Core i5 Ultrabook',
    19499.00,
    'https://lh3.googleusercontent.com/d/1sampleDriveImgIdThinkpad=w600-rw',
    'Core i5 8th Gen Quad-Core, 16GB DDR4, 512GB SSD, 14 Inch FHD IPS Anti-Glare Display, Dual Battery, 6 Months Store Warranty.',
    21
),
(
    'ITV-PRN-004',
    'HP LaserJet 1020 Plus Monochrome Laser Printer',
    9499.00,
    'https://lh3.googleusercontent.com/d/1sampleDriveImgIdHP1020=w600-rw',
    '14 ppm speed, HP 12A / Q2612A cartridge support, USB 2.0 High Speed connectivity, ₹250 refill cost, 6 Months Comprehensive Warranty.',
    25
),
(
    'ITV-PRN-005',
    'HP LaserJet M1005 Monochrome Multi-Function Printer',
    14999.00,
    'https://lh3.googleusercontent.com/d/1sampleDriveImgIdHPM1005=w600-rw',
    'Print, Scan, Copy multi-function laser printer, 15 ppm speed, HP 12A cartridge, up to 1200 dpi, 6 Months Comprehensive Warranty.',
    15
),
(
    'ITV-TON-006',
    'Compatible 12A (Q2612A) Premium Toner Cartridge',
    450.00,
    'https://lh3.googleusercontent.com/d/1sampleDriveImgId12A=w600-rw',
    '2,000 pages yield @ 5% coverage. Compatible with HP LaserJet 1020, 1005, 1010, 1018, 3050, Canon 2900B. 100% Dark Print Guarantee.',
    170
),
(
    'ITV-TON-007',
    'Compatible 88A (CC388A) High-Density Toner Cartridge',
    499.00,
    'https://lh3.googleusercontent.com/d/1sampleDriveImgId88A=w600-rw',
    '1,800 pages yield. Compatible with HP LaserJet P1007, P1108, M1136 MFP, M126nw. 100% Dark Print Replacement.',
    123
),
(
    'ITV-SEC-008',
    'CP PLUS 4-Channel Full HD Night Vision CCTV Kit',
    8999.00,
    'https://lh3.googleusercontent.com/d/1sampleDriveImgIdCCTV=w600-rw',
    '4-Channel HD DVR + 4 HD Cameras (2 Bullet, 2 Dome) + 500GB Surveillance HDD + SMPS + Cable. 2 Years Official Warranty.',
    22
),
(
    'ITV-ACC-009',
    'Pro-Grade USB Keyboard & Optical Mouse Combo',
    420.00,
    'https://lh3.googleusercontent.com/d/1sampleDriveImgIdKbMs=w600-rw',
    '104-Key standard English QWERTY keyboard, 1200 DPI optical mouse, USB plug and play, 1 Year Replacement Warranty.',
    135
),
(
    'ITV-ACC-010',
    '300Mbps High Gain Wi-Fi USB Adapter with Antenna',
    280.00,
    'https://lh3.googleusercontent.com/d/1sampleDriveImgIdWifi=w600-rw',
    'Up to 300Mbps speed, 5dBi detachable omni-directional antenna, Windows 11 / 10 / 7 / Linux compatible.',
    109
)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name,
    price = EXCLUDED.price,
    photos_link = EXCLUDED.photos_link,
    description = EXCLUDED.description,
    available_pcs = EXCLUDED.available_pcs,
    updated_at = NOW();
