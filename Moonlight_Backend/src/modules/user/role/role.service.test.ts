import { jest } from "@jest/globals";
import type { PoolConnection } from "mysql2/promise";
import type { RoleRepository } from "@modules/user/role/role.repository.js";
import type { UserRoleRepository } from "@modules/user/role/user-role.repository.js";
import type { UserRepository } from "@modules/user/user.repository.js";
import type { Role } from "@modules/user/role/role.repository.types.js";

const mockGetConnection = jest.fn<() => Promise<PoolConnection>>();

// O RoleService importa o pool direto (não recebe por construtor),
// então o módulo do banco inteiro precisa ser mockado antes do import dinâmico.
jest.unstable_mockModule("@shared/config/database.js", () => ({
  default: { getConnection: mockGetConnection },
}));

const { RoleService } = await import("./role.service.js");

const mockFindAll = jest.fn<() => Promise<Role[]>>();
const mockReplaceAll =
  jest.fn<
    (id_user: number, id_roles: number[], connection: PoolConnection) => Promise<void>
  >();
const mockIncrementRoleVersion =
  jest.fn<(id_user: number, connection: PoolConnection) => Promise<void>>();

const mockRoleRepository = {
  findAll: mockFindAll,
} as unknown as RoleRepository;

const mockUserRoleRepository = {
  replaceAll: mockReplaceAll,
} as unknown as UserRoleRepository;

const mockUserRepository = {
  incrementRoleVersion: mockIncrementRoleVersion,
} as unknown as UserRepository;

function createMockConnection() {
  return {
    beginTransaction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    commit: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    rollback: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    release: jest.fn<() => void>(),
  };
}

describe("RoleService - Unitário", () => {
  const service = new RoleService(
    mockRoleRepository,
    mockUserRoleRepository,
    mockUserRepository,
  );

  let connection: ReturnType<typeof createMockConnection>;
  let externalConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    jest.clearAllMocks();

    // clearAllMocks não limpa implementações, então os defaults são refeitos a cada teste
    mockReplaceAll.mockResolvedValue(undefined);
    mockIncrementRoleVersion.mockResolvedValue(undefined);

    connection = createMockConnection();
    externalConnection = createMockConnection();
    mockGetConnection.mockResolvedValue(connection as unknown as PoolConnection);
  });

  describe("findAll", () => {
    it("deve retornar a lista de roles do repositório", async () => {
      const roles: Role[] = [
        { id_role: 1, name: "admin" },
        { id_role: 2, name: "customer" },
      ];
      mockFindAll.mockResolvedValue(roles);

      const result = await service.findAll();

      expect(result).toEqual(roles);
      expect(mockFindAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("syncUserRoles (sem conexão externa)", () => {
    it("deve abrir transação, substituir roles, incrementar versão e commitar", async () => {
      await service.syncUserRoles(1, [1, 2]);

      expect(mockGetConnection).toHaveBeenCalledTimes(1);
      expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockReplaceAll).toHaveBeenCalledWith(1, [1, 2], connection);
      expect(mockIncrementRoleVersion).toHaveBeenCalledWith(1, connection);
      expect(connection.commit).toHaveBeenCalledTimes(1);
    });

    it("deve liberar a conexão e não fazer rollback em caso de sucesso", async () => {
      await service.syncUserRoles(1, [2]);

      expect(connection.release).toHaveBeenCalledTimes(1);
      expect(connection.rollback).not.toHaveBeenCalled();
    });

    it("deve fazer rollback, liberar a conexão e relançar o erro se replaceAll falhar", async () => {
      mockReplaceAll.mockRejectedValue(new Error("falha no replaceAll"));

      await expect(service.syncUserRoles(1, [2])).rejects.toThrow(
        "falha no replaceAll",
      );

      expect(connection.rollback).toHaveBeenCalledTimes(1);
      expect(connection.release).toHaveBeenCalledTimes(1);
      expect(connection.commit).not.toHaveBeenCalled();
    });

    it("não deve incrementar a versão se replaceAll falhar", async () => {
      mockReplaceAll.mockRejectedValue(new Error("falha no replaceAll"));

      await expect(service.syncUserRoles(1, [2])).rejects.toThrow();

      expect(mockIncrementRoleVersion).not.toHaveBeenCalled();
    });

    it("deve fazer rollback se incrementRoleVersion falhar", async () => {
      mockIncrementRoleVersion.mockRejectedValue(new Error("falha na versão"));

      await expect(service.syncUserRoles(1, [2])).rejects.toThrow(
        "falha na versão",
      );

      expect(connection.rollback).toHaveBeenCalledTimes(1);
      expect(connection.commit).not.toHaveBeenCalled();
    });
  });

  describe("syncUserRoles (com conexão externa)", () => {
    it("deve usar a conexão recebida sem abrir outra nem controlar a transação", async () => {
      await service.syncUserRoles(
        1,
        [2],
        externalConnection as unknown as PoolConnection,
      );

      expect(mockGetConnection).not.toHaveBeenCalled();
      expect(externalConnection.beginTransaction).not.toHaveBeenCalled();
      expect(externalConnection.commit).not.toHaveBeenCalled();
      expect(externalConnection.release).not.toHaveBeenCalled();
      expect(mockReplaceAll).toHaveBeenCalledWith(1, [2], externalConnection);
      expect(mockIncrementRoleVersion).toHaveBeenCalledWith(1, externalConnection);
    });

    it("deve relançar o erro sem rollback nem release (quem abriu a conexão cuida disso)", async () => {
      mockReplaceAll.mockRejectedValue(new Error("falha no replaceAll"));

      await expect(
        service.syncUserRoles(
          1,
          [2],
          externalConnection as unknown as PoolConnection,
        ),
      ).rejects.toThrow("falha no replaceAll");

      expect(externalConnection.rollback).not.toHaveBeenCalled();
      expect(externalConnection.release).not.toHaveBeenCalled();
    });
  });
});
