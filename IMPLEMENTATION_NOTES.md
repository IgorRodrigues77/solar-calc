# Solar Energie — révision technique et produit

Cette version a été auditée et modifiée pour renforcer le MVP B2B destiné aux installateurs photovoltaïques.

## Principales modifications

- Passage de l'API PVGIS de 5.2 à 5.3.
- Recalcul cohérent de l'autoconsommation et du surplus.
- Ajout des KPI : énergie autoconsommée, surplus et taux d'autoconsommation.
- Import de facture plus strict : PDF uniquement, aucune consommation inventée, réponse structurée Gemini.
- Migration du parsing Gemini vers `gemini-3.7-flash` avec sortie JSON structurée et clé via header serveur.
- Suppression des formulations trop fortes comme « certifié » et « officiel » lorsque non justifiées.
- PDF réorganisé en 5 pages avec hypothèses, limites, comparatif et projection graphique.
- Détection PNG/JPG du logo pour le white-label.
- Metadata Next.js corrigées : suppression de « Create Next App ».
- Historique local des études ajouté au dashboard afin de ne pas exposer publiquement les leads Supabase par une route GET non authentifiée.
- Formulaire Pro enrichi avec outil actuel et volume d'études mensuel, sans fausse promesse de rappel automatique.
- Variables Supabase déplacées vers l'environnement et ajout de `.env.example`.
- `.env.local` volontairement exclu de cette archive.

## Variables d'environnement à configurer sur Vercel

- `GEMINI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Ne jamais commit de vraie clé API dans Git.

## Validation réalisée

- Vérification syntaxique TypeScript/TSX : OK sur 9 fichiers.
- Vérification statique des formulations et secrets : OK.
- Vérification mathématique de quelques scénarios de référence : OK.
- Build/lint complet non exécutés dans cet environnement car l'installation de dépendances du projet fourni était incomplète et les tentatives d'installation ont expiré.

## Limites restantes avant une vraie commercialisation

1. Ajouter une authentification Pro réelle avant de rendre le dashboard multi-utilisateur.
2. Mettre en place une politique de confidentialité / mentions légales adaptée à l'entité qui exploite le service.
3. Tester le parsing sur un jeu réel de factures EDF/Engie/TotalEnergies et différents formats de PDF.
4. Valider avec des installateurs les hypothèses économiques et techniques avant de présenter les résultats comme outil commercial de référence.
5. Remplacer progressivement les hypothèses tarifaires fixes par des paramètres configurables et/ou des sources vérifiées.


## 2026-09-01 — Gemini PDF extraction fix

Fixed `app/api/parse-bill/route.ts` after Gemini returned HTTP 400. The route was using the `responseFormat` structure from the newer Interactions API while calling the legacy `generateContent` endpoint. For `generateContent`, it now uses `generationConfig.responseMimeType` and `generationConfig.responseSchema`, with `inlineData`/`mimeType` for the PDF. The API key is sent through `x-goog-api-key` rather than duplicated in the URL.

The attached test document `etude-photovoltaique-Antonio_Perea_Garcia.pdf` is a generated photovoltaic feasibility study, not an electricity bill; the HTTP 400 occurs before Gemini processes the document, so the document type is not the cause of the reported error.
