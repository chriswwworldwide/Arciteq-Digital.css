// Batch face detection via Apple Vision. Usage:
//   swift scripts/facedetect.swift <img1> [img2 ...]
// Prints one JSON line per file:
//   {"file":"...","w":0,"h":0,"faces":[{"x":0..1,"y":0..1,"w":0..1,"h":0..1,"conf":0..1}]}
// Coords are normalised, TOP-LEFT origin (Vision's bottom-origin flipped here).
import Vision
import AppKit

var out: [String] = []
for path in CommandLine.arguments.dropFirst() {
  guard let img = NSImage(contentsOfFile: path) else {
    out.append("{\"file\":\(path.debugDescription),\"error\":\"unreadable\"}")
    continue
  }
  var box = CGRect(origin: .zero, size: img.size)
  guard let cg = img.cgImage(forProposedRect: &box, context: nil, hints: nil) else {
    out.append("{\"file\":\(path.debugDescription),\"error\":\"no-cgimage\"}")
    continue
  }
  let req = VNDetectFaceRectanglesRequest()
  try? VNImageRequestHandler(cgImage: cg).perform([req])
  let faces = (req.results ?? []).map {
    "{\"x\":\($0.boundingBox.origin.x),\"y\":\(1 - $0.boundingBox.origin.y - $0.boundingBox.height),\"w\":\($0.boundingBox.width),\"h\":\($0.boundingBox.height),\"conf\":\($0.confidence)}"
  }
  out.append("{\"file\":\(path.debugDescription),\"w\":\(cg.width),\"h\":\(cg.height),\"faces\":[\(faces.joined(separator: ","))]}")
}
print(out.joined(separator: "\n"))
