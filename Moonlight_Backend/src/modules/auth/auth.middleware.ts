import type { NextFunction, Request, Response } from "express";
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

interface JwtPayload {
  id_user: number;
  roles: string[];
  role_version: number;
}

export function createAuthMiddleware(deps:
  { findById: (id_user: number) => Promise<{ id_user: number } | null> }
) {
  return async (req: Request, res: Response, next: NextFunction) => {

    const token = req.headers.authorization;
    if (!token || !token.startsWith('Bearer')) return res.status(401).json({ message: 'Token não fornecido' });

    const parts = token.split(" ");
    if (parts.length !== 2 || !parts[1]) return res.status(403).json({ message: 'Token inválido' });

    const tokenValue = parts[1];

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: 'JWT_SECRET não configurado' });

    try {
      jwt.verify(tokenValue, secret, async (err, decoded) => {
          if (err || !decoded) return res.status(403).json({ message: 'Token inválido' });

          const payload = decoded as JwtPayload;

          const user = await deps.findById(payload.id_user);
          if (!user) return res.status(401).json({ message: 'Usuário não encontrado' });

          req.user = { id_user: payload.id_user, roles: payload.roles, role_version: payload.role_version };
          next();
      });
    } catch {
      return res.status(403).json({ message: 'Token inválido' });
    }
  }
}
