# rv-PlayRoom

Jeu de cartes Papayoo multijoueur dans un salon 3D au style cartoon, joué dans le navigateur, sans compte ni serveur de jeu. Nom de travail : PlayRoom. Tout le texte de l'interface est en français.

En ligne sur GitHub Pages : https://naywayo.github.io/rv-PlayRoom/ (dépôt public `NayWaYo/rv-PlayRoom`, publication depuis `main`, dossier racine, environ une minute après chaque push). Remis en ligne le 2026-10-27 après une coupure. Pour couper à nouveau ou rétablir :

```bash
gh api -X DELETE repos/NayWaYo/rv-PlayRoom/pages
gh api -X POST repos/NayWaYo/rv-PlayRoom/pages -f "source[branch]=main" -f "source[path]=/"
```

## Façon de travailler

- Une branche par lot (`feat/...`, `fix/...`), commits en français avec préfixe `feat:`, `fix:` ou `docs:`.
- Tester en local avant de proposer quoi que ce soit, puis pousser la branche.
- Ne fusionner dans `main` que sur demande explicite, en fast-forward. `main` part en ligne : vérifier le déploiement avec `gh run watch` et `curl` sur le site.
- Supprimer les branches fusionnées quand on fait le ménage.

## Architecture

Pas de build : HTML, CSS et modules ES chargés par une import map. three.js 0.186.1 et Trystero 0.26.0 viennent de jsDelivr, en versions figées.

L'import map donne aussi une version à chaque fichier de `js/` (`./js/fps.js?v=AAAA-MM-JJ`). GitHub Pages fait garder chaque fichier 10 minutes au navigateur, chacun de son côté : sans cette version, un joueur peut recevoir le nouvel `index.html` avec un ancien module, et le jeu plante. **À chaque mise en ligne qui touche `js/`, changer la date dans toutes les entrées de l'import map** (index.html), avec `-2`, `-3`… s'il y en a plusieurs le même jour. Un nouveau fichier dans `js/` doit y être ajouté aussi. La boucle d'animation attrape les erreurs : une image qui plante ne fige plus le jeu, une alerte invite à recharger.

- `index.html` (environ 2000 lignes) : interface, règles du Papayoo (objet `PY`), scène 3D, réseau, avatars, social. Le script principal est un module.
- `js/fx.js` : matériaux toon, `roundedBox`, halos, poussière, confettis.
- `js/avatar.js` : personnages articulés, visage dessiné sur canvas, options de look, expressions, animations.
- `js/editor.js` : éditeur de personnage avec aperçu 3D.
- `js/sfx.js` : bruitages et musique générés en Web Audio (aucun fichier audio).
- `js/secret.js` : clés ECDH par navigateur, mains chiffrées en AES-GCM.
- `js/voice.js` : chat vocal de proximité (flux WebRTC, `PannerNode` HRTF).
- `js/toys.js` : boules de papier et coussins, physique rejouée à l'identique chez chacun. Les meubles sur lesquels on monte (canapé, pouf, caisses) sont des boîtes dans `PLATFORMS` (index.html), partagées avec cette physique.
- `js/fps.js` : mode bataille de fléchettes (six armes, bonus au sol, tremplins, touches, élimination, réapparition, score, robots et leur niveau, manches et équipes, tableau des scores sur Tab, écran de fin, spectateur, direction des tirs reçus). Chargé par `import()` seulement dans un salon `#fps-CODE`, branché sur `index.html` par quelques appels `fps.*` (constante `FPS`).
- `js/world.js` : les collisions de tout le monde (joueur, avatars, robots) : boîtes solides sur lesquelles on monte, contre lesquelles on bute ou sous lesquelles on passe accroupi, disques, limites. Le salon y décrit sa table et `PLATFORMS`, la carte FPS ses murs. Construit aussi la grille de déplacement des robots (A*).
- `js/fpsmap.js` : la carte « le Fort » (hall, deux ailes, étage, escaliers, tunnels), et `makeKit()`, les outils communs à toutes les cartes (blocs, murs à ouvertures, caisses, escaliers, sol). Une carte n'est chargée qu'en mode FPS : elle remplace le salon dans la scène et fournit ses boîtes (et ses disques), ses points d'apparition, l'emplacement des bonus et ses tremplins (`pads` : `[x, y, z, poussée x, poussée haut, poussée z]`). En équipes, les Rouges apparaissent du côté x < 0, les Bleus du côté x > 0.
- `js/fpsstation.js` : la carte « la Station » (hangar avec une navette, salle du réacteur avec balcons et passerelles, labos sous un pont), sur le même modèle.
- `js/fpschambre.js` : la carte « la Chambre » (chambre d'enfant géante : lit à escalader et sous lequel ramper, bureau, château de cubes, coffre à jouets). Les cartes sont listées dans `MAPS` (index.html) : y ajouter une entrée (et le fichier dans l'import map) suffit pour qu'elle soit proposée à l'accueil.
- `js/fpsbureaux.js` : la carte « les Bureaux » (immeuble de bureaux la nuit : hall sur deux étages avec mezzanine et ascenseur, couloir entre quatre bureaux sous un open space, salle de conférence avec bancs, pupitre et cabine technique, cafétéria sous un toit-terrasse). Elle apporte les plateformes mobiles (`movers` : une boîte marquée `moving`, les objets qui la suivent, sa hauteur en fonction du temps) : chacun calcule la position de l'ascenseur sur `Date.now()`, sans réseau, et `fps.js` emporte qui est dessus. La grille des robots ignore les boîtes `moving` : les robots prennent l'escalier.
- `js/fpslabo.js` : la carte « le Labo », dessinée d'après le plan des joueurs : un couloir central fermé par des portes coulissantes automatiques, un conduit de ventilation bas posé dessus (on le traverse accroupi), les bureaux des Rouges avec un escalier vers les hauteurs, les labos surélevés des Bleus, et en bas le quai de chargement, la cour intérieure et la salle des générateurs. Elle apporte les portes automatiques (`doors` : un point, un rayon, des panneaux qui coulissent) : chacun les ouvre dès qu'il voit quelqu'un à moins du rayon, joueur ou robot, sans réseau.
- `js/fpsforts.js` : la carte « les Deux Forts », faite pour la capture du drapeau : une vallée de 120 × 70 m, un fort à chaque bout (trois portes de face, deux de côté, chemin de ronde à créneaux, drapeau au fond de la cour), des ruines au centre avec une plateforme, une voie nord (caisses, passerelle) et une voie sud (tranchées). Chaque carte donne `flags` (l'emplacement des drapeaux, Rouges du côté x < 0 puis Bleus, posés au sol et accessibles aux robots) ; `fps.js` y dessine le drapeau et son socle, seulement en capture du drapeau. Une carte peut aussi donner `far` (la portée de la caméra, 60 m sinon) ; elle pose son propre brouillard.
- `js/fpsskyridge.js` : la carte « Skyridge », dessinée d'après le plan des joueurs pour la capture du drapeau : une île flottante coupée du nord au sud par un ravin (un ruisseau au fond, 2,4 m sous l'île), une base contre chaque bord avec le drapeau dedans, le point d'apparition dans le coin sud. Trois passages : en haut au nord (une tour de guet de chaque côté, une passerelle entre les deux), le pont central avec sa plateforme sur un pilier, en bas au sud (escaliers dans le ravin, tremplins pour en ressortir). Le plan d'origine met les Bleus à gauche : la carte est en miroir pour garder les Rouges du côté x < 0.
- `js/controls.js` : contrôles réglables (fenêtre « Contrôles », ordinateur seulement) : touche de chaque action, sensibilité de la souris, axe inversé, gardés dans `localStorage`. Les touches sont des codes physiques (`KeyW` = Z en AZERTY), affichées avec la lettre du clavier du joueur. Dans `index.html`, passer par `actionFor(e.code)`, `key(id)` et `kbd(id)` au lieu de codes en dur.
- Interface sur ordinateur (clavier et souris) : l'écran ne garde que le statut, un bouton « ☰ Menu » et les scores. Échap ouvre le menu (`openMenu()`, dialog `#menu`) : Reprendre, la gestion de partie en bataille (`fps.fillMenu()` : robots et leur niveau, réglage de la manche, changement d'équipe, spectateur), les réglages (inviter, perso, règles du Papayoo, contrôles, sons, musique) et le retour à l'accueil. Quand la souris est capturée, le navigateur la libère sur Échap sans transmettre la touche : le menu s'ouvre sur `pointerlockchange`. Pour libérer la souris soi-même (une fenêtre qui s'ouvre), passer par `releaseMouse()` (`ctx.releaseMouse()` dans `fps.js`), sinon le menu s'ouvre aussi. Les expressions sont sur une roue (`openWheel()`, action `emotes`, U par défaut, à maintenir) : on vise avec la souris, capturée ou non, et on lâche la touche ou on clique. Sur téléphone (`coarse`), rien ne change : boutons en haut, expressions à droite, boutons de partie sous les scores.

### Réseau

- L'adresse de base, sans code, ouvre l'accueil (`#hub`, constante `HUB`) : une carte par jeu (Salon Papayoo, Bataille de fléchettes avec le choix de la carte, gardé dans `localStorage`). Il ne se connecte à aucun salon : choisir un jeu met un code neuf dans l'URL et recharge la page. Depuis l'écran d'entrée d'un salon, « ← Accueil » y ramène. L'accueil a aussi un champ « Rejoindre une partie » (`joinTarget()`) qui accepte un lien d'invitation ou un code. Le code affiché aux joueurs (`shareCode()`) porte une lettre par carte de bataille (`tag` dans `MAPS` : F, S, C, B, L, D, R, par exemple `F-K7MPQ`), et rien pour un salon Papayoo : le code seul suffit pour trouver le bon jeu.
- Une room = un code dans l'URL : `#K7MPQ` pour les jeux tranquilles, `#fps-K7MPQ` pour la bataille de fléchettes dans le Fort, `#fps-station-K7MPQ` dans la Station, `#fps-chambre-K7MPQ` dans la Chambre, `#fps-bureaux-K7MPQ` dans les Bureaux, `#fps-labo-K7MPQ` dans le Labo, `#fps-forts-K7MPQ` dans les Deux Forts, `#fps-skyridge-K7MPQ` sur Skyridge (un salon Trystero distinct par mode et par carte). Hors claude.ai, `p2pRoom()` construit une petite interface `room` (`emit`, `on`, `presence`, `onPeers`, `setStream`, `onStream`) au-dessus de Trystero (signalisation par relais Nostr publics, puis WebRTC direct). Le code sait encore utiliser la capacité `room` de claude.ai, mais la version Artifact est abandonnée.
- Le joueur qui lance la partie est l'hôte : il applique les règles, fait jouer les robots et diffuse l'état sur le topic `state`. Les joueurs envoient leurs coups sur le topic `act`.
- Mains cachées : l'hôte diffuse une vue publique (les cartes des autres valent `'?'`, `passSel` vaut `1`) avec la main de chaque joueur scellée pour lui (`sec`, `hpk`). Si l'hôte part, le suivant lance `startRecovery()` : il redemande les mains (act `hand`) et redistribue celles des robots et des absents à partir de `G.played`.
- La présence porte la position (`a` : x, z, cap, inclinaison, siège, accroupi, hauteur des pieds), le pseudo, la couleur, le look (`l`), la clé publique (`pk`), et les actions sociales en `[compteur, ...]` : expression `x`, message `say`, boule `pb`, coussin `cu`. Le compteur évite de rejouer une action à l'arrivée d'un joueur.
- Bataille : chaque tir part sur le topic `dart` (origine, impact, cible, arme `w`, tir à la tête `hs`). Les armes sont dans `WEAPONS` (js/fps.js) : le pistolet retire 2 points, le fusil d'assaut et la mitraillette 1, le sniper 4, sur 6 (trois cœurs), le double à la tête. Les quatre premières de `SLOTS` sont toujours en main (touches 1 à 4) ; le lance-roquettes et le railgun (`heavy`, touche 5) se ramassent au sol, ont quelques coups sans recharge et se perdent à l'élimination. Rechargement express : rappuyer sur R (sur téléphone, toucher 🎯) pendant que la jauge passe dans la zone jaune (`QUICK`, de 40 à 60 % du rechargement) le termine aussitôt ; un seul essai par rechargement, et un raté rallonge le rechargement de 30 % d'un rechargement normal (`QUICK_MISS`). En bataille, le sprint va à 8,2 m/s (6,5 dans le salon, 4,2 en marchant). La roquette vole : à l'arrivée, le tireur calcule les dégâts de zone (moitié pour soi) et les envoie sur `boom` (`[cible, dégâts]`). Les bonus (soin, armure, armes lourdes) sont décrits par la carte (`pickups`) ; qui en prend un le dit sur `pick` et chacun compte le retour sur sa propre horloge (un joueur qui arrive les voit tous présents). L'armure (2 boucliers) prend les dégâts avant la vie. On touche un cylindre jusqu'au cou ou une boule sur la tête de l'avatar (`fighters()`, `ballHit`). Le tireur décide s'il touche, la cible applique les dégâts et annonce son élimination sur `ko`. Chacun publie sa vie et son score en présence (`fp` : vie, éliminations, défaites, protection, arme en main), et l'inclinaison du regard (`a[3]`) oriente l'arme de son avatar. Les robots tournent dans le navigateur du joueur qui les ajoute, qui les diffuse sur `bots` ; ils disparaissent s'il part. Leur niveau (faciles, normaux, coriaces) est un réglage de ce joueur, gardé dans `localStorage`.
- Manches : qui lance une manche (fenêtre « Manche » ou « Revanche ») l'envoie sur `match` (`id`, mode `ffa` ou `teams`, fin `free`, `score` ou `time`, objectif, heure de départ `Date.now()`, et en équipes la répartition `t`). La manche la plus récente gagne, et chacun la republie en présence (`fm`) pour ceux qui arrivent : un joueur qui entre pendant une manche en cours commence en spectateur. Chacun détecte la fin (score ou chrono) et la signale sur `mend`. `fp` porte aussi l'équipe (`fp[5]`, 0 rouge, 1 bleu, -1 sans) et le mode spectateur (`fp[6]`). En équipes, pas de tirs entre coéquipiers, et l'avatar porte le maillot de son équipe.
- Capture du drapeau (mode `ctf`, proposé sur toutes les cartes) : c'est une manche en équipes où le score est le nombre de captures (`caps`, objectif 1, 3 ou 5). Chaque drapeau est à sa base, porté ou tombé (il rentre seul après 20 s, `FLAG_BACK`). Qui le change (soi ou ses robots, en le touchant à moins de `FLAG_REACH`) l'annonce sur `flag` avec un numéro de version plus grand : la plus grande version gagne, et à égalité celle de l'identifiant le plus grand, pour que tous tombent d'accord. On capture en ramenant le drapeau adverse à sa base pendant que le sien y est (`cap`, avec un id unique, compté une seule fois). Un porteur éliminé, passé spectateur ou qui change d'équipe lâche le drapeau ; un porteur parti, il rentre à sa base au bout de 3 s. La présence porte l'état complet (`fc`) pour ceux qui arrivent. Les robots attaquent (deux sur trois), défendent, rapportent le drapeau, vont chercher le leur ; celui qui porte le drapeau ne s'arrête pas pour se battre.

## Tester

Ni Node ni Python sur ce poste : `tools/serve.ps1` sert le dossier sur http://localhost:8642.

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1
```

Le lancer en tâche de fond, ouvrir `http://localhost:8642/#CODE` dans le navigateur intégré, et un onglet par joueur avec le même code. La clé de joueur est stockée dans `sessionStorage`, donc chaque onglet est un joueur distinct.

Pièges connus :

- Un onglet ou un panneau masqué ne fait plus de `requestAnimationFrame` : la scène, les déplacements et la physique s'arrêtent. Afficher le panneau (`show_pane preview`) et mettre au premier plan l'onglet à piloter. Si la fenêtre de Claude n'est pas visible, la page tombe à quelques images par seconde : pour tester des sauts ou des chutes, exposer `updateMe` en debug et l'appeler en boucle avec `dt = 1/60`.
- Les déplacements simulés par `KeyboardEvent` sont imprécis. Pour placer un joueur, exposer temporairement l'état (`window.__dbg... // DEBUG`) et le retirer avant de committer (`grep -c __dbg index.html` doit donner 0).
- Le premier script lancé juste après un rechargement est souvent coupé : attendre la fin du chargement avant d'entrer dans le salon.
- Le mode mobile du navigateur intégré (`resize_window` en preset `mobile`) émule un téléphone Android tactile (`pointer: coarse`).
- Le vocal ne se teste pas ici (pas de vrai micro) : à vérifier entre amis.

Validé en vrai entre amis : vocal et interactions sur téléphone, mains cachées (on ne voit que le dos des cartes des autres, même en faisant le tour de la table).

## Pistes en attente

### Bataille de fléchettes : prochains ajouts (demandés)

1. À valider en vrai entre amis : équipes, manches, revanche et spectateur à plusieurs (testés à deux onglets seulement), capture du drapeau sur chaque carte, bruits spatialisés au casque.

Décidé : pas de mode « poser la bombe », trop lent pour une bataille où l'on réapparaît vite. Deux modes de jeu seulement : le match à mort (chacun pour soi ou en équipes) et la capture du drapeau. Toute nouvelle carte doit prévoir les deux, donc donner ses `flags`.

### Autres pistes
- Valider en vrai la reprise quand l'hôte quitte en pleine manche (`startRecovery()`) : chacun doit retrouver sa main sans voir celles des autres.
- Serveur relais TURN si des joueurs (4G, réseaux d'entreprise) ne se connectent pas.
- Limite assumée : le navigateur de l'hôte connaît toutes les mains.
