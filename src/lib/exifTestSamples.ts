/**
 * Builds a valid binary JPEG buffer/Uint8Array containing either:
 * 1. Real APP1 EXIF metadata with GPS coordinates (Kothrud, Pune: 18.5074 N, 73.8077 E)
 *    and DateTimeOriginal ("2026:10:11 09:30:00"), parseable by `exifr` in browser and Node.js.
 * 2. A stripped gallery-style JPEG with no EXIF segment.
 */

// Minimal valid 1x1 pixel baseline JPEG frame (without SOI)
const MINIMAL_JPEG_BODY = new Uint8Array([
  0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07,
  0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c,
  0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c,
  0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c,
  0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01,
  0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xc4,
  0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05, 0x05,
  0x04, 0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05,
  0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
  0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24,
  0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26,
  0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44,
  0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76,
  0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92,
  0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6,
  0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba,
  0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5,
  0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8,
  0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff,
  0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd5, 0xff, 0xd9,
]);

function writeUInt16BE(buf: Uint8Array, offset: number, val: number) {
  buf[offset] = (val >> 8) & 0xff;
  buf[offset + 1] = val & 0xff;
}

function writeUInt32BE(buf: Uint8Array, offset: number, val: number) {
  buf[offset] = (val >>> 24) & 0xff;
  buf[offset + 1] = (val >>> 16) & 0xff;
  buf[offset + 2] = (val >>> 8) & 0xff;
  buf[offset + 3] = val & 0xff;
}

function writeAscii(buf: Uint8Array, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    buf[offset + i] = str.charCodeAt(i);
  }
}

/**
 * Generates a JPEG Uint8Array with valid Big-Endian TIFF/EXIF APP1 containing:
 * - DateTimeOriginal: "2026:10:11 09:30:00"
 * - GPSLatitude: 18 deg 30 min 26.64 sec N (18.5074)
 * - GPSLongitude: 73 deg 48 min 27.72 sec E (73.8077)
 */
export function createSampleJpegWithPuneExifBytes(): Uint8Array<ArrayBuffer> {
  // Build TIFF payload (Big Endian "MM")
  const tiff = new Uint8Array(new ArrayBuffer(256));
  // 0..7: TIFF Header: "MM", 0x002a, offset to IFD0 = 8
  writeAscii(tiff, 0, "MM");
  writeUInt16BE(tiff, 2, 0x002a);
  writeUInt32BE(tiff, 4, 8);

  // IFD0 at offset 8: 2 entries (ExifIFDPointer 0x8769, GPSInfoIFDPointer 0x8825)
  writeUInt16BE(tiff, 8, 2);
  // Entry 0 (offset 10): Tag 0x8769 (ExifOffset), Type 4 (LONG), Count 1, Value = 38
  writeUInt16BE(tiff, 10, 0x8769);
  writeUInt16BE(tiff, 12, 4);
  writeUInt32BE(tiff, 14, 1);
  writeUInt32BE(tiff, 18, 38);

  // Entry 1 (offset 22): Tag 0x8825 (GPSInfo), Type 4 (LONG), Count 1, Value = 76
  writeUInt16BE(tiff, 22, 0x8825);
  writeUInt16BE(tiff, 24, 4);
  writeUInt32BE(tiff, 26, 1);
  writeUInt32BE(tiff, 30, 76);

  // Next IFD offset (offset 34) = 0
  writeUInt32BE(tiff, 34, 0);

  // Exif SubIFD at offset 38: 1 entry (DateTimeOriginal 0x9003)
  writeUInt16BE(tiff, 38, 1);
  // Entry 0 (offset 40): Tag 0x9003, Type 2 (ASCII), Count 20, Value Offset = 56
  writeUInt16BE(tiff, 40, 0x9003);
  writeUInt16BE(tiff, 42, 2);
  writeUInt32BE(tiff, 44, 20);
  writeUInt32BE(tiff, 48, 56);
  // Next IFD = 0 (offset 52)
  writeUInt32BE(tiff, 52, 0);
  // DateTimeOriginal string at offset 56 (20 bytes including null terminator)
  writeAscii(tiff, 56, "2026:10:11 09:30:00\0");

  // GPS SubIFD at offset 76: 4 entries
  // 1) 0x0001 GPSLatitudeRef = "N\0"
  // 2) 0x0002 GPSLatitude = 3 RATIONALs at offset 130
  // 3) 0x0003 GPSLongitudeRef = "E\0"
  // 4) 0x0004 GPSLongitude = 3 RATIONALs at offset 154
  writeUInt16BE(tiff, 76, 4);

  // Entry 0 (offset 78): Tag 0x0001, Type 2 (ASCII), Count 2, Value = "N\0\0\0"
  writeUInt16BE(tiff, 78, 0x0001);
  writeUInt16BE(tiff, 80, 2);
  writeUInt32BE(tiff, 82, 2);
  writeAscii(tiff, 86, "N\0\0\0");

  // Entry 1 (offset 90): Tag 0x0002, Type 5 (RATIONAL), Count 3, Offset = 130
  writeUInt16BE(tiff, 90, 0x0002);
  writeUInt16BE(tiff, 92, 5);
  writeUInt32BE(tiff, 94, 3);
  writeUInt32BE(tiff, 98, 130);

  // Entry 2 (offset 102): Tag 0x0003, Type 2 (ASCII), Count 2, Value = "E\0\0\0"
  writeUInt16BE(tiff, 102, 0x0003);
  writeUInt16BE(tiff, 104, 2);
  writeUInt32BE(tiff, 106, 2);
  writeAscii(tiff, 110, "E\0\0\0");

  // Entry 3 (offset 114): Tag 0x0004, Type 5 (RATIONAL), Count 3, Offset = 154
  writeUInt16BE(tiff, 114, 0x0004);
  writeUInt16BE(tiff, 116, 5);
  writeUInt32BE(tiff, 118, 3);
  writeUInt32BE(tiff, 122, 154);

  // Next IFD = 0 (offset 126)
  writeUInt32BE(tiff, 126, 0);

  // Latitude RATIONALs at offset 130: 18 deg, 30 min, 2664/100 sec => 18.5074
  writeUInt32BE(tiff, 130, 18);
  writeUInt32BE(tiff, 134, 1);
  writeUInt32BE(tiff, 138, 30);
  writeUInt32BE(tiff, 142, 1);
  writeUInt32BE(tiff, 146, 2664);
  writeUInt32BE(tiff, 150, 100);

  // Longitude RATIONALs at offset 154: 73 deg, 48 min, 2772/100 sec => 73.8077
  writeUInt32BE(tiff, 154, 73);
  writeUInt32BE(tiff, 158, 1);
  writeUInt32BE(tiff, 162, 48);
  writeUInt32BE(tiff, 166, 1);
  writeUInt32BE(tiff, 170, 2772);
  writeUInt32BE(tiff, 174, 100);

  // Build APP1 segment: 0xFF 0xE1 + length (2 bytes) + "Exif\0\0" (6 bytes) + tiff
  const app1Length = 2 + 6 + tiff.length;
  const out = new Uint8Array(
    new ArrayBuffer(2 + 2 + app1Length + MINIMAL_JPEG_BODY.length)
  );
  // SOI
  out[0] = 0xff;
  out[1] = 0xd8;
  // APP1 marker
  out[2] = 0xff;
  out[3] = 0xe1;
  writeUInt16BE(out, 4, app1Length);
  writeAscii(out, 6, "Exif\0\0");
  out.set(tiff, 12);
  out.set(MINIMAL_JPEG_BODY, 12 + tiff.length);
  return out;
}

/**
 * Generates a valid JPEG Uint8Array with NO EXIF metadata (simulating a gallery photo stripped of EXIF).
 */
export function createSampleJpegWithoutExifBytes(): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(2 + MINIMAL_JPEG_BODY.length));
  out[0] = 0xff;
  out[1] = 0xd8;
  out.set(MINIMAL_JPEG_BODY, 2);
  return out;
}
