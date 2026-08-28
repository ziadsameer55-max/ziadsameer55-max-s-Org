import { apiFetch } from './api';

export async function downloadAdminBackupFile(
  endpoint: string,
  fallbackFileName: string,
  onProgress?: (loading: boolean) => void
): Promise<void> {
  if (onProgress) onProgress(true);
  try {
    const res = await apiFetch(endpoint);
    if (!res.ok) {
      let errorMsg = 'تعذر تنزيل الملف، يرجى التأكد من الصلاحيات';
      try {
        const json = await res.json();
        if (json.error) errorMsg = json.error;
      } catch {}
      throw new Error(errorMsg);
    }

    const blob = await res.blob();
    let fileName = fallbackFileName;
    const disposition = res.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error('Download error:', err);
    throw err;
  } finally {
    if (onProgress) onProgress(false);
  }
}
