import type { Request } from "express";
import { toBoolean, toLimit, toPage, toString } from "@shared/query/queryParser.js";
import type { GetCategoriesPaginatedDTO } from "./dto/category.input.dto.js";

export const parseCategoriesQuery = (query: Request['query']): GetCategoriesPaginatedDTO => ({
    page: toPage(query.page),
    limit: toLimit(query.limit, 8),
    random: toBoolean(query.random),
    name: toString(query.name)
})
