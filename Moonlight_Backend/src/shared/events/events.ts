import { randomUUID } from "node:crypto";
import type { OrderCreatedPayload, OrderPaidPayload } from "./order/order-payload.js";

/** Mapa de eventos de domínio e seus payloads. */
export interface DomainEvents {
  "order.created": OrderCreatedPayload;
  "order.paid": OrderPaidPayload;
}

export type EventName = keyof DomainEvents;

export interface EventEnvelope<Name extends EventName = EventName> {
  id_envelope: string;
  name: Name;
  /** ISO 8601 para sobreviver a JSON.stringify/parse sem virar Date corrompido. */
  occurredAt: string;
  payload: DomainEvents[Name];
}

export function createEventEnvelope<Name extends EventName>(
  name: Name,
  payload: DomainEvents[Name],
): EventEnvelope<Name> {
  return {
    id_envelope: randomUUID(),
    name,
    occurredAt: new Date().toISOString(),
    payload,
  };
}
