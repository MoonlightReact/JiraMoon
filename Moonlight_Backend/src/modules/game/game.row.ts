import type { RowDataPacket } from "mysql2";
import type { GameResponseCountRowsDTO } from "@modules/game/dto/game.output.dto.js";

export type GameRow = RowDataPacket & {
    id_game: number;
    title: string;
    description?: string | undefined;
    price: number;
    image?: string | undefined;
    banner_image?: string | undefined;
    link?: string | undefined;
    launch_date: Date;
    active: boolean;
    categories?: string | undefined;
}

export type GameCountRows = RowDataPacket & GameResponseCountRowsDTO;

export type GamePriceRow = RowDataPacket & {
    id_game: number;
    title: string;
    price_in_cents: number;
}
