import express from 'express';
import type { AuthController } from './auth.controller.js';

export function createAuthRoutes(controller: AuthController) {
  const router = express.Router();

  router.post('/login', controller.login);

  return router;
}
