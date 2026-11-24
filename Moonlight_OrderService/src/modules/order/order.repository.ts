import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "@shared/config/database.js";
import type { CreateOrderDTO, Order, OrderItem, OrderStatus } from "./order.types.js";

interface OrderRow extends RowDataPacket {
  id_order: number;
  id_user: number;
  status: OrderStatus;
  total: string; // DECIMAL volta como string no mysql2
  preference_id: string;
  external_reference: string;
  customer_name: string;
  customer_email: string;
  created_at: Date;
}

interface ItemRow extends RowDataPacket {
  id_order: number;
  id_game: number;
  title: string;
  image: string | null;
  price: string;
}

export class OrderRepository {

  /** Grava o pedido e os itens (snapshot) na mesma transação: ou grava tudo, ou nada. */
  async create(dto: CreateOrderDTO): Promise<number> {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO orders (id_user, status, total, preference_id, external_reference, customer_name, customer_email)
         VALUES (?, 'pending', ?, ?, ?, ?, ?)`,
        [dto.id_user, dto.total, dto.preference_id, dto.external_reference, dto.customer.name, dto.customer.email],
      );
      const id_order = result.insertId;

      const rows = dto.items.map(item => [id_order, item.id_game, item.title, item.image ?? null, item.price]);
      await connection.query("INSERT INTO order_items (id_order, id_game, title, image, price) VALUES ?", [rows]);

      await connection.commit();
      return id_order;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async findById(id_order: number): Promise<Order | null> {
    return this.findOne("id_order", id_order);
  }

  async findByExternalReference(external_reference: string): Promise<Order | null> {
    return this.findOne("external_reference", external_reference);
  }

  async findByUser(id_user: number): Promise<Order[]> {
    const [rows] = await pool.query<OrderRow[]>(
      "SELECT * FROM orders WHERE id_user = ? ORDER BY created_at DESC, id_order DESC",
      [id_user],
    );
    return this.attachItems(rows);
  }

  async existsByExternalReference(external_reference: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT 1 FROM orders WHERE external_reference = ? LIMIT 1",
      [external_reference],
    );
    return rows.length > 0;
  }

  /**
   * UPDATE condicional: só muda se o status for DIFERENTE do novo. É atômico, então o próprio banco
   * diz se houve transição: true = mudou agora, false = não existe ou já estava nesse status.
   * Quem chama publica o evento só quando recebe true (webhook repetido não republica).
   */
  async updateStatus(external_reference: string, status: OrderStatus): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "UPDATE orders SET status = ? WHERE external_reference = ? AND status <> ?",
      [status, external_reference, status],
    );
    return result.affectedRows === 1;
  }

  // `column` vem de uma união fechada de duas strings (nunca do usuário), por isso a interpolação é segura.
  private async findOne(column: "id_order" | "external_reference", value: number | string): Promise<Order | null> {
    const [rows] = await pool.query<OrderRow[]>(`SELECT * FROM orders WHERE ${column} = ?`, [value]);
    if (rows.length === 0) return null;

    const [order] = await this.attachItems(rows);
    return order ?? null;
  }

  private async attachItems(rows: OrderRow[]): Promise<Order[]> {
    if (rows.length === 0) return [];

    const ids = rows.map(row => row.id_order);
    const [itemRows] = await pool.query<ItemRow[]>("SELECT * FROM order_items WHERE id_order IN (?)", [ids]);

    const itemsByOrder = new Map<number, OrderItem[]>();
    for (const item of itemRows) {
      const list = itemsByOrder.get(item.id_order) ?? [];
      list.push({ id_game: item.id_game, title: item.title, image: item.image, price: Number(item.price) });
      itemsByOrder.set(item.id_order, list);
    }

    return rows.map(row => ({
      id_order: row.id_order,
      id_user: row.id_user,
      status: row.status,
      total: Number(row.total),
      preference_id: row.preference_id,
      external_reference: row.external_reference,
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      created_at: row.created_at,
      items: itemsByOrder.get(row.id_order) ?? [],
    }));
  }
}
