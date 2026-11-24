// O cliente envia só os ids dos jogos.
// Título, preço e total são calculados no servidor (CheckoutService).
export type CreateCheckoutDTO = {
    items: { id_game: number }[],
    user: {
        id_user: number,
        name: string
    }
}

export type MercadoPagoWebhookDTO = {
  type: "payment" | "subscription" | "plan" | string;
  data: {
    id: string;
  };
};
