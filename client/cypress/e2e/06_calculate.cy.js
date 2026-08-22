// 06_calculate.cy.js
// SYS-06  Deterministic calculator endpoint — verifies that quantities scale
// monotonically with wall length and that soil type changes affect concrete.
describe("SYS-06  /calculate business logic", () => {
  const API = Cypress.env("API_URL");
  let token;

  before(() => {
    cy.ensureTestUser();
    cy.request("POST", `${API}/auth/login`, {
      email:    Cypress.env("TEST_EMAIL"),
      password: Cypress.env("TEST_PASSWORD"),
    }).then((res) => {
      token = res.body.token;
    });
  });

  const call = (wall_length_m, overrides = {}) =>
    cy.request({
      method: "POST",
      url: `${API}/calculate`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        wall_length_m,
        door_count: 4,
        window_count: 6,
        wall_thickness: 9,
        cement_brand: "generic",
        soil_type: "normal",
        wastage_pct: 10,
        plinth_height: 0.45,
        wall_height: 3.0,
        number_of_floors: 1,
        floor_area: 80,
        ...overrides,
      },
    });

  it("returns a successful quotation for a sane wall length", () => {
    call(50).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property("quotation");
      expect(res.body.quotation).to.have.property("quantities");
      expect(res.body.quotation.quantities.cement_bags).to.be.greaterThan(0);
      expect(res.body.quotation.quantities.concrete_m3).to.be.greaterThan(0);
    });
  });

  it("cement quantity increases with wall length (monotonic)", () => {
    call(25).then((a) => {
      call(100).then((b) => {
        expect(b.body.quotation.quantities.cement_bags)
          .to.be.greaterThan(a.body.quotation.quantities.cement_bags);
      });
    });
  });

  it("soft clay needs more concrete than hard rock (soil multipliers)", () => {
    call(50, { soil_type: "hard_rock" }).then((rock) => {
      call(50, { soil_type: "soft_clay" }).then((clay) => {
        expect(clay.body.quotation.quantities.concrete_m3)
          .to.be.greaterThan(rock.body.quotation.quantities.concrete_m3);
      });
    });
  });
});
