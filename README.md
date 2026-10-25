# PlayRoom

Jeu de cartes Papayoo dans un salon en 3D, joué dans le navigateur. Nom de travail : PlayRoom.

Le point de départ est un prototype en un seul fichier ([index.html](index.html)), à améliorer au fil des itérations.

## Jouer en ligne

Le jeu est publié en Artifact claude.ai : https://claude.ai/artifact/YVH5N3YyUJcum1d3jZ8xqv

Le multijoueur passe par la capacité `room` du runtime Artifact (événements `state` et `act` ouverts au niveau Contributeur), et le pseudo est prérempli via `user`. Pour que des amis jouent, il faut les inviter depuis le menu Partager avec un accès qui permet d'interagir ; un simple lecteur peut regarder mais pas jouer. Ouvert hors de claude.ai, le jeu passe en solo contre des robots.

Pour republier après une modification, demander à Claude de republier `index.html` sur la même URL.

## Stack

HTML, CSS et JavaScript sans build. Rendu 3D avec [three.js](https://threejs.org/) 0.149 chargé depuis jsDelivr, polices Baloo 2 et Nunito via Google Fonts.

## Lancer

Ouvrir `index.html` dans un navigateur, ou servir le dossier en local :

```bash
python -m http.server 8000
```

puis aller sur http://localhost:8000.
