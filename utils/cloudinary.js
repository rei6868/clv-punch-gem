// File: utils/cloudinary.js

const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Cấu hình Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Tải ảnh lên Cloudinary
 * @param {Buffer} imageBuffer - Buffer của ảnh cần tải lên
 * @returns {Promise<string>} - URL của ảnh đã tải lên
 */
async function uploadToCloudinary(imageBuffer) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.warn('Cloudinary is not configured. Skipping upload.');
    return '[https://via.placeholder.com/400x100.png?text=Cloudinary+Not+Configured](https://via.placeholder.com/400x100.png?text=Cloudinary+Not+Configured)';
  }

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'clv-punch-gem',
        public_id: `punch-result-${Date.now()}`
      },
      (error, result) => {
        // --- BẮT ĐẦU SỬA ---
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
        
        // Kiểm tra kỹ (Phòng trường hợp upload lỗi nhưng không báo error)
        if (!result || !result.secure_url) {
          console.error('Cloudinary upload failed: No secure_url in result.', result);
          return reject(new Error('Cloudinary upload failed: No secure_url in result.'));
        }
        
        console.log('Cloudinary upload success:', result.secure_url);
        resolve(result.secure_url);
        // --- KẾT THÚC SỬA ---
      }
    ).end(imageBuffer);
  });
}

module.exports = { uploadToCloudinary };
