# World Explorer (Phase 1)

An interactive world map. Click any country to see its window with Overview, Rank, News, Geography and History tabs.

## Run it on your computer

1. Install Node.js (version 20 or newer) from nodejs.org.
2. Open a terminal in this folder and run `npm install` (downloads the map libraries, once).
3. Run `npm run dev`, then open the address it prints (usually http://localhost:5173).

To make the files you upload to a web host, run `npm run build`. The finished site is in the `dist` folder.

## What works now

- All 236 countries and territories on a zoomable map, with the name on hover
- Country names shown on the map by default (small countries appear as you zoom in; the Names button hides them)
- City names appear as you zoom in (bigger cities first), with capitals in bold and a ring marker
- Real size mode (the Real size button): click countries to add them, then hold and drag them anywhere to compare true sizes. A dragged country keeps its real size and shape; it only looks bigger or smaller because the map stretches things near the poles. Includes ready-made examples (Greenland on Australia, Russia on Brazil, UK on Iraq)
- Search by country or capital
- Views: Map, Terrain, Satellite (needs internet; uses Esri's free map images) and Stats (colors countries by population, area or density)
- Country window: facts, rankings by population, size and density, news links by category, neighbours you can click, side-by-side comparison of two countries, place search in the capital, history links
- A link such as `#IRQ` at the end of the address opens that country directly

## What is not built yet

- Top 10 brands and shops per country (needs a curated list, plan decision 2)
- Live news inside the window, trends (Phase 4)
- City pages, accounts, the guessing game, user rankings (Phases 5 and 6)

## Known data limits

Population numbers come from an older dataset (about 2018). Coastline and life expectancy were left out on purpose because that source's values were wrong. Both will come from World Bank data in a later phase. Taiwan, Kosovo and a few small territories have no population yet.

City names come from Natural Earth (public domain): places above about 50,000 people plus regional capitals. Smaller towns are not included yet.

## Files

- `src/main.js`: the map and the country window
- `scripts/build-cities.mjs`: rebuilds `public/data/cities.json` (capitals and cities); run with `node scripts/build-cities.mjs`. For a few small capitals it needs `npm install --no-save all-the-cities` first
- `scripts/build-data.mjs`: rebuilds `public/data` (borders and country facts); run with `npm run data`
- `public/data`: the generated border and country data
- `public/maplibre`: map engine helper files (needed for the map to start)

Satellite and terrain images are from Esri and fine for testing. Check Esri's terms or switch to MapTiler before a public launch.
