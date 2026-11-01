const axios = require('axios');

/**
 * Resolves a human-readable location string from raw input or GPS coordinates.
 * @param {string|null} locationStr 
 * @param {string|number|null} latitude 
 * @param {string|number|null} longitude 
 * @returns {Promise<string|null>}
 */
async function resolveLocation(locationStr, latitude, longitude) {
  if (locationStr && typeof locationStr === 'string' && locationStr.trim().length > 0) {
    return locationStr.trim();
  }
  if (latitude && longitude && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
    try {
      const res = await axios.get(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
        { timeout: 3500 }
      );
      const data = res.data;
      const parts = [
        data.city || data.locality,
        data.principalSubdivision,
        data.countryName
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    } catch (err) {
      // Ignore geocode network errors
    }
    return `${Number(latitude).toFixed(4)}°, ${Number(longitude).toFixed(4)}°`;
  }
  return null;
}

module.exports = { resolveLocation };

