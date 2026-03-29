#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, 'licensed/GeoLite2-City.mmdb');

if (!fs.existsSync(file)) {
    console.error(`Integrity check warning: ${file} does not exist. GeoIP features will be disabled until the asset is prepared.`);
}
