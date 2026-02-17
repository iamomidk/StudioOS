import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/config/app_env.dart';

void main() {
  if (sentryDsn.isNotEmpty) {
    debugPrint('Mobile observability enabled (Sentry DSN configured).');
  }
  runApp(const ProviderScope(child: StudioOsApp()));
}
