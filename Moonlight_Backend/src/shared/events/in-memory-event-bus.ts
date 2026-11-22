import type { EventBus, EventHandler, Subscription, Unsubscribe } from "@shared/events/event-bus.js";
import {
  createEventEnvelope,
  type DomainEvents,
  type EventEnvelope,
  type EventName,
} from "@shared/events/events.js";

/**
 * Adaptador em memória da porta EventBus.
 * Serve para testes e para rodar tudo num processo só, sem Redis.
 * Segue o mesmo contrato do RedisEventBus.
 */
export class InMemoryEventBus implements EventBus {

  private subscriptions = new Map<EventName, Subscription[]>();

  async publish<Name extends EventName>(name: Name, payload: DomainEvents[Name]): Promise<string> {
    const event = createEventEnvelope(name, payload);

    // Cópia da lista: se um handler cancelar a própria inscrição durante a entrega,
    // a iteração não é afetada.
    const current = [...(this.subscriptions.get(name) ?? [])];

    await Promise.all(current.map(subscription => this.deliver(subscription, event)));

    return event.id_envelope;
  }

  async subscribe<Name extends EventName>(name: Name, handler: EventHandler<Name>): Promise<Unsubscribe> {
    const subscription: Subscription = {
      handler: handler as unknown as Subscription["handler"],
    };

    const list = this.subscriptions.get(name) ?? [];
    list.push(subscription);
    this.subscriptions.set(name, list);

    return async () => {
      const subscriptions = this.subscriptions.get(name);
      if (!subscriptions) return;

      const index = subscriptions.indexOf(subscription);
      if (index !== -1) subscriptions.splice(index, 1);
    };
  }

  async close(): Promise<void> {
    this.subscriptions.clear();
  }

  private async deliver(subscription: Subscription, event: EventEnvelope): Promise<void> {
    try {
      await subscription.handler(event);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[EventBus] handler de "${event.name}" falhou (id=${event.id_envelope}): ${message}`);
    }
  }
}
