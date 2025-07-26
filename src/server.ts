import express, {
	type Application,
	type Request,
	type Response,
	type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// Import routes
import authRoutes from "./routes/auth";
import messageRoutes from "./routes/message";
import contactRoutes from "./routes/contacts";
import analyticsRoutes from "./routes/analytics";

// Load environment variables
dotenv.config();

const app: Application = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(
	cors({
		origin: process.env.FRONTEND_URL || "http://localhost:5173",
		credentials: true,
	})
);

// Rate limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // limit each IP to 100 requests per windowMs
	message: {
		success: false,
		message: "Too many requests from this IP, please try again later.",
	},
});

app.use("/api", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy for accurate IP addresses
app.set("trust proxy", 1);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health check endpoint
app.get("/api/health", async (req: Request, res: Response) => {
	try {
		// Test database connection
		await prisma.$queryRaw`SELECT 1`;

		res.json({
			success: true,
			message: "Server is healthy",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		});
	} catch (error: any) {
		res.status(503).json({
			success: false,
			message: "Database connection failed",
			error: error.message,
		});
	}
});

// 404 handler
app.use("*", (req: Request, res: Response) => {
	res.status(404).json({
		success: false,
		message: "Route not found",
	});
});

// Global error handler
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
	console.error("Global error handler:", error);

	res.status(error.status || 500).json({
		success: false,
		message: error.message || "Internal server error",
		...(process.env.NODE_ENV === "development" && { stack: error.stack }),
	});
});

// Graceful shutdown
process.on("SIGINT", async () => {
	console.log("Shutting down gracefully...");
	await prisma.$disconnect();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	console.log("Shutting down gracefully...");
	await prisma.$disconnect();
	process.exit(0);
});

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
	console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
