export interface TypeCheckerSettings {
	enableAutoCheck: boolean;
}

export interface PropertyTypes {
	[key: string]: string;
}

export interface ValidationError {
	property: string;
	expected: string;
	actual: string;
	message: string;
}