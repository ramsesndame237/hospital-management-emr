import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { domainHttp } from '../../../common/domain-http';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { PortalAccountUseCases, PortalReadUseCases } from '../application/use-cases/portal';
import { LinkAccountDto, PortalAccountDto, PortalAppointmentDto, PortalInvoiceDto, PortalPatientDto, PortalPrescriptionDto, PortalResultDto } from './dto/portal.dto';

const { unwrap } = domainHttp({
  PORTAL_NOT_LINKED: HttpStatus.NOT_FOUND,
  PORTAL_PATIENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  PORTAL_USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  PORTAL_ACCOUNT_NOT_FOUND: HttpStatus.NOT_FOUND,
  PORTAL_USER_NOT_PATIENT: HttpStatus.CONFLICT,
  PORTAL_USER_INACTIVE: HttpStatus.CONFLICT,
  PORTAL_ALREADY_LINKED: HttpStatus.CONFLICT,
});

const PATIENT: DocParam = { name: 'patientId', description: 'Identifiant du patient.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };

@DocGroup(
  'Portail patient',
  [
    'L’espace du patient : il consulte, depuis son compte, ses rendez-vous, ses résultats d’analyses **publiés**, ses ordonnances et ses factures.',
    '',
    '- Le compte du patient (rôle `PATIENT`) est **relié à un seul dossier** par l’accueil ; le portail ne lit que ce dossier — **jamais un identifiant donné dans la requête** : un patient ne peut pas demander le dossier d’un autre.',
    '- Un compte non relié reçoit 404 `PORTAL_NOT_LINKED`. Le lien ne se modifie pas (en base non plus).',
    '- Seuls les résultats que le laboratoire a validés et **publiés** apparaissent ; rien de la note clinique, des diagnostics ni des constantes.',
    '- Chaque lecture est inscrite au journal d’audit (section lue, pas le contenu).',
  ].join('\n'),
  60,
)
@Controller('api/v1/portal')
export class PortalController {
  constructor(private readonly read: PortalReadUseCases, private readonly accounts: PortalAccountUseCases) {}

  @DocOperation({
    summary: 'Mon dossier (identité)',
    description: 'L’identité du dossier auquel le compte est relié.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le patient.', type: PortalPatientDto }],
    errors: [404],
  })
  @RequirePermissions('portal:read:own') @Get('me')
  async me(@CurrentUser() actor: AuthUser): Promise<PortalPatientDto> {
    return unwrap(await this.read.me(actor.userId));
  }

  @DocOperation({
    summary: 'Mes rendez-vous',
    description: 'Les plus récents d’abord (30 au plus).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les rendez-vous.', type: PortalAppointmentDto, isArray: true }],
    errors: [404],
  })
  @RequirePermissions('portal:read:own') @Get('appointments')
  async appointments(@CurrentUser() actor: AuthUser): Promise<PortalAppointmentDto[]> {
    return unwrap(await this.read.appointments(actor.userId)) as unknown as PortalAppointmentDto[];
  }

  @DocOperation({
    summary: 'Mes résultats d’analyses',
    description: 'Les demandes dont tous les résultats sont **publiés**, les plus récentes d’abord (30 au plus).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les résultats publiés.', type: PortalResultDto, isArray: true }],
    errors: [404],
  })
  @RequirePermissions('portal:read:own') @Get('results')
  async results(@CurrentUser() actor: AuthUser): Promise<PortalResultDto[]> {
    return unwrap(await this.read.results(actor.userId)) as unknown as PortalResultDto[];
  }

  @DocOperation({
    summary: 'Mes ordonnances',
    description: 'Avec ce que la pharmacie a délivré, les plus récentes d’abord (30 au plus).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les ordonnances.', type: PortalPrescriptionDto, isArray: true }],
    errors: [404],
  })
  @RequirePermissions('portal:read:own') @Get('prescriptions')
  async prescriptions(@CurrentUser() actor: AuthUser): Promise<PortalPrescriptionDto[]> {
    return unwrap(await this.read.prescriptions(actor.userId)) as unknown as PortalPrescriptionDto[];
  }

  @DocOperation({
    summary: 'Mes factures',
    description: 'Avec le reste à payer, les plus récentes d’abord (30 au plus).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les factures.', type: PortalInvoiceDto, isArray: true }],
    errors: [404],
  })
  @RequirePermissions('portal:read:own') @Get('invoices')
  async invoices(@CurrentUser() actor: AuthUser): Promise<PortalInvoiceDto[]> {
    return unwrap(await this.read.invoices(actor.userId)) as unknown as PortalInvoiceDto[];
  }

  @DocOperation({
    summary: 'Relier un compte patient à un dossier',
    description: 'Le compte doit avoir le rôle `PATIENT` et être actif ; un compte (ou un dossier) n’est relié qu’une fois et le lien ne se modifie pas (409). Le journal garde qui a relié quoi.',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Le lien créé.', type: PortalAccountDto }],
    errors: [400, 404, 409],
  })
  @RequirePermissions('portal.accounts:manage') @Post('accounts')
  async link(@CurrentUser() actor: AuthUser, @Body() dto: LinkAccountDto): Promise<PortalAccountDto> {
    return unwrap(await this.accounts.link(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Compte du portail d’un patient',
    description: '404 si le patient n’a pas de compte de portail.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le compte relié.', type: PortalAccountDto }],
    errors: [400, 404],
    params: [PATIENT],
  })
  @RequirePermissions('portal.accounts:manage') @HttpCode(200) @Get('patients/:patientId/account')
  async ofPatient(@Param('patientId', ParseUUIDPipe) patientId: string): Promise<PortalAccountDto> {
    return unwrap(await this.accounts.ofPatient(patientId));
  }
}
