import AppKit
import Foundation
import Vision

var results: [[String: Any]] = []
for file in CommandLine.arguments.dropFirst() {
    guard let image = NSImage(contentsOfFile: file) else { continue }
    var rect = CGRect(origin: .zero, size: image.size)
    guard let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else { continue }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .fast
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(cgImage: cg).perform([request])
    let texts: [[String: Any]] = (request.results ?? []).compactMap { item in
        guard let text = item.topCandidates(1).first else { return nil }
        return ["text": text.string, "area": item.boundingBox.width * item.boundingBox.height, "y": item.boundingBox.origin.y]
    }
    results.append(["path": file, "texts": texts])
}
let data = try JSONSerialization.data(withJSONObject: results)
FileHandle.standardOutput.write(data)
