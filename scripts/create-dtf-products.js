#!/usr/bin/env node
/**
 * Create DTF gang sheet + transfer-by-size products in Shopify Admin.
 *
 * Reads SHOPIFY_* from process.env or project-root .env:
 *   SHOPIFY_STORE / SHOPIFY_TOKEN (or SHOPIFY_ADMIN_API_TOKEN)
 *   SHOPIFY_HYDROGEN_PUBLICATION_ID (optional, GraphQL publish)
 *
 * Usage:
 *   node scripts/create-dtf-products.js
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotEnv(path.resolve(__dirname, '../.env'));

const STORE = (
  process.env.SHOPIFY_STORE ||
  process.env.PUBLIC_STORE_DOMAIN ||
  'plus-1-blanks.myshopify.com'
).replace(/^https?:\/\//, '');
const TOKEN =
  process.env.SHOPIFY_ADMIN_API_TOKEN || process.env.SHOPIFY_TOKEN || '';
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';
const HYDROGEN_PUBLICATION_ID =
  process.env.SHOPIFY_HYDROGEN_PUBLICATION_ID || '';
const BASE = `https://${STORE}/admin/api/${API_VERSION}`;
const GQL = `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;

const GANG_SHEET = {
  title: 'DTF Gang Sheet Builder',
  handle: 'dtf-gang-sheet',
  body_html: `<p>Create a print-ready DTF gang sheet online. Upload artwork, arrange your layout on a 22″ sheet, and order custom transfers ready to press.</p>
<ul>
<li>All sizes 22 inches wide</li>
<li>Hot peel · 100+ washes</li>
<li>Printed in-house in the United States</li>
</ul>`,
  product_type: 'DTF Transfer',
  vendor: 'Plus One Blanks',
  status: 'active',
  options: [{name: 'Size'}],
  variants: [
    {option1: '2 Feet', price: '19.99', sku: 'DTF-GS-2FT', inventory_management: null},
    {option1: '5 Feet', price: '44.99', sku: 'DTF-GS-5FT', inventory_management: null},
    {option1: '7 Feet', price: '59.99', sku: 'DTF-GS-7FT', inventory_management: null},
    {option1: '10 Feet', price: '74.99', sku: 'DTF-GS-10FT', inventory_management: null},
    {option1: '15 Feet', price: '99.99', sku: 'DTF-GS-15FT', inventory_management: null},
    {option1: '20 Feet', price: '119.99', sku: 'DTF-GS-20FT', inventory_management: null},
  ],
};

const BY_SIZE = {
  title: 'DTF Transfers by Size',
  handle: 'dtf-transfer-by-size',
  body_html: `<p>Order individual DTF transfers by finished size. Upload each design, pick size and quantity — no gang sheet layout required.</p>`,
  product_type: 'DTF Transfer',
  vendor: 'Plus One Blanks',
  status: 'active',
  options: [{name: 'Size'}],
  variants: [
    {option1: '2x2', price: '1.49', sku: 'DTF-TX-2X2', inventory_management: null},
    {option1: '3x3', price: '2.49', sku: 'DTF-TX-3X3', inventory_management: null},
    {option1: '4x4', price: '3.49', sku: 'DTF-TX-4X4', inventory_management: null},
    {option1: '5x5', price: '4.49', sku: 'DTF-TX-5X5', inventory_management: null},
    {option1: '8x8', price: '6.99', sku: 'DTF-TX-8X8', inventory_management: null},
    {option1: '10x10', price: '8.99', sku: 'DTF-TX-10X10', inventory_management: null},
    {option1: '11x11', price: '9.99', sku: 'DTF-TX-11X11', inventory_management: null},
    {option1: '12x12', price: '11.99', sku: 'DTF-TX-12X12', inventory_management: null},
  ],
};

/**
 * @param {string} filePath
 */
function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

async function admin(apiPath, opts = {}) {
  const res = await fetch(`${BASE}${apiPath}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = {raw: text};
  }
  if (!res.ok) {
    const err = new Error(`Admin API ${res.status} ${apiPath}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function graphql(query, variables = {}) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({query, variables}),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    const err = new Error('Admin GraphQL error');
    err.body = json;
    throw err;
  }
  return json.data;
}

async function findProductByHandle(handle) {
  const data = await admin(
    `/products.json?handle=${encodeURIComponent(handle)}&limit=1`,
  );
  return data.products?.[0] || null;
}

/**
 * Publish product to Hydrogen sales channel via GraphQL.
 * @param {number|string} productId numeric REST id
 */
async function publishToHydrogen(productId) {
  if (!HYDROGEN_PUBLICATION_ID) {
    console.warn('  No SHOPIFY_HYDROGEN_PUBLICATION_ID — skip GraphQL publish');
    return;
  }
  const productGid = `gid://shopify/Product/${productId}`;
  const data = await graphql(
    `mutation Publish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }`,
    {
      id: productGid,
      input: [{publicationId: HYDROGEN_PUBLICATION_ID}],
    },
  );
  const errors = data?.publishablePublish?.userErrors || [];
  if (errors.length) {
    console.warn('  publishablePublish errors:', JSON.stringify(errors));
  } else {
    console.log('  published to Hydrogen channel');
  }
}

async function upsertProduct(spec) {
  const existing = await findProductByHandle(spec.handle);
  if (existing) {
    console.log(`↻ Updating existing: ${spec.handle} (${existing.id})`);
    const existingByOption = new Map(
      (existing.variants || []).map((ev) => [String(ev.option1), ev]),
    );
    const variants = spec.variants.map((v) => {
      const match = existingByOption.get(String(v.option1));
      return match ? {...v, id: match.id} : v;
    });
    const updated = await admin(`/products/${existing.id}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        product: {
          id: existing.id,
          title: spec.title,
          body_html: spec.body_html,
          product_type: spec.product_type,
          vendor: spec.vendor,
          status: spec.status,
          variants,
        },
      }),
    });
    await publishToHydrogen(updated.product.id);
    return updated.product;
  }

  console.log(`＋ Creating: ${spec.handle}`);
  const created = await admin('/products.json', {
    method: 'POST',
    body: JSON.stringify({product: spec}),
  });
  await publishToHydrogen(created.product.id);
  return created.product;
}

async function main() {
  if (!TOKEN) {
    console.error(
      'Missing SHOPIFY_TOKEN / SHOPIFY_ADMIN_API_TOKEN in .env',
    );
    process.exit(1);
  }

  console.log(`Store: ${STORE}`);
  const gang = await upsertProduct(GANG_SHEET);
  console.log(
    `✓ Gang sheet: /products/${gang.handle} (${gang.variants?.length} variants)`,
  );

  const bySize = await upsertProduct(BY_SIZE);
  console.log(
    `✓ By size: /products/${bySize.handle} (${bySize.variants?.length} variants)`,
  );

  console.log('\nDone.');
  console.log('Storefront: /dtf-sheets/builder  ·  /dtf-sheets/by-size');
}

main().catch((e) => {
  console.error(e.message);
  if (e.body) console.error(JSON.stringify(e.body, null, 2));
  process.exit(1);
});
