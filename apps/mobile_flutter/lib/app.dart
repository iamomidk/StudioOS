import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/api/providers.dart';
import 'routing/app_router.dart';

class StudioOsApp extends ConsumerStatefulWidget {
  const StudioOsApp({super.key});

  @override
  ConsumerState<StudioOsApp> createState() => _StudioOsAppState();
}

class _StudioOsAppState extends ConsumerState<StudioOsApp> {
  @override
  void initState() {
    super.initState();
    Future<void>.microtask(() async {
      await ref.read(authControllerProvider.notifier).initialize();
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      routerConfig: router,
      title: 'StudioOS Mobile',
      theme: ThemeData(colorSchemeSeed: Colors.green, useMaterial3: true),
    );
  }
}
