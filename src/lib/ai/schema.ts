import { z } from "zod";

/**
 * AI kupon çıktı şeması — Zod ile doğrulanmadan database'e YAZILMAZ.
 * Belirsiz alan null + needs_review=true; veri uydurmak yasak.
 */

export const CouponBetSchema = z
  .object({
    row: z.number().int().min(1).max(30),
    homeTeam: z.string().min(1).max(60),
    awayTeam: z.string().min(1).max(60),
    league: z.string().max(60).nullable(),
    market: z.string().min(1).max(40),
    selection: z.string().min(1).max(40),
    printedOdds: z.number().positive().max(1000).nullable(),
    confidence: z.number().min(0).max(1),
    needsReview: z.boolean(),
  })
  .refine((b) => b.printedOdds !== null || b.needsReview, {
    message: "Okunamayan oran needs_review=true gerektirir.",
  });

export const CouponParseSchema = z.object({
  bets: z.array(CouponBetSchema).max(30),
  physicalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  physicalTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  printedTotalOdds: z.number().positive().max(100000).nullable(),
  stakeAmount: z.string().regex(/^\d{1,8}\.\d{2}$/).nullable(),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
});

export type CouponBetParse = z.infer<typeof CouponBetSchema>;
export type CouponParse = z.infer<typeof CouponParseSchema>;
