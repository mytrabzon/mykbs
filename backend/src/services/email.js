// Email Servisi
// Nodemailer kullanarak email gönderimi
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Email configuration
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Test modu
    this.testMode = process.env.NODE_ENV !== 'production' || !process.env.EMAIL_USER;
  }

  /**
   * Email gönder
   * @param {string} to - Alıcı email
   * @param {string} subject - Konu
   * @param {string} html - HTML içerik
   * @param {string} text - Plain text içerik
   */
  async sendEmail(to, subject, html, text = '') {
    try {
      if (this.testMode) {
        // Test modu: Console'a yazdır
        console.log('=== EMAIL GÖNDERİLİYOR (TEST MODU) ===');
        console.log('Alıcı:', to);
        console.log('Konu:', subject);
        console.log('HTML:', html.substring(0, 100) + '...');
        console.log('======================================');
        
        // Test modunda başarılı dön
        return { success: true, messageId: `email_test_${Date.now()}` };
      }

      // Gerçek email gönder
      const mailOptions = {
        from: `"MyKBS" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: subject,
        html: html,
        text: text || this.htmlToText(html)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email gönderildi:', info.messageId);
      
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('Email gönderme hatası:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * HTML'den plain text oluştur
   */
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Kayıt onay email gönder
   * @param {string} email - Alıcı email
   * @param {object} bilgiler - Kayıt bilgileri
   */
  async sendRegistrationEmail(email, bilgiler) {
    const subject = 'MyKBS - Kaydınız Başarıyla Oluşturuldu';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MyKBS'ye Hoş Geldiniz!</h1>
          </div>
          <div class="content">
            <p>Sayın ${bilgiler.adSoyad},</p>
            <p>MyKBS hesabınız başarıyla oluşturuldu. Aşağıdaki bilgilerle giriş yapabilirsiniz:</p>
            
            <div class="info-box">
              <h3>Giriş Bilgileriniz</h3>
              <p><strong>Tesis Adı:</strong> ${bilgiler.tesisAdi}</p>
              <p><strong>Tesis Kodu:</strong> ${bilgiler.tesisKodu}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Telefon:</strong> ${bilgiler.telefon}</p>
              <p><strong>Şifre:</strong> Kayıt sırasında belirlediğiniz şifre</p>
            </div>
            
            <p><strong>Giriş Yapma Seçenekleri:</strong></p>
            <ul>
              <li>Email ve şifrenizle</li>
              <li>Telefon numaranız ve şifrenizle</li>
            </ul>
            
            <p>Güvenliğiniz için şifrenizi kimseyle paylaşmayın.</p>
            
            <div class="footer">
              <p>© 2024 MyKBS. Tüm hakları saklıdır.</p>
              <p>Bu email otomatik olarak gönderilmiştir, lütfen yanıtlamayın.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, html);
  }

  /**
   * OTP email gönder
   * @param {string} email - Alıcı email
   * @param {string} otp - OTP kodu
   */
  async sendOTPEmail(email, otp) {
    const subject = 'MyKBS - Giriş Doğrulama Kodu';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .otp-box { background: white; border: 2px dashed #007AFF; padding: 20px; text-align: center; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Doğrulama Kodu</h1>
          </div>
          <div class="content">
            <p>MyKBS giriş işleminiz için doğrulama kodunuz:</p>
            
            <div class="otp-box">
              ${otp}
            </div>
            
            <p>Bu kodu kimseyle paylaşmayın. Kod 5 dakika geçerlidir.</p>
            <p>Eğer bu işlemi siz yapmadıysanız, lütfen bu email'i dikkate almayın.</p>
            
            <div class="footer">
              <p>© 2024 MyKBS. Tüm hakları saklıdır.</p>
              <p>Bu email otomatik olarak gönderilmiştir, lütfen yanıtlamayın.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, html);
  }
}

module.exports = new EmailService();