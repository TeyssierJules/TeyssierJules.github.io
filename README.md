# Portfolio — Jules Teyssier

Site statique (HTML, CSS, JS), une seule page par langue. Aucune étape de build.

## Lancer en local

```bash
python -m http.server 5500
```

Puis ouvrir http://localhost:5500.

## Structure

- `index.html` : version française (9 sections + 8 modales de projet en `<dialog>`).
- `en/index.html` : version anglaise. Même structure, mêmes classes, mêmes id de modales.
  **Toute modification de contenu est à faire dans les deux fichiers.**
- `css/style.css` : couleurs en custom properties sur `:root` (crème, vert bouteille, sauge).
- `js/main.js` : bandeau réactif au scroll, menu mobile, modales, compétences repliables, parallaxe.
- `fonts/` + `css/fonts.css` : Oswald et Merriweather hébergées sur le site (licence SIL OFL,
  fichiers `OFL-*.txt`). Aucune bibliothèque JavaScript externe.
  **Aucune requête vers un service tiers** (Google, CDN) : l'IP des visiteurs n'est transmise
  à personne (RGPD).
- `img/og.png`, `img/og-en.png` : images d'aperçu quand le lien est partagé (LinkedIn, mail…).
- `cv/` : `cv-jules-teyssier.pdf` (FR) et `cv-jules-teyssier-en.pdf` (EN), versions **sans téléphone**,
  copiées depuis `../CV/export/*-sans-telephone.pdf`. Recopier après chaque mise à jour du CV.

## En ligne

Site publié sur **https://teyssierjules.github.io/** (GitHub Pages, dépôt public
`TeyssierJules/TeyssierJules.github.io`, branche `main`). Les URL absolues (canonical,
hreflang, og:url, og:image) pointent vers cette adresse : à changer si un nom de domaine
est ajouté plus tard.

Mettre à jour : copier le contenu de ce dossier `site/` dans une copie du dépôt, puis
`git add -A`, `git commit` et `git push` ; GitHub republie en 1 à 2 minutes.
Les commits utilisent l'email anonyme GitHub (`…@users.noreply.github.com`).

## Ajouter des illustrations à un projet

Dans la modale du projet, après la section `m-ret`, ajouter une section `m-media`
(elle prend toute la largeur, en bas de la modale) :

```html
<section class="m-media"><h3><span>+</span>En images</h3>
  <div class="m-media__grid">
    <figure>
      <img src="img/projets/ad-gpo.png" alt="Stratégie de mots de passe appliquée par PSO" loading="lazy">
      <figcaption>PSO : 15 caractères minimum pour les comptes à privilèges.</figcaption>
    </figure>
    <pre class="m-code"><code>// Extrait de code
</code></pre>
  </div>
  <p class="m-doc"><a href="docs/cr-stormshield.pdf">Télécharger le compte rendu (PDF)</a></p>
</section>
```

Dans `en/index.html`, les chemins commencent par `../` (`../img/projets/…`).

Avant de publier une capture : flouter noms de clients, IP publiques, noms d'utilisateurs réels,
et **ne jamais montrer le score PingCastle chiffré**.

## Compétences « 3e année »

Un commentaire dans `index.html` (section Compétences) indique où les ajouter. La grille
s'adapte au nombre de colonnes.

## Règles de style (pour garder un rendu « fait main »)

- **Oswald majuscules** : seulement les grands titres, les titres de cartes et le bouton principal.
- **Merriweather** : tout le reste (navigation, méta, technos, liens, libellés), en minuscules,
  sans espacement de lettres.
- **Pas de séparateurs** « · » ni de « Titre — sous-titre » : les méta et technos sont des
  `<span>` / `<li>` séparés par un espace CSS ; un sous-titre va dans `<span class="title-sub">`.
- Pas de numéros de section, pas de flèches décoratives, pas d'ombre décalée.

## Échelle de texte

Merriweather utilise 4 tailles, définies dans `:root` : `--fs-s` (14 px, méta et légendes),
`--fs-m` (16 px, texte courant), `--fs-l` (16–18 px, introductions), `--fs-xl` (17–21 px, accroche).
Ne pas ajouter de taille en pixels : réutiliser une de ces variables.

## Animations

Volontairement peu nombreuses, inspirées de Tripletta :

- **Scroll natif du navigateur** : le défilement « fluide » (Lenis) a été retiré, il chargeait
  trop chaque image sur un écran 120 Hz (−38 % de travail pendant le scroll sans lui).
- **Bandeau défilant** : le moment fort, il suit la vitesse et le sens du scroll.
- **Sticker** de l'accueil qui tourne sur lui-même, à vitesse constante (le faire accélérer
  avec le scroll forçait le navigateur à recalculer les styles en continu).
- **Compétences** : ouverture et fermeture en douceur.
- **Bouton pause** (bout du bandeau) : arrête bandeau et sticker, choix mémorisé (WCAG 2.2.2).
- **Parallaxe** (écrans > 900 px) : uniquement le filigrane de l'accueil (sur la grille des projets
  perso, elle décalait les lignes de base). Codée en JavaScript simple dans `js/main.js`.
- Survols discrets : cartes qui passent en sauge, liens dont le soulignement s'épaissit.

Le réglage système « réduire les animations » est **ignoré** pour l'instant (comme Tripletta).
Pour le respecter à nouveau : `RESPECT_REDUCED_MOTION = true` en haut de `js/main.js`
(cela coupe la parallaxe, le bandeau et le sticker pour ces visiteurs).
