#!/usr/bin/env node

/**
 * Script to create bulk discount codes in Shopify using Admin API
 * 
 * Usage:
 *   SHOPIFY_ADMIN_API_TOKEN=your_token SHOPIFY_STORE=your-store.myshopify.com node scripts/create-bulk-discounts.js
 * 
 * Or set environment variables:
 *   export SHOPIFY_ADMIN_API_TOKEN=your_token
 *   export SHOPIFY_STORE=your-store.myshopify.com
 *   node scripts/create-bulk-discounts.js
 */

// Discount configuration
// Using percentage discounts (industry standard) - more flexible across different price points
// To calculate: (originalPrice - discountedPrice) / originalPrice * 100
// Example: ($6.60 - $6.58) / $6.60 * 100 = 0.30%
const BULK_TIERS = [
    { threshold: 1000, code: 'BULK1000', discountValue: 1.52, discountType: 'percentage' }, // $6.60 → $6.50 (1.52% off)
    { threshold: 500, code: 'BULK500', discountValue: 1.21, discountType: 'percentage' },   // $6.60 → $6.52 (1.21% off)
    { threshold: 250, code: 'BULK250', discountValue: 0.76, discountType: 'percentage' },   // $6.60 → $6.55 (0.76% off)
    { threshold: 99, code: 'BULK99', discountValue: 0.30, discountType: 'percentage' },     // $6.60 → $6.58 (0.30% off)
];

// Alternative: Fixed amount discounts (like blankstyle.com uses)
// Uncomment below and comment above if you prefer fixed amounts
// const BULK_TIERS = [
//   { threshold: 1000, code: 'BULK1000', discountValue: 0.10, discountType: 'fixed_amount' },
//   { threshold: 500, code: 'BULK500', discountValue: 0.08, discountType: 'fixed_amount' },
//   { threshold: 250, code: 'BULK250', discountValue: 0.05, discountType: 'fixed_amount' },
//   { threshold: 99, code: 'BULK99', discountValue: 0.02, discountType: 'fixed_amount' },
// ];

async function deleteExistingDiscount(adminApiToken, store, code) {
    const baseUrl = `https://${store}/admin/api/2024-01`;

    try {
        // First, find the price rule by searching for discount codes
        const searchResponse = await fetch(
            `${baseUrl}/price_rules.json?limit=250`,
            {
                headers: {
                    'X-Shopify-Access-Token': adminApiToken,
                },
            }
        );

        if (!searchResponse.ok) {
            return; // If we can't search, just try to create (will fail if exists)
        }

        const searchData = await searchResponse.json();
        const priceRules = searchData.price_rules || [];

        // Find ALL price rules that have a discount code matching our code
        const priceRulesToDelete = [];

        for (const priceRule of priceRules) {
            const discountCodesResponse = await fetch(
                `${baseUrl}/price_rules/${priceRule.id}/discount_codes.json`,
                {
                    headers: {
                        'X-Shopify-Access-Token': adminApiToken,
                    },
                }
            );

            if (discountCodesResponse.ok) {
                const discountCodesData = await discountCodesResponse.json();
                const discountCodes = discountCodesData.discount_codes || [];

                // Check if this price rule has our discount code
                const matchingCode = discountCodes.find(dc => dc.code === code);
                if (matchingCode) {
                    priceRulesToDelete.push({ priceRuleId: priceRule.id, discountCodeId: matchingCode.id });
                }
            }
        }

        // Delete all matching discount codes and price rules
        for (const { priceRuleId, discountCodeId } of priceRulesToDelete) {
            // Delete the discount code first
            await fetch(
                `${baseUrl}/price_rules/${priceRuleId}/discount_codes/${discountCodeId}.json`,
                {
                    method: 'DELETE',
                    headers: {
                        'X-Shopify-Access-Token': adminApiToken,
                    },
                }
            );

            // Delete the price rule
            await fetch(
                `${baseUrl}/price_rules/${priceRuleId}.json`,
                {
                    method: 'DELETE',
                    headers: {
                        'X-Shopify-Access-Token': adminApiToken,
                    },
                }
            );
        }

        if (priceRulesToDelete.length > 0) {
            console.log(`  ✓ Deleted ${priceRulesToDelete.length} existing ${code} discount(s)`);
        }
    } catch (error) {
        // Silently fail - we'll try to create anyway
        console.log(`  Note: Could not delete existing ${code} (may not exist)`);
    }
}

async function createBulkDiscount(adminApiToken, store, tier) {
    const baseUrl = `https://${store}/admin/api/2024-01`;

    // Step 0: Delete existing discount if it exists
    await deleteExistingDiscount(adminApiToken, store, tier.code);

    // Step 1: Create a price rule (automatic discount)
    const priceRuleData = {
        price_rule: {
            title: `Bulk Discount ${tier.code} - $${tier.threshold}+`,
            target_type: 'line_item',
            target_selection: 'all',
            allocation_method: 'across',
            value_type: tier.discountType === 'fixed_amount' ? 'fixed_amount' : 'percentage',
            value: tier.discountType === 'fixed_amount'
                ? `-${tier.discountValue}`
                : `-${tier.discountValue}`, // Percentage value (e.g., -1.52 for 1.52% off)
            customer_selection: 'all',
            starts_at: new Date().toISOString(),
            usage_limit: null,
            prerequisite_subtotal_range: {
                greater_than_or_equal_to: tier.threshold.toString(),
            },
            prerequisite_quantity_range: null,
            prerequisite_shipping_price_range: null,
            entitled_product_ids: [],
            entitled_variant_ids: [],
            entitled_collection_ids: [],
            entitled_country_ids: [],
            prerequisite_product_ids: [],
            prerequisite_variant_ids: [],
            prerequisite_collection_ids: [],
            prerequisite_customer_ids: [],
        },
    };

    try {
        console.log(`\nCreating price rule for ${tier.code}...`);

        const priceRuleResponse = await fetch(`${baseUrl}/price_rules.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': adminApiToken,
            },
            body: JSON.stringify(priceRuleData),
        });

        if (!priceRuleResponse.ok) {
            const errorText = await priceRuleResponse.text();
            throw new Error(`Failed to create price rule: ${priceRuleResponse.status} ${errorText}`);
        }

        const priceRuleResult = await priceRuleResponse.json();
        const priceRuleId = priceRuleResult.price_rule?.id;

        if (!priceRuleId) {
            throw new Error('Price rule created but no ID returned');
        }

        console.log(`✓ Price rule created with ID: ${priceRuleId}`);

        // Step 2: Create discount code for the price rule
        const discountCodeData = {
            discount_code: {
                code: tier.code,
            },
        };

        console.log(`Creating discount code ${tier.code}...`);

        const discountCodeResponse = await fetch(
            `${baseUrl}/price_rules/${priceRuleId}/discount_codes.json`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': adminApiToken,
                },
                body: JSON.stringify(discountCodeData),
            }
        );

        if (!discountCodeResponse.ok) {
            const errorText = await discountCodeResponse.text();
            throw new Error(
                `Failed to create discount code: ${discountCodeResponse.status} ${errorText}`
            );
        }

        const discountCodeResult = await discountCodeResponse.json();
        console.log(`✓ Discount code ${tier.code} created successfully`);

        return {
            priceRuleId,
            discountCode: discountCodeResult.discount_code,
        };
    } catch (error) {
        console.error(`Error creating discount for ${tier.code}:`, error.message);
        throw error;
    }
}

async function main() {
    const adminApiToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
    const store = process.env.SHOPIFY_STORE;

    if (!adminApiToken) {
        console.error('Error: SHOPIFY_ADMIN_API_TOKEN environment variable is required');
        console.error('\nUsage:');
        console.error('  SHOPIFY_ADMIN_API_TOKEN=your_token SHOPIFY_STORE=your-store.myshopify.com node scripts/create-bulk-discounts.js');
        process.exit(1);
    }

    if (!store) {
        console.error('Error: SHOPIFY_STORE environment variable is required');
        console.error('Example: your-store.myshopify.com');
        process.exit(1);
    }

    // Remove 'https://' and trailing slashes if present
    const cleanStore = store.replace(/^https?:\/\//, '').replace(/\/$/, '');

    console.log(`Creating bulk discount codes for store: ${cleanStore}`);
    console.log('Tiers to create:', BULK_TIERS.map(t => `${t.code} (${t.threshold}+)`).join(', '));

    const results = [];
    const errors = [];

    for (const tier of BULK_TIERS) {
        try {
            const result = await createBulkDiscount(adminApiToken, cleanStore, tier);
            results.push({ tier, result });
        } catch (error) {
            errors.push({ tier, error: error.message });
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));

    if (results.length > 0) {
        console.log(`\n✓ Successfully created ${results.length} discount(s):`);
        results.forEach(({ tier }) => {
            console.log(`  - ${tier.code} (applies at $${tier.threshold}+)`);
        });
    }

    if (errors.length > 0) {
        console.log(`\n✗ Failed to create ${errors.length} discount(s):`);
        errors.forEach(({ tier, error }) => {
            console.log(`  - ${tier.code}: ${error}`);
        });
    }

    console.log('\n' + '='.repeat(50));
    console.log('IMPORTANT: Verify in Shopify Admin');
    console.log('='.repeat(50));
    console.log('1. Go to Shopify Admin → Discounts');
    console.log('2. Verify all discount codes are created');
    console.log('3. Check that minimum purchase amounts are correct');
    console.log('4. Ensure discount amounts match your pricing tiers');
    console.log('\nNote: You may need to adjust discount values in this script');
    console.log('      to match your actual price reductions.');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

