export type OrderStatus = "pending" | "approved" | "canceled";

export const ORDER_STATUSES: OrderStatus[] = ["pending", "approved", "canceled"];

/** Item como a API principal envia: já com o preço validado por ela (MOON-44). */
export interface CreateOrderItemDTO {
  id_game: number;
  title: string;
  image?: string | null;
  price: number;
}

/** Corpo do POST /orders. Vem da API principal, nunca direto do navegador do cliente. */
export interface CreateOrderDTO {
  id_user: number;
  customer: { name: string; email: string };
  preference_id: string;
  external_reference: string;
  total: number;
  items: CreateOrderItemDTO[];
}

export interface OrderItem {
  id_game: number;
  title: string;
  image: string | null;
  price: number;
}

export interface Order {
  id_order: number;
  id_user: number;
  status: OrderStatus;
  total: number;
  preference_id: string;
  external_reference: string;
  customer_name: string;
  customer_email: string;
  created_at: Date;
  items: OrderItem[];
}
