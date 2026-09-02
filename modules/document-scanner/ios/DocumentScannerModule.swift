import ExpoModulesCore
import VisionKit
import UIKit

// Local Expo module that wraps Apple's VisionKit document scanner
// (VNDocumentCameraViewController). VisionKit provides, for free and on-device:
//   - real-time document edge / corner detection
//   - automatic shutter when the page is steady and in frame
//   - "keep scanning" multi-page capture (shoot page after page)
//   - perspective correction + upright output
// We return the captured pages as JPEG file URLs; all colour-mode processing,
// review UI, naming and export live in JS so they can be updated over-the-air.
public class DocumentScannerModule: Module {
  private var delegateRef: ScannerDelegate?

  public func definition() -> ModuleDefinition {
    Name("DocumentScanner")

    Function("isAvailable") { () -> Bool in
      return VNDocumentCameraViewController.isSupported
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
          case .success(let uris):
            promise.resolve(uris)
          case .cancelled:
            promise.resolve([String]())
          case .failure(let error):
            promise.reject("E_SCAN_FAILED", error.localizedDescription)
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
