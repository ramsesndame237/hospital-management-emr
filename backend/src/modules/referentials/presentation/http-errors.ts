import { HttpStatus } from '@nestjs/common';
import { domainHttp } from '../../../common/domain-http';

export const { toHttp, unwrap } = domainHttp({
  REFERENTIAL_CATALOG_NOT_FOUND: HttpStatus.NOT_FOUND,
  REFERENTIAL_ENTRY_NOT_FOUND: HttpStatus.NOT_FOUND,
  REFERENTIAL_ENTRY_CODE_ALREADY_EXISTS: HttpStatus.CONFLICT,
});
