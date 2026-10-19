// TODO: Workspace içinde arama ekle
// FIXME: Boş sonuçta yükleniyor göstergesini kapat
// WARNING: Bu işlem veritabanına yazıyor
// INFO: Bu işlem sonuçları önbellekten okur
// NOTE: Etikete tıklayarak bu satıra dönebilirsin
// HACK: Eski API için geçici çözüm
// DONE: İlk kurulum tamamlandı; Show Completed ile listede göster

const example = "TODO: Bu bir string; sonuçlarda görünmez.";
export const message = example;

/**
 * TODO(burak): Koyu tema kontrolünü tamamla
 */
export function welcome(name: string) {
  return `Merhaba ${name}`;
}

// TODO: Çoklu satır örneği
// Arama yalnızca başlığı değil bu açıklamayı da kapsar.
// Line vurgulama modunda devam satırları da boyanır.
