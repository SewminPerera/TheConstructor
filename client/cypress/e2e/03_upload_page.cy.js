// 03_upload_page.cy.js
// SYS-03  Authenticated user sees the blueprint upload page and its controls.
describe("SYS-03  Upload page", () => {
  before(() => cy.ensureTestUser());
  beforeEach(() => cy.visitAsUser("dashboard"));

  it("shows the drag and drop upload zone", () => {
    cy.contains(/Upload Your Blueprint|Drop your blueprint/i)
      .should("be.visible");
    cy.contains("button", /Choose File/i).should("be.visible");
    cy.contains(/JPG|PNG|PDF|DXF/i).should("be.visible");
  });

  it("lists the four feature cards", () => {
    cy.contains(/AI Vision/i).should("be.visible");
    cy.contains(/DXF Precision/i).should("be.visible");
    cy.contains(/PDF Support/i).should("be.visible");
    cy.contains(/LKR Pricing/i).should("be.visible");
  });

  it("shows the tips-for-better-results panel", () => {
    cy.contains(/Tips for better results/i).should("be.visible");
    cy.contains(/Use DXF for highest accuracy/i).should("be.visible");
    cy.contains(/Upload clear JPEG or PNG/i).should("be.visible");
  });
});
