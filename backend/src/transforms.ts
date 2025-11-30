// backend/src/transforms.ts
/**
 * Transform Library for Data Transformations
 * Provides built-in functions for manipulating data in mappings
 */

export interface Transform {
    name: string;
    description: string;
    execute: (...args: any[]) => any;
    validate: (args: any[]) => boolean;
    minArgs: number;
    maxArgs: number;
}

/**
 * Built-in transform functions
 */
export const TRANSFORMS: Record<string, Transform> = {
    // ========== String Transforms ==========

    lower: {
        name: 'lower',
        description: 'Convert string to lowercase',
        minArgs: 0,
        maxArgs: 0,
        execute: (input: string) => String(input).toLowerCase(),
        validate: (args) => args.length === 0
    },

    upper: {
        name: 'upper',
        description: 'Convert string to uppercase',
        minArgs: 0,
        maxArgs: 0,
        execute: (input: string) => String(input).toUpperCase(),
        validate: (args) => args.length === 0
    },

    trim: {
        name: 'trim',
        description: 'Remove leading and trailing whitespace',
        minArgs: 0,
        maxArgs: 0,
        execute: (input: string) => String(input).trim(),
        validate: (args) => args.length === 0
    },

    concat: {
        name: 'concat',
        description: 'Concatenate multiple strings',
        minArgs: 2,
        maxArgs: Infinity,
        execute: (...parts: any[]) => parts.map(p => String(p)).join(''),
        validate: (args) => args.length >= 2
    },

    substring: {
        name: 'substring',
        description: 'Extract substring from start to end index',
        minArgs: 2,
        maxArgs: 3,
        execute: (input: string, start: number, end?: number) => {
            const str = String(input);
            return end !== undefined ? str.substring(start, end) : str.substring(start);
        },
        validate: (args) => args.length >= 2 && args.length <= 3
    },

    // ========== Date Transforms ==========

    parseDate: {
        name: 'parseDate',
        description: 'Parse date string to ISO format',
        minArgs: 0,
        maxArgs: 1,
        execute: (input: string, format?: string) => {
            // Simple date parsing - can be enhanced with date-fns
            const date = new Date(input);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date: ${input}`);
            }
            return date.toISOString();
        },
        validate: (args) => args.length <= 1
    },

    formatDate: {
        name: 'formatDate',
        description: 'Format date to specified format',
        minArgs: 1,
        maxArgs: 1,
        execute: (input: string | Date, format: string) => {
            const date = input instanceof Date ? input : new Date(input);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date: ${input}`);
            }

            // Simple format implementation (supports YYYY, MM, DD, HH, mm, ss)
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');

            return format
                .replace('YYYY', String(year))
                .replace('MM', month)
                .replace('DD', day)
                .replace('HH', hours)
                .replace('mm', minutes)
                .replace('ss', seconds);
        },
        validate: (args) => args.length === 1
    },

    // ========== Utility Transforms ==========

    coalesce: {
        name: 'coalesce',
        description: 'Return first non-null/non-undefined value',
        minArgs: 1,
        maxArgs: Infinity,
        execute: (...values: any[]) => {
            for (const val of values) {
                if (val !== null && val !== undefined && val !== '') {
                    return val;
                }
            }
            return null;
        },
        validate: (args) => args.length >= 1
    },

    default: {
        name: 'default',
        description: 'Return default value if input is null/undefined',
        minArgs: 1,
        maxArgs: 1,
        execute: (input: any, defaultValue: any) => {
            return (input === null || input === undefined || input === '') ? defaultValue : input;
        },
        validate: (args) => args.length === 1
    },

    cast: {
        name: 'cast',
        description: 'Cast value to specified type',
        minArgs: 1,
        maxArgs: 1,
        execute: (input: any, targetType: string) => {
            switch (targetType.toLowerCase()) {
                case 'string':
                    return String(input);
                case 'integer':
                case 'int':
                    return parseInt(String(input), 10);
                case 'float':
                case 'number':
                    return parseFloat(String(input));
                case 'boolean':
                case 'bool':
                    return Boolean(input);
                default:
                    throw new Error(`Unsupported cast type: ${targetType}`);
            }
        },
        validate: (args) => args.length === 1
    },

    // ========== Math Transforms ==========

    round: {
        name: 'round',
        description: 'Round number to specified decimal places',
        minArgs: 0,
        maxArgs: 1,
        execute: (input: number, decimals: number = 0) => {
            const num = Number(input);
            if (isNaN(num)) {
                throw new Error(`Cannot round non-numeric value: ${input}`);
            }
            const multiplier = Math.pow(10, decimals);
            return Math.round(num * multiplier) / multiplier;
        },
        validate: (args) => args.length <= 1
    },

    abs: {
        name: 'abs',
        description: 'Return absolute value of number',
        minArgs: 0,
        maxArgs: 0,
        execute: (input: number) => {
            const num = Number(input);
            if (isNaN(num)) {
                throw new Error(`Cannot get absolute value of non-numeric value: ${input}`);
            }
            return Math.abs(num);
        },
        validate: (args) => args.length === 0
    }
};

/**
 * Parsed transform structure
 */
export interface ParsedTransform {
    name: string;
    args: string[];
    raw: string;
}

/**
 * Parse a transform expression like "lower()" or "concat($.a, ' ', $.b)"
 */
export function parseTransform(expr: string): ParsedTransform | null {
    if (!expr || typeof expr !== 'string') {
        return null;
    }

    const trimmed = expr.trim();

    // Match function call pattern: functionName(arg1, arg2, ...)
    const match = trimmed.match(/^(\w+)\((.*)\)$/);

    if (!match) {
        return null;
    }

    const [, name, argsStr] = match;

    // Parse arguments (handle quoted strings, JSONPath, etc.)
    const args: string[] = [];
    if (argsStr.trim()) {
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        let depth = 0;

        for (let i = 0; i < argsStr.length; i++) {
            const char = argsStr[i];

            if ((char === '"' || char === "'") && (i === 0 || argsStr[i - 1] !== '\\')) {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = char;
                } else if (char === quoteChar) {
                    inQuotes = false;
                    quoteChar = '';
                }
                current += char;
            } else if (char === '(' && !inQuotes) {
                depth++;
                current += char;
            } else if (char === ')' && !inQuotes) {
                depth--;
                current += char;
            } else if (char === ',' && !inQuotes && depth === 0) {
                args.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            args.push(current.trim());
        }
    }

    return {
        name,
        args,
        raw: trimmed
    };
}

/**
 * Validate a transform expression
 * Returns error message if invalid, null if valid
 */
export function validateTransform(expr: string): string | null {
    const parsed = parseTransform(expr);

    if (!parsed) {
        return `Invalid transform syntax: "${expr}". Expected format: functionName(args)`;
    }

    const transform = TRANSFORMS[parsed.name];

    if (!transform) {
        const available = Object.keys(TRANSFORMS).join(', ');
        return `Unknown transform: "${parsed.name}". Available transforms: ${available}`;
    }

    if (!transform.validate(parsed.args)) {
        if (parsed.args.length < transform.minArgs) {
            return `Transform "${parsed.name}" requires at least ${transform.minArgs} argument(s), got ${parsed.args.length}`;
        }
        if (transform.maxArgs !== Infinity && parsed.args.length > transform.maxArgs) {
            return `Transform "${parsed.name}" accepts at most ${transform.maxArgs} argument(s), got ${parsed.args.length}`;
        }
        return `Invalid arguments for transform "${parsed.name}"`;
    }

    return null; // Valid
}

/**
 * Execute a transform (for future runtime use)
 */
export function executeTransform(expr: string, input: any): any {
    const parsed = parseTransform(expr);

    if (!parsed) {
        throw new Error(`Invalid transform syntax: "${expr}"`);
    }

    const transform = TRANSFORMS[parsed.name];

    if (!transform) {
        throw new Error(`Unknown transform: "${parsed.name}"`);
    }

    // Execute the transform
    // Note: This is a simplified version - in production you'd want to:
    // 1. Evaluate JSONPath expressions in args
    // 2. Handle nested transforms
    // 3. Better error handling
    return transform.execute(input, ...parsed.args);
}

/**
 * Get list of all available transforms
 */
export function getAvailableTransforms(): Transform[] {
    return Object.values(TRANSFORMS);
}

/**
 * Get transform by name
 */
export function getTransform(name: string): Transform | undefined {
    return TRANSFORMS[name];
}
