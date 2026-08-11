import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Customer, CustomerList } from '@fitmybike/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user';
import {
  CreateCustomerDto,
  CustomerDto,
  CustomerListDto,
  CustomerListQueryDto,
  UpdateCustomerDto,
} from './customers.dto';
import { CustomersService } from './customers.service';

/**
 * Reference module. Every later resource copies this shape: tenant id from
 * @CurrentUser, never from the request body or a path parameter.
 */
@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOkResponse({ type: CustomerListDto })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: CustomerListQueryDto,
  ): Promise<CustomerList> {
    return this.customers.list(user.organizationId, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: CustomerDto })
  @ApiNotFoundResponse({ description: 'No such customer in this organization' })
  get(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<Customer> {
    return this.customers.get(user.organizationId, id);
  }

  @Post()
  @ApiCreatedResponse({ type: CustomerDto })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCustomerDto,
  ): Promise<Customer> {
    return this.customers.create(user.organizationId, user.id, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CustomerDto })
  @ApiNotFoundResponse({ description: 'No such customer in this organization' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<Customer> {
    return this.customers.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Customer archived' })
  @ApiNotFoundResponse({ description: 'No such customer in this organization' })
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<void> {
    return this.customers.remove(user.organizationId, id);
  }
}
