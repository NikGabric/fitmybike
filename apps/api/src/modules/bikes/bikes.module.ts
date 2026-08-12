import { Module } from '@nestjs/common';
import { BikesController, CustomerBikesController } from './bikes.controller';
import { BikesService } from './bikes.service';

@Module({
  controllers: [CustomerBikesController, BikesController],
  providers: [BikesService],
  exports: [BikesService],
})
export class BikesModule {}
