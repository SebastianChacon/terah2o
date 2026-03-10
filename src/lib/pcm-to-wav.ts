/**
 * Convierte datos PCM en formato WAV para reproducción de audio.
 * Basado en HIDROMETEOROLOGIA.HTML líneas 103-123.
 */
export function pcmToWav(pcmBase64: string, sampleRate: number): Blob {
  const pcmString = atob(pcmBase64);
  const len = pcmString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + len, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, len, true);

  for (let i = 0; i < len; i++) {
    view.setUint8(44 + i, pcmString.charCodeAt(i));
  }

  return new Blob([buffer], { type: "audio/wav" });
}
