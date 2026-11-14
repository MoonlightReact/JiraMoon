import type { CreateGameDTO, UpdateGameDTO } from "../@types/game/dto/game.input.dto.js";
import { AppError } from "@shared/errors/AppError.js";
import { isPriceValid } from "../utils/Validators/isPriceValid.js";
import { assertRequiredFields } from "@shared/validator/common.validator.js";

const assertPrice = (price: number): void => {
    if(!isPriceValid(price)) throw new AppError("O preço do jogo é inválido", 400, "INVALID_GAME_PRICE");
}

export const validateGame = (dto: CreateGameDTO | UpdateGameDTO): void => {
    assertRequiredFields([dto.title, dto.price, dto.launch_date, dto.active]);
    assertPrice(dto.price);
}
