import dotenv from "dotenv";

dotenv.config();

export const config = {
	// Server
	port: parseInt(process.env.PORT || "3000", 10),
	nodeEnv: process.env.NODE_ENV || "development",

	// Database
	databaseUrl: process.env.DATABASE_URL!,

	// JWT
	jwtSecret: process.env.JWT_SECRET!,
	jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
	jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
	jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",

	// Encryption
	bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12", 10),

	// Email
	smtp: {
		host: process.env.SMTP_HOST!,
		port: parseInt(process.env.SMTP_PORT || "587", 10),
		user: process.env.SMTP_USER!,
		pass: process.env.SMTP_PASS!,
	},

	// SMS Provider
	sms: {
		apiKey: process.env.SMS_PROVIDER_API_KEY!,
		apiUrl: process.env.SMS_PROVIDER_URL!,
	},

	// Rate Limiting
	rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
	rateLimitMaxRequests: parseInt(
		process.env.RATE_LIMIT_MAX_REQUESTS || "100",
		10
	),

	// File Upload
	maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880", 10),
	uploadPath: process.env.UPLOAD_PATH || "./uploads",

	// CORS
	corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",

	// Admin
	adminEmail: process.env.ADMIN_EMAIL || "admin@biisho.com",
	adminPassword: process.env.ADMIN_PASSWORD || "admin123",
};

// Validate required environment variables
const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"];

for (const envVar of requiredEnvVars) {
	if (!process.env[envVar]) {
		throw new Error(`Missing required environment variable: ${envVar}`);
	}
}
