// 04_navigation.cy.js
// SYS-04  Top nav links move between Dashboard, My Projects and Admin.
describe("SYS-04  Navigation", () => {
  before(() => cy.ensureTestUser());
  beforeEach(() => cy.visitAsUser("dashboard"));

  it("navigates to the My Projects page", () => {
    cy.contains("button, a", /My Projects/i).first().click();
    cy.contains(/No projects yet|project|saved/i, { timeout: 8000 })
      .should("exist");
  });

  it("returns to the dashboard from My Projects", () => {
    cy.contains("button, a", /My Projects/i).first().click();
    cy.contains("button, a", /Dashboard|New Project|Upload/i).first().click();
    cy.contains(/Upload Your Blueprint|Drop your blueprint/i)
      .should("be.visible");
  });

  it("persists the authenticated session across reload", () => {
    cy.reload();
    cy.window().its("localStorage.tc_token").should("exist");
    cy.contains(/Logout/i).should("be.visible");
  });
});
