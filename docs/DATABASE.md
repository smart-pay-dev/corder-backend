# Veritabanı – Uzun vadeli kullanım (5–10 yıl)

Bu doküman, CORDER veritabanının uzun süre sorunsuz kullanımı için yapılan tasarım kararlarını ve önerileri özetler.

## Güçlü yönler

- **PostgreSQL**: Ölçeklenebilir, ACID uyumlu, yıllarca güvenle kullanılabilir.
- **Restoran izolasyonu**: Tüm iş verisi `restaurant_id` ile kapsanıyor; çok kiracılı yapı güvenli.
- **İlişkiler**: Foreign key’ler ve `ON DELETE CASCADE` ile tutarlılık korunuyor.
- **İndeksler**: Sık kullanılan sorgular için bileşik indeksler tanımlı:
  - `orders(restaurant_id, status)`, `orders(restaurant_id, created_at)`
  - `order_items(order_id)`
  - `categories(restaurant_id, slug)` (unique)
  - `cash_shifts(restaurant_id, status)`
  - `restaurant_staff(restaurant_id, pin)`
  - Diğer tablolarda `restaurant_id` indeksleri
- **Veri tipleri**: UUID primary key, `decimal` fiyatlar, `timestamptz` tarihler uygun seçilmiş.

## Öneriler (yıllar içinde)

1. **Yedekleme**
   - Günlük otomatik yedek (pg_dump veya sunucu tarafı snapshot).
   - En az bir yedeki farklı konumda saklayın.

2. **İzleme**
   - Disk kullanımı ve büyüyen tabloları (özellikle `orders`, `order_items`) periyodik kontrol edin.
   - Yavaş sorgular için `log_min_duration_statement` veya APM kullanın.

3. **Arşivleme (isteğe bağlı, çok büyürse)**
   - Eski kapalı siparişleri (örn. 2–3 yıldan eski) arşiv tablosuna veya soğuk depolamaya taşıyabilirsiniz; günlük sorgular hafifler.

4. **Production**
   - `synchronize: false` kullanın (zaten öyle); şema değişikliklerini migration ile yapın.
   - Bağlantı havuzu ve connection limit’leri makul tutun.

Bu yapı ve önerilerle veritabanı 5–10 yıl boyunca bakımı az, güvenilir şekilde kullanılabilir.
