import { DocProperty } from '../../../api-docs';

export class AuditEventDto {
  @DocProperty({ description: "Numéro de l'entrée dans le journal (croissant, sans trou tant que le journal est intact).", example: '1042' })
  id!: string;

  @DocProperty({ description: "Date et heure de l'événement (ISO 8601, UTC).", example: '2026-10-23T10:15:03.123Z', format: 'date-time' })
  occurredAt!: string;

  @DocProperty({ description: 'Action, en `domaine.objet.verbe`.', example: 'staff.member.depart' })
  action!: string;

  @DocProperty({ description: '`SUCCESS`, `FAILURE` (échec) ou `DENIED` (accès refusé).', example: 'SUCCESS', enum: ['SUCCESS', 'FAILURE', 'DENIED'] })
  outcome!: 'SUCCESS' | 'FAILURE' | 'DENIED';

  @DocProperty({ description: "Compte à l'origine de l'action (`system:bootstrap` pour l'amorçage).", example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', nullable: true })
  actorId!: string | null;

  @DocProperty({ description: "Identifiant de connexion de l'acteur, quand il est connu.", example: 'admin', nullable: true })
  actorUsername!: string | null;

  @DocProperty({ description: 'Type de ressource concernée.', example: 'staff-member', nullable: true })
  resourceType!: string | null;

  @DocProperty({ description: 'Identifiant de la ressource concernée.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11', nullable: true })
  resourceId!: string | null;

  @DocProperty({ description: "Adresse IP de l'appelant.", example: '10.0.0.12', nullable: true })
  ip!: string | null;

  @DocProperty({ description: "Navigateur ou client de l'appelant (tronqué).", example: 'Mozilla/5.0', nullable: true })
  userAgent!: string | null;

  @DocProperty({ description: 'Motif, pour un refus ou un échec.', example: 'missing:iam.users:manage', nullable: true })
  reason!: string | null;

  @DocProperty({ description: "Détails de l'action (valeurs simples). Jamais de donnée de santé, de secret ni de donnée personnelle.", example: { staffNumber: 'MAT-001', departedOn: '2026-12-31' }, type: Object, nullable: true })
  metadata!: Record<string, string | number | boolean | null> | null;

  @DocProperty({ description: "Empreinte SHA-256 de l'entrée précédente.", example: '0000000000000000000000000000000000000000000000000000000000000000' })
  prevHash!: string;

  @DocProperty({ description: "Empreinte SHA-256 de cette entrée : elle engage l'entrée précédente, donc toute altération rompt la chaîne.", example: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' })
  hash!: string;
}

export class AuditPageDto {
  @DocProperty({ description: 'Entrées de la page, des plus récentes aux plus anciennes.', type: AuditEventDto, itemType: AuditEventDto })
  items!: readonly AuditEventDto[];

  @DocProperty({ description: 'Valeur à renvoyer comme `before` pour obtenir la page suivante ; `null` à la fin du journal.', example: '1000', nullable: true })
  nextBefore!: string | null;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}

export class AuditChainStatusDto {
  @DocProperty({ description: 'Vrai si toute la chaîne de hachage est intacte.', example: true })
  valid!: boolean;

  @DocProperty({ description: 'Numéro de la première entrée altérée ; `null` si tout est intact.', example: null, nullable: true })
  brokenAtId!: string | null;

  @DocProperty({ description: "Nombre d'entrées vérifiées.", example: 1042 })
  checked!: number;
}
