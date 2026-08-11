import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import type { CurrentUser } from '@fitmybike/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestUser } from '../../common/types/request-user';

@Injectable()
export class AuthService {
  /**
   * A real hash of a random string, verified against when no account matches. Without
   * it the "unknown email" path returns in microseconds while the "wrong password"
   * path spends argon2 time, and that difference alone enumerates registered users.
   * Computed once, lazily, so it costs one hash per process rather than per request.
   */
  private readonly decoyHash: Promise<string> = argon2.hash(randomBytes(32).toString('hex'), {
    type: argon2.argon2id,
  });

  constructor(private readonly prisma: PrismaService) {}

  static hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async validateCredentials(email: string, password: string): Promise<{ id: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, passwordHash: true, deactivatedAt: true },
    });

    const hash = user?.passwordHash ?? (await this.decoyHash);
    const ok = await argon2.verify(hash, password).catch(() => false);

    if (!user || !ok || user.deactivatedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { id: user.id };
  }

  /** Loads the freshly-authenticated user for the login response. */
  async getCurrentUser(userId: string): Promise<CurrentUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization,
    };
  }

  toCurrentUser(user: RequestUser): CurrentUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization,
    };
  }
}
