import request from "supertest";
import app from "../../servers/server.js";

let adminToken: string;
let createdUserId: number;

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
});

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'dominic@familia.com', password: 'Familia123' });
  adminToken = res.body.token;
});

const login = { email: "dominic@familia.com", password: "Familia123" };

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
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "juizei@gmail.com", password: "Senha123Errada" });
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Email ou senha inválidos");
    });
  });
});
