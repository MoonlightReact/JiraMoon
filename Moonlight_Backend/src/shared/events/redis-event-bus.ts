import type { Redis } from "ioredis";
import type { EventBus, EventHandler, Subscription, Unsubscribe } from "./event-bus.js";
import { createEventEnvelope, type DomainEvents, type EventEnvelope, type EventName } from "./events.js";

/**
 * Adaptador Redis Pub/Sub da porta EventBus. Segue o mesmo contrato do InMemoryEventBus
 * (fan-out, at-most-once, isolamento de erros, publish devolve o id do evento).
 *
 * Duas conexões, por causa do Redis:
 * - `publisher`: o cliente que já existe (redis.ts), recebido pelo construtor. É dele a posse
 *   e o encerramento (closeCache); este bus nunca o fecha.
 * - `subscriber`: conexão própria, criada aqui. No Redis, uma conexão que fez SUBSCRIBE fica
 *   dedicada a receber mensagens e não executa mais comandos normais.
 *
 * O canal do Redis tem o mesmo nome do evento ("order.paid").
 */
export class RedisEventBus implements EventBus{
  private readonly subscriber: Redis;
  private readonly subscriptions = new Map<EventName, Subscription[]>();

  constructor(private readonly publisher: Redis) {
    /**
     * duplicate() copia as opções do redis.ts, que são pensadas para o CACHE (falhar rápido).
     * A assinatura é uma conexão de longa duração e precisa de outro comportamento:
     * - lazyConnect: conecta no primeiro comando (subscribe).
     * - enableOfflineQueue: o subscribe espera a conexão abrir em vez de falhar na hora.
     * - commandTimeout: sem o limite de 250 ms, que vale para leituras de cache.
     */
    this.subscriber = publisher.duplicate({
      lazyConnect: true,
      enableOfflineQueue: true,
      commandTimeout: undefined,
    })

    // O redis entrega toda mensagem de todos os canais assinados neste mesmo evento.
    this.subscriber.on("message", (channel: string, message: string) => {
      void this.dispatch(channel, message);
    });

    /**
     * se tiver erro loga uma vez só por cada conexão;
     */
    let errorLogged = false;
    this.subscriber.on("error", err => {
      if (errorLogged) return;
      errorLogged = true;
      console.error(`[EventBus] conexão de assinatura com erro: ${err.message}`);
    });
    this.subscriber.on("ready", () => {
      errorLogged = false;
    })
  }

  async publish<Name extends EventName>(name: Name, payload: DomainEvents[Name]): Promise<string> {
    const event = createEventEnvelope(name, payload);
    try {
      // publish devolve quantos assinantes receberam. É a prova do at-most-once:
      // receivers=0 significa que o evento não chegou a ninguém e foi descartado.
      const receivers = await this.publisher.publish(name, JSON.stringify(event));
      console.log(`[EventBus] PUBLISH ${name} id=${event.id_envelope} receivers=${receivers}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[EventBus] ERROR PUBLISH de "${event.name}" falhou (id=${event.id_envelope}): ${message}`);
    }
    return event.id_envelope;
  }

  async subscribe<Name extends EventName>(name: Name, handler: EventHandler<Name>): Promise<Unsubscribe> {
    const subscription: Subscription = { handler: handler as unknown as Subscription["handler"] }

    const list = (this.subscriptions.get(name) ?? []);
    const firstForChannel = list.length === 0;

    list.push(subscription);
    this.subscriptions.set(name, list);

    // uma assinatura no Redis por canal; vários handlers locais por cima dela.
    if (firstForChannel) {
      try {
        await this.subscriber.subscribe(name);
      } catch (err) {
        this.removeSubscription(name, subscription); //não deixa handler "fantasma" registrado
        throw err;
      }
    }
    return async () => {
      const emptied = this.removeSubscription(name, subscription);
      if (emptied) await this.subscriber.unsubscribe(name);
    }
  }

  async close(): Promise<void> {
    this.subscriptions.clear();

    // quit() só se a conexão estiver pronta.
    if (this.subscriber.status === "ready") {
      await this.subscriber.quit();
    } else {
      this.subscriber.disconnect();
    }
  }

  private async dispatch(channel: string, message: string): Promise<void> {
    const event = this.parse(channel, message);
    if (!event) return;

    const current = [...(this.subscriptions.get(event.name) ?? [])];

    console.log(`[EventBus] CONSUME ${event.name} id=${event.id_envelope} handlers=${current.length}`);

    await Promise.all(current.map(subscription => this.deliver(subscription, event)));
  }

  private async deliver(subscription: Subscription, event: EventEnvelope) {
    try {
      await subscription.handler(event);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[EventBus] ERROR handler de "${event.name}" falhou (id=${event.id_envelope}): ${message}`);
    }
  }

  private removeSubscription(name: EventName, subscription: Subscription): boolean {
    const current = this.subscriptions.get(name);
    if (!current) return false;

    const index = current.indexOf(subscription);
    if (index === -1) return false;

    current.splice(index, 1);
    if (current.length > 0) return false;

    this.subscriptions.delete(name);
    return true;
  }

  private parse(channel: string, message: string): EventEnvelope | null {
    try {
      const data = JSON.parse(message) as Partial<EventEnvelope | null>;

      const validData = this.validateData(data, channel);
      if (!validData) throw new Error("envelope inválido!");

      return data as EventEnvelope;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[EventBus] ERROR mensagem descartada no canal "${channel}": ${reason}`);
      return null;
    }
  }

  private validateData(data: Partial<EventEnvelope | null>, channel: string): boolean {
    if (data === null || typeof data !== "object") return false;
    if (typeof data.id_envelope !== "string") return false;
    if (data.name !== channel) return false;
    if (typeof data.occurredAt !== "string") return false;
    if (typeof data.payload !== "object" || data.payload === null) return false;

    return true;
  }

}
