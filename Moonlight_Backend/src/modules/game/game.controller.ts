import type { NextFunction, Request, Response } from "express";
import type { GameService } from "@modules/game/game.service.js";
import type {
  CreateGameDTO,
  UpdateGameDTO,
} from "@modules/game/dto/game.input.dto.js";
import { AppError } from "@shared/errors/AppError.js";
import { toBoolean, toPositiveInt } from "@shared/query/queryParser.js";
import { parseGameQuery } from "@modules/game/game.parser.js";

export class GameController {
  constructor(private gameService: GameService) {}

  getGamesPaginated = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const games = await this.gameService.findAllPaginated(
        parseGameQuery(req.query),
      );

      res.status(200).json(games);
    } catch (error) {
      next(error);
    }
  };

  getGamesAdminPaginated = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const games = await this.gameService.findAllPaginated({
        ...parseGameQuery(req.query),
        active: toBoolean(req.query.active),
        admin: true,
      });

      res.status(200).json(games);
    } catch (error) {
      next(error);
    }
  };

  getGames = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const games = await this.gameService.findAll();

      res.status(200).json(games);
    } catch (error) {
      next(error);
    }
  };

  // busca os jogos pelo seu id
  getGameById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const gameId = toPositiveInt(req.params.id);
      if (!gameId) throw new AppError("ID inválido", 400, "ID_NOT_SENT_OR_INVALID");

      const game = await this.gameService.findById(gameId);
      if (!game) throw new AppError("Jogo não encontrado", 404, "NOT_FOUND_GAME_BY_ID");

      res.status(200).json(game);
    } catch (error) {
      next(error);
    }
  };

  // Cria os jogos pelo comando do (admin)
  createGame = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as CreateGameDTO;

      await this.gameService.create(dto);

      res.status(201).json({ message: "Jogo criado com sucesso!" });
    } catch (error) {
      next(error);
    }
  };

  // atyaliza o jogo pelos comandos de um (Admin)
  updateGame = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id_game = toPositiveInt(req.params.id);
      if (!id_game) throw new AppError("ID inválido", 400, "ID_NOT_SENT_OR_INVALID");
      const dto = req.body as UpdateGameDTO;

      const game = await this.gameService.update({ ...dto, id_game });
      if (!game) throw new AppError("Jogo não encontrado", 404, "NOT_FOUND_GAME_TO_UPDATE");

      res.status(200).json({ message: "Jogo atualizado com sucesso!" });
    } catch (error) {
      next(error);
    }
  };

  // Deleta o jogo pelos comandos de (admin)
  deleteGame = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id_game = toPositiveInt(req.params.id);
      if (!id_game) throw new AppError("ID inválido", 400, "ID_NOT_SENT_OR_INVALID");

      const game = await this.gameService.delete(id_game);
      if (!game) throw new AppError("Jogo não encontrado", 404, "NOT_FOUND_GAME_TO_DELETE");

      res.status(200).json({ message: "Jogo deletado com sucesso!" });
    } catch (error) {
      next(error);
    }
  };
}
