import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	console.log("🌱 Starting database seeding...");

	// Create admin user
	const adminPassword = await bcrypt.hash("admin123", 10);
	const admin = await prisma.user.upsert({
		where: { email: "admin@biisho.com" },
		update: {},
		create: {
			email: "admin@biisho.com",
			password: adminPassword,
			firstName: "Admin",
			lastName: "User",
			role: "ADMIN",
			// credits: 10000,
		},
	});

	// Create demo customer
	const customerPassword = await bcrypt.hash("demo123", 10);
	const customer = await prisma.user.upsert({
		where: { email: "customer@example.com" },
		update: {},
		create: {
			email: "customer@example.com",
			password: customerPassword,
			firstName: "password",
			lastName: "Customer",
			role: "CUSTOMER",
			// credits: 1000,
		},
	});

	console.log("✅ Users created");

	// Create subscription for customer
	await prisma.subscription.upsert({
		where: { userId: customer.id },
		update: {},
		create: {
			userId: customer.id,
			plan: "BUSINESS",
			status: "ACTIVE",
			credits: 5000,
			usedCredits: 1250,
			monthlyLimit: 10000,
			pricePerCredit: 0.045,
		},
	});

	// Create contact lists for demo customer
	const vipList = await prisma.contactList.create({
		data: {
			name: "VIP Customers",
			description: "High-value customers with premium status",
			userId: customer.id,
			contactCount: 0,
		},
	});

	const prospectsList = await prisma.contactList.create({
		data: {
			name: "Prospects",
			description: "Potential customers from marketing campaigns",
			userId: customer.id,
			contactCount: 0,
		},
	});

	const newsletterList = await prisma.contactList.create({
		data: {
			name: "Newsletter Subscribers",
			description: "Users subscribed to our newsletter",
			userId: customer.id,
			contactCount: 0,
		},
	});

	console.log("✅ Contact lists created");

	// Create sample contacts
	const sampleContacts = [
		{
			phone: "+251911234567",
			firstName: "Abebe",
			lastName: "Bekele",
			email: "abebe.bekele@example.com",
			tags: ["customer", "vip"],
			lists: [vipList.id, newsletterList.id],
		},
		{
			phone: "+251922345678",
			firstName: "Marta",
			lastName: "Kebede",
			email: "marta.kebede@example.com",
			tags: ["prospect", "marketing"],
			lists: [prospectsList.id],
		},
		{
			phone: "+251933456789",
			firstName: "Getahun",
			lastName: "Tadesse",
			email: "getahun.tadesse@example.com",
			tags: ["customer"],
			lists: [newsletterList.id],
		},
		{
			phone: "+251944567890",
			firstName: "Selam",
			lastName: "Alemu",
			email: "selam.alemu@example.com",
			tags: ["vip", "premium"],
			lists: [vipList.id],
		},
		{
			phone: "+251955678901",
			firstName: "Kebede",
			lastName: "Fikadu",
			email: "kebede.fikadu@example.com",
			tags: ["prospect"],
			lists: [prospectsList.id, newsletterList.id],
		},
		{
			phone: "+251966789012",
			firstName: "Hana",
			lastName: "Mekonnen",
			email: "hana.mekonnen@example.com",
			tags: ["customer", "loyal"],
			lists: [vipList.id, newsletterList.id],
		},
		{
			phone: "+251977890123",
			firstName: "Tsegaye",
			lastName: "Abera",
			email: "tsegaye.abera@example.com",
			tags: ["prospect", "lead"],
			lists: [prospectsList.id],
		},
		{
			phone: "+251988901234",
			firstName: "Tsehay",
			lastName: "Worku",
			email: "tsehay.worku@example.com",
			tags: ["customer"],
			lists: [newsletterList.id],
		},
	];

	const createdContacts = [];
	for (const contactData of sampleContacts) {
		const contact = await prisma.contact.create({
			data: {
				phone: contactData.phone,
				firstName: contactData.firstName,
				lastName: contactData.lastName,
				email: contactData.email,
				tags: contactData.tags,
				userId: customer.id,
			},
		});

		// Add to contact lists
		for (const listId of contactData.lists) {
			await prisma.contactListMember.create({
				data: {
					contactId: contact.id,
					listId,
					userId: customer.id,
				},
			});
		}

		createdContacts.push(contact);
	}

	// Update contact list counts
	await prisma.contactList.update({
		where: { id: vipList.id },
		data: { contactCount: 3 },
	});

	await prisma.contactList.update({
		where: { id: prospectsList.id },
		data: { contactCount: 3 },
	});

	await prisma.contactList.update({
		where: { id: newsletterList.id },
		data: { contactCount: 5 },
	});

	console.log("✅ Sample contacts created");

	// Create message templates
	// const templates = [
	// 	{
	// 		name: "Welcome Message",
	// 		messageType: "PROMOTIONAL" as const,
	// 		content:
	// 			"Welcome to our service! We're excited to have you on board. Reply STOP to opt out.",
	// 		type: "TRANSACTIONAL" as const,
	// 		userId: customer.id,
	// 	},
	// 	{
	// 		name: "Promotional Offer",
	// 		messageType: "PROMOTIONAL" as const,

	// 		content:
	// 			"Special offer just for you! Get 20% off your next purchase. Use code SAVE20. Valid until end of month.",
	// 		type: "PROMOTIONAL" as const,
	// 		userId: customer.id,
	// 	},
	// 	{
	// 		name: "Order Confirmation",
	// 		messageType: "PROMOTIONAL" as const,

	// 		content:
	// 			"Your order has been confirmed! Order #{{orderNumber}} will be delivered within 2-3 business days.",
	// 		type: "TRANSACTIONAL" as const,
	// 		userId: customer.id,
	// 	},
	// 	{
	// 		name: "Newsletter Update",
	// 		messageType: "PROMOTIONAL" as const,

	// 		content:
	// 			"Check out our latest newsletter with exciting updates and news from our company!",
	// 		type: "INFORMATIONAL" as const,
	// 		userId: customer.id,
	// 	},
	// 	{
	// 		name: "Appointment Reminder",
	// 		messageType: "PROMOTIONAL" as const,

	// 		content:
	// 			"Reminder: You have an appointment scheduled for tomorrow at {{time}}. Please confirm or reschedule if needed.",
	// 		type: "TRANSACTIONAL" as const,
	// 		userId: customer.id,
	// 	},
	// ];

	// for (const template of templates) {
	// 	await prisma.messageTemplate.create({
	// 		data: template,
	// 	} as any);
	// }

	// Create sender names for customer
	const senderName1 = await prisma.senderName.upsert({
		where: {
			userId_name: {
				userId: customer.id,
				name: "EXAMPLE-INFO",
			},
		},
		update: {},
		create: {
			userId: customer.id,
			name: "EXAMPLE-INFO",
			description: "Informational messages",
			messageType: "INFORMATIONAL",
			status: "APPROVED",
			approvedAt: new Date(),
			approvedBy: admin.id,
		},
	});

	const senderName2 = await prisma.senderName.upsert({
		where: {
			userId_name: {
				userId: customer.id,
				name: "EXAMPLE-PROMO",
			},
		},
		update: {},
		create: {
			userId: customer.id,
			name: "EXAMPLE-PROMO",
			description: "Promotional messages",
			messageType: "PROMOTIONAL",
			status: "APPROVED",
			approvedAt: new Date(),
			approvedBy: admin.id,
		},
	});

	console.log("✅ Message templates created");

	// Create message templates
	const templates = [
		{
			name: "Welcome Message",
			content:
				"Welcome to {company}! Thank you for joining us. We're excited to have you on board.",
			messageType: "INFORMATIONAL" as const,
		},
		{
			name: "Order Confirmation",
			content:
				"Your order #{orderNumber} has been confirmed. Total: ${amount}. Expected delivery: {date}.",
			messageType: "TRANSACTIONAL" as const,
		},
		{
			name: "Special Offer",
			content:
				"🎉 Special offer just for you! Get {discount}% off on all products. Use code: {code}. Valid until {date}.",
			messageType: "PROMOTIONAL" as const,
		},
		{
			name: "Appointment Reminder",
			content:
				"Reminder: You have an appointment scheduled for {date} at {time}. Please arrive 15 minutes early.",
			messageType: "INFORMATIONAL" as const,
		},
	];

	for (const template of templates) {
		await prisma.messageTemplate.upsert({
			where: {
				userId_name: {
					userId: customer.id,
					name: template.name,
				},
			},
			update: {},
			create: {
				userId: customer.id,
				...template,
			},
		});
	}

	// Create sample messages
	const sampleMessages = [
		// 			{
		// 				content:
		// 					"Welcome to Example Corp! Thank you for joining our service. We're here to help you succeed.",
		// 				messageType: "INFORMATIONAL" as const,
		// 				status: "DELIVERED" as const,
		// 				totalRecipients: 3,
		// 				deliveredCount: 3,
		// 				failedCount: 0,
		// 				senderNameId: senderName1.id,
		// 				sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
		// 			},

		{
			content:
				"Welcome to our SMS platform! We're excited to have you on board.",
			messageType: "TRANSACTIONAL",
			status: "SENT",
			senderNameId: senderName1.id,
			creditsUsed: 8,
			totalRecipients: 8,
			deliveredCount: 7,
			failedCount: 1,
			sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
			userId: customer.id,
		},
		{
			content:
				"Special promotion: Get 25% off your next order! Use code SAVE25.",
			messageType: "PROMOTIONAL",
			status: "PENDING_APPROVAL",
			senderNameId: senderName2.id,

			creditsUsed: 0,
			totalRecipients: 3,
			deliveredCount: 0,
			failedCount: 0,
			userId: customer.id,
		},
		{
			content:
				"Your monthly newsletter is here! Check out our latest updates and features.",
			messageType: "INFORMATIONAL",
			status: "SCHEDULED",
			senderNameId: senderName2.id,
			creditsUsed: 0,
			totalRecipients: 5,
			deliveredCount: 0,
			failedCount: 0,
			scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
			userId: customer.id,
		},
	];

	for (const messageData of sampleMessages) {
		await prisma.message.create({
			data: messageData,
		} as any);
	}

	console.log("✅ Sample messages created");

	// Create audit logs
	// await prisma.auditLog.createMany({
	// 	data: [
	// 		{
	// 			action: "USER_LOGIN",
	// 			entity: "User",
	// 			entityId: customer.id,
	// 			details: { ip: "192.168.1.1", userAgent: "Mozilla/5.0..." },
	// 			userId: customer.id,
	// 		},
	// 		{
	// 			action: "MESSAGE_SENT",
	// 			entity: "Message",
	// 			entityId: "msg_001",
	// 			details: { recipients: 8, creditsUsed: 8 },
	// 			userId: customer.id,
	// 		},
	// 		{
	// 			action: "CONTACT_CREATED",
	// 			entity: "Contact",
	// 			entityId: createdContacts[0].id,
	// 			details: { phone: createdContacts[0].phone },
	// 			userId: customer.id,
	// 		},
	// 	],
	// });

	console.log("✅ Audit logs created");
	console.log("🎉 Database seeding completed successfully!");
	console.log("\n📋 Demo Credentials:");
	console.log("Admin: admin@smsplatform.com / admin123");
	console.log("Customer: demo@example.com / demo123");
}

main()
	.catch((e) => {
		console.error("❌ Error during seeding:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
// import bcrypt from "bcryptjs";
// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();

// export async function seedDemoData(): Promise<void> {
// 	try {
// 		console.log("Seeding demo data...");

// 		// Create admin user
// 		const adminPassword = await bcrypt.hash("admin123", 12);
// 		const admin = await prisma.user.upsert({
// 			where: { email: "admin@biisho.com" },
// 			update: {},
// 			create: {
// 				email: "admin@biisho.com",
// 				password: adminPassword,
// 				firstName: "Admin",
// 				lastName: "User",
// 				role: "ADMIN",
// 				status: "ACTIVE",
// 				emailVerified: true,
// 				emailVerifiedAt: new Date(),
// 				companyName: "Biisho Technologies",
// 				companyPhone: "+251111000000",
// 				companyWebsite: "https://biisho.com",
// 			},
// 		});

// 		// Create customer user
// 		const customerPassword = await bcrypt.hash("password", 12);
// 		const customer = await prisma.user.upsert({
// 			where: { email: "customer@example.com" },
// 			update: {},
// 			create: {
// 				email: "customer@example.com",
// 				password: customerPassword,
// 				firstName: "John",
// 				lastName: "Doe",
// 				phone: "+251911234567",
// 				role: "CUSTOMER",
// 				status: "ACTIVE",
// 				emailVerified: true,
// 				emailVerifiedAt: new Date(),
// 				companyName: "Example Corp",
// 				companyPhone: "+251911000000",
// 				companyWebsite: "https://example.com",
// 			},
// 		});

// 		// Create subscription for customer
// 		await prisma.subscription.upsert({
// 			where: { userId: customer.id },
// 			update: {},
// 			create: {
// 				userId: customer.id,
// 				plan: "BUSINESS",
// 				status: "ACTIVE",
// 				credits: 5000,
// 				usedCredits: 1250,
// 				monthlyLimit: 10000,
// 				pricePerCredit: 0.045,
// 			},
// 		});

// 		// Create sender names for customer
// 		const senderName1 = await prisma.senderName.upsert({
// 			where: {
// 				userId_name: {
// 					userId: customer.id,
// 					name: "EXAMPLE-INFO",
// 				},
// 			},
// 			update: {},
// 			create: {
// 				userId: customer.id,
// 				name: "EXAMPLE-INFO",
// 				description: "Informational messages",
// 				messageType: "INFORMATIONAL",
// 				status: "APPROVED",
// 				approvedAt: new Date(),
// 				approvedBy: admin.id,
// 			},
// 		});

// 		const senderName2 = await prisma.senderName.upsert({
// 			where: {
// 				userId_name: {
// 					userId: customer.id,
// 					name: "EXAMPLE-PROMO",
// 				},
// 			},
// 			update: {},
// 			create: {
// 				userId: customer.id,
// 				name: "EXAMPLE-PROMO",
// 				description: "Promotional messages",
// 				messageType: "PROMOTIONAL",
// 				status: "APPROVED",
// 				approvedAt: new Date(),
// 				approvedBy: admin.id,
// 			},
// 		});

// 		// Create some demo contacts
// 		const contacts = [
// 			{
// 				phone: "+251911111111",
// 				firstName: "Elyas",
// 				lastName: "Abebe",
// 				email: "alice@example.com",
// 			},
// 			{
// 				phone: "+251922222222",
// 				firstName: "Bemalak",
// 				lastName: "Tesema",
// 				email: "bob@example.com",
// 			},
// 			{
// 				phone: "+251933333333",
// 				firstName: "Abenezer",
// 				lastName: "Kebede",
// 				email: "carol@example.com",
// 			},
// 			{
// 				phone: "+251944444444",
// 				firstName: "Musse",
// 				lastName: "Teka",
// 				email: "david@example.com",
// 			},
// 			{
// 				phone: "+251955555555",
// 				firstName: "Yonas",
// 				lastName: "D",
// 				email: "eva@example.com",
// 			},
// 		];

// 		const createdContacts = [];
// 		for (const contactData of contacts) {
// 			const contact = await prisma.contact.upsert({
// 				where: {
// 					userId_phone: {
// 						userId: customer.id,
// 						phone: contactData.phone,
// 					},
// 				},
// 				update: {},
// 				create: {
// 					userId: customer.id,
// 					...contactData,
// 					status: "ACTIVE",
// 				},
// 			});
// 			createdContacts.push(contact);
// 		}

// 		// Create contact lists
// 		const contactList1 = await prisma.contactList.upsert({
// 			where: {
// 				userId_name: {
// 					userId: customer.id,
// 					name: "VIP Customers",
// 				},
// 			},
// 			update: {},
// 			create: {
// 				userId: customer.id,
// 				name: "VIP Customers",
// 				description: "High-value customers",
// 			},
// 		});

// 		const contactList2 = await prisma.contactList.upsert({
// 			where: {
// 				userId_name: {
// 					userId: customer.id,
// 					name: "Newsletter Subscribers",
// 				},
// 			},
// 			update: {},
// 			create: {
// 				userId: customer.id,
// 				name: "Newsletter Subscribers",
// 				description: "Users subscribed to newsletter",
// 			},
// 		});

// 		// Add contacts to lists
// 		for (let i = 0; i < 3; i++) {
// 			await prisma.contactListMember.upsert({
// 				where: {
// 					contactListId_contactId: {
// 						contactListId: contactList1.id,
// 						contactId: createdContacts[i].id,
// 					},
// 				},
// 				update: {},
// 				create: {
// 					contactListId: contactList1.id,
// 					contactId: createdContacts[i].id,
// 				},
// 			});
// 		}

// 		for (const contact of createdContacts) {
// 			await prisma.contactListMember.upsert({
// 				where: {
// 					contactListId_contactId: {
// 						contactListId: contactList2.id,
// 						contactId: contact.id,
// 					},
// 				},
// 				update: {},
// 				create: {
// 					contactListId: contactList2.id,
// 					contactId: contact.id,
// 				},
// 			});
// 		}

// 		// Create message templates
// 		const templates = [
// 			{
// 				name: "Welcome Message",
// 				content:
// 					"Welcome to {company}! Thank you for joining us. We're excited to have you on board.",
// 				messageType: "INFORMATIONAL" as const,
// 			},
// 			{
// 				name: "Order Confirmation",
// 				content:
// 					"Your order #{orderNumber} has been confirmed. Total: ${amount}. Expected delivery: {date}.",
// 				messageType: "TRANSACTIONAL" as const,
// 			},
// 			{
// 				name: "Special Offer",
// 				content:
// 					"🎉 Special offer just for you! Get {discount}% off on all products. Use code: {code}. Valid until {date}.",
// 				messageType: "PROMOTIONAL" as const,
// 			},
// 			{
// 				name: "Appointment Reminder",
// 				content:
// 					"Reminder: You have an appointment scheduled for {date} at {time}. Please arrive 15 minutes early.",
// 				messageType: "INFORMATIONAL" as const,
// 			},
// 		];

// 		for (const template of templates) {
// 			await prisma.messageTemplate.upsert({
// 				where: {
// 					userId_name: {
// 						userId: customer.id,
// 						name: template.name,
// 					},
// 				},
// 				update: {},
// 				create: {
// 					userId: customer.id,
// 					...template,
// 				},
// 			});
// 		}

// 		// Create sample messages
// 		const sampleMessages = [
// 			{
// 				content:
// 					"Welcome to Example Corp! Thank you for joining our service. We're here to help you succeed.",
// 				messageType: "INFORMATIONAL" as const,
// 				status: "DELIVERED" as const,
// 				totalRecipients: 3,
// 				deliveredCount: 3,
// 				failedCount: 0,
// 				senderNameId: senderName1.id,
// 				sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
// 			},
// 			{
// 				content:
// 					"🎉 Flash Sale! Get 50% off on all products this weekend only. Use code FLASH50. Shop now!",
// 				messageType: "PROMOTIONAL" as const,
// 				status: "DELIVERED" as const,
// 				totalRecipients: 5,
// 				deliveredCount: 4,
// 				failedCount: 1,
// 				senderNameId: senderName2.id,
// 				sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
// 			},
// 			{
// 				content:
// 					"Your monthly report is ready. Login to your dashboard to view detailed analytics and insights.",
// 				messageType: "INFORMATIONAL" as const,
// 				status: "SENT" as const,
// 				totalRecipients: 3,
// 				deliveredCount: 0,
// 				failedCount: 0,
// 				senderNameId: senderName1.id,
// 				sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
// 			},
// 			{
// 				content:
// 					"Don't miss out! Limited time offer ends tomorrow. Get premium features at 30% discount.",
// 				messageType: "PROMOTIONAL" as const,
// 				status: "PENDING_APPROVAL" as const,
// 				totalRecipients: 5,
// 				deliveredCount: 0,
// 				failedCount: 0,
// 				senderNameId: senderName2.id,
// 				scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
// 			},
// 		];

// 		for (const messageData of sampleMessages) {
// 			const message = await prisma.message.create({
// 				data: {
// 					userId: customer.id,
// 					...messageData,
// 				},
// 			});

// 			// Create recipients for each message
// 			const totalRecipientss: any = messageData.totalRecipients;
// 			for (let i = 0; i < totalRecipientss; i++) {
// 				const contact = createdContacts[i % createdContacts.length];
// 				let recipientStatus:
// 					| "PENDING_APPROVAL"
// 					| "SENT"
// 					| "DELIVERED"
// 					| "FAILED" = "PENDING_APPROVAL";

// 				if (messageData.status === "DELIVERED") {
// 					recipientStatus =
// 						i < messageData.deliveredCount ? "DELIVERED" : "FAILED";
// 				} else if (messageData.status === "SENT") {
// 					recipientStatus = "SENT";
// 				}

// 				await prisma.messageRecipient.create({
// 					data: {
// 						messageId: message.id,
// 						phone: contact.phone,
// 						firstName: contact.firstName,
// 						lastName: contact.lastName,
// 						status: recipientStatus,
// 						...(recipientStatus === "DELIVERED" && {
// 							deliveredAt: messageData.sentAt,
// 						}),
// 						...(recipientStatus === "FAILED" && {
// 							failureReason: "Network timeout",
// 						}),
// 					},
// 				} as any);
// 			}
// 		}

// 		// Create some demo transactions
// 		await prisma.transaction.create({
// 			data: {
// 				userId: customer.id,
// 				type: "CREDIT_PURCHASE",
// 				status: "COMPLETED",
// 				amount: 225.0,
// 				credits: 5000,
// 				description: "Business Plan Purchase",
// 				reference: "TXN-" + Date.now(),
// 			},
// 		});

// 		await prisma.transaction.create({
// 			data: {
// 				userId: customer.id,
// 				type: "CREDIT_USAGE",
// 				status: "COMPLETED",
// 				amount: -56.25,
// 				credits: -1250,
// 				description: "SMS Campaign Usage",
// 				reference: "USAGE-" + Date.now(),
// 			},
// 		});

// 		// Create system settings
// 		const systemSettings = [
// 			{
// 				key: "platform_name",
// 				value: "Biisho A2P SMS Platform",
// 				description: "Platform display name",
// 				category: "general",
// 			},
// 			{
// 				key: "default_credits_welcome",
// 				value: "100",
// 				description: "Welcome credits for new users",
// 				category: "billing",
// 			},
// 			{
// 				key: "max_message_length",
// 				value: "1600",
// 				description: "Maximum SMS message length",
// 				category: "messaging",
// 			},
// 			{
// 				key: "admin_approval_required",
// 				value: "true",
// 				description: "Require admin approval for promotional messages",
// 				category: "messaging",
// 			},
// 		];

// 		for (const setting of systemSettings) {
// 			await prisma.systemSetting.upsert({
// 				where: { key: setting.key },
// 				update: {},
// 				create: setting,
// 			});
// 		}

// 		console.log("Demo data seeded successfully!");
// 		console.log("Admin user: admin@biisho.com / admin123");
// 		console.log("Customer user: customer@example.com / password");
// 		console.log("Sample messages, templates, and contacts created!");
// 	} catch (error) {
// 		console.error("Error seeding demo data:", error);
// 		throw error;
// 	} finally {
// 		await prisma.$disconnect();
// 	}
// }

// if (require.main === module) {
// 	seedDemoData()
// 		.then(() => {
// 			console.log("✅ Seeding completed");
// 			process.exit(0);
// 		})
// 		.catch((error) => {
// 			console.error("❌ Seeding failed:", error);
// 			process.exit(1);
// 		});
// }

// // if (require.main === module) {

// // 	seedDemoData()
// // 		.then(() => {
// // 			console.log("Seeding completed");
// // 			process.exit(0);
// // 		})
// // 		.catch((error) => {
// // 			console.error("Seeding failed:", error);
// // 			process.exit(1);
// // 		});
// // }
