// cypress/support/e2e.js
// Global support file — loaded before every spec.
import "./commands";

// Swallow benign ResizeObserver and AbortController noise from React 18
Cypress.on("uncaught:exception", (err) => {
  if (/ResizeObserver|AbortError/.test(err.message)) return false;
  return true;
});
