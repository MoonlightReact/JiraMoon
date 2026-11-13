import { AuthController } from "../controllers/auth.Controller.js";
import { CheckoutController } from "../controllers/checkout.Controller.js";
import { GameController } from "../controllers/game.Controller.js";
import { OrderController } from "../controllers/order.Controller.js";
import { UploadController } from "../controllers/upload.Controller.js";
import { GameRepository } from "../repositories/GameRepository.js";
import { OrderRepository } from "../repositories/OrderRepository.js";
import { PurchasedItemsRepository } from "../repositories/PurchasedItemsRepository.js";
import { AuthService } from "../services/auth.Service.js";
import { CheckoutService } from "../services/checkout.Service.js";
import { GameService } from "../services/game.Service.js";
import { OrderService } from "../services/order.Service.js";
import { PurchasedItemsService } from "../services/purchasedItems.Service.js";
import { CategoryController, CategoryRepository, CategoryService } from "@modules/category/index.js";
import pool from "@shared/config/database.js";

import type { Guards } from "@shared/types/guards.js";
import { createAuthMiddleware } from "@modules/auth/auth.middleware.js";
import { createRoleMiddleware } from "@modules/auth/role.middleware.js";
import { UserRepository } from "@modules/user/user.repository.js";
import { UserRoleRepository } from "@modules/user/role/user-role.repository.js";
import { RoleRepository } from "@modules/user/role/role.repository.js";
import { RoleService } from "@modules/user/role/role.service.js";
import { UserService } from "@modules/user/user.service.js";
import { UserController } from "@modules/user/user.controller.js";
import { RoleController } from "@modules/user/role/role.controller.js";

export const userRepository     = new UserRepository();
const gameRepository     = new GameRepository(pool);
const orderRepository    = new OrderRepository();
const categoryRepository = new CategoryRepository();
const purchasedItemsRepository = new PurchasedItemsRepository();
const userRoleRepository = new UserRoleRepository();
const roleRepository = new RoleRepository();

export const roleService = new RoleService(roleRepository, userRoleRepository, userRepository);
export const userService          = new UserService(userRepository, userRoleRepository, roleService, pool);
export const gameService          = new GameService(gameRepository, pool);
export const orderService         = new OrderService(orderRepository);
export const categoryService      = new CategoryService(categoryRepository);
export const purchasedItemsService = new PurchasedItemsService(purchasedItemsRepository);
export const authService          = new AuthService(userRepository, userRoleRepository);
export const checkoutService = new CheckoutService(orderService, purchasedItemsService);

export const uploadController   = new UploadController();
export const userController     = new UserController(userService);
export const gameController     = new GameController(gameService);
export const orderController    = new OrderController(orderService);
export const categoryController = new CategoryController(categoryService);
export const authController     = new AuthController(authService);
export const checkoutController = new CheckoutController(checkoutService, orderService);
export const roleController = new RoleController(roleService);

export const guards: Guards = {
  authenticate: createAuthMiddleware({ findById: (id_user: number) => userService.findById(id_user) }),
  authorize: createRoleMiddleware({ getRoleVersion: (id_user: number) => userRepository.getRoleVersion(id_user) })
}
