import fs from 'fs';
import {createRequire} from 'module';
import * as topojson from 'topojson-client';
const require = createRequire(import.meta.url);
const wc = require('world-countries');
const cj = f => JSON.parse(fs.readFileSync(`node_modules/country-json/src/${f}.json`,'utf8'));
const by = (f,key) => { const m = new Map(); for (const r of cj(f)) m.set(r.country, r[key]); return m; };
const T = {
  population: by('country-by-population','population'),
  elevation: by('country-by-elevation','elevation'),
  coast: by('country-by-costline','costline'),
  life: by('country-by-life-expectancy','expectancy'),
  gov: by('country-by-government-type','government'),
  dish: by('country-by-national-dish','dish'),
  temp: by('country-by-yearly-average-temperature','temperature'),
  indep: by('country-by-independence-date','independence'),
  religion: by('country-by-religion','religion'),
};
// names that differ between the two sources
const alias0 = {"United States":"United States","Czechia":"Czech Republic","DR Congo":"Democratic Republic of the Congo","Republic of the Congo":"Republic of the Congo","Ivory Coast":"Côte d'Ivoire","Myanmar":"Myanmar","North Macedonia":"Macedonia","Eswatini":"Swaziland","Cape Verde":"Cape Verde","Timor-Leste":"East Timor","Russia":"Russia","South Korea":"South Korea","North Korea":"North Korea","Vatican City":"Vatican City","Palestine":"Palestine","Bosnia and Herzegovina":"Bosnia and Herzegovina","Brunei":"Brunei","Laos":"Laos","Syria":"Syria","Iran":"Iran","Moldova":"Moldova","Tanzania":"Tanzania","Bolivia":"Bolivia","Venezuela":"Venezuela","Micronesia":"Micronesia, Federated States of","Gambia":"Gambia","Bahamas":"Bahamas","Falkland Islands":"Falkland Islands","Cocos (Keeling) Islands":"Cocos (Keeling) Islands","Saint Kitts and Nevis":"Saint Kitts and Nevis","Saint Vincent and the Grenadines":"Saint Vincent and the Grenadines"};
const alias = {...alias0,"DR Congo":"The Democratic Republic of Congo","Republic of the Congo":"Congo","Türkiye":"Turkey","Fiji":"Fiji Islands","Macau":"Macao","Pitcairn Islands":"Pitcairn","Saint Helena, Ascension and Tristan da Cunha":"Saint Helena","São Tomé and Príncipe":"Sao Tome and Principe","Vatican City":"Holy See (Vatican City State)","British Virgin Islands":"Virgin Islands, British","United States Virgin Islands":"Virgin Islands, U.S.","Czechia":"Czech Republic","Cape Verde":"Cape Verde","Eswatini":"Eswatini","North Macedonia":"North Macedonia","Timor-Leste":"East Timor","Ivory Coast":"Ivory Coast"};
const get = (m,names)=>{for(const n of names){ if(m.has(n)&&m.get(n)!=null&&m.get(n)!=='') return m.get(n);} return null;};
const countries = {};
let missingPop = [];
for (const c of wc) {
  const names=[alias[c.name.common],c.name.common,c.name.official].filter(Boolean);
  const o = {
    id: c.cca3, iso2: c.cca2, num: c.ccn3||null, name: c.name.common, official: c.name.official,
    capital: (c.capital&&c.capital[0])||null, region: c.region, subregion: c.subregion||null,
    area: c.area||null, flag: c.flag, landlocked: !!c.landlocked,
    languages: Object.values(c.languages||{}),
    currencies: Object.values(c.currencies||{}).map(x=>x.name+(x.symbol?` (${x.symbol})`:'')),
    borders: c.borders||[], latlng: c.latlng, independent: !!c.independent,
    population: get(T.population,names), elevation: get(T.elevation,names),
 government: get(T.gov,names), nationalDish: get(T.dish,names),
    avgTemp: get(T.temp,names), independence: get(T.indep,names), religion: get(T.religion,names),
  };
  if (o.population==null) missingPop.push(o.name);
  countries[o.id]=o;
}
// borders: Natural Earth 50m, keyed by ISO numeric code
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json','utf8'));
const fc = topojson.feature(topo, topo.objects.countries);
const byNum = {}; for (const c of Object.values(countries)) if (c.num) byNum[c.num]=c.id;
const feats=[]; const unmatched=[];
for (const f of fc.features) {
  const id = f.properties.name==='Kosovo' ? 'UNK' : byNum[String(f.id).padStart(3,'0')];
  if (!id) { unmatched.push(f.properties.name); continue; }
  f.properties={id}; feats.push(f);
}
fs.mkdirSync('public/data',{recursive:true});
const r=a=>typeof a[0]==='number'?[+a[0].toFixed(2),+a[1].toFixed(2)]:a.map(r);
// Rings that cross the date line (Russia, Fiji, USA...) jump from +180 to -180 and draw a stripe across the whole map.
// Unwrap them so longitudes run on continuously (MapLibre repeats the world, so this displays correctly).
const unwrap=ring=>{const out=[ring[0].slice()];let off=0;for(let i=1;i<ring.length;i++){const d=ring[i][0]-ring[i-1][0];if(d>180)off-=360;else if(d<-180)off+=360;out.push([ring[i][0]+off,ring[i][1]]);}
 const a=out[0],b=out[out.length-1];return (Math.abs(a[0]-b[0])<1e-6)?out:ring;};
let fixed=0;
for(const f of feats){f.geometry.coordinates=r(f.geometry.coordinates);
 const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
 for(const p of polys)for(let i=0;i<p.length;i++){const u=unwrap(p[i]);if(u!==p[i]){p[i]=u;fixed++}}}
console.log('rings unwrapped across date line:',fixed);
fs.writeFileSync('public/data/borders.geojson', JSON.stringify({type:'FeatureCollection',features:feats}));
const withShape = new Set(feats.map(f=>f.properties.id));
const out = Object.fromEntries(Object.entries(countries).filter(([id])=>withShape.has(id)));
fs.writeFileSync('public/data/countries.json', JSON.stringify(out));
console.log('shapes',feats.length,'countries with data',Object.keys(out).length);
console.log('shapes without a country record:',unmatched.join(', '));
console.log('missing population:',missingPop.filter(n=>out[Object.keys(out).find(k=>out[k].name===n)]).join(', '));
const nofacts=k=>Object.values(out).filter(c=>c[k]==null).length;
for (const k of ['population','capital','area','lifeExpectancy','government','nationalDish','avgTemp','elevation']) console.log(k,'missing',nofacts(k));
