export interface CheckoutQueryPayload{
  items: { id_game: number }[];
  user: {
    id_user: number,
    name: string
  }
}
