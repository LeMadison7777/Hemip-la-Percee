# HEMIP — La Percée · PWA responsive

Application francophone pour la Haute École de Management et d’Ingénierie — La Percée (HEMIP), issue des documents fournis. Elle rassemble le site public, un album orbitale et vertical, les 17 vidéos, un formulaire d’accès à code et les maquettes de gestion.

> **État à cette livraison.** Le schéma intégré a été appliqué à la base Neon actuellement configurée : les 25 tables historiques sont conservées et la base compte maintenant 44 tables. Le baseline et la migration d’intégration sont enregistrés dans Prisma. Aucun secret réel n’est inclus dans le dépôt. L’authentification par email et le stockage restent conditionnés à la configuration et à la validation des services Resend et Supabase. Les écrans académiques, paiements et décisions restent des **maquettes** et ne constituent pas encore un système scolaire de production.

## Démarrer et vérifier

Prérequis : Node.js 22.12 ou supérieur.

pnpm est le gestionnaire de référence du projet. Si pnpm n’est pas disponible, npm est aussi pris en charge par le `package-lock.json` : utilise un seul gestionnaire dans un même dossier de travail.

```bash
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm dev
```

Alternative avec npm :

```bash
npm ci
npm run prisma:generate
npm run dev
```

Tests et compilation :

```bash
pnpm test
pnpm check
pnpm build
pnpm start
```

Avec npm, les commandes équivalentes sont `npm test`, `npm run check`, `npm run build` et `npm start`. `start` sert le build de production créé par `build`; configure les variables serveur décrites ci-dessous avant une utilisation connectée.

La PWA adapte ses grilles, navigation et tailles de contenu aux téléphones compacts, tablettes, bureaux, écrans larges et orientations paysage. Elle reste utilisable au clavier, respecte `prefers-reduced-motion`, conserve le zoom navigateur et protège les safe-areas mobiles. Son cache hors-ligne reste volontairement limité à l’enveloppe de l’application; les données privées ne sont pas mises en cache.

Le service worker versionné traite les pages publiques en réseau-d’abord, n’enregistre que les réponses réussies et exclut l’API, les sessions, les uploads et les cookies. Il met en cache les assets statiques et affiche l’enveloppe déjà visitée si le réseau coupe.

## Routes principales

| Route | Fonction |
| --- | --- |
| `/` | Accueil et information institutionnelle. |
| `/formations`, `/admissions`, `/tarifs`, `/equipe`, `/faq`, `/contact`, `/terms` | Pages publiques HEMIP ; les montants/adresses/données légales non confirmés sont signalés. La page équipe attend les portraits, noms et fonctions validés par l’administration. |
| `/album` | 49 images, carrousel orbital, galerie verticale et 17 vidéos. |
| `/temoignages` | Témoignages publiés dès leur envoi par les étudiants; nom affiché uniquement avec leur accord; réactions « J’aime » des étudiants et enseignants. |
| `/annonces` | Annonces publiées pour les étudiants et enseignants connectés; inscription push facultative par appareil. |
| `/auth` | Demande de code à 6 chiffres, puis connexion Auth.js Credentials; seuls les emails préinscrits dans Neon peuvent ouvrir une session. |
| `/student/dashboard`, `/admin/payments`, `/admin/decisions` | Rendu encore démonstratif; l’accès frontal est filtré, mais les écritures et lectures métier ne sont pas encore branchées aux gardes RBAC/contrats API de production. |

Les annonces peuvent être publiées sous `/admin/announcements` par `academic_admin` ou `super_admin`; l’administration peut choisir les étudiants, les enseignants ou les deux. La publication déclenche une notification push pour les appareils abonnés correspondants lorsque les clés VAPID sont configurées.

Les règles et routes de ces trois fonctions sont décrites dans [specs/community-features.md](specs/community-features.md).

## Authentification OTP

- Auth.js (`@auth/express`, intégration Express **expérimentale** en amont) + `@auth/prisma-adapter`, providers Credentials OTP, JWT HttpOnly et Google OAuth facultatif.
- Inscriptions publiques par e-mail avec code OTP, mot de passe chiffré par scrypt et, pour les étudiants, filière et niveau issus du catalogue HEMIP. Les comptes des enseignants et du personnel restent sans privilèges jusqu’à l’approbation du Super Admin.
- Codes cryptographiquement aléatoires à six chiffres, expiration de 180 s, usage unique, maximum 5 tentatives. Les empreintes HMAC sont stockées, jamais le code en clair. Les codes sont envoyés par Resend aux adresses autorisées par le parcours d’inscription ou de connexion.
- Limites partagées en base : 3 demandes par email et 10 par IP sur 15 minutes. Les réponses pour adresse inconnue restent génériques.
- Les sessions et rôles sont revérifiés depuis Neon à la lecture; désactivation du compte ou modification de rôle rend la session invalide. Une session dure au maximum 7 jours après l’authentification pour tous les rôles; revenir à « Mon espace » pendant cette période réutilise la session sans redemander un OTP.
- Endpoints: `POST /api/auth/signup`, `POST /api/auth/otp/request`, `POST /api/auth/password/otp`, `POST /api/auth/complete-registration`, `GET /api/auth/session`. Auth.js assure le contrôle CSRF de la callback OTP; Google SSO est activé avec `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.
- Import des adresses préautorisées: remplir **sur une machine/volume privé** `templates/preenrollment_import_template.csv`, puis, avec les variables présentes dans l’environnement serveur, exécuter `pnpm users:import -- /chemin/privé/preinscriptions.csv`. Le CSV doit avoir exactement `email,role`; rôles autorisés: `visitor`, `student`, `teacher`, `payment_manager`, `academic_admin`. Le rôle `super_admin` ne peut pas être accordé par ce fichier.
- Première attribution super-admin: après le déploiement de la migration, exécuter `pnpm admin:grant-super -- adresse-validée@hemip.cg`; le script demande de ressaisir exactement la même adresse et conserve l’OTP e-mail comme exigence de connexion.
- Le lien de déconnexion Auth.js est utilisé dans les espaces protégés; le rôle privilégié initial devra être attribué explicitement par HEMIP via une procédure administrateur contrôlée, jamais dans un import étudiant ordinaire.

## Neon et migrations Prisma

Le schéma intégré se trouve dans `prisma/schema.prisma`. Neon contenait déjà 25 tables avant l’adoption de Prisma Migrate; leur structure initiale est conservée dans `specs/database/neon-existing-schema-2026-09-30.prisma` et représentée par le baseline `prisma/migrations/0000_neon_existing_baseline/migration.sql`.

- `NEON_DATABASE_URL`: endpoint Neon poolé/TLS utilisé par les requêtes web.
- `NEON_DIRECT_URL`: connexion non poolée du même environnement Neon, réservée aux migrations Prisma.
- Les modèles réutilisent les tables existantes `StudentProfile`, `TeacherProfile`, `Payment`, `FinancialStatus`, `AcademicResult`, `AcademicDecision`, `Attendance`, `DebtRecord`, `Album` et `AuditLog`; leurs colonnes historiques restent disponibles. Les nouveaux liens normalisés vers cours, semestres et années académiques sont nullable pour les anciennes lignes. Les autres tables héritées restent modélisées afin que les futures migrations ne les suppriment pas.
- `prisma/migrations/0001_integrate_hemip_schema/migration.sql` ajoute les tables et champs du schéma HEMIP. La migration préserve les lignes existantes; elle rend aussi `AcademicResult.note` nullable pour autoriser les brouillons. Les statuts de résultats sont recopiés vers le nouveau workflow sans supprimer les anciens champs `workflow` et `isPublished`.
- `prisma/migrations/0002_community_features/migration.sql` ajoute les témoignages, leurs « J’aime » et la cible par rôle des annonces. Elle est appliquée sur la base Neon configurée; tout autre environnement doit l’appliquer avant mise en service.
- `prisma/migrations/0003_registration_academic_workflows/migration.sql` ajoute l’inscription et l’approbation du personnel, le rôle Évaluations, la publication des plannings, les relevés officiels, les crédits et le suivi des pièces. Elle a été appliquée sur la base Neon configurée; les migrations futures s’appliquent avec `npm run prisma:deploy`.
- La base Neon actuellement configurée a son baseline et les migrations `0001`, `0002` et `0003` appliquées. Les 25 tables historiques sont toujours présentes. L’ancienne migration initiale incompatible est conservée hors de l’historique actif dans `prisma/archive/0001_initial_unapplied/`.
- Pour une autre base déjà remplie et correspondant au snapshot historique, vérifier d’abord le schéma, puis enregistrer le baseline une seule fois avec `npm exec -- prisma migrate resolve --applied 0000_neon_existing_baseline --schema=prisma/schema.prisma`, et appliquer les ajouts avec `npm run prisma:deploy`. Ne pas exécuter le SQL du baseline sur une base déjà remplie.
- Pour une nouvelle base vide, `npm run prisma:deploy` applique le baseline puis l’intégration. Avant de viser une autre branche Neon, vérifier le projet et la branche, faire une sauvegarde et examiner le diff. `npm run prisma:migrate:dev` reste réservé au développement local.

## Resend

`RESEND_API_KEY` reste côté serveur. `RESEND_FROM_EMAIL` doit utiliser une adresse sur un domaine vérifié dans Resend et autorisé à envoyer. Resend fournit les codes OTP d’inscription et de connexion; les adresses inconnues reçoivent une réponse générique.

## Supabase Storage

- Bucket configuré par `SUPABASE_PRIVATE_BUCKET`; il doit être créé **privé** dans le projet Supabase.
- `SUPABASE_URL` et `SUPABASE_SECRET_KEY` (clé serveur `sb_secret_…`; le nom historique `SUPABASE_SERVICE_ROLE_KEY` reste accepté) restent dans le backend, jamais en `VITE_*`.
- `POST /api/storage/documents` permet à un étudiant de transmettre ses propres pièces ou à la gestionnaire de les charger pour un dossier; accepte uniquement PDF/JPEG/PNG/WebP jusqu’à 10 Mo, vérifie la signature du fichier, génère un identifiant opaque et enregistre ses métadonnées Neon.
- `POST /api/storage/documents/:id/signed-read-url` crée un lien de lecture valable 60 secondes pour l’étudiant concerné, l’agent qui a chargé le fichier ou un membre du personnel habilité. Le bucket doit empêcher l’accès anonyme; les liens signés restent des secrets temporaires.

## Secrets à configurer (serveur uniquement)

| Variable | Obligatoire | Usage |
| --- | --- | --- |
| `NEON_DATABASE_URL` | Oui | Connexion Neon poolée/TLS pour l’application. |
| `NEON_DIRECT_URL` | Pour migrations | Connexion Neon directe/non poolée vers la branche à migrer. |
| AUTH_SECRET | Oui | Secret Auth.js HEMIP de 32 caracteres minimum, independant des secrets de plateforme. |
| `GOOGLE_CLIENT_ID` | Facultatif | Identifiant OAuth Google; avec le secret ci-dessous, active le bouton SSO. |
| `GOOGLE_CLIENT_SECRET` | Facultatif | Secret OAuth Google, conservé uniquement côté serveur. |
| `RESEND_API_KEY` | Oui pour envoyer les codes | Clé API Resend autorisée à envoyer des emails. |
| `RESEND_FROM_EMAIL` | Oui pour envoyer les codes | Adresse expéditrice d’un domaine vérifié. |
| `SUPABASE_URL` | Pour stockage | URL du projet Supabase. |
| `SUPABASE_SECRET_KEY` | Pour stockage | Clé secrète serveur `sb_secret_…` (ou clé historique service role). |
| `SUPABASE_PRIVATE_BUCKET` | Pour stockage | Nom du bucket privé préalablement créé. |
| `VAPID_PUBLIC_KEY` | Pour push | Clé publique VAPID exposée au navigateur pour l’abonnement. |
| `VAPID_PRIVATE_KEY` | Pour push | Clé privée VAPID, conservée uniquement côté serveur. |
| `VAPID_SUBJECT` | Pour push | Contact d’exploitation VAPID, par exemple une adresse `mailto:` gérée par HEMIP. |

Ne jamais mettre ces valeurs dans Git, dans une capture d’écran, le JavaScript public ou un message ordinaire. Utiliser le formulaire sécurisé de secrets du projet.

Générer une seule paire VAPID pour l’environnement de production avec `pnpm exec web-push generate-vapid-keys --json`, puis enregistrer les deux clés via le gestionnaire de secrets de la plateforme. Les notifications exigent HTTPS (localhost convient pour le développement), un navigateur compatible, l’accord explicite de l’utilisateur et un service push pris en charge. Un clic sur la notification ouvre `/annonces`.

## Images et vidéos

- Les 49 images source et miniatures sont incluses dans `offline-media/`. Express les sert sur la meme origine sous `/media/hero/` et `/media/thumbs/`; les affiches video sont servies sous `/media/video-thumbnails/`. Aucun proxy de stockage externe de preview est requis.
- `client/src/data/media.ts` garde l’ordre d’origine et le texte alternatif; `assets/image_mapping.csv` documente les sources.
- `client/src/data/videos.ts` contient les 15 Shorts et 2 vidéos classiques transmis; les affiches sont servies localement. Un clic ouvre un unique lecteur intégré `youtube-nocookie.com` dans une fenêtre modale de la PWA; aucun lecteur n’est chargé avant l’action de l’utilisateur. Les vidéos que leur propriétaire n’autorise pas à intégrer, ou soumises à une restriction d’âge/région, peuvent rester indisponibles dans le lecteur tiers — limite imposée par YouTube. Références : [intégrer des vidéos YouTube](https://support.google.com/youtube/answer/171780?hl=fr) et [paramètres du lecteur intégré](https://developers.google.com/youtube/player_parameters).
- L’image complète du logo et les icônes PWA sont dans `client/public/images/` et `client/public/icons/`. Les icônes `pwa-icon-192.png` et `pwa-icon-512.png` affichent le logo dans un médaillon circulaire blanc avec extérieur transparent, sans fond bleu. Elles servent aussi au logo de navigation, au favicon et à l’icône Apple.

## Docker et montée en charge horizontale

`Dockerfile` bâtit le frontend et le serveur dans une image portable; `compose.yaml` fournit un mode local avec limites système; `deploy/DOCKER.md` explique la préparation des secrets et la migration Neon. Le manifeste `deploy/k8s/hemip.yaml` propose un cluster Kubernetes sans état : 2 réplicas de départ, load balancing de Service, sondes, `PodDisruptionBudget` et HPA jusqu’à 10 pods à 70 % CPU. Sessions Auth.js JWT, OTP/quota Neon et fichiers Supabase sont partagés entre les réplicas.

Le conteneur, Compose et les manifestes sont préparés mais le build Docker n’a pas pu être exécuté ici (Docker absent de l’environnement). Aucune image n’a été poussée, aucun cluster n’a été créé et aucun load test n’a été exécuté. Avant la production : créer les secrets via le gestionnaire de la plateforme, configurer l’Ingress/TLS, contrôler la capacité/pool de Neon, vérifier le bucket privé et le domaine Resend, appliquer une migration relue sur une branche Neon neuve, puis effectuer un test de charge/reprise. Le HPA ne crée pas à lui seul de capacité Kubernetes; il faut un cluster et `metrics-server`.

## Workflows métiers intégrés

Les API vérifient les rôles côté serveur et journalisent les actions sensibles. Les tableaux affichent les données réellement enregistrées; aucun étudiant, cours, paiement ou résultat d’exemple n’est injecté.

| Rôle | Accès principal |
| --- | --- |
| `student` | Son planning publié, ses résultats officiellement publiés, ses pièces et son propre dossier financier. |
| `teacher` | Ses interventions publiées et les notes des étudiants de ses cours/cohortes attribués. |
| `academic_admin` | Catalogue de cours, salles, enseignants et publication des plannings; publication d’annonces. |
| `evaluation_manager` | Vérification des notes, délibération et publication des relevés. |
| `payment_manager` | Dossiers et pièces étudiantes, inscriptions définitives, dettes, paiements, validations et relances. |
| `super_admin` | Approbation ou refus du personnel, création de comptes internes et accès aux espaces de gestion. |

Le responsable des évaluations doit fournir le seuil de crédits et le statut officiel selon la décision HEMIP au moment de la publication. Les moyennes sont pondérées par les coefficients enregistrés. Le système bloque une publication si les notes enregistrées pour un étudiant et un semestre ne sont pas toutes sélectionnées et vérifiées. Les règles de délibération, crédits, rattrapage et passage restent à valider par l’établissement; leur référence fonctionnelle est dans [specs/academic-results-workflow.md](specs/academic-results-workflow.md).

Les étudiants et enseignants peuvent autoriser les notifications sur chaque appareil depuis `/annonces`. Les annonces, publications de planning et résultats peuvent alors envoyer un push ciblé. La gestion des présences, décisions administratives et messagerie interne reste en dehors des modules activés dans cette livraison. Avant l’usage administratif réel, HEMIP doit confirmer les barèmes, plans de frais, rôles nominatifs, règles de conservation et mentions de confidentialité.
