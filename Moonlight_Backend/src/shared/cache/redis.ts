import { Redis } from "ioredis";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: true,        // só conecta no primeiro comando (suítes sem cache nunca conectam)
  maxRetriesPerRequest: 1,  // comando falha rápido em vez de ficar preso na fila
  connectTimeout: 2000,
});

// Sem listener de "error" o ioredis lança exceção não tratada e derruba o processo.
// O log é feito uma vez por queda para não inundar o console enquanto ele reconecta.
let connectionErrorLogged = false;

redis.on("error", (err) => {
  if (connectionErrorLogged) return;
  connectionErrorLogged = true;
  console.error(`[Cache] Redis indisponível, seguindo sem cache: ${err.message}`);
});

redis.on("ready", () => {
  connectionErrorLogged = false;
  console.log("[Cache] Redis conectado");
});

/** Encerra a conexão (usado no teardown do Jest). Seguro se nunca conectou. */
export async function closeCache(): Promise<void> {
  if (redis.status === "ready") {
    await redis.quit();
  } else {
    redis.disconnect();
  }
}
