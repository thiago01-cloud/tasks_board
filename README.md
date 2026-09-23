# TASKS — Web

Application web de TASKS (Next.js, App Router, TypeScript, Tailwind CSS), qui sert aussi de backend (API) consommé par l'app mobile Flutter.

## Démarrage

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Copier le fichier d'environnement :

   ```bash
   cp .env.example .env
   ```

   Renseignez `DATABASE_URL`/`DATABASE_URL_UNPOOLED` (chaînes de connexion Neon — voir `.env.example`, le plus simple étant `vercel env pull .env`) et `JWT_SECRET` (valeur aléatoire, ex. `openssl rand -base64 32`).

3. Appliquer le schéma à la base :

   ```bash
   npm run db:migrate
   ```

4. Lancer le serveur de développement :

   ```bash
   npm run dev
   ```

L'application est ensuite disponible sur [http://localhost:3000](http://localhost:3000).

## Structure

- `src/app/` — pages et layouts (App Router)
- `src/app/api/` — routes API (auth, entreprises...), consommées par le web et par l'app mobile Flutter
- `src/lib/` — logique partagée : `auth.ts` (sessions), `token.ts` (jetons signés), `prisma.ts`, `phone.ts`, `enums.ts`, `constants.ts`
- `src/middleware.ts` — protège le tableau de bord et gère les redirections selon l'étape de connexion
- `prisma/schema.prisma` — modèle de données (voir les spécifications pour le détail des entités)

## Base de données : PostgreSQL (Neon)

`prisma/schema.prisma` cible PostgreSQL. Les champs qui seraient des enums (rôle, statut, priorité) sont volontairement restés des `String`, avec les valeurs autorisées listées en commentaire dans le schéma et validées dans `lib/enums.ts` — voir le commentaire en tête de `schema.prisma` pour le détail de ce choix.

## Déploiement (Vercel + Neon)

1. Sur le projet Vercel, onglet Storage → Connect Database → Neon (Marketplace), pour créer/connecter une base — Vercel crée alors automatiquement `DATABASE_URL` et `DATABASE_URL_UNPOOLED` dans les variables d'environnement du projet.
2. Ajouter `JWT_SECRET` à la main dans Settings → Environment Variables (Production + Preview) — valeur différente de celle utilisée en local.
3. En local, `vercel link` puis `vercel env pull .env` pour récupérer ces variables, puis `npx prisma migrate dev --name init` pour créer les tables sur Neon et générer les migrations PostgreSQL (à committer).
4. `git push` — le dépôt étant déjà connecté à Vercel, ça déclenche le déploiement. La commande de build (`npm run build`) applique automatiquement les migrations en attente (`prisma migrate deploy`) avant de builder l'application, donc les déploiements suivants n'ont rien de spécial à faire pour la base de données.

## État actuel

Authentification, tableau de bord, gestion des tâches (avec sous-tâches), équipe/groupes, notifications.
