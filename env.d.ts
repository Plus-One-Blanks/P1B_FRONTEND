/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

interface ImportMetaEnv {
  readonly PUBLIC_DESIGN_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
