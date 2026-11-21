import pool from "@shared/config/database.js";
import type { Guards } from "@shared/types/guards.js";

import { UserRepository } from "@modules/user/user.repository.js";
import { UserService } from "@modules/user/user.service.js";
import { UserController } from "@modules/user/user.controller.js";
import { RoleRepository } from "@modules/user/role/role.repository.js";
import { UserRoleRepository } from "@modules/user/role/user-role.repository.js";
import { RoleService } from "@modules/user/role/role.service.js";
import { RoleController } from "@modules/user/role/role.controller.js";

import { AuthService } from "@modules/auth/auth.service.js";
import { AuthController } from "@modules/auth/auth.controller.js";
import { createAuthMiddleware } from "@modules/auth/auth.middleware.js";
import { createRoleMiddleware } from "@modules/auth/role.middleware.js";

import { GameRepository } from "@modules/game/game.repository.js";
import { GameService } from "@modules/game/game.service.js";
import { GameController } from "@modules/game/game.controller.js";

import { CategoryRepository } from "@modules/category/category.repository.js";
import { CategoryService } from "@modules/category/category.service.js";
import { CategoryController } from "@modules/category/category.controller.js";

import { OrderRepository } from "@modules/order/order.repository.js";
import { OrderService } from "@modules/order/order.service.js";
import { OrderController } from "@modules/order/order.controller.js";
import { PurchasedItemsRepository } from "@modules/order/purchased-items.repository.js";
import { PurchasedItemsService } from "@modules/order/purchased-items.service.js";
import { CheckoutService } from "@modules/order/checkout.service.js";
import { CheckoutController } from "@modules/order/checkout.controller.js";

import { UploadController } from "@modules/upload/upload.controller.js";
import { CacheService } from "@shared/cache/cache.service.js";

export const userRepository     = new UserRepository();
const gameRepository     = new GameRepository(pool);
const orderRepository    = new OrderRepository();
const categoryRepository = new CategoryRepository();
const purchasedItemsRepository = new PurchasedItemsRepository();
const userRoleRepository = new UserRoleRepository();
const roleRepository = new RoleRepository();

const cacheService = new CacheService();
export const roleService = new RoleService(roleRepository, userRoleRepository, userRepository);
export const userService          = new UserService(userRepository, userRoleRepository, roleService, pool);
export const gameService          = new GameService(gameRepository, pool, cacheService);
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
export const checkoutController = new CheckoutController(checkoutService);
export const roleController = new RoleController(roleService);

export const guards: Guards = {
  authenticate: createAuthMiddleware({ findById: (id_user: number) => userService.findById(id_user) }),
  authorize: createRoleMiddleware({ getRoleVersion: (id_user: number) => userRepository.getRoleVersion(id_user) })
}
