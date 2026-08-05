// tests/utils.test.js
import { describe, it, expect } from "vitest";
import { add, subtract, multiply, divide } from "../src/utils.js";

describe("math utilities", () => {
    it("adds numbers correctly", () => {
        expect(add(2, 3)).toBe(5);
    });

    it("subtracts numbers correctly", () => {
        expect(subtract(7, 3)).toBe(4);
    });

    it("multiplies numbers correctly", () => {
        expect(multiply(3, 5)).toBe(15);
    });

    it("divides numbers correctly", () => {
        expect(divide(10, 2)).toBe(5);
    });

    it("throws an error when dividing by zero", () => {
        expect(() => divide(8, 0)).toThrow("Cannot divide by zero");
    });
});