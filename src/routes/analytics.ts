import express, { type Request, type Response } from "express";
import { authenticate, customerOrAdmin } from "../middleware/auth";
import type { ApiResponse } from "../types/auth";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(customerOrAdmin);

// Get dashboard metrics
router.get("/dashboard", async (req: Request, res: Response) => {
	try {
		const response: ApiResponse = {
			success: true,
			message: "Dashboard metrics retrieved successfully",
			data: {
				totalMessages: {
					value: 1250,
					change: "+12.5%",
					trend: "up",
				},
				deliveryRate: {
					value: "98.7%",
					change: "+0.3%",
					trend: "up",
				},
				activeContacts: {
					value: 8429,
					change: "+5.2%",
					trend: "up",
				},
				creditsBalance: {
					value: 3750,
					change: "-8.1%",
					trend: "down",
				},
			},
		};
		res.json(response);
	} catch (error: any) {
		console.error("Get dashboard metrics error:", error);
		const response: ApiResponse = {
			success: false,
			message: "Failed to retrieve dashboard metrics",
		};
		res.status(500).json(response);
	}
});

export default router;
