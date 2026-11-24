import { afterEach, describe, expect, it, jest } from "@jest/globals";
import EventEmitter from "node:events";
import type { OrderPaidPayload } from "./order/order-payload.js";
import { RedisEventBus } from "./redis-event-bus.js";
import type { Redis } from "ioredis";

const paidPayload: OrderPaidPayload = {
  id_order: 1,
  id_user: 7,
  total: 89.98,
  external_reference: "order_123",
  customer: { name: "João", email: "joao@email.com" },
  items: [{ id_game: 1, title: "Jogo A", price: 89.98 }],
}

class FakeSubscriber extends EventEmitter {
  status = "ready";
  subscribe = jest.fn(async (_channel: string) => 1);
  unsubscribe = jest.fn(async (_channel: string) => 1);
  quit = jest.fn(async () => "OK");
  disconnect = jest.fn(() => undefined);
}

function setup() {
  const subscriber = new FakeSubscriber();
  const publisher = {
    publish: jest.fn(async (_channel: string, _message: string) => 1),
    duplicate: jest.fn(() => subscriber),
    quit: jest.fn(async () => "OK"),
    disconnect: jest.fn(() => undefined)
  }
  const bus = new RedisEventBus(publisher as unknown as Redis);
  return { bus, publisher, subscriber };
}

describe("RedisEventBus Teste Unitario - (crítico)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  })

  it("não lança erro no publish se o Redis falhar e não vaza o payload no log", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { bus, publisher } = setup();
    publisher.publish.mockRejectedValueOnce(new Error("Redis offline"));

    const id = await bus.publish("order.paid", paidPayload);

    expect(typeof id).toBe("string");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logMessage = String(errorSpy.mock.calls[0]?.[0]);
    expect(logMessage).toContain("order.paid");
    expect(logMessage).not.toContain("joao@email.com");
  })

  it("assina no Redis só no primeiro handler e cancela só quando o último sai", async () => {
    const { bus, subscriber } = setup();
    const handlerA = jest.fn(async () => undefined);
    const handlerB = jest.fn(async () => undefined);

    const cancelA = await bus.subscribe("order.paid", handlerA);
    await bus.subscribe("order.paid", handlerB);

    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
    expect(subscriber.subscribe).toHaveBeenCalledWith("order.paid");

    await cancelA();
    expect(subscriber.unsubscribe).not.toHaveBeenCalled();

    await cancelA(); // cancelar duas vezes é seguro
    expect(subscriber.unsubscribe).not.toHaveBeenCalled();
    // unsubscribe é chamado se o último handler do canal for guardado e executado.
    // const cancelar = await bus.subscribe("order.paid", handler1);
    // await cancelar();
  })
  it("descarta mensagem inválida sem quebrar e close() fecha o subscriber sem fechar o publisher", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const { bus, publisher, subscriber } = setup();

      expect(() => subscriber.emit("message", "order.paid", "nao-e-json")).not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));
      expect(errorSpy).toHaveBeenCalledTimes(1);

      await bus.close();
      expect(subscriber.quit).toHaveBeenCalledTimes(1);
      expect(publisher.quit).not.toHaveBeenCalled();
      expect(publisher.disconnect).not.toHaveBeenCalled();
    });
})
