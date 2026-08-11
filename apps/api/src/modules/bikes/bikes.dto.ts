import { bikeListSchema, bikeSchema, createBikeSchema, updateBikeSchema } from '@fitmybike/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateBikeDto extends createZodDto(createBikeSchema) {}
export class UpdateBikeDto extends createZodDto(updateBikeSchema) {}
export class BikeDto extends createZodDto(bikeSchema) {}
export class BikeListDto extends createZodDto(bikeListSchema) {}
