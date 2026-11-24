import { MAX_LIMIT, toLimit, toPage, toPositiveInt } from '@shared/query/queryParser.js';

describe('toPositiveInt', () => {
  it('aceita "7"', () => {
    expect(toPositiveInt('7')).toBe(7);
  });

  it('recusa "1.5"', () => {
    expect(toPositiveInt('1.5')).toBeUndefined();
  });

  it('recusa "-5"', () => {
    expect(toPositiveInt('-5')).toBeUndefined();
  });

  it('recusa "1e3"', () => {
    expect(toPositiveInt('1e3')).toBeUndefined();
  });

  it('recusa "abc"', () => {
    expect(toPositiveInt('abc')).toBeUndefined();
  });

  it('recusa string vazia', () => {
    expect(toPositiveInt('')).toBeUndefined();
  });

  it('recusa "0"', () => {
    expect(toPositiveInt('0')).toBeUndefined();
  });

  it('recusa número fora do range seguro', () => {
    expect(toPositiveInt('99999999999999999999')).toBeUndefined();
  });

  it('recusa valores que não são string (undefined, número, array)', () => {
    expect(toPositiveInt(undefined)).toBeUndefined();
    expect(toPositiveInt(7)).toBeUndefined();
    expect(toPositiveInt(['7'])).toBeUndefined();
  });
});

describe('toPage', () => {
  it('usa o valor enviado quando válido', () => {
    expect(toPage('3')).toBe(3);
  });

  it('volta para 1 quando inválido', () => {
    expect(toPage('abc')).toBe(1);
    expect(toPage('-1')).toBe(1);
    expect(toPage(undefined)).toBe(1);
  });
});

describe('toLimit', () => {
  it('usa o valor enviado quando válido e dentro do teto', () => {
    expect(toLimit('20', 8)).toBe(20);
  });

  it('volta para o padrão quando inválido', () => {
    expect(toLimit('abc', 8)).toBe(8);
    expect(toLimit('1.5', 8)).toBe(8);
    expect(toLimit(undefined, 8)).toBe(8);
  });

  it('limita ao teto quando limit=1000000000', () => {
    expect(toLimit('1000000000', 8)).toBe(MAX_LIMIT);
  });

  it('o teto padrão é 50', () => {
    expect(MAX_LIMIT).toBe(50);
  });
});
