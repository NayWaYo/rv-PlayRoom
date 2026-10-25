# PlayRoom

Jeu de cartes Papayoo dans un salon en 3D, joué dans le navigateur à plusieurs. Nom de travail : PlayRoom.

Tout le jeu tient dans un seul fichier, [index.html](index.html).

## Jouer entre amis

**https://naywayo.github.io/rv-PlayRoom/** (hébergé par GitHub Pages, mis à jour à chaque push sur `main`)

Ouvrir la page : un code de salon est créé et ajouté à l'adresse (par exemple `…/#K7MPQ`). Le bouton « Copier le lien d'invitation » copie cette adresse ; les amis qui l'ouvrent arrivent dans le même salon. Aucun compte n'est nécessaire.

Il faut au moins 3 joueurs assis ; des robots peuvent compléter la table.

## Comment marche le multijoueur

Il n'y a pas de serveur de jeu. Les navigateurs se trouvent grâce à des relais Nostr publics (via [Trystero](https://github.com/dmotz/trystero) 0.26), puis échangent directement en WebRTC. Le joueur qui lance la partie fait office d'hôte : il valide chaque coup et diffuse l'état ; s'il part, un autre joueur reprend la main.

Limites connues :

- Certains réseaux (4G, réseaux d'entreprise) bloquent la connexion directe. Il faudrait alors un serveur TURN.
- L'état diffusé contient toutes les mains : un joueur qui ouvre les outils du navigateur peut voir les cartes des autres.

La page sait aussi tourner en Artifact claude.ai : elle utilise alors le salon temps réel de claude.ai au lieu de WebRTC. La version publiée (https://claude.ai/artifact/YVH5N3YyUJcum1d3jZ8xqv) est l'ancien prototype ; la republier demande d'envoyer aussi les fichiers de `js/`.

## Stack

HTML, CSS et JavaScript sans build, en modules ES (import map). Rendu 3D avec [three.js](https://threejs.org/) 0.186 (ombrage toon, contours via `OutlineEffect`, ombres de la lampe), réseau avec Trystero 0.26, tous deux chargés depuis jsDelivr. Polices Baloo 2 et Nunito via Google Fonts.

- [index.html](index.html) : interface, règles du Papayoo, scène, avatars et réseau.
- [js/fx.js](js/fx.js) : matériaux cartoon, halos lumineux, poussière, confettis.
- [js/sfx.js](js/sfx.js) : bruitages et musique lounge générés avec la Web Audio API (aucun fichier audio).

## Lancer en local

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1
```

puis ouvrir http://localhost:8642. Pour tester à plusieurs, ouvrir la même adresse (avec le même `#code`) dans plusieurs onglets.
