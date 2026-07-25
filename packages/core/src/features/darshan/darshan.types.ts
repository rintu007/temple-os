export type DarshanTokenStatus = 'booked' | 'used' | 'cancelled';

export interface DarshanSlotSummary {
  id: string;
  name: string;
  slotDate: string;
  startTime: string;
  endTime: string | null;
  capacity: number;
  note: string | null;
  isActive: boolean;
  /** Sum of party sizes of booked tokens. */
  booked: number;
  remaining: number;
  createdAt: Date;
}

/** Public view of a bookable slot. */
export interface PublicDarshanSlot {
  id: string;
  name: string;
  slotDate: string;
  startTime: string;
  endTime: string | null;
  capacity: number;
  remaining: number;
}

export interface DarshanTokenSummary {
  id: string;
  tokenNumber: number;
  devoteeName: string;
  phone: string | null;
  email: string | null;
  partySize: number;
  status: DarshanTokenStatus;
  note: string | null;
  createdAt: Date;
}

/** Returned to a devotee after a successful booking. */
export interface BookedDarshanToken {
  tokenNumber: number;
  slotName: string;
  slotDate: string;
  startTime: string;
  partySize: number;
}
