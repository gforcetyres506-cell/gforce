import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('🌱 Seeding Supabase database at', supabaseUrl);

  // 1. Service Zones
  console.log('📍 Seeding Service Zones...');
  const zones = [
    { postcode_prefix: 'E14', zone_name: 'Canary Wharf & Isle of Dogs', callout_charge: 0, active: true },
    { postcode_prefix: 'E15', zone_name: 'Stratford & Olympic Park', callout_charge: 0, active: true },
    { postcode_prefix: 'BR1', zone_name: 'Bromley & Outer South London', callout_charge: 1500, active: true },
    { postcode_prefix: 'E1',  zone_name: 'Whitechapel & Spitalfields', callout_charge: 0, active: true },
    { postcode_prefix: 'E2',  zone_name: 'Bethnal Green & Shoreditch', callout_charge: 0, active: true },
    { postcode_prefix: 'EC1', zone_name: 'Clerkenwell & Farringdon',   callout_charge: 0, active: true },
    { postcode_prefix: 'EC2', zone_name: 'City of London & Broadgate', callout_charge: 0, active: true },
    { postcode_prefix: 'N1',  zone_name: 'Islington & Angel',           callout_charge: 0, active: true },
    { postcode_prefix: 'NW1', zone_name: 'Camden & Regent’s Park',     callout_charge: 0, active: true },
    { postcode_prefix: 'SE1', zone_name: 'Southwark & London Bridge',  callout_charge: 0, active: true },
    { postcode_prefix: 'SW1', zone_name: 'Westminster & Victoria',     callout_charge: 0, active: true },
    { postcode_prefix: 'W1',  zone_name: 'Mayfair & West End',         callout_charge: 0, active: true },
    { postcode_prefix: 'RM1', zone_name: 'Romford (Outer Ring)',       callout_charge: 2000, active: true },
  ];

  for (const z of zones) {
    await supabase.from('service_zones').upsert(z, { onConflict: 'postcode_prefix' });
  }

  // 2. Fitters
  console.log('🚐 Seeding Mobile Fitters...');
  const fitters = [
    { name: 'Dave Mitchell', phone: '07700 900123', active: true },
    { name: 'Sam Okafor',    phone: '07700 900456', active: true },
    { name: 'Marcus Vance',  phone: '07700 900789', active: true },
  ];
  for (const f of fitters) {
    const { data: existing } = await supabase.from('fitters').select('id').eq('name', f.name).maybeSingle();
    if (!existing) {
      await supabase.from('fitters').insert(f);
    }
  }

  // 3. Tyres
  console.log('🏎️ Seeding Tyre Inventory...');
  const tyres = [
    // 225/45 R18
    {
      brand: 'Michelin', model: 'Pilot Sport 5', sku: 'MICH-PS5-2254518',
      width: 225, profile: 45, rim: 18, load_index: '95', speed_rating: 'Y',
      is_run_flat: false, is_xl: true, season: 'summer', tier: 'premium',
      cost_price: 9200, sell_price: 14900, stock: 8, wet_grip: 'A', fuel_economy: 'B', noise_db: 71, active: true
    },
    {
      brand: 'Continental', model: 'PremiumContact 7', sku: 'CONT-PC7-2254518',
      width: 225, profile: 45, rim: 18, load_index: '95', speed_rating: 'Y',
      is_run_flat: false, is_xl: true, season: 'summer', tier: 'premium',
      cost_price: 8800, sell_price: 13900, stock: 6, wet_grip: 'A', fuel_economy: 'C', noise_db: 72, active: true
    },
    {
      brand: 'Goodyear', model: 'Eagle F1 Asymmetric 6', sku: 'GY-EF1A6-2254518',
      width: 225, profile: 45, rim: 18, load_index: '95', speed_rating: 'Y',
      is_run_flat: false, is_xl: true, season: 'summer', tier: 'premium',
      cost_price: 8400, sell_price: 13200, stock: 8, wet_grip: 'A', fuel_economy: 'B', noise_db: 70, active: true
    },
    {
      brand: 'Hankook', model: 'Ventus S1 evo 3', sku: 'HK-S1E3-2254518',
      width: 225, profile: 45, rim: 18, load_index: '95', speed_rating: 'Y',
      is_run_flat: false, is_xl: true, season: 'summer', tier: 'mid',
      cost_price: 6800, sell_price: 10500, stock: 10, wet_grip: 'A', fuel_economy: 'C', noise_db: 71, active: true
    },
    {
      brand: 'Avon', model: 'ZV7', sku: 'AV-ZV7-2254518',
      width: 225, profile: 45, rim: 18, load_index: '95', speed_rating: 'W',
      is_run_flat: false, is_xl: true, season: 'summer', tier: 'mid',
      cost_price: 5800, sell_price: 8900, stock: 12, wet_grip: 'A', fuel_economy: 'C', noise_db: 69, active: true
    },
    {
      brand: 'Davanti', model: 'DX390', sku: 'DAV-DX390-2254518',
      width: 225, profile: 45, rim: 18, load_index: '95', speed_rating: 'W',
      is_run_flat: false, is_xl: true, season: 'summer', tier: 'budget',
      cost_price: 3900, sell_price: 6500, stock: 14, wet_grip: 'B', fuel_economy: 'C', noise_db: 68, active: true
    },
    {
      brand: 'Landsail', model: 'LS588 UHP', sku: 'LS-588-2254518',
      width: 225, profile: 45, rim: 18, load_index: '95', speed_rating: 'W',
      is_run_flat: false, is_xl: true, season: 'summer', tier: 'budget',
      cost_price: 3400, sell_price: 5500, stock: 16, wet_grip: 'B', fuel_economy: 'C', noise_db: 70, active: true
    },
    // 205/55 R16 (Volkswagen Golf, Ford Focus)
    {
      brand: 'Michelin', model: 'Primacy 4+', sku: 'MICH-P4P-2055516',
      width: 205, profile: 55, rim: 16, load_index: '91', speed_rating: 'V',
      is_run_flat: false, is_xl: false, season: 'summer', tier: 'premium',
      cost_price: 6200, sell_price: 9900, stock: 12, wet_grip: 'A', fuel_economy: 'B', noise_db: 69, active: true
    },
    {
      brand: 'Pirelli', model: 'Cinturato P7 (P7C2)', sku: 'PIR-CP7-2055516',
      width: 205, profile: 55, rim: 16, load_index: '91', speed_rating: 'V',
      is_run_flat: false, is_xl: false, season: 'summer', tier: 'premium',
      cost_price: 5800, sell_price: 9200, stock: 10, wet_grip: 'A', fuel_economy: 'B', noise_db: 70, active: true
    },
    {
      brand: 'Kumho', model: 'Ecsta HS52', sku: 'KM-HS52-2055516',
      width: 205, profile: 55, rim: 16, load_index: '91', speed_rating: 'V',
      is_run_flat: false, is_xl: false, season: 'summer', tier: 'mid',
      cost_price: 4200, sell_price: 6900, stock: 14, wet_grip: 'A', fuel_economy: 'C', noise_db: 71, active: true
    },
    {
      brand: 'Radar', model: 'RPX800', sku: 'RAD-RPX800-2055516',
      width: 205, profile: 55, rim: 16, load_index: '91', speed_rating: 'V',
      is_run_flat: false, is_xl: false, season: 'summer', tier: 'budget',
      cost_price: 2800, sell_price: 4800, stock: 20, wet_grip: 'B', fuel_economy: 'C', noise_db: 70, active: true
    },
    // 245/40 R19 (BMW 5 Series, Mercedes E-Class)
    {
      brand: 'Michelin', model: 'Pilot Sport 4 S', sku: 'MICH-PS4S-2454019',
      width: 245, profile: 40, rim: 19, load_index: '98', speed_rating: 'Y',
      is_run_flat: false, is_xl: true, season: 'summer', tier: 'premium',
      cost_price: 13500, sell_price: 21900, stock: 6, wet_grip: 'A', fuel_economy: 'C', noise_db: 71, active: true
    },
    {
      brand: 'Pirelli', model: 'P Zero (PZ4)', sku: 'PIR-PZ4-2454019',
      width: 245, profile: 40, rim: 19, load_index: '98', speed_rating: 'Y',
      is_run_flat: false, is_xl: true, season: 'summer', tier: 'premium',
      cost_price: 12200, sell_price: 19800, stock: 6, wet_grip: 'A', fuel_economy: 'C', noise_db: 72, active: true
    },
    {
      brand: 'Yokohama', model: 'Advan Fleva V701', sku: 'YOK-V701-2454019',
      width: 245, profile: 40, rim: 19, load_index: '98', speed_rating: 'W',
      is_run_flat: false, is_xl: true, season: 'summer', tier: 'mid',
      cost_price: 9500, sell_price: 14900, stock: 8, wet_grip: 'A', fuel_economy: 'C', noise_db: 69, active: true
    },
    {
      brand: 'Aplus', model: 'A607', sku: 'AP-A607-2454019',
      width: 245, profile: 40, rim: 19, load_index: '98', speed_rating: 'W',
      is_run_flat: false, is_xl: true, season: 'summer', tier: 'budget',
      cost_price: 4900, sell_price: 7900, stock: 12, wet_grip: 'B', fuel_economy: 'C', noise_db: 72, active: true
    }
  ];

  for (const t of tyres) {
    await supabase.from('tyre_inventory').upsert(t, { onConflict: 'sku' });
  }

  // 4. Slots (next 14 days)
  console.log('📅 Generating booking slots for next 14 days...');
  const slotWindows = [
    { start: '08:00', end: '10:00' },
    { start: '10:30', end: '12:30' },
    { start: '13:00', end: '15:00' },
    { start: '15:30', end: '17:30' },
  ];

  const now = new Date();
  const slotsToInsert = [];

  for (let d = 0; d < 14; d++) {
    const slotDate = new Date(now.getTime() + d * 86400000).toISOString().split('T')[0];
    for (const win of slotWindows) {
      slotsToInsert.push({
        slot_date: slotDate,
        start_time: win.start,
        end_time: win.end,
        max_bookings: 3,
        active: true,
      });
    }
  }

  for (const slot of slotsToInsert) {
    await supabase.from('booking_slots').upsert(slot, { onConflict: 'slot_date,start_time' });
  }

  console.log('✅ Supabase database successfully seeded!');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
