import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import { Client, CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser, ClientInfo } from '../../iam/presentation/decorators';
import { SearchAuditUseCase, VerifyAuditChainUseCase } from '../application/audit-queries';
import type { AuditViewer } from '../application/audit-queries';
import { AuditChainStatusDto, AuditPageDto } from './dto/audit.dto';
import { unwrap } from './http-errors';

const viewer = (user: AuthUser, client: ClientInfo): AuditViewer => ({ userId: user.userId, username: user.username, ip: client.ip, userAgent: client.userAgent });

@DocGroup(
  "Journal d'audit",
  [
    "Consultation de la **trace** de ce qui s'est passé : connexions, refus d'accès, créations et modifications, départs…",
    '',
    '- Le journal est **en ajout seul** (la base refuse toute modification ou suppression) et **chaîné par hachage** : chaque entrée engage la précédente.',
    '- `GET /audit/verify` recalcule toute la chaîne ; une altération, même faite directement en base, est détectée et localisée.',
    "- **Chaque consultation est elle-même inscrite** au journal (`audit.log.read`, `audit.log.verify`) : qui a lu quoi, quand, avec quels filtres.",
    "- Le journal ne contient ni donnée de santé, ni secret, ni donnée personnelle de l'équipe (identifiants et matricules seulement).",
  ].join('\n'),
  60,
)
@Controller('api/v1/audit')
export class AuditController {
  constructor(private readonly search: SearchAuditUseCase, private readonly verifyChain: VerifyAuditChainUseCase) {}

  @DocOperation({
    summary: "Rechercher dans le journal d'audit",
    description:
      'Des plus récentes aux plus anciennes, paginé par curseur : renvoyer `nextBefore` comme `before` pour la page suivante (le journal grossit en permanence, un décalage dériverait). Les filtres se cumulent.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page du journal.', type: AuditPageDto }],
    errors: [400, 422],
    query: [
      { name: 'action', description: 'Action exacte.', example: 'staff.member.depart' },
      { name: 'actionPrefix', description: "Début d'action (tout un domaine).", example: 'staff.' },
      { name: 'actorId', description: "Compte à l'origine de l'action.", example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73' },
      { name: 'resourceType', description: 'Type de ressource.', example: 'staff-member' },
      { name: 'resourceId', description: 'Identifiant de la ressource.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11' },
      { name: 'outcome', description: '`SUCCESS`, `FAILURE` ou `DENIED`.', example: 'DENIED' },
      { name: 'from', description: 'Début de période (ISO 8601 avec fuseau, inclus).', example: '2026-10-01T00:00:00Z' },
      { name: 'to', description: 'Fin de période (ISO 8601 avec fuseau, incluse).', example: '2026-10-31T23:59:59Z' },
      { name: 'before', description: 'Curseur de pagination (`nextBefore` de la page précédente).', example: '1000' },
      { name: 'limit', description: "Nombre d'entrées par page (1 à 200).", example: 50 },
    ],
  })
  @RequirePermissions('audit:read') @Get('events')
  async events(
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
    @Query('action') action: string | undefined,
    @Query('actionPrefix') actionPrefix: string | undefined,
    @Query('actorId') actorId: string | undefined,
    @Query('resourceType') resourceType: string | undefined,
    @Query('resourceId') resourceId: string | undefined,
    @Query('outcome') outcome: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('before') before: string | undefined,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<AuditPageDto> {
    return unwrap(await this.search.execute(viewer(user, client), { action, actionPrefix, actorId, resourceType, resourceId, outcome, from, to, before, limit }));
  }

  @DocOperation({
    summary: "Vérifier l'intégrité du journal",
    description:
      "Recalcule la chaîne de hachage de **toutes** les entrées. `valid: false` indique la première entrée altérée (`brokenAtId`). Le résultat est inscrit au journal ; une rupture y figure en échec. Opération coûteuse sur un gros journal.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Résultat de la vérification.', type: AuditChainStatusDto }],
  })
  @RequirePermissions('audit:read') @Get('verify')
  verify(@CurrentUser() user: AuthUser, @Client() client: ClientInfo): Promise<AuditChainStatusDto> {
    return this.verifyChain.execute(viewer(user, client));
  }
}
