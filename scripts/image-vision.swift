import AppKit
import Foundation
import Vision

func cgImage(at path: String) -> CGImage? {
    guard let image = NSImage(contentsOfFile: path) else { return nil }
    var rect = NSRect(origin: .zero, size: image.size)
    return image.cgImage(forProposedRect: &rect, context: nil, hints: nil)
}

var rows: [[String: Any]] = []
var prints: [(String, VNFeaturePrintObservation)] = []

for path in CommandLine.arguments.dropFirst() {
    guard let image = cgImage(at: path) else {
        rows.append(["path": path, "error": "unreadable image"])
        continue
    }
    let faceRequest = VNDetectFaceRectanglesRequest()
    let textRequest = VNRecognizeTextRequest()
    textRequest.recognitionLevel = .fast
    textRequest.usesLanguageCorrection = false
    let classifyRequest = VNClassifyImageRequest()
    let featureRequest = VNGenerateImageFeaturePrintRequest()
    let handler = VNImageRequestHandler(cgImage: image)
    do {
        try handler.perform([faceRequest, textRequest, classifyRequest, featureRequest])
    } catch {
        rows.append(["path": path, "error": error.localizedDescription])
        continue
    }

    let faces = (faceRequest.results ?? []).map { face -> [String: Any] in
        let box = face.boundingBox
        return ["x": box.origin.x, "y": box.origin.y, "width": box.width, "height": box.height]
    }
    let texts = (textRequest.results ?? []).compactMap { observation -> [String: Any]? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        return [
            "text": candidate.string,
            "confidence": candidate.confidence,
            "area": box.width * box.height,
            "x": box.origin.x,
            "y": box.origin.y,
        ]
    }
    let labels = (classifyRequest.results ?? []).prefix(20).map { result -> [String: Any] in
        ["label": result.identifier, "confidence": result.confidence]
    }
    if let feature = featureRequest.results?.first as? VNFeaturePrintObservation {
        prints.append((path, feature))
    }
    rows.append([
        "path": path,
        "width": image.width,
        "height": image.height,
        "faces": faces,
        "texts": texts,
        "labels": labels,
        "duplicates": [],
    ])
}

for left in 0..<prints.count {
    for right in (left + 1)..<prints.count {
        var distance: Float = 0
        do {
            try prints[left].1.computeDistance(&distance, to: prints[right].1)
        } catch {
            continue
        }
        if distance < 0.25 {
            for index in rows.indices {
                guard let path = rows[index]["path"] as? String else { continue }
                if path == prints[left].0 {
                    var duplicates = rows[index]["duplicates"] as? [[String: Any]] ?? []
                    duplicates.append(["path": prints[right].0, "distance": distance])
                    rows[index]["duplicates"] = duplicates
                } else if path == prints[right].0 {
                    var duplicates = rows[index]["duplicates"] as? [[String: Any]] ?? []
                    duplicates.append(["path": prints[left].0, "distance": distance])
                    rows[index]["duplicates"] = duplicates
                }
            }
        }
    }
}

let data = try JSONSerialization.data(withJSONObject: rows, options: [])
FileHandle.standardOutput.write(data)
