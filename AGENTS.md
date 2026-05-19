# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a **Shopify Hydrogen** storefront (headless e-commerce) using React Router 7.9, Vite, and Mini-Oxygen (local Cloudflare Workers dev server). Single application, not a monorepo.

### Required Environment Variables

The app requires a `.env` file at the project root with these Shopify credentials:

| Variable | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | Yes | App throws on startup without it |
| `PUBLIC_STORE_DOMAIN` | Yes | e.g. `your-store.myshopify.com` |
| `PUBLIC_STOREFRONT_API_TOKEN` | Yes | Storefront API access token |
| `PUBLIC_STOREFRONT_ID` | Yes | Used for analytics |
| `PUBLIC_CHECKOUT_DOMAIN` | No | For analytics consent banner |

Without valid Shopify credentials, the dev server starts but pages return 500 errors (expected). The GraphiQL endpoint at `/graphiql` works regardless.

### Common Commands

See `package.json` scripts:

- **Dev server**: `npm run dev` (runs `shopify hydrogen dev --codegen` on port 3000)
- **Lint**: `npm run lint` (ESLint, exits with pre-existing errors in the codebase)
- **Build**: `npm run build` (production build with codegen)
- **GraphQL codegen**: `npm run codegen`

### Caveats

- There is no `tsconfig.json` file committed. ESLint reports a parsing error for `env.d.ts` due to this, but the build succeeds because Vite/React Router handle TS compilation internally.
- The codebase uses JSX (`.jsx`) with JSDoc type annotations rather than pure TypeScript (`.tsx`).
- Import rule: always use `react-router` imports, never `@remix-run/react` or `react-router-dom`. See `.cursor/rules/hydrogen-react-router.mdc`.
- The dev server uses Mini-Oxygen (Cloudflare Workers emulation), so `caches` API and other Workers APIs are available at runtime.
