import { HttpStatus } from '@nestjs/common';
import { domainHttp } from '../../../common/domain-http';

export const { toHttp, unwrap } = domainHttp({
  ORGANIZATION_NOT_FOUND: HttpStatus.NOT_FOUND,
  FACILITY_NOT_FOUND: HttpStatus.NOT_FOUND,
  FACILITY_CODE_ALREADY_EXISTS: HttpStatus.CONFLICT,
});
