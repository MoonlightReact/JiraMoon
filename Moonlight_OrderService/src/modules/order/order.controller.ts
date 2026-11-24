import type { NextFunction, Request, Response } from "express";
import type { OrderService } from "./order.service.js";
import { AppError } from "@shared/errors/AppError.js";
import type { CreateOrderDTO, OrderStatus } from "@modules/order/order.types.js";

function toPositiveInt(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${label} inválido`, 400, "INVALID_PARAM");
  }
  return parsed;
}

export class OrderController {

  constructor(private readonly orderService: OrderService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.orderService.create(req.body as CreateOrderDTO);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.orderService.findById(toPositiveInt(req.params.id, "id"));
      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  };

  listByUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orders = await this.orderService.findByUser(toPositiveInt(req.params.id_user, "id_user"));
      res.status(200).json(orders);
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status } = req.body as { status: OrderStatus };
      const result = await this.orderService.updateStatus(String(req.params.external_reference), status);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
