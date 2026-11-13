import { cpf } from "cpf-cnpj-validator";
import { AppError } from "@shared/errors/AppError.js";
import type { CreateUserDTO, UpdateMeDTO, UpdateUserDTO, RegisterUserDTO } from "@modules/user/dto/user.input.dto.js";
import { assertEmail, assertPassword, assertRequiredFields } from "@shared/validator/common.validator.js";

const isCPFValid = (cpfUser: string): boolean => {
    return cpf.isValid(cpfUser);
};

const hasSelectedRole = (roleIds: number[]): boolean  => {
    return roleIds.length > 0;
}

export const assertCpf = (cpf: string): void => {
    if (!isCPFValid(cpf)) throw new AppError('CPF inválido', 400, "INVALID_CPF");
}

export const assertRole = (id_roles: number[]): void => {
    if (!hasSelectedRole(id_roles)) throw new AppError('O usuario não possui cargos vinculados', 400, "INVALID_TYPE");
}

export const assertName = (name: string): void => {
    if (name.length > 16) throw new AppError('Nome deve ter até 16 caracteres máximos', 400, "INVALID_NAME");
}

export const validateUser = (dto: CreateUserDTO | UpdateUserDTO): void => {
    assertRequiredFields([dto.name, dto.email, dto.password, dto.cpf, dto.id_roles]);
    assertName(dto.name);
    assertEmail(dto.email);
    assertCpf(dto.cpf);
    assertPassword(dto.password);
    assertRole(dto.id_roles);
}

export const validateRegister = (dto: RegisterUserDTO): void => {
    assertRequiredFields([dto.name, dto.email, dto.cpf, dto.password]);
    assertName(dto.name);
    assertEmail(dto.email);
    assertPassword(dto.password);
    assertCpf(dto.cpf);
}

export const validateUpdateMe = (dto: UpdateMeDTO): void => {
    assertRequiredFields([dto.name, dto.cpf, dto.password]);
    assertName(dto.name);
    assertCpf(dto.cpf);
    assertPassword(dto.password);
}
