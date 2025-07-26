import type { User, Subscription } from "@prisma/client";

export interface LoginRequest {
	email: string;
	password: string;
}

export interface RegisterRequest {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
	companyName?: string;
	companyPhone?: string;
	companyWebsite?: string;
	phone?: string;
}

export interface JWTPayload {
	id: string;
	email: string;
	role: string;
	status: string;
}

export interface AuthResponse {
	user: UserWithSubscription;
	tokens: {
		accessToken: string;
		refreshToken: string;
	};
}

export interface UserWithSubscription extends User {
	subscription?: Subscription;
}

export interface ApiResponse<T = any> {
	success: boolean;
	message: string;
	data?: T;
	errors?: any[];
}
