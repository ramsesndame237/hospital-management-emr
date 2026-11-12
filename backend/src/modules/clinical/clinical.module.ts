import { DynamicModule, Module } from '@nestjs/common';
import { SQL_EXECUTOR, SqlExecutor } from '../../database/sql-executor';
import { CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../shared-kernel/ports';
import { SERVICE_ACCESS, ServiceAccess } from '../../shared-kernel/service-access';
import { AUDIT_LOG, AuditLog } from '../audit/domain/audit-log.port';
import { AllergyUseCases } from './application/use-cases/allergies';
import { EncounterActionUseCases, GetEncounterUseCase, ListEncountersUseCase, QueueUseCase, StartEncounterUseCase } from './application/use-cases/encounters';
import { CancelPrescriptionUseCase, GetPrescriptionUseCase, IssuePrescriptionUseCase, ListEncounterPrescriptionsUseCase, SearchDrugsUseCase } from './application/use-cases/prescriptions';
import { ClinicalDependencies } from './application/views';
import {
  ALLERGY_REPOSITORY, AllergyRepository, CLINICAL_DRUGS, CLINICAL_PATIENTS, CLINICAL_USERS, CLINICAL_VISITS, DrugDirectory, ENCOUNTER_REPOSITORY, EncounterRepository, PatientDirectory, PRESCRIPTION_REPOSITORY,
  PrescriptionRepository, UserDirectory, VisitDirectory,
} from './domain/ports';
import { PgAllergyRepository } from './infrastructure/persistence/pg-allergy.repository';
import { PgEncounterRepository } from './infrastructure/persistence/pg-encounter.repository';
import { PgPrescriptionRepository } from './infrastructure/persistence/pg-prescription.repository';
import { ClinicalAllergiesController } from './presentation/allergies.controller';
import { ClinicalEncountersController } from './presentation/encounters.controller';
import { ClinicalPrescriptionsController } from './presentation/prescriptions.controller';

const DEPENDENCIES = Symbol('CLINICAL_DEPENDENCIES');

/**
 * Module Clinique (consultations, allergies et ordonnances). Les ports de persistance sont reliés à PostgreSQL ici ; les patients, les comptes et les admissions
 * sont fournis par la racine de composition (`src/integration`). L'accès est contrôlé par les gardes globaux de l'IAM (`@RequirePermissions`) et,
 * par service, par le port `ServiceAccess`.
 */
@Module({})
export class ClinicalModule {
  static register(): DynamicModule {
    const use = <T>(factory: (d: ClinicalDependencies) => T) => ({ inject: [DEPENDENCIES], useFactory: factory });
    return {
      module: ClinicalModule,
      controllers: [ClinicalEncountersController, ClinicalAllergiesController, ClinicalPrescriptionsController],
      providers: [
        { provide: ENCOUNTER_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgEncounterRepository(sql) },
        { provide: ALLERGY_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgAllergyRepository(sql) },
        { provide: PRESCRIPTION_REPOSITORY, inject: [SQL_EXECUTOR], useFactory: (sql: SqlExecutor) => new PgPrescriptionRepository(sql) },
        {
          provide: DEPENDENCIES,
          inject: [ENCOUNTER_REPOSITORY, ALLERGY_REPOSITORY, PRESCRIPTION_REPOSITORY, CLINICAL_DRUGS, CLINICAL_PATIENTS, CLINICAL_USERS, CLINICAL_VISITS, SERVICE_ACCESS, AUDIT_LOG, CLOCK, ID_GENERATOR],
          useFactory: (encounters: EncounterRepository, allergies: AllergyRepository, prescriptions: PrescriptionRepository, drugs: DrugDirectory, patients: PatientDirectory, users: UserDirectory, visits: VisitDirectory, access: ServiceAccess, audit: AuditLog, clock: Clock, ids: IdGenerator): ClinicalDependencies => ({
            encounters, allergies, prescriptions, drugs, patients, users, visits, access, audit, clock, ids,
          }),
        },
        { provide: StartEncounterUseCase, ...use((d) => new StartEncounterUseCase(d)) },
        { provide: GetEncounterUseCase, ...use((d) => new GetEncounterUseCase(d)) },
        { provide: ListEncountersUseCase, ...use((d) => new ListEncountersUseCase(d)) },
        { provide: QueueUseCase, ...use((d) => new QueueUseCase(d)) },
        { provide: EncounterActionUseCases, ...use((d) => new EncounterActionUseCases(d)) },
        { provide: AllergyUseCases, ...use((d) => new AllergyUseCases(d)) },
        { provide: SearchDrugsUseCase, ...use((d) => new SearchDrugsUseCase(d)) },
        { provide: IssuePrescriptionUseCase, ...use((d) => new IssuePrescriptionUseCase(d)) },
        { provide: ListEncounterPrescriptionsUseCase, ...use((d) => new ListEncounterPrescriptionsUseCase(d)) },
        { provide: GetPrescriptionUseCase, ...use((d) => new GetPrescriptionUseCase(d)) },
        { provide: CancelPrescriptionUseCase, ...use((d) => new CancelPrescriptionUseCase(d)) },
      ],
    };
  }
}
