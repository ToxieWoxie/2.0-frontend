// Syn/lib/db.web.ts
// On web, "./db" resolves back to this file and creates a cycle.
// Export from db.shared instead.
export * from "./db.shared";
export { default } from "./db.shared";
