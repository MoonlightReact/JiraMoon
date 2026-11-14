import { assertRequiredFields } from "@shared/validator/common.validator.js";
import type { CreateCategoryDTO, UpdateCategoryDTO } from "./dto/category.input.dto.js";

export const validateCategory = (dto: CreateCategoryDTO | UpdateCategoryDTO): void => {
    assertRequiredFields([dto.name, dto.description]);
}
