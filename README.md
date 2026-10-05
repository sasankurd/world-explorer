# World Explorer (Phase 1)

An interactive world map. Click any country to see its window with Overview, Rank, News, Geography and History tabs.

## Run it on your computer

1. Install Node.js (version 20 or newer) from nodejs.org.
2. Open a terminal in this folder and run `npm install` (downloads the map libraries, once).
3. Run `npm run dev`, then open the address it prints (usually http://localhost:5173).

To make the files you upload to a web host, run `npm run build`. The finished site is in the `dist` folder.

## What works now

- All 236 countries and territories on a zoomable map, with the name on hover
- Search by country or capital
- Views: Map, Terrain, Satellite (needs internet; uses Esri's free map images) and Stats (colors countries by population, area or density)
- Country window: facts, rankings by population, size and density, news links by category, neighbours you can click, side-by-side comparison of two countries, place search in the capital, history links
- Time zones: the "Time zones" button at the left of the map shows each country's live local time on the map. The country window shows the time, how far ahead or behind you it is, and every time zone for countries with several. Summer time is handled by the browser.
- Stats banner: the Stats button in the header opens a see-through banner with the statistics (population, growth, density, internet users, age span, economy, income, tourists, military spending, armed forces, area), a year slider from 1960 to today with a play button, and a colour legend. You can add your own statistic by pasting numbers or typing a World Bank code. "People heat" shows where people actually live. Population and economy are saved with the site; the other statistics load from the World Bank when you open them.
- Trade lines: click a country to see curved lines to its main export and import partners, thicker for more trade (World Bank WITS, 2023, saved with the site; countries that do not report use their partners' records). The Trade tab lists the numbers.
- Trends: small charts for population, economy and tourism in each country window.
- A link such as `#IRQ` at the end of the address opens that country directly

## What is not built yet

- Top 10 brands and shops per country (needs a curated list, plan decision 2)
- Live news inside the window, trends (Phase 4)
- City pages, accounts, the guessing game, user rankings (Phases 5 and 6)

## Known data limits

Population numbers come from an older dataset (about 2018). Coastline and life expectancy were left out on purpose because that source's values were wrong. Both will come from World Bank data in a later phase. Taiwan, Kosovo and a few small territories have no population yet.

## Files

- `src/main.js`: the map and the country window
- `scripts/build-data.mjs`: rebuilds `public/data` (borders and country facts); run with `npm run data`
- `scripts/build-cities.mjs` and `scripts/build-timezones.mjs`: rebuild `cities.json` and `timezones.json`. First run `npm install --no-save all-the-cities tz-lookup countries-and-timezones`, then both scripts
- `scripts/build-series.mjs` and `scripts/build-trade.mjs`: rebuild the saved population/economy series and the trade partners (trade needs the WITS copy described at the top of that script)
- `public/data`: the generated border and country data
- `public/maplibre`: map engine helper files (needed for the map to start)

Satellite and terrain images are from Esri and fine for testing. Check Esri's terms or switch to MapTiler before a public launch.
