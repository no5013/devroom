'use strict';

const jdenticon = require('jdenticon');

/**
 * generateAvatarSvg(seed)
 * seed is a string. Returns an SVG string of 80x80 pixels.
 */
function generateAvatarSvg(seed) {
  return jdenticon.toSvg(seed, 80);
}

module.exports = { generateAvatarSvg };
