import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/providers.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final profile = authState.profile;

    return Scaffold(
      appBar: AppBar(
        title: const Text('StudioOS Profile'),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(authControllerProvider.notifier).logout();
            },
            child: const Text('Logout'),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (profile == null)
              const Text('No profile loaded.')
            else ...[
              Text('Email: ${profile['email'] ?? ''}'),
              const SizedBox(height: 8),
              Text(
                'Name: ${profile['firstName'] ?? ''} ${profile['lastName'] ?? ''}',
              ),
              const SizedBox(height: 8),
              Text(
                'Roles: ${(profile['roles'] as List<dynamic>? ?? const []).join(', ')}',
              ),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () async {
                await ref
                    .read(authControllerProvider.notifier)
                    .fetchProfile(allowCachedFallback: true);
              },
              child: const Text('Refresh profile'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () {
                context.go('/rentals');
              },
              child: const Text('Open field operations'),
            ),
            if (authState.errorMessage != null) ...[
              const SizedBox(height: 12),
              Text(
                authState.errorMessage!,
                style: const TextStyle(color: Colors.red),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
