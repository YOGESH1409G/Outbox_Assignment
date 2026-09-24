import { Router } from "express";
import { z } from "zod";
import { createCampaign } from "../services/schedulerService";

export const scheduleRouter = Router();

const scheduleSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  senderId: z.string().uuid(),
  recipients: z.array(z.string().email()).min(1),
  startTime: z.coerce.date(),
  delayMs: z.number().int().min(0),
  hourlyLimit: z.number().int().min(0).optional(),
});

scheduleRouter.post("/", async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }

  const result = await createCampaign(parsed.data);
  res.status(201).json(result);
});
