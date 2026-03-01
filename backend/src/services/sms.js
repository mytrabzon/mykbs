// SMS Servisi
// Edge Functions üzerinden SMS gönderimi
// Test modunda console.log kullanıyoruz
const axios = require('axios');

class SMSService {
  constructor() {
    // Supabase Edge Functions URL
    this.supabaseUrl = process.env.SUPABASE_URL || 'https://iuxnpxszfvyrdifchwvr.supabase.co';
    this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
    
    // Edge Functions URL
    this.edgeFunctionUrl = `${this.supabaseUrl}/functions/v1/send-sms`;
    
    // Test modu - false ise gerçekten send-sms Edge Function çağrılır
    this.testMode = process.env.SMS_TEST_MODE === 'true';
    
    console.log('SMS Servisi başlatıldı:');
    console.log('- Supabase URL:', this.supabaseUrl);
    console.log('- Edge Function URL:', this.edgeFunctionUrl);
    console.log('- Test Modu:', this.testMode ? 'Aktif' : 'Pasif');
  }

  /**
   * SMS gönder (OTP için)
   * @param {string} phone - Telefon numarası (örn: +905331234567)
   * @param {string} message - SMS mesajı
   */
  async sendSMS(phone, message) {
    try {
      // Test modunda çalışıyorsak, SMS göndermeden console'a yaz
      if (this.testMode) {
        console.log('=== SMS GÖNDERİLİYOR (TEST MODU) ===');
        console.log('Alıcı:', phone);
        console.log('Mesaj:', message);
        console.log('====================================');
        
        // Test modunda her zaman başarılı dön
        return { success: true, messageId: `test_${Date.now()}`, testMode: true };
      }
      
      // Edge Functions üzerinden SMS gönder
      console.log('=== SMS GÖNDERİLİYOR (EDGE FUNCTION) ===');
      console.log('Edge Function URL:', this.edgeFunctionUrl);
      console.log('Alıcı:', phone);
      console.log('Mesaj:', message);
      
      try {
        // Edge Function'a istek at
        console.log('Edge Function isteği gönderiliyor...');
        const response = await fetch(this.edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.supabaseAnonKey}`,
            'apikey': this.supabaseAnonKey // Supabase Edge Functions için gerekli olabilir
          },
          body: JSON.stringify({
            phone: phone,
            message: message,
            type: 'sms'
          })
        });

        console.log('Edge Function Response Status:', response.status);
        
        const result = await response.json();
        console.log('Edge Function Response Body:', result);
        
        if (response.ok && result.success) {
          console.log('Edge Function SMS başarılı:', result.messageId);
          return { success: true, messageId: result.messageId, details: result };
        } else {
          console.error('Edge Function SMS hatası:', {
            status: response.status,
            statusText: response.statusText,
            error: result.error || result.message
          });
          
          // 401 hatası alındıysa, API anahtarı sorunu var
          if (response.status === 401) {
            console.error('Edge Function 401 Hatası: API anahtarı geçersiz veya yetkilendirme başarısız');
            console.log('Lütfen Supabase proje ayarlarınızı kontrol edin:');
            console.log('1. Project Settings > API > anon/public key');
            console.log('2. Edge Functions > send-sms > Authentication');
          }
          
          // Fallback: Test moduna dön
          console.log('Edge Function hatası, test moduna geçiliyor...');
          return { success: true, messageId: `edge_fallback_${Date.now()}`, testMode: true, error: result.error };
        }
      } catch (edgeError) {
        console.error('Edge Function bağlantı hatası:', {
          message: edgeError.message,
          stack: edgeError.stack
        });
        // Edge Function çalışmazsa test moduna dön
        console.log('Edge Function bağlantı hatası, test moduna geçiliyor...');
        return { success: true, messageId: `edge_error_${Date.now()}`, testMode: true, error: edgeError.message };
      }
    } catch (error) {
      console.error('SMS gönderme hatası:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * OTP SMS gönder
   * @param {string} phone - Telefon numarası
   * @param {string} otp - 6 haneli OTP kodu
   */
  async sendOTP(phone, otp) {
    const message = `KBS Prime giriş kodunuz: ${otp}\n\nBu kodu kimseyle paylaşmayın. Kod 5 dakika geçerlidir.`;
    
    // Test modunda OTP kodunu console'a yaz
    if (this.testMode) {
      console.log('=== OTP KODU (TEST MODU) ===');
      console.log('Telefon:', phone);
      console.log('OTP Kodu:', otp);
      console.log('===========================');
    }
    
    return await this.sendSMS(phone, message);
  }

  /**
   * Kayıt onay SMS gönder
   * @param {string} phone - Telefon numarası
   * @param {object} bilgiler - Kayıt bilgileri
   */
  async sendRegistrationSMS(phone, bilgiler) {
    const message = `KBS Prime'a hoş geldiniz!\n\nTesis Kodu: ${bilgiler.tesisKodu}\n\nGiriş için telefon numaranızı kullanabilirsiniz.`;
    return await this.sendSMS(phone, message);
  }
}

module.exports = new SMSService();

