Data Models

Logical models for Shekar. Actual TypeScript interfaces / Prisma / Supabase schemas should follow these shapes closely.

1. External Data (from divar-mcp)

We do not own or persist the full Divar catalog. We only cache short-lived results when useful.

DivarAd

interface DivarAd {
  id: string;                    // Divar token / unique id
  title: string;
  description: string;           // Full text – critical for filtering
  price: number | null;
  priceText?: string;
  city: string;
  neighborhood?: string;
  category: string;
  categoryId?: string;
  images: string[];              // URLs
  thumbnail?: string;
  createdAt: string;             // ISO or Divar format
  updatedAt?: string;
  raw?: Record<string, unknown>; // Keep original payload when useful
}

ShekarAd (enriched)

interface ShekarAd extends DivarAd {
  shekarScore: number;           // 0–100
  smartTags: string[];           // e.g. ["high-match", "good-price", "new"]
  matchReasons?: string[];       // optional debug / UI hints
}

2. Own Database Models

User

interface User {
  id: string;                    // UUID
  mobile: string;                // Unique
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  subscriptionStatus: "none" | "trial" | "active" | "expired";
  subscriptionExpiresAt?: Date;
  notificationEnabled?: boolean;
}

SavedSearch

interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  query?: string;
  category?: string;
  categoryId?: string;
  city?: string;
  neighborhood?: string;
  priceMin?: number;
  priceMax?: number;
  includeKeywords: string[];
  excludeKeywords: string[];
  extraFilters?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  lastMatchCount?: number;
  isActive: boolean;             // for notification polling
}

Favorite

interface Favorite {
  id: string;
  userId: string;
  adId: string;                  // Divar ad id
  title: string;                 // Snapshot
  price?: number;
  thumbnail?: string;
  city?: string;
  savedAt: Date;
  lastScore?: number;
}

Notification (P1)

interface Notification {
  id: string;
  userId: string;
  type: "new_ad_match" | "system";
  title: string;
  body: string;
  relatedAdId?: string;
  relatedSavedSearchId?: string;
  read: boolean;
  createdAt: Date;
}

3. Session / Auth





Managed by the chosen auth layer (NextAuth-style, Supabase Auth, or custom JWT + httpOnly cookie).



Minimum claims: userId, mobile.

4. Caching (Ephemeral)

interface CachedSearch {
  cacheKey: string;              // hash of search params
  results: ShekarAd[];
  fetchedAt: Date;
  expiresAt: Date;
}

5. Relationships





User 1 ── * SavedSearch



User 1 ── * Favorite



User 1 ── * Notification

6. Implementation Notes





Sanitize all user-generated text (search names, keywords).



Ad snapshots in Favorites help when the original ad disappears from Divar.



includeKeywords / excludeKeywords stored as arrays of normalized strings.



Recommended indexes:





users.mobile (unique)



saved_searches.userId



favorites.userId + adId (unique constraint)



favorites.adId (for cleanup jobs if needed)

