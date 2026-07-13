// ── Domain types ───────────────────────────────────────────────────────────
export type CategoryCode = "co-working" | "meeting-room" | "event-hall" | "studio";
export type CategoryLabel = "Co-working" | "Meeting Room" | "Event Hall" | "Studio";
export type SpaceStatus = "pending" | "approved" | "rejected";
export type UserRole = "user" | "host" | "admin";
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

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


export interface Booking {
  _id?: string;
  spaceId: string;
  userId: string;
  userEmail: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: BookingStatus;
  createdAt?: Date;
}

export interface Review {
  _id?: string;
  spaceId: string;
  userId: string;
  userName: string;
  bookingId: string;
  rating: number;
  comment: string;
  createdAt?: Date;
}

// ── JWT payload shape (from Better Auth's JWKS-signed token) ────────────────
export interface JwtUserPayload {
  id: string;
  email: string;
  userRole: UserRole;
  [key: string]: unknown; // jose's JWTPayload has other standard claims (iat, exp, etc.)
}

// ── Extend Express's Request to carry a typed `user` ─────────────────────────
export interface AuthedRequest extends Request {
  user?: JwtUserPayload;
}