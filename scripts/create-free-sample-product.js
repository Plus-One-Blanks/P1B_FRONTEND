#!/usr/bin/env node
/**
 * Create Free Sample Pack product in Shopify Admin.
 *
 * Reads SHOPIFY_* from process.env or project-root .env:
 *   SHOPIFY_STORE / SHOPIFY_TOKEN (or SHOPIFY_ADMIN_API_TOKEN)
 *   SHOPIFY_HYDROGEN_PUBLICATION_ID (optional, GraphQL publish)
 *
 * Usage:
 *   node scripts/create-free-sample-product.js
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

const FREE_SAMPLE = {
  title: 'Free Sample Pack',
  handle: 'dtf-free-sample',
  body_html: `<p>Claim a free custom DTF press test. Upload your artwork, choose a print size, and we’ll print a sample transfer plus a Plus 1 test kit.</p>
<ul>
<li>Custom artwork transfer sized to your placement</li>
<li>Sample kit included</li>
<li>Hot peel · printed in the United States</li>
</ul>`,
  product_type: 'DTF Sample',
  vendor: 'Plus One Blanks',
  status: 'active',
  options: [{name: 'Offer'}],
  variants: [
    {
      option1: 'Custom Sample + Test Kit',
      price: '0.00',
      sku: 'DTF-FS-FREE',
      inventory_management: null,
      requires_shipping: true,
    },
    {
      option1: 'Test + Credit Boost',
      price: '25.00',
      sku: 'DTF-FS-CREDIT',
      inventory_management: null,
      requires_shipping: true,
    },
    {
      option1: 'Sample Kit',
      price: '0.00',
      sku: 'DTF-FS-KIT',
      inventory_management: null,
      requires_shipping: true,
    },
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
 * @param {number|string} productId
 */
async function publishToChannels(productId) {
  const productGid = `gid://shopify/Product/${productId}`;
  /** @type {string[]} */
  const publicationIds = [];
  if (HYDROGEN_PUBLICATION_ID) publicationIds.push(HYDROGEN_PUBLICATION_ID);

  // Also publish to common storefront channels when present
  try {
    const pubs = await graphql(`{
      publications(first: 20) { nodes { id name } }
    }`);
    for (const node of pubs?.publications?.nodes || []) {
      const name = String(node.name || '').toLowerCase();
      if (
        name.includes('hydrogen') ||
        name.includes('plus one') ||
        name === 'online store'
      ) {
        if (!publicationIds.includes(node.id)) publicationIds.push(node.id);
      }
    }
  } catch (e) {
    console.warn('  could not list publications', e.message);
  }

  if (!publicationIds.length) {
    console.warn('  No publication IDs — skip GraphQL publish');
    return;
  }

  const data = await graphql(
    `mutation Publish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }`,
    {
      id: productGid,
      input: publicationIds.map((publicationId) => ({publicationId})),
    },
  );
  const errors = data?.publishablePublish?.userErrors || [];
  if (errors.length) {
    console.warn('  publishablePublish errors:', JSON.stringify(errors));
  } else {
    console.log(`  published to ${publicationIds.length} channel(s)`);
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
    await publishToChannels(updated.product.id);
    return updated.product;
  }

  console.log(`＋ Creating: ${spec.handle}`);
  const created = await admin('/products.json', {
    method: 'POST',
    body: JSON.stringify({product: spec}),
  });
  await publishToChannels(created.product.id);
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
  const product = await upsertProduct(FREE_SAMPLE);
  console.log(
    `✓ Free sample: /products/${product.handle} (${product.variants?.length} variants)`,
  );
  console.log('\nDone. Storefront: /free-sample');
}

main().catch((e) => {
  console.error(e.message);
  if (e.body) console.error(JSON.stringify(e.body, null, 2));
  process.exit(1);
});
