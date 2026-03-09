export function getEmailOtpErrorMessage(error, options = {}) {
  const { requiresExistingAccount = false } = options;
  const rawMessage = String(error?.message || '');
  const code = String(error?.code || '').toLowerCase();
  const msg = rawMessage.toLowerCase();

  if (
    requiresExistingAccount &&
    (code === 'otp_disabled' ||
      msg.includes('signups not allowed for otp') ||
      msg.includes('not allowed') ||
      msg.includes('authorized'))
  ) {
    return 'Bu e-posta adresi kayıtlı değil. Kayıtlı e-posta adresinizle tekrar deneyin.';
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
