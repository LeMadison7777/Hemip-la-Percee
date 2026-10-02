# Contrat API — HEMIP

**Version :** 0.3 — les sections paiements, résultats, décisions et médias ci-dessous restent une base de spécifications, sans route serveur active. Les fonctions témoignages, annonces et notifications push sont implémentées séparément dans [community-features.md](community-features.md). Les chemins ci-dessous sont relatifs à `/api`; les exemples sont illustratifs.

## Conventions de sécurité

Toute autorisation est décidée côté serveur à partir de la session Auth.js et du rôle stocké en base. Une valeur transmise par le navigateur — notamment `studentId`, rôle, `clearedForResults` ou `resultsPublished` — n’a jamais valeur d’autorisation. La session étudiantes peut expirer après 30 jours ; la session des rôles de gestion après 72 heures. Le code OTP de première validation ou second facteur expire après **180 secondes**. Le nombre maximal de tentatives OTP et la fenêtre de verrouillage doivent être configurés par l’établissement ; appliquer une limite par compte et par adresse IP sans confirmer au client si un compte existe.

Pour des erreurs JSON, utiliser une enveloppe stable : `{ "error": { "code": "...", "message": "...", "requestId": "...", "details": [] } }`. Les messages destinés aux étudiants doivent rester neutres et ne divulguer aucun relevé ou détail de dette non autorisé. Toute mutation à fort impact écrit son `AuditLog` dans la même transaction que le changement métier.

| Rôle | Permissions principales |
| --- | --- |
| `visitor` | Lire les pages publiques et les médias publics publiés. |
| `student` | Lire son propre profil, sa propre situation financière et, uniquement si les règles le permettent, ses résultats publiés. Aucun accès à un autre matricule. |
| `teacher` | Consulter les créneaux attribués ; créer ou soumettre des notes de ses cours attribués ; marquer les présences de ses séances. Pas de validation/publication, ni d’accès aux paiements. |
| `payment_manager` | Prévisualiser et confirmer les imports, saisir et valider les paiements ; lire les situations financières nécessaires à ses attributions ; octroyer ou révoquer une dérogation d’accès aux résultats avec motif et référence justificative. Aucun pouvoir de modifier une note ou de prendre une décision académique. |
| `academic_admin` | Vérifier les notes, saisir/vérifier les décisions académiques et gérer la publication selon délégation. Aucun accès de modification aux écritures comptables. |
| `super_admin` | Attribution de rôles, configuration, administration générale et revue des journaux selon politique documentée. Toute action reste auditée. |

Actions proposées pour `payment_manager` : `preview_import`, `confirm_import`, `add_manual_payment`, `mark_refund`. Cette liste n'accorde aucun droit de gérer les utilisateurs, de saisir des notes académiques ou de publier des résultats. `confirm_import` inclut la validation des lignes acceptées lors de la confirmation, sauf si la politique HEMIP impose une seconde validation distincte. `add_manual_payment` enregistre un paiement ; la possibilité de le valider immédiatement ou de le laisser en attente dépend de cette même règle de contrôle. Le rejet d'un paiement et l'ajout de notes internes ne sont pas inclus dans la liste tant qu'ils ne sont pas explicitement approuvés.

La cellule RBAC « Forcer accès » correspond à un droit distinct et limité : accorder ou révoquer une dérogation de consultation des résultats, toujours avec motif, périmètre, auteur, date, expiration éventuelle et audit. Ce droit ne donne accès ni au contenu des notes ni à la modification des résultats. La situation financière peut être consultée uniquement pour les dossiers nécessaires aux attributions du gestionnaire.

## Modèles et règles

Les montants sont exprimés en FCFA (XAF), sous forme décimale en chaîne dans les réponses. `PaymentRecord` et `StudentFinancialStatus` sont tenus à part des notes (`GradeRecord`). `clearedForResults` n’est ni une propriété calculée par le navigateur, ni une affirmation de l’étudiant : côté serveur, il représente un état financier recalculé à partir des paiements **validés**, du plan de frais et des dettes échues selon une règle de quitus définie par l’établissement, ou un déblocage explicite actif, daté et audité.

### Règle provisoire de quitus pour consulter les résultats

La proposition à configurer est :

```text
cleared_for_results = override_active
  OR (paiements_valides_nets_sur_periode >= seuil_approuve)
  OR (paiements_valides_nets_affectes_a_la_tranche_du_semestre >= montant_de_la_tranche)
```

Les paiements `pending` et `rejected` sont exclus. Les montants annulés ou remboursés doivent être déduits du total net. Le semestre doit être identifié par l'année académique et le semestre ; un paiement ne compte pour une tranche que s'il lui est affecté. Les valeurs suivantes restent à confirmer par HEMIP : période couverte par le seuil, montant/seuil XAF, si la tranche doit être entièrement payée ou si un montant minimum suffit, si elle doit être échue, et traitement d'un remboursement partiel. Aucune de ces valeurs n'est fixée dans le code.

Après chaque confirmation, validation, rejet, annulation ou remboursement, le statut financier doit être recalculé côté serveur de façon cohérente avec l'écriture du paiement. Seul un déblocage explicite actif peut remplacer la règle financière ; il exige une permission, un motif, un auteur, une date et une trace d'audit.

### Limites des actions de `payment_manager`

| Action | Portée provisoire |
| --- | --- |
| `preview_import` | Valider le fichier et afficher un aperçu privé ; aucune écriture financière. |
| `confirm_import` | Confirmer un aperçu non expiré, idempotent ; seules les lignes acceptées créent des écritures. Le statut final (en attente ou validé) dépend de la règle de contrôle financier à confirmer. |
| `add_manual_payment` | Enregistrer un paiement manuel avec motif et justificatif ; il ne peut pas écraser ni dupliquer une référence existante. Le droit de l'auteur de le valider lui-même reste à confirmer. |
| `mark_refund` | Enregistrer un remboursement/une contre-écriture liée au paiement d'origine, avec montant, motif, justificatif et audit. Ne jamais supprimer ni modifier silencieusement l'écriture originale. Les remboursements partiels nécessitent un modèle comptable à confirmer. |

Le droit RBAC limité « Forcer accès » doit être défini séparément des quatre actions de paiement ci-dessus et n'est jamais un simple booléen librement modifiable par le client.

Le schéma Prisma actuel utilise `PaymentStatus.reversed`, mais ne définit pas de modèle de remboursement distinct. Il faudra confirmer si les remboursements complets seuls sont permis ou ajouter une représentation explicite des remboursements partiels avant l'implémentation. La liste fournie n'inclut pas `reject_payment` ni `add_internal_note` : ces actions restent interdites tant que HEMIP ne les ajoute pas explicitement aux permissions.

Les résultats sont consultables si et seulement si l’étudiant authentifié est le propriétaire de la ressource (ou l’appelant détient un droit administratif explicite), `resultsPublished` est vrai pour le semestre concerné **et** `clearedForResults` vaut vrai (incluant une dérogation active). Ne jamais envoyer les notes dans une réponse 403, un journal accessible au client, un cache partagé, ou une réponse de prévisualisation. Les décisions suivent `DRAFT → SUBMITTED → VERIFIED → APPROVED → PUBLISHED`. Une modification postérieure à la publication crée une version/audit explicite ; elle n’écrase pas silencieusement la décision initiale.

## 1. Prévisualiser un fichier de paiements

`POST /api/payments/import-csv` — `payment_manager`, session requise. Multipart `file`, CSV UTF-8. Aucun paiement n’est écrit à cette étape.

```http
POST /api/payments/import-csv
Content-Type: multipart/form-data
```

```json
{
  "rows": [
    { "line": 2, "studentMatricule": "HEMIP-2026-001", "studentName": "Exemple A", "amount": "50000", "currency": "XAF", "method": "cash", "reference": "RECU-2026-001", "valid": true, "warnings": [] },
    { "line": 3, "studentMatricule": "HEMIP-2026-002", "studentName": "Exemple B", "amount": "45000", "currency": "XAF", "method": "mobile_money", "reference": "TX-EXEMPLE-002", "valid": true, "warnings": [] }
  ],
  "errors": [],
  "batchId": "imp_opaque_id",
  "checksum": "sha256:…",
  "expiresAt": "2026-09-24T15:30:00.000Z"
}
```

La réponse `batchId` peut référencer une prévisualisation temporaire privée ; elle ne confère jamais un droit de validation. Limiter la taille de fichier et le nombre de lignes. Valider et normaliser séparateurs, en-têtes, encodage, matricules, méthode, montant strictement positif, devise, références répétées et étudiants existants. La déduplication doit inclure l’historique afin qu’un nouvel import ne crée pas un paiement en double.

## 2. Confirmer un import prévisualisé

`POST /api/payments/confirm-import` — `payment_manager`, CSRF ou protection équivalente, confirmation d’un import non expiré. Employer une clef d’idempotence.

**Requête**

```json
{
  "batchId": "imp_opaque_id",
  "checksum": "sha256:…",
  "idempotencyKey": "f9c78918-050f-4f08-9a4e-4c0adbd6da2d",
  "acceptedLines": [2, 3],
  "rejectedLines": [],
  "reason": "Import du relevé validé par la gestionnaire",
  "fileRef": "storage://receipts/import-september.csv"
}
```

**Réponse 201** — enregistrer chaque ligne acceptée, recalculer l’état financier dans une transaction, créer l’événement d’audit et retourner uniquement un bilan sans données confidentielles inutiles.

```json
{
  "batchId": "imp_opaque_id",
  "status": "committed",
  "created": 2,
  "duplicates": 0,
  "rejected": 0,
  "financialStatusesRecalculated": 2,
  "auditEventId": "aud_opaque_id"
}
```

Ne jamais se fier à des lignes acceptées ou à un checksum fourni sans les rapprocher de l’aperçu stocké côté serveur. Un second appel avec la même clef retourne le résultat idempotent, sans recréer les écritures.

## 3. Saisir un paiement manuel

`POST /api/payments/manual` — `payment_manager`, saisie atomique et journalisée. Ne collecter ni données carte ni secret Mobile Money.

**Requête**

```json
{
  "studentMatricule": "HEMIP-2026-001",
  "amount": "50000",
  "currency": "XAF",
  "method": "cash",
  "reference": "RECU-2026-009",
  "paidAt": "2026-09-24T10:15:00.000Z",
  "reason": "Saisie du reçu papier vérifié",
  "fileRef": "storage://receipts/2026/RECU-2026-009.pdf"
}
```

**Réponse 201**

```json
{
  "payment": { "id": "pay_opaque_id", "studentMatricule": "HEMIP-2026-001", "amount": "50000", "currency": "XAF", "method": "cash", "status": "validated", "reference": "RECU-2026-009", "validatedAt": "2026-09-24T10:15:00.000Z" },
  "financialStatus": { "balanceDue": "0", "clearedForResults": true },
  "auditEventId": "aud_opaque_id"
}
```

Si le double contrôle est exigé par la politique financière, cette route crée une écriture `pending` et seul un décideur séparé valide le paiement. Le droit de faire ces deux étapes au même rôle doit être confirmé par l’administration.

## 4. Lire une situation financière

`GET /api/students/{matricule}/financial-status` — compte étudiant correspondant ou rôle administratif financier explicitement autorisé. Le backend vérifie le matricule côté serveur. Employer `Cache-Control: no-store, private`.

**Réponse 200**

```json
{
  "studentMatricule": "HEMIP-2026-001",
  "balanceDue": "125000",
  "currency": "XAF",
  "clearedForResults": false,
  "reason": "pending_balance",
  "override": null,
  "paymentsRecent": [
    { "id": "pay_opaque_id", "amount": "50000", "method": "cash", "status": "validated", "reference": "RECU-2026-001", "paidAt": "2026-09-20T12:00:00.000Z" }
  ],
  "updatedAt": "2026-09-24T14:30:00.000Z"
}
```

Pour l’étudiant, ne transmettre que ses propres informations. Au besoin, éviter de révéler l’existence d’un matricule tiers en renvoyant le même message neutre qu’une ressource introuvable.

## 5. Consulter les résultats

`GET /api/results/{studentId}` — étudiant propriétaire ou rôle académique/admin doté d’une permission explicite. Toujours `Cache-Control: no-store, private`. Réponse 403 si les résultats ne sont pas publiés ou que l’accès n’est pas autorisé.

**Réponse 200**

```json
{
  "studentId": "stu_opaque_id",
  "academicYear": "2025–2026",
  "semester": "Semestre 1",
  "resultsPublished": true,
  "results": [
    { "courseCode": "MRH101", "courseTitle": "Module exemple", "coefficient": "2", "grade": "14.50" }
  ],
  "average": "14.50",
  "decision": null
}
```

**403 neutre (même forme lorsque la publication n’est pas active)**

```json
{
  "error": {
    "code": "RESULTS_UNAVAILABLE",
    "message": "Résultats indisponibles. Votre situation administrative ou la publication des résultats ne permet pas leur consultation. Contactez la gestionnaire : +242 06 914 92 42 / hemilaperceeinformation@gmail.com",
    "requestId": "req_opaque_id"
  }
}
```

Le garde d’accès doit être exécuté **avant** de lire ou sérialiser les notes. Le contrôle n’est pas fondé seulement sur le statut financier : il vérifie aussi l’identité et la publication.

## 6. Saisir ou mettre à jour une décision académique

`POST /api/decisions` — rôle `academic_admin` ou `super_admin`. Cette route crée un brouillon seulement. Elle ne valide ni ne publie la décision.

**Requête**

```json
{
  "studentId": "stu_opaque_id",
  "academicYearId": "ay_opaque_id",
  "decisionType": "PASSAGE_AVEC_DETTES",
  "reason": "Décision validée par le conseil pédagogique du 20 septembre.",
  "fileRef": "storage://decisions/2026/CASE-001.pdf",
  "idempotencyKey": "0da3f540-8552-40d9-aadb-a8c01cc7ecb0"
}
```

**Réponse 201**

```json
{
  "decision": { "id": "dec_opaque_id", "studentId": "stu_opaque_id", "decisionType": "PASSAGE_AVEC_DETTES", "status": "DRAFT", "reason": "Décision validée par le conseil pédagogique du 20 septembre." },
  "auditEventId": "aud_opaque_id"
}
```

Des routes ou transitions dédiées devront vérifier séparément chaque transition autorisée (`submit`, `verify`, `approve`, `publish`) et consigner décideur, date, motif et référence documentaire.

## 7. Créer une URL d’envoi média signée

`POST /api/media/upload-url` — rôle publiciste privilégié (par exemple `academic_admin` ou `super_admin` doté de la permission médias). Fichier restreint : contrôle de visibilité et de rôle. URL de courte durée ; aucun secret de stockage côté navigateur.

**Requête**

```json
{
  "fileName": "atelier-hemip.jpg",
  "contentType": "image/jpeg",
  "fileSize": 1830204,
  "sha256": "…",
  "type": "IMAGE",
  "visibility": "PUBLIC"
}
```

**Réponse 200**

```json
{
  "uploadId": "upl_opaque_id",
  "mediaId": "med_opaque_id",
  "uploadUrl": "https://storage.example/signed/…",
  "method": "PUT",
  "headers": { "Content-Type": "image/jpeg" },
  "expiresAt": "2026-09-24T15:20:00.000Z",
  "requiredConfirmEndpoint": "/api/media/confirm"
}
```

Autoriser des types MIME et une taille strictement contrôlés ; ne jamais réutiliser un nom de clé fourni comme chemin arbitraire. Les vidéos de prototype peuvent référencer une URL YouTube non répertoriée ; vérifier le domaine et extraire l’identifiant autorisé côté serveur.

## 8. Confirmer un média reçu

`POST /api/media/confirm` — le même rôle autorisé à téléverser. Confirmer la réception du binaire sur le stockage en tête-à-tête, recalculer/valider checksum, MIME réel, dimensions et visibilité, puis journaliser l’utilisateur et enregistrer les métadonnées.

**Requête**

```json
{
  "uploadId": "upl_opaque_id",
  "mediaId": "med_opaque_id",
  "title": "Atelier de génie logiciel",
  "altText": "Étudiantes et étudiants assemblent un câble réseau dans l’atelier HEMIP.",
  "usageRights": "school_owned",
  "sourceUrl": null,
  "albumId": "album_opaque_id",
  "sortOrder": 4
}
```

**Réponse 201**

```json
{
  "media": { "id": "med_opaque_id", "type": "IMAGE", "title": "Atelier de génie logiciel", "visibility": "PUBLIC", "status": "READY" },
  "auditEventId": "aud_opaque_id"
}
```

Les médias restreints sont servis uniquement via URL signée fraîche générée après vérification d’accès. `sourceUrl` et `uploadedBy` sont conservés pour la traçabilité.

## 9. Lister les médias publiés d’un album

`GET /api/albums/{id}/medias` — visiteurs anonymes uniquement pour les médias `PUBLIC`, `READY` d’un album publié. Les médias restreints ne sont retournés qu’après authentification et autorisation explicite. Pagination par curseur et tri stable par `sortOrder`, puis `id`.

**Requête**

```http
GET /api/albums/album_opaque_id/medias?limit=24&cursor=opaque_cursor
```

**Réponse 200**

```json
{
  "album": { "id": "album_opaque_id", "title": "La vie à HEMIP" },
  "items": [
    { "id": "med_opaque_id", "type": "IMAGE", "title": "Atelier de génie logiciel", "altText": "Étudiantes et étudiants en atelier technique.", "thumbnailUrl": "https://cdn.example/public/thumb.webp", "url": "https://cdn.example/public/photo.webp", "sortOrder": 4 },
    { "id": "vid_opaque_id", "type": "VIDEO", "title": "La rentrée", "altText": "Présentation vidéo de la rentrée.", "sourceUrl": "https://www.youtube-nocookie.com/embed/VIDEO_ID", "sortOrder": 5 }
  ],
  "nextCursor": null
}
```

Valider la visibilité sur le serveur pour chaque item, même en cas de requête d’album public. Éviter toute mise en cache partagée si la réponse contient un lien restreint signé. Ne jamais accepter une URL vidéo arbitraire côté client : autoriser uniquement les hôtes approuvés et les identifiants intégrables. Réponse 404 pour un album absent/non publié ; réponse 403 ou liste publique filtrée lorsqu’un compte n’a pas accès aux éléments privés.

## Erreurs, codes HTTP et journalisation

| HTTP | `code` d’exemple | Cas d’usage |
| --- | --- | --- |
| `400` | `INVALID_REQUEST` | JSON, paramètres de route, ou formulaire malformed. |
| `401` | `AUTH_REQUIRED` | Session manquante, expirée ou OTP non validé. |
| `403` | `FORBIDDEN`, `RESULTS_UNAVAILABLE` | Rôle insuffisant, ressource interdite, résultat non publiable/non consultable. |
| `404` | `NOT_FOUND` | Ressource absente ; ne pas permettre l’énumération de dossiers étudiants. |
| `409` | `DUPLICATE_REFERENCE`, `BATCH_ALREADY_COMMITTED`, `STATE_CONFLICT` | Référence paiement déjà utilisée, idempotence incompatible, transition de workflow interdite. |
| `413` | `FILE_TOO_LARGE` | Fichier excédant la limite. |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Type non accepté ou format de fichier incorrect. |
| `422` | `VALIDATION_ERROR`, `CSV_ROW_ERRORS` | Données métier invalides, en-têtes/ligne CSV inconnus, montant négatif/nul ou matricule inexistant. |
| `429` | `RATE_LIMITED`, `OTP_ATTEMPTS_EXCEEDED` | Limite d’OTP, d’authentification ou d’API atteinte ; inclure `Retry-After`. |
| `500` | `INTERNAL_ERROR` | Échec inattendu, message neutralisé, sans stack trace en production. |
| `503` | `DEPENDENCY_UNAVAILABLE` | Stockage ou service temporairement indisponible ; aucune validation partielle. |

Exemple d’erreur CSV 422 :

```json
{
  "error": {
    "code": "CSV_ROW_ERRORS",
    "message": "Le fichier comporte des lignes à corriger.",
    "requestId": "req_opaque_id",
    "details": [
      { "line": 4, "field": "montant", "code": "AMOUNT_NOT_POSITIVE", "message": "Saisissez un montant strictement supérieur à zéro." },
      { "line": 7, "field": "matricule", "code": "STUDENT_NOT_FOUND", "message": "Le matricule doit correspondre à un dossier HEMIP actif." }
    ]
  }
}
```

Exemple d’erreur générique 500 :

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Une erreur est survenue. Réessayez plus tard.",
    "requestId": "req_opaque_id"
  }
}
```

## Journal d’audit et conservation

Pour chaque import CSV, validation/rejet/correction de paiement, dérogation financière, écriture ou modification de note, décision académique, changement d’autorisation et publication : écrire `who` (identité du sujet), `when` (UTC), `what` (action et entité), `reason`, `fileRef` et `requestId`; consigner un diff minimal non sensible si nécessaire. Ne pas enregistrer OTP, jetons, secrets, numéros de carte, contenu de pièces justificatives ou notes dans une ligne de log technique ordinaire. Les journaux d’audit métier sont conservés selon la fenêtre **90–180 jours** à valider ; définir les cycles d’archivage, sauvegarde et suppression en concertation avec l’établissement et le responsable conformité.

## Contrôles avant production

1. Approuver les règles de quitus, paiements partiels, échéances, double validation et révocation de dérogation.
2. Définir les modules/coefficient officiels, les règles de calcul/moyenne et les règles de rattrapage/décision.
3. Activer la validation Zod côté serveur, une gestion CSRF adaptée, CSP, limites de débit, MFA admin, révocation de sessions et alertes sur actions à risque.
4. Tester l’isolation entre comptes étudiants et l’absence de notes dans réponses bloquées et caches.
5. Remplacer toutes données d’exemple, puis exécuter les migrations Prisma vers une base **Neon/PostgreSQL dédiée HEMIP** après sauvegarde et revue DBA. Aucune base n’est migrée par ce prototype.
