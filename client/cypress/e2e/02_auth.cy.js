// 02_auth.cy.js
// SYS-02  Registration, login, invalid login, logout (real backend).
const HERO_CTA = /Get Free Estimate|Go to Dashboard/i;

describe("SYS-02  Authentication", () => {
  before(() => cy.ensureTestUser());

  beforeEach(() => {
    window.localStorage.removeItem("tc_token");
    window.sessionStorage.removeItem("tc_page");
    cy.visit("/");
  });

  it("rejects an unknown email with a visible error", () => {
    cy.contains("button", HERO_CTA).first().click();
    cy.get('input[type="email"]').type("noone@nowhere.test");
    cy.get('input[type="password"]').type("wrongpassword");
    cy.contains("button", /Login to Dashboard/i).click();
    cy.contains(/invalid|incorrect|not found|wrong|failed|error/i, { timeout: 8000 })
      .should("be.visible");
    cy.window().its("localStorage.tc_token").should("be.undefined");
  });

  it("logs in with valid credentials and stores a JWT", () => {
    cy.contains("button", HERO_CTA).first().click();
    cy.get('input[type="email"]').type(Cypress.env("TEST_EMAIL"));
    cy.get('input[type="password"]').type(Cypress.env("TEST_PASSWORD"));
    cy.contains("button", /Login to Dashboard/i).click();

    cy.window({ timeout: 10000 })
      .its("localStorage.tc_token")
      .should("exist");

    // The landing-page navbar swaps "Get Started" for "Go to Dashboard"
    // once the AuthContext picks up the new token.
    cy.contains("button", /Go to Dashboard/i, { timeout: 10000 })
      .should("be.visible");
  });

  it("logs the user out and clears the token", () => {
    // Land directly on the dashboard (where the Logout button lives).
    cy.loginViaAPI().then(() => {
      window.sessionStorage.setItem("tc_page", "dashboard");
    });
    cy.visit("/");

    cy.contains("button", /Logout/i, { timeout: 10000 }).click();
    cy.window().its("localStorage.tc_token").should("not.exist");
    cy.contains(HERO_CTA).should("be.visible");
  });
});
