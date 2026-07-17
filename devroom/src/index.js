'use strict';

const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/avatar', require('./routes/avatar'));

// Serve join.html for /join route
app.get('/join', (req, res) => res.sendFile(path.join(__dirname, '../public/join.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`devroom listening on http://localhost:${PORT}`));

module.exports = app; // needed by supertest in tests
