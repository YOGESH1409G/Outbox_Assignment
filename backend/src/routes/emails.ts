import { Router } from "express";
import { prisma } from "../db/prisma";

export const emailsRouter = Router();

function parsePagination(req: import("express").Request) {
  const take = Math.min(Number(req.query.limit) || 50, 200);
  const skip = Number(req.query.offset) || 0;
  return { take, skip };
}

emailsRouter.get("/scheduled", async (req, res) => {
  const { take, skip } = parsePagination(req);
  const [items, total] = await Promise.all([
    prisma.scheduledEmail.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
      orderBy: { scheduledAt: "asc" },
      take,
      skip,
      include: { sender: { select: { email: true, name: true } } },
    }),
    prisma.scheduledEmail.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
  ]);
  res.json({ items, total });
});

emailsRouter.get("/sent", async (req, res) => {
  const { take, skip } = parsePagination(req);
  const [items, total] = await Promise.all([
    prisma.scheduledEmail.findMany({
      where: { status: { in: ["SENT", "FAILED"] } },
      orderBy: { sentAt: "desc" },
      take,
      skip,
      include: { sender: { select: { email: true, name: true } } },
    }),
    prisma.scheduledEmail.count({ where: { status: { in: ["SENT", "FAILED"] } } }),
  ]);
  res.json({ items, total });
});
