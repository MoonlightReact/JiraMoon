import request from "supertest";
import app from "../../servers/server.js";

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
});

let login = { email: "dominic@familia.com", password: "Familia123" };

describe("AuthController - Integração", () => {

  describe("POST /api/auth/login", () => {
    it("deve retornar JWT e status 200 para login válido", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send(login);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(typeof response.body.token).toBe("string");
    });

    it("deve retornar 401 para senha incorreta", async () => {
      login = { email: "dominic@familia.com", password: "Senha123Errada" };
      const response = await request(app)
        .post("/api/auth/login")
        .send(login);
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Email ou senha inválidos");
    });
  });
});
