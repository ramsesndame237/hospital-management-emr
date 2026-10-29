import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import {
  CloseSessionUseCase, CosignSessionUseCase, GetCurrentSessionUseCase, GetDenominationsUseCase, GetSessionUseCase, ListSessionsUseCase, OpenSessionUseCase,
} from '../application/use-cases/sessions';
import { CloseSessionDto, CosignSessionDto, CurrentSessionDto, DenominationsDto, OpenSessionDto, SessionDetailDto, SessionPageDto } from './dto/sessions.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: 'Identifiant de la session de caisse.', example: '4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d', format: 'uuid' };

@DocGroup(
  'Facturation · Sessions de caisse',
  [
    "Un caissier **ouvre sa caisse** en comptant son fonds, **encaisse**, puis la **clôture** en comptant ce qu'il a en main. Sans caisse ouverte, aucun encaissement n'est possible.",
    '',
    "- **Une seule caisse ouverte** par caissier, et un poste n'est tenu que par une session ouverte à la fois.",
    "- **Comptage** : quantité de chaque billet ou pièce ; le total est calculé par le serveur.",
    "- **Écart** = espèces comptées − espèces attendues (fonds de caisse + espèces encaissées). Une caisse qui n'est pas juste exige une **explication**.",
    "- **Contre-signature** : si l'écart dépasse la limite de l'installation, la clôture passe en `AWAITING_REVIEW` et un responsable (qui n'est pas le caissier) doit la valider.",
    "- Aucun encaissement ne peut arriver pendant la clôture (la session est verrouillée) ; une session close ne se rouvre pas et ne se supprime pas.",
    "- **Visibilité** : un caissier voit ses sessions ; la comptabilité et l'administrateur système les voient toutes. Ouverture, clôture et contre-signature sont inscrites au journal d'audit.",
  ].join('\n'),
  52,
)
@Controller('api/v1/billing/cash-sessions')
export class BillingSessionsController {
  constructor(
    private readonly denominations: GetDenominationsUseCase,
    private readonly open: OpenSessionUseCase,
    private readonly current: GetCurrentSessionUseCase,
    private readonly getOne: GetSessionUseCase,
    private readonly listAll: ListSessionsUseCase,
    private readonly close: CloseSessionUseCase,
    private readonly cosign: CosignSessionUseCase,
  ) {}

  @DocOperation({
    summary: 'Billets et pièces de la devise',
    description: 'Les valeurs à compter (de la plus grande à la plus petite), la devise et la limite d\'écart de l\'installation.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les valeurs de la devise.', type: DenominationsDto }],
  })
  @RequirePermissions('billing.sessions:read:own') @Get('denominations')
  getDenominations(): DenominationsDto {
    return this.denominations.execute();
  }

  @DocOperation({
    summary: 'Ma caisse ouverte',
    description: "La session ouverte du caissier connecté, avec ses encaissements, ou `session: null` s'il n'a pas de caisse ouverte.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La caisse ouverte, ou null.', type: CurrentSessionDto }],
  })
  @RequirePermissions('billing.sessions:operate') @Get('current')
  async getCurrent(@CurrentUser() actor: AuthUser): Promise<CurrentSessionDto> {
    return { session: await this.current.execute(actor.userId) };
  }

  @DocOperation({
    summary: 'Lister les sessions de caisse',
    description: 'Les plus récentes en premier. Un caissier ne voit que les siennes ; la comptabilité et l\'administrateur système voient toutes les sessions et peuvent filtrer par caissier.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de sessions.', type: SessionPageDto }],
    errors: [400, 422],
    query: [
      { name: 'status', description: '`OPEN`, `AWAITING_REVIEW` ou `CLOSED`.', example: 'AWAITING_REVIEW' },
      { name: 'cashierId', description: 'Un caissier (réservé aux responsables).', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73' },
      { name: 'offset', description: 'Nombre de sessions à sauter (pagination).', example: 0 },
      { name: 'limit', description: 'Nombre de sessions par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('billing.sessions:read:own') @Get()
  async list(
    @CurrentUser() actor: AuthUser,
    @Query('status') status: string | undefined,
    @Query('cashierId') cashierId: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<SessionPageDto> {
    return unwrap(await this.listAll.execute(actor.userId, { status, cashierId, offset, limit }));
  }

  @DocOperation({
    summary: 'Ouvrir ma caisse',
    description: "Ouvre une session avec le fonds de caisse compté. Refusé (409) si le caissier a déjà une caisse ouverte ou si le poste est déjà tenu.",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Caisse ouverte.', type: SessionDetailDto }],
    errors: [400, 409, 422],
  })
  @RequirePermissions('billing.sessions:operate') @Post()
  async openSession(@CurrentUser() actor: AuthUser, @Body() dto: OpenSessionDto): Promise<SessionDetailDto> {
    const opened = unwrap(await this.open.execute(actor.userId, dto));
    return { ...opened, payments: [] };
  }

  @DocOperation({
    summary: 'Lire une session de caisse',
    description: 'Avec ses encaissements. Une session qui n\'est pas la sienne est « introuvable » pour un caissier.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La session.', type: SessionDetailDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('billing.sessions:read:own') @Get(':id')
  async get(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<SessionDetailDto> {
    return unwrap(await this.getOne.execute(actor.userId, id));
  }

  @DocOperation({
    summary: 'Clôturer ma caisse',
    description:
      "Seul le caissier clôture sa caisse, en comptant ce qu'il a en main. Les encaissements sont relus sous verrou : aucun ne peut arriver pendant la clôture. L'écart (comptées − attendues) exige une explication ; au-delà de la limite, la session passe en `AWAITING_REVIEW` et attend une contre-signature.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Caisse clôturée (ou en attente de contre-signature).', type: SessionDetailDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('billing.sessions:operate') @HttpCode(200) @Post(':id/close')
  async closeSession(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseSessionDto): Promise<SessionDetailDto> {
    return unwrap(await this.close.execute(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Contre-signer une clôture',
    description: "Un responsable valide une clôture dont l'écart dépasse la limite (`AWAITING_REVIEW` → `CLOSED`). Il ne peut pas contre-signer sa propre caisse.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Clôture validée.', type: SessionDetailDto }],
    errors: [400, 404, 409],
    params: [ID],
  })
  @RequirePermissions('billing.sessions:cosign') @HttpCode(200) @Post(':id/cosign')
  async cosignSession(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CosignSessionDto): Promise<SessionDetailDto> {
    return unwrap(await this.cosign.execute(actor.userId, id, dto.comment ?? null));
  }
}
