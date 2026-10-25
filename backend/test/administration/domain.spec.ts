import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Facility } from '../../src/modules/administration/domain/entities/facility';
import { Organization } from '../../src/modules/administration/domain/entities/organization';
import { FacilityCode } from '../../src/modules/administration/domain/value-objects/facility-code';
import { FacilityId } from '../../src/modules/administration/domain/value-objects/facility-id';
import { FacilityName } from '../../src/modules/administration/domain/value-objects/facility-name';
import { FacilityStatus, FacilityStatusEnum } from '../../src/modules/administration/domain/value-objects/FacilityStatus';
import { OrganizationId } from '../../src/modules/administration/domain/value-objects/organization-id';
import { OrganizationName } from '../../src/modules/administration/domain/value-objects/organization-name';
import { must } from '../iam/fakes';

const ORG_UUID = '0b6e8a3c-5d1f-4a7e-9c2b-123456789012'; // chiffres 1 à 8 dans le dernier groupe : cas qui était refusé par une faute de regex
const FACILITY_UUID = '9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f';

const organization = () => must(Organization.create(must(OrganizationId.create(ORG_UUID)), must(OrganizationName.create('Groupe hospitalier Saint-Paul'))));
const facility = (status?: FacilityStatus) =>
  must(Facility.create(must(FacilityName.create('Hôpital central')), must(FacilityCode.create('A1B2-abc-12')), must(FacilityId.create(FACILITY_UUID)), must(OrganizationId.create(ORG_UUID)), status));

describe('Organisation hospitalière — objets-valeurs', () => {
  it.each([
    ['OrganizationId', OrganizationId.create, ORG_UUID],
    ['FacilityId', FacilityId.create, FACILITY_UUID],
  ])('%s : accepte un UUID (même avec des chiffres dans le dernier groupe), le met en minuscules et refuse le reste', (_name, create, uuid) => {
    expect(must(create(uuid)).value).toBe(uuid);
    expect(must(create(`  ${uuid.toUpperCase()} `)).value).toBe(uuid);
    for (const bad of ['', 'abc', '0b6e8a3c-5d1f-4a7e-9c2b-12345678901', 'zzzzzzzz-5d1f-4a7e-9c2b-123456789012', '0b6e8a3c-5d1f-9a7e-9c2b-123456789012']) {
      expect(create(bad).ok).toBe(false);
    }
  });

  it("OrganizationName et FacilityName : texte nettoyé, vide refusé, avec un code d'erreur stable", () => {
    expect(must(OrganizationName.create('  CHU de Douala ')).value).toBe('CHU de Douala');
    expect(must(FacilityName.create('  Annexe ')).value).toBe('Annexe');
    const org = OrganizationName.create('   ');
    const fac = FacilityName.create('');
    expect(org.ok ? '' : org.error.code).toBe('ORGANIZATION_NAME_INVALID');
    expect(fac.ok ? '' : fac.error.code).toBe('FACILITY_NAME_INVALID');
  });

  it('les identifiants invalides portent leur code d’erreur', () => {
    const org = OrganizationId.create('nope');
    const fac = FacilityId.create('nope');
    expect(org.ok ? '' : org.error.code).toBe('ORGANIZATION_ID_INVALID');
    expect(fac.ok ? '' : fac.error.code).toBe('FACILITY_ID_INVALID');
    expect(fac.ok ? '' : fac.error.message).toContain("L'identifiant"); // l'apostrophe n'est plus avalée
  });

  it('FacilityCode : se crée par une fabrique statique, accepte le format défini et refuse le reste', () => {
    expect(must(FacilityCode.create('  A1B2-abc-12 ')).value).toBe('A1B2-abc-12');
    for (const bad of ['', 'a1b2-abc-12', 'A1B2-ABC-12', 'A1B2-abc-1', 'A1B2abc12']) {
      const result = FacilityCode.create(bad);
      expect(result.ok).toBe(false);
      expect(result.ok ? '' : result.error.code).toBe('FACILITY_CODE_INVALID');
    }
  });

  it('FacilityStatus : accepte une valeur connue quelle que soit la casse, refuse l’inconnue en transmettant la valeur', () => {
    expect(must(FacilityStatus.create(' operational_open ')).getValue()).toBe(FacilityStatusEnum.OPERATIONAL_OPEN);
    const bad = FacilityStatus.create('OUVERT');
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.code).toBe('FACILITY_STATUS_INVALID');
      expect(bad.error.details).toEqual({ value: 'OUVERT' }); // alimente le message traduit « Statut d'établissement invalide : {value} »
    }
  });

  it('les objets-valeurs sont immuables et comparés par valeur', () => {
    const a = must(FacilityName.create('Annexe'));
    expect(a.equals(must(FacilityName.create(' Annexe ')))).toBe(true);
    expect(() => {
      (a as unknown as { value: string }).value = 'Autre';
    }).toThrow();
  });
});

describe('Organisation hospitalière — entités', () => {
  it('Organization : se crée, se renomme, se compare par identifiant', () => {
    const org = organization();
    expect(org.getName().value).toBe('Groupe hospitalier Saint-Paul');
    org.updateName(must(OrganizationName.create('Groupe Saint-Paul')));
    expect(org.getName().value).toBe('Groupe Saint-Paul');
    expect(org.testMatch(organization())).toBe(true);
  });

  it('Facility : un nouvel établissement est « en projet » et n’est pas opérationnel', () => {
    const f = facility();
    expect(f.getStatus().getValue()).toBe(FacilityStatusEnum.OPERATIONAL_UNDER_CONSTRUCTION);
    expect(f.isOperational()).toBe(false);
    expect(f.getOrganizationId().value).toBe(ORG_UUID);
  });

  it('Facility : devient opérationnel quand son statut est « ouvert », se compare par identifiant', () => {
    const f = facility(FacilityStatus.fromEnum(FacilityStatusEnum.OPERATIONAL_OPEN));
    expect(f.isOperational()).toBe(true);
    f.updateStatus(FacilityStatus.fromEnum(FacilityStatusEnum.OPERATIONAL_TEMPORARILY_CLOSED));
    expect(f.isOperational()).toBe(false);
    expect(f.equals(facility())).toBe(true);
  });
});

describe('Organisation hospitalière — messages traduits', () => {
  const catalog = (locale: string, file: string): Record<string, string> => JSON.parse(readFileSync(join(__dirname, `../../src/modules/i18n/catalogs/${locale}/${file}.json`), 'utf8'));
  const CODES = ['ORGANIZATION_ID_INVALID', 'ORGANIZATION_NAME_INVALID', 'FACILITY_ID_INVALID', 'FACILITY_NAME_INVALID', 'FACILITY_CODE_INVALID', 'FACILITY_STATUS_INVALID'];

  it.each(['fr', 'en'])('%s : chaque code d’erreur du domaine a son message, sans double espace ni accolades doubles', (locale) => {
    const errors = catalog(locale, 'errors');
    for (const code of CODES) {
      expect(errors[code]).toBeDefined();
      expect(errors[code]).not.toMatch(/ {2}/);
      expect(errors[code]).not.toContain('{{');
    }
    expect(errors['FACILITY_STATUS_INVALID']).toContain('{value}');
  });

  it('chaque statut d’établissement est traduit dans les deux langues', () => {
    for (const locale of ['fr', 'en']) {
      const status = catalog(locale, 'status');
      for (const value of Object.values(FacilityStatusEnum)) expect(status[value]).toBeDefined();
    }
  });
});
