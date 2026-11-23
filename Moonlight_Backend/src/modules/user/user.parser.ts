import type { Request } from "express";
import { toLimit, toPage, toString } from "@shared/query/queryParser.js";
import type { GetUsersPaginatedDTO } from "@modules/user/dto/user.input.dto.js";

export const parseUserQuery = (query: Request['query']): GetUsersPaginatedDTO => ({
    page: toPage(query.page),
    limit: toLimit(query.limit, 10),
    name: toString(query.name),
    email: toString(query.email),
    cpf: toString(query.cpf),
    role: toString(query.role)
})
