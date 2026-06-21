Tesseract.js (Apache-2.0) — on-device OCR for scanned statements.
Vendored, self-hosted, lazily loaded. Files:
  tesseract.min.js                  main library (global `Tesseract`)
  worker.min.js                     web-worker entry
  tesseract-core-simd-lstm.wasm.js  WASM OCR core (LSTM, SIMD) — the wasm binary
                                    is embedded in this file (base64), so no
                                    separate .wasm is shipped.
  spa.traineddata.gz                Spanish language model
Everything runs in the browser; no data ever leaves the device.
