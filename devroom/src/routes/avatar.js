'use strict';

const express = require('express');
const router = express.Router();
const { generateAvatarSvg } = require('../avatarGenerator');

/**
 * GET /api/avatar/:seed
 * Returns an SVG avatar for the given seed string.
 */
router.get('/:seed', (req, res) => {
  const { seed } = req.params;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(generateAvatarSvg(seed));
});

module.exports = router;
