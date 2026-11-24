import { redis } from "@shared/cache/redis.js";

export class CacheService {

  // em teste o cache vira no-op: os testes de integração batem no MySQL real
  // e um cache real faria uma execução ler dados velhos de outra.
  constructor(private enabled: boolean = process.env.NODE_ENV !== "test") { }

  /** retorna o valor em cache ou null (MISS, cache desligado ou Redis fora do ar). */
  async get<CachedValue>(key: string): Promise<CachedValue | null> {
    if (!this.enabled) return null;

    const start = performance.now();
    try {
      const raw = await redis.get(key);
      const ms = (performance.now() - start).toFixed(2);

      if (raw === null) {
        console.log(`[Cache] MISS ${key} (${ms}ms)`);
        return null;
      }

      console.log(`[Cache] HIT ${key} (${ms}ms)`);
      return JSON.parse(raw) as CachedValue;
    } catch (err) {
      this.logFailure("get", key, err);
      return null;
    }
  }

  /** seta o valor no cache */
  async set<CachedValue>(key: string, value: CachedValue, ttlSeconds: number): Promise<void> {
    if (!this.enabled) return;
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
      this.logFailure("set", key, err);
    }
  }

  /** deleta chaves do cache */
  async del(...keys: string[]): Promise<void> {
    if (!this.enabled || keys.length === 0) return;
    try {
      await redis.del(...keys);
    } catch (err) {
      this.logFailure("del", keys.join(", "), err);
    }
  }

  /**
   * apaga todas as chaves que começam com o prefixo.
   * usa SCAN em vez de KEYS: KEYS bloqueia o redis inteiro enquanto varre.
   * o prefixo não pode conter os caracteres especiais de glob (* ? [ ]).
   */
  async delByPrefix(prefix: string): Promise<void> {
    if (!this.enabled) return;
    try {
      let cursor = "0";
      do {
        const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
        if (keys.length > 0) await redis.del(...keys);
        cursor = next;
      } while (cursor !== "0");
    } catch (err) {
      this.logFailure("delByPrefix", prefix, err);
    }
  }

  // falha do Redis nunca propaga, cache é otimização, não pode derrubar a API
  // nem desfazer uma escrita que já foi commitada no MySQL.
  private logFailure(operation: string, target: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Cache] falha em ${operation} (${target}): ${message}`);
  }
}
