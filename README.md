# Portfolio — Jules Teyssier

Site statique, une page par langue, avec une chambre en 3D qui évolue au scroll. Aucune étape de build.

## Lancer en local

```bash
python -m http.server 5500
```

Puis ouvrir http://localhost:5500.

## Structure

- `index.html` : version française. `en/index.html` : version anglaise, même structure et mêmes id.
  **Toute modification de contenu est à faire dans les deux fichiers.**
- `css/style.css` : mise en page, couleurs (crème, vert bouteille, sauge), mode nuit, version téléphone.
- `js/main.js` : chambre 3D (three.js), animation au scroll (GSAP ScrollTrigger + Lenis), fiches projets,
  mode nuit. Si WebGL n'est pas disponible, une image fixe remplace la 3D (`?sans3d` pour tester).
- `models/` : la chambre (`chambre.glb`, compressée Draco) et ses ombres cuites (`chambre-ao.webp`).
- `vendor/` : three.js 0.169, GSAP 3.12.5, Lenis 1.1.13, décodeur Draco et polices (Familjen Grotesk,
  Atkinson Hyperlegible Next, licence SIL OFL), tous hébergés sur le site.
  **Aucune requête vers un service tiers** : l'IP des visiteurs n'est transmise à personne (RGPD).
- `docs/` : comptes rendus en PDF liés depuis les fiches projets. Le rapport AD est une version publique
  (scores, organigramme et noms retirés).
- `img/` : images des fiches projets, aperçus de partage (`og.png`, `og-en.png`), icônes.
- `cv-jules-teyssier.pdf`, `cv-jules-teyssier-en.pdf` : CV **sans téléphone**.

## Sécurité

Content Security Policy stricte en `<meta>` : tout vient du site. Le seul script dans la page (l'import map)
est autorisé par son empreinte SHA-256. **Si l'import map change, recalculer l'empreinte** (fins de ligne
normalisées en LF) dans les deux pages.

## En ligne

Site publié sur **https://teyssierjules.github.io/** (GitHub Pages, branche `main`, racine).
