import request from "supertest";
import fs from "fs";
import path from "path";
import app from "../../servers/server.js";

let adminToken: string;
const createdFiles: string[] = [];

// Buffer mínimo válido para simular uma imagem nos testes
const fakeImageBuffer = Buffer.from("fake-image-binary-content");

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "dominic@familia.com", password: "Familia123" });
  adminToken = res.body.token;
});

afterAll(() => {
  for (const relativeUrl of createdFiles) {
    const filePath = path.join(process.cwd(), relativeUrl.replace(/^\//, ""));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

describe("Upload Controller", () => {
  describe("POST /api/uploads/:context", () => {
    it("Deve retornar status 401 quando enviado sem token", async () => {
      const res = await request(app)
        .post("/api/uploads/games")
        .attach("image", fakeImageBuffer, {
          filename: "capa.png",
          contentType: "image/png",
        });

      expect(res.statusCode).toBe(401);
    });

    it("Deve retornar status 400 quando nenhuma mídia for enviada", async () => {
      const res = await request(app)
        .post("/api/uploads/games")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Nenhuma midia foi enviada");
    });

    it("Deve retornar status 400 para contexto de upload inválido", async () => {
      const res = await request(app)
        .post("/api/uploads/contexto-invalido")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("image", fakeImageBuffer, {
          filename: "capa.png",
          contentType: "image/png",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Contexto de upload inválido");
    });

    it("Deve retornar status 400 para tipo de arquivo não permitido", async () => {
      const res = await request(app)
        .post("/api/uploads/games")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("image", Buffer.from("texto simples"), {
          filename: "documento.txt",
          contentType: "text/plain",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("Tipo de arquivo não permitido");
    });

    it("Deve retornar status 400 quando o nome do campo for diferente de 'image'", async () => {
      const res = await request(app)
        .post("/api/uploads/games")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", fakeImageBuffer, {
          filename: "capa.png",
          contentType: "image/png",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe(
        'Campo de arquivo inesperado. Use o campo "image"'
      );
    });

    it("Deve retornar status 400 quando o arquivo ultrapassar 5MB", async () => {
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);

      const res = await request(app)
        .post("/api/uploads/games")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("image", oversizedBuffer, {
          filename: "gigante.png",
          contentType: "image/png",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe(
        "Arquivo muito grande. Máximo permitido: 5MB"
      );
    });

    it("Deve fazer upload de uma imagem válida e retornar a URL pública", async () => {
      const res = await request(app)
        .post("/api/uploads/games")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("image", fakeImageBuffer, {
          filename: "banner-jogo.webp",
          contentType: "image/webp",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("url");
      expect(res.body.url).toMatch(/^\/uploads\/games\/[0-9a-f-]+\.webp$/);

      createdFiles.push(res.body.url);

      const savedFilePath = path.join(
        process.cwd(),
        res.body.url.replace(/^\//, "")
      );
      expect(fs.existsSync(savedFilePath)).toBe(true);
    });
  });
});
