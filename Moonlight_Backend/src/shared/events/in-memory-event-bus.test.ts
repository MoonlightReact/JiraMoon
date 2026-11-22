import { jest } from "@jest/globals";
import { InMemoryEventBus } from "./in-memory-event-bus.js";
import type { EventHandler, Unsubscribe } from "./event-bus.js";
import type { OrderCreatedPayload, OrderPaidPayload } from "./order/order-payload.js";

const createdPayload: OrderCreatedPayload = {
  id_order: 1,
  id_user: 7,
  total: 89.98,
  external_reference: "order_123",
};

const paidPayload: OrderPaidPayload = {
  ...createdPayload,
  customer: { name: "João", email: "joao@email.com" },
  items: [
    { id_game: 1, title: "Jogo A", price: 59.99 },
    { id_game: 2, title: "Jogo B", price: 29.99 },
  ],
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("InMemoryEventBus - Unitário", () => {
  let bus: InMemoryEventBus;
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    bus = new InMemoryEventBus();
    // O bus loga os erros de handler; silenciado para não poluir a saída do teste
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("publish", () => {
    it("entrega o envelope completo ao assinante", async () => {
      const handler = jest.fn<EventHandler<"order.paid">>();
      await bus.subscribe("order.paid", handler);

      await bus.publish("order.paid", paidPayload);

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0]![0];
      expect(event.name).toBe("order.paid");
      expect(event.payload).toEqual(paidPayload);
      expect(event.id_envelope).toMatch(UUID_V4);
      // ISO 8601: ida e volta pelo Date gera exatamente a mesma string
      expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
    });

    it("publish a todos os assinantes do evento (fan-out), com o mesmo id", async () => {
      const first = jest.fn<EventHandler<"order.created">>();
      const second = jest.fn<EventHandler<"order.created">>();
      await bus.subscribe("order.created", first);
      await bus.subscribe("order.created", second);

      await bus.publish("order.created", createdPayload);

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      expect(first.mock.calls[0]![0].id_envelope).toBe(second.mock.calls[0]![0].id_envelope);
    });

    it("não faz publish a assinantes de outro evento", async () => {
      const paidHandler = jest.fn<EventHandler<"order.paid">>();
      await bus.subscribe("order.paid", paidHandler);

      await bus.publish("order.created", createdPayload);

      expect(paidHandler).not.toHaveBeenCalled();
    });

    it("cada publish gera um id diferente", async () => {
      const handler = jest.fn<EventHandler<"order.created">>();
      await bus.subscribe("order.created", handler);

      await bus.publish("order.created", createdPayload);
      await bus.publish("order.created", createdPayload);

      expect(handler.mock.calls[0]![0].id_envelope).not.toBe(handler.mock.calls[1]![0].id_envelope);
    });

    it("publish devolve o id do evento, o mesmo que o handler recebe", async () => {
      const handler = jest.fn<EventHandler<"order.created">>();
      await bus.subscribe("order.created", handler);

      const id = await bus.publish("order.created", createdPayload);

      expect(id).toMatch(UUID_V4);
      expect(handler.mock.calls[0]![0].id_envelope).toBe(id);
    });

    it("fazer publish sem nenhum assinante não falha", async () => {
      await expect(bus.publish("order.created", createdPayload)).resolves.toEqual(expect.any(String));
    });

    it("não entrega evento com publish antes da assinatura (sem replay)", async () => {
      await bus.publish("order.created", createdPayload);

      const handler = jest.fn<EventHandler<"order.created">>();
      await bus.subscribe("order.created", handler);

      expect(handler).not.toHaveBeenCalled();
    });

    it("espera handlers assíncronos antes de resolver (comportamento do adaptador em memória)", async () => {
      const received: string[] = [];
      await bus.subscribe("order.created", async event => {
        await new Promise(resolve => setTimeout(resolve, 10));
        received.push(event.id_envelope);
      });

      await bus.publish("order.created", createdPayload);

      expect(received).toHaveLength(1);
    });
  });

  describe("cancelar subscription", () => {
    it("depois de cancelar, o handler não recebe mais eventos", async () => {
      const handler = jest.fn<EventHandler<"order.created">>();
      const unsubscribe = await bus.subscribe("order.created", handler);

      await unsubscribe();
      await bus.publish("order.created", createdPayload);

      expect(handler).not.toHaveBeenCalled();
    });

    it("cancelar subscription não afeta os outros", async () => {
      const cancelled = jest.fn<EventHandler<"order.created">>();
      const kept = jest.fn<EventHandler<"order.created">>();
      const unsubscribe = await bus.subscribe("order.created", cancelled);
      await bus.subscribe("order.created", kept);

      await unsubscribe();
      await bus.publish("order.created", createdPayload);

      expect(cancelled).not.toHaveBeenCalled();
      expect(kept).toHaveBeenCalledTimes(1);
    });

    it("cancelar duas vezes é seguro", async () => {
      const unsubscribe = await bus.subscribe("order.created", jest.fn<EventHandler<"order.created">>());

      await unsubscribe();

      await expect(unsubscribe()).resolves.toBeUndefined();
    });

    it("fazer subscription da mesma função duas vezes gera duas entregas, e cancelar uma mantém a outra", async () => {
      const handler = jest.fn<EventHandler<"order.created">>();
      const first = await bus.subscribe("order.created", handler);
      await bus.subscribe("order.created", handler);

      await bus.publish("order.created", createdPayload);
      expect(handler).toHaveBeenCalledTimes(2);

      await first();
      handler.mockClear();
      await bus.publish("order.created", createdPayload);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("um handler que se cancela durante o publish não quebra o publish aos demais", async () => {
      let unsubscribeSelf: Unsubscribe | undefined;
      unsubscribeSelf = await bus.subscribe("order.created", async () => {
        await unsubscribeSelf?.();
      });
      const other = jest.fn<EventHandler<"order.created">>();
      await bus.subscribe("order.created", other);

      await bus.publish("order.created", createdPayload);

      expect(other).toHaveBeenCalledTimes(1);
    });
  });

  describe("isolamento de erros", () => {
    it("o erro de um handler não impede os outros nem faz o publish falhar", async () => {
      const failing = jest
        .fn<EventHandler<"order.created">>()
        .mockImplementation(async () => {
          throw new Error("falha no consumidor");
        });
      const healthy = jest.fn<EventHandler<"order.created">>();
      await bus.subscribe("order.created", failing);
      await bus.subscribe("order.created", healthy);

      await expect(bus.publish("order.created", createdPayload)).resolves.toEqual(expect.any(String));

      expect(failing).toHaveBeenCalledTimes(1);
      expect(healthy).toHaveBeenCalledTimes(1);
    });

    it("um handler síncrono que lança também é isolado", async () => {
      const failing = jest
        .fn<EventHandler<"order.created">>()
        .mockImplementation(() => {
          throw new Error("falha síncrona");
        });
      const healthy = jest.fn<EventHandler<"order.created">>();
      await bus.subscribe("order.created", failing);
      await bus.subscribe("order.created", healthy);

      await expect(bus.publish("order.created", createdPayload)).resolves.toEqual(expect.any(String));

      expect(healthy).toHaveBeenCalledTimes(1);
    });

    it("registra o erro do handler com o nome e o id do evento, sem vazar o payload", async () => {
      await bus.subscribe("order.paid", async () => {
        throw new Error("falha no consumidor");
      });

      await bus.publish("order.paid", paidPayload);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const logged = String(errorSpy.mock.calls[0]![0]);
      expect(logged).toContain("order.paid");
      expect(logged).toContain("falha no consumidor");
      // o payload tem e-mail do cliente: dado pessoal não vai para o log
      expect(logged).not.toContain("joao@email.com");
    });
  });

  describe("close", () => {
    it("remove todas as subscriptions", async () => {
      const handler = jest.fn<EventHandler<"order.created">>();
      await bus.subscribe("order.created", handler);

      await bus.close();
      await bus.publish("order.created", createdPayload);

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
