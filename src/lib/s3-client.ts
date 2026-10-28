import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3 = new S3Client({
  endpoint:
    (typeof process !== 'undefined' && process.env && process.env.AWS_ENDPOINT_URL_S3) ||
    'https://br-wild-violet-b5vs5hdr.storage.c-7.us-east-2.aws.neon.tech',
  region:
    (typeof process !== 'undefined' && process.env && process.env.AWS_REGION) || 'us-east-2',
  credentials: {
    accessKeyId:
      (typeof process !== 'undefined' && process.env && process.env.AWS_ACCESS_KEY_ID) ||
      'nak_live_dd38086f45694d94b36b3f07611b302c',
    secretAccessKey:
      (typeof process !== 'undefined' && process.env && process.env.AWS_SECRET_ACCESS_KEY) ||
      'nsk_live_7320081e71198d1ce3c7766ba570d883abf2729b818e806f31163e63a8092bab',
  },
  forcePathStyle: true,
});

export const S3_BUCKET =
  (typeof process !== 'undefined' && process.env && process.env.AWS_S3_BUCKET) || 'assets';

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
