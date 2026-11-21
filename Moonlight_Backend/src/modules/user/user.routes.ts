import { Router } from 'express';
import type { UserController } from './user.controller.js';
import type { Guards } from '@shared/types/guards.js';
import { requireAdmin, requireUser } from '../../config/allowedRoles.js';

export function createUserRoutes(controller: UserController, guards: Guards) {
  const router = Router();

  router.get('/pag', guards.authenticate, guards.authorize(requireAdmin), controller.getUsersPaginated);
  router.get('/:id', guards.authenticate, guards.authorize(requireAdmin), controller.getUserById);
  router.get('/', guards.authenticate, guards.authorize(requireAdmin), controller.getUsers);
  router.post('/', guards.authenticate, guards.authorize(requireAdmin), controller.createUser);
  router.post('/register', controller.registerUser);
  router.put('/me', guards.authenticate, guards.authorize(requireUser), controller.updateMe);
  router.put('/:id', guards.authenticate, guards.authorize(requireAdmin), controller.updateUser);
  router.delete('/:id', guards.authenticate, guards.authorize(requireAdmin), controller.deleteUser);

  return router;
}
