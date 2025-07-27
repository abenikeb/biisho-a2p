import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../middleware/auth";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";

const router = express.Router();
router.use(authenticate);
const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB limit
	},
	fileFilter: (req, file, cb) => {
		if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
			cb(null, true);
		} else {
			cb(new Error("Only CSV files are allowed"));
		}
	},
});

// Get all contacts with filtering and pagination
router.get("/", async (req, res) => {
	try {
		const { page = "1", limit = "50", search, status, listId } = req.query;
		const pageNum = Number.parseInt(page as string);
		const limitNum = Number.parseInt(limit as string);
		const skip = (pageNum - 1) * limitNum;

		const where: any = {
			userId: req.user!.id,
		};

		if (search) {
			where.OR = [
				{ firstName: { contains: search as string, mode: "insensitive" } },
				{ lastName: { contains: search as string, mode: "insensitive" } },
				{ phone: { contains: search as string } },
				{ email: { contains: search as string, mode: "insensitive" } },
			];
		}

		if (status && status !== "all") {
			where.status = status;
		}

		if (listId && listId !== "all") {
			where.contactLists = {
				some: {
					listId: listId as string,
				},
			};
		}

		const [contacts, total] = await Promise.all([
			prisma.contact.findMany({
				where,
				skip,
				take: limitNum,
				orderBy: { createdAt: "desc" },
				include: {
					contactLists: {
						include: {
							list: true,
						},
					},
				},
			}),
			prisma.contact.count({ where }),
		]);

		const formattedContacts = contacts.map((contact) => ({
			id: contact.id,
			phone: contact.phone,
			firstName: contact.firstName,
			lastName: contact.lastName,
			email: contact.email,
			status: contact.status,
			tags: contact.tags,
			customFields: contact.customFields,
			createdAt: contact.createdAt,
			updatedAt: contact.updatedAt,
			lastContactedAt: contact.lastContactedAt,
			lists: contact.contactLists.map((cl) => cl.list),
		}));

		res.json({
			contacts: formattedContacts,
			total,
			page: pageNum,
			limit: limitNum,
			totalPages: Math.ceil(total / limitNum),
		});
	} catch (error) {
		console.error("Error fetching contacts:", error);
		res.status(500).json({ error: "Failed to fetch contacts" });
	}
});

// Get single contact
router.get("/:id", async (req, res) => {
	try {
		console.log({
			User: req.user!,
			ID: req.params.id,
		});
		const contact = await prisma.contact.findFirst({
			where: {
				id: req.params.id,
				userId: req.user!.id,
			},
			include: {
				contactLists: {
					include: {
						list: true,
					},
				},
			},
		});

		if (!contact) {
			return res.status(404).json({ error: "Contact not found" });
		}

		const formattedContact = {
			id: contact.id,
			phone: contact.phone,
			firstName: contact.firstName,
			lastName: contact.lastName,
			email: contact.email,
			status: contact.status,
			tags: contact.tags,
			customFields: contact.customFields,
			createdAt: contact.createdAt,
			updatedAt: contact.updatedAt,
			lastContactedAt: contact.lastContactedAt,
			lists: contact.contactLists.map((cl) => cl.list),
		};

		res.json(formattedContact);
	} catch (error) {
		console.error("Error fetching contact:", error);
		res.status(500).json({ error: "Failed to fetch contact" });
	}
});

// Create new contact
router.post("/", async (req, res) => {
	try {
		const {
			phone,
			firstName,
			lastName,
			email,
			tags = [],
			customFields = {},
			listIds = [],
		} = req.body;

		if (!phone) {
			return res.status(400).json({ error: "Phone number is required" });
		}

		// Check if contact already exists
		const existingContact = await prisma.contact.findFirst({
			where: {
				phone,
				userId: req.user!.id,
			},
		});

		if (existingContact) {
			return res
				.status(400)
				.json({ error: "Contact with this phone number already exists" });
		}

		// Create contact
		const contact = await prisma.contact.create({
			data: {
				phone,
				firstName: firstName || null,
				lastName: lastName || null,
				email: email || null,
				tags,
				customFields,
				userId: req.user!.id,
				status: "ACTIVE",
			},
		});

		// Add to contact lists if specified
		if (listIds.length > 0) {
			await prisma.contactListMember.createMany({
				data: listIds.map((listId: string) => ({
					contactId: contact.id,
					listId,
					userId: req.user!.id,
				})),
				skipDuplicates: true,
			});

			// Update contact counts
			await Promise.all(
				listIds.map((listId: string) =>
					prisma.contactList.update({
						where: { id: listId },
						data: {
							contactCount: {
								increment: 1,
							},
						},
					})
				)
			);
		}

		res.status(201).json({
			id: contact.id,
			phone: contact.phone,
			firstName: contact.firstName,
			lastName: contact.lastName,
			email: contact.email,
			status: contact.status,
			tags: contact.tags,
			customFields: contact.customFields,
			createdAt: contact.createdAt,
			updatedAt: contact.updatedAt,
			lastContactedAt: contact.lastContactedAt,
		});
	} catch (error) {
		console.error("Error creating contact:", error);
		res.status(500).json({ error: "Failed to create contact" });
	}
});

// Update contact
router.put("/:id", async (req, res) => {
	try {
		const { phone, firstName, lastName, email, tags, customFields, status } =
			req.body;

		const contact = await prisma.contact.findFirst({
			where: {
				id: req.params.id,
				userId: req.user!.id,
			},
		});

		if (!contact) {
			return res.status(404).json({ error: "Contact not found" });
		}

		const updatedContact = await prisma.contact.update({
			where: { id: req.params.id },
			data: {
				phone: phone || contact.phone,
				firstName: firstName !== undefined ? firstName : contact.firstName,
				lastName: lastName !== undefined ? lastName : contact.lastName,
				email: email !== undefined ? email : contact.email,
				tags: tags || contact.tags,
				customFields: customFields || contact.customFields,
				status: status || contact.status,
			},
		});

		res.json({
			id: updatedContact.id,
			phone: updatedContact.phone,
			firstName: updatedContact.firstName,
			lastName: updatedContact.lastName,
			email: updatedContact.email,
			status: updatedContact.status,
			tags: updatedContact.tags,
			customFields: updatedContact.customFields,
			createdAt: updatedContact.createdAt,
			updatedAt: updatedContact.updatedAt,
			lastContactedAt: updatedContact.lastContactedAt,
		});
	} catch (error) {
		console.error("Error updating contact:", error);
		res.status(500).json({ error: "Failed to update contact" });
	}
});

// Delete contact
router.delete("/:id", async (req, res) => {
	try {
		const contact = await prisma.contact.findFirst({
			where: {
				id: req.params.id,
				userId: req.user!.id,
			},
		});

		if (!contact) {
			return res.status(404).json({ error: "Contact not found" });
		}

		// Remove from contact lists and update counts
		const contactListMembers = await prisma.contactListMember.findMany({
			where: { contactId: contact.id },
		});

		if (contactListMembers.length > 0) {
			await prisma.contactListMember.deleteMany({
				where: { contactId: contact.id },
			});

			// Update contact counts
			await Promise.all(
				contactListMembers.map((member) =>
					prisma.contactList.update({
						where: { id: member.listId },
						data: {
							contactCount: {
								decrement: 1,
							},
						},
					})
				)
			);
		}

		await prisma.contact.delete({
			where: { id: req.params.id },
		});

		res.json({ message: "Contact deleted successfully" });
	} catch (error) {
		console.error("Error deleting contact:", error);
		res.status(500).json({ error: "Failed to delete contact" });
	}
});

// Get contact lists
router.get("/contact-list/lists", async (req, res) => {
	try {
		console.log({
			userId: req.user!.id,
		});
		const lists = await prisma.contactList.findMany({
			where: { userId: req.user!.id },
			orderBy: { createdAt: "desc" },
		});

		res.json({
			lists,
			total: lists.length,
			page: 1,
			limit: lists.length,
			totalPages: 1,
		});
	} catch (error) {
		console.error("Error fetching contact lists:", error);
		res.status(500).json({ error: "Failed to fetch contact lists" });
	}
});

// Create contact list
router.post("/lists", async (req, res) => {
	try {
		const { name, description } = req.body;

		if (!name) {
			return res.status(400).json({ error: "List name is required" });
		}

		const list = await prisma.contactList.create({
			data: {
				name,
				description: description || null,
				userId: req.user!.id,
				status: "ACTIVE",
				contactCount: 0,
			},
		});

		res.status(201).json(list);
	} catch (error) {
		console.error("Error creating contact list:", error);
		res.status(500).json({ error: "Failed to create contact list" });
	}
});

// Import contacts from CSV
router.post(
	"/import",
	authenticate,
	upload.single("file"),
	async (req, res) => {
		try {
			if (!req.file) {
				return res.status(400).json({ error: "No file uploaded" });
			}

			const { listId } = req.body;
			const results: any[] = [];
			const errors: string[] = [];
			let imported = 0;
			let failed = 0;

			// Parse CSV
			const stream = Readable.from(req.file.buffer);

			await new Promise((resolve, reject) => {
				stream
					.pipe(csv())
					.on("data", (data) => results.push(data))
					.on("end", resolve)
					.on("error", reject);
			});

			// Process each row
			for (const row of results) {
				try {
					const phone = row.phone || row.Phone || row.PHONE;
					if (!phone) {
						errors.push(`Row missing phone number: ${JSON.stringify(row)}`);
						failed++;
						continue;
					}

					// Check if contact already exists
					const existingContact = await prisma.contact.findFirst({
						where: {
							phone,
							userId: req.user!.id,
						},
					});

					if (existingContact) {
						errors.push(`Contact with phone ${phone} already exists`);
						failed++;
						continue;
					}

					// Create contact
					const contact = await prisma.contact.create({
						data: {
							phone,
							firstName:
								row.firstName || row.FirstName || row.first_name || null,
							lastName: row.lastName || row.LastName || row.last_name || null,
							email: row.email || row.Email || row.EMAIL || null,
							tags: [],
							customFields: {},
							userId: req.user!.id,
							status: "ACTIVE",
						},
					});

					// Add to list if specified
					if (listId) {
						await prisma.contactListMember.create({
							data: {
								contactId: contact.id,
								listId,
								userId: req.user!.id,
							},
						});

						await prisma.contactList.update({
							where: { id: listId },
							data: {
								contactCount: {
									increment: 1,
								},
							},
						});
					}

					imported++;
				} catch (error) {
					console.error("Error processing row:", error);
					errors.push(`Failed to process row: ${JSON.stringify(row)}`);
					failed++;
				}
			}

			res.json({
				imported,
				failed,
				errors: errors.slice(0, 10), // Return first 10 errors
			});
		} catch (error) {
			console.error("Error importing contacts:", error);
			res.status(500).json({ error: "Failed to import contacts" });
		}
	}
);

// Export contacts as CSV
router.get("/export", async (req, res) => {
	try {
		const { listId } = req.query;

		const where: any = {
			userId: req.user!.id,
		};

		if (listId) {
			where.contactLists = {
				some: {
					listId: listId as string,
				},
			};
		}

		const contacts = await prisma.contact.findMany({
			where,
			orderBy: { createdAt: "desc" },
		});

		// Generate CSV
		const csvHeader = "phone,firstName,lastName,email,status,tags,createdAt\n";
		const csvRows = contacts
			.map(
				(contact) =>
					`"${contact.phone}","${contact.firstName || ""}","${
						contact.lastName || ""
					}","${contact.email || ""}","${contact.status}","${contact.tags.join(
						";"
					)}","${contact.createdAt.toISOString()}"`
			)
			.join("\n");

		const csv = csvHeader + csvRows;

		res.setHeader("Content-Type", "text/csv");
		res.setHeader("Content-Disposition", 'attachment; filename="contacts.csv"');
		res.send(csv);
	} catch (error) {
		console.error("Error exporting contacts:", error);
		res.status(500).json({ error: "Failed to export contacts" });
	}
});

export default router;
