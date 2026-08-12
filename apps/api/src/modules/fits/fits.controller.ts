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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Fit, FitList } from '@fitmybike/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user';
import {
  CreateFitDto,
  FitDto,
  FitListDto,
  FitListQueryDto,
  UpdateBikeMeasurementsDto,
  UpdateBodyMeasurementsDto,
  UpdateFitDto,
} from './fits.dto';
import { FitsService } from './fits.service';

@ApiTags('fits')
@Controller('fits')
export class FitsController {
  constructor(private readonly fits: FitsService) {}

  @Get()
  @ApiOkResponse({ type: FitListDto })
  list(@CurrentUser() user: RequestUser, @Query() query: FitListQueryDto): Promise<FitList> {
    return this.fits.list(user.organizationId, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: FitDto })
  @ApiNotFoundResponse({ description: 'No such fit in this organization' })
  get(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<Fit> {
    return this.fits.get(user.organizationId, id);
  }

  @Post()
  @ApiCreatedResponse({ type: FitDto })
  @ApiNotFoundResponse({ description: 'No such customer or bike in this organization' })
  @ApiUnprocessableEntityResponse({ description: 'The bike belongs to a different customer' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateFitDto): Promise<Fit> {
    return this.fits.create(user.organizationId, user.id, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: FitDto })
  @ApiNotFoundResponse({ description: 'No such fit in this organization' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateFitDto,
  ): Promise<Fit> {
    return this.fits.update(user.organizationId, id, dto);
  }

  /**
   * Separate endpoints for body and bike because the payloads genuinely differ: the
   * bike batch names a stage, the body batch has no stage to name. Each is what one
   * wizard screen autosaves.
   */
  @Patch(':id/body-measurements')
  @ApiOkResponse({ type: FitDto })
  @ApiNotFoundResponse({ description: 'No such fit in this organization' })
  @ApiUnprocessableEntityResponse({ description: 'A measurement is unknown or out of range' })
  updateBodyMeasurements(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateBodyMeasurementsDto,
  ): Promise<Fit> {
    return this.fits.updateBodyMeasurements(user.organizationId, id, dto);
  }

  @Patch(':id/bike-measurements')
  @ApiOkResponse({ type: FitDto })
  @ApiNotFoundResponse({ description: 'No such fit in this organization' })
  @ApiUnprocessableEntityResponse({ description: 'A measurement is unknown or out of range' })
  updateBikeMeasurements(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateBikeMeasurementsDto,
  ): Promise<Fit> {
    return this.fits.updateBikeMeasurements(user.organizationId, id, dto);
  }

  // 200, not the POST default of 201: this updates an existing fit rather than
  // creating anything, and returns that same fit.
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: FitDto })
  @ApiNotFoundResponse({ description: 'No such fit in this organization' })
  complete(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<Fit> {
    return this.fits.complete(user.organizationId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Fit archived' })
  @ApiNotFoundResponse({ description: 'No such fit in this organization' })
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<void> {
    return this.fits.remove(user.organizationId, id);
  }
}
