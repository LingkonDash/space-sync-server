// ── Domain types ───────────────────────────────────────────────────────────
export type CategoryCode = "co-working" | "meeting-room" | "event-hall" | "studio";
export type CategoryLabel = "Co-working" | "Meeting Room" | "Event Hall" | "Studio";
export type SpaceStatus = "pending" | "approved" | "rejected";


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