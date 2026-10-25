import { HttpStatus } from '@nestjs/common';
import { domainHttp } from '../../../common/domain-http';

export const { toHttp, unwrap } = domainHttp({
  ORGANIZATION_NOT_FOUND: HttpStatus.NOT_FOUND,
  FACILITY_NOT_FOUND: HttpStatus.NOT_FOUND,
  FACILITY_CODE_ALREADY_EXISTS: HttpStatus.CONFLICT,
  STRUCTURE_NODE_NOT_FOUND: HttpStatus.NOT_FOUND,
  STRUCTURE_CODE_ALREADY_EXISTS: HttpStatus.CONFLICT,
  STRUCTURE_PARENT_INACTIVE: HttpStatus.CONFLICT,
  STRUCTURE_HAS_ACTIVE_CHILDREN: HttpStatus.CONFLICT,
});
