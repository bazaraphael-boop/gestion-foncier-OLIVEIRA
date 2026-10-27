# Mise en place de l'authentification Supabase

L'application ne contient plus aucun mot de passe. Les comptes sont gérés par **Supabase Auth**,
le rôle de chaque compte est lu dans la table `public.profiles`, et la base est protégée par des
règles **RLS**.

| Rôle | Lecture | Créer une parcelle | Modifier la fiche | Modifier les bornes | Supprimer | Périmètre concession | Journal d'audit |
|---|---|---|---|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | lecture |
| `arpenteur` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | écriture seule |
| non connecté | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

Il n'y a plus de portail client à code PIN.

## Étapes (dans l'ordre, avant de déployer la nouvelle version)

1. **Bloquer les inscriptions publiques** : *Authentication → Sign In / Providers → Email* :
   désactiver « Allow new users to sign up ». Seul l'administrateur crée les comptes.
2. **Créer les comptes** : *Authentication → Users → Add user → Create new user*, en cochant
   « Auto Confirm User » :
   - votre compte administrateur (mot de passe fort, 10 caractères minimum) ;
   - un compte par arpenteur.
3. **Exécuter les migrations dans l'ordre** : *SQL Editor → New query*, coller le fichier, *Run* :
   1. `migrations/20261022000000_auth_roles_rls.sql`
   2. `migrations/20261023000000_admin_only_bornes_no_client.sql`
   3. `migrations/20261024000000_parcel_photos_storage.sql` (photos des parcelles : espace privé « parcel-photos »)
   4. `migrations/20261026000000_fix_photos_and_bornes_check.sql` (correctif + diagnostic : chaque ligne doit afficher OK)
   5. `migrations/20261027000000_surveyor_live_tracking.sql` (suivi en direct de l'arpenteur : seul l'admin voit les positions)
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

- **Changer son mot de passe** : *Outils → Sécurité → Mot de passe*.
- **Ajouter un arpenteur** : créer le compte (étape 2), puis l'insérer dans `profiles` avec le rôle
  `arpenteur` (étape 4).
- **Retirer un accès** : supprimer l'utilisateur dans *Authentication → Users*.
- **Photos des parcelles** : stockées dans *Storage → parcel-photos* (privé). L'admin et les arpenteurs
  peuvent en ajouter, seul l'admin peut en supprimer.
- **Suivi des arpenteurs** : quand un arpenteur active son GPS, sa position et son trajet du jour
  apparaissent sur la carte de l'admin (encadré « Arpenteurs »). Rien ne s'affiche chez l'arpenteur :
  prévenez-le du suivi (contrat ou règlement intérieur). Les trajets de plus de 30 jours sont supprimés
  automatiquement.
- **Mot de passe oublié** : *Authentication → Users → … → Send password recovery*.
