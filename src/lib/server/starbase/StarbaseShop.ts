// ---
// Server-side starbase shop offers per user.
// ---

import type { HasLock4Context, IronLocks } from '@markdrei/ironguard-typescript-locks';
import { Commander, type CommanderData } from '../inventory/Commander';

export const SHOP_SIZE = 10;

export type ShopOffers = (CommanderData | null)[];

/**
 * Holds the current starbase offers of each user in memory.
 *
 * Offers used to live in the session cookie, which made a purchase replayable (re-sending the old
 * cookie bought the same commander again). Here a purchase removes the offer on the server.
 *
 * All access requires USER_LOCK (level 4): generating, reading and taking an offer are therefore
 * serialized with the iron check and deduction of a purchase. Offers are not persisted; after a
 * server restart the player simply visits the shop again.
 */
export class StarbaseShop {
  private static instance: StarbaseShop | null = null;
  private readonly offers = new Map<number, ShopOffers>();

  static getInstance(): StarbaseShop {
    if (!StarbaseShop.instance) {
      StarbaseShop.instance = new StarbaseShop();
    }
    return StarbaseShop.instance;
  }

  /** Drop all offers (tests). */
  static resetInstance(): void {
    StarbaseShop.instance = null;
  }

  /** Generates and stores a fresh set of random offers for the user. */
  generateOffers<THeld extends IronLocks>(context: HasLock4Context<THeld>, userId: number): ShopOffers {
    const offers = Array.from({ length: SHOP_SIZE }, () => Commander.random().toJSON());
    this.setOffers(context, userId, offers);
    return [...offers];
  }

  /** Replaces the user's offers (used by generateOffers and by tests for deterministic offers). */
  setOffers<THeld extends IronLocks>(_context: HasLock4Context<THeld>, userId: number, offers: ShopOffers): void {
    this.offers.set(userId, [...offers]);
  }

  /** Current offers of the user, or null when the user has not opened the shop yet. */
  getOffers<THeld extends IronLocks>(_context: HasLock4Context<THeld>, userId: number): ShopOffers | null {
    const offers = this.offers.get(userId);
    return offers ? [...offers] : null;
  }

  /** Removes and returns the offer in `slotIndex`, or null if the slot is empty or unknown. */
  takeOffer<THeld extends IronLocks>(_context: HasLock4Context<THeld>, userId: number, slotIndex: number): CommanderData | null {
    const offers = this.offers.get(userId);
    const offer = offers?.[slotIndex] ?? null;
    if (offers && offer) {
      offers[slotIndex] = null;
    }
    return offer;
  }

  /** Puts a taken offer back (purchase failed after takeOffer). */
  restoreOffer<THeld extends IronLocks>(_context: HasLock4Context<THeld>, userId: number, slotIndex: number, offer: CommanderData): void {
    const offers = this.offers.get(userId);
    if (offers && offers[slotIndex] === null) {
      offers[slotIndex] = offer;
    }
  }
}
