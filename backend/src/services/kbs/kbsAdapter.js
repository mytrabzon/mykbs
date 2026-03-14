/**
 * Ortak KBS arayüzü: sendCheckIn, sendCheckOut, sendRoomChange.
 * Branch'tan tesis kodu/şifre alır; POLIS_KBS_URL / JANDARMA_KBS_URL boşsa mock kullanılır.
 */
const { createKBSService } = require('./index');

function createKBSClient(branch) {
  const tesisKodu = branch.kbs_tesis_kodu || branch.kbsTesisKodu;
  const webServisSifre = branch.kbs_web_servis_sifre || branch.kbsWebServisSifre;
  const kbsTuru = branch.kbs_turu || branch.kbsTuru;

  const useMock = !process.env.POLIS_KBS_URL && !process.env.JANDARMA_KBS_URL;
  if (useMock || !kbsTuru || !tesisKodu || !webServisSifre) {
    return getMockClient();
  }

  const tesis = {
    kbsTuru: kbsTuru,
    kbsTesisKodu: tesisKodu,
    kbsWebServisSifre: webServisSifre,
    ipAdresleri: []
  };

  let kbsService;
  try {
    kbsService = createKBSService(tesis);
  } catch (e) {
    console.warn('[KBS] createKBSService failed, using mock:', e.message);
    return getMockClient();
  }

  return {
    async sendCheckIn(payload) {
      const result = await kbsService.bildirimGonder({
        ad: payload.ad,
        ad2: payload.ad2 || null,
        anaAdi: payload.anaAdi || null,
        soyad: payload.soyad,
        kimlikNo: payload.kimlikNo || null,
        pasaportNo: payload.pasaportNo || null,
        dogumTarihi: payload.dogumTarihi,
        uyruk: payload.uyruk,
        misafirTipi: payload.misafirTipi || null,
        girisTarihi: payload.girisTarihi,
        odaNumarasi: payload.odaNumarasi
      });
      return { success: result.success, message: result.hataMesaji, data: result.yanit };
    },
    async sendCheckOut(payload) {
      const result = await kbsService.cikisBildir({
        kimlikNo: payload.kimlikNo || null,
        pasaportNo: payload.pasaportNo || null,
        cikisTarihi: payload.cikisTarihi
      });
      return { success: result.success, message: result.hataMesaji, data: result.yanit };
    },
    async sendRoomChange(payload) {
      const result = await kbsService.odaDegistir(
        {
          kimlikNo: payload.kimlikNo || null,
          pasaportNo: payload.pasaportNo || null,
          odaNumarasi: payload.eskiOda
        },
        payload.yeniOda
      );
      return { success: result.success, message: result.hataMesaji, data: result.yanit };
    }
  };
}

function getMockClient() {
  return {
    async sendCheckIn(payload) {
      console.log('[KBS Mock] sendCheckIn', JSON.stringify(payload));
      return { success: true, message: 'Mock OK', data: { mock: true } };
    },
    async sendCheckOut(payload) {
      console.log('[KBS Mock] sendCheckOut', JSON.stringify(payload));
      return { success: true, message: 'Mock OK', data: { mock: true } };
    },
    async sendRoomChange(payload) {
      console.log('[KBS Mock] sendRoomChange', JSON.stringify(payload));
      return { success: true, message: 'Mock OK', data: { mock: true } };
    }
  };
}

/**
 * Talimat uyumu: kind = "POLIS" | "JANDARMA" (branch.kbs_turu'dan: polis->POLIS, jandarma->JANDARMA).
 * Branch ile provider döner (credentials branch'tan).
 */
function getKbsProvider(branch) {
  return createKBSClient(branch);
}

module.exports = { createKBSClient, getMockClient, getKbsProvider };
