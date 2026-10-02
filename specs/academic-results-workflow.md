# Workflow des notes et publication des résultats

**État : spécification métier provisoire, à confirmer par HEMIP.** Les formules, seuils, décisions de passage, permissions et délais ci-dessous ne sont pas encore des règles de production. Ils doivent rester configurables jusqu'à validation officielle.

## 1. Calcul des moyennes

Formule proposée, en attente de confirmation :

```text
moyenne = somme(note_i × coefficient_i) / somme(coefficient_i)
```

Les notes doivent être calculées côté serveur avec une précision décimale. Avant de figer la règle, HEMIP doit confirmer : l'échelle de notation, la validité des coefficients, le traitement des notes absentes ou dispensées, les conversions entre échelles et la règle d'arrondi. Aucune valeur par défaut ne doit être transformée en règle académique implicite.

## 2. Passage et rattrapage

**À confirmer :** seuil de validation, compensation entre matières ou semestres, conditions d'accès au rattrapage, nombre de tentatives, matières concernées, période de rattrapage et note retenue après rattrapage (meilleure, dernière, plafonnée ou autre).

Les libellés « validé », « rattrapage » et « ajourné » décrivent des décisions académiques. Ils ne doivent pas entraîner un seuil ou un calcul tant que les règles officielles ne sont pas fournies.

## 3. Cycle de vie et statuts

La liste provisoire proposée est :

```text
["brouillon", "soumis", "verifie", "valide", "publie", "ajourne"]
```

La séquence de travail proposée est `brouillon → soumis → vérifié → validé → publié`. Un dossier incomplet ou rejeté peut revenir en brouillon avec un motif et une trace d'audit.

À confirmer : « ajourné » semble désigner une décision de résultat, et non une étape de traitement. Il est recommandé de le modéliser séparément des statuts de workflow, avec les décisions « validé / rattrapage / ajourné » configurées selon les règles HEMIP. La liste et les transitions définitives restent à valider avant migration ou implémentation.

## 4. Rôles et transitions provisoires

| Action | Rôle proposé | Conditions |
| --- | --- | --- |
| Créer/modifier un brouillon et soumettre les notes | `teacher` | Uniquement pour les cours affectés à l'enseignant. |
| Vérifier | `academic_admin` | Vérification enregistrée avec identité et date. |
| Valider | `academic_admin` | Validation enregistrée distinctement de la vérification. La séparation entre personnes est à confirmer. |
| Publier | `academic_admin` ou `super_admin` | Publication uniquement après validation et après le délai configuré. |
| Corriger ou rouvrir après publication | À confirmer | Créer une nouvelle version ou une révision auditée ; ne jamais modifier silencieusement un résultat publié. |

Ces permissions reprennent la proposition fournie. Elles doivent être alignées avec la matrice RBAC générale, qui donne au `super_admin` des droits étendus. Le rôle `payment_manager` ne modifie pas les notes dans la matrice actuelle.

Configuration provisoire :

```json
{
  "formula": "sum(note_i * coeff_i) / sum(coeff_i)",
  "passing_rules": "À confirmer par HEMIP",
  "retake_rules": "À confirmer par HEMIP",
  "statuses": ["brouillon", "soumis", "verifie", "valide", "publie", "ajourne"],
  "workflow_permissions": {
    "submit": ["teacher"],
    "verify": ["academic_admin"],
    "validate": ["academic_admin"],
    "publish": ["academic_admin", "super_admin"]
  },
  "publish_delay_hours": 0
}
```

`publish_delay_hours: 0` signifie publication possible immédiatement après validation, si la personne habilitée déclenche la publication. Ce délai est une valeur de départ proposée, pas une politique confirmée.

## 5. Affichage étudiant pendant un rattrapage

Après publication et vérification des droits d'accès, l'espace étudiant ne montre que les données du compte connecté. Dans la vue de rattrapage, afficher uniquement les matières concernées et, si HEMIP le confirme, la note initiale, la note de rattrapage, la note retenue et la décision. Ne jamais révéler les notes d'autres étudiants ni des résultats non publiés. Le contrôle d'accès reste côté serveur ; masquer une note dans l'interface seule ne suffit pas.

## 6. Publication, audit et sécurité

- Seuls les résultats validés peuvent être publiés ; la date, l'auteur et le périmètre de publication sont enregistrés.
- Chaque soumission, vérification, validation, retour en correction, publication et correction ultérieure produit un événement d'audit avec `who`, `when`, `what`, `reason` et `requestId`.
- Les notes et résultats restent exclus du cache PWA et des réponses partagées ; les routes personnelles utilisent `Cache-Control: no-store, private`.
- Les contrôles de rôle, de cours affecté, d'étudiant propriétaire et d'état publié sont appliqués côté serveur.

## 7. Questions à trancher avant l'implémentation

1. Échelle de notation, coefficients officiels, matières et calcul des moyennes par matière, semestre et année.
2. Seuils de réussite, compensation, conditions et nombre de rattrapages, note retenue et décision finale.
3. Rôle qui peut renvoyer une saisie en correction ; nécessité d'une vérification et validation par deux personnes différentes.
4. `ajourné` comme statut ou comme décision, et traitement des décisions de rattrapage.
5. Publication globale ou par étudiant/matière, délai, possibilité de dépublication et procédure de correction après publication.
6. Champs visibles à l'étudiant pendant et après un rattrapage.

## 8. Écart avec le schéma actuel

`WorkflowStatus` dans `prisma/schema.prisma` contient déjà `DRAFT`, `SUBMITTED`, `VERIFIED`, `APPROVED`, `PUBLISHED` et `CHANGES_REQUESTED`. Ces valeurs couvrent une partie du cycle proposé, mais leur correspondance définitive avec les libellés français et la place de `ajourné` doivent être décidées avant toute migration. Le schéma actuel ne constitue pas à lui seul un workflow métier opérationnel ; les routes de notes et de publication restent à implémenter et protéger côté serveur.
