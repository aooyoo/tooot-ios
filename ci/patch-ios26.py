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

# The Xcode "Bundle React Native code and images" phase calls sentry-cli when
# ios/sentry.properties exists. We removed @sentry/react-native, so provide a
# no-op stub: crash reporting is not used in this personal build.
import os, stat
cli = pathlib.Path('node_modules/@sentry/cli/bin/sentry-cli')
cli.parent.mkdir(parents=True, exist_ok=True)
if not cli.exists():
    cli.write_text('#!/bin/sh\nexit 0\n')
    cli.chmod(cli.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    print('created no-op sentry-cli stub')
else:
    print('sentry-cli already present')
