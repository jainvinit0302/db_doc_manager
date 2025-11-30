// backend/src/__tests__/transforms.test.ts
import {
    TRANSFORMS,
    parseTransform,
    validateTransform,
    executeTransform,
    getAvailableTransforms,
    getTransform
} from '../transforms';

describe('Transform Library', () => {
    describe('String Transforms', () => {
        describe('lower()', () => {
            it('should convert to lowercase', () => {
                const result = TRANSFORMS.lower.execute('HELLO WORLD');
                expect(result).toBe('hello world');
            });

            it('should validate with 0 args', () => {
                expect(TRANSFORMS.lower.validate([])).toBe(true);
                expect(TRANSFORMS.lower.validate(['arg'])).toBe(false);
            });
        });

        describe('upper()', () => {
            it('should convert to uppercase', () => {
                const result = TRANSFORMS.upper.execute('hello world');
                expect(result).toBe('HELLO WORLD');
            });

            it('should validate with 0 args', () => {
                expect(TRANSFORMS.upper.validate([])).toBe(true);
            });
        });

        describe('trim()', () => {
            it('should remove whitespace', () => {
                const result = TRANSFORMS.trim.execute('  hello  ');
                expect(result).toBe('hello');
            });

            it('should validate with 0 args', () => {
                expect(TRANSFORMS.trim.validate([])).toBe(true);
            });
        });

        describe('concat()', () => {
            it('should concatenate multiple strings', () => {
                const result = TRANSFORMS.concat.execute('Hello', ' ', 'World', '!');
                expect(result).toBe('Hello World!');
            });

            it('should require at least 2 args', () => {
                expect(TRANSFORMS.concat.validate(['a', 'b'])).toBe(true);
                expect(TRANSFORMS.concat.validate(['a', 'b', 'c'])).toBe(true);
                expect(TRANSFORMS.concat.validate(['a'])).toBe(false);
            });
        });

        describe('substring()', () => {
            it('should extract substring with start and end', () => {
                const result = TRANSFORMS.substring.execute('Hello World', 0, 5);
                expect(result).toBe('Hello');
            });

            it('should extract substring with only start', () => {
                const result = TRANSFORMS.substring.execute('Hello World', 6);
                expect(result).toBe('World');
            });

            it('should validate with 2-3 args', () => {
                expect(TRANSFORMS.substring.validate(['0', '5'])).toBe(true);
                expect(TRANSFORMS.substring.validate(['0', '5', '10'])).toBe(true);
                expect(TRANSFORMS.substring.validate(['0'])).toBe(false);
            });
        });
    });

    describe('Date Transforms', () => {
        describe('parseDate()', () => {
            it('should parse valid date string', () => {
                const result = TRANSFORMS.parseDate.execute('2024-01-15');
                expect(result).toMatch(/2024-01-15/);
            });

            it('should throw on invalid date', () => {
                expect(() => TRANSFORMS.parseDate.execute('invalid')).toThrow();
            });

            it('should validate with 0-1 args', () => {
                expect(TRANSFORMS.parseDate.validate([])).toBe(true);
                expect(TRANSFORMS.parseDate.validate(['format'])).toBe(true);
                expect(TRANSFORMS.parseDate.validate(['a', 'b'])).toBe(false);
            });
        });

        describe('formatDate()', () => {
            it('should format date', () => {
                const date = new Date('2024-01-15T10:30:45');
                const result = TRANSFORMS.formatDate.execute(date, 'YYYY-MM-DD');
                expect(result).toBe('2024-01-15');
            });

            it('should format with time', () => {
                const date = new Date('2024-01-15T10:30:45');
                const result = TRANSFORMS.formatDate.execute(date, 'YYYY-MM-DD HH:mm:ss');
                expect(result).toBe('2024-01-15 10:30:45');
            });

            it('should validate with exactly 1 arg', () => {
                expect(TRANSFORMS.formatDate.validate(['format'])).toBe(true);
                expect(TRANSFORMS.formatDate.validate([])).toBe(false);
                expect(TRANSFORMS.formatDate.validate(['a', 'b'])).toBe(false);
            });
        });
    });

    describe('Utility Transforms', () => {
        describe('coalesce()', () => {
            it('should return first non-null value', () => {
                const result = TRANSFORMS.coalesce.execute(null, undefined, '', 'value', 'other');
                expect(result).toBe('value');
            });

            it('should return null if all null', () => {
                const result = TRANSFORMS.coalesce.execute(null, undefined, '');
                expect(result).toBe(null);
            });

            it('should validate with 1+ args', () => {
                expect(TRANSFORMS.coalesce.validate(['a'])).toBe(true);
                expect(TRANSFORMS.coalesce.validate(['a', 'b'])).toBe(true);
                expect(TRANSFORMS.coalesce.validate([])).toBe(false);
            });
        });

        describe('default()', () => {
            it('should return input if not null', () => {
                const result = TRANSFORMS.default.execute('value', 'default');
                expect(result).toBe('value');
            });

            it('should return default if null', () => {
                const result = TRANSFORMS.default.execute(null, 'default');
                expect(result).toBe('default');
            });

            it('should validate with exactly 1 arg', () => {
                expect(TRANSFORMS.default.validate(['default'])).toBe(true);
                expect(TRANSFORMS.default.validate([])).toBe(false);
            });
        });

        describe('cast()', () => {
            it('should cast to string', () => {
                const result = TRANSFORMS.cast.execute(123, 'string');
                expect(result).toBe('123');
            });

            it('should cast to integer', () => {
                const result = TRANSFORMS.cast.execute('123', 'integer');
                expect(result).toBe(123);
            });

            it('should cast to float', () => {
                const result = TRANSFORMS.cast.execute('123.45', 'float');
                expect(result).toBe(123.45);
            });

            it('should cast to boolean', () => {
                const result = TRANSFORMS.cast.execute('true', 'boolean');
                expect(result).toBe(true);
            });

            it('should validate with exactly 1 arg', () => {
                expect(TRANSFORMS.cast.validate(['type'])).toBe(true);
                expect(TRANSFORMS.cast.validate([])).toBe(false);
            });
        });
    });

    describe('Math Transforms', () => {
        describe('round()', () => {
            it('should round to integer by default', () => {
                const result = TRANSFORMS.round.execute(123.456);
                expect(result).toBe(123);
            });

            it('should round to specified decimals', () => {
                const result = TRANSFORMS.round.execute(123.456, 2);
                expect(result).toBe(123.46);
            });

            it('should validate with 0-1 args', () => {
                expect(TRANSFORMS.round.validate([])).toBe(true);
                expect(TRANSFORMS.round.validate(['2'])).toBe(true);
                expect(TRANSFORMS.round.validate(['a', 'b'])).toBe(false);
            });
        });

        describe('abs()', () => {
            it('should return absolute value', () => {
                expect(TRANSFORMS.abs.execute(-123)).toBe(123);
                expect(TRANSFORMS.abs.execute(123)).toBe(123);
            });

            it('should validate with 0 args', () => {
                expect(TRANSFORMS.abs.validate([])).toBe(true);
                expect(TRANSFORMS.abs.validate(['arg'])).toBe(false);
            });
        });
    });

    describe('Transform Parser', () => {
        it('should parse simple function with no args', () => {
            const result = parseTransform('lower()');
            expect(result).toEqual({
                name: 'lower',
                args: [],
                raw: 'lower()'
            });
        });

        it('should parse function with single arg', () => {
            const result = parseTransform('cast("string")');
            expect(result).toEqual({
                name: 'cast',
                args: ['"string"'],
                raw: 'cast("string")'
            });
        });

        it('should parse function with multiple args', () => {
            const result = parseTransform('concat("Hello", " ", "World")');
            expect(result).toEqual({
                name: 'concat',
                args: ['"Hello"', '" "', '"World"'],
                raw: 'concat("Hello", " ", "World")'
            });
        });

        it('should handle JSONPath expressions', () => {
            const result = parseTransform('concat($.first, " ", $.last)');
            expect(result).toEqual({
                name: 'concat',
                args: ['$.first', '" "', '$.last'],
                raw: 'concat($.first, " ", $.last)'
            });
        });

        it('should return null for invalid syntax', () => {
            expect(parseTransform('not a function')).toBe(null);
            expect(parseTransform('missing_paren(')).toBe(null);
            expect(parseTransform('')).toBe(null);
        });
    });

    describe('Transform Validator', () => {
        it('should validate correct transform', () => {
            expect(validateTransform('lower()')).toBe(null);
            expect(validateTransform('concat("a", "b")')).toBe(null);
            expect(validateTransform('round(2)')).toBe(null);
        });

        it('should error on invalid syntax', () => {
            const error = validateTransform('not valid');
            expect(error).toContain('Invalid transform syntax');
        });

        it('should error on unknown function', () => {
            const error = validateTransform('unknownFunc()');
            expect(error).toContain('Unknown transform');
            expect(error).toContain('unknownFunc');
        });

        it('should error on wrong number of args', () => {
            const error1 = validateTransform('lower("arg")');
            expect(error1).toContain('0 argument');

            const error2 = validateTransform('concat("only one")');
            expect(error2).toContain('at least 2 argument');
        });
    });

    describe('Utility Functions', () => {
        it('should get available transforms', () => {
            const transforms = getAvailableTransforms();
            expect(transforms.length).toBeGreaterThan(10);
            expect(transforms[0]).toHaveProperty('name');
            expect(transforms[0]).toHaveProperty('execute');
        });

        it('should get transform by name', () => {
            const transform = getTransform('lower');
            expect(transform).toBeDefined();
            expect(transform?.name).toBe('lower');
        });

        it('should return undefined for unknown transform', () => {
            const transform = getTransform('nonexistent');
            expect(transform).toBeUndefined();
        });
    });
});
