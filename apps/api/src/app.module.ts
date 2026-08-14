import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { LOGIN_RATE_LIMIT } from './modules/auth/login-rate-limit';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { validateEnv } from './env';
import { AuthModule } from './modules/auth/auth.module';
import { BikesModule } from './modules/bikes/bikes.module';
import { CustomersModule } from './modules/customers/customers.module';
import { FitsModule } from './modules/fits/fits.module';
import { HealthModule } from './modules/health/health.module';
import { MeasurementDefinitionsModule } from './modules/measurement-definitions/measurement-definitions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The repo-root .env is the single source of truth; the local one is a fallback
      // for running the app from a different working directory.
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
      cache: true,
    }),
    // Registered globally so the guard can be injected, but the guard itself is applied
    // only to `login` — see login-rate-limit.ts for why this is not an APP_GUARD.
    ThrottlerModule.forRoot([LOGIN_RATE_LIMIT]),
    PrismaModule,
    AuthModule,
    HealthModule,
    CustomersModule,
    MeasurementDefinitionsModule,
    BikesModule,
    FitsModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: AuthGuard populates request.user, RolesGuard then reads it.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
