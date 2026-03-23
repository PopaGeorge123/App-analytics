import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  let val = trimmed.slice(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const STRIPE_KEY = env['STRIPE_SECRET_KEY'];
const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-12-18.acacia' });

console.log('Listing all charges from account...\n');

const all = [];
for await (const c of stripe.charges.list({ limit: 100 })) {
  all.push(c);
}

console.log('Total charges:', all.length);
for (const c of all) {
  const d = new Date(c.created * 1000).toISOString().slice(0, 10);
  console.log(d, c.paid ? 'PAID' : 'FAIL', '$' + (c.amount / 100).toFixed(2), c.currency.toUpperCase(), c.status);
}
