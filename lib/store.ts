import { db } from "../db/db";
import { Queries } from "../db/schemas";
import { eq } from "drizzle-orm";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const region = process.env.AWS_BUCKET_REGION!;
const bucketName = process.env.AWS_BUCKET_NAME!;
const accessKeyId = process.env.AWS_ACCESS_KEY!;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;

export const s3 = new S3Client({
  region: region,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
});

export async function upload(
  arrayBuffer: ArrayBuffer,
  name: string,
  contentType: string
) {
  const uint8Array = new Uint8Array(arrayBuffer);

  const params = {
    Bucket: bucketName,
    Body: uint8Array,
    Key: name,
    ContentType: contentType,
  };
  const command = new PutObjectCommand(params);

  return s3.send(command);
}

export async function saveIdResources(fileId: string, queryId: string) {
  const [resources] = await db
    .select({
      currentResources: Queries.resources,
    })
    .from(Queries)
    .where(eq(Queries.id, queryId));

  const resourcesArray = resources.currentResources || [];
  if (!resourcesArray.includes(fileId)) {
    await db
      .update(Queries)
      .set({ resources: [...resourcesArray, fileId] })
      .where(eq(Queries.id, queryId));
  }
}

export async function getResources(
  list: string[]
): Promise<{ id: string; url: string }[]> {
  const s3 = new S3Client({
    region: region,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });

  const resourcePromises = list.map(async (idResource: string) => {
    const fileId = idResource.split(".").shift() || "";

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileId,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return { id: idResource, url };
  });

  // Wait for all the promises to resolve
  const resources = await Promise.all(resourcePromises);
  return resources;
}

export async function getResource(idResource: string) {
  const s3 = new S3Client({
    region: region,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: idResource,
  });

  return await getSignedUrl(s3, command, { expiresIn: 3600 });
}
