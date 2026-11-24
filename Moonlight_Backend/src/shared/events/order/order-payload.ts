
export interface OrderCreatedPayload {
  id_order: number;
  id_user: number;
  total: number;
  external_reference: string;
  // Os dados do cliente viajam dentro do evento: o Notification Service tem banco
  // próprio e não precisa chamar a API principal para descobrir para quem enviar o e-mail.
  customer: { name: string; email: string };
}

export interface OrderPaidItem {
  id_game: number;
  title: string;
  price: number;
}

export interface OrderPaidPayload extends OrderCreatedPayload {
  preference_id?: string;
  items: OrderPaidItem[];
}

/*_____________________________________________ */
