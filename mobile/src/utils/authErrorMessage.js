export function getEmailOtpErrorMessage(error, options = {}) {
  const { requiresExistingAccount = false } = options;
  const rawMessage = String(error?.message || '');
  const code = String(error?.code || '').toLowerCase();
  const msg = rawMessage.toLowerCase();

  // Kod ile giriş: e-posta Supabase Auth'da yoksa (sadece e-posta+şifre ile kayıt olanlar backend'de)
  if (
    requiresExistingAccount &&
    (code === 'otp_disabled' ||
      msg.includes('signups not allowed for otp') ||
      msg.includes('not allowed') ||
      msg.includes('authorized') ||
      msg.includes('user not found') ||
      msg.includes('not found') ||
      msg.includes('no user') ||
      msg.includes('invalid login') ||
      msg.includes('email not confirmed'))
  ) {
    return 'Bu e-posta kod ile giriş için kayıtlı değil. E-posta + şifre ile giriş yapın.';
  }

  if (msg.includes('rate') || msg.includes('limit') || msg.includes('too many')) {
    return 'Çok sık kod istendi. Lütfen biraz sonra tekrar deneyin.';
  }

  if (
    msg.includes('sending') ||
    msg.includes('smtp') ||
    msg.includes('mail') ||
    msg.includes('email service')
  ) {
    return 'Kod şu anda gönderilemedi. Lütfen biraz sonra tekrar deneyin.';
  }

  return 'Kod gönderilemedi. Lütfen tekrar deneyin.';
}
