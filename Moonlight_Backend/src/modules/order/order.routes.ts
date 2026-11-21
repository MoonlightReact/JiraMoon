import { Router } from 'express';
import { requireAdmin, requireUser } from '../../config/allowedRoles.js';
import type { OrderController } from './order.controller.js';
import type { Guards } from '@shared/types/guards.js';

export function createOrderRoutes(controller: OrderController, guards: Guards) : Router {
  const router = Router();

  router.get('/my-orders', guards.authenticate, guards.authorize(requireUser), controller.getMyOrders); // Usuário logado
  router.get('/my-library', guards.authenticate, guards.authorize(requireUser), controller.getUserLibrary);
  router.get('/can-user-purchase', guards.authenticate, guards.authorize(requireUser), controller.canUserPurchase);
  router.get('/', guards.authenticate, guards.authorize(requireAdmin), controller.getAllOrders); // Admin
  router.get('/:id', guards.authenticate, guards.authorize(requireAdmin), controller.getOrderById); // Admin
  router.post('/', guards.authenticate, guards.authorize(requireUser), controller.createOrder); // Usuário logado
  router.put('/:id', guards.authenticate, guards.authorize(requireAdmin), controller.updateOrderStatus); // Admin

  return router;
}
