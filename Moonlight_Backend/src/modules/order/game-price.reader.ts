// Porta do módulo order: o que o checkout precisa saber de um jogo para cobrar.
// Quem implementa (GameRepository, no módulo game) decide de onde isso vem;
// o checkout só depende deste contrato.

export type GamePrice = {
  id_game: number;
  title: string;
  priceInCents: number; // inteiro, evita erro de ponto flutuante (0.1 + 0.2)
};

export interface GamePriceReader {
  // Retorna só jogos ativos. Ids inexistentes ou inativos simplesmente não aparecem no resultado.
  findPricesByIds(ids: number[]): Promise<GamePrice[]>;
}
