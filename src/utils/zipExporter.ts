import JSZip from 'jszip';
import { ELECTRON_CODE_FILES } from '../data/electronCodeFiles';

export async function downloadElectronProjectZip(): Promise<void> {
  const zip = new JSZip();

  // Cria a pasta raiz do projeto no zip
  const projectFolder = zip.folder('electron-mxf-audio-converter');

  if (!projectFolder) return;

  ELECTRON_CODE_FILES.forEach((file) => {
    projectFolder.file(file.name, file.code);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(content);

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = 'electron-mxf-converter-project.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}
