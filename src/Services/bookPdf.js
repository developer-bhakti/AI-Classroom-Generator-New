// Reading a textbook PDF and cutting pages out of it, in the browser. pdf-lib is loaded only when a book is
// uploaded or used, so the rest of the app does not pay for it.

import { BookSourceError } from "./bookChapters";

// A BookSourceError, so generator pages show the message as written (see describeGeminiError).
export class BookPdfError extends BookSourceError {}

const loadPdfLib = () => import("pdf-lib");

/** The bytes of a File or Blob. */
export const readBytes = async (file) => new Uint8Array(await file.arrayBuffer());

/** Base64 for a request body. Done in slices because one huge String.fromCharCode call overflows the stack. */
export const bytesToBase64 = (bytes) => {
  let binary = "";
  const slice = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += slice) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + slice));
  }
  return btoa(binary);
};

/**
 * Opens a PDF once and returns its page count plus `extract(ranges)`, which builds a new PDF holding the given
 * page ranges (1-based, inclusive) in the order given. Pages are never repeated.
 */
export const openPdf = async (bytes) => {
  const { PDFDocument } = await loadPdfLib();

  let source;
  try {
    source = await PDFDocument.load(bytes);
  } catch (err) {
    if (/encrypt/i.test(`${err?.name} ${err?.message}`)) {
      throw new BookPdfError("This PDF is locked, so its pages can't be read. Open it in a PDF viewer, choose Print, then \"Save as PDF\" to make an unlocked copy, and upload that one.");
    }
    throw new BookPdfError("This file could not be read as a PDF. Check that it is a normal PDF and not damaged.");
  }

  const pageCount = source.getPageCount();
  if (pageCount === 0) throw new BookPdfError("This PDF has no pages.");

  const extract = async (ranges) => {
    const indexes = [];
    const taken = new Set();
    ranges.forEach(({ start, end }) => {
      for (let page = Math.max(1, start); page <= Math.min(pageCount, end); page += 1) {
        if (!taken.has(page)) {
          taken.add(page);
          indexes.push(page - 1);
        }
      }
    });
    if (!indexes.length) throw new BookPdfError("There are no pages in that range.");

    const output = await PDFDocument.create();
    const pages = await output.copyPages(source, indexes);
    pages.forEach((page) => output.addPage(page));
    return output.save();
  };

  return { pageCount, extract };
};
