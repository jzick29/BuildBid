import { useState, useRef, useCallback } from "react";

interface Photo {
  id: string;
  url: string;
  caption: string;
  created_at: string;
}

interface PhotoUploadProps {
  estimateId: string;
  photos: Photo[];
  onPhotosChanged: () => void;
}

type UploadState = "idle" | "uploading" | "done" | "error";

export function PhotoUpload({ estimateId, photos, onPhotosChanged }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File, photoCaption: string) => {
    setUploading(true);
    setUploadState("uploading");
    setUploadProgress(0);
    setError(null);

    try {
      // 1. Get presigned URL from our API
      const presignRes = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "photos.getPresignedUrl",
          args: {
            data: {
              filename: file.name,
              contentType: file.type,
              contentLength: file.size,
              estimateId,
            },
          },
        }),
        credentials: "include",
      });
      const presignData = await presignRes.json();
      if (presignData.error) throw new Error(presignData.error);

      const { uploadUrl, publicUrl } = presignData;

      // 2. Upload file directly to the presigned URL
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      // 3. Save photo metadata to our DB
      const saveRes = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "photos.savePhoto",
          args: {
            data: {
              estimateId,
              url: publicUrl,
              caption: photoCaption,
            },
          },
        }),
        credentials: "include",
      });
      const saveData = await saveRes.json();
      if (saveData.error) throw new Error(saveData.error);

      setUploadState("done");
      onPhotosChanged();
    } catch (e: any) {
      setError(e.message || "Upload failed");
      setUploadState("error");
    } finally {
      setUploading(false);
    }
  }, [estimateId, onPhotosChanged]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }

    // Validate size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      setError("File too large — max 20MB");
      return;
    }

    setPendingFile(file);
    setCaption("");
    setShowCaptionInput(true);
    setError(null);
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmitCaption = useCallback(() => {
    if (pendingFile) {
      uploadFile(pendingFile, caption);
      setShowCaptionInput(false);
      setPendingFile(null);
    }
  }, [pendingFile, caption, uploadFile]);

  const handleDelete = useCallback(async (photoId: string) => {
    if (deletingId) return;
    setDeletingId(photoId);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: "photos.deletePhoto",
          args: { data: { id: photoId } },
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onPhotosChanged();
    } catch (e: any) {
      setError(e.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }, [onPhotosChanged, deletingId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File too large — max 20MB");
      return;
    }
    setPendingFile(file);
    setCaption("");
    setShowCaptionInput(true);
    setError(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          uploading
            ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950"
            : uploadState === "error"
            ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950"
            : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-indigo-600 dark:hover:bg-gray-900"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload job site photo"
        />

        {uploading ? (
          <div className="space-y-3">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
              Uploading... {uploadProgress}%
            </p>
            <div className="mx-auto h-2 w-48 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">
              Drop photos here or click to upload
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              JPEG, PNG, HEIC up to 20MB
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {/* Caption input modal */}
      {showCaptionInput && pendingFile && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Add caption for <span className="text-indigo-600">{pendingFile.name}</span>
          </p>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g., Before photo — front wall"
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmitCaption(); }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmitCaption}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Upload
            </button>
            <button
              onClick={() => { setShowCaptionInput(false); setPendingFile(null); }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
            >
              <a href={photo.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={photo.url}
                  alt={photo.caption || "Job site photo"}
                  loading="lazy"
                  className="h-40 w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='160'><rect fill='%23f3f4f6' width='200' height='160'/><text fill='%239ca3af' x='100' y='85' text-anchor='middle' font-size='14'>Image unavailable</text></svg>";
                  }}
                />
              </a>
              {photo.caption && (
                <p className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                  {photo.caption}
                </p>
              )}
              <button
                onClick={() => handleDelete(photo.id)}
                disabled={deletingId === photo.id}
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600 disabled:opacity-50"
                title="Delete photo"
              >
                {deletingId === photo.id ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && !uploading && (
        <p className="text-center text-sm text-gray-400 dark:text-gray-500">
          No photos yet. Upload job site photos to attach to this estimate.
        </p>
      )}
    </div>
  );
}
