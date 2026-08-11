import { measurementDefinitionListSchema } from '@fitmybike/shared';
import { createZodDto } from 'nestjs-zod';

export class MeasurementDefinitionListDto extends createZodDto(measurementDefinitionListSchema) {}
