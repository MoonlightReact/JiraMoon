import type { CreateGameDTO, UpdateGameDTO } from "@modules/game/dto/game.input.dto.js";
import { assertPrice, assertRequiredFields } from "@shared/validator/common.validator.js";

export const validateGame = (dto: CreateGameDTO | UpdateGameDTO): void => {
    assertRequiredFields([dto.title, dto.price, dto.launch_date, dto.active]);
    assertPrice(dto.price);
}
