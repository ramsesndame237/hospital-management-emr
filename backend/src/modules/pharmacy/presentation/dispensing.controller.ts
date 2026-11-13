import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { DispenseUseCase, DispensingQueueUseCase, GetPrescriptionForDispensingUseCase } from '../application/use-cases/dispensing';
import { DispenseDto, PrescriptionForDispensingDto, QueueRowDto } from './dto/dispensing.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: 'Identifiant de l’ordonnance.', example: '8c1d4a7e-3b2f-4d6a-9e0b-1f2a3b4c5d6e', format: 'uuid' };

@DocGroup(
  'Pharmacie · Dispensation',
  [
    'La délivrance des ordonnances : le pharmacien voit celles qui attendent, vérifie, et délivre — en une ou plusieurs fois.',
    '',
    '- **File** : les ordonnances en cours pas encore entièrement délivrées, les plus anciennes d’abord. La pharmacie lit les ordonnances de **tous** les services, rien d’autre du dossier clinique que ce qu’il faut pour délivrer.',
    '- **Stock** : la délivrance prélève lot par lot, **premier périmé, premier sorti**, hors lots périmés ou en quarantaine. Si un médicament manque, **rien ne sort** ; chaque prélèvement est inscrit au grand livre (`DISPENSE`).',
    '- **Allergies** : les allergies ACTIVES du patient sont revérifiées à la délivrance. Si une allergie vise un médicament que le médecin n’avait pas levée (saisie après l’ordonnance), le pharmacien donne son propre motif.',
    '- Une ordonnance délivrée, même en partie, **ne s’annule plus** (en base aussi). On ne délivre jamais plus que prescrit.',
    '- L’audit garde qui a délivré quoi pour quelle ordonnance, **jamais les médicaments ni les motifs**.',
  ].join('\n'),
  59.3,
)
@Controller('api/v1/pharmacy/prescriptions')
export class PharmacyDispensingController {
  constructor(
    private readonly queue: DispensingQueueUseCase,
    private readonly getOne: GetPrescriptionForDispensingUseCase,
    private readonly dispense: DispenseUseCase,
  ) {}

  @DocOperation({
    summary: 'File des ordonnances à délivrer',
    description: 'Les ordonnances en cours qui ne sont pas encore entièrement délivrées, les plus anciennes d’abord (200 au plus).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La file de la pharmacie.', type: QueueRowDto, isArray: true }],
    errors: [],
  })
  @RequirePermissions('pharmacy.dispensing:read') @Get()
  async list(): Promise<QueueRowDto[]> {
    return this.queue.execute();
  }

  @DocOperation({
    summary: 'Lire une ordonnance à délivrer',
    description: 'Avec, pour chaque ligne, ce qui est prescrit, délivré et restant, les allergies actives du patient, le stock délivrable et le prélèvement que « premier périmé, premier sorti » ferait ; puis les délivrances déjà faites. L’accès est inscrit au journal d’audit.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'L’ordonnance.', type: PrescriptionForDispensingDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('pharmacy.dispensing:read') @Get(':id')
  async get(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PrescriptionForDispensingDto> {
    return unwrap(await this.getOne.execute(actor.userId, id));
  }

  @DocOperation({
    summary: 'Délivrer une ordonnance',
    description: [
      'Délivre les lignes données (tout ou partie). Refus : ordonnance introuvable (404) ou annulée (409), ligne inconnue ou répétée (422), plus que le reste à délivrer (409), ',
      'allergie non levée sans motif (409 `PHARMACY_ALLERGY_ACKNOWLEDGEMENT_REQUIRED`), stock délivrable insuffisant (409 `PHARMACY_STOCK_INSUFFICIENT_FOR_LINE` : rien ne sort). Renvoie l’ordonnance mise à jour.',
    ].join(''),
    auth: 'bearer',
    responses: [{ status: 200, description: 'L’ordonnance après la délivrance.', type: PrescriptionForDispensingDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('pharmacy.dispensing:dispense') @HttpCode(200) @Post(':id/dispense')
  async dispenseRx(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DispenseDto): Promise<PrescriptionForDispensingDto> {
    return unwrap(await this.dispense.execute(actor.userId, id, dto));
  }
}
