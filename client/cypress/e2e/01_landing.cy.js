// 01_landing.cy.js
// SYS-01  Landing page renders with hero, navigation, and working CTA.
const HERO_CTA = /Get Free Estimate|Go to Dashboard/i;

describe("SYS-01  Landing page", () => {
  beforeEach(() => {
    window.localStorage.removeItem("tc_token");
    cy.visit("/");
  });

  it("renders the hero headline", () => {
    cy.contains(/Foundation Cost/i).should("be.visible");
    cy.contains(/Estimated/i).should("be.visible");
  });

  it("shows the primary call to action", () => {
    cy.contains("button", HERO_CTA).should("be.visible");
    cy.contains("button", /See how it works/i).should("be.visible");
  });

  it("renders the How It Works three step section", () => {
    cy.contains(/How it works/i).should("exist");
    cy.contains(/Upload Blueprint/i).should("be.visible");
    cy.contains(/Set the Scale/i).should("be.visible");
    cy.contains(/Get Your Estimate/i).should("be.visible");
  });

  it("opens the login modal from the hero CTA", () => {
    cy.contains("button", HERO_CTA).first().click();
    // LoginModal is rendered with Login / Sign Up tabs and email/password fields
    cy.get('input[type="email"]', { timeout: 6000 }).should("be.visible");
    cy.get('input[type="password"]').should("be.visible");
    cy.contains(/Login|Sign Up/i).should("be.visible");
  });
});
