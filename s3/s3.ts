import aws from "aws-sdk";

const region ="us-west-1";
const bucketName = "test-famed";
const accessKeyId = "";
const secretAccessKey = "";

export const s3 = new aws.S3({
    region,
    accessKeyId,
    secretAccessKey,
    signatureVersion: "v4",
})