import type { DivarAd } from "@/types/ads";

// DEV FIXTURES — local stand-ins for Divar listings, used ONLY because no
// backend is wired in this phase. Every field mirrors the DivarAd shape so
// this file can be deleted the moment real search results arrive. Nothing
// here is presented as live marketplace data: no scores, no counts beyond
// what is computed, no seller contact info. Thumbnails are neutral synthetic
// SVG placeholders (abstract, clearly non-photographic) standing in for real
// listing photos; ads without one exercise the honest no-image state.

function art(hue: number, glyph: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">` +
    `<rect width="640" height="400" fill="#1E1E28"/>` +
    `<circle cx="320" cy="185" r="70" fill="none" stroke="hsl(${hue},45%,45%)" stroke-width="3" opacity="0.7"/>` +
    `<circle cx="320" cy="185" r="46" fill="none" stroke="hsl(${hue},45%,45%)" stroke-width="2" opacity="0.4"/>` +
    `<text x="320" y="200" font-size="44" text-anchor="middle" fill="hsl(${hue},40%,60%)" opacity="0.9">${glyph}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export interface FixtureAd extends DivarAd {
  cityId: string;
  thumbnail?: string;
}

export const SEARCH_FIXTURES: FixtureAd[] = [
  {
    id: "fx-u3-tehran",
    title: "پیانو آکوستیک یاماها U3 ساخت ژاپن",
    description:
      "پیانو آکوستیک یاماها مدل U3 ساخت ژاپن، در حد آکبند. کوک رگلاژ تازه انجام شده و آماده نوازندگی است. فروش به دلیل مهاجرت.",
    price: 185000000,
    city: "تهران",
    cityId: "tehran",
    neighborhood: "سعادت‌آباد",
    category: "آلات موسیقی",
    categoryId: "music",
    images: [],
    thumbnail: art(255, "♪"),
    createdAt: "۲ ساعت پیش",
  },
  {
    id: "fx-u1-isfahan",
    title: "پیانو یاماها U1 تمیز و سالم",
    description:
      "پیانو یاماها U1، رنگ مشکی، سالم و تمیز. چند سال در آموزشگاه استفاده شده و سرویس دوره‌ای داشته است.",
    price: 152000000,
    city: "اصفهان",
    cityId: "isfahan",
    category: "آلات موسیقی",
    categoryId: "music",
    images: [],
    thumbnail: art(160, "♪"),
    createdAt: "دیروز",
  },
  {
    id: "fx-digital-tehran",
    title: "پیانو دیجیتال یاماها P-125 با پایه",
    description:
      "پیانو دیجیتال یاماها P-125 همراه با پایه چوبی و پدال. تاچ عالی و مناسب تمرین خانگی. مدل دیجیتال است.",
    price: 96000000,
    city: "تهران",
    cityId: "tehran",
    neighborhood: "نارمک",
    category: "آلات موسیقی",
    categoryId: "music",
    images: [],
    thumbnail: art(210, "♪"),
    createdAt: "۳ ساعت پیش",
  },
  {
    id: "fx-acoustic-style-karaj",
    title: "پیانو طرح آکوستیک دیواری",
    description:
      "پیانو طرح آکوستیک دیواری، ظاهر شیک و مناسب دکور. صدا متوسط است و برای شروع یادگیری بد نیست.",
    price: 42000000,
    city: "کرج",
    cityId: "karaj",
    category: "آلات موسیقی",
    categoryId: "music",
    images: [],
    createdAt: "۵ ساعت پیش",
  },
  {
    id: "fx-handmade-tehran",
    title: "پیانو آکوستیک دست‌ساز کارگاهی",
    description:
      "پیانو آکوستیک دست‌ساز یک کارگاه محلی. اطلاعات فنی دقیقی از ساز موجود نیست و بهتر است حضوری بازدید شود.",
    price: null,
    city: "تهران",
    cityId: "tehran",
    category: "آلات موسیقی",
    categoryId: "music",
    images: [],
    createdAt: "دیروز",
  },
  {
    id: "fx-grand-shiraz",
    title: "پیانو گرند یاماها GB1",
    description:
      "پیانو گرند (رویال) یاماها مدل GB1، مناسب سالن و آموزشگاه. قیمت مقطوع، معاوضه ندارد.",
    price: 890000000,
    city: "شیراز",
    cityId: "shiraz",
    category: "آلات موسیقی",
    categoryId: "music",
    images: [],
    createdAt: "هفته پیش",
  },
];
