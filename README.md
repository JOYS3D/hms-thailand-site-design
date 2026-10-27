# HMS Thailand — nouveau site (maquette de design)

Maquette du nouveau site de **HMS Thailand**, faite par **Mabido Media** le 27/10/2026. C'est un **design**, pas le site en ligne : rien n'est publié.

## Le voir
1. Sur GitHub : bouton vert **Code** → **Download ZIP**, puis décompresser.
2. Double-cliquer sur **`index.html`** : le site s'ouvre dans le navigateur (Chrome conseillé).
3. **Cliquer ou scroller une fois** : la visite de l'hôtel se joue toute seule, chapitre par chapitre. Le bouton en bas permet d'entrer, de continuer ou de passer une scène.

Il faut Internet pour les polices ; sans Internet, le site s'affiche avec des polices de secours.

## Ce que montre le film
1. L'arrivée au resort : **Hotel websites**.
2. La réception, puis la tablette : **Hotel software**, dessiné trait par trait.
3. L'ascenseur, étage par étage : **Revenue management**.
4. La vue d'en haut : **Sales and marketing assessment**.
5. La nuit : les villas s'allument, puis 95 · 5 · 2010.

Ensuite viennent :
- les résultats en cartes animées ;
- les services en détail (« What we do for your hotel ») ;
- les témoignages, mot pour mot ;
- les clients, le blog et le contact.

## À savoir
- **Le texte vient du site actuel de HMS** : services, chiffres, résultats, témoignages, lus le 23/10/2026.
- **Lisible par Google et les IA** : tout le texte est écrit dans la page, avec une fiche d'identité pour les machines (JSON-LD).
- **Images** :
  - le resort, le hall, l'ascenseur et la nuit sont **générés par IA**, et c'est indiqué à l'écran ;
  - les photos de HMS animées portent la mention « Motion added with AI » ;
  - le tableau de bord du logiciel est une illustration, pas de vraies données.
- Les noms et photos des hôtels clients ne se montrent en public qu'avec l'accord de HMS et des hôtels.

## Fichiers
- `index.html`, `style.css`, `app.js` : le site.
- `assets/` : images, vidéos, et les suites d'images du film (`seq/`).
- `tests/capture.cjs` : 43 contrôles automatiques. Il faut Node et Playwright : `npm i playwright`, puis `node tests/capture.cjs captures/`.
