# LOA Compagnon

> Compagnon mobile et desktop pour gérer ta fiche de personnage **Legends of Akeroth** pendant tes parties (en présentiel ou sur Discord).

🎲 Pensé pour les groupes francophones qui jouent à **Legends of Akeroth** (Crossed Paths Press). Fonctionne hors-ligne, données 100% locales, partage par fichier JSON.

---

## ✨ Phase 1 — ce qui marche aujourd'hui

- **Multi-fiches** : crée plusieurs persos, switch en un clic, sélecteur en haut.
- **Jauges interactives** : HP, SP, MP, DEF, Wounds avec boutons +/− (les Wounds montent automatiquement si HP tombe à 0).
- **Dé de Classe** : calcule automatiquement le bon `XdY` selon ton niveau total et ton attribut Primary. Lance, soigne hors combat (1× entre repos), et change de taille au bon seuil quand tu montes en niveau.
- **Statuts** : les 17 statuts officiels avec leurs effets, applicables/retirables en un clic.
- **Lanceur de Checks** : choisis 1 ou 2 attributs, ajoute des Boons/Banes, modal animé avec les dés qui roulent, paliers Échec / Mitigé / Succès complet calculés.
- **Repos court** : applique toutes les règles d'un coup (Wounds remises à zéro, soin du CD refresh, Limit Break refresh, +SP via jet de CD).
- **Niveau supérieur** : assistant qui te montre ce qui change (Dé de Classe au seuil, +1 attribut à choisir, perk à choisir).
- **Édition de fiche** : nom, kin, classe principale + niveau, attributs, maxes des jauges.
- **Export / Import JSON** : partage avec ton groupe sur Discord.
- **Réglages** : 9 options visuelles et sonores (scanlines, coins ornés, alerte HP bas, pulse Overdrive, bips SNES…), persistées localement.
- **PWA installable** : ajoute l'app sur ton écran d'accueil iOS/Android/PC.

## 🚧 Ce qui arrive ensuite

Phases suivantes : inventaire (armes + Triangle Blade/Breaker/Lance/Bow + armures + Counter), combat complet (attaque avec Base Die qui explose + affinités), multiclasse avancé + Jobs + Limit Breaks complets, Waymate (compagnon contrôlé par les joueurs), tables aléatoires (Travel Events, NPC, Settlements, Boss Phase Changes, etc.).

---

## 🚀 Déployer l'app (étape par étape, sans coder)

### 1. Créer un nouveau repo GitHub

1. Va sur [github.com](https://github.com) et connecte-toi.
2. En haut à droite, clique sur le **+** puis **New repository**.
3. **Repository name** : `loa-compagnon`
4. Coche **Public** (obligatoire pour GitHub Pages gratuit).
5. Coche **Add a README file** (pour pouvoir activer Pages tout de suite).
6. Clique **Create repository**.

### 2. Uploader les fichiers

1. Dans ton nouveau repo, clique sur **Add file** → **Upload files**.
2. Glisse-dépose **tous les fichiers** de ce dossier sauf le `README.md` (que tu remplaceras après) :
   - `index.html`
   - `style.css`
   - `app.js`
   - `manifest.json`
   - `service-worker.js`
   - `icon.svg`
   - `loa_demo_sushi.json`
3. En bas, message de commit : `Phase 1 — squelette LOA Compagnon`
4. Clique **Commit changes**.
5. Pour remplacer le `README.md` : ouvre le fichier, clique sur l'icône crayon ✎, colle le contenu de ce README, et commit.

### 3. Activer GitHub Pages

1. Dans le repo, va dans **Settings** (onglet en haut).
2. Dans le menu de gauche, **Pages**.
3. Sous **Build and deployment** :
   - **Source** : sélectionne **Deploy from a branch**
   - **Branch** : `main`, dossier `/ (root)`
4. Clique **Save**.
5. Attends 1-2 minutes. L'URL de ton app apparaîtra en haut de la page (format `https://<ton-pseudo>.github.io/loa-compagnon/`).

### 4. Tester

1. Ouvre l'URL. Tu devrais voir l'app avec une fiche vide « Nouveau Héros ».
2. Clique l'icône **↓** dans la barre d'outils pour importer `loa_demo_sushi.json` et tester avec Sushi en niveau 1.
3. Ajoute l'app à ton écran d'accueil (cf. section suivante) pour avoir l'expérience PWA complète.

---

## 📲 Installer comme app

### Sur iPhone / iPad
Ouvre l'URL dans **Safari**, tape l'icône **Partager** (carré + flèche), puis **Sur l'écran d'accueil**.

### Sur Android
Ouvre l'URL dans **Chrome**, un bandeau **« Installer l'app »** apparaît, ou utilise le menu **⋮ → Installer l'app**.

### Sur PC (Chrome / Edge)
Ouvre l'URL, icône **Installer** dans la barre d'URL, ou menu **⋮ → Installer LOA Compagnon**.

---

## 🛠️ Technique

- **HTML / CSS / JavaScript vanilla** — aucune dépendance externe (juste Google Fonts pour Press Start 2P et Sora).
- **Service Worker** pour le mode offline.
- **PWA Manifest** pour l'installation.
- **localStorage** pour la persistance multi-fiches.
- **Format JSON** : enveloppe `loa-compagnon` v1, calquée sur la convention de Drakonym Compagnon pour cohérence.

### Structure

```
loa-compagnon/
├── index.html              Structure de l'app
├── style.css               Thème FF bleu + layout responsive
├── app.js                  Logique complète (~800 lignes)
├── manifest.json           Manifeste PWA
├── service-worker.js       Cache offline
├── icon.svg                Icône de l'app
├── loa_demo_sushi.json     Fiche démo
└── README.md               Ce fichier
```

### Mettre à jour l'app

Quand une nouvelle phase est livrée, tu remplaces les fichiers concernés (souvent `app.js` et parfois `style.css`/`index.html`), tu commits, et tu bumps le `CACHE_NAME` dans `service-worker.js` (ex. `loa-compagnon-v1` → `loa-compagnon-v2`) pour forcer le rechargement chez tous les joueurs.

---

## ⚖️ Licence & crédits

Cette app est un produit indépendant créé pour aider à jouer à Legends of Akeroth. Elle n'est **pas affiliée à ni endossée par Crossed Paths Press**.

> Legends of Akeroth™ et Akeroth™ sont des marques de Crossed Paths Press.

**Polices** : Press Start 2P et Sora (Google Fonts).

---

## 💌 Retours

Bug, manque, idée ? Ouvre une issue sur le repo GitHub.

Bon jeu. 🐲
