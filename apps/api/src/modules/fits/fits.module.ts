import { Module } from '@nestjs/common';
import { MeasurementDefinitionsModule } from '../measurement-definitions/measurement-definitions.module';
import { FitsController } from './fits.controller';
import { FitsService } from './fits.service';

@Module({
  imports: [MeasurementDefinitionsModule],
  controllers: [FitsController],
  providers: [FitsService],
})
export class FitsModule {}
