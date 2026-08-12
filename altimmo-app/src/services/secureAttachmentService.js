import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { environment } from '../config/environment';
import { getToken } from './api';

export async function downloadSecureAttachment(attachment) {
  const endpoint = attachment?.downloadEndpoint || attachment?.previewEndpoint;
  if (!endpoint) throw new Error('Pièce jointe indisponible.');
  const token = await getToken();
  const filename = String(attachment.nom || attachment.originalFilename || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '-');
  const result = await FileSystem.downloadAsync(
    `${environment.apiUrl}${endpoint.replace(/^\/api/, '')}`,
    `${FileSystem.cacheDirectory}${Date.now()}-${filename}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (result.status < 200 || result.status >= 300) throw new Error('Téléchargement impossible.');
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { dialogTitle: filename });
  return result.uri;
}
