'use strict';

const adjectives = [
  'Silent', 'Crypto', 'Neon', 'Ghost', 'Turbo',
  'Fuzzy', 'Binary', 'Rogue', 'Dark', 'Pixel',
  'Atomic', 'Stealthy', 'Quantum', 'Rusty', 'Electric',
  'Sneaky', 'Ultra', 'Hyper', 'Cyber', 'Void'
];

const animals = [
  'Panda', 'Fox', 'Badger', 'Lynx', 'Ferret',
  'Otter', 'Raccoon', 'Hawk', 'Cobra', 'Gecko',
  'Mantis', 'Raven', 'Wolf', 'Viper', 'Falcon',
  'Coyote', 'Shark', 'Beetle', 'Sloth', 'Mole'
];

/**
 * generateName(seed)
 * Deterministically maps a non-negative integer seed to a display name.
 * Format: <Adjective><Animal><number 1-99>
 */
function generateName(seed) {
  const adjIndex = seed % adjectives.length;
  const animalIndex = Math.floor(seed / adjectives.length) % animals.length;
  const number = (seed % 99) + 1;
  return `${adjectives[adjIndex]}${animals[animalIndex]}${number}`;
}

/**
 * generateUniqueName(usedNames, startSeed)
 * Tries seeds startSeed … startSeed+50. Returns { name, seed } for the
 * first name not in the usedNames Set, or throws if none found.
 */
function generateUniqueName(usedNames, startSeed) {
  for (let i = 0; i <= 50; i++) {
    const seed = startSeed + i;
    const name = generateName(seed);
    if (!usedNames.has(name)) {
      return { name, seed };
    }
  }
  throw new Error('Could not find a unique name within 50 attempts');
}

module.exports = { generateName, generateUniqueName };
