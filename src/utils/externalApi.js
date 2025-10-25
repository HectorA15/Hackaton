const axios = require('axios');
const config = require('../config');

/**
 * Fetch product data from external API by GTIN/barcode
 * This is a mock implementation - in production, you would integrate with
 * services like:
 * - Open Food Facts API (https://world.openfoodfacts.org)
 * - GS1 API
 * - UPCDatabase
 * - Barcode Lookup API
 */
async function fetchProductByGTIN(gtin) {
  try {
    // Validate GTIN format (8, 12, 13, or 14 digits)
    if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(gtin)) {
      console.error('Invalid GTIN format');
      return null;
    }

    // Example using Open Food Facts API
    const response = await axios.get(
      `https://world.openfoodfacts.org/api/v0/product/${gtin}.json`,
      { timeout: config.apiTimeout }
    );

    if (response.data && response.data.status === 1) {
      const product = response.data.product;
      return {
        gtin: gtin,
        name: product.product_name || product.product_name_en || 'Unknown Product',
        description: product.generic_name || product.categories || '',
        manufacturer: product.brands || 'Unknown',
        category: product.categories_tags?.[0] || 'General'
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching product from external API:', error.message);
    return null;
  }
}

/**
 * Parse QR code data
 * QR codes can contain URLs or structured data
 */
function parseQRCode(qrData) {
  try {
    // If it's a URL, extract relevant information
    if (qrData.startsWith('http://') || qrData.startsWith('https://')) {
      const url = new URL(qrData);
      const params = new URLSearchParams(url.search);
      
      return {
        type: 'url',
        url: qrData,
        gtin: params.get('gtin') || params.get('barcode'),
        batch: params.get('batch') || params.get('lot'),
        expiry: params.get('expiry') || params.get('exp')
      };
    }

    // Try to parse as JSON
    try {
      const data = JSON.parse(qrData);
      return {
        type: 'json',
        ...data
      };
    } catch {
      // Plain text with possible structured format
      return {
        type: 'text',
        data: qrData
      };
    }
  } catch (error) {
    console.error('Error parsing QR code:', error.message);
    return {
      type: 'raw',
      data: qrData
    };
  }
}

module.exports = {
  fetchProductByGTIN,
  parseQRCode
};
