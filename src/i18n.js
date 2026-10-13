// Interface language. The Settings menu lists the world's most spoken languages; the choice is remembered on this device.
// This translates the main controls (top bar, settings, panel tabs, map tools). Text made while using the site
// (project names, statistics, country facts, news) stays as it is.
export const LANGS = [
  ['en', 'English'], ['zh', '中文 (Mandarin)'], ['hi', 'हिन्दी (Hindi)'], ['es', 'Español'], ['fr', 'Français'],
  ['ar', 'العربية (Arabic)'], ['bn', 'বাংলা (Bengali)'], ['pt', 'Português'], ['ru', 'Русский'], ['ur', 'اردو (Urdu)'], ['id', 'Bahasa Indonesia'], ['ckb', 'کوردی (Sorani)'],
];
const RTL = new Set(['ar', 'ur', 'ckb']);
// key (the English text) -> [zh, hi, es, fr, ar, bn, pt, ru, ur, id, ckb]
const ORDER = ['zh', 'hi', 'es', 'fr', 'ar', 'bn', 'pt', 'ru', 'ur', 'id', 'ckb'];
const T = {
  'Settings': ['设置', 'सेटिंग्स', 'Ajustes', 'Paramètres', 'الإعدادات', 'সেটিংস', 'Configurações', 'Настройки', 'ترتیبات', 'Pengaturan', 'ڕێکخستنەکان'],
  'Map theme': ['地图主题', 'मानचित्र थीम', 'Tema del mapa', 'Thème de la carte', 'مظهر الخريطة', 'মানচিত্রের থিম', 'Tema do mapa', 'Тема карты', 'نقشے کی تھیم', 'Tema peta', 'ڕووکاری نەخشە'],
  'Dark or light map and terrain': ['深色或浅色地图与地形', 'गहरा या हल्का मानचित्र और भू-भाग', 'Mapa y relieve oscuros o claros', 'Carte et relief sombres ou clairs', 'خريطة وتضاريس داكنة أو فاتحة', 'গাঢ় বা হালকা মানচিত্র ও ভূখণ্ড', 'Mapa e relevo escuros ou claros', 'Тёмная или светлая карта и рельеф', 'گہرا یا ہلکا نقشہ اور خطہ', 'Peta dan medan gelap atau terang', 'نەخشە و زەویی تاریک یان ڕووناک'],
  'Country names': ['国家名称', 'देशों के नाम', 'Nombres de países', 'Noms des pays', 'أسماء الدول', 'দেশের নাম', 'Nomes dos países', 'Названия стран', 'ممالک کے نام', 'Nama negara', 'ناوی وڵاتان'],
  'Show or hide the names on the map': ['在地图上显示或隐藏名称', 'मानचित्र पर नाम दिखाएँ या छिपाएँ', 'Mostrar u ocultar los nombres en el mapa', 'Afficher ou masquer les noms sur la carte', 'إظهار الأسماء على الخريطة أو إخفاؤها', 'মানচিত্রে নাম দেখান বা লুকান', 'Mostrar ou ocultar os nomes no mapa', 'Показать или скрыть названия на карте', 'نقشے پر نام دکھائیں یا چھپائیں', 'Tampilkan atau sembunyikan nama di peta', 'ناوەکان لەسەر نەخشە پیشان بدە یان بیانشارەوە'],
  'Animations': ['动画', 'एनिमेशन', 'Animaciones', 'Animations', 'الحركات', 'অ্যানিমেশন', 'Animações', 'Анимация', 'اینیمیشنز', 'Animasi', 'جووڵەکان'],
  'Sliding tabs, sweeps and glow': ['滑动标签、扫描和光效', 'स्लाइडिंग टैब, स्वीप और चमक', 'Pestañas deslizantes, barridos y brillo', 'Onglets glissants, balayages et lueurs', 'تبويبات منزلقة وتأثيرات ومضات', 'স্লাইডিং ট্যাব, সোয়াইপ ও দীপ্তি', 'Abas deslizantes, varreduras e brilho', 'Скользящие вкладки, волны и свечение', 'سلائیڈنگ ٹیبز، سویپ اور چمک', 'Tab geser, sapuan, dan cahaya', 'تابی خزۆک، تیشک و درەوشانەوە'],
  'Distance': ['距离', 'दूरी', 'Distancia', 'Distance', 'المسافة', 'দূরত্ব', 'Distância', 'Расстояние', 'فاصلہ', 'Jarak', 'دووری'],
  'Kilometres or miles': ['公里或英里', 'किलोमीटर या मील', 'Kilómetros o millas', 'Kilomètres ou miles', 'كيلومترات أو أميال', 'কিলোমিটার বা মাইল', 'Quilômetros ou milhas', 'Километры или мили', 'کلومیٹر یا میل', 'Kilometer atau mil', 'کیلۆمەتر یان میل'],
  'Temperature': ['温度', 'तापमान', 'Temperatura', 'Température', 'درجة الحرارة', 'তাপমাত্রা', 'Temperatura', 'Температура', 'درجہ حرارت', 'Suhu', 'پلەی گەرمی'],
  'Celsius or Fahrenheit': ['摄氏或华氏', 'सेल्सियस या फ़ारेनहाइट', 'Celsius o Fahrenheit', 'Celsius ou Fahrenheit', 'مئوية أو فهرنهايت', 'সেলসিয়াস বা ফারেনহাইট', 'Celsius ou Fahrenheit', 'Цельсий или Фаренгейт', 'سیلسیس یا فارن ہائیٹ', 'Celsius atau Fahrenheit', 'سیلیزی یان فارنهایت'],
  'Language': ['语言', 'भाषा', 'Idioma', 'Langue', 'اللغة', 'ভাষা', 'Idioma', 'Язык', 'زبان', 'Bahasa', 'زمان'],
  'Most spoken languages': ['使用人数最多的语言', 'सबसे अधिक बोली जाने वाली भाषाएँ', 'Idiomas más hablados', 'Langues les plus parlées', 'اللغات الأكثر انتشارًا', 'সর্বাধিক প্রচলিত ভাষা', 'Idiomas mais falados', 'Самые распространённые языки', 'سب سے زیادہ بولی جانے والی زبانیں', 'Bahasa paling banyak digunakan', 'زۆرترین زمانی قسەپێکراو'],
  'Search places': ['搜索地点', 'स्थान खोजें', 'Buscar lugares', 'Rechercher des lieux', 'ابحث عن أماكن', 'স্থান খুঁজুন', 'Pesquisar lugares', 'Поиск мест', 'مقامات تلاش کریں', 'Cari tempat', 'گەڕان بۆ شوێنەکان'],
  'Play': ['游戏', 'खेलें', 'Jugar', 'Jouer', 'العب', 'খেলুন', 'Jogar', 'Играть', 'کھیلیں', 'Main', 'یاری'],
  'Sign in': ['登录', 'साइन इन', 'Iniciar sesión', 'Se connecter', 'تسجيل الدخول', 'সাইন ইন', 'Entrar', 'Войти', 'سائن اِن', 'Masuk', 'چوونەژوورەوە'],
  'Projects': ['项目', 'प्रोजेक्ट', 'Proyectos', 'Projets', 'المشاريع', 'প্রকল্প', 'Projetos', 'Проекты', 'پروجیکٹس', 'Proyek', 'پڕۆژەکان'],
  'Layers': ['图层', 'लेयर', 'Capas', 'Calques', 'الطبقات', 'স্তর', 'Camadas', 'Слои', 'تہیں', 'Lapisan', 'چینەکان'],
  'Stats': ['统计', 'आँकड़े', 'Datos', 'Stats', 'إحصاءات', 'পরিসংখ্যান', 'Estatísticas', 'Статистика', 'اعداد و شمار', 'Statistik', 'ئامار'],
  'Real size': ['真实大小', 'वास्तविक आकार', 'Tamaño real', 'Taille réelle', 'الحجم الحقيقي', 'প্রকৃত আকার', 'Tamanho real', 'Реальный размер', 'اصل سائز', 'Ukuran asli', 'قەبارەی ڕاستەقینە'],
  'Flights': ['航班', 'उड़ानें', 'Vuelos', 'Vols', 'الرحلات', 'ফ্লাইট', 'Voos', 'Рейсы', 'پروازیں', 'Penerbangan', 'فڕینەکان'],
  'Trade': ['贸易', 'व्यापार', 'Comercio', 'Commerce', 'التجارة', 'বাণিজ্য', 'Comércio', 'Торговля', 'تجارت', 'Perdagangan', 'بازرگانی'],
  'Time': ['时间', 'समय', 'Hora', 'Heure', 'الوقت', 'সময়', 'Hora', 'Время', 'وقت', 'Waktu', 'کات'],
  'Measure': ['测量', 'मापें', 'Medir', 'Mesurer', 'قياس', 'পরিমাপ', 'Medir', 'Измерить', 'پیمائش', 'Ukur', 'پێوان'],
  'Map type': ['地图类型', 'मानचित्र प्रकार', 'Tipo de mapa', 'Type de carte', 'نوع الخريطة', 'মানচিত্রের ধরন', 'Tipo de mapa', 'Тип карты', 'نقشے کی قسم', 'Jenis peta', 'جۆری نەخشە'],
  'Save this view': ['保存此视图', 'यह दृश्य सहेजें', 'Guardar esta vista', 'Enregistrer cette vue', 'احفظ هذا العرض', 'এই দৃশ্য সংরক্ষণ করুন', 'Salvar esta vista', 'Сохранить этот вид', 'یہ منظر محفوظ کریں', 'Simpan tampilan ini', 'ئەم دیمەنە هەڵبگرە'],
  'Layers and tools': ['图层和工具', 'लेयर और उपकरण', 'Capas y herramientas', 'Calques et outils', 'الطبقات والأدوات', 'স্তর ও টুল', 'Camadas e ferramentas', 'Слои и инструменты', 'تہیں اور اوزار', 'Lapisan dan alat', 'چین و ئامرازەکان'],
  'Play trivia games': ['玩知识游戏', 'ट्रिविया गेम खेलें', 'Jugar a juegos de preguntas', 'Jouer aux jeux de culture générale', 'العب ألعاب المعلومات', 'ট্রিভিয়া গেম খেলুন', 'Jogar jogos de perguntas', 'Играть в викторины', 'معلوماتی کھیل کھیلیں', 'Main permainan kuis', 'یاری زانیاری بکە'],
  'Hide': ['隐藏', 'छिपाएँ', 'Ocultar', 'Masquer', 'إخفاء', 'লুকান', 'Ocultar', 'Скрыть', 'چھپائیں', 'Sembunyikan', 'شاردنەوە'],
  'Close': ['关闭', 'बंद करें', 'Cerrar', 'Fermer', 'إغلاق', 'বন্ধ করুন', 'Fechar', 'Закрыть', 'بند کریں', 'Tutup', 'داخستن'],
  'Show statistics': ['显示统计', 'आँकड़े दिखाएँ', 'Mostrar datos', 'Afficher les statistiques', 'إظهار الإحصاءات', 'পরিসংখ্যান দেখান', 'Mostrar estatísticas', 'Показать статистику', 'اعداد و شمار دکھائیں', 'Tampilkan statistik', 'ئامار پیشان بدە'],
};
const $$ = (s) => [...document.querySelectorAll(s)];
// [selector, key, attribute (omit for text)]
const TARGETS = [
  ['#settings h2', 'Settings'], ['#settingsbtn .lbl', 'Settings'],
  ['.srow:has(#maptheme) b', 'Map theme'], ['.srow:has(#maptheme) small', 'Dark or light map and terrain'],
  ['.srow:has(#names) b', 'Country names'], ['.srow:has(#names) small', 'Show or hide the names on the map'],
  ['.srow:has(#anim) b', 'Animations'], ['.srow:has(#anim) small', 'Sliding tabs, sweeps and glow'],
  ['.srow:has(#lang) b', 'Language'], ['.srow:has(#lang) small', 'Most spoken languages'],
  ['#search', 'Search places', 'placeholder'], ['#playtop .lb', 'Play'], ['#signinbtn .lb', 'Sign in'],
  ['#tab-projects', 'Projects'], ['#tab-layers', 'Layers'], ['#topnav [data-tab=projects] .nl', 'Projects'], ['#topnav [data-tab=layers] .nl', 'Layers'],
  ['#statstop span', 'Stats'], ['#sizetop span', 'Real size'], ['#flightbtn span', 'Flights'], ['#tradebtn span', 'Trade'], ['#tzbtn span', 'Time'], ['#measurebtn span', 'Measure'],
  ['#mapbar-type small', 'Map type'], ['#mapbar-save span', 'Save this view'],
  ['#sv-layers .sv-h:nth-of-type(1)', 'Map type'], ['#sv-layers .sv-h:nth-of-type(2)', 'Layers and tools'],
  ['#playrow b', 'Play trivia games'],
];
let lang = 'en';
const tr = (key) => (lang === 'en' ? key : (T[key]?.[ORDER.indexOf(lang)] ?? key));
export const t = tr;
const setOne = ([sel, key, attr]) => {
  for (const el of $$(sel)) {
    if (attr) { if (!el.dataset.enPh) el.dataset.enPh = el.getAttribute(attr); el.setAttribute(attr, lang === 'en' ? el.dataset.enPh : tr(key) + '  ( / )'); }
    else { const want = tr(key); if (el.textContent !== want) el.textContent = want; }
  }
};
// text the site's own scripts write back in English ("Hide" ↔ "Close", "Show statistics") is translated as it appears
const keyOf = (txt) => Object.keys(T).find((k) => k === txt || T[k].includes(txt));
const LIVE = ['#settings .srow b', '#settings .srow small', '#side-collapse .sc-tx', '#sb-hide .sbh-t'];
function apply() {
  document.documentElement.lang = lang;
  document.body.classList.toggle('rtl', RTL.has(lang));
  TARGETS.forEach(setOne);
  for (const sel of LIVE) for (const el of $$(sel)) { const k = keyOf(el.textContent); if (k) el.textContent = tr(k); }
}
function watchLive() {
  const mo = new MutationObserver((list) => { if (lang === 'en') return; for (const m of list) { const el = m.target.nodeType === 3 ? m.target.parentElement : m.target; const k = keyOf(el.textContent); if (k && el.textContent !== tr(k)) el.textContent = tr(k); } });
  for (const sel of LIVE) for (const el of $$(sel)) mo.observe(el, { childList: true, characterData: true, subtree: true });
}
export function setLang(code) {
  lang = LANGS.some(([c]) => c === code) ? code : 'en';
  try { localStorage.setItem('we-lang', lang); } catch {}
  apply();
}
export function initLang() {
  const sel = document.querySelector('#lang');
  if (sel) {
    sel.innerHTML = LANGS.map(([c, n]) => `<option value="${c}">${n}</option>`).join('');
    try { lang = localStorage.getItem('we-lang') || 'en'; } catch {}
    if (!LANGS.some(([c]) => c === lang)) lang = 'en';
    sel.value = lang;
    sel.addEventListener('change', () => setLang(sel.value));
  }
  watchLive(); apply();
  const again = () => lang !== 'en' && apply();
  window.addEventListener('layout-change', again); window.addEventListener('maptype-change', again);
  setTimeout(again, 1200); setTimeout(again, 3500); // parts of the page are drawn a moment after load
}
