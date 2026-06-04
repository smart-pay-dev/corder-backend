/**
 * Mevcut R2 nesnelerinin Cache-Control header'ını günceller.
 *
 * Kullanım:
 *   node scripts/r2-set-cache-headers.mjs
 *
 * Ortam değişkenleri (ya .env'den ya da export ile set edin):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_BASE_URL
 *
 * İpucu: .env dosyanız varsa şöyle çalıştırın:
 *   node --env-file=.env scripts/r2-set-cache-headers.mjs
 */

import { S3Client, ListObjectsV2Command, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
} = process.env

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('Eksik ortam değişkeni: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME gerekli.')
  process.exit(1)
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

async function listAllKeys() {
  const keys = []
  let continuationToken

  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      ContinuationToken: continuationToken,
    }))
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  return keys
}

async function getContentType(key) {
  const head = await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
  return head.ContentType ?? 'application/octet-stream'
}

async function updateCacheHeader(key) {
  const contentType = await getContentType(key)

  await client.send(new CopyObjectCommand({
    Bucket: R2_BUCKET_NAME,
    CopySource: `${R2_BUCKET_NAME}/${key}`,
    Key: key,
    ContentType: contentType,
    CacheControl: CACHE_CONTROL,
    MetadataDirective: 'REPLACE',
  }))
}

async function main() {
  console.log(`Bucket: ${R2_BUCKET_NAME}`)
  console.log('Nesneler listeleniyor...')

  const keys = await listAllKeys()
  console.log(`Toplam ${keys.length} nesne bulundu.\n`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const key of keys) {
    process.stdout.write(`  [${updated + skipped + failed + 1}/${keys.length}] ${key} ... `)
    try {
      await updateCacheHeader(key)
      console.log('✓')
      updated++
    } catch (err) {
      console.log(`HATA: ${err.message}`)
      failed++
    }
  }

  console.log(`\nTamamlandı: ${updated} güncellendi, ${skipped} atlandı, ${failed} hata.`)
}

main().catch((err) => {
  console.error('Beklenmedik hata:', err)
  process.exit(1)
})
