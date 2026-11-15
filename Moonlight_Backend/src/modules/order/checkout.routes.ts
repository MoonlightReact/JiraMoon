import { Router } from 'express';
import { requireUser } from '../../config/allowedRoles.js';
import type { CheckoutController } from './checkout.controller.js';
import type { Guards } from '@shared/types/guards.js';

export function createCheckoutRoutes(controller: CheckoutController, guards: Guards) : Router {
  const router = Router();

  router.post('/', guards.authenticate, guards.authorize(requireUser), controller.createCheckout);
  router.post('/webhook', controller.handleWebhook);
  router.get('/success', controller.handleSuccess);
  router.get('/failure', controller.handleFailure);
  router.get('/pending', controller.handlePending);

  return router;
}
