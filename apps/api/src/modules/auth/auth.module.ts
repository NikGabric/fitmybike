import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService],
  // AuthGuard is registered globally in AppModule and resolves sessions through this.
  exports: [SessionService],
})
export class AuthModule {}
