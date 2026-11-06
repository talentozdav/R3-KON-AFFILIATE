import { Request, Response, NextFunction } from 'express';
import { verifySupabaseToken, AuthenticatedUser } from '../supabase.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Server-side authorization middleware.
 * Verifies JWT access tokens using Supabase Auth or cryptographic store.
 * Never trusts client headers or raw emails for authorization.
 */
export async function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const user = await verifySupabaseToken(token);
      if (user && user.status === 'active') {
        req.user = user;
      }
    } catch (err: any) {
      console.warn('[R3 Auth Middleware] Token verification failed:', err.message);
    }
  }

  next();
}

/**
 * Enforces authenticated session
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be authenticated with a valid session token to access this resource.'
    });
  }
  next();
}

/**
 * Enforces role-based permissions verified from trusted database records
 */
export function requireRoles(...allowedRoles: Array<'super_admin' | 'affiliate_manager' | 'finance_manager' | 'affiliate' | 'client'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be authenticated to perform this operation.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `Role '${req.user.role}' is not authorized. Permitted roles: ${allowedRoles.join(', ')}.`
      });
    }

    next();
  };
}
