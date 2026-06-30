/**
 * Egypt governorates — 27 محافظة.
 *
 * Source: Egyptian administrative divisions (official).
 * Used by buyer_profiles.governorate + addresses.governorate (VARCHAR 50).
 *
 * Each entry: `value` = the slug stored in the DB (English, stable),
 * `labelAr` = Arabic display name, `labelEn` = English display name.
 */

export interface Governorate {
  value: string;
  labelAr: string;
  labelEn: string;
}

export const GOVERNORATES: Governorate[] = [
  { value: "cairo", labelAr: "القاهرة", labelEn: "Cairo" },
  { value: "giza", labelAr: "الجيزة", labelEn: "Giza" },
  { value: "alexandria", labelAr: "الإسكندرية", labelEn: "Alexandria" },
  { value: "qalyubia", labelAr: "القليوبية", labelEn: "Qalyubia" },
  { value: "sharqia", labelAr: "الشرقية", labelEn: "Sharqia" },
  { value: "dakahlia", labelAr: "الدقهلية", labelEn: "Dakahlia" },
  { value: "gharbia", labelAr: "الغربية", labelEn: "Gharbia" },
  { value: "menofia", labelAr: "المنوفية", labelEn: "Menofia" },
  { value: "kafr_el_sheikh", labelAr: "كفر الشيخ", labelEn: "Kafr el-Sheikh" },
  { value: "beheira", labelAr: "البحيرة", labelEn: "Beheira" },
  { value: "damietta", labelAr: "دمياط", labelEn: "Damietta" },
  { value: "ismailia", labelAr: "الإسماعيلية", labelEn: "Ismailia" },
  { value: "port_said", labelAr: "بور سعيد", labelEn: "Port Said" },
  { value: "suez", labelAr: "السويس", labelEn: "Suez" },
  { value: "north_sinai", labelAr: "شمال سيناء", labelEn: "North Sinai" },
  { value: "south_sinai", labelAr: "جنوب سيناء", labelEn: "South Sinai" },
  { value: "matrouh", labelAr: "مطروح", labelEn: "Matrouh" },
  { value: "faiyum", labelAr: "الفيوم", labelEn: "Faiyum" },
  { value: "beni_suef", labelAr: "بني سويف", labelEn: "Beni Suef" },
  { value: "minya", labelAr: "المنيا", labelEn: "Minya" },
  { value: "asyut", labelAr: "أسيوط", labelEn: "Asyut" },
  { value: "sohag", labelAr: "سوهاج", labelEn: "Sohag" },
  { value: "qena", labelAr: "قنا", labelEn: "Qena" },
  { value: "luxor", labelAr: "الأقصر", labelEn: "Luxor" },
  { value: "aswan", labelAr: "أسوان", labelEn: "Aswan" },
  { value: "red_sea", labelAr: "البحر الأحمر", labelEn: "Red Sea" },
  { value: "new_valley", labelAr: "الوادي الجديد", labelEn: "New Valley" },
] as const;

/** All valid governorate values — used by Zod schema as the enum tuple. */
export const GOVERNORATE_VALUES = GOVERNORATES.map((g) => g.value) as [
  string,
  ...string[],
];
