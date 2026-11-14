import { Router } from 'express';
import { orderController, guards } from '../config/container.js';
import { requireAdmin, requireUser } from '../config/allowedRoles.js';

const router = Router();

router.get('/my-orders', guards.authenticate, guards.authorize(requireUser), orderController.getMyOrders); // Usuário logado
router.get('/my-library', guards.authenticate, guards.authorize(requireUser), orderController.getUserLibrary);
router.get('/can-user-purchase', guards.authenticate, guards.authorize(requireUser), orderController.canUserPurchase);
router.get('/', guards.authenticate, guards.authorize(requireAdmin), orderController.getAllOrders); // Admin
router.get('/:id', guards.authenticate, guards.authorize(requireAdmin), orderController.getOrderById); // Admin
router.post('/', guards.authenticate, guards.authorize(requireUser), orderController.createOrder); // Usuário logado
router.put('/:id', guards.authenticate, guards.authorize(requireAdmin), orderController.updateOrderStatus); // Admin

export default router;
