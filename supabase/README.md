# Mise en place de l'authentification Supabase

L'application ne contient plus aucun mot de passe. Les comptes sont gérés par **Supabase Auth**,
le rôle de chaque compte est lu dans la table `public.profiles`, et la base est protégée par des
règles **RLS**.

| Rôle | Lecture | Créer / modifier | Supprimer | Périmètre concession | Journal d'audit |
|---|---|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ | ✅ | lecture |
| `arpenteur` | ✅ | ✅ | ❌ | ❌ | écriture seule |
| `client` | ✅ | ❌ | ❌ | ❌ | écriture seule |
| non connecté | ❌ | ❌ | ❌ | ❌ | ❌ |

## Étapes (dans l'ordre, avant de déployer la nouvelle version)

1. **Bloquer les inscriptions publiques** : *Authentication → Sign In / Providers → Email* :
   désactiver « Allow new users to sign up ». Seul l'administrateur crée les comptes.
2. **Créer les comptes** : *Authentication → Users → Add user → Create new user*, en cochant
   « Auto Confirm User » :
   - votre compte administrateur (mot de passe fort, 10 caractères minimum) ;
   - un compte par arpenteur ;
   - le compte partagé du portail client `client@oliveira.cd`, avec comme mot de passe le
     **code PIN à 6 chiffres** (pas `123456`).
     Si Supabase refuse un mot de passe de 6 caractères, régler
     *Authentication → Policies → Minimum password length* sur 6.
3. **Exécuter la migration** : *SQL Editor → New query*, coller
   `migrations/20261022000000_auth_roles_rls.sql`, puis *Run*.
4. **Attribuer les rôles** : dans le SQL Editor, exécuter les requêtes `insert into public.profiles`
   de la section 5 du script, en y mettant les vrais e-mails.
5. **Vérifier** : *Table Editor → parcels* doit afficher « RLS enabled ». Depuis un terminal, sans
   être connecté, cette requête doit renvoyer `[]` :
   ```bash
   curl "https://oliofshztausxckzmfce.supabase.co/rest/v1/parcels?select=id" -H "apikey: <clé publishable>"
   ```
6. **Déployer** la nouvelle version de l'application.

> ⚠️ Entre l'étape 3 et l'étape 6, l'ancienne version en ligne ne pourra plus lire ni écrire les
> parcelles : enchaînez les étapes rapidement.

## Gestion courante

- **Changer le code PIN client** : dans l'app, *Outils → Sécurité → Code PIN Client* (admin).
- **Changer son mot de passe** : *Outils → Sécurité → Mot de passe*.
- **Ajouter un arpenteur** : créer le compte (étape 2), puis l'insérer dans `profiles` avec le rôle
  `arpenteur` (étape 4).
- **Retirer un accès** : supprimer l'utilisateur dans *Authentication → Users*.
- **Mot de passe oublié** : *Authentication → Users → … → Send password recovery*.
