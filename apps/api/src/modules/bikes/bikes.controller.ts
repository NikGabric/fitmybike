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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Bike, BikeList } from '@fitmybike/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { BikeDto, BikeListDto, CreateBikeDto, UpdateBikeDto } from './bikes.dto';
import { BikesService } from './bikes.service';

/**
 * Bikes are created and listed under their owner, so the customer is in the path.
 * That is safe — `customerId` is not the tenant id, and the service still resolves it
 * through forOrg. The organization comes from @CurrentUser and nowhere else.
 */
@ApiTags('bikes')
@Controller('customers/:customerId/bikes')
export class CustomerBikesController {
  constructor(private readonly bikes: BikesService) {}

  @Get()
  @ApiOkResponse({ type: BikeListDto })
  @ApiNotFoundResponse({ description: 'No such customer in this organization' })
  list(
    @CurrentUser() user: RequestUser,
    @Param('customerId') customerId: string,
  ): Promise<BikeList> {
    return this.bikes.listForCustomer(user.organizationId, customerId);
  }

  @Post()
  @ApiCreatedResponse({ type: BikeDto })
  @ApiNotFoundResponse({ description: 'No such customer in this organization' })
  create(
    @CurrentUser() user: RequestUser,
    @Param('customerId') customerId: string,
    @Body() dto: CreateBikeDto,
  ): Promise<Bike> {
    return this.bikes.create(user.organizationId, customerId, user.id, dto);
  }
}

/** A bike id is unique on its own, so reads and writes do not need the owner in the path. */
@ApiTags('bikes')
@Controller('bikes')
export class BikesController {
  constructor(private readonly bikes: BikesService) {}

  @Get(':id')
  @ApiOkResponse({ type: BikeDto })
  @ApiNotFoundResponse({ description: 'No such bike in this organization' })
  get(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<Bike> {
    return this.bikes.get(user.organizationId, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: BikeDto })
  @ApiNotFoundResponse({ description: 'No such bike in this organization' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateBikeDto,
  ): Promise<Bike> {
    return this.bikes.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Bike archived' })
  @ApiNotFoundResponse({ description: 'No such bike in this organization' })
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<void> {
    return this.bikes.remove(user.organizationId, id);
  }
}
