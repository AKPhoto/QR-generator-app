# DOCX File Format Support

## Overview
Added support for generating DOCX (Microsoft Word) documents in addition to PDF files for both individual and bulk QR code generation.

## Changes Made

### 1. HTML Updates ([index.html](index.html))
- Added "File Format" dropdown selector in Individual Mode (lines ~40-46)
  - Options: PDF or DOCX (Word Document)
- Added "File Format" dropdown selector in Bulk Mode (lines ~190-196)
  - Options: PDF or DOCX (Word Document)
- Added docx.js library CDN link (line ~240)

### 2. JavaScript Updates ([js/app.js](js/app.js))

#### Modified Methods:
- **`downloadIndividual(type)`**: Now checks the selected file format and calls appropriate conversion method
- **`downloadAll()`**: Updated to support both PDF and DOCX formats in bulk downloads

#### New Methods Added:
- **`convertSvgToDocx(svgContent, filename)`**: Wrapper method to convert SVG to DOCX and trigger download
- **`convertSvgToDocxBlob(svgContent)`**: Core conversion logic that:
  1. Parses the SVG content
  2. Renders SVG to a canvas with proper scaling
  3. Overlays QR code images
  4. Converts canvas to PNG image
  5. Creates a Word document with the image embedded
  6. Returns the DOCX blob

## How It Works

1. **User Selection**: User selects desired file format (PDF or DOCX) from dropdown
2. **Generation**: QR codes are generated as SVG with embedded PNG QR codes (unchanged)
3. **Conversion**: 
   - For PDF: Uses existing jsPDF and svg2pdf libraries
   - For DOCX: Converts SVG to canvas → PNG → embeds in Word document using docx.js
4. **Download**: Files are downloaded individually or as a ZIP archive

## Library Used
- **docx.js v8.5.0**: Microsoft's official library for creating Word documents
  - CDN: https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.js

## Benefits
- Users can now choose their preferred format based on editing needs
- DOCX files can be easily edited in Microsoft Word or compatible applications
- Maintains all QR code functionality and visual quality
- Seamless integration with existing PDF workflow

## Testing Recommendations
1. Test individual badge generation with DOCX format
2. Test individual disc generation with DOCX format
3. Test bulk generation with DOCX format
4. Verify QR codes are properly embedded and scannable
5. Open generated DOCX files in Microsoft Word to verify formatting
