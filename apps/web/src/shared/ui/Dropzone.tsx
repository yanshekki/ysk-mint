import { useRef } from "react";
import { useTranslation } from "react-i18next";

export function Dropzone({
  preview,
  onFile,
}: {
  preview?: string;
  onFile: (url: string) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);

  function take(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    onFile(URL.createObjectURL(file));
  }

  return (
    <button
      type="button"
      className="dropzone w-full"
      onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        take(e.dataTransfer.files[0]);
      }}
    >
      {preview ? (
        <img src={preview} alt="" className="mx-auto h-16 w-16 rounded-xl object-cover" />
      ) : (
        t("wizard.basics.logoHint")
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => take(e.target.files?.[0])}
      />
    </button>
  );
}
