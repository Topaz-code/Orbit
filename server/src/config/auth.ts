import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import { prisma } from './database.js';
import { env } from './env.js';
import { normalizePhone } from '../utils/helpers.js';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  tokenVersion: number;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.bcryptRounds);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: AccessTokenPayload, rememberMe = false): string {
  const options: SignOptions = {
    expiresIn: (rememberMe ? '7d' : env.accessTokenTtl) as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtRefreshSecret, {
    expiresIn: `${env.refreshTokenTtlDays}d`,
  });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
}

/**
 * Local strategy — accepts a username, phone number or email in the `identifier` field so the
 * login form works the way Telegram/WhatsApp users expect.
 */
passport.use(
  new LocalStrategy({ usernameField: 'identifier', passwordField: 'password' }, async (identifier, password, done) => {
    try {
      const value = identifier.trim();
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: value.toLowerCase().replace(/^@/, '') },
            { email: value.toLowerCase() },
            { phone: normalizePhone(value) },
          ],
        },
      });
      if (!user) return done(null, false, { message: 'No account matches those details' });
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) return done(null, false, { message: 'Incorrect password' });
      return done(null, user);
    } catch (error) {
      return done(error as Error);
    }
  }),
);

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.jwtSecret,
    },
    async (payload: AccessTokenPayload, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user) return done(null, false);
        if (user.tokenVersion !== payload.tokenVersion) return done(null, false);
        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    },
  ),
);

export { passport };
