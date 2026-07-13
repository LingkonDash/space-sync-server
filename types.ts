// ── Domain types ───────────────────────────────────────────────────────────
export type CategoryCode = "co-working" | "meeting-room" | "event-hall" | "studio";
export type CategoryLabel = "Co-working" | "Meeting Room" | "Event Hall" | "Studio";
export type SpaceStatus = "pending" | "approved" | "rejected";
export type UserRole = "user" | "host" | "admin";


export interface Space {
  _id?: string;
  title: string;
  shortDescription: string;
  fullDescription?: string;
  images: string[];
  categoryCode: CategoryCode;
  category: CategoryLabel;
  location: string;
  hostEmail: string;
  hostName: string;
  city: string;
  pricePerHour: number;
  capacity: number;
  amenities?: string[];
  rating: number;
  reviewCount: number;
  status: SpaceStatus;
  createdAt?: Date;
}

// ── JWT payload shape (from Better Auth's JWKS-signed token) ────────────────
export interface JwtUserPayload {
  id: string;
  email: string;
  role: UserRole;
  [key: string]: unknown; // jose's JWTPayload has other standard claims (iat, exp, etc.)
}

// ── Extend Express's Request to carry a typed `user` ─────────────────────────
export interface AuthedRequest extends Request {
  user?: JwtUserPayload;
}