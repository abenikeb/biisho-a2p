import Joi from "joi";

export const createMessageSchema = Joi.object({
	content: Joi.string().min(1).max(1600).required(),
	messageType: Joi.string()
		.valid("PROMOTIONAL", "TRANSACTIONAL", "INFORMATIONAL", "OTP")
		.required(),
	senderNameId: Joi.string().uuid().optional(),
	templateId: Joi.string().uuid().optional(),
	scheduledAt: Joi.date().greater("now").optional(),
	recipients: Joi.array()
		.items(
			Joi.object({
				phone: Joi.string().required(),
				firstName: Joi.string().optional(),
				lastName: Joi.string().optional(),
			})
		)
		.min(1)
		.required(),
});

export const updateMessageSchema = Joi.object({
	content: Joi.string().min(1).max(1600).optional(),
	scheduledAt: Joi.date().greater("now").optional(),
	status: Joi.string().valid("DRAFT", "SCHEDULED", "CANCELLED").optional(),
});
