# Références officielles d’intégration (consultées le 27 septembre 2026)

Ces pages documentent les interfaces et précautions retenues. Reconsulter les versions à jour au moment du déploiement : `@auth/express` est explicitement marqué expérimental.

- **Auth.js Express** — https://authjs.dev/reference/express — officiellement pris en charge, mais expérimental; `AUTH_SECRET` aléatoire d’au moins 32 caractères; endpoints sous le base path `/auth`; callback de connexion et déconnexion par requête portant un `csrfToken`; callback provider par défaut `/auth/callback/[provider]`; lecture de session via `getSession`.
- **Auth.js Credentials provider** — https://authjs.dev/getting-started/providers/credentials — autorisation arbitraire côté serveur; le provider Credentials est décrit comme ne persistant pas lui-même les utilisateurs; utilisé ici pour appliquer l’OTP et un jeton JWT, tandis que les comptes sont persistés par le service HEMIP/Prisma.
- **Auth.js Prisma adapter** — https://authjs.dev/getting-started/adapters/prisma — requiert `User`, `Account`, `Session`, `VerificationToken` conformes; les champs métier HEMIP additionnels restent dans `User`.
- **Neon pooled/direct connections** — https://neon.com/docs/connect/connect-from-any-app — employer l’endpoint poolé/TLS pour les requêtes web et l’endpoint direct/non poolé pour Prisma Migrate lorsque le mode pooler ne convient pas. Les migrations doivent cibler une branche dédiée et préalablement relue.
- **Resend send email** — https://resend.com/docs/api-reference/emails/send-email — REST/SDK serveur avec API key, `from`, `to`, `subject` et contenu `text`/`html`; le compte expéditeur doit disposer du domaine approprié.
- **Supabase Storage buckets** — https://supabase.com/docs/guides/storage/buckets/fundamentals — un bucket privé impose le contrôle d’accès pour lecture/téléchargement; les fichiers peuvent être livrés avec un lien signé qui expire.
- **Supabase API keys** — https://supabase.com/docs/guides/getting-started/api-keys — Supabase déprécie progressivement les clés historiques `anon`/`service_role` au profit des clés `sb_publishable_…` et `sb_secret_…`; toute clé secrète reste serveur-only.

Aucune de ces références ne constitue un audit de sécurité, une politique juridique, ni l’autorisation de migrer une base HEMIP existante.
