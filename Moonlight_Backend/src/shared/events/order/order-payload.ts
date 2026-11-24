// ---------------------------------------------------------------------------
// Contrato dos eventos de domínio.
//
// PROPOSTA: os campos dos payloads precisam ser confirmados com quem implementa
// o publisher [ORDER SERVICE] (MOON-22) e o consumer [NOTIFICATION SERVICE] (MOON-21) antes de virarem definitivos.
// ---------------------------------------------------------------------------

export interface OrderCreatedPayload {
  id_order: number;
  id_user: number;
  total: number;
  external_reference: string;
}

export interface OrderPaidItem {
  id_game: number;
  title: string;
  price: number;
}

export interface OrderPaidPayload {
  id_order: number;
  id_user: number;
  total: number;
  external_reference: string;
  preference_id?: string;
  // Os dados do cliente viajam dentro do evento: o Notification Service tem banco
  // próprio e não precisa chamar a API principal para descobrir para quem enviar o e-mail.
  customer: { name: string; email: string };
  items: OrderPaidItem[];
}

/*_____________________________________________ */
