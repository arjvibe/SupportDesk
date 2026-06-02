import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./routes/auth";
import clientsRouter from "./routes/clients";
import teamsRouter from "./routes/teams";
import staffRouter from "./routes/staff";
import slaRouter from "./routes/sla";
import rulesRouter from "./routes/rules";
import ticketsRouter from "./routes/tickets";
import notificationsRouter from "./routes/notifications";
import settingsRouter from "./routes/settings";
import superadminRouter from "./routes/superadmin";
import uploadsRouter from "./routes/uploads";
import reportsRouter from "./routes/reports";
import inboundEmailRouter from "./routes/inboundEmail";

import { resolveTenant } from "./middleware/tenant";
import { startWorker } from "./utils/worker";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      try {
        const url = new URL(origin);
        if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
          return callback(null, true);
        }
      } catch (err) {
        // invalid URL
      }
      if (origin === CORS_ORIGIN) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true, // Allow sharing cookies
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id"],
  })
);
app.use(express.json());

// Serve static uploads (accessible to tenant subdomains via top-level CORS)
// Intercept requests and return 403 Forbidden for files inside "/attachments/" directories
app.use("/uploads", (req, res, next) => {
  if (req.path.includes("/attachments/")) {
    return res.status(403).json({ error: "Access denied. Private resource." });
  }
  next();
}, express.static(path.join(__dirname, "../uploads")));

// Routes (All API routes resolved by tenant middleware)
app.use("/api/inbound-email", inboundEmailRouter);
app.use("/api", resolveTenant);
app.use("/api/auth", authRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/staff", staffRouter);
app.use("/api/sla", slaRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/superadmin", superadminRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/reports", reportsRouter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// Start listening
app.listen(PORT, () => {
  console.log(`🚀 SupportDesk Server running on port ${PORT}`);
  // Initialize background worker
  startWorker();
});
