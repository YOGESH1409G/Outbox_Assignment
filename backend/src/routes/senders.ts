import { Router } from "express";
import { prisma } from "../db/prisma";

export const sendersRouter = Router();

sendersRouter.get("/", async (_req, res) => {
  const senders = await prisma.sender.findMany({
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ items: senders });
});
