// lib/utils.js - Utility functions for the application

// Lists of adjectives and nouns to create readable tenant IDs
const adjectives = [
  'adorable',
  'adventurous',
  'amazing',
  'beautiful',
  'brave',
  'bright',
  'calm',
  'charming',
  'cheerful',
  'colorful',
  'cozy',
  'creative',
  'determined',
  'eager',
  'elegant',
  'energetic',
  'friendly',
  'gentle',
  'graceful',
  'happy',
  'harmonious',
  'intelligent',
  'jolly',
  'kind',
  'lively',
  'majestic',
  'mysterious',
  'nice',
  'peaceful',
  'pleasant',
  'powerful',
  'proud',
  'reliable',
  'splendid',
  'stunning',
  'thoughtful',
  'vibrant',
  'wonderful',
];

const nouns = [
  'ant',
  'bear',
  'bird',
  'butterfly',
  'cat',
  'chameleon',
  'deer',
  'dolphin',
  'eagle',
  'elephant',
  'fox',
  'giraffe',
  'horse',
  'jellyfish',
  'kangaroo',
  'koala',
  'lion',
  'monkey',
  'octopus',
  'owl',
  'panda',
  'penguin',
  'rabbit',
  'rhino',
  'squirrel',
  'tiger',
  'turtle',
  'whale',
  'wolf',
  'zebra',
];

/**
 * Generate a random tenant ID in the format 'adjective-adjective-noun'
 * @returns {string} A random tenant ID
 */
function generateTenantId() {
  const adj1 = adjectives[Math.floor(Math.random() * adjectives.length)];
  const adj2 = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adj1}-${adj2}-${noun}`;
}

module.exports = {
  generateTenantId,
};
