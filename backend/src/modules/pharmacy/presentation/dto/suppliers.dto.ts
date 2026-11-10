import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DocProperty } from '../../../api-docs';

const ID_EXAMPLE = '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60';

export class CreateSupplierDto {
  @DocProperty({ description: 'Code du fournisseur (1 à 20 caractères : lettres, chiffres, « _ », « - », « . »), normalisé en majuscules. Unique ; **ne pourra plus être modifié**.', example: 'PHARMADIS', maxLength: 20 })
  @IsString() @MaxLength(20)
  code!: string;

  @DocProperty({ description: 'Nom du fournisseur.', example: 'Pharma Distrib SARL', minLength: 1, maxLength: 120 })
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @DocProperty({ description: 'Personne à contacter.', example: 'Mme Ngo', maxLength: 100, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(100)
  contactName?: string | null;

  @DocProperty({ description: 'Téléphone (3 à 30 caractères).', example: '+237 6 99 00 00 00', maxLength: 30, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(30)
  phone?: string | null;

  @DocProperty({ description: 'Adresse e-mail.', example: 'commandes@pharmadistrib.example', maxLength: 120, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(120)
  email?: string | null;

  @DocProperty({ description: 'Adresse postale.', example: 'Zone industrielle de Bonabéri, Douala', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  address?: string | null;

  @DocProperty({ description: 'Délai de paiement convenu, en jours (0 : comptant ; 30 par défaut).', example: 30, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(365)
  paymentTermsDays?: number;

  @DocProperty({ description: 'Remarques (500 caractères au plus).', example: null, maxLength: 500, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(500)
  notes?: string | null;
}

export class UpdateSupplierDto {
  @DocProperty({ description: 'Nouveau nom.', example: 'Pharma Distrib', maxLength: 120, optional: true })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @DocProperty({ description: 'Nouveau contact ; `null` l’efface.', example: 'Mme Ngo', maxLength: 100, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(100)
  contactName?: string | null;

  @DocProperty({ description: 'Nouveau téléphone ; `null` l’efface.', example: '+237 6 99 00 00 00', maxLength: 30, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(30)
  phone?: string | null;

  @DocProperty({ description: 'Nouvelle adresse e-mail ; `null` l’efface.', example: 'commandes@pharmadistrib.example', maxLength: 120, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(120)
  email?: string | null;

  @DocProperty({ description: 'Nouvelle adresse ; `null` l’efface.', example: 'Douala', maxLength: 200, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(200)
  address?: string | null;

  @DocProperty({ description: 'Nouveau délai de paiement, en jours.', example: 45, optional: true })
  @IsOptional() @IsInt() @Min(0) @Max(365)
  paymentTermsDays?: number;

  @DocProperty({ description: 'Remarques ; `null` les efface.', example: null, maxLength: 500, optional: true, nullable: true })
  @IsOptional() @IsString() @MaxLength(500)
  notes?: string | null;
}

export class SupplierDto {
  @DocProperty({ description: 'Identifiant du fournisseur.', example: ID_EXAMPLE, format: 'uuid' })
  id!: string;

  @DocProperty({ description: 'Code.', example: 'PHARMADIS' })
  code!: string;

  @DocProperty({ description: 'Nom.', example: 'Pharma Distrib SARL' })
  name!: string;

  @DocProperty({ description: 'Contact.', example: 'Mme Ngo', nullable: true })
  contactName!: string | null;

  @DocProperty({ description: 'Téléphone.', example: '+237 6 99 00 00 00', nullable: true })
  phone!: string | null;

  @DocProperty({ description: 'Adresse e-mail.', example: 'commandes@pharmadistrib.example', nullable: true })
  email!: string | null;

  @DocProperty({ description: 'Adresse postale.', example: 'Douala', nullable: true })
  address!: string | null;

  @DocProperty({ description: 'Délai de paiement convenu, en jours.', example: 30 })
  paymentTermsDays!: number;

  @DocProperty({ description: 'Remarques.', example: null, nullable: true })
  notes!: string | null;

  @DocProperty({ description: '`false` : fournisseur écarté, on ne lui passe plus de commande.', example: true })
  active!: boolean;
}

export class SupplierPageDto {
  @DocProperty({ description: 'Fournisseurs de la page, par nom.', type: SupplierDto, itemType: SupplierDto })
  items!: readonly SupplierDto[];

  @DocProperty({ description: 'Nombre total de fournisseurs correspondants.', example: 12 })
  total!: number;

  @DocProperty({ description: 'Décalage appliqué.', example: 0 })
  offset!: number;

  @DocProperty({ description: 'Taille de page appliquée (1 à 200).', example: 50 })
  limit!: number;
}
