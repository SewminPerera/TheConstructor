// 05_api_contract.cy.js
// SYS-05  API-level contract tests hitting the Flask backend directly.
// Verifies that protected endpoints require a JWT and reject missing tokens.
describe("SYS-05  Backend API contract", () => {
  const API = Cypress.env("API_URL");

  it("/auth/register responds with 400 when body is empty", () => {
    cy.request({
      method: "POST",
      url: `${API}/auth/register`,
      failOnStatusCode: false,
      body: {},
    }).its("status").should("be.oneOf", [400, 422]);
  });

  it("/analyze rejects requests with no JWT (401 Unauthorized)", () => {
    cy.request({
      method: "POST",
      url: `${API}/analyze`,
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
      expect(JSON.stringify(res.body).toLowerCase())
        .to.match(/missing|authorization|unauthorized/);
    });
  });

  it("/projects rejects requests with no JWT (401 Unauthorized)", () => {
    cy.request({
      method: "GET",
      url: `${API}/projects`,
      failOnStatusCode: false,
    }).its("status").should("eq", 401);
  });

  it("/auth/login with bad credentials returns 401", () => {
    cy.request({
      method: "POST",
      url: `${API}/auth/login`,
      failOnStatusCode: false,
      body: { email: "nobody@nowhere.test", password: "wrong" },
    }).its("status").should("be.oneOf", [400, 401]);
  });

  it("/projects returns a JSON list when called with a valid JWT", () => {
    cy.ensureTestUser();
    cy.request("POST", `${API}/auth/login`, {
      email: Cypress.env("TEST_EMAIL"),
      password: Cypress.env("TEST_PASSWORD"),
    }).then((login) => {
      cy.request({
        method: "GET",
        url: `${API}/projects`,
        headers: { Authorization: `Bearer ${login.body.token}` },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.have.property("projects");
        expect(res.body.projects).to.be.an("array");
      });
    });
  });
});
