import {MercadoPagoConfig,  Payment,  Preference } from "mercadopago";
import { OrderService } from "@modules/order/order.service.js";
import { PurchasedItemsService } from "@modules/order/purchased-items.service.js";
import type { CreateCheckoutDTO } from "@modules/order/dto/checkout.dto.js";
import type { PurchasedItemsDTO } from "@modules/order/dto/purchased-items.dto.js";
import type { CartItem } from "@shared/types/cartItem.js";
import type { GamePrice, GamePriceReader } from "@modules/order/game-price.reader.js";
import { AppError } from "@shared/errors/AppError.js";
type PaymentStatus = 'approved' | 'pending' | 'canceled';

export class CheckoutService{

    constructor(
        private orderService: OrderService,
        private purchasedItemsService: PurchasedItemsService,
        private gamePriceReader: GamePriceReader
    ) {}

        async createPreference(dto: CreateCheckoutDTO): Promise<{
            preference_id: string | undefined;
            checkout_url: string | undefined;
        }>{
            // O cliente só manda os ids: título, preço e total vêm do servidor.
            const { items, total } = await this.priceCart(dto.items);

            for (const item of items) {
                const canBuy = await this.orderService.canPurchaseGame(dto.user.id_user, item.id_game);
                if (!canBuy) throw new AppError(`Você já possui o jogo "${item.title}" na sua biblioteca.`, 400, "USER_ALREADY_HAVE_GAME");
            }

            const client = this.createMercadoPagoClient();
            const preferenceClient = new Preference(client);

            const external_reference = this.generateExternalReference();

            const preference = await this.createMercadoPreference(preferenceClient, dto.user, items, external_reference);

            const id_order = await this.createOrder(dto.user.id_user, total, preference.id!, external_reference);

            await this.createPurchasedItems({id_order, items});

            return { preference_id: preference.id, checkout_url: preference.init_point ?? preference.sandbox_init_point};
        }

        async getPaymentStatus(payment_id: string): Promise<void> {
            const client = this.createMercadoPagoClient();

            const paymentClient = new Payment(client);
            const payment = await paymentClient.get({ id: payment_id });

            const status = this.mapStatus(payment.status);

            const external_reference = payment.external_reference!;

            await this.orderService.updateOrderStatus({status, external_reference})
        }

        // Monta o carrinho com os dados reais do banco. O total é somado em centavos (inteiros)
        // para evitar erro de ponto flutuante (0.1 + 0.2 !== 0.3).
        private async priceCart(requested: CreateCheckoutDTO["items"] | undefined): Promise<{ items: CartItem[]; total: number }> {
            if (!Array.isArray(requested) || requested.length === 0) {
                throw new AppError("O carrinho está vazio.", 400, "EMPTY_CART");
            }

            // ids repetidos viram um só
            const ids = [...new Set(requested.map(item => Number(item?.id_game)))];

            if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
                throw new AppError("Id de jogo inválido no carrinho.", 400, "INVALID_GAME_ID");
            }

            const found = await this.gamePriceReader.findPricesByIds(ids);
            const byId = new Map(found.map(game => [game.id_game, game]));

            const games: GamePrice[] = [];
            for (const id of ids) {
                const game = byId.get(id);
                if (!game) throw new AppError("Um ou mais jogos do carrinho não existem ou estão indisponíveis.", 404, "GAME_NOT_FOUND");
                games.push(game);
            }

            const totalInCents = games.reduce((sum, game) => sum + game.priceInCents, 0);

            return {
                items: games.map(game => ({ id_game: game.id_game, title: game.title, price: game.priceInCents / 100 })),
                total: totalInCents / 100
            };
        }

        private createMercadoPagoClient(): MercadoPagoConfig {
            return new MercadoPagoConfig({
                accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!
            });
        }

        private generateExternalReference(): string {
            return `order_${Date.now()}`;
        }

        private async createMercadoPreference(
            preference: Preference,
            user: CreateCheckoutDTO["user"],
            items: CartItem[],
            external_reference: string
        ) {
            return preference.create({
                body: {
                    payer: {
                        name: user.name,
                        email: "TESTUSER8052695651117258427@testuser.com"
                    },
                    items: items.map(item => ({
                        id: String(item.id_game),
                        title: item.title,
                        quantity: 1,
                        currency_id: "BRL",
                        unit_price: Number(item.price)
                    })),
                    external_reference,
                    back_urls: {
                        success: `${process.env.NGROK_URL}/api/checkout/success`,
                        failure: `${process.env.NGROK_URL}/api/checkout/failure`,
                        pending: `${process.env.NGROK_URL}/api/checkout/pending`
                    },
                    auto_return: "approved",
                    notification_url: `${process.env.NGROK_URL}/api/checkout/webhook`
                }
            });
        }

        private async createOrder(
            id_user: number,
            total: number,
            preference_id: string,
            external_reference: string
        ): Promise<number> {
            return this.orderService.createOrder({
                status: 'pending',
                preference_id,
                external_reference,
                id_user,
                total
            });
        }

        private async createPurchasedItems(query: PurchasedItemsDTO) {
            return this.purchasedItemsService.createItems({
                id_order: query.id_order,
                items: query.items
            });
        }

        private mapStatus(status?: string): PaymentStatus {
            const map: Record<string, PaymentStatus> = {
                approved: 'approved',
                pending:  'pending',
                rejected: 'canceled',
                cancelled:'canceled',
            };

            return map[status ?? ''] ?? 'pending';
        }
}
