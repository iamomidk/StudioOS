import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../cache/profile_cache_repository.dart';
import '../../generated/studioos_api_client.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/auth/auth_state.dart';
import '../../features/rentals/rentals_controller.dart';
import '../../features/rentals/rentals_state.dart';
import '../config/app_env.dart';
import '../offline/offline_action_queue_repository.dart';
import '../storage/token_storage.dart';
import 'auth_api_client.dart';
import 'rentals_api_client.dart';
import 'support_api_client.dart';

final tokenStorageProvider = Provider<TokenStorage>((_) {
  return TokenStorage();
});

final apiClientProvider = Provider<StudioOsApiClient>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  return StudioOsApiClient(
    baseUrl: apiBaseUrl,
    accessTokenProvider: () async {
      final (accessToken, _) = await tokenStorage.readTokens();
      return accessToken;
    },
  );
});

final authApiClientProvider = Provider<AuthApiClientPort>((ref) {
  return AuthApiClient(ref.watch(apiClientProvider));
});

final rentalsApiClientProvider = Provider<RentalsApiClientPort>((ref) {
  return RentalsApiClient(ref.watch(apiClientProvider));
});

final supportApiClientProvider = Provider<SupportApiClientPort>((ref) {
  return SupportApiClient(
    baseUrl: apiBaseUrl,
    tokenStorage: ref.watch(tokenStorageProvider),
  );
});

final profileCacheRepositoryProvider = Provider<ProfileCacheRepositoryPort>((
  _,
) {
  return ProfileCacheRepository();
});

final offlineActionQueueRepositoryProvider =
    Provider<OfflineActionQueueRepositoryPort>((_) {
      return OfflineActionQueueRepository();
    });

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) {
    return AuthController(
      apiClient: ref.watch(authApiClientProvider),
      tokenStorage: ref.watch(tokenStorageProvider),
      profileCacheRepository: ref.watch(profileCacheRepositoryProvider),
    );
  },
);

final rentalsControllerProvider =
    StateNotifierProvider<RentalsController, RentalsState>((ref) {
      return RentalsController(
        apiClient: ref.watch(rentalsApiClientProvider),
        offlineQueueRepository: ref.watch(offlineActionQueueRepositoryProvider),
      );
    });
