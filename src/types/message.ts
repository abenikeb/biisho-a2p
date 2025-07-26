export interface Message {
	id: string;
	content: string;
	messageType: "PROMOTIONAL" | "TRANSACTIONAL" | "INFORMATIONAL";
	status:
		| "DRAFT"
		| "PENDING_APPROVAL"
		| "APPROVED"
		| "REJECTED"
		| "SENT"
		| "DELIVERED"
		| "FAILED";

	// totalRecipients   Int                @default(0)
	// deliveredCount    Int                @default(0)
	// failedCount       Int                @default(0)
	// creditsUsed       Int                @default(0)

	totalRecipients: number;
	deliveredCount: number;
	failedCount: number;
	scheduledAt?: Date;
	sentAt?: Date;
	createdAt: Date;
	updatedAt: Date;
	userId: string;
	campaignId?: string;
	senderNameId?: string;
	campaign?: {
		id: string;
		name: string;
	};
	senderName?: {
		id: string;
		name: string;
	};
	user?: {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
	};
}

export interface CreateMessageRequest {
	content: string;
	messageType: "PROMOTIONAL" | "TRANSACTIONAL" | "INFORMATIONAL";
	recipients: Array<{
		phone: string;
		firstName?: string;
		lastName?: string;
	}>;
	contactListIds?: string[];
	senderNameId?: string;
	scheduledAt?: string;
	campaignId?: string;
}

export interface UpdateMessageRequest {
	content?: string;
	messageType?: "PROMOTIONAL" | "TRANSACTIONAL" | "INFORMATIONAL";
	scheduledAt?: string;
	status?: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
}

export interface MessageFilters {
	status?: string;
	messageType?: string;
	dateFrom?: string;
	dateTo?: string;
	search?: string;
	campaignId?: string;
	page?: number;
	limit?: number;
}

export interface MessagesResponse {
	messages: Message[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface MessageRecipient {
	id: string;
	messageId: string;
	phone: string;
	firstName?: string;
	lastName?: string;
	status: "PENDING" | "SENT" | "DELIVERED" | "FAILED";
	deliveredAt?: Date;
	failureReason?: string;
	createdAt: Date;
}

export interface MessageTemplate {
	id: string;
	name: string;
	content: string;
	messageType: "PROMOTIONAL" | "TRANSACTIONAL" | "INFORMATIONAL";
	userId: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateTemplateRequest {
	name: string;
	content: string;
	messageType: "PROMOTIONAL" | "TRANSACTIONAL" | "INFORMATIONAL";
}
