"""Patch 2024-era Expo modules for the iOS 26 SDK (exhaustive switch)."""
import pathlib, sys

target = pathlib.Path('node_modules/expo-localization/ios/LocalizationModule.swift')
if not target.exists():
    print('expo-localization not installed; skipping')
    sys.exit(0)

s = target.read_text()
old = '    case .iso8601:\n      return "iso8601"\n    }'
new = '    case .iso8601:\n      return "iso8601"\n    @unknown default:\n      return "gregory"\n    }'
if old in s:
    target.write_text(s.replace(old, new, 1))
    print('patched LocalizationModule.swift')
else:
    print('pattern not found (already patched?)')
