// image-face-match.swift
// Compares candidate images against reference face photos.
// Usage: swift scripts/image-face-match.swift --reference <dir> <candidate1.jpg> <candidate2.jpg> ...
// Output: JSON array of { path, faces: [{ box, coachDistance, coachMatch }] }
//
// coachDistance: lower = more similar (0.0 = identical, <0.4 = likely same person)
// coachMatch: "confirmed" (<0.4), "possible" (<0.55), "unknown" (>=0.55)

import AppKit
import Foundation
import Vision

func cgImage(at path: String) -> CGImage? {
    guard let image = NSImage(contentsOfFile: path) else { return nil }
    var rect = NSRect(origin: .zero, size: image.size)
    return image.cgImage(forProposedRect: &rect, context: nil, hints: nil)
}

// Extract face observations with their feature prints
func extractFaces(from imagePath: String) -> [(VNFaceObservation, CGImage)] {
    guard let image = cgImage(at: imagePath) else { return [] }
    let faceRequest = VNDetectFaceRectanglesRequest()
    let handler = VNImageRequestHandler(cgImage: image)
    do {
        try handler.perform([faceRequest])
    } catch {
        return []
    }
    guard let faces = faceRequest.results, !faces.isEmpty else { return [] }

    // Crop each face region and return with observation
    var results: [(VNFaceObservation, CGImage)] = []
    let w = image.width
    let h = image.height
    for face in faces {
        let box = face.boundingBox
        // Vision coordinates: origin bottom-left, normalised
        let pad = 0.10 // tight crop around face for discriminative embedding
        let x = max(0, Int(Double(w) * (box.origin.x - pad * box.width)))
        let y = max(0, Int(Double(h) * (1 - box.origin.y - box.height - pad * box.height)))
        let cropW = min(w - x, Int(Double(w) * box.width * (1 + 2 * pad)))
        let cropH = min(h - y, Int(Double(h) * box.height * (1 + 2 * pad)))
        if cropW > 10 && cropH > 10, let cropped = image.cropping(to: CGRect(x: x, y: y, width: cropW, height: cropH)) {
            results.append((face, cropped))
        }
    }
    return results
}

// Generate a feature print for a face crop
func faceFeaturePrint(_ crop: CGImage) -> VNFeaturePrintObservation? {
    let request = VNGenerateImageFeaturePrintRequest()
    let handler = VNImageRequestHandler(cgImage: crop)
    do {
        try handler.perform([request])
    } catch {
        return nil
    }
    return request.results?.first as? VNFeaturePrintObservation
}

// Parse arguments
var args = Array(CommandLine.arguments.dropFirst())
var referenceDir: String? = nil
if let refIdx = args.firstIndex(of: "--reference"), refIdx + 1 < args.count {
    referenceDir = args[refIdx + 1]
    args.removeSubrange(refIdx...(refIdx + 1))
}
guard let refDir = referenceDir else {
    FileHandle.standardError.write("usage: swift image-face-match.swift --reference <dir> <candidates...>\n".data(using: .utf8)!)
    exit(1)
}

// Build reference face embeddings
let fm = FileManager.default
let refFiles = (try? fm.contentsOfDirectory(atPath: refDir))?.filter { $0.hasSuffix(".jpg") || $0.hasSuffix(".jpeg") || $0.hasSuffix(".png") } ?? []
var refPrints: [VNFeaturePrintObservation] = []
for file in refFiles {
    let faces = extractFaces(from: (refDir as NSString).appendingPathComponent(file))
    for (_, crop) in faces {
        if let fp = faceFeaturePrint(crop) {
            refPrints.append(fp)
        }
    }
}
FileHandle.standardError.write("face-match: \(refPrints.count) reference face(s) from \(refFiles.count) photo(s)\n".data(using: .utf8)!)

if refPrints.isEmpty {
    FileHandle.standardError.write("face-match: WARNING — no reference faces found, all candidates will be 'unknown'\n".data(using: .utf8)!)
}

// Process candidates
var results: [[String: Any]] = []
for candidatePath in args {
    guard cgImage(at: candidatePath) != nil else {
        results.append(["path": candidatePath, "faces": [] as [[String: Any]]])
        continue
    }
    let candidateFaces = extractFaces(from: candidatePath)
    var faceResults: [[String: Any]] = []
    for (obs, crop) in candidateFaces {
        guard let candidateFP = faceFeaturePrint(crop) else { continue }
        let box = obs.boundingBox
        var bestDistance: Float = 999.0
        for refFP in refPrints {
            var dist: Float = 0
            do {
                try candidateFP.computeDistance(&dist, to: refFP)
                if dist < bestDistance { bestDistance = dist }
            } catch { continue }
        }
        let label: String
        if bestDistance < 0.4 { label = "confirmed" }
        else if bestDistance < 0.55 { label = "possible" }
        else { label = "unknown" }

        faceResults.append([
            "x": box.origin.x,
            "y": box.origin.y,
            "width": box.width,
            "height": box.height,
            "coachDistance": bestDistance,
            "coachMatch": label,
        ])
    }
    results.append([
        "path": candidatePath,
        "faceCount": candidateFaces.count,
        "faces": faceResults,
        "bestMatch": faceResults.min(by: { ($0["coachDistance"] as? Float ?? 999) < ($1["coachDistance"] as? Float ?? 999) })?["coachMatch"] as? String ?? (candidateFaces.isEmpty ? "no_face" : "unknown"),
        "bestDistance": faceResults.min(by: { ($0["coachDistance"] as? Float ?? 999) < ($1["coachDistance"] as? Float ?? 999) })?["coachDistance"] as? Float ?? 999.0,
    ])
}

let data = try JSONSerialization.data(withJSONObject: results, options: [])
FileHandle.standardOutput.write(data)
