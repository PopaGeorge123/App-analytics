import Stripe from 'stripe';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, '..', '.env'), 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  let val = trimmed.slice(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  env[key] = val;
}

const stripe = new Stripe(env['STRIPE_SECRET_KEY'], { apiVersion: '2024-12-18.acacia' });

console.log('=== ALL CHARGES (detailed) ===\n');

for await (const c of stripe.charges.list({ limit: 100 })) {
  const date = new Date(c.created * 1000).toISOString();
  console.log(`ID:          ${c.id}`);
  console.log(`Date:        ${date}`);
  console.log(`Amount:      $${(c.amount / 100).toFixed(2)} ${c.currency.toUpperCase()}`);
  console.log(`Status:      ${c.status}`);
  console.log(`Paid:        ${c.paid}`);
  console.log(`Refunded:    ${c.refunded}`);
  console.log(`Customer:    ${c.customer || 'none'}`);
  console.log(`Description: ${c.description || 'none'}`);
  console.log(`Invoice:     ${c.invoice || 'none'}`);
  console.log(`Payment:     ${c.payment_intent || 'none'}`);
  console.log('---');
}
