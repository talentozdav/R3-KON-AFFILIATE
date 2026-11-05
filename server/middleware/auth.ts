import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { User, UserRole } from '../types.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const userEmail = req.headers['x-user-email'] as string || token;

  if (userEmail) {
    const user = db.users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
    if (user && user.status === 'active') {
      req.user = user;
    }
  }

  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be authenticated to access this resource.'
    });
  }
  next();
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be authenticated to access this resource.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `Role '${req.user.role}' is not authorized to perform this operation. Permitted roles: ${allowedRoles.join(', ')}.`
      });
    }

    next();
  };
}
