# Workspace TODOs — Kullanım Kılavuzu

Sürüm 0.1.3 · VS Code 1.95 ve üzeri

Workspace TODOs, kod yorumlarındaki etiketleri renklendirir ve projedeki tüm etiketleri sol kenar çubuğunda toplar. Dosyaları tek tek açmadan yapılacak işleri, hataları ve açıklamaları görebilir; bir sonuca tıklayarak ilgili satıra gidebilirsin.

Bu kılavuzu eklenti içinden açmak için **TODOs → … → Usage Guide** yolunu veya **Ctrl+Shift+P → TODOs: Usage Guide** komutunu kullan.

## 1. Kurulum ve güncelleme

VSIX paketini kaynak koddan `npm ci` ve `npm run package` komutlarıyla oluşturabilir veya başarılı bir GitHub Actions CI çalışmasının **workspace-todos-vsix** çıktısından indirebilirsin. Ayrıntılı başlangıç adımları için [Türkçe README](README.tr.md) dosyasına bak.

1. VS Code'da **Ctrl+Shift+X** ile Extensions görünümünü aç.
2. Extensions başlığındaki **…** menüsünden **Install from VSIX…** seç.
3. `workspace-todos-0.1.3.vsix` dosyasını seç.
4. VS Code isterse **Reload** ile pencereyi yeniden yükle.
5. Proje klasörünü veya workspace'ini aç; sol ikon çubuğundaki liste/onay simgeli **TODOs** görünümünü seç.

Önceki sürüm kuruluysa aynı eklenti güncellenir. **Ctrl+B**, ana kenar çubuğunu gizler veya gösterir. TODOs görünümünü seçmek için kendi ikonuna tıkla.

### INFO güncelleme notu

Varsayılan etiket listesini kullanıyorsan INFO güncelleme sonrası otomatik kullanılabilir. Ayarlarına daha önce kendi `workspaceTodos.tags` listeni yazdıysan bu liste korunur. INFO'yu mevcut listene ekle:

```json
{ "name": "INFO", "color": "#56D4C2", "enabled": true }
```

Bu satır `workspaceTodos.tags` dizisinin bir öğesi olmalı. Diğer etiketlerini koru. Listeyi özelleştirmeye ihtiyacın yoksa Settings içindeki **Workspace TODOs: Tags** ayarını varsayılana döndürebilirsin.

## 2. Hızlı başlangıç

Bir Python dosyasına şu yorumları ekle:

```python
# TODO: Boş girişler için kontrol ekle
# FIXME: Kamera bağlantısı kopunca yeniden bağlan
# WARNING: Bu işlem veritabanına yazıyor
# INFO: Algılama modeli GPU üzerinde çalışır
# NOTE: Koordinatlar piksel cinsindendir
# HACK: Eski kamera sürücüsü için geçici çözüm
```

Etiketler kodda renklenecek ve yaklaşık 250 ms içinde TODOs listesinde görünecek. Kaydetmeden yapılan düzenlemeler de takip edilir. Kapalı dosyalar da workspace taramasına dahildir.

Bir sonuca tıkla: ilgili dosya açılır, etiket seçilir ve satır görünür alana getirilir.

## 3. Etiketlerin anlamı

| Etiket | Kullanım | Varsayılan editör rengi |
| --- | --- | --- |
| TODO | Henüz yapılmamış iş | Sarı |
| FIXME | Düzeltilmesi gereken hata | Kırmızı |
| WARNING | Yan etki veya dikkat gerektiren durum | Turuncu |
| INFO | Kodun çalışma şekli hakkında bilgi | Turkuaz |
| NOTE | Geliştirici notu veya hatırlatma | Mavi |
| HACK | Geçici çözüm veya sonradan gözden geçirilecek yaklaşım | Mor |

Örneğin `INFO: Sonuçlar önbellekten okunur` çalışma davranışını açıklar; `NOTE: API v2'ye geçerken bu bölümü kontrol et` bir geliştirici notudur. Bu ayrım kullanım önerisidir; etiketleri kendi çalışma biçimine göre kullanabilirsin.

## 4. Yorum yazma biçimleri

Etiket ile açıklama arasına iki nokta koyabilirsin; zorunlu değildir. Etiketin yanında parantez içinde isim de bulunabilir.

JavaScript / TypeScript / JSX / TSX:

```typescript
// TODO: Arama ekle
// INFO Sonuçlar bellekte tutulur
// FIXME(burak): Yeniden bağlanma hatasını düzelt
/* WARNING: Bu işlem dosyayı değiştirir */
/**
 * NOTE: Bu fonksiyon saniye cinsinden değer döndürür
 */
```

Python:

```python
# INFO: Görüntü boyutu 640x480
value = 10  # TODO: Bu değeri ayarlara taşı
```

CSS / SCSS:

```css
/* TODO: Mobil görünümü düzenle */
/* INFO: Renkler tasarım sisteminden gelir */
```

SCSS dosyalarında `// INFO: ...` biçimi de desteklenir. HTML:

```html
<!-- TODO: Alternatif metin ekle -->
<!-- INFO: Bu bölüm giriş yapan kullanıcılara gösterilir -->
```

JSONC dosyalarında `//` ve `/* ... */` yorumları kullanılabilir. Standart JSON yorum desteklemediğinden `.json` uzantılı kapalı dosyalar varsayılan taramaya dahil edilmez.

Bir yorum satırında birden fazla etiket bulunabilir. Her etiket ayrı sonuç olur; aynı satırdaki açıklaması bir sonraki etikette veya satır/yorum sonunda biter. Çoklu satır açıksa son etiketin açıklaması sonraki yorum satırlarında devam edebilir.

Etiketler yalnızca yorumlarda ve tam kelime olarak eşleşir. `TODO_COUNT` bir etiket değildir. Stringler, regex literal'ları, JSX metni ve Python docstring'leri tarama sonucu üretmez:

```python
message = "INFO: Bu string sonuçlara girmez"
"""TODO: Bu docstring de sonuçlara girmez."""
# INFO: Bu yorum sonuçlara girer
```

### Çoklu satır açıklamaları

Örneğin yorum haline getirilmiş birkaç Python satırını tek INFO kaydında toplayabilirsin:

```python
def main():
    # INFO: Yapılandırma kontrolü
    #ayarlar.create_config_file()
    #test = ayarlar.get("CORE", "Model")
    #print(test)
    return None
```

İlk satırdaki etiket sonraki satırlara uygulanır; aynı etiketi her satıra yazman gerekmez. Panelde **INFO · L2–5** gibi bir satır aralığı görünür. Kayıt üzerine gelince satır sonları ve yorum işaretinden sonraki kod girintileri korunarak tam açıklama gösterilir. Arama, açıklamanın devamını da kapsar. Sonuca tıklamak ilk satırdaki etikete gider.

Kurallar:

- `#` / `//` devam satırları peş peşe gelmeli, işaretleri aynı sütunda olmalı ve devam satırlarının önünde kod bulunmamalı.
- Boş fiziksel satır, yalnızca yorum işareti içeren boş yorum, farklı hizalama, gerçek kod veya yeni bir etiket mevcut kaydı bitirir.
- Kapatılmış bir etiket de önceki kaydı bitirir; onun metni önceki etiketin rengini almaz.
- `/* ... */`, JSDoc ve HTML `<!-- ... -->` yorumlarının içindeki devam satırları da desteklenir. Yorumun kapanışından sonra devam edilmez; ayrı bloklar birleştirilmez.
- Yorumların ilk satırında tanımlı bir etiket bulunmalı. Etiketsiz yorumlar kayıt oluşturmaz.

Özelliği ve tüm satırları boyamayı açmak için:

```json
{
  "workspaceTodos.multiline": true,
  "workspaceTodos.highlightMode": "line",
  "workspaceTodos.highlightCommentPrefix": true
}
```

**Multiline** ayarı varsayılan olarak açıktır. `false` yaparsan her kayıt yalnızca etiketin kendi satırındaki açıklamayı kullanır. `tag` modunda sadece etiket ve isteğe bağlı yorum işareti boyanır. `line` modunda devam satırları da aynı etiketin rengini alır; yorum işaretleri kapalıysa bu satırlardaki işaretler de boyanmaz.

## 5. TODOs penceresini okuma

- **Dosya satırı:** Dosya adı önde; sonuç sayısı ve klasör yolu daha soluk görünür. Dosya ikonları VS Code'un dosya ikon temasını izler.
- **Etiket satırı:** Renkli ikon, etiket adı ve `L24` gibi satır bilgisi önde; açıklama yanında daha soluk görünür. `L24`, dosyanın 24. satırı demektir. Çoklu satır kayıtlarında `L24–27` gibi başlangıç ve bitiş gösterilir.
- **Ayrıntılar:** Dosyanın veya sonucun üzerine gelerek tam yolu, etiket dağılımını ya da açıklamanın tamamını görebilirsin.
- **Sayaç:** Üstte görünen sayı mevcut filtrelere uyan toplam sonuç sayısıdır. Dosya sayaçları da filtrelenmiş sonuçları gösterir.
- **Birden fazla proje kökü:** Aynı adlı dosyalar workspace klasörleriyle ayırt edilir.

### Komutlar

| Komut | Ne yapar? |
| --- | --- |
| Search | Dosya yolu, etiket adı ve açıklamada metin arar. |
| Filter Tags | Gösterilecek etiketleri çoklu seçimle belirler. |
| Refresh | Workspace'i yeniden tarar; filtreleri korur. |
| Group By… → File | Etiketleri dosyaların altında toplar. |
| Group By… → Tag | Önce etiketleri, sonra ilgili dosyaları gösterir. |
| Choose Scope… → Entire workspace | Workspace'in tüm sonuçlarını gösterir. |
| Choose Scope… → Active file | Yalnızca aktif editör dosyasının sonuçlarını gösterir. |
| Clear Filters | Arama ve etiket filtrelerini temizler; kapsamı tüm workspace'e döndürür. |
| Collapse All | Ağaç gruplarını daraltır. |
| Settings | Eklenti ayarlarını açar. |
| Show Scan Details | Atlanan dosyaları ve tarama hatalarını Output kanalında gösterir. |
| Usage Guide | Bu kılavuzu açar. |

**Search**, **Filter Tags** ve **Refresh** üst araç çubuğundadır. Diğer komutlar görünümün **…** menüsünde bulunur. Komut paletinde **TODOs:** yazarak da komutları arayabilirsin.

Arama düz metinle çalışır; regex değildir ve büyük/küçük harfe duyarsızdır. Arama kutusunu boş bırakıp onaylayarak aramayı temizleyebilirsin. Etiket filtresindeki tüm işaretleri kaldırırsan hiçbir sonuç gösterilmez.

Arama, etiket filtresi ve kapsam birlikte uygulanır. Örneğin **Active file + INFO + GPU** yalnızca aktif dosyada INFO etiketi taşıyan ve aramaya uyan sonuçları gösterir. Gruplama ve filtreler workspace bazında hatırlanır. Bu filtreler editördeki kod vurgularını değiştirmez.

## 6. Vurgulama ayarları

**TODOs → … → Settings** yolunu kullan. VS Code Settings içindeki **User** sekmesi genel, **Workspace** sekmesi bu projeye ait tercihleri belirler. Çok köklü workspace'te ortak tercihler için Workspace ayarlarını kullan.

### Yorum işaretini de boya

```json
{
  "workspaceTodos.highlightCommentPrefix": true
}
```

Varsayılan olarak açıktır: `# TODO`, `// FIXME`, `/* INFO` ve `<!-- NOTE` başlangıçlarında işaret de boyanır. Çok satırlı yorumlarda etiketin bulunduğu satırın başındaki `*` desteklenir. Kapanış işaretleri bu ayara dahil değildir.

İşaret ile etiket arasında normal metin varsa yalnızca işaret ayrıca boyanır; aradaki metin boyanmaz. Aynı yorum satırında birden fazla etiket varsa işaret ilk etiketin rengini alır. `false` yapınca yorum işareti boyanmaz. Sonuca tıklamak her durumda etiketin kendisini seçer.

### Vurgunun uzunluğunu değiştir

| `workspaceTodos.highlightMode` | Davranış |
| --- | --- |
| `tag` | Etiket vurgulanır; yorum işareti ayarı açıksa işaret de eklenir. Varsayılandır. |
| `line` | Etiketten açıklamanın sonuna kadar vurgulanır. Multiline açıksa devam yorumları da boyanır. Sonraki etikette veya kaydın bittiği yerde durur. |
| `off` | Editör vurguları kapanır; TODOs listesi çalışmaya devam eder. |

Örnek:

```json
{
  "workspaceTodos.highlightMode": "line",
  "workspaceTodos.highlightCommentPrefix": true,
  "workspaceTodos.multiline": true,
  "workspaceTodos.caseSensitive": false
}
```

`caseSensitive` varsayılan olarak `false` olduğundan `INFO` ve `info` eşleşir. `true` yaparsan yazım etiket tanımıyla aynı olmalıdır.

## 7. Etiket ve renkleri özelleştirme

`workspaceTodos.tags`, kullanılacak listenin tamamını belirler. Bir etiket eklerken mevcut etiketlerini de listede tut. Örneğin varsayılanlara REVIEW eklemek için:

```json
{
  "workspaceTodos.tags": [
    { "name": "TODO", "color": "#E5C07B", "enabled": true },
    { "name": "FIXME", "color": "#F07178", "enabled": true },
    { "name": "WARNING", "color": "#F5A45D", "enabled": true },
    { "name": "INFO", "color": "#56D4C2", "enabled": true },
    { "name": "NOTE", "color": "#82AAFF", "enabled": true },
    { "name": "HACK", "color": "#C792EA", "enabled": true },
    { "name": "REVIEW", "color": "#A8D8A8", "enabled": true }
  ]
}
```

- `name`: Harfle başlayan, en fazla 32 karakterlik etiket adı. Harf, rakam, alt çizgi ve tire kullanılabilir; adlar regex değildir.
- `color`: Altı haneli hex renk; editördeki arka planı belirler. Yazı rengi okunabilirlik için otomatik seçilir.
- `enabled`: `false` olan etiket hem taramadan hem vurgulamadan çıkar. Geçici olarak sadece listede gizlemek için **Filter Tags** kullan.

Panel ikonları ayrı tema renklerini kullanır; açık, koyu ve yüksek kontrast temalara uyarlanır. Örneğin yalnızca paneldeki INFO ikonunu değiştirmek için:

```json
{
  "workbench.colorCustomizations": {
    "workspaceTodos.infoForeground": "#56D4C2"
  }
}
```

Diğer renk adları: `workspaceTodos.todoForeground`, `fixmeForeground`, `warningForeground`, `noteForeground`, `hackForeground` ve `customForeground`. Bu kısaltılmış adların her biri `workspaceTodos.` önekiyle yazılmalıdır. Özel etiket ikonları `workspaceTodos.customForeground` rengini paylaşır.

## 8. Taranacak dosyaları seçme

`workspaceTodos.include` ve `workspaceTodos.exclude` ayarları workspace köküne göre glob listeleridir. Örneğin yalnızca belirli klasörleri dahil etmek için:

```json
{
  "workspaceTodos.include": ["src/**", "app/**", "scripts/**"]
}
```

Tüm desteklenen dosyalar için include varsayılanı `["**/*"]` olmalıdır. Boş liste taramayı kapatır. Dahil edilen dosya yine de dışlama kuralına uyuyorsa taranmaz.

Varsayılan dışlamalar arasında `.git`, `node_modules`, `dist`, `build`, `out`, `coverage`, sanal ortamlar ve üretilmiş/minify dosyaları vardır. Kendi dışlama listen mevcut varsayılanların yerine geçer; yeni desen eklerken korumak istediğin eski öğeleri de listede tut. Açık dosyalar için de aynı kurallar geçerlidir.

`.gitignore`, `files.exclude` ve `search.exclude` bu sürümde otomatik içe aktarılmaz.

`workspaceTodos.maxFileSizeKB` varsayılan olarak **1024 KiB / 1 MiB** değerindedir. Büyük dosya gerekiyorsa sınırı ayarlardan artırabilirsin. İkili, okunamayan veya sınırı aşan dosyalar atlanır; nedenleri **Show Scan Details** içinde gösterilir.

## 9. Desteklenen diller ve kapsam

JavaScript (`js`, `mjs`, `cjs`), TypeScript (`ts`, `mts`, `cts`), JSX, TSX, Python (`py`, `pyw`), CSS, SCSS, HTML (`html`, `htm`) ve JSONC desteklenir. Açık dosyalarda VS Code'un seçili dil modu kullanılır.

Python f-string içerikleri, HTML içindeki script/style/textarea/title içerikleri, Markdown görev listeleri, notebook hücreleri ve diğer diller bu sürümün tarama kapsamına dahil değildir. Metin dosyalarında UTF-8 ve BOM içeren UTF-16 desteklenir.

Dosya ekleme, değiştirme, silme ve yeniden adlandırma otomatik izlenir. Kod yorumları ve dosya içerikleri eklenti tarafından değiştirilmez. Veriler yerel işlenir; sunucu veya API anahtarı gerekmez.

## 10. Sık karşılaşılan durumlar

| Durum | Kontrol et |
| --- | --- |
| INFO görünmüyor | Özel `workspaceTodos.tags` listene INFO ekle; **Filter Tags** içinde seçili olduğundan emin ol. |
| Hiç sonuç yok | Workspace klasörünü aç; **Clear Filters** kullan; dosyanın desteklenen dilde ve yorumun içinde olduğundan emin ol. |
| Yalnızca bir dosya görünüyor | **Choose Scope… → Entire workspace** seç. |
| Etiket listede var ama kodda boyanmıyor | `highlightMode` değerinin `off` olmadığını kontrol et. |
| `#` veya `//` boyanmıyor | **Highlight Comment Prefix** ayarını aç. |
| Dosya hiç taranmıyor | Include/exclude kurallarını, dosya boyutunu ve seçili dil modunu kontrol et; **Show Scan Details** aç. |
| Bir etiket kapatıldı | `tags` içindeki `enabled` değerini kontrol et. Ayar değişikliği sonrası tarama otomatik yenilenir. |
| Devam satırları boyanmıyor | **Multiline** açık, **Highlight Mode** `line` olmalı. İlk satırda bir etiket, devam satırlarında aynı hizada yorum işareti bulunmalı. |
| Güncelleme uygulanmamış görünüyor | Extensions ayrıntılarında 0.1.3 sürümünü kontrol et; gerekirse **Developer: Reload Window** komutunu kullan. |
| Liste beklediğin gibi yenilenmiyor | **Refresh** kullan. Bu komut filtreleri korur; filtreleri sıfırlamak için ayrıca **Clear Filters** kullan. |
