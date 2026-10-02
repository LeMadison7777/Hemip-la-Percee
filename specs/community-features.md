# Témoignages, annonces et notifications

État : la migration `0002_community_features` est appliquée à la base Neon configurée dans le `.env` local. Tout autre environnement doit l’appliquer avant mise en service. Les clés VAPID sont configurées localement; l’environnement de production doit aussi les recevoir, et chaque étudiant ou enseignant doit autoriser les notifications depuis `/annonces` sur son appareil.

## Témoignages

- `GET /api/community/testimonials` retourne uniquement les textes soumis par des étudiants, sans données de démonstration.
- `POST /api/community/testimonials` est réservé aux comptes `student`. Le texte fait entre 20 et 3 000 caractères; un étudiant peut soumettre au plus cinq témoignages sur 24 heures.
- Chaque soumission est publiée immédiatement. Le nom du compte est masqué par défaut et n’apparaît qu’après consentement explicite enregistré avec le témoignage.
- `PUT /api/community/testimonials/:id/like` et `DELETE /api/community/testimonials/:id/like` réservent une réaction par compte étudiant ou enseignant et par témoignage.
- Les mutations vérifient l’origine de la requête et le rôle du compte côté serveur.

## Annonces

- `GET /api/announcements` exige une session étudiante, enseignante ou administrative. Les étudiants et enseignants voient les annonces qui les ciblent; l’administration voit les annonces destinées à ces deux groupes.
- `POST /api/admin/announcements` est réservé à `academic_admin` et `super_admin`. La publication est immédiate et l’audit est écrit dans la même transaction que l’annonce.
- L’audience peut être les étudiants, les enseignants ou les deux. Une date d’expiration facultative masque ensuite l’annonce de la liste.

## Abonnements Web Push

- `GET /api/push/public-key` expose uniquement la clé publique VAPID.
- `POST /api/push/subscriptions` et `DELETE /api/push/subscriptions` exigent un compte étudiant ou enseignant et une requête de même origine. L’utilisateur peut activer ou désactiver les notifications pour son appareil depuis `/annonces`.
- Lorsqu’une annonce est publiée, le serveur envoie une notification à chaque abonnement correspondant à l’audience. Le texte de la notification demande d’ouvrir `/annonces` et n’inclut pas le corps complet de l’annonce.
- Le service nécessite `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` côté serveur, HTTPS (localhost pour le développement), l’autorisation du navigateur et un service push pris en charge.
- Les abonnements qui répondent HTTP 404 ou 410 sont supprimés. Les autres erreurs d’envoi n’annulent pas la publication de l’annonce.
