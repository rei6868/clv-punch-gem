const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Cấu hình Cloudinary từ biến môi trường
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
    return 'https://via.placeholder.com/400x100.png?text=Cloudinary+Not+Configured';
  }

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'clv-punch-gem', // Lưu vào một thư mục riêng
        public_id: `punch-result-${Date.now()}` // Tên file duy nhất
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result.secure_url);
      }
    ).end(imageBuffer);
  });
}

module.exports = { uploadToCloudinary };
