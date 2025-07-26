import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { config } from "../config/config";

export interface AppError extends Error {
	statusCode?: number;
	isOperational?: boolean;
}

export const errorHandler = (
	error: AppError,
	req: Request,
	res: Response,
	next: NextFunction
) => {
	let statusCode = error.statusCode || 500;
	let message = error.message || "Internal Server Error";

	// Prisma errors
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		switch (error.code) {
			case "P2002":
				statusCode = 409;
				message = "Resource already exists";
				break;
			case "P2025":
				statusCode = 404;
				message = "Resource not found";
				break;
			default:
				statusCode = 400;
				message = "Database operation failed";
		}
	}

	// Validation errors
	if (error.name === "ValidationError") {
		statusCode = 400;
		message = "Validation failed";
	}

	// JWT errors
	if (error.name === "JsonWebTokenError") {
		statusCode = 401;
		message = "Invalid token";
	}

	if (error.name === "TokenExpiredError") {
		statusCode = 401;
		message = "Token expired";
	}

	// Log error in development
	if (config.nodeEnv === "development") {
		console.error("Error:", error);
	}

	res.status(statusCode).json({
		success: false,
		message,
		...(config.nodeEnv === "development" && { stack: error.stack }),
	});
};
