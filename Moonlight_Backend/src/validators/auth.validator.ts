import { assertEmail, assertPassword, assertRequiredFields } from "@shared/validator/common.validator.js";
import type { LoginAuthDTO } from "../@types/auth/auth.input.dto.js";

export const validateLogin = (dto: LoginAuthDTO): void => {
  assertRequiredFields([dto.email, dto.password]);
  assertEmail(dto.email);
  assertPassword(dto.password);
}
