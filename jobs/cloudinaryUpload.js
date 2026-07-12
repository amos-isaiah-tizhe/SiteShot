const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function upload(fileBuffer, ext, userId) {
  try {
    const resourceType = ext === 'pdf' ? 'raw' : 'image';
    const folder = `onexp-siteshot/${userId || 'anonymous'}`;

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          format: ext,
          transformation: ext !== 'pdf' ? [{ quality: 'auto', fetch_format: 'auto' }] : undefined,
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
      stream.end(fileBuffer);
    });

    logger.info(`Cloudinary upload success: ${result.secure_url}`);
    return result.secure_url;
  } catch (err) {
    logger.error(`Cloudinary upload failed: ${err.message}`);
    return null; // Non-fatal — caller handles null
  }
}

module.exports = { upload };
