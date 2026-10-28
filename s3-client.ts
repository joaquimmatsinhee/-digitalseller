import 'dotenv/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3 = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL_S3 || 'https://br-wild-violet-b5vs5hdr.storage.c-7.us-east-2.aws.neon.tech',
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'nak_live_dd38086f45694d94b36b3f07611b302c',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'nsk_live_7320081e71198d1ce3c7766ba570d883abf2729b818e806f31163e63a8092bab',
  },
  forcePathStyle: true,
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET || 'assets';

export async function uploadFile(key: string, body: string | Buffer | Uint8Array, contentType?: string): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return getFileViewUrl(key);
}

export async function getFileViewUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

// Example usage when executed directly: npx tsx s3-client.ts
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('s3-client.ts')) {
  (async () => {
    try {
      const bucket = S3_BUCKET;
      const key = 'uploads/file.txt';
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: 'Hello World!' }));
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
      console.log(`[view] ${url}`);
    } catch (err) {
      console.error('S3 Client execution error:', err);
    }
  })();
}
