/** Reserve the clipboard write in the click handler, before async extraction.
 * This module stays small; the extractor/schema are loaded only on demand. */
export async function copyForFigma(prepare: () => Promise<string>) {
    if (!window.isSecureContext || !navigator.clipboard)
        throw new Error("Copy for Figma needs a secure browser window (localhost or HTTPS). Try opening II studio in your regular browser.");
    const started = performance.now();
    let preparedAt = started;
    const payload = Promise.resolve().then(prepare).then(text => {
        preparedAt = performance.now();
        return new Blob([text], { type: "text/plain" });
    });
    // Observe preparation even if the browser denies writing immediately.
    void payload.catch(() => { });
    let write: Promise<void>;
    try {
        try {
            if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
                write = navigator.clipboard.write([new ClipboardItem({ "text/plain": payload })]);
            }
            else if (navigator.clipboard.writeText) {
                write = payload.then(async (blob) => navigator.clipboard.writeText(await blob.text()));
            }
            else
                throw new Error("Clipboard writing is unavailable in this browser.");
        }
        catch (error) {
            write = Promise.reject(error);
        }
        const [data, result] = await Promise.allSettled([payload, write]);
        if (data.status === "rejected")
            throw data.reason;
        if (result.status === "rejected")
            throw new Error("Clipboard access was blocked. Allow clipboard access for II studio and click Copy for Figma again. Nothing was copied.");
        return { bytes: data.value.size, preparationMs: preparedAt - started, clipboardWriteMs: performance.now() - started, postPreparationWriteMs: performance.now() - preparedAt, totalMs: performance.now() - started };
    }
    catch (error) {
        throw error instanceof Error ? error : new Error("The design could not be copied. Please try again.");
    }
}
