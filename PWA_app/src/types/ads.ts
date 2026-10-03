export interface DivarAd {
  id: string;
  title: string;
  description: string;
  price: number | null;
  priceText?: string;
  city: string;
  neighborhood?: string;
  category: string;
  categoryId?: string;
  images: string[];
  thumbnail?: string;
  createdAt: string;
  updatedAt?: string;
  raw?: Record<string, unknown>;
}

export interface ShekarAd extends DivarAd {
  shekarScore: number;
  smartTags: string[];
  matchReasons?: string[];
}
