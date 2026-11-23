import { parseGameQuery } from '@modules/game/game.parser.js';

describe('parseGameQuery', () => {
  it('usa page=1 e limit=8 por padrão', () => {
    const result = parseGameQuery({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(8);
  });

  it('aceita page e limit válidos', () => {
    const result = parseGameQuery({ page: '2', limit: '20' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
  });

  it('limita limit=1000000000 ao teto de 50', () => {
    const result = parseGameQuery({ limit: '1000000000' });
    expect(result.limit).toBe(50);
  });

  it('volta ao padrão com page/limit inválidos ("1.5", "-5", "1e3", "abc", "")', () => {
    for (const invalid of ['1.5', '-5', '1e3', 'abc', '']) {
      const result = parseGameQuery({ page: invalid, limit: invalid });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(8);
    }
  });
});
