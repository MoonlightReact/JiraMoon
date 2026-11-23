// Teto de itens por página: protege o banco contra limit absurdo (ex.: limit=1000000000)
export const MAX_LIMIT = 50;

export const toString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

// Aceita só string de dígitos ("7"). Recusa "1.5", "-5", "1e3", "abc", "", "0" e números fora do range seguro.
export const toPositiveInt = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined;
  if (!/^\d+$/.test(value)) return undefined;
  const num = Number(value);
  return Number.isSafeInteger(num) && num > 0 ? num : undefined;
}

// Página inválida volta para o valor padrão
export const toPage = (value: unknown, defaultValue = 1): number =>
  toPositiveInt(value) ?? defaultValue;

// Limite inválido volta para o padrão; limite acima do teto é reduzido para o teto
export const toLimit = (value: unknown, defaultValue: number, max = MAX_LIMIT): number =>
  Math.min(toPositiveInt(value) ?? defaultValue, max);

export const toBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined) return undefined;
  return value === 'true';
};

export const toFloat = (value: unknown): number | undefined => {
  const parsed = parseFloat(value as string);
  return isNaN(parsed) ? undefined : parsed
}
