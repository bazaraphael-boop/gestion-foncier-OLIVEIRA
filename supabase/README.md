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
   6. `migrations/20261028000000_parcel_documents_storage.sql` (documents des parcelles : espace privé « parcel-documents »)
   7. `migrations/20261029000000_concession_zones.sql` (zones de la concession : seul l'admin ajoute ou supprime)
   8. `migrations/20261030000000_security_hardening.sql` (champs réservés à l'admin, journal d'audit fiable, diagnostic RLS)
   9. `migrations/20261031000000_releve_verification.sql` (registre des relevés : le QR code du PDF se vérifie en ligne)
   10. `migrations/20261101000000_attack_simulation_fixes.sql` (parcelles piégées refusées, relevé vérifiable émis par l'admin seul)
   11. `migrations/20261102000000_admin_mfa_and_releve_code.sql` (double vérification de l'admin, code imprimé des relevés)
   12. `migrations/20261103000000_surveyor_server_time.sql` (suivi des arpenteurs : heure fixée par le serveur)
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
  `arpenteur` et son vrai nom dans `full_name` (étape 4). Un compte par personne : le nom apparaît sur la
  carte de l'admin, et deux personnes sur le même compte s'afficheraient comme une seule.
- **Retirer un accès** : supprimer l'utilisateur dans *Authentication → Users*.
- **Photos des parcelles** : stockées dans *Storage → parcel-photos* (privé). L'admin et les arpenteurs
  peuvent en ajouter, seul l'admin peut en supprimer.
- **Documents des parcelles** : titre de concession, contrat, plan cadastral, PV de bornage… stockés dans
  *Storage → parcel-documents* (privé). L'admin et les arpenteurs les ajoutent et les consultent ; seul l'admin les supprime.
- **Double vérification** : *Outils → Sécurité → Double vérification*. Une fois active, le mot de passe seul
  ne donne plus aucun droit admin. **Téléphone perdu** : le propriétaire du projet Supabase exécute dans le
  SQL Editor `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'EMAIL_ADMIN');`
  puis l'admin se reconnecte et réactive aussitôt la double vérification. Protégez aussi le compte Supabase
  lui-même avec sa propre double vérification : il donne accès à tout.
- **Relevés** : chaque relevé est inscrit dans la table `releves`. Pour en annuler un : *Table Editor →
  releves → revoked = true* ; son QR code affiche alors « Relevé annulé ».
- **Suivi des arpenteurs** : quand un arpenteur active son GPS, sa position et son trajet du jour
  apparaissent sur la carte de l'admin (encadré « Arpenteurs »). Une petite mention le lui indique à
  l'écran ; prévenez-le aussi par écrit (contrat ou règlement intérieur). Les trajets de plus de 30 jours sont supprimés
  automatiquement.
- **Mot de passe oublié** : *Authentication → Users → … → Send password recovery*.
