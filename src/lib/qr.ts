import QRCode from "qrcode";

export async function generateRegistrationQrCode(registrationId: string): Promise<string> {
  return QRCode.toDataURL(registrationId);
}
