import { Router } from 'express';
import { guards, gameController } from "../config/container.js";
import { errorMiddleware } from '@shared/middlewares/error.Middleware.js';
import { requireAdmin } from '../config/allowedRoles.js';

const router = Router();

router.get('/pag', gameController.getGamesPaginated); // Usuário Lista os jogos
router.get('/pagadmin', guards.authenticate, guards.authorize(requireAdmin), gameController.getGamesAdminPaginated); // Admin - Lista os jogos
router.get('/:id', gameController.getGameById); // Usuário Busca o jogo
router.get('/', guards.authenticate, guards.authorize(requireAdmin), gameController.getGames);  // só pra completar o crud
router.post('/', guards.authenticate, guards.authorize(requireAdmin), gameController.createGame, errorMiddleware); // Admin - Cria jogo
router.put('/:id', guards.authenticate, guards.authorize(requireAdmin), gameController.updateGame); // Admin - Atualiza jogo
router.delete('/:id', guards.authenticate, guards.authorize (requireAdmin), gameController.deleteGame); // Admin - Deleta jogo

export default router;
