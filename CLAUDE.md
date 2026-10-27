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

- `index.html` (environ 2000 lignes) : interface, règles du Papayoo (objet `PY`), scène 3D, réseau, avatars, social. Le script principal est un module.
- `js/fx.js` : matériaux toon, `roundedBox`, halos, poussière, confettis.
- `js/avatar.js` : personnages articulés, visage dessiné sur canvas, options de look, expressions, animations.
- `js/editor.js` : éditeur de personnage avec aperçu 3D.
- `js/sfx.js` : bruitages et musique générés en Web Audio (aucun fichier audio).
- `js/secret.js` : clés ECDH par navigateur, mains chiffrées en AES-GCM.
- `js/voice.js` : chat vocal de proximité (flux WebRTC, `PannerNode` HRTF).
- `js/toys.js` : boules de papier et coussins, physique rejouée à l'identique chez chacun. Les meubles sur lesquels on monte (canapé, pouf, caisses) sont des boîtes dans `PLATFORMS` (index.html), partagées avec cette physique.
- `js/fps.js` : mode bataille de fléchettes (six armes, bonus au sol, touches, élimination, réapparition, score, robots). Chargé par `import()` seulement dans un salon `#fps-CODE`, branché sur `index.html` par quelques appels `fps.*` (constante `FPS`).
- `js/world.js` : les collisions de tout le monde (joueur, avatars, robots) : boîtes solides sur lesquelles on monte, contre lesquelles on bute ou sous lesquelles on passe accroupi, disques, limites. Le salon y décrit sa table et `PLATFORMS`, la carte FPS ses murs. Construit aussi la grille de déplacement des robots (A*).
- `js/fpsmap.js` : la carte « le Fort » (hall, deux ailes, étage, escaliers, tunnels), et `makeKit()`, les outils communs à toutes les cartes (blocs, murs à ouvertures, caisses, escaliers, sol). Une carte n'est chargée qu'en mode FPS : elle remplace le salon dans la scène et fournit ses boîtes (et ses disques), ses points d'apparition et l'emplacement des bonus.
- `js/fpsstation.js` : la carte « la Station » (hangar avec une navette, salle du réacteur avec balcons et passerelles, labos sous un pont), sur le même modèle.
- `js/fpschambre.js` : la carte « la Chambre » (chambre d'enfant géante : lit à escalader et sous lequel ramper, bureau, château de cubes, coffre à jouets). Les cartes sont listées dans `MAPS` (index.html) : y ajouter une entrée suffit pour qu'elle soit proposée à l'accueil.
- `js/controls.js` : contrôles réglables (fenêtre « Contrôles », ordinateur seulement) : touche de chaque action, sensibilité de la souris, axe inversé, gardés dans `localStorage`. Les touches sont des codes physiques (`KeyW` = Z en AZERTY), affichées avec la lettre du clavier du joueur. Dans `index.html`, passer par `actionFor(e.code)`, `key(id)` et `kbd(id)` au lieu de codes en dur.

### Réseau

- Une room = un code dans l'URL : `#K7MPQ` pour les jeux tranquilles, `#fps-K7MPQ` pour la bataille de fléchettes dans le Fort, `#fps-station-K7MPQ` dans la Station, `#fps-chambre-K7MPQ` dans la Chambre (un salon Trystero distinct par mode et par carte). Hors claude.ai, `p2pRoom()` construit une petite interface `room` (`emit`, `on`, `presence`, `onPeers`, `setStream`, `onStream`) au-dessus de Trystero (signalisation par relais Nostr publics, puis WebRTC direct). Le code sait encore utiliser la capacité `room` de claude.ai, mais la version Artifact est abandonnée.
- Le joueur qui lance la partie est l'hôte : il applique les règles, fait jouer les robots et diffuse l'état sur le topic `state`. Les joueurs envoient leurs coups sur le topic `act`.
- Mains cachées : l'hôte diffuse une vue publique (les cartes des autres valent `'?'`, `passSel` vaut `1`) avec la main de chaque joueur scellée pour lui (`sec`, `hpk`). Si l'hôte part, le suivant lance `startRecovery()` : il redemande les mains (act `hand`) et redistribue celles des robots et des absents à partir de `G.played`.
- La présence porte la position (`a` : x, z, cap, inclinaison, siège, accroupi, hauteur des pieds), le pseudo, la couleur, le look (`l`), la clé publique (`pk`), et les actions sociales en `[compteur, ...]` : expression `x`, message `say`, boule `pb`, coussin `cu`. Le compteur évite de rejouer une action à l'arrivée d'un joueur.
- Bataille : chaque tir part sur le topic `dart` (origine, impact, cible, arme `w`, tir à la tête `hs`). Les armes sont dans `WEAPONS` (js/fps.js) : le pistolet retire 2 points, le fusil d'assaut et la mitraillette 1, le sniper 4, sur 6 (trois cœurs), le double à la tête. Les quatre premières de `SLOTS` sont toujours en main (touches 1 à 4) ; le lance-roquettes et le railgun (`heavy`, touche 5) se ramassent au sol, ont quelques coups sans recharge et se perdent à l'élimination. La roquette vole : à l'arrivée, le tireur calcule les dégâts de zone (moitié pour soi) et les envoie sur `boom` (`[cible, dégâts]`). Les bonus (soin, armure, armes lourdes) sont décrits par la carte (`pickups`) ; qui en prend un le dit sur `pick` et chacun compte le retour sur sa propre horloge (un joueur qui arrive les voit tous présents). L'armure (2 boucliers) prend les dégâts avant la vie. On touche un cylindre jusqu'au cou ou une boule sur la tête de l'avatar (`fighters()`, `ballHit`). Le tireur décide s'il touche, la cible applique les dégâts et annonce son élimination sur `ko`. Chacun publie sa vie et son score en présence (`fp` : vie, éliminations, défaites, protection, arme en main), et l'inclinaison du regard (`a[3]`) oriente l'arme de son avatar. Les robots tournent dans le navigateur du joueur qui les ajoute, qui les diffuse sur `bots` ; ils disparaissent s'il part.

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

1. Modes de jeu : capture du drapeau, poser la bombe. Ils supposent des équipes (aujourd'hui c'est chacun pour soi).

Idées en plus, à discuter :

- Équipes (rouge et bleu) avec couleur sur l'avatar, nécessaires aux modes ci-dessus.
- Manches chronométrées ou à score cible, avec un écran de fin et une revanche.
- Tableau des scores complet en maintenant Tab.
- Indicateur de la direction d'où vient un tir reçu, et bruits de tirs spatialisés.
- Niveau des robots réglable (facile, normal, difficile).
- Tremplins et passages en hauteur sur les cartes.
- Mode spectateur pour qui arrive en cours de partie.

### Autres pistes
- Valider en vrai la reprise quand l'hôte quitte en pleine manche (`startRecovery()`) : chacun doit retrouver sa main sans voir celles des autres.
- Serveur relais TURN si des joueurs (4G, réseaux d'entreprise) ne se connectent pas.
- Limite assumée : le navigateur de l'hôte connaît toutes les mains.
