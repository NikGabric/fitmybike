import { Module } from '@nestjs/common';
import { MeasurementDefinitionsController } from './measurement-definitions.controller';
import { MeasurementDefinitionsService } from './measurement-definitions.service';

@Module({
  controllers: [MeasurementDefinitionsController],
  providers: [MeasurementDefinitionsService],
  // Exported so FitsService can resolve measurement keys to definition ids.
  exports: [MeasurementDefinitionsService],
})
export class MeasurementDefinitionsModule {}
