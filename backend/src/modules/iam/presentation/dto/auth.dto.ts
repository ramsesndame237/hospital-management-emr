import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Bornes de taille partout : pas de corps géants, et le hachage coûteux n'est jamais déclenché par un mot de passe démesuré. */
export class LoginDto {
  @IsString() @MinLength(1) @MaxLength(64)
  username!: string;

  @IsString() @MinLength(1) @MaxLength(1024)
  password!: string;

  @IsOptional() @IsString() @Matches(/^\s*\d{3}\s?\d{3}\s*$/, { message: 'Le code doit comporter 6 chiffres.' })
  totpCode?: string;

  @IsOptional() @IsString() @MaxLength(32)
  recoveryCode?: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(1024)
  currentPassword!: string;

  @IsString() @MinLength(1) @MaxLength(1024)
  newPassword!: string;
}

export class ActivateMfaDto {
  @IsString() @Matches(/^\s*\d{3}\s?\d{3}\s*$/, { message: 'Le code doit comporter 6 chiffres.' })
  code!: string;
}

export class CreateUserDto {
  @IsString() @MinLength(3) @MaxLength(64)
  username!: string;

  @IsEmail() @MaxLength(254)
  email!: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(40, { each: true })
  roles!: string[];
}

export class AssignRolesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(40, { each: true })
  roles!: string[];
}
