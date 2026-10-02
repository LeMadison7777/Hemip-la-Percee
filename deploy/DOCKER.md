# Déploiement Docker et montée en charge HEMIP

## Vue d’ensemble

Le conteneur est stateless : sessions Auth.js en JWT partagé entre réplicas, OTP et quotas dans Neon/PostgreSQL, fichiers dans le bucket privé Supabase. Aucun média utilisateur ni état de session dépend du disque local. Le reverse proxy/load balancer doit fournir HTTPS; le serveur Express fait confiance à un seul proxy en amont (`trust proxy = 1`), à adapter si le chemin réseau réel diffère.

## Exécution locale portable

Prérequis : Docker Engine/Desktop et Docker Compose v2. Créez un fichier de secrets **hors du dépôt**, par exemple `~/.config/hemip/hemip-runtime.env`, avec permissions `chmod 600`. Il doit contenir les variables `NEON_DATABASE_URL`, `NEON_DIRECT_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PRIVATE_BUCKET` et `AUTH_SECRET`. `AUTH_SECRET` est facultatif, si vous souhaitez gérer/faire tourner le secret de session Auth.js indépendamment. L’application limite par défaut le pool Prisma à 5 connexions par instance, ajustables via `connection_limit`. Gardez les URL Neon sur une branche de développement. Ne mettez jamais ces valeurs dans Git, l’image Docker, un fichier sous `client/` ou une capture d’écran.

```sh
HEMIP_RUNTIME_ENV_FILE="$HOME/.config/hemip/hemip-runtime.env" docker compose -f compose.yaml up --build -d
curl --fail http://127.0.0.1:3000/healthz
```

Visitez `http://127.0.0.1:3000`. Compose sert à reproduire l’environnement local; **une réplique Compose seule ne fait pas autoscaler**. Pour l’arrêter : `HEMIP_RUNTIME_ENV_FILE=… docker compose -f compose.yaml down`.

## Préparer Neon

Le dépôt conserve une copie structurelle du schéma Neon historique dans `../specs/database/neon-existing-schema-2026-09-30.prisma`. La base Neon actuellement configurée a déjà ses 25 tables historiques préservées, son baseline enregistré et l’intégration appliquée. Pour une autre base existante correspondant au snapshot, vérifie le schéma, enregistre une seule fois le baseline avec `npm exec -- prisma migrate resolve --applied 0000_neon_existing_baseline --schema=prisma/schema.prisma`, puis applique l’intégration avec `npm run prisma:deploy`. Pour une base vide, `npm run prisma:deploy` applique baseline et intégration. Vérifie toujours la branche Neon et le diff avant application; les migrations s’exécutent une seule fois comme job de livraison et **pas** au démarrage de chaque réplique. Neon pooler sert aux requêtes de l’application; l’URL directe sert aux migrations.

## Déploiement horizontal

`deploy/k8s/hemip.yaml` fournit un Deployment à 2 réplicas, Service interne, probes, placement réparti, disruption budget et HPA CPU jusqu’à 10 réplicas. Remplacez le placeholder d’image par votre image poussée vers un registre que votre cluster peut lire. Les configurations HPA doivent disposer de `metrics-server`; utilisez un Ingress ou load balancer TLS devant le Service.

Préparez le secret d’exécution du cluster hors du dépôt, puis créez `hemip-runtime` via le gestionnaire de secrets natif de votre plateforme (préféré) ou, à défaut, un fichier éphémère protégé et `kubectl create secret generic hemip-runtime --from-env-file=...`. Ne commitez jamais ce fichier. Déployez ensuite :

```sh
kubectl apply -f deploy/k8s/hemip.yaml
kubectl rollout status deployment/hemip
kubectl get hpa,pods,service hemip
```

Le conteneur ne possède pas encore de test de charge, de politique de reprise de disaster-recovery, d’Ingress TLS configuré, ni d’instance Kubernetes validée. Le HPA est une base, pas une garantie de capacité : la limite pratique dépend du cluster, de Neon (pool de connexions), de Resend, de Supabase et de tests de charge représentatifs. Les paramètres Prisma doivent respecter le budget de connexions du plan Neon; multiplier les pods ne multiplie pas gratuitement la capacité de Neon. En pratique, fixez le pool Prisma bas par pod et chargez graduellement avant d’augmenter `maxReplicas`.

## Plateformes

La même image Linux/amd64 est portable vers Docker Desktop (Mac/Windows/Linux), Docker Engine, les Kubernetes gérés et les services de conteneur compatibles. La PWA s’installe ensuite depuis un navigateur HTTPS sur téléphone, tablette et ordinateur. Le moteur de conteneur ne rend pas le navigateur hors ligne permanent et YouTube exige toujours une connexion réseau.
