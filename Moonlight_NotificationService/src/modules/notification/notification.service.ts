import type { EventEnvelope } from "@shared/events/events.js";
import type { NotificationRepository } from "./notification.repository.js";

export class NotificationService {
  constructor(private notificationRepository: NotificationRepository) { }

  async handleOrderEvent(event: EventEnvelope<"order.paid" | "order.created">) : Promise<void> {
    const { external_reference, customer } = event.payload;
    const ref = external_reference?.trim();
    const email = customer?.email?.trim();

    if (!ref || !email) {
      console.warn(`[NotificationService] Evento ignorado por dados incompletos | event=${event.eventName} id=${event.id_envelope}`);
      return;
    }

    try {
      const notificationSent = await this.notificationRepository.createIfNotExists({ id_envelope: event.id_envelope, eventName: event.eventName, external_reference: ref, email });
      if (!notificationSent) {
        console.log(`[NotificationService] Duplicata ignorada (idempotência) | event=${event.eventName} ref=${ref} id=${event.id_envelope}`);
        return;
      }
      console.log(`[NotificationService] Notificação registrada para ${customer.name} | event=${event.eventName} ref=${ref} id=${event.id_envelope}`);
    } catch (err) {
      console.error(`[NotificationService] Erro ao salvar notificação | event=${event.eventName} ref=${ref}`, err);
    }
  }
}
