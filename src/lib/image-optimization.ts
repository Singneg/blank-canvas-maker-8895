import imageCompression from 'browser-image-compression';

export async function optimizeImage(file: File): Promise<File> {
  // Configurações de compressão e otimização
  const options = {
    maxSizeMB: 1, // Reduz para cerca de 1MB mantendo ótima qualidade
    maxWidthOrHeight: 1920, // Full HD como limite máximo
    useWebWorker: true,
    fileType: 'image/webp', // Converte para WebP
    initialQuality: 0.8,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    // Garantir que o nome do arquivo termine com .webp se foi convertido
    const fileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
    return new File([compressedFile], fileName, { type: 'image/webp' });
  } catch (error) {
    console.error("Erro ao otimizar imagem:", error);
    return file; // Retorna original em caso de falha
  }
}
