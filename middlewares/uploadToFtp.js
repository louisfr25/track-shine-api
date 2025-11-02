import multer from 'multer';
import ftp from 'basic-ftp';
import fs from 'fs';
import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

export const uploadFtp = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export async function uploadBufferToFtp(buffer, remoteFilename) {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    // Build access options. By default we require a valid TLS certificate.
    // If your provider uses a certificate whose SAN does not match the FTP hostname
    // you can set FTP_INSECURE=true (NOT RECOMMENDED for production) to skip verification.
    const accessOptions = {
      host: process.env.FTP_HOST,
      port: process.env.FTP_PORT ? Number(process.env.FTP_PORT) : 21,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      secure: true
    };

    if (process.env.FTP_INSECURE === 'true') {
      // Pass TLS options through to disable certificate validation (for debugging only)
      accessOptions.secureOptions = { rejectUnauthorized: false };
    }

    await client.access(accessOptions);

  // basic-ftp requires a local file or stream; write a temporary file
  const tmpPath = path.join(os.tmpdir(), `upl-${Date.now()}${path.extname(remoteFilename)}`);
  fs.writeFileSync(tmpPath, buffer);
    await client.ensureDir('/'); // s'assure que remote root existe
    await client.uploadFrom(tmpPath, remoteFilename);
    fs.unlinkSync(tmpPath);
  } finally {
    client.close();
  }
}