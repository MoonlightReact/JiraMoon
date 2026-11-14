import { AppError } from "@shared/errors/AppError.js";

const isPriceValid = (price: unknown): boolean => {
  if (typeof price === "string" && price.trim() === "") return false;

  const num = Number(price);

  return (
    Number.isFinite(num) && num >= 0 && Number.isInteger(Math.round(num * 100)) // máximo 2 casas decimais
  );
}


const isEmailValid = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

const isStrongPassword = (senha: string): boolean => {
    if (senha.length < 8)  return false; // mínimo 8 caracteres
    if (senha.length > 16) return false; // máximo 16 caracteres
    if (!/[A-Z]/.test(senha)) return false; // letra maiúscula
    if (!/[a-z]/.test(senha)) return false; // letra minúscula
    if (!/\d/.test(senha))    return false; // número

    return true;
};

export const assertRequiredFields = (fields: unknown[]): void => {
    if (fields.some(field => field == null || (typeof field === 'string' && !field.trim())))
    throw new AppError("Todos os campos são obrigatórios", 400, "INVALID_FIELDS");
    // o ultimo caso é pra evitar de mandarem ' '.
}

export const assertEmail = (email: string): void => {
    if (!isEmailValid(email)) throw new AppError('Email inválido', 400, "INVALID_EMAIL");
}

export const assertPassword = (password: string): void => {
    if (!isStrongPassword(password)) throw new AppError('Senha deve ter pelo menos 8 a 16 caracteres, maiúscula, minúscula, número', 400, "WEAK_PASSWORD");
}

export const assertPrice = (price: number): void => {
    if(!isPriceValid(price)) throw new AppError("O preço é inválido", 400, "INVALID_PRICE");
}
