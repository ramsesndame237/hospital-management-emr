import type { PortalLocalization, PortalTexts } from '../../domain/api-docs.port';

/**
 * Textes de repli (français) : le module fonctionne seul, sans module d'internationalisation. Quand l'application
 * branche un `PortalTextsProvider` (catalogues `docs-portal.json`), ceux-ci le remplacent.
 */
export const DEFAULT_FR_TEXTS: PortalTexts = {
  pageTitle: "Documentation de l'API — Sanjeevani EMR",
  heroTitle: "Documentation de l'API",
  heroLead: 'Explorez et testez les endpoints de la plateforme hospitalière, en toute sécurité.',
  feature1Title: 'Sécurité de niveau hospitalier',
  feature1Text: 'Mots de passe Argon2id, sessions révocables, journal d’audit infalsifiable.',
  feature2Title: 'Double authentification',
  feature2Text: 'Obligatoire pour les profils cliniques et les administrateurs.',
  feature3Title: 'Testez en direct',
  feature3Text: 'Essayez chaque endpoint avec votre propre session, sans outil externe.',
  feature4Title: 'Multilingue',
  feature4Text: 'Messages d’erreur en français et en anglais.',
  loginTitle: 'Connexion',
  loginLead: 'Identifiez-vous avec votre compte professionnel pour ouvrir la documentation.',
  username: 'Identifiant',
  usernamePlaceholder: 'prenom.nom',
  password: 'Mot de passe',
  passwordPlaceholder: 'Votre mot de passe',
  showPassword: 'Afficher',
  hidePassword: 'Masquer',
  signIn: 'Se connecter',
  signingIn: 'Vérification…',
  mfaTitle: 'Vérification en deux étapes',
  mfaLead: 'Saisissez le code à 6 chiffres affiché par votre application d’authentification.',
  mfaCode: 'Code de vérification',
  mfaVerify: 'Vérifier',
  mfaUseRecovery: 'Utiliser un code de secours',
  mfaUseApp: 'Utiliser mon application',
  recoveryCode: 'Code de secours',
  back: 'Retour',
  checking: 'Vérification de votre session…',
  welcome: 'Bienvenue, {name}',
  redirecting: 'Ouverture de la documentation…',
  setupRequired: 'Votre compte doit d’abord être finalisé (nouveau mot de passe, double authentification) depuis l’application avant d’accéder à la documentation.',
  forbidden: 'Votre compte n’est pas autorisé à consulter la documentation. Contactez un administrateur.',
  networkError: 'Impossible de joindre le serveur. Réessayez dans un instant.',
  genericError: 'Une erreur est survenue. Réessayez.',
  footerNote: 'Accès réservé aux comptes autorisés. Toutes les connexions sont journalisées.',
  signOut: 'Se déconnecter',
  accessRestricted: 'Accès restreint',
};

export const DEFAULT_LOCALIZATION: PortalLocalization = { locale: 'fr', locales: ['fr'], texts: DEFAULT_FR_TEXTS };
