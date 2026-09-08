import { z } from "zod";

export const HEARD_VIA_CHOICES = [
  "TikTok",
  "X",
  "Reddit",
  "YouTube",
  "Friend",
  "Search",
  "Other",
] as const;

export const heardViaSchema = z.enum(HEARD_VIA_CHOICES);

export const optionalSignupAttributionSchema = z.object({
  heardVia: z.union([heardViaSchema, z.literal("")]).optional(),
  heardViaOther: z.string().trim().max(200, "Please keep your answer under 200 characters").optional(),
}).superRefine((value, ctx) => {
  if (value.heardVia === "Other" && !value.heardViaOther) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["heardViaOther"],
      message: "Please tell us where you heard about FamilyRoots",
    });
  }
});

export type SignupAttributionInput = z.infer<typeof optionalSignupAttributionSchema>;

export function normalizeSignupAttribution(input: SignupAttributionInput) {
  return {
    heardVia: input.heardVia || null,
    heardViaOther: input.heardVia === "Other" ? input.heardViaOther?.trim() || null : null,
  };
}