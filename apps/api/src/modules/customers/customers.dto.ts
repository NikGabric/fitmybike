import {
  createCustomerSchema,
  customerListQuerySchema,
  customerListSchema,
  customerSchema,
  updateCustomerSchema,
} from '@fitmybike/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateCustomerDto extends createZodDto(createCustomerSchema) {}
export class UpdateCustomerDto extends createZodDto(updateCustomerSchema) {}
export class CustomerListQueryDto extends createZodDto(customerListQuerySchema) {}
export class CustomerDto extends createZodDto(customerSchema) {}
export class CustomerListDto extends createZodDto(customerListSchema) {}
