const fs = require("fs");

// An upload says it is a JPEG, PNG or WEBP, but that claim comes from the sender. The first bytes of a real image file are
// fixed, so check them: a web page, a script or any other file renamed ".png" is refused before it is kept.
const SIGNATURES = {
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP",
};

/** Do these first bytes belong to a real image of the claimed type? */
function looksLikeImage(mimeType, head) {
  return Boolean(SIGNATURES[mimeType]?.(head));
}

/** Reads the first bytes of an uploaded file and checks them against what it claims to be. */
function fileIsImage(filePath, mimeType) {
  let fd;
  try {
    fd = fs.openSync(filePath, "r");
    const head = Buffer.alloc(12);
    const read = fs.readSync(fd, head, 0, 12, 0);
    return looksLikeImage(mimeType, head.subarray(0, read));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

module.exports = { looksLikeImage, fileIsImage };
