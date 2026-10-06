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
- Live flights: the Live flights button shows planes flying right now (OpenSky Network). Click one to see its airline, route (adsbdb.com), height, speed, how far it has flown, and an estimated landing time in your time and at the destination. You can also type a flight number such as UAE1. The free OpenSky service allows about 400 requests a day per visitor, so the page asks only every 25 seconds and moves planes smoothly in between. Landing time is distance left divided by speed, so it is an estimate.
- Settings and accounts: the gear at the right of the banner holds the map theme (dark or light), the show/hide country names switch, and an animations switch. Sign in and Sign up offer Google, Facebook, GitHub, X, or email and password. They need the one-time setup below.
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


## Turning on sign-in

The Sign in and Sign up buttons are built, but they need a sign-in service behind them. This site uses Supabase (free plan is enough). Until you do this, the buttons show a message that sign-in is not switched on.

1. Create a free project at supabase.com.
2. In the project, open Authentication, then Providers. Switch on Google, Facebook, GitHub and Twitter (this is the X sign-in). Each one asks for an ID and a secret, which you get by creating an app on that company's developer site (Google Cloud Console, Meta for Developers, GitHub Developer Settings, X Developer Portal). Each of those sites asks for a "callback URL", and Supabase shows you the one to paste. Email and password works without any of this.
3. In Authentication, then URL Configuration, set the Site URL to your site address (https://world-explorer.b5gnjhd6jj.workers.dev) and add the same address under Redirect URLs.
4. In Project Settings, then API, copy the Project URL and the anon public key. Put them in `public/auth-config.json` as `{"supabaseUrl": "...", "anonKey": "..."}` and push. The anon key is meant to be public, so it is safe in this file. Never put the service_role key or any provider secret in this repository.
