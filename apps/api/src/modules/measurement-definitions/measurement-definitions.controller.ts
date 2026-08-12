import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { MeasurementDefinitionList } from '@fitmybike/shared';
import { MeasurementDefinitionListDto } from './measurement-definitions.dto';
import { MeasurementDefinitionsService } from './measurement-definitions.service';

/**
 * The catalog is identical for every studio, so there is no @CurrentUser here and no
 * tenant scoping — but it still sits behind the global AuthGuard. It is not public.
 */
@ApiTags('measurement-definitions')
@Controller('measurement-definitions')
export class MeasurementDefinitionsController {
  constructor(private readonly definitions: MeasurementDefinitionsService) {}

  @Get()
  @ApiOkResponse({ type: MeasurementDefinitionListDto })
  list(): Promise<MeasurementDefinitionList> {
    return this.definitions.list();
  }
}
