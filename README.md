# World Explorer (Phase 1)

An interactive world map. Click any country to see its window with Overview, Rank, News, Geography and History tabs.

## Run it on your computer

1. Install Node.js (version 20 or newer) from nodejs.org.
2. Open a terminal in this folder and run `npm install` (downloads the map libraries, once).
3. Run `npm run dev`, then open the address it prints (usually http://localhost:5173).

To make the files you upload to a web host, run `npm run build`. The finished site is in the `dist` folder.

## What works now

- All 236 countries and territories on a zoomable map, with the name on hover
- Banner: the views (Map, Terrain, Satellite, Stats, 3D Earth) are icon tabs; the name shows when the mouse rests on one. Trade lines, Live flights, Time zones and Real size are switches in one Layers menu, and the Layers button shows how many are on. Search is a magnifier that opens into a box. On phones the view tabs move to a bar at the bottom, and the banner buttons show only icons, with their names appearing on hover.
- Search (press / to jump to it): type part of a country or city name, with or without accents, e.g. "sao pau", "paris fr" or "erbil". Results rank by match and city size, show the flag and country, and picking one flies the map there with a pin. For streets, villages and landmarks that are not in our lists, press Enter on the last row to ask OpenStreetMap's search (one request per press, as its usage policy asks).
- Search by country or capital
- Views: Map, Terrain, Satellite (needs internet; uses Esri's free map images) and Stats (colors countries by population, area or density)
- Country window: facts, rankings by population, size and density, news links by category, neighbours you can click, side-by-side comparison of two countries, place search in the capital, history links
- Time zones: the "Time zones" button at the left of the map shows each country's live local time on the map. The country window shows the time, how far ahead or behind you it is, and every time zone for countries with several. Summer time is handled by the browser.
- Stats banner: the Stats button in the header opens a see-through banner with the statistics (population, growth, density, internet users, age span, economy, income, tourists, military spending, armed forces, area), a year slider from 1960 to today with a play button, and a colour legend. You can add your own statistic by pasting numbers or typing a World Bank code. "People heat" shows where people actually live. Population and economy are saved with the site; the other statistics load from the World Bank when you open them.
- Trade lines (off by default; switch them on in the Layers menu): click a country to see curved lines to its main export and import partners, thicker for more trade (World Bank WITS, 2023, saved with the site; countries that do not report use their partners' records). The Trade tab lists the numbers.
- Live flights: the Live flights button shows planes flying right now (OpenSky Network). Click one to see its airline, route (adsbdb.com), height, speed, how far it has flown, and an estimated landing time in your time and at the destination. You can also type a flight number such as UAE1. The free OpenSky service allows about 400 requests a day per visitor, so the page asks only every 25 seconds and moves planes smoothly in between. Landing time is distance left divided by speed, so it is an estimate.
- Settings and accounts: the gear at the right of the banner holds the map theme (dark or light), a Map style choice (Normal flat colours, or OpenStreetMap's standard street map drawn under the countries in the Map view), the show/hide country names switch (choosing OpenStreetMap switches it off, since that map has its own names; you can turn it back on), and an animations switch. The single Sign in button opens a window with Sign in and Sign up tabs, offering Google, Facebook, GitHub, X, or email and password. They need the one-time setup below.
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


## History (in the Stats bar)
Stats has a History group with a "World through time" button. It opens a timeline of 54 snapshots from 123,000 BC to 2010, in eight eras (Stone Age, Bronze Age, Classical antiquity, Late antiquity and early Middle Ages, High and late Middle Ages, Early modern period, Age of nations and empires, World wars and Cold War) plus today. Drag the slider, use the arrows, jump to an era, or press play. The map shows the countries, empires and peoples of that time with their names and borders, coloured by who ruled each area. Dashed borders are only roughly known. Click a shape for details and a Wikipedia link, or open the Names list to find one.
The shapes come from Historical Basemaps by Andre Ourednik (https://github.com/aourednik/historical-basemaps), licensed GPL-3.0, so keep this credit and licence note if you share the data. Borders for ancient times are approximate and the dataset is still work in progress. To rebuild the files run `node scripts/build-history.mjs` (it downloads the source once into `scripts/.cache/history`). Each snapshot is about 0.2 to 0.9 MB and only the one you look at is downloaded.

## 3D Earth
The 3D Earth button in the banner opens a real 3D globe, built with CesiumJS (the leading open-source 3D globe library). Drag to spin, scroll to zoom, right-drag or Ctrl-drag to tilt, and click a country to open its panel. A small panel sets the picture on the globe (Satellite, Street map, Natural Earth, or NASA night lights), borders, country names, cities, a slow spin, and day and night (sunlight right now). The search box also flies the globe to a city, a country or a place.
The library (about 4 MB) is downloaded only the first time someone opens 3D Earth. It comes from Cesium's own download site, with unpkg and jsDelivr as backups, so nothing is added to this repository.
For real 3D mountains, make a free account at ion.cesium.com, copy an access token, and put it in `public/globe-config.json` as `{"ionToken": "..."}`. A "3D mountains" switch then appears. The token is meant to be public (restrict it to your site's address in the ion dashboard). Cesium ion's free plan is for non-commercial use. Satellite pictures are from Esri, so check Esri's terms before a public launch.

## Map style and OpenStreetMap
Settings has a Map style option. Normal is the flat-colour map. OpenStreetMap loads the standard tiles from `tile.openstreetmap.org` under the semi-transparent country colours, with the required "© OpenStreetMap contributors" credit. It only affects the Map view and is remembered per browser. OpenStreetMap's tile servers are free for light use only (see operations.osmfoundation.org/policies/tiles). For a busy public site, use a hosted tile provider or your own tile server and change the `osm` source in `src/main.js`.

## Turning on sign-in

The Sign in and Sign up buttons are built, but they need a sign-in service behind them. This site uses Supabase (free plan is enough). Until you do this, the buttons show a message that sign-in is not switched on.

1. Create a free project at supabase.com.
2. In the project, open Authentication, then Providers. Switch on Google, Facebook, GitHub and Twitter (this is the X sign-in). Each one asks for an ID and a secret, which you get by creating an app on that company's developer site (Google Cloud Console, Meta for Developers, GitHub Developer Settings, X Developer Portal). Each of those sites asks for a "callback URL", and Supabase shows you the one to paste. Email and password works without any of this.
3. In Authentication, then URL Configuration, set the Site URL to your site address (https://world-explorer.b5gnjhd6jj.workers.dev) and add the same address under Redirect URLs.
4. In Project Settings, then API, copy the Project URL and the anon public key. Put them in `public/auth-config.json` as `{"supabaseUrl": "...", "anonKey": "..."}` and push. The anon key is meant to be public, so it is safe in this file. Never put the service_role key or any provider secret in this repository.

## Cities in the country panel
In a country's **Geography** tab, open **Cities** to see its cities (capital first). Click one to read about it in the same panel (population, local time, weather, height, sunrise/sunset, short Wikipedia text). **Pop out** turns it into a floating card you can drag anywhere over the map. **Compare** opens a window that puts up to 6 cities side by side; search any city in the world to add it (added cities and your compare list are kept in your browser). Live facts come from Open-Meteo and Wikipedia (free, no key).

## Play (trivia games)
The **Play** button on the banner (next to Layers) opens a game window. Choose **Solo** (Flag quiz, Capital quiz, Bigger or smaller, Mystery country, Mix it up, Streak, Lightning; best scores are saved in your browser) or **With friends**: **Same device** (take turns, up to 6 players) or **Online room** (everyone on their own device with a 4-letter code; the host keeps score). The online room uses Supabase Realtime, so it only works once `public/auth-config.json` holds your Supabase URL and anon key (the same ones used for sign-in); without them it is greyed out.

## Distance & measure
Layers → **Distance & measure** opens a small draggable window. Add places by clicking the map or searching a city/address (up to 10; drag the A, B, C pins to adjust). Pick **Straight line**, **Walk**, **Bike**, **Car** or **Train** to see distance and travel time, per leg and in total, in km or miles. Walk, bike and car follow real roads using the free OpenStreetMap routing servers (routing.openstreetmap.de); if they cannot be reached, or for Train (no free train-route service exists), the figure is an estimate and is marked as such.

## Front page, top-bar links and Units
On the first visit of each browser session a front page shows over the map (a slowly turning Earth with country borders and city lights, plus cards for Live Earth, Country Data, Flight Tracker, Historical Maps, Play and Distance & measure). **Explore the globe**, any card, the Esc key or a top-bar link takes you in; the **Explore** link or the logo brings it back. Top-bar links: Explore, Countries (focuses search), Live Earth, History, Data (hidden on narrow screens). **Settings → Distance / Temperature** switch km/miles and °C/°F (used by the measure window and city cards).

The photos on the front page cards are made from NASA Earth textures (public domain) taken from the `three-globe` npm package (MIT) by `scripts/build-landing-images.py`; the results are in `public/img/landing/`.

## Map type picker
On computers the Map, Terrain, Satellite and 3D Earth buttons are one **Map type** button next to Layers that shows only a picture of the current type; clicking it lists the names (Map, Terrain, Satellite, 3D Earth) vertically, each with a small picture, like the layers switcher in Google Maps. On phones the bottom bar still shows each type. The pictures are made by `scripts/build-maptype-images.py` from NASA textures and the site's own borders.

## Banner (updated)
Order, left to right: logo, text links, search, Map type (picture), Layers, Stats, Play, then Settings and Sign in. **OpenStreetMap** is now one of the choices in the Map type list (Map, Terrain, Satellite, OpenStreetMap, 3D Earth) instead of a Settings option; picking it switches country names off, as before. On the front page the banner only shows the logo, the text links and Sign in; the icon buttons, Play and Settings appear once you go into the map.

## Workspace and Projects (map-first redesign)

The site is now a workspace: the map fills the screen, with a compact top bar (Explore, Projects, Layers, search, Play, Settings, Sign in), a collapsible panel on the left, and the country or place details inside that panel so the map stays visible. On phones the panel becomes a bottom sheet that you can drag, and a tab bar (Explore, Projects, Layers) stays at the bottom. The map has zoom buttons and a 2D/3D switch. The old front-page cards moved into the Layers tab (statistics, historical maps, trade lines, live flights, time zones, distance and measure, real size, play) and into the Discover box on the front page.

**Projects** are saved map workspaces: a name, an optional description, saved places, notes, the map view (position and zoom) and the layers that were on (map type, theme, names, country times, trade lines, live flights).

- Create one from the front page, the Projects tab, or while saving a place. Edit or delete it from its page; deleting asks first and can be undone for a few seconds.
- "Save" in a country or place window saves it to a project you pick. "Save this view" at the bottom of the map saves the current view and layers. "Open on map" restores the view, the pins and the layers.
- Add, edit and remove notes and places inside a project. Cards show a small preview, the number of places and when it was last changed.
- Export backup / Import backup in the Projects tab writes and reads a JSON file.

**How projects are saved.** In this browser only (`localStorage`, key `we-projects-v1`). They stay on this device and in this browser profile. They are not synced to other devices, and clearing site data or using private mode removes them (the site warns when the browser will not save). Use Export backup to keep a copy. The storage code (`src/projects/store.js`) takes the storage in as a parameter, so a Supabase-backed version can replace it later without changing the screens.

**Sharing.** Setting a project's visibility to "Can be shared as a link" creates a read-only link of the form `…/#share=<data>`. The link holds a compressed copy of the project inside the address, which is never sent to a server. It is a snapshot: later edits do not change a link that was already shared, it cannot be taken back, and big projects may be too large for a link (the site says so; use the backup file instead). Opening a link treats everything in it as untrusted and validates it. Live shared pages with accounts would need the Supabase backend and are not built.

**Routes.** Still a single page. `?map` skips the front page. `#IRQ` still opens a country. New: `#share=…` opens a shared project read-only. Nothing else changed.

**Code layout.** `src/workspace/` (shell, panel, dialogs, toasts), `src/projects/` (model, store, controller, views, forms, share, thumbnails, recent activity), `src/styles/` (workspace, projects, landing). Run the unit tests with `npm test`.

## History pictures and country timelines

- **Pictures on the timeline.** Each of the 54 history snapshots is matched to a Wikipedia article about that time (for example 1530 is Suleiman the Magnificent, 1914 is World War I, 2,000 BC is the Great Pyramid) listed in `src/eraphotos.js`. The article's lead picture shows beside the year and in a scrollable strip under the slider; choosing one jumps to that date. Wikipedia only returns pictures it holds a free licence for, so some articles have none and that tile stays plain. Pictures are loaded live from Wikipedia (two requests in total, nothing stored by us), so they need internet. They are credited to Wikipedia in each tile's tooltip.
- **Country window, History tab.** "Through the eras" lists which country, empire or people held the country's capital in each snapshot (for example Iraq: Abbasid Caliphate, Ilkhanate, Ottoman Empire, then Mesopotamia under Britain, then Iraq). Each entry shows a Wikipedia picture of that country or people, or, if it has none, one from the same period. Choosing an entry opens that era on the map. Data: `scripts/build-country-history.mjs` writes `public/data/history/country-timeline.json`. 62 countries and territories (mostly very small ones) have no record because they are too small for the historical shapes; the tab says so.
- Clicking a country or people in the History layer also shows its Wikipedia lead picture when it has one.
- Borders for early eras are approximate (Historical Basemaps, GPL-3.0).

## Statistics as a layer, and religion charts

- **Statistics is now a layer.** Open Layers, then switch on Statistics. It colours countries by the chosen number on top of whichever Map type is showing (Map, Terrain, Satellite, OpenStreetMap), instead of replacing it. Its controls (the list of statistics, the year slider, legend, ranked table, People heat, Historical maps and "add your own") now sit in the side panel under the Statistics row; the banner that used to cover the top of the map is gone. Code: `main.js` (`setStats`, event `stats-layer`), `stats.js`, `styles/stats.css`. The old hidden "Stats" map view was removed, so nothing else switches to it.
- **Religion.** A new "Religion" group in Statistics colours the map by the share of people who are Christians, Muslims, Unaffiliated, Hindus, Buddhists, Folk religions, Other religions or Jews. The year slider moves in decades, 2010 to 2050. 2010 is Pew Research Center's estimate; 2020 to 2050 are Pew's projections, not measurements, and are marked with *. Under the legend there is a chart for the whole world (population-weighted) or for a country you click: a bar with every percentage written out, and stacked columns for 2010 to 2050. The Overview tab of each country window shows the same chart.
- **Data.** `public/data/religion.json`, built by `scripts/build-religion.mjs` from Pew Research Center via datasets/world-religion-projections (CC BY 4.0). Pew rounds every group to the nearest 10,000, so countries whose shares do not add up to about 100% (mostly very small ones) are left out rather than drawn wrongly. The world totals match Pew's published 2010 figures (31.4% Christian, 23.2% Muslim, 16.4% unaffiliated, 15.0% Hindu).
- **Projects** now remember which built-in statistic was showing (not statistics you added yourself, People heat or Historical maps, which the save dialog says).
