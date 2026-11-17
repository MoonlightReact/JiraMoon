import type { GetGamesPaginatedDTO } from "./dto/game.input.dto.js";

export const GAME_LIST_PREFIX = "game:list:";
export const GAME_DETAIL_TTL = 300; // 5 min (a medida é feita em segundos)
export const GAME_LIST_TTL = 60;    // 1 min (listagem muda mais)

export function gameIdKey(id_game: number): string {
  return `game:id:${id_game}`;
}

export function gameListKey(query: GetGamesPaginatedDTO, page: number, limit: number): string {
  const payload = {
    page,
    limit,
    admin: !!query.admin,
    active: query.admin ? query.active : undefined,
    title: query.title,
    category: query.category,
    price_min: query.price_min,
    price_max: query.price_max,
    launch_date_from: query.launch_date_from,
    launch_date_to: query.launch_date_to,
  };
  return `${GAME_LIST_PREFIX}${JSON.stringify(payload)}`;
}
