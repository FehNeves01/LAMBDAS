import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import JSZip from "jszip";

var s3 = null;
export const handler = async (event) => {
  console.log(event);
  const request = JSON.parse(event.body);
  s3 = new S3Client({ region: request.regiao });

  // await debug();
  try {
    await processObjects(request);
    const response = {
      statusCode: 200,
      body: JSON.stringify(request),
    };
    return response;
  } catch (error) {
    console.log("Erro:", error);
    return {
      statusCode: 500,
      body: JSON.stringify("Erro ao executar a função Lambda."),
    };
  }
};
async function processObjects(path) {
  let complementoNomeArquivo = 0;
  let IsTruncated = false;
  let NextContinuationToken = null;
  let objectsResponse = null;

  do {
    objectsResponse = await getObjectResponse(path, NextContinuationToken);
    console.log("objectsResponse", objectsResponse);
    // console.log(objectsResponse.Contents.length);

    const zipContent = await campactaArquivosInConstZip(objectsResponse, path);
    console.log("zip content", zipContent);
    const zipFileName = await getNameArchZip(complementoNomeArquivo, path);
    console.log(zipFileName, zipContent);

    await uploadToS3(zipContent, path, zipFileName);
    console.log("finalizou o upload");
    if (objectsResponse.IsTruncated) {
      IsTruncated = true;
      NextContinuationToken = objectsResponse.NextContinuationToken;
      complementoNomeArquivo++;
    } else {
      IsTruncated = false;
    }
  } while (IsTruncated);
}
async function getObjectResponse(path, NextContinuationToken) {
  if (!NextContinuationToken) {
    return await listObjects(path);
  } else {
    return await listObjectsWithNextContinuationToken(
      path,
      NextContinuationToken
    );
  }
}
async function listObjects(path) {
  const prefix = `${path.path}`;
  console.log("listObjects", prefix);
  const listObjectsParams = {
    Bucket: path.bucket,
    MaxKeys: 50,
  };
  const listObjectsCommand = new ListObjectsV2Command(listObjectsParams);
  const objectsResponse = await s3.send(listObjectsCommand);

  console.log("objeto da resposta", objectsResponse);
  return objectsResponse;
}
async function listObjectsWithNextContinuationToken(
  path,
  NextContinuationToken
) {
  const prefix = `${path.path}`;
  const listObjectsParams = {
    Bucket: path.bucket,
    MaxKeys: 50,
    ContinuationToken: NextContinuationToken,
  };
  const listObjectsCommand = new ListObjectsV2Command(listObjectsParams);
  const objectsResponse = await s3.send(listObjectsCommand);
  return objectsResponse;
}
async function campactaArquivosInConstZip(objectsResponse, path) {
  let numberTeste = 1;
  const zip = new JSZip();
  await Promise.all(
    objectsResponse.Contents.map(async (objeto) => {
      const origemKey = objeto.Key;
      let teste = await getObjectContent(path, origemKey);
      console.log(teste);
      zip.file(objeto.Key, teste, { binary: true });
      console.log(numberTeste);
      console.log(objeto.Key);
      numberTeste++;
    })
  ).catch((e) => {
    console.error("error dentro do loop do promise", e);
  });
  console.log("terminou Loop");
  console.log("antes do return", zip);
  var sinc = null;
  try {
    sinc = await zip.generateAsync({ type: "nodebuffer" });
  } catch (error) {
    console.error(error);
  }
  console.log(sinc);
  return sinc;
}
async function getObjectContent(path, key) {
  const prefix = path.path;
  const params = {
    Bucket: path.bucket,
    Key: key,
  };

  const response = await s3.send(new GetObjectCommand(params));
  return response.Body;
}
async function getNameArchZip(complementoNomeArquivo,path) {
  return `${path.aplicacaoId}${
    complementoNomeArquivo > 0 ? complementoNomeArquivo : ""
  }.zip`;
}
async function uploadToS3(content, path, key) {
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/PutObjectCommand/
    const moment = new Date();
  moment.setMinutes(moment.getMinutes() + 2);
  try {
    const params = {
      Bucket: path.bucket,
      Key: key,
      Body: content,
      ContentType: "application/zip",
      Expires:moment,

    };
    var uploaded = null;
    console.log("====================================");
    console.log("param upload", params);
    console.log(
      "URL do objeto:",
      `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`
    );
    console.log("====================================");

    uploaded = await s3.send(new PutObjectCommand(params));
    console.log("Arquivo enviado com sucesso!", uploaded);
  } catch (error) {
    console.error(error);
  }
}
async function debug() {
  const prefix = "exports/folhas-de-resposta/6532";
  const listObjectsParams = {
    Bucket: "alfreddev",
    
    MaxKeys: 50,
  };
  const listObjectsCommand = new ListObjectsV2Command(listObjectsParams);
  const objectsResponse = await s3.send(listObjectsCommand);
}
