import type { User } from "@prisma/client";

declare global {
	namespace Express {
		interface Request {
			user?: User & {
				subscription?: any;
			};
		}
	}
}
