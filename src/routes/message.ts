import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
	authenticate,
	authorize,
	AuthenticatedRequest,
} from "../middleware/auth";
import {
	createMessageSchema,
	updateMessageSchema,
} from "../validation/message.validation";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get user's messages
router.get("/", async (req: AuthenticatedRequest, res, next) => {
	try {
		const { page = 1, limit = 10, status, messageType } = req.query;
		const skip = (Number(page) - 1) * Number(limit);

		const where: any = {
			userId: req.user!.id,
		};

		if (status) {
			where.status = status;
		}

		if (messageType) {
			where.messageType = messageType;
		}

		const [messages, total] = await Promise.all([
			prisma.message.findMany({
				where,
				include: {
					senderName: true,
					template: true,
					recipients: {
						select: {
							id: true,
							phone: true,
							status: true,
							deliveredAt: true,
							failedAt: true,
							failureReason: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
				skip,
				take: Number(limit),
			}),
			prisma.message.count({ where }),
		]);

		res.json({
			success: true,
			data: {
				messages,
				pagination: {
					page: Number(page),
					limit: Number(limit),
					total,
					pages: Math.ceil(total / Number(limit)),
				},
			},
		});
	} catch (error) {
		next(error);
	}
});

// Create message
router.post("/", async (req: AuthenticatedRequest, res, next) => {
	try {
		const { error, value } = createMessageSchema.validate(req.body);

		if (error) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: error.details.map((detail) => detail.message),
			});
		}

		const {
			content,
			messageType,
			senderNameId,
			templateId,
			scheduledAt,
			recipients,
		} = value;

		// Check user's credit balance
		const subscription = await prisma.subscription.findUnique({
			where: { userId: req.user!.id },
		});

		if (!subscription || subscription.credits < recipients.length) {
			return res.status(400).json({
				success: false,
				message: "Insufficient credits",
			});
		}

		// Validate sender name belongs to user
		if (senderNameId) {
			const senderName = await prisma.senderName.findFirst({
				where: {
					id: senderNameId,
					userId: req.user!.id,
					status: "APPROVED",
				},
			});

			if (!senderName) {
				return res.status(400).json({
					success: false,
					message: "Invalid or unapproved sender name",
				});
			}
		}

		// Create message
		const message = await prisma.message.create({
			data: {
				userId: req.user!.id,
				content,
				messageType,
				senderNameId,
				templateId,
				scheduledAt,
				totalRecipients: recipients.length,
				status: scheduledAt ? "SCHEDULED" : "PENDING_APPROVAL",
				recipients: {
					create: recipients.map((recipient: any) => ({
						phone: recipient.phone,
						firstName: recipient.firstName,
						lastName: recipient.lastName,
						status: "SCHEDULED",
					})),
				},
			},
			include: {
				senderName: true,
				recipients: true,
			},
		});

		res.status(201).json({
			success: true,
			message: "Message created successfully",
			data: { message },
		});
	} catch (error) {
		next(error);
	}
});

// Get message by ID
router.get("/:id", async (req: AuthenticatedRequest, res, next) => {
	try {
		const message = await prisma.message.findFirst({
			where: {
				id: req.params.id,
				userId: req.user!.id,
			},
			include: {
				senderName: true,
				template: true,
				recipients: true,
			},
		});

		if (!message) {
			return res.status(404).json({
				success: false,
				message: "Message not found",
			});
		}

		res.json({
			success: true,
			data: { message },
		});
	} catch (error) {
		next(error);
	}
});

// Update message
router.put("/:id", async (req: AuthenticatedRequest, res, next) => {
	try {
		const { error, value } = updateMessageSchema.validate(req.body);

		if (error) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors: error.details.map((detail) => detail.message),
			});
		}

		const message = await prisma.message.findFirst({
			where: {
				id: req.params.id,
				userId: req.user!.id,
				status: { in: ["DRAFT", "SCHEDULED"] },
			},
		});

		if (!message) {
			return res.status(404).json({
				success: false,
				message: "Message not found or cannot be updated",
			});
		}

		const updatedMessage = await prisma.message.update({
			where: { id: req.params.id },
			data: value,
			include: {
				senderName: true,
				recipients: true,
			},
		});

		res.json({
			success: true,
			message: "Message updated successfully",
			data: { message: updatedMessage },
		});
	} catch (error) {
		next(error);
	}
});

// Delete message
router.delete("/:id", async (req: AuthenticatedRequest, res, next) => {
	try {
		const message = await prisma.message.findFirst({
			where: {
				id: req.params.id,
				userId: req.user!.id,
				status: { in: ["DRAFT", "SCHEDULED"] },
			},
		});

		if (!message) {
			return res.status(404).json({
				success: false,
				message: "Message not found or cannot be deleted",
			});
		}

		await prisma.message.delete({
			where: { id: req.params.id },
		});

		res.json({
			success: true,
			message: "Message deleted successfully",
		});
	} catch (error) {
		next(error);
	}
});

// export { router as messageRoutes };
export default router;
