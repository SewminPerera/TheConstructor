// cypress/support/commands.js
// Custom commands for TheConstructor E2E suite.

/**
 * Register the test user against the real backend.
 * Ignores the 400 "email already exists" response so tests stay idempotent.
 */
Cypress.Commands.add("ensureTestUser", () => {
  const api   = Cypress.env("API_URL");
  const name  = Cypress.env("TEST_NAME");
  const email = Cypress.env("TEST_EMAIL");
  const pwd   = Cypress.env("TEST_PASSWORD");

  return cy.request({
    method: "POST",
    url: `${api}/auth/register`,
    body: { name, email, password: pwd },
    failOnStatusCode: false,
  });
});

/**
 * Obtain a JWT via the real /auth/login endpoint and stash it in
 * localStorage under the same key the AuthContext uses (tc_token).
 */
Cypress.Commands.add("loginViaAPI", () => {
  const api   = Cypress.env("API_URL");
  const email = Cypress.env("TEST_EMAIL");
  const pwd   = Cypress.env("TEST_PASSWORD");

  return cy.request("POST", `${api}/auth/login`, { email, password: pwd })
    .then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property("token");
      window.localStorage.setItem("tc_token", res.body.token);
      return res.body;
    });
});

/** Visit the SPA as an already authenticated user. */
Cypress.Commands.add("visitAsUser", (page = "dashboard") => {
  cy.loginViaAPI().then(() => {
    window.sessionStorage.setItem("tc_page", page);
    cy.visit("/");
  });
});
