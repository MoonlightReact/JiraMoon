import type { DomainEvents, EventEnvelope, EventName } from "@shared/events/events.js";

export type EventHandler<Name extends EventName> = (event: EventEnvelope<Name>) => void | Promise<void>;

/**
 * Cada inscrição é um objeto próprio (e não só a função): assim, assinar a MESMA função
 * duas vezes gera duas entregas, e cancelar uma não cancela a outra.
 */
export type Subscription = {
  handler: (event: EventEnvelope) => void | Promise<void>;
};

/** Cancela a inscrição; chamar mais de uma vez não gera erro. */
export type Unsubscribe = () => Promise<void>;

/**
 * Porta de barramento de eventos de domínio.
 * Adaptadores: InMemoryEventBus (testes, processo único) e RedisEventBus (Redis Pub/Sub).
 *
 * Garantias do contrato:
 * - Fan-out: todo assinante ativo no momento do publish recebe o evento.
 * - At-most-once: cada assinante recebe o evento no máximo uma vez. O evento pode se
 *   perder, e o barramento não duplica. Não há ack, retry nem reenvio.
 * - Sem retenção: o barramento não guarda mensagens. Quem não estava assinado no
 *   momento do publish (serviço fora do ar, reiniciando) nunca recebe o evento, e não há replay.
 * - Isolamento: erro em um handler não propaga ao publisher nem afeta os outros handlers.
 * - `publish` devolve o `id_envelope` do evento, o mesmo que o handler recebe.
 *
 * Consequência para quem consome: o evento não pode ser a única fonte da verdade.
 * O dado definitivo vive no banco do serviço que publicou.
 *
 * Diferença entre adaptadores (não faz parte do contrato, não dependa disso):
 * o InMemoryEventBus espera os handlers terminarem antes de resolver o publish;
 * o RedisEventBus resolve quando o Redis aceita a mensagem, sem saber se alguém consumiu.
 */
export interface EventBus {
  publish<Name extends EventName>(name: Name, payload: DomainEvents[Name]): Promise<string>;
  subscribe<Name extends EventName>(name: Name, handler: EventHandler<Name>): Promise<Unsubscribe>;
  close(): Promise<void>;
}
