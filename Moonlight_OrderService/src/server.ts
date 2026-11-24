// Primeiro import de propósito: pool e redis leem process.env ao serem importados.
import "dotenv/config";

import express, { type NextFunction, type Request, type Response } from "express";
import type { Server } from "node:http";
import pool from "@shared/config/database.js";
import { redis, closeCache } from "@shared/cache/redis.js";
import { RedisEventBus } from "@shared/events/redis-event-bus.js";
import { OrderRepository } from "@modules/order/order.repository.js";
import { OrderService } from "@modules/order/order.service.js";
import { OrderController } from "@modules/order/order.controller.js";
import { createOrderRoutes } from "@modules/order/order.routes.js";
import { AppError } from "@shared/errors/AppError.js";

// Montagem: cada peça é criada uma vez, aqui. O Order só PUBLICA eventos (não assina nenhum).
const eventBus = new RedisEventBus(redis);
const orderService = new OrderService(new OrderRepository(), eventBus);
const orderController = new OrderController(orderService);

const app = express();
app.use(express.json());

// Dois caminhos de health: /health para o Docker e /orders/health para aparecer pelo gateway (/orders).
const health = async (_req: Request, res: Response): Promise<void> => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "db_unavailable" });
  }
};
app.get("/health", health);
app.get("/orders/health", health);

app.use("/orders", createOrderRoutes(orderController));

// Erro previsto (AppError) vira resposta com o status dele; qualquer outro vira 500 sem vazar detalhes.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message, code: err.code });
    return;
  }
  console.error(`[OrderService] erro inesperado: ${err instanceof Error ? err.message : String(err)}`);
  res.status(500).json({ message: "Erro interno do servidor." });
});

let server: Server | undefined;

async function start(): Promise<void> {
  // Falha cedo: com o banco fora, o container cai e o Docker reinicia.
  await pool.query("SELECT 1");

  const port = Number(process.env.PORT) || 3000;
  server = app.listen(port, () => console.log(`[OrderService] pronto na porta ${port}`));
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[OrderService] ${signal} recebido, encerrando`);
  try {
    server?.close();
    await eventBus.close(); // fecha a conexão de assinatura (que aqui nunca chegou a abrir)
    await closeCache(); // fecha o cliente base do redis.ts, usado para publicar
    await pool.end();
  } catch (err) {
    console.error(`[OrderService] erro ao encerrar: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

start().catch(err => {
  console.error(`[OrderService] falha ao iniciar: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
