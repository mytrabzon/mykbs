const JandarmaKBS = require('./jandarma');
const PolisKBS = require('./polis');

/**
 * KBS servis fabrikası
 * Tesis KBS türüne göre doğru servisi döndürür
 */
function createKBSService(tesis) {
  if (!tesis.kbsTuru || !tesis.kbsTesisKodu || !tesis.kbsWebServisSifre) {
    throw new Error('KBS bilgileri eksik');
  }

  const raw = tesis.ipAdresleri;
  const ipAdresleri = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  const config = {
    tesisKodu: tesis.kbsTesisKodu,
    webServisSifre: tesis.kbsWebServisSifre,
    ipAdresleri
  };

  if (tesis.kbsTuru === 'jandarma') {
    return new JandarmaKBS(config.tesisKodu, config.webServisSifre, config.ipAdresleri);
  } else if (tesis.kbsTuru === 'polis') {
    return new PolisKBS(config.tesisKodu, config.webServisSifre, config.ipAdresleri);
  } else {
    throw new Error('Geçersiz KBS türü');
  }
}

module.exports = {
  createKBSService,
  JandarmaKBS,
  PolisKBS
};

