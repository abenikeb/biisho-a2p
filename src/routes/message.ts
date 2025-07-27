import express, { type Request, type Response } from "express";
import { body, query, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { authenticate, customerOrAdmin } from "../middleware/auth";
import type { ApiResponse } from "../types/auth";
import type {
	CreateMessageRequest,
	UpdateMessageRequest,
	MessageFilters,
	MessagesResponse,
	Message,
	MessageTemplate,
	CreateTemplateRequest,
} from "../types/message";

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication to all routes
router.use(authenticate);
router.use(customerOrAdmin);

// Helper function to check user credits
const checkUserCredits = async (
	userId: string,
	requiredCredits: number
): Promise<boolean> => {
	const subscription = await prisma.subscription.findUnique({
		where: { userId },
	});

	if (!subscription) return false;

	const availableCredits =
		subscription.credits - (subscription.usedCredits || 0);
	return availableCredits >= requiredCredits;
};

// Helper function to calculate message credits
const calculateMessageCredits = (content: string): number => {
	const messageLength = content.length;
	return Math.ceil(messageLength / 160); // Each 160 characters = 1 credit
};

// Helper function to get recipients from contact lists
const getRecipientsFromLists = async (
	userId: string,
	contactListIds: string[]
) => {
	const contacts = await prisma.contact.findMany({
		where: {
			userId,
			status: "ACTIVE",
			contactLists: {
				some: {
					contactList: {
						id: {
							in: contactListIds,
						},
					},
				},
			},
		},
		select: {
			phone: true,
			firstName: true,
			lastName: true,
		},
	});

	return contacts;
};

// Get messages with filtering and pagination
router.get(
	"/",
	[
		query("page").optional().isInt({ min: 1 }),
		query("limit").optional().isInt({ min: 1, max: 100 }),
		query("status")
			.optional()
			.isIn([
				"DRAFT",
				"PENDING_APPROVAL",
				"APPROVED",
				"REJECTED",
				"SENT",
				"DELIVERED",
				"FAILED",
			]),
		query("messageType")
			.optional()
			.isIn(["PROMOTIONAL", "TRANSACTIONAL", "INFORMATIONAL"]),
		query("dateFrom").optional().isISO8601(),
		query("dateTo").optional().isISO8601(),
	],
	async (req: Request, res: Response) => {
		try {
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
				page = 1,
				limit = 10,
				status,
				messageType,
				dateFrom,
				dateTo,
				search,
				campaignId,
			}: MessageFilters = req.query as any;

			console.log({
				req: req.query,
			});

			const skip = (Number(page) - 1) * Number(limit);

			// Build where clause
			const where: any = {
				// userId: req.user!.id,
			};

			if (status) where.status = status;
			if (messageType) where.messageType = messageType;
			if (campaignId) where.campaignId = campaignId;

			if (dateFrom || dateTo) {
				where.createdAt = {};
				if (dateFrom) where.createdAt.gte = new Date(dateFrom);
				if (dateTo) where.createdAt.lte = new Date(dateTo);
			}

			if (search) {
				where.content = {
					contains: search,
					mode: "insensitive",
				};
			}

			console.log({
				where,
			});

			// Get messages with related data
			const [messages, total] = await Promise.all([
				prisma.message.findMany({
					where,
					include: {
						campaign: {
							select: {
								id: true,
								name: true,
							},
						},
						senderName: {
							select: {
								id: true,
								name: true,
							},
						},
						user: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								email: true,
							},
						},
					},
					orderBy: {
						createdAt: "desc",
					},
					skip,
					take: Number(limit),
				}),
				prisma.message.count({ where }),
			]);

			console.log({
				messages,
			});

			const totalPages = Math.ceil(total / Number(limit));

			const response: ApiResponse<MessagesResponse> = {
				success: true,
				message: "Messages retrieved successfully",
				data: {
					messages: messages as Message[],
					total,
					page: Number(page),
					limit: Number(limit),
					totalPages,
				},
			};

			return res.json(response);
		} catch (error: any) {
			console.error("Get messages error:", error);
			const response: ApiResponse = {
				success: false,
				message: "Failed to retrieve messages",
			};
			return res.status(500).json(response);
		}
	}
);

// Get single message by ID
router.get("/:id", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		const message = await prisma.message.findFirst({
			where: {
				id,
				userId: req.user!.id,
			},
			include: {
				campaign: {
					select: {
						id: true,
						name: true,
					},
				},
				senderName: {
					select: {
						id: true,
						name: true,
					},
				},
				recipients: {
					select: {
						id: true,
						phone: true,
						firstName: true,
						lastName: true,
						status: true,
						deliveredAt: true,
						failureReason: true,
					},
				},
			},
		});

		if (!message) {
			const response: ApiResponse = {
				success: false,
				message: "Message not found",
			};
			return res.status(404).json(response);
		}

		const response: ApiResponse<Message> = {
			success: true,
			message: "Message retrieved successfully",
			data: message as any,
		};

		return res.json(response);
	} catch (error: any) {
		console.error("Get message error:", error);
		const response: ApiResponse = {
			success: false,
			message: "Failed to retrieve message",
		};
		return res.status(500).json(response);
	}
});

// Create new message
router.post(
	"/",
	[
		body("content").trim().isLength({ min: 1, max: 1600 }),
		body("messageType").isIn(["PROMOTIONAL", "TRANSACTIONAL", "INFORMATIONAL"]),
		body("recipients").optional().isArray(),
		body("contactListIds").optional().isArray(),
		body("senderNameId").optional().isUUID(),
		body("scheduledAt").optional().isISO8601(),
		body("campaignId").optional().isUUID(),
	],
	async (req: Request, res: Response) => {
		try {
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
				content,
				messageType,
				recipients = [],
				contactListIds = [],
				senderNameId,
				scheduledAt,
				campaignId,
			}: CreateMessageRequest = req.body;

			// Validate that we have recipients
			if (recipients.length === 0 && contactListIds.length === 0) {
				const response: ApiResponse = {
					success: false,
					message: "At least one recipient or contact list must be specified",
				};
				return res.status(400).json(response);
			}

			// Get recipients from contact lists if provided
			let allRecipients: any = [...recipients];
			if (contactListIds.length > 0) {
				const listRecipients = await getRecipientsFromLists(
					req.user!.id,
					contactListIds
				);
				allRecipients = [...allRecipients, ...listRecipients];
			}

			// Remove duplicates based on phone number
			const uniqueRecipients = allRecipients.filter(
				(recipient: any, index: any, self: any) =>
					index === self.findIndex((r: any) => r.phone === recipient.phone)
			);

			if (uniqueRecipients.length === 0) {
				const response: ApiResponse = {
					success: false,
					message: "No valid recipients found",
				};
				return res.status(400).json(response);
			}

			// Calculate required credits
			const creditsPerMessage = calculateMessageCredits(content);
			const totalCreditsRequired = creditsPerMessage * uniqueRecipients.length;

			// Check if user has enough credits
			const hasEnoughCredits = await checkUserCredits(
				req.user!.id,
				totalCreditsRequired
			);
			if (!hasEnoughCredits) {
				const response: ApiResponse = {
					success: false,
					message: `Insufficient credits. Required: ${totalCreditsRequired}, but you don't have enough available credits.`,
				};
				return res.status(400).json(response);
			}

			// Validate sender name if provided
			if (senderNameId) {
				const senderName = await prisma.senderName.findFirst({
					where: {
						id: senderNameId,
						userId: req.user!.id,
						status: "APPROVED",
					},
				});

				if (!senderName) {
					const response: ApiResponse = {
						success: false,
						message: "Invalid or unapproved sender name",
					};
					return res.status(400).json(response);
				}
			}

			// Determine initial status based on message type and admin approval settings
			let initialStatus: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" = "DRAFT";

			if (messageType === "PROMOTIONAL") {
				// Check if admin approval is required for promotional messages
				const adminApprovalSetting = await prisma.systemSetting.findUnique({
					where: { key: "admin_approval_required" },
				});

				if (adminApprovalSetting?.value === "true") {
					initialStatus = "PENDING_APPROVAL";
				} else {
					initialStatus = "APPROVED";
				}
			} else {
				// Transactional and informational messages are auto-approved
				initialStatus = "APPROVED";
			}

			// Create message in transaction
			const result = await prisma.$transaction(async (tx) => {
				// Create the message
				const message = await tx.message.create({
					data: {
						content,
						messageType,
						status: initialStatus,
						totalRecipients: uniqueRecipients.length,
						deliveredCount: 0,
						failedCount: 0,
						userId: req.user!.id,
						senderNameId,
						campaignId,
						...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
					},
					include: {
						campaign: {
							select: {
								id: true,
								name: true,
							},
						},
						senderName: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				});

				// Create message recipients
				await tx.messageRecipient.createMany({
					data: uniqueRecipients.map((recipient: any) => ({
						messageId: message.id,
						phone: recipient.phone,
						firstName: recipient.firstName,
						lastName: recipient.lastName,
						status: "PENDING",
					})),
				});

				// Create audit log
				await tx.auditLog.create({
					data: {
						userId: req.user!.id,
						action: "message.created",
						resource: "message",
						resourceId: message.id,
						details: {
							messageType,
							recipientCount: uniqueRecipients.length,
							creditsRequired: totalCreditsRequired,
							status: initialStatus,
						},
					},
				});

				return message;
			});

			const response: ApiResponse<Message> = {
				success: true,
				message: "Message created successfully",
				data: result as Message,
			};

			return res.status(201).json(response);
		} catch (error: any) {
			console.error("Create message error:", error);
			const response: ApiResponse = {
				success: false,
				message: "Failed to create message",
			};
			return res.status(500).json(response);
		}
	}
);

// Update message
router.put(
	"/:id",
	[
		body("content").optional().trim().isLength({ min: 1, max: 1600 }),
		body("messageType")
			.optional()
			.isIn(["PROMOTIONAL", "TRANSACTIONAL", "INFORMATIONAL"]),
		body("scheduledAt").optional().isISO8601(),
		body("status")
			.optional()
			.isIn(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]),
	],
	async (req: Request, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				const response: ApiResponse = {
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				};
				return res.status(400).json(response);
			}

			const { id } = req.params;
			const updateData: UpdateMessageRequest = req.body;

			// Check if message exists and belongs to user
			const existingMessage = await prisma.message.findFirst({
				where: {
					id,
					userId: req.user!.id,
				},
			});

			if (!existingMessage) {
				const response: ApiResponse = {
					success: false,
					message: "Message not found",
				};
				return res.status(404).json(response);
			}

			// Check if message can be updated (only draft and pending approval messages)
			if (!["DRAFT", "PENDING_APPROVAL"].includes(existingMessage.status)) {
				const response: ApiResponse = {
					success: false,
					message: "Message cannot be updated in its current status",
				};
				return res.status(400).json(response);
			}

			// Update message
			const updatedMessage = await prisma.message.update({
				where: { id },
				data: {
					...updateData,
					...(updateData.scheduledAt && {
						scheduledAt: new Date(updateData.scheduledAt),
					}),
					updatedAt: new Date(),
				},
				include: {
					campaign: {
						select: {
							id: true,
							name: true,
						},
					},
					senderName: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			});

			// Create audit log
			await prisma.auditLog.create({
				data: {
					userId: req.user!.id,
					action: "message.updated",
					resource: "message",
					resourceId: id,
					// details: {
					// 	changes: updateData,
					// },
				},
			});

			const response: ApiResponse<Message> = {
				success: true,
				message: "Message updated successfully",
				data: updatedMessage as Message,
			};

			return res.json(response);
		} catch (error: any) {
			console.error("Update message error:", error);
			const response: ApiResponse = {
				success: false,
				message: "Failed to update message",
			};
			return res.status(500).json(response);
		}
	}
);

// Delete message
router.delete("/:id", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		// Check if message exists and belongs to user
		const existingMessage = await prisma.message.findFirst({
			where: {
				id,
				userId: req.user!.id,
			},
		});

		if (!existingMessage) {
			const response: ApiResponse = {
				success: false,
				message: "Message not found",
			};
			return res.status(404).json(response);
		}

		// Check if message can be deleted (only draft messages)
		if (existingMessage.status !== "DRAFT") {
			const response: ApiResponse = {
				success: false,
				message: "Only draft messages can be deleted",
			};
			return res.status(400).json(response);
		}

		// Delete message and its recipients
		await prisma.$transaction(async (tx) => {
			await tx.messageRecipient.deleteMany({
				where: { messageId: id },
			});

			await tx.message.delete({
				where: { id },
			});

			// Create audit log
			await tx.auditLog.create({
				data: {
					userId: req.user!.id,
					action: "message.deleted",
					resource: "message",
					resourceId: id,
					details: {
						messageType: existingMessage.messageType,
						content: existingMessage.content.substring(0, 100),
					},
				},
			});
		});

		const response: ApiResponse = {
			success: true,
			message: "Message deleted successfully",
		};

		return res.json(response);
	} catch (error: any) {
		console.error("Delete message error:", error);
		const response: ApiResponse = {
			success: false,
			message: "Failed to delete message",
		};
		return res.status(500).json(response);
	}
});

// Send message immediately
router.post("/:id/send", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		// Get message with recipients
		const message = await prisma.message.findFirst({
			where: {
				id,
				userId: req.user!.id,
			},
			include: {
				recipients: true,
			},
		});

		if (!message) {
			const response: ApiResponse = {
				success: false,
				message: "Message not found",
			};
			return res.status(404).json(response);
		}

		// Check if message can be sent
		if (!["APPROVED", "DRAFT"].includes(message.status)) {
			const response: ApiResponse = {
				success: false,
				message: "Message cannot be sent in its current status",
			};
			return res.status(400).json(response);
		}

		// Calculate required credits
		const creditsPerMessage = calculateMessageCredits(message.content);
		const totalCreditsRequired = creditsPerMessage * message.totalRecipients;

		// Check if user has enough credits
		const hasEnoughCredits = await checkUserCredits(
			req.user!.id,
			totalCreditsRequired
		);
		if (!hasEnoughCredits) {
			const response: ApiResponse = {
				success: false,
				message: `Insufficient credits. Required: ${totalCreditsRequired}`,
			};
			return res.status(400).json(response);
		}

		// Update message status and send
		const result = await prisma.$transaction(async (tx) => {
			// Update message status
			const updatedMessage = await tx.message.update({
				where: { id },
				data: {
					status: "SENT",
					sentAt: new Date(),
				},
				include: {
					campaign: {
						select: {
							id: true,
							name: true,
						},
					},
					senderName: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			});

			// Update recipients status (simulate sending)
			await tx.messageRecipient.updateMany({
				where: { messageId: id },
				data: {
					status: "SENT",
				},
			});

			// Deduct credits from user subscription
			await tx.subscription.update({
				where: { userId: req.user!.id },
				data: {
					usedCredits: {
						increment: totalCreditsRequired,
					},
				},
			});

			// Create transaction record
			await tx.transaction.create({
				data: {
					userId: req.user!.id,
					type: "CREDIT_USAGE",
					status: "COMPLETED",
					amount: -(totalCreditsRequired * 0.045), // Assuming 0.045 per credit
					credits: -totalCreditsRequired,
					description: `SMS Campaign - ${message.content.substring(0, 50)}...`,
					reference: `MSG-${id}`,
					messageId: id,
				},
			});

			// Create audit log
			await tx.auditLog.create({
				data: {
					userId: req.user!.id,
					action: "message.sent",
					resource: "message",
					resourceId: id,
					details: {
						recipientCount: message.totalRecipients,
						creditsUsed: totalCreditsRequired,
						sentAt: new Date(),
					},
				},
			});

			// Simulate delivery (in real implementation, this would be handled by SMS provider webhook)
			setTimeout(async () => {
				try {
					const deliveredCount = Math.floor(message.totalRecipients * 0.95); // 95% delivery rate
					const failedCount = message.totalRecipients - deliveredCount;

					await prisma.$transaction(async (tx) => {
						// Update message delivery stats
						await tx.message.update({
							where: { id },
							data: {
								status: "DELIVERED",
								deliveredCount,
								failedCount,
							},
						});

						// Update some recipients to delivered status
						const recipients = await tx.messageRecipient.findMany({
							where: { messageId: id },
							take: deliveredCount,
						});

						for (const recipient of recipients) {
							await tx.messageRecipient.update({
								where: { id: recipient.id },
								data: {
									status: "DELIVERED",
									deliveredAt: new Date(),
								},
							});
						}

						// Update remaining recipients to failed status
						if (failedCount > 0) {
							const failedRecipients = await tx.messageRecipient.findMany({
								where: {
									messageId: id,
									status: "SENT",
								},
								take: failedCount,
							});

							for (const recipient of failedRecipients) {
								await tx.messageRecipient.update({
									where: { id: recipient.id },
									data: {
										status: "FAILED",
										failureReason: "Network timeout",
									},
								});
							}
						}
					});
				} catch (error) {
					console.error("Error updating delivery status:", error);
				}
			}, 5000); // Simulate 5 second delivery delay

			return updatedMessage;
		});

		const response: ApiResponse<Message> = {
			success: true,
			message: "Message sent successfully",
			data: result as Message,
		};

		return res.json(response);
	} catch (error: any) {
		console.error("Send message error:", error);
		const response: ApiResponse = {
			success: false,
			message: "Failed to send message",
		};
		return res.status(500).json(response);
	}
});

// Get message analytics
router.get("/:id/analytics", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		// Check if message exists and belongs to user
		const message = await prisma.message.findFirst({
			where: {
				id,
				userId: req.user!.id,
			},
			include: {
				recipients: {
					select: {
						status: true,
						deliveredAt: true,
						failureReason: true,
					},
				},
			},
		});

		if (!message) {
			const response: ApiResponse = {
				success: false,
				message: "Message not found",
			};
			return res.status(404).json(response);
		}

		// Calculate analytics
		const analytics = {
			totalRecipients: message.totalRecipients,
			delivered: message.deliveredCount,
			failed: message.failedCount,
			pending: message.recipients.filter((r: any) => r.status === "PENDING")
				.length,
			sent: message.recipients.filter((r) => r.status === "SENT").length,
			deliveryRate:
				message.totalRecipients > 0
					? (message.deliveredCount / message.totalRecipients) * 100
					: 0,
			failureRate:
				message.totalRecipients > 0
					? (message.failedCount / message.totalRecipients) * 100
					: 0,
			creditsUsed:
				calculateMessageCredits(message.content) * message.totalRecipients,
			status: message.status,
			sentAt: message.sentAt,
			scheduledAt: message.scheduledAt,
			failureReasons: message.recipients
				.filter((r) => r.failureReason)
				.reduce((acc: any, r) => {
					acc[r.failureReason!] = (acc[r.failureReason!] || 0) + 1;
					return acc;
				}, {}),
		};

		const response: ApiResponse = {
			success: true,
			message: "Message analytics retrieved successfully",
			data: analytics,
		};

		return res.json(response);
	} catch (error: any) {
		console.error("Get message analytics error:", error);
		const response: ApiResponse = {
			success: false,
			message: "Failed to retrieve message analytics",
		};
		return res.status(500).json(response);
	}
});

// Get scheduled messages
router.get("/scheduled/list", async (req: Request, res: Response) => {
	try {
		const scheduledMessages = await prisma.message.findMany({
			where: {
				userId: req.user!.id,
				scheduledAt: {
					gt: new Date(),
				},
				status: {
					in: ["APPROVED", "DRAFT"],
				},
			},
			include: {
				campaign: {
					select: {
						id: true,
						name: true,
					},
				},
				senderName: {
					select: {
						id: true,
						name: true,
					},
				},
			},
			orderBy: {
				scheduledAt: "asc",
			},
		});

		const response: ApiResponse = {
			success: true,
			message: "Scheduled messages retrieved successfully",
			data: {
				messages: scheduledMessages,
				total: scheduledMessages.length,
			},
		};

		return res.json(response);
	} catch (error: any) {
		console.error("Get scheduled messages error:", error);
		const response: ApiResponse = {
			success: false,
			message: "Failed to retrieve scheduled messages",
		};
		return res.status(500).json(response);
	}
});

// Message Templates Routes

// Get templates
router.get("/templates/list", async (req: Request, res: Response) => {
	try {
		const templates = await prisma.messageTemplate.findMany({
			where: {
				userId: req.user!.id,
				isActive: true,
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		const response: ApiResponse = {
			success: true,
			message: "Templates retrieved successfully",
			data: {
				templates,
				total: templates.length,
			},
		};

		return res.json(response);
	} catch (error: any) {
		console.error("Get templates error:", error);
		const response: ApiResponse = {
			success: false,
			message: "Failed to retrieve templates",
		};
		return res.status(500).json(response);
	}
});

// Create template
router.post(
	"/templates",
	[
		body("name").trim().isLength({ min: 1, max: 100 }),
		body("content").trim().isLength({ min: 1, max: 1600 }),
		body("messageType").isIn(["PROMOTIONAL", "TRANSACTIONAL", "INFORMATIONAL"]),
	],
	async (req: Request, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				const response: ApiResponse = {
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				};
				return res.status(400).json(response);
			}

			const { name, content, messageType }: CreateTemplateRequest = req.body;

			// Check if template name already exists for this user
			const existingTemplate = await prisma.messageTemplate.findFirst({
				where: {
					userId: req.user!.id,
					name,
					isActive: true,
				},
			});

			if (existingTemplate) {
				const response: ApiResponse = {
					success: false,
					message: "Template with this name already exists",
				};
				return res.status(400).json(response);
			}

			const template = await prisma.messageTemplate.create({
				data: {
					name,
					content,
					messageType,
					userId: req.user!.id,
					isActive: true,
				},
			});

			// Create audit log
			await prisma.auditLog.create({
				data: {
					userId: req.user!.id,
					action: "template.created",
					resource: "template",
					resourceId: template.id,
					details: {
						name,
						messageType,
					},
				},
			});

			const response: ApiResponse<MessageTemplate> = {
				success: true,
				message: "Template created successfully",
				data: template,
			} as any;

			return res.status(201).json(response);
		} catch (error: any) {
			console.error("Create template error:", error);
			const response: ApiResponse = {
				success: false,
				message: "Failed to create template",
			};
			return res.status(500).json(response);
		}
	}
);

// Update template
router.put(
	"/templates/:id",
	[
		body("name").optional().trim().isLength({ min: 1, max: 100 }),
		body("content").optional().trim().isLength({ min: 1, max: 1600 }),
		body("messageType")
			.optional()
			.isIn(["PROMOTIONAL", "TRANSACTIONAL", "INFORMATIONAL"]),
	],
	async (req: Request, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				const response: ApiResponse = {
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				};
				return res.status(400).json(response);
			}

			const { id } = req.params;
			const updateData = req.body;

			// Check if template exists and belongs to user
			const existingTemplate = await prisma.messageTemplate.findFirst({
				where: {
					id,
					userId: req.user!.id,
					isActive: true,
				},
			});

			if (!existingTemplate) {
				const response: ApiResponse = {
					success: false,
					message: "Template not found",
				};
				return res.status(404).json(response);
			}

			const updatedTemplate = await prisma.messageTemplate.update({
				where: { id },
				data: {
					...updateData,
					updatedAt: new Date(),
				},
			});

			// Create audit log
			await prisma.auditLog.create({
				data: {
					userId: req.user!.id,
					action: "template.updated",
					resource: "template",
					resourceId: id,
					details: {
						changes: updateData,
					},
				},
			});

			const response: ApiResponse<MessageTemplate> = {
				success: true,
				message: "Template updated successfully",
				data: updatedTemplate,
			} as any;

			return res.json(response);
		} catch (error: any) {
			console.error("Update template error:", error);
			const response: ApiResponse = {
				success: false,
				message: "Failed to update template",
			};
			return res.status(500).json(response);
		}
	}
);

// Delete template
router.delete("/templates/:id", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		// Check if template exists and belongs to user
		const existingTemplate = await prisma.messageTemplate.findFirst({
			where: {
				id,
				userId: req.user!.id,
				isActive: true,
			},
		});

		if (!existingTemplate) {
			const response: ApiResponse = {
				success: false,
				message: "Template not found",
			};
			return res.status(404).json(response);
		}

		// Soft delete template
		await prisma.messageTemplate.update({
			where: { id },
			data: {
				isActive: false,
				updatedAt: new Date(),
			},
		});

		// Create audit log
		await prisma.auditLog.create({
			data: {
				userId: req.user!.id,
				action: "template.deleted",
				resource: "template",
				resourceId: id,
				details: {
					name: existingTemplate.name,
				},
			},
		});

		const response: ApiResponse = {
			success: true,
			message: "Template deleted successfully",
		};

		return res.json(response);
	} catch (error: any) {
		console.error("Delete template error:", error);
		const response: ApiResponse = {
			success: false,
			message: "Failed to delete template",
		};
		return res.status(500).json(response);
	}
});

export default router;
