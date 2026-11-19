// Benchmark do cache do catálogo: mede o tempo de MISS e de HIT de uma rota.
//
// Uso (com o backend rodando e o Redis no ar):
//   npm run bench:cache
//   npm run bench:cache -- --path "/api/games/1" --rounds 30
//
// Opções:
//   --path     rota a medir (padrão /api/games/1). Para a listagem, use a mesma URL que o front chama.
//   --rounds   quantas rodadas medir depois do aquecimento (padrão 20)
//   --pattern  padrão das chaves apagadas antes de cada MISS (padrão game:*)
//   --base     URL base da API (padrão http://localhost:3000 ou BENCH_BASE_URL)
import { parseArgs } from "node:util";
import dotenv from "dotenv";
import { Redis } from "ioredis";

dotenv.config({ quiet: true });

const { values } = parseArgs({
  options: {
    base: { type: "string", default: process.env.BENCH_BASE_URL ?? "http://localhost:3000" },
    path: { type: "string", default: "/api/games/1" },
    pattern: { type: "string", default: "game:*" },
    rounds: { type: "string", default: "20" },
  },
});

const rounds = Number(values.rounds);
const url = `${values.base}${values.path}`;
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
redis.on("error", () => {}); // o erro de conexão é tratado no ping abaixo

// Apaga as chaves do padrão com SCAN (o mesmo cuidado do CacheService: nada de KEYS).
async function clearCache() {
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", values.pattern, "COUNT", 100);
    if (keys.length > 0) await redis.del(...keys);
    cursor = next;
  } while (cursor !== "0");
}

async function countKeys() {
  let cursor = "0";
  let total = 0;
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", values.pattern, "COUNT", 100);
    total += keys.length;
    cursor = next;
  } while (cursor !== "0");
  return total;
}

// Mede a requisição inteira: envio, processamento no servidor e leitura do corpo.
async function timedGet() {
  const start = performance.now();
  const res = await fetch(url);
  await res.arrayBuffer();
  const elapsed = performance.now() - start;
  if (!res.ok) throw new Error(`GET ${url} respondeu ${res.status}`);
  return elapsed;
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (p) => sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return { min: sorted[0], mediana: pick(50), p95: pick(95), media: mean, max: sorted.at(-1) };
}

const fmt = (ms) => `${ms.toFixed(2)} ms`;

async function main() {
  try {
    await redis.ping();
  } catch {
    console.error(`Redis inacessível em ${redisUrl}.`);
    console.error("Rodando no host (fora do Docker), o REDIS_URL do .env do backend deve ser redis://localhost:6379.");
    process.exit(1);
  }

  // Aquecimento: abre as conexões (HTTP, MySQL, Redis) para não medir o custo da primeira requisição.
  for (let i = 0; i < 3; i++) {
    await clearCache();
    await timedGet();
    await timedGet();
  }

  const misses = [];
  const hits = [];
  let keysAfterMiss = null;

  for (let i = 0; i < rounds; i++) {
    await clearCache();                    // garante um MISS de verdade
    misses.push(await timedGet());         // MISS: vai ao MySQL e grava no Redis
    if (keysAfterMiss === null) keysAfterMiss = await countKeys();
    hits.push(await timedGet());           // HIT: responde do Redis
  }

  if (keysAfterMiss === 0) {
    console.warn("\nAtenção: nenhuma chave foi criada no Redis depois do MISS.");
    console.warn("O cache pode estar desligado (NODE_ENV=test?) ou essa rota não é cacheada.");
  }

  const miss = stats(misses);
  const hit = stats(hits);

  console.log(`\nRota: ${url}`);
  console.log(`Rodadas: ${rounds} (depois do aquecimento)\n`);
  console.table({
    "mínimo": { MISS: fmt(miss.min), HIT: fmt(hit.min) },
    "mediana": { MISS: fmt(miss.mediana), HIT: fmt(hit.mediana) },
    "p95": { MISS: fmt(miss.p95), HIT: fmt(hit.p95) },
    "média": { MISS: fmt(miss.media), HIT: fmt(hit.media) },
    "máximo": { MISS: fmt(miss.max), HIT: fmt(hit.max) },
  });

  const ratio = miss.mediana / hit.mediana;
  console.log(
    `Mediana: MISS ${fmt(miss.mediana)} -> HIT ${fmt(hit.mediana)} ` +
      `(${ratio.toFixed(1)}x mais rápido, ${fmt(miss.mediana - hit.mediana)} a menos por requisição)\n`,
  );
}

main()
  .catch((err) => {
    const cause = err.cause?.code ? ` (${err.cause.code})` : "";
    console.error(`${err.message}${cause}. O backend está rodando em ${values.base}?`);
    process.exitCode = 1;
  })
  .finally(() => redis.quit());
