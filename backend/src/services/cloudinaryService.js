/**
 * Cloudinary Service — PDF file storage
 * Stores uploaded cutoff PDFs on Cloudinary's raw file storage.
 */

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a PDF buffer to Cloudinary as a raw file.
 * @param {Buffer} buffer - The PDF file buffer
 * @param {string} publicId - The public ID for the file (e.g., "cutoffs/2024-25_CAP_Round_I")
 * @returns {Promise<Object>} Cloudinary upload result
 */
async function uploadPDF(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: publicId,
        format: 'pdf',
        overwrite: true
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload failed:', error.message);
          reject(error);
        } else {
          console.log('☁️  PDF uploaded to Cloudinary:', result.secure_url);
          resolve(result);
        }
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Delete a file from Cloudinary.
 * @param {string} publicId - The public ID of the file to delete
 */
async function deletePDF(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    console.log('🗑️  Cloudinary file deleted:', publicId);
    return result;
  } catch (error) {
    console.error('❌ Cloudinary delete failed:', error.message);
    throw error;
  }
}

module.exports = { uploadPDF, deletePDF };
