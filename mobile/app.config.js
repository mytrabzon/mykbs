// .env'i app.config yüklenirken oku (Supabase URL/anon key tam gelsin)
const path = require("path");
const fs = require("fs");
try {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
      if (!/^\s*EXPO_PUBLIC_(SUPABASE_|USE_TRPC|BACKEND)/.test(line)) return;
      const eq = line.indexOf("=");
      if (eq === -1) return;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      val = val.replace(/\s*#.*$/, '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    });
  }
} catch (_) {}

export default {
  expo: {
    name: "KBS Prime",
    slug: "mykbs",
    owner: "luvolive",
    scheme: "mykbs",
    version: "1.0.2",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      // image: "./assets/splash.png", // Asset dosyası oluşturulana kadar yorum satırı
      resizeMode: "contain",
      backgroundColor: "#007AFF"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.litxtech.mykbs",
      infoPlist: {
        UIDeviceFamily: [1],
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "Kimlik ve pasaport bilgilerinin doğrulanması amacıyla belge görüntüsünün taranabilmesi için kamera erişimi gereklidir. Alınan görüntüler yalnızca yasal bildirim süreci kapsamında işlenir.",
        NSPhotoLibraryUsageDescription: "Kimlik veya pasaport görsellerinin sistem üzerinden yüklenebilmesi için fotoğraf arşivine erişim gereklidir. Yüklenen veriler yalnızca yasal bildirim ve kayıt işlemleri için kullanılır.",
        NSLocationWhenInUseUsageDescription: "Gerçekleştirilen bildirimin ilgili resmi makamlara doğru konum bilgisiyle iletilebilmesi amacıyla uygulama kullanım sırasında konum erişimi talep eder.",
        NSUserTrackingUsageDescription: "Uygulama kullanıcı takibi yapmaz.",
        NFCReaderUsageDescription: "Kimlik ve pasaport çipi okuma amacıyla NFC erişimi gereklidir."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.litxtech.mykbs",
      versionCode: 2,
      permissions: [
        "android.permission.NFC",
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.POST_NOTIFICATIONS"
      ],
      compileSdkVersion: 35,
      targetSdkVersion: 35,
      buildToolsVersion: "35.0.0",
      kotlinVersion: "2.0.21",
      enableProguardInReleaseBuilds: false,
      enableShrinkResourcesInReleaseBuilds: false,
      gradleProperties: {
        "org.gradle.jvmargs": "-Xmx4096m -XX:MaxMetaspaceSize=512m",
        "kotlin.code.style": "official",
        "kotlin.compiler.jvm.target": "17"
      }
    },
    web: {
      // favicon: "./assets/favicon.png" // Asset dosyası oluşturulana kadar yorum satırı
    },
    plugins: [
      "expo-camera",
      [
        "react-native-iap",
        { "paymentProvider": "both" }
      ],
      [
        "react-native-nfc-manager",
        {
          nfcPermission: "Kimlik okumak için NFC izni gerekli",
          // iOS: Pasaport/kimlik çipi (ISO 7816) okumak için AID listesi gerekli; yoksa çip okuma açılmaz.
          selectIdentifiers: [
            "A0000002471001", // e-Pasaport (ICAO)
            "A0000002472001",
            "00000000000000"  // Bazı kimlik kartları
          ]
        }
      ],
      [
        "expo-build-properties",
        {
          android: {
            kotlinVersion: "2.0.21",
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: "35.0.0",
            minSdkVersion: 24
          },
          // iOS: New Arch kapalı — react-native-iap RCT-Folly bulunamıyor hatasını önler (EAS prebuild)
          ios: {
            newArchEnabled: false
          }
        }
      ]
    ],
    extra: {
      // EAS Build proje ID (eas init ile oluşturuldu)
      eas: {
        projectId: "89b94f18-d723-4cac-a113-5259fbed0af7",
      },
      // İletişim (uygulama içi Ayarlar ve yasal metinlerle uyumlu)
      EXPO_PUBLIC_SUPPORT_EMAIL: "support@litxtech.com",
      EXPO_PUBLIC_SUPPORT_PHONE: "0850 304 5061",
      EXPO_PUBLIC_SUPPORT_PHONE_TEL: "tel:08503045061",
      // Supabase – tek backend
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "https://iuxnpxszfvyrdifchwvr.supabase.co",
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
      backendMode: process.env.EXPO_PUBLIC_BACKEND_MODE || "supabase",
      EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL: process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || "",
      EXPO_PUBLIC_USE_TRPC: process.env.EXPO_PUBLIC_USE_TRPC === "true",
      // KBS backend (Node) – tanımlıysa health + checkin buraya gider
      backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL || "",
      // Development mode
      NODE_ENV: process.env.NODE_ENV || "development",
    }
  }
};

