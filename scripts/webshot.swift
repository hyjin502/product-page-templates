// macOS 용 HTML 캡처 (Chrome 이 없을 때) — WKWebView(Safari 엔진)로 정해진 크기 그대로 PNG 를 찍어요.
//   swift scripts/webshot.swift <file.html> <out.png> <width> <height>
import AppKit
import WebKit

let a = CommandLine.arguments
guard a.count >= 5, let w = Double(a[3]), let h = Double(a[4]) else { print("usage: webshot.swift in.html out.png w h"); exit(2) }
let input = URL(fileURLWithPath: a[1]), output = URL(fileURLWithPath: a[2])

final class Shot: NSObject, WKNavigationDelegate {
  let view: WKWebView
  let width: Double
  let out: URL
  init(_ w: Double, _ h: Double, _ o: URL) {
    width = w
    out = o
    view = WKWebView(frame: NSRect(x: 0, y: 0, width: w, height: h))
    super.init()
    view.navigationDelegate = self
  }
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
      let cfg = WKSnapshotConfiguration()
      cfg.snapshotWidth = NSNumber(value: self.width) // 레티나 배율 없이 CSS 픽셀 그대로
      webView.takeSnapshot(with: cfg) { img, err in
        guard let img = img, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
              let png = rep.representation(using: .png, properties: [:]) else { print("snapshot failed: \(String(describing: err))"); exit(1) }
        try? png.write(to: self.out)
        exit(0)
      }
    }
  }
}
let app = NSApplication.shared
let shot = Shot(w, h, output)
shot.view.loadFileURL(input, allowingReadAccessTo: input.deletingLastPathComponent())
DispatchQueue.main.asyncAfter(deadline: .now() + 20) { print("timeout"); exit(1) }
app.run()
