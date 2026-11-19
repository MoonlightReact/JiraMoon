import { Redis } from "ioredis";

export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  lazyConnect: true,        // só conecta no primeiro comando (suítes sem cache nunca conectam)
  enableOfflineQueue: false, // sem conexão pronta, o comando falha na hora ao inves de criar fila
  maxRetriesPerRequest: 1,  // comando falha rápido em vez de ficar preso na fila
  commandTimeout: 250, // nenhum comando espera mais q 250ms, nem com o Redis travado
  connectTimeout: 2000,
});

// sem listener de "error" o ioredis lança exceção não tratada e derruba o processo.
// o log é feito uma vez por queda para não inundar o console enquanto ele reconecta.
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

// sem fila offline, o primeiro comando não espera a conexão abrir, por isso ela é aberta já na
// inicialização. Em teste fica desligada. Se o Redis estiver fora do ar, o ioredis continua tentando
// reconectar em segundo plano e o listener de "error" acima registra o problema.
if (process.env.NODE_ENV !== "test") {
  redis.connect().catch(() => {});
}

/** Encerra a conexão (usado no teardown do Jest). Seguro se nunca conectou. */
export async function closeCache(): Promise<void> {
  if (redis.status === "ready") {
    await redis.quit();
  } else {
    redis.disconnect();
  }
}
