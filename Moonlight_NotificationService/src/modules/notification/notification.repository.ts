import pool from "@shared/config/database.js";
import type { NewNotification } from "./notification.repository.types.js";


export class NotificationRepository {
  async createIfNotExists(data: NewNotification): Promise<boolean>{
    try {
      await pool.execute(
        `INSERT INTO notification (
          id_envelope,
          event_name,
          external_reference,
          recipient_email,
          status
        ) VALUES (?, ?, ?, ?, 'sent')`,
        [data.id_envelope, data.eventName, data.external_reference, data.email]
      );

      return true;
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "ER_DUP_ENTRY") return false;
      throw err;
    }
  }
}
