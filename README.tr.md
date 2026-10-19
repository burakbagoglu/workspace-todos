# Workspace TODOs

[English](README.md) · Türkçe · [Kullanım kılavuzu](KULLANIM_KILAVUZU.md)

Kod yorumlarındaki **TODO**, **FIXME**, **WARNING**, **INFO**, **NOTE** ve **HACK** etiketlerini renklendirir. Sol ikon çubuğundaki **TODOs** görünümünden workspace'in tamamındaki etiketleri takip edebilirsin.

Türkçe kullanım kılavuzunu **TODOs → … → Usage Guide** menüsünden veya komut paletindeki **TODOs: Usage Guide** komutuyla açabilirsin. Kılavuz paket içindeki `KULLANIM_KILAVUZU.md` dosyasında da bulunur.

## Kurulum

Node.js 22+ ile kaynak koddan kurulum paketi oluşturabilirsin:

```sh
git clone https://github.com/burakbagoglu/workspace-todos.git
cd workspace-todos
npm ci
npm run package
```

Başarılı GitHub Actions **CI** çalışmasının **Artifacts → workspace-todos-vsix** çıktısından da VSIX paketini indirebilirsin. Artifact ZIP dosyasını açıp aşağıdaki adımlarla `.vsix` dosyasını yükle.

1. VS Code'da Extensions görünümünü aç (`Ctrl+Shift+X`).
2. Üstteki `…` menüsünden **Install from VSIX…** seç.
3. Bu klasördeki `workspace-todos-0.1.3.vsix` dosyasını seç. Önceki sürüm kuruluysa aynı eklenti güncellenir; VS Code isterse pencereyi yeniden yükle.
4. Projeni aç ve sol çubuktaki liste/onay ikonuna tıkla.

Ana kenar çubuğu mevcut **Ctrl+B** kısayoluyla açılıp kapanır. Eklenti klavye kısayollarını değiştirmez. VS Code **1.95+** gerekir.

## Kullanım

```typescript
// TODO: Arama özelliğini ekle
// FIXME: Boş listede oluşan hatayı düzelt
// WARNING: Bu işlem veritabanına yazıyor
// INFO: Bu işlem sonuçları önbellekten okur
// NOTE: Yeni API kullanılacak
// HACK: Eski sürüm için geçici çözüm
/* TODO(burak): Çok satırlı yorumlar da desteklenir */
```

- Sonuca tıklayınca dosya açılır ve etiket seçilir.
- **Search**: açıklama, etiket adı ve dosya yolunda düz metin arar. Açılan giriş kutusunu boş bırakarak sorguyu temizleyebilirsin.
- **Filter Tags**: birden fazla etiket seçebilirsin. Hepsini kaldırmak tüm sonuçları gizler.
- **Refresh**: workspace'i yeniden tarar; filtreleri korur.
- Görünümün `…` menüsünden **Group By…**, **Choose Scope…**, **Clear Filters**, **Collapse All**, **Settings**, **Show Scan Details** ve **Usage Guide** komutları kullanılabilir. Aynı komutlara komut paletindeki `TODOs:` önekiyle erişilir.
- Gruplama, arama ve filtreler workspace bazında hatırlanır. Filtreler kod vurgularını gizlemez.
- Kaydedilmemiş değişiklikler yaklaşık 250 ms sonra listede görünür.
- Etiketler renkli ikonlarla ayrılır. Dosya adı önde, klasör ve sonuç sayısı daha soluk gösterilir. Sonuçlarda etiket ve `L24` gibi satır bilgisi önde; açıklama ayrı, daha soluk bir alandadır.

## Çoklu satır

İlk satıra bir etiket yazıp açıklamayı sonraki yorumlarda devam ettirebilirsin:

```python
# INFO: Yapılandırma kontrolü
#ayarlar.create_config_file()
#test = ayarlar.get("CORE", "Model")
#print(test)
```

Bu blok tek kayıt olur. Panelde satır aralığı gösterilir; üzerine gelince açıklamanın tamamı okunabilir. Arama devam satırlarını da kapsar. Etiketsiz yorumlar tek başına kayıt oluşturmaz.

Peş peşe `#` ve `//` yorumlarında işaretler aynı sütunda olmalı. Boş satır, boş yorum satırı, gerçek kod, farklı hizalama veya yeni etiket kaydı bitirir. `/* ... */`, JSDoc ve `<!-- ... -->` içinde de çoklu satır desteklenir; ayrı blok yorumlar birleştirilmez.

Devam satırlarını da boyamak için:

```json
{
  "workspaceTodos.multiline": true,
  "workspaceTodos.highlightMode": "line",
  "workspaceTodos.highlightCommentPrefix": true
}
```

`multiline` varsayılan olarak açıktır. `false` yaparak tek satır açıklamalara dönebilirsin. `tag` vurgulama modunda yalnızca etiket ve isteğe bağlı yorum işareti boyanır; `line` modunda açıklama ve devam satırları da boyanır.

## Desteklenen diller

JavaScript (`js`, `mjs`, `cjs`), TypeScript (`ts`, `mts`, `cts`), JSX, TSX, Python, CSS, SCSS, HTML ve JSONC. Açık dosyalarda VS Code'un seçili dil modu kullanılır.

Etiketler yalnızca yorumlarda ve tam kelime olarak bulunur. `TODO_COUNT`, stringler, regex literal'ları, JSX metni ve Python docstring'leri sonuç üretmez. Python f-string içerikleri ve HTML içindeki script/style/textarea/title içerikleri taranmaz. Markdown, notebook hücreleri ve diğer diller bu sürümde desteklenmez.

## Ayarlar

VS Code Settings içinde **Workspace TODOs** ara. Örnek `settings.json`:

```json
{
  "workspaceTodos.caseSensitive": false,
  "workspaceTodos.highlightMode": "tag",
  "workspaceTodos.highlightCommentPrefix": true,
  "workspaceTodos.multiline": true,
  "workspaceTodos.maxFileSizeKB": 1024,
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

`highlightMode`: `tag` etiketi, `line` etiketin açıklamasını ve çoklu satır açıksa devam satırlarını vurgular; `off` vurguları kapatır. Yorum işaretinin boyanması ayrı ayara bağlıdır. Liste her durumda çalışmaya devam eder. Renkler altı haneli hex olmalı. Etiket adları en fazla 32 karakter olabilir; harfle başlamalı, harf/rakam/alt çizgi/tire içermelidir. Etiketler regex olarak yorumlanmaz.

`highlightCommentPrefix`: varsayılan olarak açıktır. `# TODO` ve `// FIXME` gibi yorumlarda işareti de etikete dahil ederek boyar. Aynı satırdaki `/*`, `<!--` ve çok satırlı yorumların başındaki `*` işaretleri de desteklenir. İşaret ile etiket arasında normal metin varsa yalnızca işaret ayrıca boyanır; bu metne vurgu eklenmez. Aynı yorum satırında birden fazla etiket varsa işaret ilk etiketin rengini alır. `false` yaparak yalnızca etiketi boyayan eski davranışa dönebilirsin. Satıra gitme işlemi her zaman etiketin kendisini seçer.

Panel ikonlarının renkleri açık/koyu/yüksek kontrast temaya uyarlanır. İstersen `workbench.colorCustomizations` içinde `workspaceTodos.todoForeground`, `workspaceTodos.fixmeForeground`, `workspaceTodos.warningForeground`, `workspaceTodos.infoForeground`, `workspaceTodos.noteForeground`, `workspaceTodos.hackForeground` ve `workspaceTodos.customForeground` renklerini değiştirebilirsin. `workspaceTodos.tags` içindeki renkler editör vurgularını belirler.

Önceki sürümden güncellediğinde kendi `workspaceTodos.tags` listen varsa yeni varsayılanlar bu listenin yerine geçmez. INFO kullanmak için listene `{ "name": "INFO", "color": "#56D4C2", "enabled": true }` ekle veya etiketi ayarlardan varsayılana döndür.

`workspaceTodos.include` ve `workspaceTodos.exclude`, workspace köklerine göre glob listeleridir. Varsayılan olarak `.git`, `node_modules`, derleme çıktıları, sanal ortamlar, minify dosyaları ve kilit dosyaları dışlanır. Listeyi değiştirirken korumak istediğin varsayılan dışlamaları da ekle. Dışlamalar açık dosyaların vurguları için de geçerlidir. `.gitignore`, `files.exclude` ve `search.exclude` bu sürümde otomatik içe aktarılmaz.

Varsayılan dosya sınırı 1 MiB'dir. İkili, okunamayan veya büyük dosyalar atlanır; görünümde atlanan dosya sayısı, **Show Scan Details** ile nedenleri görülebilir. UTF-8 ve BOM içeren UTF-16 metin dosyaları desteklenir. Veriler yerel işlenir; sunucu veya API anahtarı gerekmez.

## Geliştirme

Node.js 22+ ve npm kullan:

```sh
npm ci
npm run check
npm test
npm run build
```

Bu klasörü VS Code'da açıp **F5** ile eklentiyi ayrı Extension Development Host penceresinde başlatabilirsin. `examples/` klasörü otomatik açılır; sol çubuktan **TODOs** görünümünü seç.

```sh
npm run test:integration
npm run package
```

Entegrasyon testleri `.test-runs/` içinde ayrı profil ve iki köklü test workspace'i kullanır. Windows'ta yerel VS Code otomatik bulunur. Başka bir konum veya platform için `VSCODE_EXECUTABLE_PATH` ortam değişkenini belirt. Alternatif olarak `VSCODE_TEST_VERSION=1.95.3` ile resmi VS Code test kopyası indirilebilir. Test sonuçları `test-results/integration.json` dosyasına yazılır. Paketleme çıktısı `workspace-todos-0.1.3.vsix` olur; Marketplace yayını yapmaz.

Katkı ve geliştirme ayrıntıları için [CONTRIBUTING.md](CONTRIBUTING.md), lisans için [LICENSE](LICENSE) dosyasına bak.
