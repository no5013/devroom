'use strict';

const { generateName, generateUniqueName } = require('../../../devroom/src/nameGenerator');

describe('nameGenerator', () => {
  // Test 1: generateName(0) returns a non-empty string matching PascalCase pattern
  it('generateName(0) returns a non-empty string matching /^[A-Z][a-z]+[A-Z][a-z]+\\d+$/', () => {
    const name = generateName(0);
    expect(name).toBeTruthy();
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
    expect(name).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d+$/);
  });

  // Test 2: Same seed called 3 times always returns the same name (determinism)
  it('is deterministic — same seed always returns the same name', () => {
    const name1 = generateName(42);
    const name2 = generateName(42);
    const name3 = generateName(42);
    expect(name1).toBe(name2);
    expect(name2).toBe(name3);
  });

  // Test 3: Different seeds produce different names (adjacent seeds differ)
  it('generateName(0) !== generateName(1)', () => {
    expect(generateName(0)).not.toBe(generateName(1));
  });

  // Test 4: Names for seeds 0–99 all have the format Word + Word + Number
  it('seeds 0–99 all produce names matching PascalCase + PascalCase + digits format', () => {
    for (let seed = 0; seed <= 99; seed++) {
      const name = generateName(seed);
      expect(name).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d+$/);
    }
  });

  // Test 5: generateUniqueName returns { name, seed }
  it('generateUniqueName(new Set(), 0) returns { name: string, seed: number }', () => {
    const result = generateUniqueName(new Set(), 0);
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('seed');
    expect(typeof result.name).toBe('string');
    expect(typeof result.seed).toBe('number');
  });

  // Test 6: generateUniqueName skips used names
  it('generateUniqueName skips names already in usedNames and returns a different one', () => {
    // Get the name for seed 0 so we can pre-populate usedNames with it
    const firstName = generateName(0);
    const usedNames = new Set([firstName]);

    const result = generateUniqueName(usedNames, 0);
    expect(result.name).not.toBe(firstName);
    expect(typeof result.name).toBe('string');
    expect(typeof result.seed).toBe('number');
  });
});
