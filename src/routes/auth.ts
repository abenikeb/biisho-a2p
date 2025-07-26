import express, { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { body, validationResult } from "express-validator";
import type {
	LoginRequest,
	RegisterRequest,
	JWTPayload,
	AuthResponse,
	ApiResponse,
	UserWithSubscription,
} from "../types/auth";

const router = express.Router();
const prisma = new PrismaClient();

// JWT secrets from environment
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
	process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";

// Generate tokens
const generateTokens = (
	user: UserWithSubscription
): { accessToken: string; refreshToken: string } => {
	const payload: JWTPayload = {
		id: user.id,
		email: user.email,
		role: user.role,
		status: user.status,
	};

	const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
	const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
		expiresIn: "7d",
	});

	return { accessToken, refreshToken };
};

// Register endpoint
router.post(
	"/register",
	[
		body("email").isEmail().normalizeEmail(),
		body("password").isLength({ min: 6 }),
		body("firstName").trim().isLength({ min: 1 }),
		body("lastName").trim().isLength({ min: 1 }),
		body("companyName").optional().trim(),
		body("companyPhone").optional().trim(),
		body("companyWebsite").optional().trim(),
		body("phone").optional().trim(),
	],
	async (req: Request, res: Response) => {
		try {
			// Check validation errors
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				const response: ApiResponse = {
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				};
				return res.status(400).json(response);
			}

			const {
				email,
				password,
				firstName,
				lastName,
				companyName,
				companyPhone,
				companyWebsite,
				phone,
			}: RegisterRequest = req.body;

			// Check if user already exists
			const existingUser = await prisma.user.findUnique({
				where: { email },
			});

			if (existingUser) {
				const response: ApiResponse = {
					success: false,
					message: "User with this email already exists",
				};
				return res.status(400).json(response);
			}

			// Hash password
			const hashedPassword = await bcrypt.hash(password, 12);

			// Create user with transaction to ensure data consistency
			const result = await prisma.$transaction(async (tx) => {
				// Create user
				const user = await tx.user.create({
					data: {
						email,
						password: hashedPassword,
						firstName,
						lastName,
						phone,
						companyName,
						companyPhone,
						companyWebsite,
						role: "CUSTOMER",
						status: "PENDING_VERIFICATION",
					},
				});

				// Create default subscription
				const subscription = await tx.subscription.create({
					data: {
						userId: user.id,
						plan: "STARTER",
						status: "ACTIVE",
						credits: 100, // Welcome credits
						monthlyLimit: 1000,
						pricePerCredit: 0.05,
					},
				});

				return { user, subscription };
			});

			// Generate tokens
			const { accessToken, refreshToken } = generateTokens(result.user);

			// Create audit log
			await prisma.auditLog.create({
				data: {
					userId: result.user.id,
					action: "user.registered",
					resource: "user",
					resourceId: result.user.id,
					details: {
						email: result.user.email,
						companyName: result.user.companyName,
					},
				},
			});

			// Create welcome notification
			await prisma.notification.create({
				data: {
					userId: result.user.id,
					title: "Welcome to Biisho A2P!",
					message:
						"Your account has been created successfully. You have received 100 welcome credits.",
					type: "success",
				},
			});

			// Return user data without password
			const { password: _, ...userWithoutPassword } = result.user;

			const response: ApiResponse<AuthResponse> = {
				success: true,
				message: "User registered successfully",
				data: {
					user: {
						...userWithoutPassword,
						subscription: result.subscription,
					},
					tokens: {
						accessToken,
						refreshToken,
					},
				},
			};

			res.status(201).json(response);
		} catch (error: any) {
			console.error("Registration error:", error);
			const response: ApiResponse = {
				success: false,
				message: "Internal server error during registration",
			};
			res.status(500).json(response);
		}
	}
);

// Login endpoint
router.post(
	"/login",
	[body("email").isEmail().normalizeEmail(), body("password").exists()],
	async (req: Request, res: Response) => {
		try {
			// Check validation errors
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				const response: ApiResponse = {
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				};
				return res.status(400).json(response);
			}

			const { email, password }: LoginRequest = req.body;

			// Find user with subscription
			const user = await prisma.user.findUnique({
				where: { email },
				include: {
					subscription: true,
				},
			});

			if (!user) {
				const response: ApiResponse = {
					success: false,
					message: "Invalid email or password",
				};
				return res.status(401).json(response);
			}

			// Check password
			const isPasswordValid = await bcrypt.compare(password, user.password);
			if (!isPasswordValid) {
				const response: ApiResponse = {
					success: false,
					message: "Invalid email or password",
				};
				return res.status(401).json(response);
			}

			// Check user status
			if (user.status === "SUSPENDED") {
				const response: ApiResponse = {
					success: false,
					message: "Your account has been suspended. Please contact support.",
				};
				return res.status(403).json(response);
			}

			if (user.status === "INACTIVE") {
				const response: ApiResponse = {
					success: false,
					message: "Your account is inactive. Please contact support.",
				};
				return res.status(403).json(response);
			}

			// Update last login
			await prisma.user.update({
				where: { id: user.id },
				data: { lastLoginAt: new Date() },
			});

			// Generate tokens
			const { accessToken, refreshToken } = generateTokens(user);

			// Create audit log
			await prisma.auditLog.create({
				data: {
					userId: user.id,
					action: "user.login",
					resource: "user",
					resourceId: user.id,
					details: {
						email: user.email,
						loginTime: new Date(),
					},
					ipAddress: req.ip,
					userAgent: req.get("User-Agent"),
				},
			});

			// Return user data without password
			const { password: _, ...userWithoutPassword } = user;

			const response: ApiResponse<AuthResponse> = {
				success: true,
				message: "Login successful",
				data: {
					user: userWithoutPassword,
					tokens: {
						accessToken,
						refreshToken,
					},
				},
			};

			res.json(response);
		} catch (error: any) {
			console.error("Login error:", error);
			const response: ApiResponse = {
				success: false,
				message: "Internal server error during login",
			};
			res.status(500).json(response);
		}
	}
);

// Refresh token endpoint
router.post("/refresh", async (req: Request, res: Response) => {
	try {
		const { refreshToken } = req.body;

		if (!refreshToken) {
			const response: ApiResponse = {
				success: false,
				message: "Refresh token is required",
			};
			return res.status(401).json(response);
		}

		// Verify refresh token
		const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JWTPayload;

		// Find user
		const user = await prisma.user.findUnique({
			where: { id: decoded.id },
			include: {
				subscription: true,
			},
		});

		if (!user) {
			const response: ApiResponse = {
				success: false,
				message: "Invalid refresh token",
			};
			return res.status(401).json(response);
		}

		// Generate new tokens
		const tokens = generateTokens(user);

		const response: ApiResponse<{ tokens: typeof tokens }> = {
			success: true,
			message: "Tokens refreshed successfully",
			data: {
				tokens,
			},
		};

		res.json(response);
	} catch (error: any) {
		console.error("Token refresh error:", error);
		const response: ApiResponse = {
			success: false,
			message: "Invalid refresh token",
		};
		res.status(401).json(response);
	}
});

// Get current user endpoint
router.get("/me", async (req: Request, res: Response) => {
	try {
		const token = req.headers.authorization?.replace("Bearer ", "");

		if (!token) {
			const response: ApiResponse = {
				success: false,
				message: "Access token is required",
			};
			return res.status(401).json(response);
		}

		// Verify token
		const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

		// Find user with related data
		const user = await prisma.user.findUnique({
			where: { id: decoded.id },
			include: {
				subscription: true,
				_count: {
					select: {
						messages: true,
						contacts: true,
						campaigns: true,
					},
				},
			},
		});

		if (!user) {
			const response: ApiResponse = {
				success: false,
				message: "User not found",
			};
			return res.status(401).json(response);
		}

		// Return user data without password
		const { password: _, ...userWithoutPassword } = user;

		const response: ApiResponse<{ user: typeof userWithoutPassword }> = {
			success: true,
			message: "User data retrieved successfully",
			data: {
				user: userWithoutPassword,
			},
		};

		res.json(response);
	} catch (error: any) {
		console.error("Get user error:", error);
		if (error.name === "JsonWebTokenError") {
			const response: ApiResponse = {
				success: false,
				message: "Invalid access token",
			};
			return res.status(401).json(response);
		}
		const response: ApiResponse = {
			success: false,
			message: "Internal server error",
		};
		res.status(500).json(response);
	}
});

// Logout endpoint
router.post("/logout", async (req: Request, res: Response) => {
	try {
		const token = req.headers.authorization?.replace("Bearer ", "");

		if (token) {
			try {
				const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

				// Create audit log
				await prisma.auditLog.create({
					data: {
						userId: decoded.id,
						action: "user.logout",
						resource: "user",
						resourceId: decoded.id,
						details: {
							logoutTime: new Date(),
						},
						ipAddress: req.ip,
						userAgent: req.get("User-Agent"),
					},
				});
			} catch (error: any) {
				// Token might be expired, but we still want to log out
				console.log("Token verification failed during logout:", error.message);
			}
		}

		const response: ApiResponse = {
			success: true,
			message: "Logged out successfully",
		};

		res.json(response);
	} catch (error: any) {
		console.error("Logout error:", error);
		const response: ApiResponse = {
			success: false,
			message: "Internal server error during logout",
		};
		res.status(500).json(response);
	}
});

// Verify email endpoint
router.post(
	"/verify-email",
	[body("token").exists()],
	async (req: Request, res: Response) => {
		try {
			const { token } = req.body;

			// In a real implementation, you would verify the email verification token
			// For now, we'll just mark the user as verified
			const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

			const user = await prisma.user.update({
				where: { id: decoded.id },
				data: {
					emailVerified: true,
					emailVerifiedAt: new Date(),
					status: "ACTIVE",
				},
			});

			// Create audit log
			await prisma.auditLog.create({
				data: {
					userId: user.id,
					action: "user.email_verified",
					resource: "user",
					resourceId: user.id,
					details: {
						verifiedAt: new Date(),
					},
				},
			});

			const response: ApiResponse = {
				success: true,
				message: "Email verified successfully",
			};

			res.json(response);
		} catch (error: any) {
			console.error("Email verification error:", error);
			const response: ApiResponse = {
				success: false,
				message: "Invalid verification token",
			};
			res.status(400).json(response);
		}
	}
);

// Request password reset
router.post(
	"/forgot-password",
	[body("email").isEmail().normalizeEmail()],
	async (req: Request, res: Response) => {
		try {
			const { email } = req.body;

			const user = await prisma.user.findUnique({
				where: { email },
			});

			if (!user) {
				// Don't reveal if user exists or not
				const response: ApiResponse = {
					success: true,
					message:
						"If an account with that email exists, a password reset link has been sent.",
				};
				return res.json(response);
			}

			// Generate reset token (in production, store this in database with expiration)
			const resetToken = jwt.sign(
				{ id: user.id, email: user.email },
				JWT_SECRET,
				{ expiresIn: "1h" }
			);

			// Create audit log
			await prisma.auditLog.create({
				data: {
					userId: user.id,
					action: "user.password_reset_requested",
					resource: "user",
					resourceId: user.id,
					details: {
						requestedAt: new Date(),
					},
					ipAddress: req.ip,
				},
			});

			// In production, send email with reset link
			console.log(`Password reset token for ${email}: ${resetToken}`);

			const response: ApiResponse = {
				success: true,
				message:
					"If an account with that email exists, a password reset link has been sent.",
			};

			res.json(response);
		} catch (error: any) {
			console.error("Password reset request error:", error);
			const response: ApiResponse = {
				success: false,
				message: "Internal server error",
			};
			res.status(500).json(response);
		}
	}
);

// Reset password
router.post(
	"/reset-password",
	[body("token").exists(), body("password").isLength({ min: 6 })],
	async (req: Request, res: Response) => {
		try {
			const { token, password } = req.body;

			// Verify reset token
			const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

			// Hash new password
			const hashedPassword = await bcrypt.hash(password, 12);

			// Update user password
			const user = await prisma.user.update({
				where: { id: decoded.id },
				data: { password: hashedPassword },
			});

			// Create audit log
			await prisma.auditLog.create({
				data: {
					userId: user.id,
					action: "user.password_reset",
					resource: "user",
					resourceId: user.id,
					details: {
						resetAt: new Date(),
					},
					ipAddress: req.ip,
				},
			});

			const response: ApiResponse = {
				success: true,
				message: "Password reset successfully",
			};

			res.json(response);
		} catch (error: any) {
			console.error("Password reset error:", error);
			if (error.name === "JsonWebTokenError") {
				const response: ApiResponse = {
					success: false,
					message: "Invalid or expired reset token",
				};
				return res.status(400).json(response);
			}
			const response: ApiResponse = {
				success: false,
				message: "Internal server error",
			};
			res.status(500).json(response);
		}
	}
);

export default router;
