import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import type { JWTPayload, ApiResponse } from "../types/auth";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Authentication middleware
export const authenticate = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const token = req.headers.authorization?.replace("Bearer ", "");

		if (!token) {
			const response: ApiResponse = {
				success: false,
				message: "Access token is required",
			};
			res.status(401).json(response);
			return;
		}

		// Verify token
		const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

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
				message: "User not found",
			};
			res.status(401).json(response);
			return;
		}

		// Check user status
		if (user.status === "SUSPENDED") {
			const response: ApiResponse = {
				success: false,
				message: "Account suspended",
			};
			res.status(403).json(response);
			return;
		}

		if (user.status === "INACTIVE") {
			const response: ApiResponse = {
				success: false,
				message: "Account inactive",
			};
			res.status(403).json(response);
			return;
		}

		// Add user to request
		req.user = user;
		next();
	} catch (error: any) {
		console.error("Authentication error:", error);
		if (error.name === "JsonWebTokenError") {
			const response: ApiResponse = {
				success: false,
				message: "Invalid access token",
			};
			res.status(401).json(response);
			return;
		}
		const response: ApiResponse = {
			success: false,
			message: "Authentication failed",
		};
		res.status(500).json(response);
	}
};

// Authorization middleware
export const authorize = (...roles: string[]) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (!req.user) {
			const response: ApiResponse = {
				success: false,
				message: "Authentication required",
			};
			res.status(401).json(response);
			return;
		}

		if (!roles.includes(req.user.role)) {
			const response: ApiResponse = {
				success: false,
				message: "Insufficient permissions",
			};
			res.status(403).json(response);
			return;
		}

		next();
	};
};

// Admin only middleware
export const adminOnly = authorize("ADMIN");

// Customer or Admin middleware
export const customerOrAdmin = authorize("CUSTOMER", "ADMIN");
