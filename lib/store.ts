import { db } from "../db/db";
import { Queries } from "../db/schemas";
import { eq } from "drizzle-orm";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
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
  contentType: string,
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
type resource = {
  id: string;
  name: string;
};
export async function saveIdResources(
  fileId: string,
  queryId: string,
  name: string,
) {
  // Fetch the current resources array associated with the queryId
  const [query] = await db
    .select({
      currentResources: Queries.resources,
    })
    .from(Queries)
    .where(eq(Queries.id, queryId));

  const resourcesArray: resource[] =
    (query.currentResources as resource[]) || [];

  // Check if the resource already exists
  if (!resourcesArray.some((resource) => resource.id === fileId)) {
    const newResource = { id: fileId, name };

    // Append the new resource and update the table
    await db
      .update(Queries)
      .set({ resources: [...resourcesArray, newResource] })
      .where(eq(Queries.id, queryId));
  }
}

export async function getResources(
  list: resource[],
): Promise<{ id: string; url: string }[]> {
  const s3 = new S3Client({
    region: region,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });

  const resourcePromises = list.map(async (res: resource) => {
    const fileId = res.id.split(".").shift() || "";

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileId,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return { id: res.id, url, name: res.name };
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

export async function DeleteResource(resourceId: string) {
  const input = {
    Bucket: bucketName,
    Key: resourceId,
  };
  const command = new DeleteObjectCommand(input);

  const s3 = new S3Client({
    region: region,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });
  await s3.send(command);
}
