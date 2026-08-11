import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Env } from '../../env';
import type { RequestUser } from '../../common/types/request-user';

/**
 * Opaque server-side sessions.
 *
 * The cookie carries a 256-bit random token; only its SHA-256 hash is stored, so a
 * database leak yields no usable sessions. SHA-256 is the right primitive here (not
 * argon2) precisely because the token is high-entropy random rather than a password
 * — there is nothing to brute-force, and lookups must stay fast.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  get cookieName(): string {
    return this.config.get('SESSION_COOKIE_NAME');
  }

  private get ttlMs(): number {
    return this.config.get('SESSION_TTL_DAYS') * 24 * 60 * 60 * 1000;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      // Same-origin in every environment (Vite proxy in dev, Caddy in prod), so Lax
      // is sufficient and no Domain attribute is set — the cookie stays host-only.
      secure: this.config.get('NODE_ENV') === 'production',
      path: '/',
      maxAge: this.ttlMs,
    };
  }

  async issue(
    userId: string,
    response: Response,
    meta: { userAgent?: string; ip?: string } = {},
  ): Promise<void> {
    const token = randomBytes(32).toString('base64url');

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + this.ttlMs),
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
        ip: meta.ip ?? null,
      },
    });

    response.cookie(this.cookieName, token, this.cookieOptions());
  }

  /** Resolves a raw cookie token to a user, or null if absent, expired or revoked. */
  async resolve(token: string): Promise<RequestUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: { include: { organization: true } } },
    });

    if (!session) return null;

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }

    if (session.user.deactivatedAt) return null;

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      organizationId: session.user.organizationId,
      organization: {
        id: session.user.organization.id,
        name: session.user.organization.name,
        slug: session.user.organization.slug,
      },
      sessionId: session.id,
    };
  }

  async revoke(sessionId: string, response: Response): Promise<void> {
    await this.prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
    this.clearCookie(response);
  }

  clearCookie(response: Response): void {
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    response.clearCookie(this.cookieName, options);
  }
}
