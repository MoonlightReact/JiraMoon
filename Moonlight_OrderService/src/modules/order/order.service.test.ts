import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { OrderService } from "./order.service.js";
import { OrderRepository } from "./order.repository.js";
import type { CreateOrderDTO, Order, OrderStatus } from "./order.types.js";
import type { EventBus } from "@shared/events/event-bus.js";

const mockCreate = jest.fn<(dto: CreateOrderDTO) => Promise<number>>();
const mockUpdateStatus = jest.fn<(ref: string, status: OrderStatus) => Promise<boolean>>();
const mockExists = jest.fn<(ref: string) => Promise<boolean>>();
const mockFindByRef = jest.fn<(ref: string) => Promise<Order | null>>();
const mockPublish = jest.fn<(name: string, payload: unknown) => Promise<string>>();

const repository = {
  create: mockCreate,
  updateStatus: mockUpdateStatus,
  existsByExternalReference: mockExists,
  findByExternalReference: mockFindByRef,
} as unknown as OrderRepository;

const eventBus = { publish: mockPublish, subscribe: jest.fn(), close: jest.fn() } as unknown as EventBus;

const validDto: CreateOrderDTO = {
  id_user: 7,
  customer: { name: "João", email: "joao@email.com" },
  preference_id: "pref_1",
  external_reference: "order_123",
  total: 89.98,
  items: [
    { id_game: 1, title: "Jogo A", image: null, price: 59.99 },
    { id_game: 2, title: "Jogo B", image: null, price: 29.99 },
  ],
};

// o e-mail do banco é DIFERENTE do da requisição de propósito: prova de onde o payload do order.paid sai
const storedOrder: Order = {
  id_order: 5,
  id_user: 7,
  status: "approved",
  total: 89.98,
  preference_id: "pref_1",
  external_reference: "order_123",
  customer_name: "João do Banco",
  customer_email: "do-banco@email.com",
  created_at: new Date(),
  items: [{ id_game: 1, title: "Jogo A", image: null, price: 89.98 }],
};

describe("OrderService - Unitário", () => {
  const service = new OrderService(repository, eventBus);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    mockCreate.mockResolvedValue(5);
    mockUpdateStatus.mockResolvedValue(true);
    mockExists.mockResolvedValue(true);
    mockFindByRef.mockResolvedValue(storedOrder);
    mockPublish.mockResolvedValue("id-envelope");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("create", () => {
    it("grava o pedido e publica order.created depois", async () => {
      const result = await service.create(validDto);

      expect(result).toEqual({ id_order: 5 });
      expect(mockCreate).toHaveBeenCalledWith(validDto);
      expect(mockPublish).toHaveBeenCalledWith("order.created", {
        id_order: 5,
        id_user: 7,
        total: 89.98,
        external_reference: "order_123",
        customer: { name: "João", email: "joao@email.com" }
      });
      expect(mockCreate.mock.invocationCallOrder[0]!).toBeLessThan(mockPublish.mock.invocationCallOrder[0]!);
    });

    it("recusa total que não bate com a soma dos itens, sem gravar nem publicar", async () => {
      await expect(service.create({ ...validDto, total: 0.01 })).rejects.toMatchObject({ statusCode: 400 });

      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("recusa pedido sem itens", async () => {
      await expect(service.create({ ...validDto, items: [] })).rejects.toMatchObject({ statusCode: 400 });
    });

    it("devolve 409 quando a external_reference já existe, sem publicar", async () => {
      mockCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" }));

      await expect(service.create(validDto)).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("falha ao publicar não desfaz nem derruba a criação do pedido", async () => {
      mockPublish.mockRejectedValue(new Error("redis fora"));

      await expect(service.create(validDto)).resolves.toEqual({ id_order: 5 });
    });
  });

  describe("updateStatus", () => {
    it("ao aprovar, publica order.paid montado com os dados do banco", async () => {
      const result = await service.updateStatus("order_123", "approved");

      expect(result).toEqual({ changed: true });
      expect(mockPublish).toHaveBeenCalledWith(
        "order.paid",
        expect.objectContaining({
          id_order: 5,
          customer: { name: "João do Banco", email: "do-banco@email.com" },
          items: [{ id_game: 1, title: "Jogo A", price: 89.98 }],
        }),
      );
    });

    it("webhook repetido (já estava aprovado) responde ok e NÃO publica de novo", async () => {
      mockUpdateStatus.mockResolvedValue(false);
      mockExists.mockResolvedValue(true);

      const result = await service.updateStatus("order_123", "approved");

      expect(result).toEqual({ changed: false });
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("devolve 404 quando o pedido não existe", async () => {
      mockUpdateStatus.mockResolvedValue(false);
      mockExists.mockResolvedValue(false);

      await expect(service.updateStatus("nao_existe", "approved")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("cancelar muda o status mas não publica order.paid", async () => {
      const result = await service.updateStatus("order_123", "canceled");

      expect(result).toEqual({ changed: true });
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("recusa status inválido sem tocar no banco", async () => {
      await expect(service.updateStatus("order_123", "pago" as OrderStatus)).rejects.toMatchObject({ statusCode: 400 });

      expect(mockUpdateStatus).not.toHaveBeenCalled();
    });
  });
});
