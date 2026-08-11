import {
  createFitSchema,
  fitListQuerySchema,
  fitListSchema,
  fitSchema,
  updateBikeMeasurementsSchema,
  updateBodyMeasurementsSchema,
  updateFitSchema,
} from '@fitmybike/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateFitDto extends createZodDto(createFitSchema) {}
export class UpdateFitDto extends createZodDto(updateFitSchema) {}
export class UpdateBodyMeasurementsDto extends createZodDto(updateBodyMeasurementsSchema) {}
export class UpdateBikeMeasurementsDto extends createZodDto(updateBikeMeasurementsSchema) {}
export class FitListQueryDto extends createZodDto(fitListQuerySchema) {}
export class FitDto extends createZodDto(fitSchema) {}
export class FitListDto extends createZodDto(fitListSchema) {}
