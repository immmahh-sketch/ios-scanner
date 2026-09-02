Pod::Spec.new do |s|
  s.name           = 'DocumentScanner'
  s.version        = '1.0.0'
  s.summary        = 'VisionKit document scanner (local Expo module)'
  s.description    = 'Wraps VNDocumentCameraViewController for edge detection, auto-capture and multi-page scanning.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
