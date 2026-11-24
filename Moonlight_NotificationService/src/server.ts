import "dotenv/config";
import pool from './shared/config/database.js';
import { RedisEventBus } from './shared/events/redis-event-bus.js';
import { closeCache, redis } from "@shared/cache/redis.js";
import { NotificationService } from "@modules/notification/notification.service.js";
import { NotificationRepository } from "@modules/notification/notification.repository.js";
import type { Unsubscribe } from "@shared/events/event-bus.js";

const eventBus = new RedisEventBus(redis);
const notificationService = new NotificationService(new NotificationRepository());

let unsubscribe: Unsubscribe | undefined;

async function start(): Promise<void> {
  // Falha cedo: com o banco fora, o container cai e o Docker reinicia, em vez de ficar de pé e surdo.
  await pool.query("SELECT 1");

  unsubscribe = await eventBus.subscribe("order.paid", event => notificationService.handleOrderPaid(event));
  console.log("[NotificationService] pronto, assinando order.paid");
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[NotificationService] ${signal} recebido, encerrando`);
  try {
    await unsubscribe?.();
    await eventBus.close(); // fecha a conexão de subscribe
    await closeCache(); // fecha o cliente base do redis.ts (o bus não o fecha pois ele é cache e publisher)
    await pool.end();
  } catch (err) {
    console.error(`[NotificationService] erro ao encerrar: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

start().catch(err => {
  console.error(`[NotificationService] falha ao iniciar: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
