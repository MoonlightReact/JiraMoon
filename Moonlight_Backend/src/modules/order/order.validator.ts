import type { CreateOrderDTO, UpdateOrderDTO } from "@modules/order/dto/order.input.dto.js";
import { AppError } from "@shared/errors/AppError.js";
import { assertPrice, assertRequiredFields } from "@shared/validator/common.validator.js";
type validOrderStatus = "pending" | "approved" | "canceled";

    const isOrderStatusValid = (type: string): type is validOrderStatus => {
        return ['pending', 'approved', 'canceled'].includes(type as validOrderStatus);
    }

    const assertIsOrderStatusValid = (orderStatus: string): void => {
        if(!isOrderStatusValid(orderStatus)) throw new AppError("O Status de Pedido é inválido", 400, "INVALID_ORDER_STATUS");
    }

    export const validateOrderCreate = (dto: CreateOrderDTO): void => {
        assertRequiredFields([dto.id_user, dto.preference_id, dto.external_reference, dto.status, dto.total]);
        assertPrice(dto.total);
        assertIsOrderStatusValid(dto.status);
    }

    export const validateOrderStatusUpdate = (dto: UpdateOrderDTO): void => {
        assertRequiredFields([dto.status]);
        assertIsOrderStatusValid(dto.status);
    }
