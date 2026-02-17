import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api/providers.dart';
import '../features/auth/login_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/rentals/rentals_field_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(
        path: '/splash',
        builder: (_, __) =>
            const Scaffold(body: Center(child: CircularProgressIndicator())),
      ),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
      GoRoute(path: '/rentals', builder: (_, __) => const RentalsFieldScreen()),
    ],
    redirect: (_, state) {
      if (!authState.isInitialized) {
        return state.uri.path == '/splash' ? null : '/splash';
      }

      if (!authState.isAuthenticated) {
        return state.uri.path == '/login' ? null : '/login';
      }

      if (state.uri.path == '/login' || state.uri.path == '/splash') {
        return '/rentals';
      }

      return null;
    },
  );
});
