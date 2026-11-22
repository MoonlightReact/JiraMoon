import { jest } from "@jest/globals";
import type { Pool } from "mysql2/promise";
import { GameRepository } from "@modules/game/game.repository.js";

const mockQuery = jest.fn<(...args: any[]) => Promise<any>>();
const repository = new GameRepository({ query: mockQuery } as unknown as Pool);

describe("GameRepository.findPricesByIds - Unitário", () => {
  beforeEach(() => mockQuery.mockReset());

  it("não consulta o banco quando a lista de ids é vazia", async () => {
    const result = await repository.findPricesByIds([]);

    expect(result).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("consulta só jogos ativos, passando os ids como parâmetro", async () => {
    mockQuery.mockResolvedValue([[], []]);

    await repository.findPricesByIds([1, 2]);

    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("active = 1");
    expect(sql).toContain("id_game IN (?)");
    expect(params).toEqual([[1, 2]]);
  });

  it("converte as linhas para GamePrice com preço em centavos (número inteiro)", async () => {
    mockQuery.mockResolvedValue([
      [
        { id_game: "1", title: "Jogo A", price_in_cents: "5999" },
        { id_game: 2, title: "Jogo B", price_in_cents: 10 },
      ],
      [],
    ]);

    const result = await repository.findPricesByIds([1, 2]);

    expect(result).toEqual([
      { id_game: 1, title: "Jogo A", priceInCents: 5999 },
      { id_game: 2, title: "Jogo B", priceInCents: 10 },
    ]);
  });
});
