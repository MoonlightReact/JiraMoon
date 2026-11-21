import { Router } from 'express';
import type { CategoryController } from './category.controller.js';
import { requireAdmin } from '../../config/allowedRoles.js';
import type { Guards } from '@shared/types/guards.js';

export function createCategoryRoutes(controller: CategoryController, guards: Guards): Router {
  const router = Router();
  router.get('/pag', controller.getCategoriesPaginated);
  router.get('/:id', controller.getCategoryById);
  router.get('/', controller.getCategories);
  router.post('/', guards.authenticate, guards.authorize(requireAdmin), controller.createCategory);
  router.put('/:id', guards.authenticate, guards.authorize(requireAdmin), controller.updateCategory);
  router.delete('/:id', guards.authenticate, guards.authorize(requireAdmin), controller.deleteCategory);
  return router;
}
