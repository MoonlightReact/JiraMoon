import { jest } from "@jest/globals";

const mockRedisGet = jest.fn<(key: string) => Promise<string | null>>();
const mockRedisSet = jest.fn<(...args: unknown[]) => Promise<"OK">>();
const mockRedisDel = jest.fn<(...keys: string[]) => Promise<number>>();
const mockRedisScan = jest.fn<(...args: unknown[]) => Promise<[string, string[]]>>();

// O cliente Redis real nunca é usado aqui: só o contrato que o CacheService espera dele.
jest.unstable_mockModule("@shared/cache/redis.js", () => ({
  redis: {
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    scan: mockRedisScan,
  },
}));

const { CacheService } = await import("./cache.service.js");

describe("CacheService - Unitário", () => {
  const service = new CacheService(true); // true = cache ligado (em teste o padrão é desligado)

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue("OK");
    mockRedisDel.mockResolvedValue(1);
    mockRedisScan.mockResolvedValue(["0", []]);

    // o cacheService loga as falhas; silenciado para não poluir a saída do teste
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("get", () => {
    it("devolve o valor desserializado quando a chave existe (HIT)", async () => {
      mockRedisGet.mockResolvedValue('{"title":"Zelda"}');

      const result = await service.get<{ title: string }>("game:id:1");

      expect(result).toEqual({ title: "Zelda" });
      expect(mockRedisGet).toHaveBeenCalledWith("game:id:1");
    });

    it("devolve null quando a chave não existe (MISS)", async () => {
      expect(await service.get("game:id:1")).toBeNull();
    });

    it("devolve null se o Redis estiver fora do ar", async () => {
      mockRedisGet.mockRejectedValue(new Error("connection refused"));

      expect(await service.get("game:id:1")).toBeNull();
    });

    it("devolve null se o valor guardado não for JSON válido", async () => {
      mockRedisGet.mockResolvedValue("{quebrado");

      expect(await service.get("game:id:1")).toBeNull();
    });
  });

  describe("set", () => {
    it("grava o valor serializado com expiração (EX) em segundos", async () => {
      await service.set("game:id:1", { title: "Zelda" }, 300);

      expect(mockRedisSet).toHaveBeenCalledWith(
        "game:id:1",
        JSON.stringify({ title: "Zelda" }),
        "EX",
        300,
      );
    });

    it("não lança se o Redis falhar", async () => {
      mockRedisSet.mockRejectedValue(new Error("connection refused"));

      await expect(service.set("k", { a: 1 }, 60)).resolves.toBeUndefined();
    });
  });

  describe("del", () => {
    it("apaga as chaves informadas", async () => {
      await service.del("game:id:1", "game:id:2");

      expect(mockRedisDel).toHaveBeenCalledWith("game:id:1", "game:id:2");
    });

    it("não chama o Redis quando não há chaves", async () => {
      await service.del();

      expect(mockRedisDel).not.toHaveBeenCalled();
    });

    it("não lança se o Redis falhar", async () => {
      mockRedisDel.mockRejectedValue(new Error("connection refused"));

      await expect(service.del("k")).resolves.toBeUndefined();
    });
  });

  describe("delByPrefix", () => {
    it("varre com SCAN até o cursor voltar a 0 e apaga o que achou em cada lote", async () => {
      mockRedisScan
        .mockResolvedValueOnce(["5", ["game:list:a"]])
        .mockResolvedValueOnce(["0", ["game:list:b", "game:list:c"]]);

      await service.delByPrefix("game:list:");

      expect(mockRedisScan).toHaveBeenCalledTimes(2);
      expect(mockRedisScan).toHaveBeenNthCalledWith(1, "0", "MATCH", "game:list:*", "COUNT", 100);
      expect(mockRedisScan).toHaveBeenNthCalledWith(2, "5", "MATCH", "game:list:*", "COUNT", 100);
      expect(mockRedisDel).toHaveBeenNthCalledWith(1, "game:list:a");
      expect(mockRedisDel).toHaveBeenNthCalledWith(2, "game:list:b", "game:list:c");
    });

    it("não chama del quando não encontra chaves", async () => {
      await service.delByPrefix("game:list:");

      expect(mockRedisDel).not.toHaveBeenCalled();
    });

    it("não lança se o Redis falhar", async () => {
      mockRedisScan.mockRejectedValue(new Error("connection refused"));

      await expect(service.delByPrefix("game:list:")).resolves.toBeUndefined();
    });
  });

  describe("cache desligado (padrão em NODE_ENV=test)", () => {
    const disabled = new CacheService(false);

    it("get devolve null e nenhuma operação chega ao Redis", async () => {
      expect(await disabled.get("k")).toBeNull();
      await disabled.set("k", 1, 60);
      await disabled.del("k");
      await disabled.delByPrefix("game:list:");

      expect(mockRedisGet).not.toHaveBeenCalled();
      expect(mockRedisSet).not.toHaveBeenCalled();
      expect(mockRedisDel).not.toHaveBeenCalled();
      expect(mockRedisScan).not.toHaveBeenCalled();
    });
  });
});
