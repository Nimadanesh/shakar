/**
 * HANDOFF-4 (2026-11-03) — closed brand-alias list.
 *
 * دانش عمومی بازار ایران؛ نه از تیترهای مجموعه‌های طلایی یا بیرونی.
 *
 * Each group is one brand: every Persian form (with spelling variants)
 * and every Latin form of that brand are equal for matching. Space and
 * ZWNJ variants of a form are NOT listed — layer A (spaceless matching)
 * covers them. Brands that live in the N spelling groups (هوندا،
 * نینتندو، ری‌بن، آیفون) stay there and are NOT repeated here.
 *
 * Forms deliberately absent (owner note): «دل»، «براون»، «بوز» and «جک»
 * have no Persian form, because each is also a common Persian word.
 * dell, bose, braun and jac are Latin-only for the same reason.
 */

export interface BrandAliasGroup {
  /** Stable group id: the first Latin form. */
  readonly id: string;
  /** Persian forms (spelling variants included). Empty for Latin-only brands. */
  readonly fa: readonly string[];
  /** Latin forms, lowercase. */
  readonly latin: readonly string[];
}

export const BRAND_ALIASES: readonly BrandAliasGroup[] = [
  // موبایل، رایانه، صوت و تصویر.
  { id: "samsung", fa: ["سامسونگ"], latin: ["samsung"] },
  { id: "apple", fa: ["اپل"], latin: ["apple"] },
  { id: "xiaomi", fa: ["شیائومی", "شیامی", "شیاومی"], latin: ["xiaomi"] },
  { id: "huawei", fa: ["هوآوی", "هواوی"], latin: ["huawei"] },
  { id: "honor", fa: ["آنر"], latin: ["honor"] },
  { id: "nokia", fa: ["نوکیا"], latin: ["nokia"] },
  { id: "motorola", fa: ["موتورولا"], latin: ["motorola"] },
  { id: "oneplus", fa: ["وان‌پلاس"], latin: ["oneplus"] },
  { id: "realme", fa: ["ریلمی"], latin: ["realme"] },
  { id: "oppo", fa: ["اوپو"], latin: ["oppo"] },
  { id: "vivo", fa: ["ویوو"], latin: ["vivo"] },
  { id: "google", fa: ["گوگل"], latin: ["google"] },
  { id: "sony", fa: ["سونی"], latin: ["sony"] },
  { id: "lg", fa: ["ال‌جی"], latin: ["lg"] },
  { id: "lenovo", fa: ["لنوو"], latin: ["lenovo"] },
  { id: "asus", fa: ["ایسوس", "اسوس"], latin: ["asus"] },
  { id: "acer", fa: ["ایسر"], latin: ["acer"] },
  { id: "hp", fa: ["اچ‌پی"], latin: ["hp"] },
  { id: "dell", fa: [], latin: ["dell"] },
  { id: "microsoft", fa: ["مایکروسافت"], latin: ["microsoft"] },
  { id: "canon", fa: ["کانن"], latin: ["canon"] },
  { id: "nikon", fa: ["نیکون"], latin: ["nikon"] },
  { id: "fujifilm", fa: ["فوجی‌فیلم"], latin: ["fujifilm"] },
  { id: "gopro", fa: ["گوپرو"], latin: ["gopro"] },
  { id: "dji", fa: ["دی‌جی‌آی"], latin: ["dji"] },
  { id: "jbl", fa: ["جی‌بی‌ال"], latin: ["jbl"] },
  { id: "anker", fa: ["انکر", "آنکر"], latin: ["anker"] },
  { id: "bose", fa: [], latin: ["bose"] },
  { id: "beats", fa: ["بیتس"], latin: ["beats"] },
  { id: "casio", fa: ["کاسیو"], latin: ["casio"] },
  { id: "seiko", fa: ["سیکو"], latin: ["seiko"] },
  { id: "hisense", fa: ["هایسنس"], latin: ["hisense"] },
  { id: "panasonic", fa: ["پاناسونیک"], latin: ["panasonic"] },
  { id: "toshiba", fa: ["توشیبا"], latin: ["toshiba"] },
  { id: "hitachi", fa: ["هیتاچی"], latin: ["hitachi"] },
  { id: "xvision", fa: ["ایکس‌ویژن"], latin: ["xvision"] },
  { id: "gplus", fa: ["جی‌پلاس"], latin: ["gplus"] },
  // لوازم خانگی و ابزار.
  { id: "philips", fa: ["فیلیپس", "فلیپس"], latin: ["philips"] },
  { id: "tefal", fa: ["تفال"], latin: ["tefal"] },
  { id: "moulinex", fa: ["مولینکس"], latin: ["moulinex"] },
  { id: "braun", fa: [], latin: ["braun"] },
  { id: "bosch", fa: ["بوش"], latin: ["bosch"] },
  { id: "siemens", fa: ["زیمنس"], latin: ["siemens"] },
  { id: "kenwood", fa: ["کنوود"], latin: ["kenwood"] },
  { id: "delonghi", fa: ["دلونگی"], latin: ["delonghi"] },
  { id: "electrolux", fa: ["الکترولوکس"], latin: ["electrolux"] },
  { id: "ariston", fa: ["آریستون"], latin: ["ariston"] },
  { id: "snowa", fa: ["اسنوا"], latin: ["snowa"] },
  { id: "parskhazar", fa: ["پارس‌خزر"], latin: ["parskhazar"] },
  { id: "emersun", fa: ["امرسان"], latin: ["emersun"] },
  { id: "pakshoma", fa: ["پاکشوما"], latin: ["pakshoma"] },
  { id: "daewoo", fa: ["دوو"], latin: ["daewoo"] },
  { id: "makita", fa: ["ماکیتا"], latin: ["makita"] },
  { id: "dewalt", fa: ["دیوالت"], latin: ["dewalt"] },
  { id: "ronix", fa: ["رونیکس"], latin: ["ronix"] },
  // خودرو و موتورسیکلت.
  { id: "peugeot", fa: ["پژو"], latin: ["peugeot"] },
  { id: "saipa", fa: ["سایپا"], latin: ["saipa"] },
  { id: "irankhodro", fa: ["ایران‌خودرو"], latin: ["irankhodro"] },
  { id: "kia", fa: ["کیا"], latin: ["kia"] },
  { id: "hyundai", fa: ["هیوندای", "هیوندا"], latin: ["hyundai"] },
  { id: "toyota", fa: ["تویوتا"], latin: ["toyota"] },
  { id: "nissan", fa: ["نیسان"], latin: ["nissan"] },
  { id: "renault", fa: ["رنو"], latin: ["renault"] },
  { id: "chery", fa: ["چری"], latin: ["chery"] },
  { id: "mvm", fa: ["ام‌وی‌ام"], latin: ["mvm"] },
  { id: "jac", fa: [], latin: ["jac"] },
  { id: "lifan", fa: ["لیفان"], latin: ["lifan"] },
  { id: "yamaha", fa: ["یاماها"], latin: ["yamaha"] },
  { id: "suzuki", fa: ["سوزوکی"], latin: ["suzuki"] },
  { id: "bmw", fa: ["بی‌ام‌و"], latin: ["bmw"] },
  { id: "benz", fa: ["بنز", "مرسدس"], latin: ["benz", "mercedes"] },
];
