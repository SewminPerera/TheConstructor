// cypress.config.js
// ---------------------------------------------------------------------------
// Cypress end to end configuration for TheConstructor.
// Run the Vite dev server (`npm run dev`) and the Flask backend
// (`python app.py`) before launching Cypress.
// ---------------------------------------------------------------------------
const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl:   "http://localhost:5173",
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
    viewportWidth:  1366,
    viewportHeight: 768,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    env: {
      API_URL:       "http://127.0.0.1:8000",
      TEST_EMAIL:    "cypress_user@example.com",
      TEST_PASSWORD: "Cypress123!",
      TEST_NAME:     "Cypress Test User",
    },
  },
});
