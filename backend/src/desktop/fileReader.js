const fs = require('fs/promises');
const path = require('path');

let pdfParse;
let mammoth;

// Lazy load libraries to prevent startup issues
function getPdfParser() {
  if (!pdfParse) {
    try {
      const module = require('pdf-parse');
      pdfParse = module.default || module;
    } catch (err) {
      console.error('[fileReader] Failed to load pdf-parse:', err.message);
      throw new Error('pdf-parse library not installed');
    }
  }
  return pdfParse;
}

function getMammoth() {
  if (!mammoth) {
    mammoth = require('mammoth');
  }
  return mammoth;
}

/**
 * Read the content of a local file based on its extension
 * Supported extensions: pdf, docx, txt, csv
 */
async function readFile(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.txt' || ext === '.csv') {
      const content = await fs.readFile(filePath, 'utf8');
      return { success: true, content };
    }

    if (ext === '.pdf') {
      const buffer = await fs.readFile(filePath);
      const { PDFParse } = getPdfParser();
      const data = await PDFParse(buffer);
      return { success: true, content: data.text };
    }

    if (ext === '.docx') {
      const buffer = await fs.readFile(filePath);
      const docxParser = getMammoth();
      const result = await docxParser.extractRawText({ buffer });
      return { success: true, content: result.value };
    }

    return { success: false, error: `Unsupported file type: ${ext}` };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  readFile,
};
