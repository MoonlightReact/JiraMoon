import { Router } from 'express';
import { requireAdmin } from '../../config/allowedRoles.js';
import type { GameController } from './game.controller.js';
import type { Guards } from '@shared/types/guards.js';

export function createGameRoutes(controller: GameController, guards: Guards) {
  const router = Router();

  router.get('/pag', controller.getGamesPaginated); // Usuário Lista os jogos
  router.get('/pagadmin', guards.authenticate, guards.authorize(requireAdmin), controller.getGamesAdminPaginated); // Admin - Lista os jogos
  router.get('/:id', controller.getGameById); // Usuário Busca o jogo
  router.get('/', guards.authenticate, guards.authorize(requireAdmin), controller.getGames);  // só pra completar o crud
  router.post('/', guards.authenticate, guards.authorize(requireAdmin), controller.createGame); // Admin - Cria jogo
  router.put('/:id', guards.authenticate, guards.authorize(requireAdmin), controller.updateGame); // Admin - Atualiza jogo
  router.delete('/:id', guards.authenticate, guards.authorize (requireAdmin), controller.deleteGame); // Admin - Deleta jogo

  return router;
}
