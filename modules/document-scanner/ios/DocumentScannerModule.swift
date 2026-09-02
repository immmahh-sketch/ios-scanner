import ExpoModulesCore
import VisionKit
import UIKit
import CoreImage

// Local Expo module:
//   - `scan()`      wraps VisionKit's VNDocumentCameraViewController (edge
//                   detection, auto-capture, multi-page, perspective correction).
//   - `processImage()` applies one of three colour looks with Core Image and
//                   downscales, returning a new JPEG + its pixel size.
public class DocumentScannerModule: Module {
  private var delegateRef: ScannerDelegate?
  private let ciContext = CIContext(options: [.useSoftwareRenderer: false])

  public func definition() -> ModuleDefinition {
    Name("DocumentScanner")

    Function("isAvailable") { () -> Bool in
      VNDocumentCameraViewController.isSupported
    }

    AsyncFunction("scan") { (promise: Promise) in
      DispatchQueue.main.async {
        guard VNDocumentCameraViewController.isSupported else {
          promise.reject("E_UNSUPPORTED", "Document scanning is not supported on this device.")
          return
        }

        let scannerVC = VNDocumentCameraViewController()
        let delegate = ScannerDelegate { [weak self] result in
          self?.delegateRef = nil
          switch result {
          case .success(let uris): promise.resolve(uris)
          case .cancelled: promise.resolve([String]())
          case .failure(let error): promise.reject("E_SCAN_FAILED", error.localizedDescription)
          }
        }
        self.delegateRef = delegate
        scannerVC.delegate = delegate

        let presenter = self.appContext?.utilities?.currentViewController()
          ?? UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first?.rootViewController

        guard let presenter else {
          self.delegateRef = nil
          promise.reject("E_NO_PRESENTER", "Could not find a view controller to present the scanner.")
          return
        }
        presenter.present(scannerVC, animated: true)
      }
    }

    // mode: "bw" | "color-doc" | "color-photo". maxEdge: cap on the longest side.
    AsyncFunction("processImage") { (uriString: String, mode: String, maxEdge: Double) -> [String: Any] in
      guard let url = URL(string: uriString),
            let input = CIImage(contentsOf: url, options: [.applyOrientationProperty: true])
      else {
        throw ProcessingError.cannotDecode
      }

      var image = input

      // Downscale
      let longest = max(image.extent.width, image.extent.height)
      if maxEdge > 0, longest > CGFloat(maxEdge) {
        let scale = CGFloat(maxEdge) / longest
        image = image.applyingFilter("CILanczosScaleTransform", parameters: [
          kCIInputScaleKey: scale,
          kCIInputAspectRatioKey: 1.0,
        ])
      }

      // Colour look
      switch mode {
      case "bw":
        image = image.applyingFilter("CIColorControls", parameters: [
          kCIInputSaturationKey: 0.0,
          kCIInputContrastKey: 1.35,
          kCIInputBrightnessKey: 0.06,
        ])
      case "color-doc":
        image = image.applyingFilter("CIColorControls", parameters: [
          kCIInputSaturationKey: 1.15,
          kCIInputContrastKey: 1.12,
          kCIInputBrightnessKey: 0.03,
        ])
        image = image.applyingFilter("CIVibrance", parameters: ["inputAmount": 0.25])
      default: // "color-photo"
        image = image.applyingFilter("CIColorControls", parameters: [
          kCIInputSaturationKey: 1.06,
          kCIInputContrastKey: 1.05,
        ])
      }

      let rect = image.extent.integral
      guard rect.width > 0, rect.height > 0,
            let cgImage = self.ciContext.createCGImage(image, from: rect)
      else {
        throw ProcessingError.renderFailed
      }

      let uiImage = UIImage(cgImage: cgImage)
      guard let data = uiImage.jpegData(compressionQuality: 0.92) else {
        throw ProcessingError.encodeFailed
      }

      let dir = FileManager.default.temporaryDirectory
        .appendingPathComponent("processed", isDirectory: true)
      try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      let out = dir.appendingPathComponent("\(UUID().uuidString).jpg")
      try data.write(to: out, options: .atomic)

      return [
        "uri": out.absoluteString,
        "width": Int(rect.width),
        "height": Int(rect.height),
      ]
    }
  }
}

private enum ProcessingError: Error, LocalizedError {
  case cannotDecode, renderFailed, encodeFailed

  var errorDescription: String? {
    switch self {
    case .cannotDecode: return "Could not read the scanned image."
    case .renderFailed: return "Could not render the processed image."
    case .encodeFailed: return "Could not encode the processed image."
    }
  }
}

private enum ScanOutcome {
  case success([String])
  case cancelled
  case failure(Error)
}

private final class ScannerDelegate: NSObject, VNDocumentCameraViewControllerDelegate {
  private let completion: (ScanOutcome) -> Void

  init(completion: @escaping (ScanOutcome) -> Void) {
    self.completion = completion
  }

  func documentCameraViewController(
    _ controller: VNDocumentCameraViewController,
    didFinishWith scan: VNDocumentCameraScan
  ) {
    var uris: [String] = []
    let dir = FileManager.default.temporaryDirectory
      .appendingPathComponent("document-scans", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

    for index in 0..<scan.pageCount {
      let image = scan.imageOfPage(at: index)
      guard let data = image.jpegData(compressionQuality: 0.95) else { continue }
      let fileURL = dir.appendingPathComponent("\(UUID().uuidString).jpg")
      do {
        try data.write(to: fileURL, options: .atomic)
        uris.append(fileURL.absoluteString)
      } catch {
        // skip this page but keep the rest
      }
    }

    controller.dismiss(animated: true) { [completion] in
      completion(.success(uris))
    }
  }

  func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    controller.dismiss(animated: true) { [completion] in
      completion(.cancelled)
    }
  }

  func documentCameraViewController(
    _ controller: VNDocumentCameraViewController,
    didFailWithError error: Error
  ) {
    controller.dismiss(animated: true) { [completion] in
      completion(.failure(error))
    }
  }
}
