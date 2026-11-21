import { jest } from "@jest/globals";
import type { Pool, PoolConnection } from "mysql2/promise";
import type { GameRepository } from "@modules/game/game.repository.js";
import type { CacheService } from "@shared/cache/cache.service.js";
import type { GameResponseDTO } from "@modules/game/dto/game.output.dto.js";
import type {
  CreateGameDTO,
  GetGamesPaginatedDTO,
  UpdateGameDTO,
} from "@modules/game/dto/game.input.dto.js";
import {
  GAME_DETAIL_TTL,
  GAME_LIST_PREFIX,
  GAME_LIST_TTL,
  gameIdKey,
  gameListKey,
} from "@modules/game/game.cache.js";

jest.unstable_mockModule("@modules/game/game.validator.js", () => ({
  validateGame: jest.fn(),
}));

const { GameService } = await import("./game.service.js");

/**
 * mocks do repository
 */
const mockFindById = jest.fn<(id_game: number) => Promise<GameResponseDTO | null>>();
const mockFindAllPaginated = jest.fn<(options: unknown) => Promise<GameResponseDTO[]>>();
const mockCount = jest.fn<(params: unknown) => Promise<number>>();
const mockCreate = jest.fn<(dto: unknown, connection: unknown) => Promise<number>>();
const mockUpdate = jest.fn<(dto: unknown, connection: unknown) => Promise<boolean>>();
const mockReplaceCategories = jest.fn<(id_game: number, categories: unknown, connection: unknown) => Promise<void>>();
const mockDelete = jest.fn<(id_game: number) => Promise<boolean>>();

const mockGameRepository = {
  findById: mockFindById,
  findAllPaginated: mockFindAllPaginated,
  count: mockCount,
  create: mockCreate,
  update: mockUpdate,
  replaceCategories: mockReplaceCategories,
  delete: mockDelete,
} as unknown as GameRepository;

// ---------- mocks do pool/transação ----------
const mockCommit = jest.fn<() => Promise<void>>();
const mockRollback = jest.fn<() => Promise<void>>();
const mockConnection = {
  beginTransaction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  commit: mockCommit,
  rollback: mockRollback,
  release: jest.fn<() => void>(),
} as unknown as PoolConnection;

const mockGetConnection = jest.fn<() => Promise<PoolConnection>>();
const mockPool = { getConnection: mockGetConnection } as unknown as Pool;

// ---------- mock do cache ----------
const mockCacheGet = jest.fn<(key: string) => Promise<unknown>>();
const mockCacheSet = jest.fn<(key: string, value: unknown, ttl: number) => Promise<void>>();
const mockCacheDel = jest.fn<(...keys: string[]) => Promise<void>>();
const mockCacheDelByPrefix = jest.fn<(prefix: string) => Promise<void>>();

const mockCacheService = {
  get: mockCacheGet,
  set: mockCacheSet,
  del: mockCacheDel,
  delByPrefix: mockCacheDelByPrefix,
} as unknown as CacheService;

const game = { id_game: 1, title: "Zelda" } as unknown as GameResponseDTO;
const baseQuery: GetGamesPaginatedDTO = { page: 1, limit: 8 };

describe("GameService - Cache", () => {
  const service = new GameService(mockGameRepository, mockPool, mockCacheService);

  beforeEach(() => {
    jest.clearAllMocks();

    // clearAllMocks não limpa implementações, os defaults são refeitos a cada teste
    mockCacheGet.mockResolvedValue(null); // padrão = MISS
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheDel.mockResolvedValue(undefined);
    mockCacheDelByPrefix.mockResolvedValue(undefined);

    mockFindById.mockResolvedValue(game);
    mockFindAllPaginated.mockResolvedValue([game]);
    mockCount.mockResolvedValue(1);
    mockCreate.mockResolvedValue(10);
    mockUpdate.mockResolvedValue(true);
    mockReplaceCategories.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(true);

    mockCommit.mockResolvedValue(undefined);
    mockRollback.mockResolvedValue(undefined);
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  describe("findById", () => {
    it("MISS: busca no repository e grava no cache com o TTL de detalhe", async () => {
      const result = await service.findById(1);

      expect(result).toEqual(game);
      expect(mockFindById).toHaveBeenCalledWith(1);
      expect(mockCacheSet).toHaveBeenCalledWith(gameIdKey(1), game, GAME_DETAIL_TTL);
    });

    it("HIT: devolve do cache sem tocar no repository nem regravar", async () => {
      mockCacheGet.mockResolvedValueOnce(game);

      const result = await service.findById(1);

      expect(result).toEqual(game);
      expect(mockCacheGet).toHaveBeenCalledWith(gameIdKey(1));
      expect(mockFindById).not.toHaveBeenCalled();
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it("não cacheia jogo inexistente", async () => {
      mockFindById.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
      expect(mockCacheSet).not.toHaveBeenCalled();
    });
  });

  describe("findAllPaginated", () => {
    it("MISS: busca no repository e grava no cache com o TTL de listagem", async () => {
      const result = await service.findAllPaginated(baseQuery);

      const expected = { data: [game], total: 1, page: 1, totalPages: 1 };
      expect(result).toEqual(expected);
      expect(mockFindAllPaginated).toHaveBeenCalledTimes(1);
      expect(mockCacheSet).toHaveBeenCalledWith(
        gameListKey(baseQuery, 1, 8),
        expected,
        GAME_LIST_TTL,
      );
    });

    it("HIT: devolve do cache sem consultar o MySQL", async () => {
      const cached = { data: [game], total: 1, page: 1, totalPages: 1 };
      mockCacheGet.mockResolvedValueOnce(cached);

      const result = await service.findAllPaginated(baseQuery);

      expect(result).toEqual(cached);
      expect(mockFindAllPaginated).not.toHaveBeenCalled();
      expect(mockCount).not.toHaveBeenCalled();
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it("listagem aleatória não passa pelo cache", async () => {
      await service.findAllPaginated({ ...baseQuery, random: true });

      expect(mockCacheGet).not.toHaveBeenCalled();
      expect(mockCacheSet).not.toHaveBeenCalled();
      expect(mockFindAllPaginated).toHaveBeenCalledTimes(1);
    });

    it("buscas diferentes usam chaves diferentes", async () => {
      await service.findAllPaginated({ ...baseQuery, category: "RPG" });
      await service.findAllPaginated({ ...baseQuery, category: "Ação" });

      const [firstKey] = mockCacheSet.mock.calls[0]!;
      const [secondKey] = mockCacheSet.mock.calls[1]!;
      expect(firstKey).not.toBe(secondKey);
    });
  });

  describe("gameListKey", () => {
    it("a mesma busca gera a mesma chave, independente da ordem dos campos", () => {
      const a = { page: 1, limit: 8, title: "zelda", category: "RPG" } as GetGamesPaginatedDTO;
      const b = { category: "RPG", title: "zelda", limit: 8, page: 1 } as GetGamesPaginatedDTO;

      expect(gameListKey(a, 1, 8)).toBe(gameListKey(b, 1, 8));
    });

    it("começa com o prefixo usado na invalidação", () => {
      expect(gameListKey(baseQuery, 1, 8).startsWith(GAME_LIST_PREFIX)).toBe(true);
    });

    it("admin e público têm chaves diferentes", () => {
      const publicKey = gameListKey(baseQuery, 1, 8);
      const adminKey = gameListKey({ ...baseQuery, admin: true }, 1, 8);

      expect(adminKey).not.toBe(publicKey);
    });

    it("ignora `active` quando não é admin (o service também ignora)", () => {
      const withActive = gameListKey({ ...baseQuery, active: true }, 1, 8);
      const without = gameListKey(baseQuery, 1, 8);

      expect(withActive).toBe(without);
    });

    it("páginas diferentes têm chaves diferentes", () => {
      expect(gameListKey(baseQuery, 1, 8)).not.toBe(gameListKey(baseQuery, 2, 8));
    });
  });

  describe("invalidação nas escritas", () => {
    const createPayload = { categories: [1] } as unknown as CreateGameDTO;
    const updatePayload = { id_game: 5, categories: [1] } as unknown as UpdateGameDTO;

    it("create: limpa as listagens, e só depois do commit", async () => {
      const id = await service.create(createPayload);

      expect(id).toBe(10);
      expect(mockCacheDelByPrefix).toHaveBeenCalledWith(GAME_LIST_PREFIX);
      expect(mockCacheDel).not.toHaveBeenCalled();
      expect(mockCommit.mock.invocationCallOrder[0]!).toBeLessThan(
        mockCacheDelByPrefix.mock.invocationCallOrder[0]!,
      );
    });

    it("create: não invalida se a escrita falhar", async () => {
      mockCreate.mockRejectedValue(new Error("falha no insert"));

      await expect(service.create(createPayload)).rejects.toThrow("falha no insert");

      expect(mockRollback).toHaveBeenCalledTimes(1);
      expect(mockCacheDelByPrefix).not.toHaveBeenCalled();
    });

    it("update: limpa o detalhe do jogo e as listagens", async () => {
      await service.update(updatePayload);

      expect(mockCacheDel).toHaveBeenCalledWith(gameIdKey(5));
      expect(mockCacheDelByPrefix).toHaveBeenCalledWith(GAME_LIST_PREFIX);
    });

    it("update: invalida mesmo quando o repository devolve false", async () => {
      mockUpdate.mockResolvedValue(false);

      const result = await service.update(updatePayload);

      expect(result).toBe(false);
      expect(mockCacheDel).toHaveBeenCalledWith(gameIdKey(5));
      expect(mockCacheDelByPrefix).toHaveBeenCalledWith(GAME_LIST_PREFIX);
    });

    it("update: não invalida se a escrita falhar", async () => {
      mockUpdate.mockRejectedValue(new Error("falha no update"));

      await expect(service.update(updatePayload)).rejects.toThrow("falha no update");

      expect(mockCacheDel).not.toHaveBeenCalled();
      expect(mockCacheDelByPrefix).not.toHaveBeenCalled();
    });

    it("delete: limpa o detalhe e as listagens quando deletou", async () => {
      const result = await service.delete(3);

      expect(result).toBe(true);
      expect(mockCacheDel).toHaveBeenCalledWith(gameIdKey(3));
      expect(mockCacheDelByPrefix).toHaveBeenCalledWith(GAME_LIST_PREFIX);
    });

    it("delete: não invalida se nada foi deletado", async () => {
      mockDelete.mockResolvedValue(false);

      const result = await service.delete(999);

      expect(result).toBe(false);
      expect(mockCacheDel).not.toHaveBeenCalled();
      expect(mockCacheDelByPrefix).not.toHaveBeenCalled();
    });
  });
});
