/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEAD_AUDIT_REVIEWER_NAME?: string;
  readonly VITE_LEAD_AUDIT_REVIEWER_TITLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
