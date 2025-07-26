import express, { type Request, type Response } from "express";
import { authenticate, customerOrAdmin } from "../middleware/auth";
import type { ApiResponse } from "../types/auth";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(customerOrAdmin);

// Get contacts
router.get("/", async (req: Request, res: Response) => {
	try {
		const response: ApiResponse = {
			success: true,
			message: "Contacts retrieved successfully",
			data: {
				contacts: [],
				total: 0,
				page: 1,
				limit: 10,
				totalPages: 0,
			},
		};
		res.json(response);
	} catch (error: any) {
		console.error("Get contacts error:", error);
		const response: ApiResponse = {
			success: false,
			message: "Failed to retrieve contacts",
		};
		res.status(500).json(response);
	}
});

// Get contact lists
router.get("/lists", async (req: Request, res: Response) => {
	try {
		const response: ApiResponse = {
			success: true,
			message: "Contact lists retrieved successfully",
			data: {
				lists: [],
				total: 0,
				page: 1,
				limit: 10,
				totalPages: 0,
			},
		};
		res.json(response);
	} catch (error: any) {
		console.error("Get contact lists error:", error);
		const response: ApiResponse = {
			success: false,
			message: "Failed to retrieve contact lists",
		};
		res.status(500).json(response);
	}
});

export default router;
