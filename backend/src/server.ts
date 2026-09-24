import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { seedSenders } from "./services/senderSeed";
import { reconcile } from "./queue/reconcile";
import { startWorker } from "./queue/worker";
import { scheduleRouter } from "./routes/schedule";
import { emailsRouter } from "./routes/emails";
import { sendersRouter } from "./routes/senders";

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/schedule", scheduleRouter);
  app.use("/api/emails", emailsRouter);
  app.use("/api/senders", sendersRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  await seedSenders();

  const recovered = await reconcile();
  console.log(`[startup] reconciliation recovered ${recovered} job(s)`);
  if (env.reconcileIntervalMs > 0) {
    setInterval(() => {
      reconcile().catch((err) => console.error("[reconcile] periodic sweep failed", err));
    }, env.reconcileIntervalMs);
  }

  startWorker();

  app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error("[server] fatal startup error", err);
  process.exit(1);
});
