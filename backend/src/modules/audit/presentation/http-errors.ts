import { domainHttp } from '../../../common/domain-http';

/** Seule erreur de ce module : un filtre invalide (422, comme toute saisie invalide). */
export const { toHttp, unwrap } = domainHttp({});
