import Joi from "joi";

export const registerSchema = Joi.object({
	email: Joi.string().email().required(),
	password: Joi.string().min(8).required(),
	firstName: Joi.string().min(2).max(50).required(),
	lastName: Joi.string().min(2).max(50).required(),
	phone: Joi.string().optional(),
	companyName: Joi.string().min(2).max(100).optional(),
	companyAddress: Joi.string().max(255).optional(),
	companyPhone: Joi.string().optional(),
	companyWebsite: Joi.string().uri().optional(),
});

export const loginSchema = Joi.object({
	email: Joi.string().email().required(),
	password: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
	email: Joi.string().email().required(),
});

export const resetPasswordSchema = Joi.object({
	token: Joi.string().required(),
	password: Joi.string().min(8).required(),
});
